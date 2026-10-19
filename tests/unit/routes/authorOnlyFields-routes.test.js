// ============================================================================
// Author-only character fields over HTTP — depth and registry routers (#1703)
// ============================================================================
// Admin reads and writes all four; editor and viewer can do neither; an
// unauthenticated caller is refused by requireAuth. Mocked, no database.
// Evoni, 2026-10-19 ("this whole part of the site is admin only"; the
// profile audit): the depth generators, the depth writes and the registry
// PUT are ADMIN only, so an editor or viewer is refused there outright.

const express = require('express');
const request = require('supertest');

const AUTHOR = {
  de_blind_spot: 'She cannot see it.',
  de_blind_spot_evidence: 'Everyone else can.',
  de_blind_spot_crack_condition: 'A loss.',
  de_actual_narrative_gap: 'The story she tells is not the one she lives.',
};

// One in-memory character row shared by both routers.
// Proxy: the registry PUT assigns fields onto the instance, the depth routes
// call update(); both land in mockRow.
const mockRow = {};
const mockMethods = {
  toJSON: () => ({ ...mockRow }),
  update: jest.fn(async (u) => { Object.assign(mockRow, u); }),
  save: jest.fn(async () => {}),
};
const mockCharacter = new Proxy({}, {
  get: (_t, prop) => (prop in mockMethods ? mockMethods[prop] : mockRow[prop]),
  set: (_t, prop, value) => { mockRow[prop] = value; return true; },
});
const mockRegistry = { toJSON: () => ({ id: 'r1', title: 'Book 1', characters: [{ ...mockRow }] }) };

jest.mock('../../../src/models', () => ({
  RegistryCharacter: {
    findByPk: jest.fn(async () => mockCharacter),
    // character-generation /confirm reads and writes under a row lock (F-Reg-2, #2184).
    sequelize: { transaction: async (fn) => fn({ LOCK: { UPDATE: 'UPDATE' } }) },
  },
  CharacterRegistry: { findByPk: jest.fn(async () => mockRegistry), findOne: jest.fn(async () => mockRegistry) },
}));
jest.mock('../../../src/services/characterGenerationService', () => ({
  generateFullCharacter: jest.fn(),
  calculateDepthLevel: () => 'active',
}));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return {
    ...actual,
    // Test double: no header → 401; otherwise groups from the header.
    requireAuth: (req, res, next) => {
      const h = req.headers['x-test-groups'];
      if (h === undefined) return res.status(401).json({ error: 'Unauthorized' });
      req.user = { id: 'u1', groups: h ? h.split(',') : [] };
      next();
    },
  };
});

const depthRoutes = require('../../../src/routes/characterDepthRoutes');
const registryRoutes = require('../../../src/routes/characterRegistry');
const generationRoutes = require('../../../src/routes/characterGenerationRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/character-depth', depthRoutes);
app.use('/api/v1/character-registry', registryRoutes);
app.use('/api/v1/character-generation', generationRoutes);

const USERS = { admin: 'admin', editor: 'editor', viewer: 'viewer' };
const call = (method, url, groups, body) => {
  let r = request(app)[method](url);
  if (groups !== undefined) r = r.set('x-test-groups', groups);
  return body ? r.send(body) : r;
};
// As stored since the depth merge (2026-10-17, services/characterDepthFields):
// the blind spot lives in blind_spot; the Depth Engine still reads and sends
// it as de_blind_spot. Both names are author-only.
const STORED = { ...AUTHOR, blind_spot: AUTHOR.de_blind_spot };
delete STORED.de_blind_spot;
const hasNone = (obj) => [...Object.keys(AUTHOR), 'blind_spot'].every((k) => obj == null || !(k in obj));
const ALL = Object.keys(AUTHOR);
const ROW = Object.keys(STORED);
const hasAll = (obj, keys = ALL) => keys.every((k) => obj && obj[k] === (AUTHOR[k] ?? STORED[k]));

const resetRow = (withAuthor) => {
  for (const k of Object.keys(mockRow)) delete mockRow[k];
  Object.assign(mockRow, { id: 'c1', status: 'draft', display_name: 'Lala', de_money_wound: 'old' });
  if (withAuthor) Object.assign(mockRow, STORED);
  mockMethods.update.mockClear();
};

beforeEach(() => {
  mockCreate.mockReset().mockResolvedValue({
    content: [{ text: JSON.stringify({ ...AUTHOR, de_money_wound: 'proposed', de_blind_spot_category: 'self' }) }],
  });
});

describe('reads — the four fields reach the admin group only', () => {
  const READS = [
    ['get', '/api/v1/character-depth/c1', (b) => b.depth],
    ['post', '/api/v1/character-depth/c1/generate', (b) => b.proposed, undefined, true],
    // A single dimension proposes only its own fields: blindspot carries three
    // of the four, narrative carries de_actual_narrative_gap.
    ['post', '/api/v1/character-depth/c1/generate/blindspot', (b) => b.proposed,
      ['de_blind_spot', 'de_blind_spot_evidence', 'de_blind_spot_crack_condition'], true],
    ['post', '/api/v1/character-depth/c1/generate/narrative', (b) => b.proposed, ['de_actual_narrative_gap'], true],
    ['get', '/api/v1/character-registry/characters/c1', (b) => b.character, ROW],
    ['get', '/api/v1/character-registry/registries/r1', (b) => b.registry.characters[0], ROW],
    ['get', '/api/v1/character-registry/registries/default', (b) => b.registry.characters[0], ROW],
  ];

  beforeEach(() => resetRow(true));

  for (const [method, url, pick, keys = ALL, adminOnly = false] of READS) {
    test(`${method.toUpperCase()} ${url}: admin sees ${keys.length === 4 ? 'all four' : keys.join(', ')}`, async () => {
      const res = await call(method, url, USERS.admin);
      expect(res.status).toBe(200);
      expect(hasAll(pick(res.body), keys)).toBe(true);
    });

    for (const who of ['editor', 'viewer']) {
      test(`${method.toUpperCase()} ${url}: ${who} ${adminOnly ? 'is refused and sees none' : 'sees none, other fields intact'}`, async () => {
        const res = await call(method, url, USERS[who]);
        expect(res.status).toBe(adminOnly ? 403 : 200);
        if (!adminOnly) expect(hasNone(pick(res.body))).toBe(true);
        expect(JSON.stringify(res.body)).not.toMatch(/blind_spot"|de_blind_spot_evidence|de_blind_spot_crack_condition|de_actual_narrative_gap/);
      });
    }

    test(`${method.toUpperCase()} ${url}: unauthenticated is refused`, async () => {
      const res = await call(method, url);
      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toMatch(/de_/);
    });
  }

  test('generate: the other proposed fields reach the admin', async () => {
    const res = await call('post', '/api/v1/character-depth/c1/generate', USERS.admin);
    expect(res.body.proposed.de_money_wound).toBe('proposed');
    expect(res.body.proposed.de_blind_spot_category).toBe('self');
  });
});

describe('writes — only the admin group writes the four fields', () => {
  // [method, url, wrap, the response's fields, the keys the response carries them under]
  // [..., adminOnly]: an ADMIN-only write refuses an editor or viewer outright.
  const WRITES = [
    ['put', '/api/v1/character-depth/c1', (fields) => fields, (b) => b.depth, ALL, true],
    ['post', '/api/v1/character-depth/c1/confirm', (fields) => ({ proposed: fields }), (b) => b.depth, ALL, true],
    ['put', '/api/v1/character-registry/characters/c1', (fields) => fields, (b) => b.character, ROW, true],
    // characterGenerationRoutes /confirm spreads `proposed` into update()
    ['post', '/api/v1/character-generation/confirm', (fields) => ({ character_id: 'c1', proposed: fields }),
      (b) => b.character, ROW],
  ];

  beforeEach(() => resetRow(false));

  for (const [method, url, wrap, pick, keys, adminOnly = false] of WRITES) {
    test(`${method.toUpperCase()} ${url}: admin writes all four and reads them back`, async () => {
      const res = await call(method, url, USERS.admin, wrap({ ...AUTHOR, de_money_wound: 'new' }));
      expect(res.status).toBe(200);
      expect(hasAll(mockRow, ROW)).toBe(true);
      expect(mockRow.de_blind_spot).toBeUndefined();
      expect(hasAll(pick(res.body), keys)).toBe(true);
    });

    for (const who of ['editor', 'viewer']) {
      test(`${method.toUpperCase()} ${url}: ${who} cannot write them${adminOnly ? ' (refused, nothing written)' : '; other fields still save'}`, async () => {
        const res = await call(method, url, USERS[who], wrap({ ...AUTHOR, de_money_wound: 'new' }));
        expect(hasNone(mockRow)).toBe(true);
        if (adminOnly) {
          expect(res.status).toBe(403);
          expect(mockRow.de_money_wound).toBe('old');
        } else {
          expect(res.status).toBe(200);
          expect(mockRow.de_money_wound).toBe('new');
          expect(hasNone(pick(res.body))).toBe(true);
        }
      });
    }

    test(`${method.toUpperCase()} ${url}: unauthenticated is refused and writes nothing`, async () => {
      const res = await call(method, url, undefined, wrap({ ...AUTHOR, de_money_wound: 'new' }));
      expect(res.status).toBe(401);
      expect(hasNone(mockRow)).toBe(true);
      expect(mockRow.de_money_wound).toBe('old');
    });
  }

  test('registry PUT: an editor is refused, gets no author-only fields back, and the stored ones stay', async () => {
    resetRow(true); // the row already holds all four (the note's measured case)
    const res = await call('put', '/api/v1/character-registry/characters/c1', USERS.editor, { subtitle: 'kept' });
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toMatch(/de_blind_spot|de_actual_narrative_gap/);
    expect(hasAll(mockRow, ROW)).toBe(true); // stored values untouched
  });

  test('depth PUT: an editor sending only author-only fields is refused and nothing is written', async () => {
    const res = await call('put', '/api/v1/character-depth/c1', USERS.editor, { ...AUTHOR });
    expect(res.status).toBe(403);
    expect(mockMethods.update).not.toHaveBeenCalled();
    expect(hasNone(mockRow)).toBe(true);
  });
});

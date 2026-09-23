// ============================================================================
// Author-only character fields over HTTP — depth and registry routers (#1703)
// ============================================================================
// Admin reads and writes all four; editor and viewer can do neither; an
// unauthenticated caller is refused by requireAuth. Mocked, no database.

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
  RegistryCharacter: { findByPk: jest.fn(async () => mockCharacter) },
  CharacterRegistry: { findByPk: jest.fn(async () => mockRegistry), findOne: jest.fn(async () => mockRegistry) },
}));
jest.mock('../../../src/services/feedAutoGeneration', () => ({ autoCreateFeedProfile: jest.fn() }));
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
const hasNone = (obj) => Object.keys(AUTHOR).every((k) => obj == null || !(k in obj));
const ALL = Object.keys(AUTHOR);
const hasAll = (obj, keys = ALL) => keys.every((k) => obj && obj[k] === AUTHOR[k]);

const resetRow = (withAuthor) => {
  for (const k of Object.keys(mockRow)) delete mockRow[k];
  Object.assign(mockRow, { id: 'c1', status: 'draft', display_name: 'Lala', de_money_wound: 'old' });
  if (withAuthor) Object.assign(mockRow, AUTHOR);
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
    ['post', '/api/v1/character-depth/c1/generate', (b) => b.proposed],
    // A single dimension proposes only its own fields: blindspot carries three
    // of the four, narrative carries de_actual_narrative_gap.
    ['post', '/api/v1/character-depth/c1/generate/blindspot', (b) => b.proposed,
      ['de_blind_spot', 'de_blind_spot_evidence', 'de_blind_spot_crack_condition']],
    ['post', '/api/v1/character-depth/c1/generate/narrative', (b) => b.proposed, ['de_actual_narrative_gap']],
    ['get', '/api/v1/character-registry/characters/c1', (b) => b.character],
    ['get', '/api/v1/character-registry/registries/r1', (b) => b.registry.characters[0]],
    ['get', '/api/v1/character-registry/registries/default', (b) => b.registry.characters[0]],
  ];

  beforeEach(() => resetRow(true));

  for (const [method, url, pick, keys = ALL] of READS) {
    test(`${method.toUpperCase()} ${url}: admin sees ${keys.length === 4 ? 'all four' : keys.join(', ')}`, async () => {
      const res = await call(method, url, USERS.admin);
      expect(res.status).toBe(200);
      expect(hasAll(pick(res.body), keys)).toBe(true);
    });

    for (const who of ['editor', 'viewer']) {
      test(`${method.toUpperCase()} ${url}: ${who} sees none, other fields intact`, async () => {
        const res = await call(method, url, USERS[who]);
        expect(res.status).toBe(200);
        expect(hasNone(pick(res.body))).toBe(true);
        expect(JSON.stringify(res.body)).not.toMatch(/de_blind_spot"|de_blind_spot_evidence|de_blind_spot_crack_condition|de_actual_narrative_gap/);
      });
    }

    test(`${method.toUpperCase()} ${url}: unauthenticated is refused`, async () => {
      const res = await call(method, url);
      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toMatch(/de_/);
    });
  }

  test('generate: other proposed fields still reach an editor', async () => {
    const res = await call('post', '/api/v1/character-depth/c1/generate', USERS.editor);
    expect(res.body.proposed.de_money_wound).toBe('proposed');
    expect(res.body.proposed.de_blind_spot_category).toBe('self');
  });
});

describe('writes — only the admin group writes the four fields', () => {
  const WRITES = [
    ['put', '/api/v1/character-depth/c1', (fields) => fields, (b) => b.depth],
    ['post', '/api/v1/character-depth/c1/confirm', (fields) => ({ proposed: fields }), (b) => b.depth],
    ['put', '/api/v1/character-registry/characters/c1', (fields) => fields, (b) => b.character],
    // characterGenerationRoutes /confirm spreads `proposed` into update()
    ['post', '/api/v1/character-generation/confirm', (fields) => ({ character_id: 'c1', proposed: fields }),
      (b) => b.character],
  ];

  beforeEach(() => resetRow(false));

  for (const [method, url, wrap, pick] of WRITES) {
    test(`${method.toUpperCase()} ${url}: admin writes all four and reads them back`, async () => {
      const res = await call(method, url, USERS.admin, wrap({ ...AUTHOR, de_money_wound: 'new' }));
      expect(res.status).toBe(200);
      expect(hasAll(mockRow)).toBe(true);
      expect(hasAll(pick(res.body))).toBe(true);
    });

    for (const who of ['editor', 'viewer']) {
      test(`${method.toUpperCase()} ${url}: ${who} cannot write them; other fields still save`, async () => {
        const res = await call(method, url, USERS[who], wrap({ ...AUTHOR, de_money_wound: 'new' }));
        expect(res.status).toBe(200);
        expect(hasNone(mockRow)).toBe(true);
        expect(mockRow.de_money_wound).toBe('new');
        expect(hasNone(pick(res.body))).toBe(true);
      });
    }

    test(`${method.toUpperCase()} ${url}: unauthenticated is refused and writes nothing`, async () => {
      const res = await call(method, url, undefined, wrap({ ...AUTHOR, de_money_wound: 'new' }));
      expect(res.status).toBe(401);
      expect(hasNone(mockRow)).toBe(true);
      expect(mockRow.de_money_wound).toBe('old');
    });
  }

  test('registry PUT: an editor editing another field does not get the stored author-only fields back', async () => {
    resetRow(true); // the row already holds all four (the note's measured case)
    const res = await call('put', '/api/v1/character-registry/characters/c1', USERS.editor, { subtitle: 'kept' });
    expect(res.status).toBe(200);
    expect(res.body.character.subtitle).toBe('kept');
    expect(hasNone(res.body.character)).toBe(true);
    expect(hasAll(mockRow)).toBe(true); // stored values untouched
  });

  test('depth PUT: an editor sending only author-only fields gets 400 and nothing is written', async () => {
    const res = await call('put', '/api/v1/character-depth/c1', USERS.editor, { ...AUTHOR });
    expect(res.status).toBe(400);
    expect(mockMethods.update).not.toHaveBeenCalled();
    expect(hasNone(mockRow)).toBe(true);
  });
});

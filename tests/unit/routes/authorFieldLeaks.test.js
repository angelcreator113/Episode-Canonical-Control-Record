// ============================================================================
// The two remaining author-field read leaks (#1705)
// ============================================================================
// POST /api/v1/memories/story-engine-add-character (already-existed branch)
// and POST /api/v1/world/characters/:id/re-sync returned full
// registry_characters rows. Each response is now filtered per response:
// admin sees the four author-only fields; editor, viewer and unauthenticated
// callers do not; the rest of each response is unchanged. Mocked, no database.

const express = require('express');
const request = require('supertest');

const AUTHOR = {
  de_blind_spot: 'She cannot see it.',
  de_blind_spot_evidence: 'Everyone else can.',
  de_blind_spot_crack_condition: 'A loss.',
  de_actual_narrative_gap: 'The story she tells is not the one she lives.',
};
const mockRow = () => ({
  id: 'rc1', registry_id: 'r1', character_key: 'lala', display_name: 'Lala',
  de_money_wound: 'kept', ...AUTHOR,
});

const mockQuery = jest.fn(async (sql) => {
  if (/FROM world_characters/.test(sql)) return [{ id: 'wc1', name: 'Lala', origin_story: null }];
  if (/SELECT id, registry_id FROM registry_characters/.test(sql)) return [{ id: 'rc1', registry_id: 'r1' }];
  if (/SELECT \* FROM registry_characters/.test(sql)) return [mockRow()];
  return [];
});

jest.mock('../../../src/models', () => ({
  sequelize: { query: (...a) => mockQuery(...a), QueryTypes: { SELECT: 'SELECT', UPDATE: 'UPDATE' } },
  CharacterRegistry: { findOne: jest.fn(async () => ({ id: 'r1' })) },
  // Sequelize instance shape: the route sends it straight to res.json
  RegistryCharacter: {
    findOne: jest.fn(async () => ({ toJSON: () => mockRow() })),
    create: jest.fn(),
  },
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  const fake = (req, res, next) => {
    const h = req.headers['x-test-groups'];
    if (h === undefined) return res.status(401).json({ error: 'Unauthorized' });
    req.user = { id: 'u1', groups: h ? h.split(',') : [] };
    next();
  };
  return { ...actual, requireAuth: fake };
});

// Both route files start module-level cleanup timers on load (engine.js's job
// cleanup interval; worldStudio.js's two cleanup timers). Register them on the
// fake clock so they hold no real handles, then use real timers for HTTP.
jest.useFakeTimers();
const engineRoutes = require('../../../src/routes/memories/engine');
const worldStudioRoutes = require('../../../src/routes/worldStudio');
jest.useRealTimers();

const app = express();
app.use(express.json());
app.use('/api/v1/memories', engineRoutes);
app.use('/api/v1', worldStudioRoutes);

const ROUTES = [
  ['POST /api/v1/memories/story-engine-add-character',
    () => request(app).post('/api/v1/memories/story-engine-add-character').send({ character_name: 'Lala' }),
    (b) => b.character, { success: true, already_existed: true }],
  ['POST /api/v1/world/characters/:id/re-sync',
    () => request(app).post('/api/v1/world/characters/wc1/re-sync').send({}),
    (b) => b.registry_character, { synced: true }],
];

const hasAll = (o) => Object.entries(AUTHOR).every(([k, v]) => o && o[k] === v);
const hasNone = (o) => Object.keys(AUTHOR).every((k) => o == null || !(k in o));

describe.each(ROUTES)('%s', (_name, send, pick, rest) => {
  test('admin sees all four author-only fields', async () => {
    const res = await send().set('x-test-groups', 'admin');
    expect(res.status).toBe(200);
    expect(hasAll(pick(res.body))).toBe(true);
    expect(res.body).toMatchObject(rest);
  });

  test.each(['editor', 'viewer'])('%s sees none; the rest of the response is unchanged', async (group) => {
    const res = await send().set('x-test-groups', group);
    expect(res.status).toBe(200);
    expect(hasNone(pick(res.body))).toBe(true);
    const { de_blind_spot, de_blind_spot_evidence, de_blind_spot_crack_condition, de_actual_narrative_gap, ...others } = mockRow();
    expect(pick(res.body)).toEqual(others);
    expect(res.body).toMatchObject(rest);
  });

  test('unauthenticated caller is refused and gets no fields', async () => {
    const res = await send();
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toMatch(/de_/);
  });
});

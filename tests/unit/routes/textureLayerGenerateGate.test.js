// ============================================================================
// POST /api/v1/texture-layer/generate — admin-group gate (#1727)
// ============================================================================
// Admin only, checked before any AI call: a refused caller never reaches
// generateTextureLayer. Mocked, no database.

const express = require('express');
const request = require('supertest');

const mockGenerate = jest.fn(async () => ({ story_number: 10, character_key: 'lala', post_text: 'p' }));

jest.mock('../../../src/models', () => ({
  StoryTexture: {
    findOne: jest.fn(async () => null),
    create: jest.fn(async (row) => row),
  },
  RegistryCharacter: {
    findOne: jest.fn(async () => ({ dataValues: { id: 'c1', display_name: 'Lala' } })),
    findAll: jest.fn(async () => []),
  },
}));
jest.mock('../../../src/services/textureLayerService', () => ({ generateTextureLayer: (...a) => mockGenerate(...a) }));
jest.mock('../../../src/services/arcTrackingService', () => ({ updateArcTracking: jest.fn(async () => {}) }));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return {
    ...actual,
    requireAuth: (req, res, next) => {
      const h = req.headers['x-test-groups'];
      if (h === undefined) return res.status(401).json({ error: 'Unauthorized' });
      req.user = { id: 'u1', groups: h ? h.split(',') : [] };
      next();
    },
  };
});

const router = require('../../../src/routes/textureLayerRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/texture-layer', router);

const BODY = { story: { story_number: 10, story_type: 'collision' }, character_key: 'lala' };
const generate = (groups) => {
  let r = request(app).post('/api/v1/texture-layer/generate');
  if (groups !== undefined) r = r.set('x-test-groups', groups);
  return r.send(BODY);
};

beforeEach(() => {
  mockGenerate.mockClear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('an admin reaches the generator', async () => {
  const res = await generate('admin');
  expect(res.status).toBe(200);
  expect(mockGenerate).toHaveBeenCalledTimes(1);
});

test('the group check is case-insensitive, as userInGroup is', async () => {
  const res = await generate('Admin');
  expect(res.status).toBe(200);
  expect(mockGenerate).toHaveBeenCalledTimes(1);
});

test.each(['editor', 'viewer', ''])('group "%s" is refused with 403 and the generator is not called', async (groups) => {
  const res = await generate(groups);
  expect(res.status).toBe(403);
  expect(res.body.error).toMatch(/admin group/);
  expect(mockGenerate).not.toHaveBeenCalled();
});

test('an unauthenticated caller is refused by requireAuth and the generator is not called', async () => {
  const res = await generate(undefined);
  expect(res.status).toBe(401);
  expect(mockGenerate).not.toHaveBeenCalled();
});

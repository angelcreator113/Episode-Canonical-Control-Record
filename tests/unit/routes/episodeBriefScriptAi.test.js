// ============================================================================
// The Script tab's AI routes (Script page audit, 2026-10-19): a refused
// budget is a 429 with its code, not a 500, as the scene plan route answers
// it; Rewrite line tries twice, and not again after a refused budget; the
// script-context route logs what failed. Mocked: no database, no network.
// ============================================================================

const express = require('express');
const request = require('supertest');

const mockCreate = jest.fn();
const mockBeat = jest.fn();
const mockScript = jest.fn();
const mockContext = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockCreate(...a) } }));
  Anthropic.default = Anthropic;
  return Anthropic;
});
jest.mock('../../../src/models', () => ({
  EpisodeBrief: { findOne: async () => ({ toJSON: () => ({}) }) },
  Episode: { findByPk: async () => ({ id: 'ep1', deleted_at: null, script_content: '', script_locked_beats: [] }) },
  ScenePlan: {}, SceneSet: {},
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/services/scenePlannerService', () => ({
  generateScenePlan: jest.fn(), getScenePlanForScriptGenerator: (...a) => mockContext(...a),
}));
jest.mock('../../../src/services/feedMomentSaveService', () => ({ missingFeedMomentBeats: jest.fn(), retryMissingFeedMoments: jest.fn() }));
jest.mock('../../../src/services/brainRules', () => ({ selectInjectedRules: async () => ({ rules: [] }) }));
jest.mock('../../../src/services/groundedScriptGeneratorService', () => ({
  generateGroundedBeat: (...a) => mockBeat(...a),
  generateGroundedScript: (...a) => mockScript(...a),
}));

const router = require('../../../src/routes/episodeBriefRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/episodes', router);

const SHOW = '3f2a9c1e-0000-4000-8000-000000000001';
const budget = () => Object.assign(new Error('AI daily budget exceeded ($5.00 / $5). Call blocked.'), { status: 429, code: 'AI_BUDGET_EXCEEDED' });

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  mockCreate.mockReset();
  mockBeat.mockReset();
  mockScript.mockReset();
  mockContext.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('generate-script answers a refused budget with 429 and its code', async () => {
  mockScript.mockRejectedValue(budget());
  const res = await request(app).post('/api/v1/episodes/ep1/generate-script').send({ showId: SHOW });
  expect(res.status).toBe(429);
  expect(res.body.code).toBe('AI_BUDGET_EXCEEDED');
});

test('regenerate-beat answers a refused budget with 429 and its code', async () => {
  mockBeat.mockRejectedValue(budget());
  const res = await request(app).post('/api/v1/episodes/ep1/regenerate-beat').send({ showId: SHOW, beatNumber: 8, script: '' });
  expect(res.status).toBe(429);
  expect(res.body.code).toBe('AI_BUDGET_EXCEEDED');
});

test('rewrite-line answers a refused budget with 429, after one call', async () => {
  mockCreate.mockRejectedValue(budget());
  const res = await request(app).post('/api/v1/episodes/ep1/rewrite-line').send({ line: 'Lala: hi', speaker: 'Lala' });
  expect(res.status).toBe(429);
  expect(res.body.code).toBe('AI_BUDGET_EXCEEDED');
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test('rewrite-line tries a second time after a failed call', async () => {
  mockCreate
    .mockRejectedValueOnce(Object.assign(new Error('overloaded'), { status: 529 }))
    .mockResolvedValueOnce({ content: [{ text: 'Bestie, hi.' }] });
  const res = await request(app).post('/api/v1/episodes/ep1/rewrite-line').send({ line: 'Lala: hi', speaker: 'Lala' });
  expect(res.status).toBe(200);
  expect(res.body.rewrittenLine).toBe('Bestie, hi.');
  expect(mockCreate).toHaveBeenCalledTimes(2);
  expect(mockCreate.mock.calls[0][0].model).toBe('claude-haiku-4-5-20251001');
});

test('rewrite-line gives up after two failed calls with a 500', async () => {
  mockCreate.mockRejectedValue(Object.assign(new Error('overloaded'), { status: 529 }));
  const res = await request(app).post('/api/v1/episodes/ep1/rewrite-line').send({ line: 'Lala: hi', speaker: 'Lala' });
  expect(res.status).toBe(500);
  expect(mockCreate).toHaveBeenCalledTimes(2);
});

test('script-context logs a failed read', async () => {
  mockContext.mockRejectedValue(new Error('db down'));
  const res = await request(app).get('/api/v1/episodes/ep1/script-context');
  expect(res.status).toBe(500);
  expect(console.error).toHaveBeenCalledWith('[ScriptContext] Error:', 'db down');
});

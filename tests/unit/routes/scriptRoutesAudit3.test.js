// ============================================================================
// Script routes, third pass (Script page audit 3, 2026-10-19): Regenerate one
// beat refuses another show's id, as Generate script does (another show's
// phone, overlays and coins were read into the prompt); the old Script
// Writer's Generate answers a refused budget with 429 and its code, as the
// grounded routes do. Mocked: no database, no network.
// ============================================================================

const express = require('express');
const request = require('supertest');

const mockBeat = jest.fn();
const mockLegacy = jest.fn();
const SHOW = '3f2a9c1e-0000-4000-8000-000000000001';
const OTHER = '3f2a9c1e-0000-4000-8000-000000000002';
jest.mock('@anthropic-ai/sdk', () => {
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } }));
  Anthropic.default = Anthropic;
  return Anthropic;
});
jest.mock('../../../src/models', () => ({
  EpisodeBrief: { findOne: async () => ({ id: 'b1', toJSON: () => ({}) }) },
  Episode: { findByPk: async () => ({ id: 'ep1', show_id: '3f2a9c1e-0000-4000-8000-000000000001', deleted_at: null, script_content: '', script_locked_beats: [] }) },
  ScenePlan: {}, SceneSet: {},
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/services/scenePlannerService', () => ({ generateScenePlan: jest.fn(), getScenePlanForScriptGenerator: jest.fn() }));
jest.mock('../../../src/services/feedMomentSaveService', () => ({ missingFeedMomentBeats: jest.fn(), retryMissingFeedMoments: jest.fn() }));
jest.mock('../../../src/services/groundedScriptGeneratorService', () => ({ generateGroundedBeat: (...a) => mockBeat(...a), generateGroundedScript: jest.fn() }));
jest.mock('../../../src/services/episodeScriptWriterService', () => ({ generateEpisodeScript: (...a) => mockLegacy(...a) }));

const app = express();
app.use(express.json());
app.use('/api/v1/episodes', require('../../../src/routes/episodeBriefRoutes'));
app.use('/api/v1/episode-scripts', require('../../../src/routes/episodeScriptWriterRoutes'));

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  mockBeat.mockReset();
  mockLegacy.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('regenerate-beat refuses a show id that is not the episode\'s, before any AI call', async () => {
  const res = await request(app).post('/api/v1/episodes/ep1/regenerate-beat').send({ showId: OTHER, beatNumber: 8, script: '' });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe("showId is not this episode's show");
  expect(mockBeat).not.toHaveBeenCalled();
});

test('regenerate-beat with the episode\'s own show still writes the beat', async () => {
  mockBeat.mockResolvedValue('## BEAT: 8 · Transformation Loop\nMe: hi');
  const res = await request(app).post('/api/v1/episodes/ep1/regenerate-beat').send({ showId: SHOW, beatNumber: 8, script: '' });
  expect(res.status).toBe(200);
});

test('the old Script Writer answers a refused budget with 429 and its code', async () => {
  mockLegacy.mockRejectedValue(Object.assign(new Error('AI daily budget exceeded'), { status: 429, code: 'AI_BUDGET_EXCEEDED' }));
  const res = await request(app).post('/api/v1/episode-scripts/ep1/generate').send({ showId: SHOW });
  expect(res.status).toBe(429);
  expect(res.body.code).toBe('AI_BUDGET_EXCEEDED');
});

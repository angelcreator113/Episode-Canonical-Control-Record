// ============================================================================
// Resume setup's answer (POST /api/v1/episode-brief/:episodeId/setup/resume)
// when the setup is still incomplete (B3 correction; Evoni, 2026-11-23;
// docs/audit/F-AUTH-1_PlaceLockGenerationB3_Amendment_2026-11-23.md §4b).
//
// The sentence was built from the scene-plan step alone: a setup whose beats
// all exist and whose locations step is failed read "Setup is still
// incomplete: 0 beats missing ()". It now says the failed locations step's
// own recorded reason. The route works nothing out: resumeEpisodeSetup is
// mocked here and the answer is made from what it returns. No database.
// ============================================================================

const express = require('express');
const request = require('supertest');

const mockResume = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } }));
  Anthropic.default = Anthropic;
  return Anthropic;
});
jest.mock('../../../src/models', () => ({
  EpisodeBrief: {}, Episode: {}, ScenePlan: {}, SceneSet: {}, FranchiseKnowledge: {},
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1', groups: ['ADMIN'], role: 'ADMIN' }; next(); } };
});
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/services/scenePlannerService', () => ({ generateScenePlan: jest.fn(), getScenePlanForScriptGenerator: jest.fn() }));
jest.mock('../../../src/services/feedMomentSaveService', () => ({ missingFeedMomentBeats: jest.fn(), retryMissingFeedMoments: jest.fn() }));
jest.mock('../../../src/services/groundedScriptGeneratorService', () => ({ generateGroundedBeat: jest.fn(), generateGroundedScript: jest.fn() }));
jest.mock('../../../src/services/episodeGeneratorService', () => ({ resumeEpisodeSetup: (...a) => mockResume(...a) }));

const router = require('../../../src/routes/episodeBriefRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/episode-brief', router);

const resume = () => request(app).post('/api/v1/episode-brief/ep-1/setup/resume').send({});
const PLAN_DONE = { status: 'complete', created: 0, existing: 14, missing: [], failed: [] };
const PLAN_PARTIAL = { status: 'partial', created: 11, existing: 0, missing: [6, 10, 12], failed: [] };
const REASON = "The episode's locations are not complete. Missing: Home. 3 beats name a scene set that is not their location (beats 10, 11, 12). Set them in the episode's Locations and Beat Plan, then choose Resume setup.";
const FAILED = { status: 'failed', code: 'LOCATIONS_INCOMPLETE', reason: REASON, roles: [{ role: 'event', name: null }, { role: 'home', name: null }] };
const FIXED = "The episode's locations were not saved. Set them in the episode's Locations, then choose Resume setup.";
const resultOf = (scenePlan, locations, complete = false) => ({
  episode_id: 'ep-1', scene_plan: scenePlan,
  setup_status: { complete, updated_at: '2026-11-23T00:00:00.000Z', steps: { scene_plan: scenePlan, ...(locations ? { locations } : {}) } },
});

beforeEach(() => {
  mockResume.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('Resume setup: the sentence of a setup that is still incomplete', () => {
  test('every beat exists and the locations step is failed: the step\'s own reason, never "0 beats missing"', async () => {
    const result = resultOf(PLAN_DONE, FAILED);
    mockResume.mockResolvedValue(result);
    const res = await resume();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: false, error: REASON, code: 'SETUP_INCOMPLETE', data: result });
    expect(res.body.error).not.toMatch(/0 beats missing|Setup is still incomplete/);
    expect(res.body.data.setup_status.steps.locations.code).toBe('LOCATIONS_INCOMPLETE');
    expect(mockResume).toHaveBeenCalledTimes(1);
    expect(mockResume.mock.calls[0][1]).toBe('ep-1');
  });

  test('a step as Start records it (the finalizer\'s code): its reason likewise', async () => {
    const reason = "This event's scene set changed while this was being made. Nothing was saved over the newer choice. The episode's locations were not saved: set them in the episode's Locations.";
    mockResume.mockResolvedValue(resultOf(PLAN_DONE, { status: 'failed', code: 'STALE_SOURCE_SET', reason, roles: [] }));
    expect((await resume()).body).toMatchObject({ success: false, error: reason, code: 'SETUP_INCOMPLETE' });
  });

  test('beats missing and the locations complete: the sentence as it always was, byte for byte', async () => {
    const result = resultOf(PLAN_PARTIAL, { status: 'complete', count: 2 });
    mockResume.mockResolvedValue(result);
    const res = await resume();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: false, error: 'Setup is still incomplete: 3 beats missing (6, 10, 12)', code: 'SETUP_INCOMPLETE', data: result });

    mockResume.mockResolvedValue(resultOf({ ...PLAN_PARTIAL, missing: [6] }, null));
    expect((await resume()).body.error).toBe('Setup is still incomplete: 1 beat missing (6)');
  });

  test('beats missing and the locations step failed: the beats sentence, then the step\'s reason', async () => {
    mockResume.mockResolvedValue(resultOf(PLAN_PARTIAL, FAILED));
    const res = await resume();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: false, code: 'SETUP_INCOMPLETE', error: `Setup is still incomplete: 3 beats missing (6, 10, 12). ${REASON}` });
  });

  test('a failed locations step with no code (recorded before the codes were, its reason the error\'s own message): a fixed sentence, nothing of the reason', async () => {
    const raw = 'insert or update on table "scene_set_episodes" violates foreign key constraint "scene_set_episodes_scene_set_id_fkey"';
    mockResume.mockResolvedValue(resultOf(PLAN_DONE, { status: 'failed', reason: raw }));
    const res = await resume();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: false, code: 'SETUP_INCOMPLETE', error: FIXED });
    expect(res.body.error).not.toMatch(/violates|constraint|scene_set_episodes/);

    mockResume.mockResolvedValue(resultOf(PLAN_PARTIAL, { status: 'failed', reason: raw }));
    expect((await resume()).body.error).toBe(`Setup is still incomplete: 3 beats missing (6, 10, 12). ${FIXED}`);
    // A coded step whose reason is missing: the fixed sentence too.
    mockResume.mockResolvedValue(resultOf(PLAN_DONE, { status: 'failed', code: 'SAVE_FAILED' }));
    expect((await resume()).body.error).toBe(FIXED);
  });

  test('incomplete for another step only (the season slot): the sentence as it was', async () => {
    const result = resultOf(PLAN_DONE, { status: 'complete', count: 2 });
    result.setup_status.steps.season_slot = { status: 'failed', reason: 'no slot' };
    mockResume.mockResolvedValue(result);
    expect((await resume()).body.error).toBe('Setup is still incomplete: 0 beats missing ()');
  });

  test('complete: the success body as it was, with no error and no code', async () => {
    const result = resultOf(PLAN_DONE, { status: 'complete', count: 2 }, true);
    mockResume.mockResolvedValue(result);
    const res = await resume();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: result });
  });

  test('an unknown episode is 404, as it was', async () => {
    mockResume.mockResolvedValue(null);
    const res = await resume();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Episode not found' });
  });
});

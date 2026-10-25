// ============================================================================
// Character voices that learn (Evoni, 2026-10-25): the /api/v1/voice routes'
// checks and answers, and Rewrite line reading the speaker's learned voice.
// Mocked: no database, no network.
// ============================================================================

const express = require('express');
const request = require('supertest');

const mockCreate = jest.fn();
const mockBlock = jest.fn();
const mockRecord = jest.fn();
const mockView = jest.fn();
let mockRole = 'ADMIN';
jest.mock('@anthropic-ai/sdk', () => {
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockCreate(...a) } }));
  Anthropic.default = Anthropic;
  return Anthropic;
});
jest.mock('../../../src/models', () => ({
  EpisodeBrief: { findOne: async () => ({ toJSON: () => ({}) }) },
  Episode: { findByPk: async () => ({ id: 'ep1', deleted_at: null }) },
  ScenePlan: {}, SceneSet: {},
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1', groups: [mockRole], role: mockRole }; next(); } };
});
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/services/scenePlannerService', () => ({ generateScenePlan: jest.fn(), getScenePlanForScriptGenerator: jest.fn() }));
jest.mock('../../../src/services/feedMomentSaveService', () => ({ missingFeedMomentBeats: jest.fn(), retryMissingFeedMoments: jest.fn() }));
jest.mock('../../../src/services/brainRules', () => ({ selectInjectedRules: async () => ({ rules: [] }) }));
jest.mock('../../../src/services/characterVoice', () => {
  const actual = jest.requireActual('../../../src/services/characterVoice');
  return {
    ...actual,
    voicePromptBlock: (...a) => mockBlock(...a),
    recordSignal: (...a) => mockRecord(...a),
    characterVoiceView: (...a) => mockView(...a),
  };
});

const app = express();
app.use(express.json());
app.use('/api/v1/episodes', require('../../../src/routes/episodeBriefRoutes'));
app.use('/api/v1/voice', require('../../../src/routes/characterVoiceRoutes'));

const EP = '3f2a9c1e-0000-4000-8000-0000000000e1';
const ok = { episodeId: EP, beatNumber: 3, speaker: 'Lala', original: 'Hello there everyone.', edited: 'Bestie. Hi.' };

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  mockRole = 'ADMIN';
  [mockCreate, mockBlock, mockRecord, mockView].forEach((m) => m.mockReset());
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('POST /voice/signals', () => {
  test.each([
    [{ ...ok, episodeId: 'nope' }, 'episodeId'],
    [{ ...ok, beatNumber: 15 }, 'beatNumber'],
    [{ ...ok, speaker: '' }, 'speaker'],
    [{ ...ok, original: '' }, 'original'],
    [{ ...ok, edited: 'x'.repeat(2001) }, 'edited'],
    [{ ...ok, direction: 5 }, 'direction'],
  ])('refuses a bad body (%#)', async (body, field) => {
    const res = await request(app).post('/api/v1/voice/signals').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain(field);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  test('a kept signal is 201; a skipped one 200', async () => {
    mockRecord.mockResolvedValueOnce({ signal: { id: 7, character_key: 'lala' } }).mockResolvedValueOnce({ skipped: true, reason: 'no change' });
    const a = await request(app).post('/api/v1/voice/signals').send({ ...ok, direction: 'Punchier' });
    expect(a.status).toBe(201);
    expect(mockRecord.mock.calls[0][1]).toMatchObject({ episodeId: EP, beatNumber: 3, speaker: 'Lala', direction: 'Punchier' });
    const b = await request(app).post('/api/v1/voice/signals').send(ok);
    expect(b.status).toBe(200);
    expect(b.body).toEqual({ skipped: true, reason: 'no change' });
  });

  test("before the migration it is 409, the database update hasn't run yet", async () => {
    const { VoiceSchemaMissing } = jest.requireActual('../../../src/services/characterVoice');
    mockRecord.mockRejectedValue(new VoiceSchemaMissing());
    const res = await request(app).post('/api/v1/voice/signals').send(ok);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'VOICE_SCHEMA_MISSING' });
    expect(res.body.error).toMatch(/hasn't run yet/);
  });

  test('a missing column that slips through is 409 too', async () => {
    mockView.mockRejectedValue(Object.assign(new Error('column "size" does not exist'), { original: { code: '42703' } }));
    const res = await request(app).get('/api/v1/voice/characters/lala');
    expect(res.status).toBe(409);
  });
});

test('decisions and learning need ADMIN', async () => {
  mockRole = 'USER';
  for (const path of ['/api/v1/voice/rules/1/approve', '/api/v1/voice/rules/1/dismiss', '/api/v1/voice/rules/1/undo', '/api/v1/voice/learn/lala']) {
    const res = await request(app).post(path).send({});
    expect(res.status).toBe(403);
  }
});

test('GET /voice/speakers needs an episode id', async () => {
  expect((await request(app).get('/api/v1/voice/speakers')).status).toBe(400);
  expect((await request(app).get('/api/v1/voice/episode/nope/rules')).status).toBe(400);
});

describe("Rewrite line reads the speaker's learned voice", () => {
  test("Lala's block of the beat's context goes in the prompt", async () => {
    mockBlock.mockResolvedValue('═══ LEARNED VOICES ═══\nHOW LALA REALLY SOUNDS\n- Two sentences at most.');
    mockCreate.mockResolvedValue({ content: [{ text: 'Bestie. Look.' }] });
    const res = await request(app).post(`/api/v1/episodes/${EP}/rewrite-line`).send({ line: 'Hello there.', speaker: 'Lala', beatName: 'BEAT 12: The Fashion Challenge', beatNumber: 12 });
    expect(res.status).toBe(200);
    expect(mockBlock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ characterKeys: ['lala'], context: 'cutscene' }));
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('HOW LALA REALLY SOUNDS');
  });

  test('a speaker no one answers to gets no block, and the rewrite still runs', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'Sure.' }] });
    const res = await request(app).post(`/api/v1/episodes/${EP}/rewrite-line`).send({ line: 'Hi.', speaker: 'Guest' });
    expect(res.status).toBe(200);
    expect(mockBlock).not.toHaveBeenCalled();
  });

  test('a failed voice read never stops the rewrite', async () => {
    mockBlock.mockRejectedValue(new Error('db down'));
    mockCreate.mockResolvedValue({ content: [{ text: 'Okay.' }] });
    const res = await request(app).post(`/api/v1/episodes/${EP}/rewrite-line`).send({ line: 'Hi.', speaker: 'Me' });
    expect(res.status).toBe(200);
    expect(res.body.rewrittenLine).toBe('Okay.');
  });
});

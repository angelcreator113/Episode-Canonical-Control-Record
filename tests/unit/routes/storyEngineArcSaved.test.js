// ============================================================================
// "Arc saved" only when saved; default arc context is logged and marked (#1847)
// ============================================================================
// POST /api/v1/memories/generate-story-tasks-stream used to send
// 'Arc saved' even when the StoryTaskArc upsert failed. It now sends
// { saved: false, message: 'Arc generated but not saved' } on failure.
// /generate-story-tasks returns `saved` in its JSON. buildArcGenerationContext
// logs a failed arc read and returns `usedDefaults: true`. Mocked, no database.

const express = require('express');
const request = require('supertest');

const MOCK_ARC_JSON = JSON.stringify([{ story_number: 1, title: 'One', wound_clock: 70, stakes_level: 2 }]);

const mockStoryTaskArc = {
  sync: jest.fn(async () => {}),
  upsert: jest.fn(async () => {}),
  findOne: jest.fn(async () => null),
};

jest.mock('../../../src/models', () => ({
  StoryTaskArc: mockStoryTaskArc,
  RegistryCharacter: {
    findOne: jest.fn(async () => null),
    findAll: jest.fn(async () => []),
  },
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
  messages: {
    create: jest.fn(async () => ({ content: [{ text: MOCK_ARC_JSON }], stop_reason: 'end_turn' })),
    stream: jest.fn(() => {
      const handlers = {};
      return {
        on: (evt, cb) => { handlers[evt] = cb; },
        finalMessage: async () => { if (handlers.text) handlers.text(MOCK_ARC_JSON); return {}; },
      };
    }),
  },
})));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1', groups: ['admin'] }; next(); } };
});

// engine.js starts a module-level cleanup interval on load; hold it on the fake clock.
jest.useFakeTimers();
const engineRoutes = require('../../../src/routes/memories/engine');
jest.useRealTimers();
const { buildArcGenerationContext } = engineRoutes;

const app = express();
app.use(express.json());
app.use('/api/v1/memories', engineRoutes);

const events = (text) => text.split('\n\n')
  .filter((l) => l.startsWith('data: '))
  .map((l) => JSON.parse(l.slice(6)));

let warnSpy;
beforeEach(() => {
  jest.clearAllMocks();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('POST /generate-story-tasks-stream', () => {
  test('failed upsert: saving event says not saved, never "Arc saved"', async () => {
    mockStoryTaskArc.upsert.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).post('/api/v1/memories/generate-story-tasks-stream')
      .send({ characterKey: 'just-a-woman', forceRegenerate: true });
    expect(res.status).toBe(200);
    expect(res.text).not.toMatch(/Arc saved/);
    const saving = events(res.text).filter((e) => e.step === 'saving' && e.done);
    expect(saving).toEqual([{ step: 'saving', message: 'Arc generated but not saved', saved: false, done: true }]);
    expect(warnSpy).toHaveBeenCalledWith('[generate-story-tasks-stream] DB persist failed:', 'db down');
    expect(events(res.text).some((e) => e.step === 'done')).toBe(true);
  });

  test('successful upsert: saving event says "Arc saved"', async () => {
    const res = await request(app).post('/api/v1/memories/generate-story-tasks-stream')
      .send({ characterKey: 'just-a-woman', forceRegenerate: true });
    const saving = events(res.text).filter((e) => e.step === 'saving' && e.done);
    expect(saving).toHaveLength(1);
    expect(saving[0]).toMatchObject({ message: 'Arc saved', saved: true });
  });
});

describe('POST /generate-story-tasks', () => {
  test('JSON response reports saved: false on a failed upsert', async () => {
    mockStoryTaskArc.upsert.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).post('/api/v1/memories/generate-story-tasks')
      .send({ characterKey: 'just-a-woman', forceRegenerate: true });
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(false);
  });

  test('JSON response reports saved: true on a successful upsert', async () => {
    const res = await request(app).post('/api/v1/memories/generate-story-tasks')
      .send({ characterKey: 'just-a-woman', forceRegenerate: true });
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(true);
  });
});

describe('buildArcGenerationContext', () => {
  test('failing arc read logs and returns the defaults marked usedDefaults', async () => {
    mockStoryTaskArc.findOne.mockRejectedValueOnce(new Error('relation does not exist'));
    const ctx = await buildArcGenerationContext('no-cached-arc');
    expect(ctx).toEqual({ wound_clock: 75, stakes_level: 1, visibility_score: 20, usedDefaults: true });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no-cached-arc'),
      'relation does not exist',
    );
  });

  test('no prior arc (no error) returns the defaults unmarked', async () => {
    const ctx = await buildArcGenerationContext('no-cached-arc');
    expect(ctx).toEqual({ wound_clock: 75, stakes_level: 1, visibility_score: 20 });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

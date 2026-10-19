// ============================================================================
// Routes, second pass (Script page re-audit, 2026-10-19): an opportunity's
// create and update never set its status or its beat 14; a failed handler
// logs; Evaluate refuses a completed episode; Generate Script reads only the
// episode's own show. Mocked: no database, no network.
// ============================================================================

const express = require('express');
const request = require('supertest');

const SHOW = '11111111-1111-4111-8111-111111111111';
const ID = '33333333-3333-4333-8333-333333333333';
const EP = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('opportunities: status and beat 14 are not the body\'s to set', () => {
  const app = (models) => {
    jest.doMock('../../../src/middleware/auth', () => ({ requireAuth: (req, res, next) => next(), authorize: () => (req, res, next) => next() }));
    jest.doMock('../../../src/services/brandProfile', () => ({ linkDeal: async (_db, body) => body, CompanyError: class extends Error {} }));
    const a = express();
    a.use(express.json());
    a.set('models', models);
    a.use('/api/v1', require('../../../src/routes/opportunityRoutes'));
    return a;
  };
  const SENT = { name: 'Cover', status: 'held', status_history: [], offered_in_episode_id: EP, payment_amount: 5 };

  test('create starts offered, with no beat 14, whatever the body says', async () => {
    const create = jest.fn(async (d) => ({ toJSON: () => d }));
    const res = await request(app({ Opportunity: { create } })).post(`/api/v1/opportunities/${SHOW}`).send(SENT);
    expect(res.status).toBe(201);
    const data = create.mock.calls[0][0];
    expect(data.status).toBe('offered');
    expect(data.offered_in_episode_id).toBeUndefined();
    expect(data.status_history).toEqual([expect.objectContaining({ status: 'offered' })]);
    expect(data.name).toBe('Cover');
  });

  test('update changes the fields, never status, status_history or offered_in_episode_id', async () => {
    const row = { id: ID, status: 'offered', update: jest.fn(async () => {}), toJSON: () => ({ id: ID }) };
    const res = await request(app({ Opportunity: { findOne: async () => row } })).put(`/api/v1/opportunities/${SHOW}/${ID}`).send(SENT);
    expect(res.status).toBe(200);
    const u = row.update.mock.calls[0][0];
    expect(u).toMatchObject({ name: 'Cover', payment_amount: 5 });
    expect(u).not.toHaveProperty('status');
    expect(u).not.toHaveProperty('status_history');
    expect(u).not.toHaveProperty('offered_in_episode_id');
  });

  test.each([
    ['list', (a) => request(a).get(`/api/v1/opportunities/${SHOW}`), '[Opportunities] list failed:'],
    ['advance', (a) => request(a).post(`/api/v1/opportunities/${SHOW}/${ID}/advance`).send({ to_status: 'considering' }), '[Opportunities] advance failed:'],
    ['delete', (a) => request(a).delete(`/api/v1/opportunities/${SHOW}/${ID}`), '[Opportunities] delete failed:'],
  ])('a failed %s is logged', async (_name, call, tag) => {
    const boom = async () => { throw new Error('boom'); };
    const res = await call(app({ Opportunity: { findAll: boom, findOne: boom, destroy: boom } }));
    expect(res.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(tag, 'boom');
  });
});

describe('Evaluate refuses a completed episode', () => {
  test('409, and the accepted evaluation is not overwritten', async () => {
    const update = jest.fn();
    jest.doMock('../../../src/middleware/auth', () => ({ requireAuth: (req, res, next) => next(), authorize: () => (req, res, next) => next() }));
    jest.doMock('../../../src/models', () => ({ Episode: { findByPk: async () => ({ id: EP, evaluation_status: 'accepted', script_content: '[EVENT: name="x"]', update }) } }));
    const a = express();
    a.use(express.json());
    a.use('/api/v1', require('../../../src/routes/evaluation'));
    const res = await request(a).post(`/api/v1/episodes/${EP}/evaluate`).send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EPISODE_ALREADY_ACCEPTED');
    expect(update).not.toHaveBeenCalled();
  });
});

describe('Generate Script reads the episode\'s own show', () => {
  const mockScript = jest.fn();
  const app = () => {
    jest.doMock('../../../src/models', () => ({
      EpisodeBrief: { findOne: async () => ({ toJSON: () => ({}) }) },
      Episode: { findByPk: async () => ({ id: EP, show_id: SHOW, deleted_at: null, script_content: '', script_locked_beats: [] }) },
      ScenePlan: {}, SceneSet: {},
    }));
    jest.doMock('../../../src/middleware/auth', () => ({ ...jest.requireActual('../../../src/middleware/auth'), requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } }));
    jest.doMock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
    jest.doMock('../../../src/services/scenePlannerService', () => ({ generateScenePlan: jest.fn(), getScenePlanForScriptGenerator: jest.fn() }));
    jest.doMock('../../../src/services/feedMomentSaveService', () => ({ missingFeedMomentBeats: jest.fn(), retryMissingFeedMoments: jest.fn() }));
    jest.doMock('../../../src/services/brainRules', () => ({ selectInjectedRules: async () => ({ rules: [] }) }));
    jest.doMock('../../../src/services/groundedScriptGeneratorService', () => ({ generateGroundedScript: (...x) => mockScript(...x), generateGroundedBeat: jest.fn() }));
    const a = express();
    a.use(express.json());
    a.use('/api/v1/episodes', require('../../../src/routes/episodeBriefRoutes'));
    return a;
  };
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'test-key'; mockScript.mockReset(); });

  test('a showId that is not a UUID is a 400, before any writing', async () => {
    const res = await request(app()).post(`/api/v1/episodes/${EP}/generate-script`).send({ showId: 'not-a-show' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('showId must be a show id (UUID)');
    expect(mockScript).not.toHaveBeenCalled();
  });

  test("another show's id is a 400, before any writing", async () => {
    const res = await request(app()).post(`/api/v1/episodes/${EP}/generate-script`).send({ showId: '99999999-9999-4999-8999-999999999999' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("showId is not this episode's show");
    expect(mockScript).not.toHaveBeenCalled();
  });
});

/**
 * A1.1 completion: the regenerate route answers a retryable conflict with
 * 409 and its code (the replaced episode changed, a deadlock, a lock wait
 * timeout); nothing else changes in how it answers.
 */
const express = require('express');
const request = require('supertest');

const mockQuery = jest.fn();
const mockGenerate = jest.fn();
jest.mock('../../../src/routes/worldEvents/helpers', () => ({
  getModels: async () => ({ sequelize: { query: (...a) => mockQuery(...a) } }),
}));
jest.mock('../../../src/services/episodeGeneratorService', () => ({ generateEpisodeFromEvent: (...a) => mockGenerate(...a) }));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (_req, _res, next) => next(),
  authorize: () => (_req, _res, next) => next(),
}));

const { RetryableConflictError } = require('../../../src/utils/episodeLocks');
const router = require('../../../src/routes/worldEvents/episodeBatch');

const app = express();
app.use(express.json());
app.use('/api/v1', router);
const regenerate = () => request(app).post('/api/v1/world/show-1/events/ev-1/regenerate-episode').send({});

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql) => {
    if (/SELECT id, used_in_episode_id FROM world_events/.test(sql)) return [[{ id: 'ev-1', used_in_episode_id: 'ep-old' }]];
    if (/SELECT \* FROM world_events/.test(sql)) return [[{ id: 'ev-1', show_id: 'show-1', used_in_episode_id: 'ep-old' }]];
    return [[]];
  });
  mockGenerate.mockReset();
});
afterEach(() => jest.restoreAllMocks());

test('the replaced episode changed meanwhile: 409 START_TARGET_CHANGED, the message kept', async () => {
  mockGenerate.mockRejectedValue(new RetryableConflictError('The episode being regenerated changed while it was being replaced.', 'START_TARGET_CHANGED'));
  const res = await regenerate();
  expect(res.status).toBe(409);
  expect(res.body).toEqual({ success: false, error: 'The episode being regenerated changed while it was being replaced.', code: 'START_TARGET_CHANGED' });
  expect(mockGenerate.mock.calls[0][2]).toMatchObject({ showId: 'show-1', replacingEpisodeId: 'ep-old' });
});

test('a deadlock or a lock wait timeout is a 409 RETRY; any other failure is still a 500', async () => {
  mockGenerate.mockRejectedValueOnce(Object.assign(new Error('deadlock detected'), { original: { code: '40P01' } }));
  expect((await regenerate()).body).toMatchObject({ code: 'RETRY' });
  mockGenerate.mockRejectedValueOnce(Object.assign(new Error('lock timeout'), { original: { code: '55P03' } }));
  expect((await regenerate()).status).toBe(409);
  mockGenerate.mockRejectedValueOnce(new Error('something else'));
  const other = await regenerate();
  expect(other.status).toBe(500);
  expect(other.body).toEqual({ success: false, error: 'something else' });
});

// ============================================================================
// Pitch Me (episode creation step 6): POST /world/:showId/episode-pitches.
// Mocked models and pitch service; no database, no network. The route is
// behind requireAuth and aiRateLimiter, writes nothing, and passes the
// service's error status through.
// ============================================================================

const express = require('express');
const request = require('supertest');

const mockPitch = jest.fn();
const mockRateLimiter = jest.fn((_req, _res, next) => next());

jest.mock('../../../src/models', () => ({ sequelize: { query: jest.fn() } }));
jest.mock('../../../src/services/episodePitchService', () => ({ pitchEpisodes: (...a) => mockPitch(...a) }));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (...a) => mockRateLimiter(...a) }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});
jest.mock('../../../src/services/episodeGeneratorService', () => ({ buildSocialTasks: () => [] }));

const router = require('../../../src/routes/worldEvents');

const app = express();
app.use(express.json());
app.use('/api/v1', router);

describe('POST /world/:showId/episode-pitches', () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => { mockPitch.mockReset(); mockRateLimiter.mockClear(); process.env.ANTHROPIC_API_KEY = 'test-key'; });
  afterAll(() => { process.env.ANTHROPIC_API_KEY = saved; });

  test('returns the pitches, through the AI rate limiter', async () => {
    const pitches = [{ title: 'Champagne Before Noon', organizer: { kind: 'brand', name: 'Ori Beauty' } }];
    mockPitch.mockResolvedValue({ pitches });
    const res = await request(app).post('/api/v1/world/show-1/episode-pitches');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, pitches });
    expect(mockPitch).toHaveBeenCalledWith(expect.anything(), 'show-1');
    expect(mockRateLimiter).toHaveBeenCalledTimes(1);
  });

  test('a service error keeps its status and message', async () => {
    mockPitch.mockResolvedValue({ error: 'No usable pitches came back. Please try again.', status: 502 });
    const res = await request(app).post('/api/v1/world/show-1/episode-pitches');
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ success: false, error: 'No usable pitches came back. Please try again.' });
  });

  test('no API key is a 503 and no model call', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await request(app).post('/api/v1/world/show-1/episode-pitches');
    expect(res.status).toBe(503);
    expect(mockPitch).not.toHaveBeenCalled();
  });
});

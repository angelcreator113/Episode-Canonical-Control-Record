// ============================================================================
// Task #2139 — POST /world/:showId/events/:eventId/suggest-names cleans names
// with cleanEventName, the creation draft's cleanup: apostrophes kept, double
// quotes stripped anywhere, single quotes only when they wrap the name. The
// 40-character cut and the three-name cap are unchanged. Mocked models and
// Anthropic SDK; no database, no network.
// ============================================================================

const express = require('express');
const request = require('supertest');

const mockQuery = jest.fn();
const mockMessagesCreate = jest.fn();

jest.mock('../../../src/models', () => ({
  sequelize: { query: (...a) => mockQuery(...a) },
  SocialProfile: { findByPk: jest.fn(async () => null) },
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
  messages: { create: (...a) => mockMessagesCreate(...a) },
})));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});

const router = require('../../../src/routes/worldEvents');

const app = express();
app.use(express.json());
app.use('/api/v1', router);

const originalKey = process.env.ANTHROPIC_API_KEY;
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  mockQuery.mockReset();
  mockQuery.mockResolvedValue([[{ id: 'ev-1', show_id: 'show-1', name: 'Event with Maya Moves' }]]);
  mockMessagesCreate.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = originalKey;
});

const suggest = (names) => {
  mockMessagesCreate.mockResolvedValue({ content: [{ text: JSON.stringify({ names }) }] });
  return request(app).post('/api/v1/world/show-1/events/ev-1/suggest-names');
};

describe('suggest-names name cleanup (Task #2139)', () => {
  test('apostrophes survive; wrapping single quotes and double quotes are stripped', async () => {
    const res = await suggest(["Maya's Golden Hour", '“Maya’s Rooftop Reset”', "'Golden Hour'"]);
    expect(res.status).toBe(200);
    expect(res.body.names).toEqual(["Maya's Golden Hour", 'Maya’s Rooftop Reset', 'Golden Hour']);
  });

  test('the 40-character cut and the three-name cap are unchanged', async () => {
    const long = `${'x'.repeat(45)}`;
    const res = await suggest([long, 'Two', 'Three', 'Four']);
    expect(res.body.names).toEqual(['x'.repeat(40), 'Two', 'Three']);
  });

  test('a name that is only quotation marks is dropped', async () => {
    const res = await suggest(['"“”"', 'Sunset Sculpt Club']);
    expect(res.body.names).toEqual(['Sunset Sculpt Club']);
  });
});

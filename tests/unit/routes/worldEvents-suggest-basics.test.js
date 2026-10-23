/**
 * POST /world/:showId/events/:eventId/suggest-basics (Evoni, 2026-10-23:
 * "use real AI for the suggestions"). Writes nothing. Mocked models and
 * Anthropic SDK, as the suggest-names tests do; no database, no network.
 * The SDK mock stands in for aiCostTracker's patched create: a budget
 * refusal is the error it rejects with (status 429, AI_BUDGET_EXCEEDED).
 */

const express = require('express');
const request = require('supertest');

const mockQuery = jest.fn();
const mockMessagesCreate = jest.fn();

jest.mock('../../../src/models', () => ({
  sequelize: { query: (...a) => mockQuery(...a) },
  SocialProfile: { findByPk: jest.fn(async () => ({ display_name: 'Maya Moves', handle: 'maya' })) },
  WorldLocation: { findByPk: jest.fn(async () => ({ name: 'Club Noir', city: 'Lalaville' })) },
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
  messages: { create: (...a) => mockMessagesCreate(...a) },
})));
jest.mock('../../../src/services/seasonSlotService', () => ({
  eventSeasonContext: jest.fn(async () => ({ arc_title: 'Rise', label: 'S1 E3', phase: { title: 'Arrival' } })),
}));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});

const router = require('../../../src/routes/worldEvents');
const { suggestionsFromReply, readRequestedFields, todayIso } = require('../../../src/utils/suggestBasics');

const app = express();
app.use(express.json());
app.use('/api/v1', router);

const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Golden Hour Social', event_type: 'invite', prestige: 6,
  host_brand: 'Maison Belle', source_profile_id: 'p-1', venue_location_id: 'loc-1',
  event_date: null, event_time: null, description: null, dress_code: null, category: null, format: null,
  canon_consequences: {},
};
const FUTURE = '2099-05-01';

const originalKey = process.env.ANTHROPIC_API_KEY;
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql, opts = {}) => {
    const r = opts.replacements || {};
    if (/FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL/.test(sql)) {
      return [r.eventId === 'ev-1' && r.showId === 'show-1' ? [{ ...EVENT }] : []];
    }
    return [[]];
  });
  mockMessagesCreate.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = originalKey;
});

const reply = (suggestions) => mockMessagesCreate.mockResolvedValue({ content: [{ text: JSON.stringify({ suggestions }) }] });
const post = (body = {}, show = 'show-1') => request(app).post(`/api/v1/world/${show}/events/ev-1/suggest-basics`).send(body);

describe('suggest-basics', () => {
  test('valid output: every field returned in the contract shape, one Sonnet call with the event facts', async () => {
    reply([
      { field: 'event_date', value: FUTURE, reason: 'A spring Saturday suits a garden crowd.' },
      { field: 'event_time', value: '19:30', reason: 'Golden hour.' },
      { field: 'description', value: 'An evening of champagne and sunset light.', reason: 'Fits the name.' },
      { field: 'dress_code', value: 'Cocktail chic', reason: 'Prestige 6 calls for polish.' },
      { field: 'category', value: 'social', reason: 'A social evening.' },
      { field: 'format', value: 'cocktail_party', reason: 'Drinks and mingling.' },
    ]);
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { suggestions: [
      { field: 'event_date', value: FUTURE, reason: 'A spring Saturday suits a garden crowd.' },
      { field: 'event_time', value: '19:30', reason: 'Golden hour.' },
      { field: 'description', value: 'An evening of champagne and sunset light.', reason: 'Fits the name.' },
      { field: 'dress_code', value: 'Cocktail chic', reason: 'Prestige 6 calls for polish.' },
      { field: 'category', value: 'social', reason: 'A social evening.' },
      { field: 'format', value: 'cocktail_party', reason: 'Drinks and mingling.' },
    ] } });
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    const { model, messages } = mockMessagesCreate.mock.calls[0][0];
    expect(model).toBe('claude-sonnet-4-6');
    const prompt = messages[0].content;
    for (const fact of ['Golden Hour Social', 'Prestige: 6/10', 'Maison Belle', 'Maya Moves', 'Club Noir, Lalaville', 'Rise']) {
      expect(prompt).toContain(fact);
    }
    // Writes nothing.
    expect(mockQuery.mock.calls.some(([sql]) => /^(UPDATE|INSERT|DELETE)/.test(sql))).toBe(false);
  });

  test('invalid values are dropped, never an error', async () => {
    reply([
      { field: 'event_date', value: '2001-01-01', reason: 'In the past.' },
      { field: 'event_time', value: '7pm', reason: 'Not HH:MM.' },
      { field: 'category', value: 'party', reason: 'Not a category.' },
      { field: 'format', value: 'gala', reason: 'x'.repeat(141) },
      { field: 'dress_code', value: 'd'.repeat(201), reason: 'Too long.' },
      { field: 'description', value: 'An evening.', reason: 'Fine.' },
      { field: 'name', value: 'Not asked', reason: 'Not a field.' },
    ]);
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.body.data.suggestions).toEqual([{ field: 'description', value: 'An evening.', reason: 'Fine.' }]);
  });

  test('nothing usable: 200 with suggestions []', async () => {
    mockMessagesCreate.mockResolvedValue({ content: [{ text: 'Sorry, I cannot.' }] });
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { suggestions: [] } });
  });

  test('only the listed fields, or with none listed only the empty ones', async () => {
    reply([{ field: 'dress_code', value: 'Black tie', reason: 'Gala.' }, { field: 'category', value: 'fashion', reason: 'x' }]);
    const res = await post({ fields: ['dress_code'] });
    expect(res.body.data.suggestions).toEqual([{ field: 'dress_code', value: 'Black tie', reason: 'Gala.' }]);
    const filled = { ...EVENT, event_date: FUTURE, event_time: '19:00', description: 'd', dress_code: 'x', category: 'social' };
    expect(readRequestedFields({}, filled).fields).toEqual(['format']);
    expect(readRequestedFields({ fields: ['category'] }, filled).fields).toEqual(['category']);
  });

  test('every field already set and none listed: no model call, suggestions []', async () => {
    mockQuery.mockImplementation(async () => [[{ ...EVENT, event_date: FUTURE, event_time: '19:00', description: 'd', dress_code: 'x', category: 'social', format: 'gala' }]]);
    const res = await post();
    expect(res.body).toEqual({ success: true, data: { suggestions: [] } });
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  test('fields that are not a list of the six: 400', async () => {
    expect((await post({ fields: 'category' })).status).toBe(400);
    expect((await post({ fields: ['name'] })).status).toBe(400);
  });

  test('budget refusal (aiCostTracker): 429 with its reason, not retried', async () => {
    const err = Object.assign(new Error('AI daily budget exceeded ($50.00 / $50). Call blocked.'), { status: 429, code: 'AI_BUDGET_EXCEEDED' });
    mockMessagesCreate.mockRejectedValue(err);
    const res = await post();
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ success: false, error: err.message, code: 'AI_BUDGET_EXCEEDED' });
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
  });

  test('model failure: 502, logged, no model text in the error', async () => {
    mockMessagesCreate.mockRejectedValue(Object.assign(new Error('secret upstream detail'), { status: 500 }));
    const res = await post();
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ success: false, error: 'Couldn\'t get suggestions right now.' });
    expect(console.error).toHaveBeenCalled();
  });

  test('overloaded twice: retried once, then 502', async () => {
    mockMessagesCreate.mockRejectedValue(Object.assign(new Error('overloaded'), { status: 529 }));
    const res = await post();
    expect(res.status).toBe(502);
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
  }, 10000);

  test('show scoping: another show\'s event is 404, and the model is not called', async () => {
    const res = await post({}, 'show-2');
    expect(res.status).toBe(404);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  test('no API key: 503, as suggest-names', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await post();
    expect(res.status).toBe(503);
  });
});

describe('suggestionsFromReply', () => {
  test('today is not in the past; an impossible date is dropped; one suggestion per field', () => {
    const now = new Date('2026-10-23T12:00:00Z');
    expect(todayIso(now)).toBe('2026-10-23');
    const out = suggestionsFromReply(JSON.stringify({ suggestions: [
      { field: 'event_date', value: '2026-02-30', reason: 'r' },
      { field: 'event_date', value: '2026-10-23', reason: 'today' },
      { field: 'event_date', value: '2026-12-01', reason: 'second' },
    ] }), { fields: ['event_date'], now });
    expect(out).toEqual([{ field: 'event_date', value: '2026-10-23', reason: 'today' }]);
  });
});

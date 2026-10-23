/**
 * Event Package server enhancements (Evoni, 2026-10-23):
 *   GET  .../events/:eventId/start-readiness — the Start Episode blockers
 *   GET  .../events/:eventId/package         — every part, in parallel, each failing on its own
 *   POST .../events/:eventId/generate-episode — optional Idempotency-Key
 * Mocked models and services; no database, no network.
 */

const express = require('express');
const request = require('supertest');

const mockQuery = jest.fn();
const mockState = { events: {}, live: null, missing: [] };

jest.mock('../../../src/models', () => ({
  sequelize: { query: (...a) => mockQuery(...a), QueryTypes: { SELECT: 'SELECT' } },
}));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});
jest.mock('../../../src/services/dealPricingService', () => {
  const actual = jest.requireActual('../../../src/services/dealPricingService');
  return { ...actual, findMissingPrices: jest.fn(async () => mockState.missing) };
});
jest.mock('../../../src/services/seasonSlotService', () => ({
  eventSeasonContext: jest.fn(async () => ({ season_number: 1, arc_title: 'Rise', in_slot: false, next_open: null })),
}));
jest.mock('../../../src/services/episodeMoneyService', () => ({
  eventMoneyPreview: jest.fn(async () => ({ balance: 120, lines: [] })),
}));
jest.mock('../../../src/services/eventDocumentsService', () => {
  const actual = jest.requireActual('../../../src/services/eventDocumentsService');
  return { ...actual, getDocuments: jest.fn(async () => ({ shopping_list: null, career_plan: null, deliverables: [], look: null, balance: 0 })) };
});
jest.mock('../../../src/services/episodeGeneratorService', () => ({
  loadFinancialWardrobeItems: jest.fn(async () => []),
  generateEpisodeFromEvent: jest.fn(),
}));

const router = require('../../../src/routes/worldEvents');
const { loadEventPackage, EVENT_PACKAGE_PARTS } = router;
const episodeGenerator = require('../../../src/services/episodeGeneratorService');
const { eventMoneyPreview } = require('../../../src/services/episodeMoneyService');
const { eventEpisodeConflictError } = require('../../../src/utils/eventEpisodeLink');
const { dealPriceRequiredError } = require('../../../src/services/dealPricingService');

const app = express();
app.use(express.json());
app.use('/api/v1', router);

const LIVE = { id: 'ep-9', title: 'Gala Night', episode_number: 4, show_id: 'show-1' };
const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Maison Belle Gala', venue_location_id: 'loc-1', outfit_set_id: 'os-1',
  used_in_episode_id: null, canon_consequences: {},
};

beforeEach(() => {
  mockState.events = { 'ev-1': { ...EVENT } };
  mockState.live = null;
  mockState.missing = [];
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql, opts = {}) => {
    const r = opts.replacements || {};
    if (/FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL/.test(sql)) {
      const ev = mockState.events[r.eventId];
      return [ev && ev.show_id === r.showId ? [{ ...ev }] : []];
    }
    if (/^SELECT used_in_episode_id FROM world_events WHERE id = :eventId/.test(sql)) {
      return [[{ used_in_episode_id: mockState.live ? mockState.live.id : null }]];
    }
    if (/FROM episodes WHERE id = :episodeId AND deleted_at IS NULL/.test(sql)) return [mockState.live ? [mockState.live] : []];
    return [[]];
  });
  episodeGenerator.generateEpisodeFromEvent.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('GET /events/:eventId/start-readiness', () => {
  const get = (show = 'show-1') => request(app).get(`/api/v1/world/${show}/events/ev-1/start-readiness`);

  test('ready: no blockers', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { ready: true, blockers: [], warnings: expect.any(Array) } });
  });

  test('blocker: an existing live episode', async () => {
    mockState.live = LIVE;
    const res = await get();
    expect(res.body.data.ready).toBe(false);
    expect(res.body.data.blockers).toEqual([expect.objectContaining({ key: 'episode_exists', label: expect.any(String), detail: expect.stringMatching(/already started Episode 4/) })]);
  });

  test('blocker: missing prices', async () => {
    mockState.missing = [{ key: 'appearance_fee', label: 'Appearance fee' }];
    const res = await get();
    expect(res.body.data.ready).toBe(false);
    expect(res.body.data.blockers).toEqual([expect.objectContaining({ key: 'prices_missing', missing: mockState.missing })]);
  });

  test('warnings, not blockers: no venue, no look, documents not approved (the server does not refuse these)', async () => {
    mockState.events['ev-1'] = { ...EVENT, venue_location_id: null, outfit_set_id: null };
    const res = await get();
    expect(res.body.data.ready).toBe(true);
    expect(res.body.data.warnings.map((w) => w.key)).toEqual(['place_venue', 'look_outfit', 'document_shopping_list', 'document_career_plan']);
  });

  test('another show\'s event is 404', async () => {
    const res = await get('show-2');
    expect(res.status).toBe(404);
  });
});

describe('GET /events/:eventId/package', () => {
  test('every part, in one response, in the documented shape', async () => {
    const res = await request(app).get('/api/v1/world/show-1/events/ev-1/package');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['success', ...EVENT_PACKAGE_PARTS].sort());
    expect(res.body.success).toBe(true);
    expect(res.body.eventPayload).toEqual(expect.objectContaining({ event: expect.objectContaining({ id: 'ev-1' }), termsLockedBy: null, termsReopen: null }));
    expect(res.body.moneyPreview).toEqual({ balance: 120, lines: [] });
    expect(res.body.seasonContext).toEqual(expect.objectContaining({ arc_title: 'Rise' }));
    expect(res.body.deliverables).toEqual({ deliverables: [], locked: false });
    expect(res.body.costs).toEqual(expect.objectContaining({ costs: [], locked: false }));
    expect(res.body.documents).toEqual(expect.objectContaining({ shopping_list: null }));
    expect(res.body.termsLock).toEqual({ locked: false, episode: null, reopen: null });
    expect(res.body.readiness).toEqual(expect.objectContaining({ ready: true, blockers: [] }));
    expect(res.body.errors).toBeUndefined();
  });

  test('the event payload is the single-event GET\'s body, minus success', async () => {
    const [single, pkg] = await Promise.all([
      request(app).get('/api/v1/world/show-1/events/ev-1'),
      request(app).get('/api/v1/world/show-1/events/ev-1/package'),
    ]);
    const { success, ...payload } = single.body;
    expect(success).toBe(true);
    expect(pkg.body.eventPayload).toEqual(payload);
  });

  test('one part failing: that part is null with its message under errors; the others still answer', async () => {
    eventMoneyPreview.mockRejectedValueOnce(new Error('ledger unavailable'));
    const res = await request(app).get('/api/v1/world/show-1/events/ev-1/package');
    expect(res.status).toBe(200);
    expect(res.body.moneyPreview).toBeNull();
    expect(res.body.errors).toEqual({ moneyPreview: 'ledger unavailable' });
    expect(res.body.readiness).toEqual(expect.objectContaining({ ready: true }));
    expect(res.body.eventPayload.event.id).toBe('ev-1');
  });

  test('another show\'s event is 404', async () => {
    const res = await request(app).get('/api/v1/world/show-2/events/ev-1/package');
    expect(res.status).toBe(404);
  });

  test('the parts load in parallel: every loader starts before any finishes', async () => {
    const started = [];
    const releases = [];
    const loaders = Object.fromEntries(EVENT_PACKAGE_PARTS.map((part) => [part, () => {
      started.push(part);
      return new Promise((resolve) => releases.push(() => resolve({ part })));
    }]));
    const pending = loadEventPackage({ sequelize: {} }, { showId: 'show-1', eventId: 'ev-1', row: EVENT, loaders });
    await new Promise((r) => setImmediate(r));
    expect(started.sort()).toEqual([...EVENT_PACKAGE_PARTS].sort());
    releases.forEach((release) => release());
    const out = await pending;
    for (const part of EVENT_PACKAGE_PARTS) expect(out[part]).toEqual({ part });
  });
});

describe('POST /events/:eventId/generate-episode — Idempotency-Key', () => {
  const fresh = { episode: { id: 'ep-1', title: 'Gala' }, scenePlan: [], socialTasks: [] };
  const post = (key) => {
    const r = request(app).post('/api/v1/world/show-1/events/ev-1/generate-episode').send({});
    return key === undefined ? r : r.set('Idempotency-Key', key);
  };

  test('no key: unchanged — 201, and no key passed to the generator', async () => {
    episodeGenerator.generateEpisodeFromEvent.mockResolvedValue(fresh);
    const res = await post();
    expect(res.status).toBe(201);
    expect(episodeGenerator.generateEpisodeFromEvent.mock.calls[0][2].idempotencyKey).toBeNull();
  });

  test('a key is passed through; a replayed Start answers 200 with the same response shape', async () => {
    episodeGenerator.generateEpisodeFromEvent.mockResolvedValueOnce(fresh);
    const first = await post('abc-1');
    episodeGenerator.generateEpisodeFromEvent.mockResolvedValueOnce({ ...fresh, replayed: true });
    const again = await post('abc-1');
    expect(episodeGenerator.generateEpisodeFromEvent.mock.calls[1][2].idempotencyKey).toBe('abc-1');
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body).toEqual(expect.objectContaining({ success: true, script_drafted: false, replayed: true, message: expect.any(String) }));
    expect(again.body.data.episode.id).toBe('ep-1');
    expect(Object.keys(first.body).every((k) => k in again.body)).toBe(true);
  });

  test('another key on a started event: 409 EVENT_ALREADY_HAS_EPISODE, as before', async () => {
    episodeGenerator.generateEpisodeFromEvent.mockRejectedValue(eventEpisodeConflictError(LIVE));
    const res = await post('other');
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 'EVENT_ALREADY_HAS_EPISODE', episode: { id: 'ep-9' } });
  });

  test('missing prices: 409 DEAL_PRICE_REQUIRED, as before', async () => {
    episodeGenerator.generateEpisodeFromEvent.mockRejectedValue(dealPriceRequiredError([{ key: 'fee', label: 'Fee' }]));
    const res = await post();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, code: 'DEAL_PRICE_REQUIRED', error: 'Price required before Start Episode: Fee.', missing: [{ key: 'fee', label: 'Fee' }] });
  });

  test('an unusable key is a 400, and nothing starts', async () => {
    const res = await post('has space');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_IDEMPOTENCY_KEY');
    expect(episodeGenerator.generateEpisodeFromEvent).not.toHaveBeenCalled();
  });
});

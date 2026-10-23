/**
 * Start Episode readiness (services/startReadinessService.js): one function
 * answers both "what would stop Start Episode?" (GET .../start-readiness)
 * and Start Episode's own refusals (generateEpisodeFromEvent), so the two
 * never disagree. Mocked sequelize and prices; no database.
 */

const mockMissing = { list: [] };
jest.mock('../../../src/services/dealPricingService', () => {
  const actual = jest.requireActual('../../../src/services/dealPricingService');
  return { ...actual, findMissingPrices: jest.fn(async () => mockMissing.list) };
});
jest.mock('../../../src/services/feedMomentsService', () => ({ generateFeedMoments: jest.fn(async () => ({})) }));
jest.mock('../../../src/services/characterSyncService', () => ({ recordEventHistory: jest.fn(async () => ({ updated: 0, skipped: 0 })) }));
jest.mock('../../../src/services/feedActivityService', () => ({ generatePostEventActivity: jest.fn(async () => []) }));
jest.mock('../../../src/services/timelinePlacementService', () => ({ autoPlaceRequiredOverlays: jest.fn(async () => []) }));

const { findMissingPrices, DEAL_PRICE_REQUIRED_CODE, dealPriceRequiredBody } = require('../../../src/services/dealPricingService');
const {
  findStartBlockers, startReadiness, startWarnings, startRefusalError, BLOCKER_KEYS,
} = require('../../../src/services/startReadinessService');
const { EVENT_EPISODE_CONFLICT_CODE, eventEpisodeConflictBody } = require('../../../src/utils/eventEpisodeLink');
const { generateEpisodeFromEvent } = require('../../../src/services/episodeGeneratorService');

const LIVE = { id: 'ep-9', title: 'Gala Night', episode_number: 4, show_id: 'show-1' };
const MISSING = [{ key: 'appearance_fee', label: 'Appearance fee' }];

function sequelizeWith({ linked = null, live = null, failLookup = false } = {}) {
  return {
    query: jest.fn(async (sql) => {
      if (/^SELECT used_in_episode_id FROM world_events WHERE id = :eventId LIMIT 1/.test(sql)) {
        if (failLookup) throw new Error('column "used_in_episode_id" does not exist');
        return [[{ used_in_episode_id: linked }]];
      }
      if (/FROM episodes WHERE id = :episodeId AND deleted_at IS NULL/.test(sql)) return [live ? [live] : []];
      return [[]];
    }),
    transaction: jest.fn(),
  };
}

beforeEach(() => {
  mockMissing.list = [];
  findMissingPrices.mockClear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const READY_EVENT = {
  id: 'ev-1', venue_location_id: 'loc-1', outfit_set_id: 'os-1',
  canon_consequences: { documents: {
    shopping_list: { status: 'approved', items: [{ label: 'Shoes' }] },
    career_plan: { status: 'approved', items: [{ label: 'Meet the editor' }] },
  } },
};

describe('blockers: exactly the server refusals', () => {
  test('nothing in the way: ready, no blockers', async () => {
    const r = await startReadiness(sequelizeWith(), READY_EVENT);
    expect(r).toEqual({ ready: true, blockers: [], warnings: [] });
  });

  test('a live linked episode is the episode_exists blocker, with Start Episode\'s own message', async () => {
    const r = await startReadiness(sequelizeWith({ linked: 'ep-9', live: LIVE }), READY_EVENT);
    expect(r.ready).toBe(false);
    expect(r.blockers).toEqual([expect.objectContaining({
      key: BLOCKER_KEYS.EPISODE_EXISTS, episode: LIVE,
      detail: eventEpisodeConflictBody(LIVE).error,
    })]);
  });

  test('a link to a deleted episode does not block', async () => {
    const r = await startReadiness(sequelizeWith({ linked: 'ep-gone', live: null }), READY_EVENT);
    expect(r.ready).toBe(true);
  });

  test('missing prices are the prices_missing blocker, listing what is missing', async () => {
    mockMissing.list = MISSING;
    const r = await startReadiness(sequelizeWith(), READY_EVENT);
    expect(r.ready).toBe(false);
    expect(r.blockers).toEqual([expect.objectContaining({
      key: BLOCKER_KEYS.PRICES_MISSING, label: 'Price required', missing: MISSING,
      detail: 'Price required before Start Episode: Appearance fee.',
    })]);
  });

  test('both at once: both listed, the episode first (Start Episode\'s order)', async () => {
    mockMissing.list = MISSING;
    const r = await startReadiness(sequelizeWith({ linked: 'ep-9', live: LIVE }), READY_EVENT);
    expect(r.blockers.map((b) => b.key)).toEqual([BLOCKER_KEYS.EPISODE_EXISTS, BLOCKER_KEYS.PRICES_MISSING]);
  });

  test('stopAtFirst (Start Episode\'s path) does not read prices once the episode blocks', async () => {
    const blockers = await findStartBlockers(sequelizeWith({ linked: 'ep-9', live: LIVE }), 'ev-1', { stopAtFirst: true });
    expect(blockers).toHaveLength(1);
    expect(findMissingPrices).not.toHaveBeenCalled();
  });

  test('a regenerate: its own episode does not block, and prices are not asked', async () => {
    mockMissing.list = MISSING;
    const blockers = await findStartBlockers(sequelizeWith({ linked: 'ep-9', live: LIVE }), 'ev-1', { replacingEpisodeId: 'ep-9' });
    expect(blockers).toEqual([]);
    expect(findMissingPrices).not.toHaveBeenCalled();
  });

  test('a failed live-episode lookup is logged and skipped, as Start Episode always did', async () => {
    const r = await startReadiness(sequelizeWith({ failLookup: true }), READY_EVENT);
    expect(r.ready).toBe(true);
    expect(console.warn).toHaveBeenCalledWith('[EpisodeGenerator] used-event check skipped:', expect.any(String));
  });

  test('each blocker maps to the error Start Episode throws, with its code', () => {
    const conflict = startRefusalError({ key: BLOCKER_KEYS.EPISODE_EXISTS, episode: LIVE });
    expect(conflict).toMatchObject({ code: EVENT_EPISODE_CONFLICT_CODE, status: 409, episode: LIVE });
    const price = startRefusalError({ key: BLOCKER_KEYS.PRICES_MISSING, missing: MISSING });
    expect(dealPriceRequiredBody(price)).toEqual({
      success: false, code: DEAL_PRICE_REQUIRED_CODE, error: 'Price required before Start Episode: Appearance fee.', missing: MISSING,
    });
  });
});

describe('warnings: what the server does not refuse for', () => {
  test('no venue, no outfit, documents not approved', () => {
    const w = startWarnings({ id: 'ev-1', venue_name: 'Club Noir', outfit_pieces: '[]', canon_consequences: '{}' });
    expect(w.map((x) => x.key)).toEqual(['place_venue', 'look_outfit', 'document_shopping_list', 'document_career_plan']);
    expect(w[0].detail).toMatch(/Club Noir/);
  });

  test('the venue may be linked in the automation copy; outfit pieces count as a look', () => {
    const w = startWarnings({
      id: 'ev-1', outfit_pieces: [{ id: 'w1' }],
      canon_consequences: { automation: { venue_location_id: 'loc-2' }, documents: READY_EVENT.canon_consequences.documents },
    });
    expect(w).toEqual([]);
  });

  test('warnings never make readiness false', async () => {
    const r = await startReadiness(sequelizeWith(), { id: 'ev-1' });
    expect(r.ready).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('Start Episode refuses with the same function', () => {
  const EVENT = { id: 'ev-1', show_id: 'show-1', name: 'Gala', event_type: 'invite', canon_consequences: { automation: {} } };
  const models = (sequelize) => ({ sequelize, Episode: { create: jest.fn() }, EpisodeBrief: { create: jest.fn() } });

  test('live episode: readiness says episode_exists; Start Episode throws EVENT_ALREADY_HAS_EPISODE, creating nothing', async () => {
    const seq = sequelizeWith({ linked: 'ep-9', live: LIVE });
    const r = await startReadiness(seq, EVENT);
    const m = models(seq);
    const err = await generateEpisodeFromEvent(EVENT, m, { showId: 'show-1' }).catch((e) => e);
    expect(r.blockers[0].key).toBe(BLOCKER_KEYS.EPISODE_EXISTS);
    expect(err).toMatchObject({ code: EVENT_EPISODE_CONFLICT_CODE, status: 409, message: r.blockers[0].detail });
    expect(m.Episode.create).not.toHaveBeenCalled();
  });

  test('missing prices: readiness says prices_missing; Start Episode throws DEAL_PRICE_REQUIRED with the same list', async () => {
    mockMissing.list = MISSING;
    const seq = sequelizeWith();
    const r = await startReadiness(seq, EVENT);
    const m = models(seq);
    const err = await generateEpisodeFromEvent(EVENT, m, { showId: 'show-1' }).catch((e) => e);
    expect(r.blockers[0].key).toBe(BLOCKER_KEYS.PRICES_MISSING);
    expect(err).toMatchObject({ code: DEAL_PRICE_REQUIRED_CODE, missing: MISSING, message: r.blockers[0].detail });
    expect(m.Episode.create).not.toHaveBeenCalled();
  });
});

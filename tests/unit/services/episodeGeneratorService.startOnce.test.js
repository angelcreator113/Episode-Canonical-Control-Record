/**
 * Start Episode runs once per event (audit High, 2026-10-23).
 *
 * Two Start Episode requests for one event can both pass the
 * one-event-one-episode guard before either commits. generateEpisodeFromEvent
 * now locks the event row first thing in its transaction (SELECT ... FOR
 * UPDATE) and asks the guard again under the lock, and the stamp writes
 * used_in_episode_id only while the event has no live episode. The second
 * request is refused with 409 EVENT_ALREADY_HAS_EPISODE and creates nothing.
 *
 * The race is simulated: reads outside a transaction see the event as it was
 * before the first Start committed (the stale read both requests made); reads
 * inside a transaction see what is committed. No database.
 */

jest.mock('../../../src/services/feedMomentsService', () => ({ generateFeedMoments: jest.fn(async () => ({})) }));
jest.mock('../../../src/services/characterSyncService', () => ({
  recordEventHistory: jest.fn(async () => ({ updated: 0, skipped: 0 })),
}));
jest.mock('../../../src/services/feedActivityService', () => ({ generatePostEventActivity: jest.fn(async () => []) }));
jest.mock('../../../src/services/timelinePlacementService', () => ({ autoPlaceRequiredOverlays: jest.fn(async () => []) }));

const { generateEpisodeFromEvent, stampEventUsed } = require('../../../src/services/episodeGeneratorService');
const { EVENT_EPISODE_CONFLICT_CODE } = require('../../../src/utils/eventEpisodeLink');

const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Maison Belle Gala', event_type: 'invite', prestige: 6, cost_coins: 0,
  canon_consequences: { automation: {} },
};

function makeWorld() {
  const store = {
    episodes: [],
    briefs: [],
    events: { 'ev-1': { id: 'ev-1', used_in_episode_id: null, status: 'draft', times_used: 0 } },
  };
  const log = { locks: [], creates: 0 };
  let seq = 0;
  let epSeq = 0;
  const persist = (table, row, t) => (t ? t.pending.push(() => store[table].push(row)) : store[table].push(row));

  const sequelize = {
    QueryTypes: { SELECT: 'SELECT' },
    transaction: jest.fn(async (cb) => {
      const t = { id: `tx-${++seq}`, pending: [] };
      try {
        const out = await cb(t);
        t.pending.forEach((apply) => apply());
        return out;
      } catch (err) {
        t.pending = [];
        throw err;
      }
    }),
    query: jest.fn(async (sql, opts = {}) => {
      const r = opts.replacements || {};
      const ev = store.events[r.eventId];
      if (/^SELECT used_in_episode_id FROM world_events WHERE id = :eventId FOR UPDATE$/.test(sql)) {
        log.locks.push(opts.transaction);
        return [ev ? [{ used_in_episode_id: ev.used_in_episode_id }] : []];
      }
      if (/^SELECT used_in_episode_id FROM world_events/.test(sql)) {
        // Outside a transaction: the stale read (before the first commit).
        if (!opts.transaction) return [[{ used_in_episode_id: null }]];
        return [ev ? [{ used_in_episode_id: ev.used_in_episode_id }] : []];
      }
      if (/FROM episodes WHERE id = :episodeId AND deleted_at IS NULL/.test(sql)) {
        const ep = store.episodes.find((e) => e.id === r.episodeId);
        return [ep ? [{ id: ep.id, title: ep.title, episode_number: ep.episode_number, show_id: ep.show_id }] : []];
      }
      if (/MAX\(episode_number\)/.test(sql)) return [[{ next_num: store.episodes.length + 1 }]];
      if (/^UPDATE world_events SET status = 'used'/.test(sql)) {
        // The stamp's guard: only an event with no live episode.
        const live = ev.used_in_episode_id && store.episodes.some((e) => e.id === ev.used_in_episode_id);
        if (live) return [[], { rowCount: 0 }];
        const apply = () => { ev.used_in_episode_id = r.episodeId; ev.status = 'used'; ev.times_used += 1; };
        if (opts.transaction) opts.transaction.pending.push(apply); else apply();
        return [[{ id: r.eventId }], { rowCount: 1 }];
      }
      return [[]];
    }),
  };
  const Episode = {
    create: jest.fn(async (data, options = {}) => {
      log.creates += 1;
      const row = { id: `ep-${++epSeq}`, ...data };
      persist('episodes', row, options.transaction);
      return { ...row, update: jest.fn(async () => {}), toJSON: () => row };
    }),
  };
  const EpisodeBrief = {
    create: jest.fn(async (data, options = {}) => {
      persist('briefs', data, options.transaction);
      return { toJSON: () => data };
    }),
  };
  return { models: { sequelize, Episode, EpisodeBrief }, store, log };
}

describe('Start Episode runs once per event (audit, 2026-10-23)', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  test('the event row is locked inside the Start transaction', async () => {
    const { models, log } = makeWorld();
    await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1' });
    expect(log.locks).toHaveLength(1);
    expect(log.locks[0]).toEqual(expect.objectContaining({ id: 'tx-1' }));
  });

  test('a second Start that passed the first check is refused with 409 and creates nothing', async () => {
    const { models, store, log } = makeWorld();
    const first = await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1' });
    expect(first.episode.id).toBe('ep-1');
    expect(store.events['ev-1'].used_in_episode_id).toBe('ep-1');

    // The second request's guard read is stale (null), as in the race.
    await expect(generateEpisodeFromEvent(EVENT, models, { showId: 'show-1' })).rejects.toMatchObject({
      code: EVENT_EPISODE_CONFLICT_CODE,
      status: 409,
      message: expect.stringMatching(/^This event already started Episode/),
    });
    expect(log.creates).toBe(1);
    expect(store.episodes.map((e) => e.id)).toEqual(['ep-1']);
    expect(store.briefs).toHaveLength(1);
    expect(store.events['ev-1']).toMatchObject({ used_in_episode_id: 'ep-1', times_used: 1 });
  });

  test('the stamp writes only while the event has no live episode, else 409', async () => {
    const { models, store } = makeWorld();
    store.episodes.push({ id: 'ep-live', title: 'Gala Night', episode_number: 2, show_id: 'show-1' });
    store.events['ev-1'].used_in_episode_id = 'ep-live';
    await expect(models.sequelize.transaction((t) => stampEventUsed(models.sequelize, 'ev-1', 'ep-other', { transaction: t })))
      .rejects.toMatchObject({ code: EVENT_EPISODE_CONFLICT_CODE, status: 409 });
    const stampSql = models.sequelize.query.mock.calls.find(([sql]) => /^UPDATE world_events SET status = 'used'/.test(sql))[0];
    expect(stampSql).toMatch(/used_in_episode_id IS NULL/);
    expect(store.events['ev-1'].used_in_episode_id).toBe('ep-live');
  });
});

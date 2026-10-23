/**
 * Start Episode retry protection (Evoni, 2026-10-23): an optional
 * Idempotency-Key. A Start this event already completed under the same key
 * answers with that episode (nothing created again); another key, or none,
 * is refused with 409 EVENT_ALREADY_HAS_EPISODE as before. The key lives on
 * the brief's event_metadata (services/startEpisodeIdempotency.js).
 *
 * Mocked sequelize and models, no database. Reads outside a transaction can
 * be made stale (`world.stale`) to simulate two requests racing.
 */

jest.mock('../../../src/services/feedMomentsService', () => ({ generateFeedMoments: jest.fn(async () => ({})) }));
jest.mock('../../../src/services/characterSyncService', () => ({
  recordEventHistory: jest.fn(async () => ({ updated: 0, skipped: 0 })),
}));
jest.mock('../../../src/services/feedActivityService', () => ({ generatePostEventActivity: jest.fn(async () => []) }));
jest.mock('../../../src/services/timelinePlacementService', () => ({ autoPlaceRequiredOverlays: jest.fn(async () => []) }));

const { generateEpisodeFromEvent } = require('../../../src/services/episodeGeneratorService');
const { EVENT_EPISODE_CONFLICT_CODE } = require('../../../src/utils/eventEpisodeLink');
const { readIdempotencyKey, META_KEY } = require('../../../src/services/startEpisodeIdempotency');

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
  const world = { stale: false, creates: 0 };
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
      const stale = world.stale && !opts.transaction;
      if (/^SELECT used_in_episode_id FROM world_events WHERE id = :eventId FOR UPDATE$/.test(sql)) {
        return [ev ? [{ used_in_episode_id: ev.used_in_episode_id }] : []];
      }
      if (/^SELECT used_in_episode_id FROM world_events/.test(sql)) {
        if (stale) return [[{ used_in_episode_id: null }]];
        return [ev ? [{ used_in_episode_id: ev.used_in_episode_id }] : []];
      }
      if (/start_idempotency_key' = :key/.test(sql)) {
        if (stale) return [[]];
        const hit = store.briefs.filter((b) => b.event_id === r.eventId && b.event_metadata?.[META_KEY] === r.key
          && store.episodes.some((e) => e.id === b.episode_id)).pop();
        return [hit ? [{ episode_id: hit.episode_id }] : []];
      }
      if (/^SELECT \* FROM episode_briefs WHERE episode_id = :episodeId/.test(sql)) {
        return [store.briefs.filter((b) => b.episode_id === r.episodeId).slice(-1)];
      }
      if (/^SELECT \* FROM scene_plans WHERE episode_id/.test(sql)) return [[{ id: 'sp-1', beat_number: 1 }]];
      if (/^SELECT \* FROM episode_todo_lists WHERE episode_id/.test(sql)) {
        return [[{ id: 'todo-1', social_tasks: '[{"slot":"post"}]', financial_summary: '{"total_income":10}' }]];
      }
      if (/FROM episodes WHERE id = :episodeId AND deleted_at IS NULL/.test(sql)) {
        const ep = store.episodes.find((e) => e.id === r.episodeId);
        return [ep ? [{ id: ep.id, title: ep.title, episode_number: ep.episode_number, show_id: ep.show_id }] : []];
      }
      if (/MAX\(episode_number\)/.test(sql)) return [[{ next_num: store.episodes.length + 1 }]];
      if (/^UPDATE episodes SET deleted_at = NOW\(\) WHERE id = :episodeId/.test(sql)) {
        // Regenerate supersedes the old episode; visible at once inside the transaction.
        store.episodes = store.episodes.filter((e) => e.id !== r.episodeId);
        return [[]];
      }
      if (/^UPDATE world_events SET status = 'used'/.test(sql)) {
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
      world.creates += 1;
      const row = { id: `ep-${++epSeq}`, ...data };
      persist('episodes', row, options.transaction);
      return { ...row, update: jest.fn(async () => {}), toJSON: () => row };
    }),
    findByPk: jest.fn(async (id) => {
      const row = store.episodes.find((e) => e.id === id);
      return row ? { ...row, toJSON: () => row } : null;
    }),
  };
  const EpisodeBrief = {
    create: jest.fn(async (data, options = {}) => {
      persist('briefs', data, options.transaction);
      return { toJSON: () => data };
    }),
  };
  return { models: { sequelize, Episode, EpisodeBrief }, store, world };
}

describe('Start Episode Idempotency-Key', () => {
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

  test('the key is stored on the new brief, in the Start transaction', async () => {
    const { models, store } = makeWorld();
    await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1', idempotencyKey: 'k-1' });
    expect(store.briefs).toHaveLength(1);
    expect(store.briefs[0].event_metadata[META_KEY]).toBe('k-1');
  });

  test('same key: the same episode comes back, in the fresh-start shape, and nothing is created again', async () => {
    const { models, store, world } = makeWorld();
    const first = await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1', idempotencyKey: 'k-1' });
    const again = await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1', idempotencyKey: 'k-1' });
    expect(again.replayed).toBe(true);
    expect(again.episode.id).toBe(first.episode.id);
    expect(Object.keys(again)).toEqual(expect.arrayContaining(Object.keys(first)));
    expect(again.scenePlan).toEqual([{ id: 'sp-1', beat_number: 1 }]);
    expect(again.socialTasks).toEqual([{ slot: 'post' }]);
    expect(again.financials).toEqual({ total_income: 10 });
    expect(world.creates).toBe(1);
    expect(store.briefs).toHaveLength(1);
    expect(store.events['ev-1'].times_used).toBe(1);
  });

  test('same key, racing its own first attempt: found under the lock, answered with that episode', async () => {
    const { models, world } = makeWorld();
    const first = await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1', idempotencyKey: 'k-1' });
    world.stale = true; // the retry's reads before the lock predate the first commit
    const again = await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1', idempotencyKey: 'k-1' });
    expect(again).toMatchObject({ replayed: true, episode: { id: first.episode.id } });
    expect(world.creates).toBe(1);
  });

  test('a different key is refused with 409 as before and creates nothing', async () => {
    const { models, world } = makeWorld();
    await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1', idempotencyKey: 'k-1' });
    await expect(generateEpisodeFromEvent(EVENT, models, { showId: 'show-1', idempotencyKey: 'k-2' }))
      .rejects.toMatchObject({ code: EVENT_EPISODE_CONFLICT_CODE, status: 409 });
    world.stale = true;
    await expect(generateEpisodeFromEvent(EVENT, models, { showId: 'show-1', idempotencyKey: 'k-2' }))
      .rejects.toMatchObject({ code: EVENT_EPISODE_CONFLICT_CODE, status: 409 });
    expect(world.creates).toBe(1);
  });

  test('no key: unchanged — no key stored, no key lookup, a second Start is 409', async () => {
    const { models, store, world } = makeWorld();
    await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1' });
    expect(store.briefs[0].event_metadata).not.toHaveProperty(META_KEY);
    await expect(generateEpisodeFromEvent(EVENT, models, { showId: 'show-1' }))
      .rejects.toMatchObject({ code: EVENT_EPISODE_CONFLICT_CODE, status: 409 });
    expect(models.sequelize.query.mock.calls.some(([sql]) => /start_idempotency_key/.test(sql))).toBe(false);
    expect(world.creates).toBe(1);
  });

  test('a regenerate never stores or matches a key', async () => {
    const { models, store } = makeWorld();
    await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1', idempotencyKey: 'k-1' });
    const regen = await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1', idempotencyKey: 'k-1', replacingEpisodeId: 'ep-1' });
    expect(regen.replayed).toBeUndefined();
    expect(store.briefs[1].event_metadata).not.toHaveProperty(META_KEY);
  });
});

describe('readIdempotencyKey', () => {
  test('absent or blank is no key; a printable key is kept; spaces or >200 chars are refused', () => {
    expect(readIdempotencyKey(undefined)).toEqual({ key: null });
    expect(readIdempotencyKey('  ')).toEqual({ key: null });
    expect(readIdempotencyKey(' abc-123 ')).toEqual({ key: 'abc-123' });
    expect(readIdempotencyKey('a b').error).toMatch(/Idempotency-Key/);
    expect(readIdempotencyKey('x'.repeat(201)).error).toMatch(/Idempotency-Key/);
  });
});

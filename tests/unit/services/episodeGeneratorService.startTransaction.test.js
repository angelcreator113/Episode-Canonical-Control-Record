/**
 * Start Episode guarantees the event link (Task #1906).
 *
 * generateEpisodeFromEvent creates the Episode, the EpisodeBrief and the
 * event's used_in_episode_id / status / times_used stamp in one
 * transaction. A stamp failure fails the Start and rolls back both the
 * Episode and the Brief. The non-blocking steps (feed, history, asset
 * linking) stay outside the transaction.
 *
 * The sequelize transaction is mocked: rows created with a transaction
 * are held in a pending set and only reach the store on commit; a throw
 * inside the callback discards them (rollback). No database.
 */

jest.mock('../../../src/services/feedMomentsService', () => ({ generateFeedMoments: jest.fn(async () => ({})) }));
jest.mock('../../../src/services/characterSyncService', () => ({
  recordEventHistory: jest.fn(async () => ({ updated: 0, skipped: 0 })),
}));
jest.mock('../../../src/services/feedActivityService', () => ({ generatePostEventActivity: jest.fn(async () => []) }));
jest.mock('../../../src/services/timelinePlacementService', () => ({ autoPlaceRequiredOverlays: jest.fn(async () => []) }));

const { generateEpisodeFromEvent } = require('../../../src/services/episodeGeneratorService');
const characterSync = require('../../../src/services/characterSyncService');
const feedActivity = require('../../../src/services/feedActivityService');

const EVENT = {
  id: 'ev-1',
  show_id: 'show-1',
  name: 'Maison Belle Gala',
  event_type: 'invite',
  prestige: 6,
  cost_coins: 0,
  canon_consequences: { automation: {} },
};

function makeWorld({ stamp = 'ok' } = {}) {
  // Committed rows.
  const store = { episodes: [], briefs: [], events: { 'ev-1': { id: 'ev-1', used_in_episode_id: null, status: 'draft', times_used: 0 } } };
  const log = { transactions: [], stampCalls: [], outsideTx: [] };
  let seq = 0;

  const persist = (table, row, transaction) => {
    if (transaction) transaction.pending.push(() => store[table].push(row));
    else store[table].push(row);
  };

  const sequelize = {
    QueryTypes: { SELECT: 'SELECT' },
    transaction: jest.fn(async (cb) => {
      const t = { id: `tx-${++seq}`, pending: [] };
      log.transactions.push(t);
      try {
        const result = await cb(t);
        t.pending.forEach((apply) => apply()); // commit
        t.state = 'committed';
        return result;
      } catch (err) {
        t.pending = []; // rollback
        t.state = 'rolled back';
        throw err;
      }
    }),
    query: jest.fn(async (sql, opts = {}) => {
      const r = opts.replacements || {};
      if (/^SELECT used_in_episode_id FROM world_events/.test(sql)) return [[{ used_in_episode_id: store.events[r.eventId]?.used_in_episode_id || null }]];
      if (/MAX\(episode_number\)/.test(sql)) return [[{ next_num: 1 }]];
      if (/FROM event_deliverables/.test(sql)) return [[]];
      if (/^UPDATE world_events SET status = 'used'/.test(sql)) {
        log.stampCalls.push({ sql, replacements: r, transaction: opts.transaction });
        if (stamp === 'throw') throw new Error('stamp boom');
        if (stamp === 'no-row') return [[], { rowCount: 0 }];
        const ev = store.events[r.eventId];
        const apply = () => { ev.used_in_episode_id = r.episodeId; ev.status = 'used'; ev.times_used += 1; };
        if (opts.transaction) opts.transaction.pending.push(apply); else apply();
        return [[{ id: r.eventId }], { rowCount: 1 }];
      }
      if (/INSERT INTO episode_todo_lists/.test(sql)) {
        if (opts.transaction) log.outsideTx.push('todo inside tx');
        return [[{ id: 'todo-1' }]];
      }
      return [[]];
    }),
  };

  const Episode = {
    create: jest.fn(async (data, options = {}) => {
      const row = { id: 'ep-new', ...data };
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

describe('generateEpisodeFromEvent — transactional Start (Task #1906)', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    characterSync.recordEventHistory.mockClear();
    feedActivity.generatePostEventActivity.mockClear();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  test('Episode, Brief and the event stamp are written in one transaction and committed together', async () => {
    const { models, store, log } = makeWorld();
    const result = await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1' });

    expect(result.episode.id).toBe('ep-new');
    expect(log.transactions).toHaveLength(1);
    const [t] = log.transactions;
    expect(t.state).toBe('committed');
    expect(models.Episode.create.mock.calls[0][1]).toEqual({ transaction: t });
    expect(models.EpisodeBrief.create.mock.calls[0][1]).toEqual({ transaction: t });
    expect(log.stampCalls).toHaveLength(1);
    expect(log.stampCalls[0].transaction).toBe(t);
    expect(log.stampCalls[0].sql).toMatch(/times_used = COALESCE\(times_used, 0\) \+ 1/);

    expect(store.episodes).toHaveLength(1);
    expect(store.briefs).toHaveLength(1);
    expect(store.briefs[0].event_id).toBe('ev-1');
    expect(store.events['ev-1']).toEqual({ id: 'ev-1', used_in_episode_id: 'ep-new', status: 'used', times_used: 1 });
  });

  test('a stamp that throws fails the Start and rolls back the Episode and the Brief', async () => {
    const { models, store, log } = makeWorld({ stamp: 'throw' });
    await expect(generateEpisodeFromEvent(EVENT, models, { showId: 'show-1' })).rejects.toThrow('stamp boom');

    expect(log.transactions).toHaveLength(1);
    expect(log.transactions[0].state).toBe('rolled back');
    expect(store.episodes).toEqual([]);
    expect(store.briefs).toEqual([]);
    expect(store.events['ev-1'].used_in_episode_id).toBeNull();
    // Nothing after the transaction ran for an episode that does not exist.
    expect(characterSync.recordEventHistory).not.toHaveBeenCalled();
    expect(feedActivity.generatePostEventActivity).not.toHaveBeenCalled();
  });

  test('a stamp that updates no row also fails the Start and leaves nothing behind', async () => {
    const { models, store } = makeWorld({ stamp: 'no-row' });
    await expect(generateEpisodeFromEvent(EVENT, models, { showId: 'show-1' }))
      .rejects.toThrow(/could not be linked to episode ep-new/);
    expect(store.episodes).toEqual([]);
    expect(store.briefs).toEqual([]);
  });

  test('non-blocking steps run after the commit, outside the transaction', async () => {
    const { models, log } = makeWorld();
    await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1' });
    expect(log.outsideTx).toEqual([]);
    expect(characterSync.recordEventHistory).toHaveBeenCalledTimes(1);
    expect(feedActivity.generatePostEventActivity).toHaveBeenCalledTimes(1);
  });

  test('a failing non-blocking step (feed activity) is logged and does not fail the Start', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    feedActivity.generatePostEventActivity.mockRejectedValueOnce(new Error('feed down'));
    const { models, store } = makeWorld();
    const result = await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1' });
    expect(result.episode.id).toBe('ep-new');
    expect(store.episodes).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith('[EpisodeGenerator] Feed activity failed (non-blocking):', 'feed down');
  });

  test('the 409 guard is unchanged: a live linked episode refuses before any transaction', async () => {
    const { models, store, log } = makeWorld();
    store.events['ev-1'].used_in_episode_id = 'ep-live';
    const baseQuery = models.sequelize.query;
    models.sequelize.query = jest.fn(async (sql, opts) => {
      if (/FROM episodes WHERE id = :episodeId AND deleted_at IS NULL/.test(sql)) {
        return [[{ id: 'ep-live', title: 'Live', episode_number: 2, show_id: 'show-1' }]];
      }
      return baseQuery(sql, opts);
    });
    await expect(generateEpisodeFromEvent(EVENT, models, { showId: 'show-1' }))
      .rejects.toMatchObject({ code: 'EVENT_ALREADY_HAS_EPISODE', status: 409 });
    expect(log.transactions).toHaveLength(0);
    expect(models.Episode.create).not.toHaveBeenCalled();
  });
});

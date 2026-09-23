// ============================================================================
// One event starts at most one episode (Task #1751)
// ============================================================================
// docs/EVENT_EPISODE_FLOW.md ruling 3. The backend refuses a second episode
// from an event whose used_in_episode_id points at a live episode
// (deleted_at IS NULL), with 409 naming that episode. A link to a deleted
// episode does not block — the state the 2026-09-22 data reset left.
// Covers POST .../inject (guarded in the route, under FOR UPDATE) and the
// generateEpisodeFromEvent guard shared by generate-episode,
// generate-episode-from-many and regenerate-episode. Mocked, no database.

const express = require('express');
const request = require('supertest');

const SHOW = 'show-1';

// world_events rows by id (only the columns these routes read).
const mockEvents = {
  'ev-unused': { id: 'ev-unused', show_id: SHOW, name: 'Unused Soiree', used_in_episode_id: null },
  'ev-live': { id: 'ev-live', show_id: SHOW, name: 'Gala', used_in_episode_id: 'ep-live' },
  'ev-dead': { id: 'ev-dead', show_id: SHOW, name: 'Reset Brunch', used_in_episode_id: 'ep-dead' },
};
// episodes rows; ep-dead is soft-deleted, ep-gone was hard-deleted (absent).
const mockEpisodes = {
  'ep-live': { id: 'ep-live', title: 'Gala Night', episode_number: 3, show_id: SHOW, deleted_at: null },
  'ep-target': { id: 'ep-target', title: 'New Episode', episode_number: 4, show_id: SHOW, deleted_at: null },
  'ep-dead': { id: 'ep-dead', title: 'Old Brunch', episode_number: 1, show_id: SHOW, deleted_at: new Date() },
};

const mockEventUpdates = [];
const mockTx = { id: 'tx' };

const mockQuery = jest.fn(async (sql, opts = {}) => {
  const r = opts.replacements || {};
  if (/^SELECT \* FROM world_events WHERE id = :eventId AND show_id = :showId/.test(sql)) {
    const ev = mockEvents[r.eventId];
    return [ev ? [ev] : []];
  }
  if (/^SELECT id, used_in_episode_id FROM world_events WHERE id = :eventId/.test(sql)) {
    const ev = mockEvents[r.eventId];
    return [ev ? [{ id: ev.id, used_in_episode_id: ev.used_in_episode_id }] : []];
  }
  if (/SELECT \* FROM world_events WHERE show_id = :showId AND id IN/.test(sql)) {
    return [r.eventIds.map(id => mockEvents[id]).filter(Boolean)];
  }
  if (/^SELECT used_in_episode_id FROM world_events WHERE id = :eventId/.test(sql)) {
    const ev = mockEvents[r.eventId];
    return [ev ? [{ used_in_episode_id: ev.used_in_episode_id }] : []];
  }
  if (/FROM episodes WHERE id = :episodeId AND deleted_at IS NULL/.test(sql)) {
    const ep = mockEpisodes[r.episodeId];
    return [ep && !ep.deleted_at ? [ep] : []];
  }
  if (/^UPDATE world_events SET used_in_episode_id = :episodeId/.test(sql)) {
    mockEventUpdates.push({ sql, replacements: r, transaction: opts.transaction });
    return [[], { rowCount: 1 }];
  }
  return [[]];
});

const mockEpisodeUpdate = jest.fn(async () => {});
const mockEpisodeFindOne = jest.fn(async () => { throw new Error('PASSED_GUARD'); });

jest.mock('../../../src/models', () => ({
  sequelize: {
    query: (...args) => mockQuery(...args),
    // Managed transaction; called as (cb) or ({ transaction }, cb) for a savepoint.
    transaction: jest.fn(async (a, b) => (typeof a === 'function' ? a(mockTx) : b(mockTx))),
  },
  Episode: {
    findByPk: jest.fn(async (id) => {
      const ep = mockEpisodes[id];
      return ep ? { ...ep, script_content: '', update: mockEpisodeUpdate } : null;
    }),
    // generateEpisodeFromEvent's episode-number fallback: reaching it means
    // the used-event guard let the event through.
    findOne: (...args) => mockEpisodeFindOne(...args),
  },
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});

const router = require('../../../src/routes/worldEvents');
const episodeGenerator = require('../../../src/services/episodeGeneratorService');
const models = require('../../../src/models');

const app = express();
app.use(express.json());
app.use('/api/v1', router);

// generateEpisodeFromEvent's MAX(episode_number) query is the first query
// after the guard; failing it sends the service to Episode.findOne, which
// throws PASSED_GUARD. So "rejects with PASSED_GUARD" = the guard allowed it.
function serviceModels() {
  return {
    ...models,
    sequelize: {
      ...models.sequelize,
      query: jest.fn(async (sql, opts) => {
        if (/MAX\(episode_number\)/.test(sql)) throw new Error('forced fallback');
        return mockQuery(sql, opts);
      }),
    },
  };
}

beforeEach(() => {
  mockEventUpdates.length = 0;
  mockEpisodeUpdate.mockClear();
  mockQuery.mockClear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const inject = (eventId, episodeId) =>
  request(app).post(`/api/v1/world/${SHOW}/events/${eventId}/inject`).send({ episode_id: episodeId });

describe('POST /world/:showId/events/:eventId/inject', () => {
  test('an unused event starts an episode: script saved and event marked used, in the transaction', async () => {
    const res = await inject('ev-unused', 'ep-target');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockEpisodeUpdate).toHaveBeenCalledTimes(1);
    expect(mockEventUpdates).toHaveLength(1);
    expect(mockEventUpdates[0].replacements).toEqual({ episodeId: 'ep-target', eventId: 'ev-unused' });
    expect(mockEventUpdates[0].sql).toMatch(/status = 'used'/);
    const lockCall = mockQuery.mock.calls.find(([sql]) => /FOR UPDATE/.test(sql));
    expect(lockCall).toBeDefined();
    expect(lockCall[1].transaction).toBe(mockTx);
  });

  test('an event with a live episode is refused with 409 that names the episode, and nothing is written', async () => {
    const res = await inject('ev-live', 'ep-target');
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('EVENT_ALREADY_HAS_EPISODE');
    expect(res.body.episode).toEqual({ id: 'ep-live', title: 'Gala Night', episode_number: 3 });
    expect(res.body.error).toContain('ep-live');
    expect(res.body.error).toContain('Gala Night');
    expect(res.body.error).toContain('Episode 3');
    expect(mockEpisodeUpdate).not.toHaveBeenCalled();
    expect(mockEventUpdates).toHaveLength(0);
  });

  test('an event whose linked episode was deleted is allowed', async () => {
    const res = await inject('ev-dead', 'ep-target');
    expect(res.status).toBe(200);
    expect(mockEventUpdates).toHaveLength(1);
    expect(mockEventUpdates[0].replacements.episodeId).toBe('ep-target');
  });

  test('re-injecting into the episode it already links is not a second episode', async () => {
    const res = await inject('ev-live', 'ep-live');
    expect(res.status).toBe(200);
    expect(mockEventUpdates).toHaveLength(1);
  });
});

describe('generateEpisodeFromEvent guard (shared by generate-episode, -from-many, regenerate)', () => {
  test('an unused event passes the guard', async () => {
    await expect(episodeGenerator.generateEpisodeFromEvent(mockEvents['ev-unused'], serviceModels(), { showId: SHOW }))
      .rejects.toThrow('PASSED_GUARD');
  });

  test('an event with a live episode is refused and the error names it', async () => {
    const err = await episodeGenerator.generateEpisodeFromEvent(mockEvents['ev-live'], serviceModels(), { showId: SHOW })
      .catch(e => e);
    expect(err.code).toBe('EVENT_ALREADY_HAS_EPISODE');
    expect(err.status).toBe(409);
    expect(err.episode.id).toBe('ep-live');
    expect(err.message).toContain('Gala Night');
  });

  test('an event whose linked episode was deleted passes the guard', async () => {
    await expect(episodeGenerator.generateEpisodeFromEvent(mockEvents['ev-dead'], serviceModels(), { showId: SHOW }))
      .rejects.toThrow('PASSED_GUARD');
  });

  test('a link to a hard-deleted episode passes the guard', async () => {
    const ev = { ...mockEvents['ev-dead'], id: 'ev-gone' };
    mockEvents['ev-gone'] = { ...ev, used_in_episode_id: 'ep-gone' };
    await expect(episodeGenerator.generateEpisodeFromEvent(mockEvents['ev-gone'], serviceModels(), { showId: SHOW }))
      .rejects.toThrow('PASSED_GUARD');
    delete mockEvents['ev-gone'];
  });
});

describe('episode-starting routes map the refusal to 409', () => {
  test('generate-episode: an event with a live episode gets 409 naming it', async () => {
    const res = await request(app).post(`/api/v1/world/${SHOW}/events/ev-live/generate-episode`).send({});
    expect(res.status).toBe(409);
    expect(res.body.episode).toEqual({ id: 'ep-live', title: 'Gala Night', episode_number: 3 });
    expect(res.body.error).toContain('Gala Night');
  });

  test('generate-episode: an unused event still starts an episode (201)', async () => {
    jest.spyOn(episodeGenerator, 'generateEpisodeFromEvent').mockResolvedValue({
      episode: { id: 'ep-new', title: 'Fresh' }, scenePlan: [], socialTasks: [],
    });
    const res = await request(app).post(`/api/v1/world/${SHOW}/events/ev-unused/generate-episode`).send({});
    expect(res.status).toBe(201);
    expect(res.body.data.episode.id).toBe('ep-new');
  });

  test('generate-episode-from-many: a live-linked anchor gets 409 naming its episode', async () => {
    const res = await request(app).post(`/api/v1/world/${SHOW}/events/generate-episode-from-many`)
      .send({ event_ids: ['ev-live'] });
    expect(res.status).toBe(409);
    expect(res.body.episode.id).toBe('ep-live');
  });

  test('generate-episode-from-many: an anchor whose episode was deleted is allowed', async () => {
    const spy = jest.spyOn(episodeGenerator, 'generateEpisodeFromEvent').mockResolvedValue({
      episode: { id: 'ep-new', title: 'Fresh' }, scenePlan: [], socialTasks: [],
    });
    const res = await request(app).post(`/api/v1/world/${SHOW}/events/generate-episode-from-many`)
      .send({ event_ids: ['ev-dead'] });
    expect(res.status).toBe(201);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 'ev-dead' }), expect.anything(), expect.anything());
  });

  test('regenerate-episode: a refusal from the generator is a 409, not a 500', async () => {
    const { eventEpisodeConflictError } = require('../../../src/utils/eventEpisodeLink');
    jest.spyOn(episodeGenerator, 'generateEpisodeFromEvent')
      .mockRejectedValue(eventEpisodeConflictError(mockEpisodes['ep-live']));
    const res = await request(app).post(`/api/v1/world/${SHOW}/events/ev-unused/regenerate-episode`).send({});
    expect(res.status).toBe(409);
    expect(res.body.episode.id).toBe('ep-live');
  });
});

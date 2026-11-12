/**
 * The event edit answers 409, not 500, when the database refuses a second
 * event's link to an episode (Evoni, 2026-11-12).
 *
 * world_events_used_in_episode_unique lets one event's own link point at an
 * episode. PUT …/events/:id { used_in_episode_id } for a second event hit
 * that index and answered 500 "Failed to update event". Only that conflict
 * (PostgreSQL 23505 on that index) is translated; the transaction has rolled
 * back, so nothing in the request is saved. Every other failure answers as
 * it did. No model is called.
 */
jest.unmock('uuid');

const mockAsk = { create: jest.fn(async () => { throw new Error('the model must not be asked'); }) };
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockAsk.create(...a) } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const {
  isEpisodeEventLinkConflict, episodeEventLinkTakenBody, EVENT_EPISODE_LINK_INDEX, EPISODE_EVENT_LINK_TAKEN_CODE,
} = require('../../src/utils/eventEpisodeLink');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

describe('isEpisodeEventLinkConflict: only the one known conflict', () => {
  const pg = (code, constraint) => ({ name: 'SequelizeUniqueConstraintError', message: 'Validation error', original: { code, constraint } });

  test('23505 on the event-episode link index, as Sequelize reports it (original or parent)', () => {
    expect(isEpisodeEventLinkConflict(pg('23505', EVENT_EPISODE_LINK_INDEX))).toBe(true);
    expect(isEpisodeEventLinkConflict({ parent: { code: '23505', constraint: EVENT_EPISODE_LINK_INDEX } })).toBe(true);
    expect(EVENT_EPISODE_LINK_INDEX).toBe('world_events_used_in_episode_unique');
  });

  test('another unique index, another error code, a bare error, and nothing at all are not it', () => {
    expect(isEpisodeEventLinkConflict(pg('23505', 'world_events_pkey'))).toBe(false);
    expect(isEpisodeEventLinkConflict(pg('23505', undefined))).toBe(false);
    expect(isEpisodeEventLinkConflict(pg('23503', EVENT_EPISODE_LINK_INDEX))).toBe(false);
    expect(isEpisodeEventLinkConflict(pg('40001', EVENT_EPISODE_LINK_INDEX))).toBe(false);
    expect(isEpisodeEventLinkConflict({ name: 'SequelizeUniqueConstraintError', message: 'Validation error' })).toBe(false);
    expect(isEpisodeEventLinkConflict(new Error(`duplicate key value violates unique constraint "${EVENT_EPISODE_LINK_INDEX}"`))).toBe(false);
    expect(isEpisodeEventLinkConflict(null)).toBe(false);
    expect(isEpisodeEventLinkConflict(undefined)).toBe(false);
  });

  test('the body: the existing { success, error, code } shape, naming the event that holds the link when known', () => {
    expect(episodeEventLinkTakenBody({ episodeId: 'ep-1', holder: { id: 'ev-1', name: 'Studio Session' } })).toEqual({
      success: false,
      error: 'This episode already has "Studio Session" linked to it, and an episode holds one linked event. Nothing was changed.',
      code: 'EPISODE_EVENT_LINK_TAKEN',
      fields: ['used_in_episode_id'],
      episode_id: 'ep-1',
      linked_event: { id: 'ev-1', name: 'Studio Session' },
    });
    expect(episodeEventLinkTakenBody({ episodeId: 'ep-1' })).toMatchObject({ error: expect.stringContaining('already has another event linked'), linked_event: null });
    expect(EPISODE_EVENT_LINK_TAKEN_CODE).toBe('EPISODE_EVENT_LINK_TAKEN');
  });
});

(shouldSkip ? describe.skip : describe)('PUT …/events/:id: a second event onto an episode that has one', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const putEvent = (show, eventId, body) => auth(request(app).put(`/api/v1/world/${show}/events/${eventId}`)).send(body);
  const eventRow = async (id) => (await rows('SELECT name, description, used_in_episode_id, status, prestige FROM world_events WHERE id = :id', { id }))[0];

  async function addEvent(show, name, episodeId = null) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, used_in_episode_id, times_used, is_paid, payment_amount, canon_consequences, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', :status, 3, 5, 0, :episodeId, :times, false, 0, '{}'::jsonb, NOW(), NOW())`,
    { id, show, name, episodeId, status: episodeId ? 'used' : 'draft', times: episodeId ? 1 : 0 });
    return id;
  }
  /** An unfilmed episode with `first` linked to it by its own link, another empty episode, and an unstarted event `second`. */
  async function seed() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :n, :n, '{}'::jsonb, NOW(), NOW())`, { show, n: `linktaken-${show.slice(0, 8)}` });
    const episode = uuid();
    const empty = uuid();
    for (const [id, n] of [[episode, 1], [empty, 2]]) {
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:id, :show, :t, :n, 'draft', NOW(), NOW())`, { id, show, t: `Episode ${n}`, n });
    }
    const first = await addEvent(show, 'Studio Session', episode);
    const second = await addEvent(show, 'Charity Gala');
    return { show, episode, empty, first, second };
  }

  beforeAll(() => {
    token = TokenService.generateTokenPair({ id: 'test-user-linktaken', email: 'linktaken@test.dev', name: 'Linktaken', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM episodes WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM world_events WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM shows WHERE id = :show', { show }).catch(() => {});
    }
    await sequelize.close();
  });

  test('409 EPISODE_EVENT_LINK_TAKEN, naming the event that holds the link; not 500', async () => {
    const f = await seed();
    const res = await putEvent(f.show, f.second, { used_in_episode_id: f.episode });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: 'This episode already has "Studio Session" linked to it, and an episode holds one linked event. Nothing was changed.',
      code: 'EPISODE_EVENT_LINK_TAKEN',
      fields: ['used_in_episode_id'],
      episode_id: f.episode,
      linked_event: { id: f.first, name: 'Studio Session' },
    });
  });

  test('nothing in the refused request is saved: the other fields sent with it stay as they were, on both events', async () => {
    const f = await seed();
    const before = { first: await eventRow(f.first), second: await eventRow(f.second) };
    const res = await putEvent(f.show, f.second, { name: 'Renamed in the same save', description: 'Also sent', prestige: 9, used_in_episode_id: f.episode });
    expect(res.status).toBe(409);
    expect(await eventRow(f.second)).toEqual(before.second);
    expect(await eventRow(f.first)).toEqual(before.first);
    expect(before.second).toEqual({ name: 'Charity Gala', description: null, used_in_episode_id: null, status: 'draft', prestige: 3 });
  });

  test('the same request without the link saves; the link onto an episode with no linked event saves; the first event re-sent saves', async () => {
    const f = await seed();
    expect((await putEvent(f.show, f.second, { name: 'Renamed', description: 'Saved' })).status).toBe(200);
    expect(await eventRow(f.second)).toMatchObject({ name: 'Renamed', description: 'Saved', used_in_episode_id: null });
    expect((await putEvent(f.show, f.second, { used_in_episode_id: f.empty })).status).toBe(200);
    expect((await eventRow(f.second)).used_in_episode_id).toBe(f.empty);
    expect((await putEvent(f.show, f.first, { used_in_episode_id: f.episode, description: 'Mine already' })).status).toBe(200);
    expect(await eventRow(f.first)).toMatchObject({ used_in_episode_id: f.episode, description: 'Mine already' });
  });

  test('once the first event no longer holds the link (its episode was deleted), the second is linked: the refusal follows the database, not a guess', async () => {
    const f = await seed();
    await run('UPDATE world_events SET used_in_episode_id = NULL WHERE id = :id', { id: f.first });
    const res = await putEvent(f.show, f.second, { used_in_episode_id: f.episode });
    expect(res.status).toBe(200);
    expect((await eventRow(f.second)).used_in_episode_id).toBe(f.episode);
  });

  describe('every other failure answers as before', () => {
    /** Make the event's UPDATE fail with a given error, leaving every other query alone. */
    const failUpdateWith = (err) => {
      const real = sequelize.query.bind(sequelize);
      return jest.spyOn(sequelize, 'query').mockImplementation((sql, ...rest) => {
        if (typeof sql === 'string' && /^\s*UPDATE world_events SET /.test(sql) && /WHERE id = :eventId/.test(sql)) return Promise.reject(err);
        return real(sql, ...rest);
      });
    };
    const unique = (constraint) => Object.assign(new Error('Validation error'), { name: 'SequelizeUniqueConstraintError', original: { code: '23505', constraint } });

    test('a unique violation on another index is still a 500, and is not called an episode-link conflict', async () => {
      const f = await seed();
      failUpdateWith(unique('some_other_unique_index'));
      const res = await putEvent(f.show, f.second, { description: 'x' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, error: 'Failed to update event' });
      expect(res.body.code).toBeUndefined();
    });

    test('an unrelated database error is still a 500', async () => {
      const f = await seed();
      failUpdateWith(Object.assign(new Error('connection terminated unexpectedly'), { name: 'SequelizeConnectionError' }));
      const res = await putEvent(f.show, f.second, { description: 'x' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, error: 'Failed to update event' });
    });

    test('a foreign-key failure keeps its own 400', async () => {
      const f = await seed();
      failUpdateWith(Object.assign(new Error('insert or update violates foreign key constraint'), { name: 'SequelizeForeignKeyConstraintError', original: { code: '23503', constraint: EVENT_EPISODE_LINK_INDEX } }));
      const res = await putEvent(f.show, f.second, { description: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_SCENE_SET_ID');
    });

    test('the terms lock keeps its own 409: an event that started an episode is not moved, and that is not this conflict', async () => {
      const f = await seed();
      const res = await putEvent(f.show, f.first, { used_in_episode_id: f.empty });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EVENT_TERMS_LOCKED');
    });

    test('an episode that does not exist keeps its own 400', async () => {
      const f = await seed();
      const res = await putEvent(f.show, f.second, { used_in_episode_id: uuid() });
      expect(res.status).toBe(400);
    });
  });

  test('the model is never asked', () => {
    expect(mockAsk.create).not.toHaveBeenCalled();
  });
});

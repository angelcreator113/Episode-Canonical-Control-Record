/**
 * A1.2c (A1.2-SPEC-v5 §8; Evoni's ruling Q-7, 2026-11-06). On the test
 * database, with no paid model call (ANTHROPIC_API_KEY unset; the SDK is a
 * stub that fails the test if it is ever asked):
 *   - Layer 1: a filmed episode (any raw clip, removed ones too) is not
 *     deleted, by a user, by an admin, or with ?hard=true: 409, still live;
 *   - Layer 2: when a filmed episode was deleted anyway (by SQL, outside the
 *     app), its event does not start again (Start, generate-from-many) and
 *     is not attached to another episode (inject): 409 EVENT_EPISODE_FROZEN,
 *     nothing created, no model call; the readiness check lists it;
 *   - an unfrozen episode is deleted and its event started again as before;
 *   - a clip attach and a delete take turns, in both orders.
 */
jest.unmock('uuid');

const mockAsk = { create: jest.fn(async () => { throw new Error('the model must not be asked'); }) };
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockAsk.create(...a) } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const clips = require('../../src/services/rawClipsService');
const { generateEpisodeFromEvent } = require('../../src/services/episodeGeneratorService');
const { lockEpisodes } = require('../../src/utils/episodeLocks');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function track(promise) {
  const t = { settled: false, value: undefined, error: undefined };
  t.promise = promise.then((v) => { t.settled = true; t.value = v; return v; }, (e) => { t.settled = true; t.error = e; throw e; });
  t.promise.catch(() => {});
  return t;
}

(shouldSkip ? describe.skip : describe)('A1.2c: a filmed episode is not deleted, and its event does not start again', () => {
  const shows = [];
  let userToken;
  let adminToken;
  const as = (token) => (r) => r.set('Authorization', `Bearer ${token}`);

  async function seed({ film = true } = {}) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Frozen delete ${show.slice(0, 8)}`, slug: `frozen-del-${show.slice(0, 8)}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    const episodeId = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:episodeId, :show, 'Filmed episode', 1, 'draft', NOW(), NOW())`, { episodeId, show });
    const eventId = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, used_in_episode_id, times_used, is_paid, payment_amount, canon_consequences, created_at, updated_at)
               VALUES (:eventId, :show, 'First paid invite', 'invite', 'used', 3, 5, 0, :episodeId, 1, false, 0, '{}'::jsonb, NOW(), NOW())`, { eventId, show, episodeId });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at)
               VALUES (:bid, :episodeId, :show, :eventId, 'draft', NOW(), NOW())`, { bid: uuid(), episodeId, show, eventId });
    if (film) await clips.createClip(sequelize, clipFor(episodeId, show));
    return { show, episodeId, eventId };
  }
  const clipFor = (episodeId, show) => ({ id: uuid(), episode_id: episodeId, show_id: show, performer: 'lala', s3_key_raw: `episodes/${episodeId}/raw-clips/${uuid()}/original.mp4` });
  const live = async (id) => (await rows('SELECT deleted_at IS NULL AS live FROM episodes WHERE id = :id', { id }))[0]?.live ?? null;
  const showEpisodes = async (show) => rows('SELECT id, deleted_at IS NULL AS live FROM episodes WHERE show_id = :show ORDER BY created_at', { show });
  const del = (token, id, query = '') => as(token)(request(app).delete(`/api/v1/episodes/${id}${query}`));
  const sqlDelete = (id) => run('UPDATE episodes SET deleted_at = NOW() WHERE id = :id', { id });
  const eventRow = async (eventId) => (await rows('SELECT * FROM world_events WHERE id = :eventId', { eventId }))[0];

  beforeAll(() => {
    userToken = TokenService.generateTokenPair({ id: 'test-user-frozen-del', email: 'u@frozen.dev', name: 'User', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    adminToken = TokenService.generateTokenPair({ id: 'test-admin-frozen-del', email: 'a@frozen.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockAsk.create.mockClear();
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await wait(500); // Start's after-commit work
    for (const show of shows) {
      const eps = '(SELECT id FROM episodes WHERE show_id = :show)';
      await run(`DELETE FROM episode_raw_clips WHERE show_id = :show OR episode_id IN ${eps}`, { show }).catch(() => {});
      for (const t of ['episode_briefs', 'scene_plans', 'episode_todo_lists', 'episode_spending_lines', 'episode_wardrobe', 'feed_posts']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch(() => {});
      }
      for (const t of ['season_specials', 'season_slots', 'financial_transactions', 'character_state_history', 'character_state', 'show_arcs']) {
        await run(`DELETE FROM ${t} WHERE show_id = :show`, { show }).catch(() => {});
      }
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM episodes WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM world_events WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM shows WHERE id = :show', { show }).catch(() => {});
    }
    await sequelize.close();
  });

  describe('Layer 1: delete', () => {
    test.each([
      ['a user', () => userToken, ''],
      ['an admin', () => adminToken, ''],
      ['an admin with ?hard=true', () => adminToken, '?hard=true'],
    ])('%s deleting a filmed episode: 409 EPISODE_SNAPSHOT_FROZEN, the episode stays live', async (_who, token, query) => {
      const f = await seed();
      const res = await del(token(), f.episodeId, query);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'EPISODE_SNAPSHOT_FROZEN', episode_id: f.episodeId, frozen_at: expect.any(String) });
      expect(res.body.error).toMatch(/cannot be deleted/);
      expect(await live(f.episodeId)).toBe(true);
    });

    test('an episode whose only clip was removed is still filmed: refused', async () => {
      const f = await seed({ film: false });
      const clip = await clips.createClip(sequelize, clipFor(f.episodeId, f.show));
      await clips.removeClip(sequelize, f.episodeId, clip.id);
      expect((await del(adminToken, f.episodeId)).status).toBe(409);
      expect(await live(f.episodeId)).toBe(true);
    });

    test('an unfrozen episode is deleted as before (soft), and its event starts again (regression)', async () => {
      const f = await seed({ film: false });
      const res = await del(userToken, f.episodeId);
      expect(res.status).toBeLessThan(300);
      expect(await live(f.episodeId)).toBe(false);
      const started = await generateEpisodeFromEvent(await eventRow(f.eventId), models, { showId: f.show, wardrobeItems: [] });
      expect(started.episode?.id || started.id).toBeTruthy();
      expect((await showEpisodes(f.show)).filter((e) => e.live)).toHaveLength(1);
      expect(mockAsk.create).not.toHaveBeenCalled();
    });
  });

  describe('Layer 2: a deleted filmed episode\'s event never starts again', () => {
    test('Start (route): 409 EVENT_EPISODE_FROZEN, nothing created, no model call', async () => {
      const f = await seed();
      await sqlDelete(f.episodeId); // outside the app: the refusal above cannot stop it
      process.env.ANTHROPIC_API_KEY = 'stub-not-a-key';
      const res = await as(userToken)(request(app).post(`/api/v1/world/${f.show}/events/${f.eventId}/generate-episode`)).send({});
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'EVENT_EPISODE_FROZEN', event_id: f.eventId, episode_id: f.episodeId });
      expect(mockAsk.create).not.toHaveBeenCalled();
      expect(await showEpisodes(f.show)).toEqual([{ id: f.episodeId, live: false }]);
    });

    test('generate-episode-from-many: 409 EVENT_EPISODE_FROZEN, nothing created', async () => {
      const f = await seed();
      await sqlDelete(f.episodeId);
      const res = await as(userToken)(request(app).post(`/api/v1/world/${f.show}/events/generate-episode-from-many`)).send({ event_ids: [f.eventId] });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EVENT_EPISODE_FROZEN');
      expect(await showEpisodes(f.show)).toEqual([{ id: f.episodeId, live: false }]);
    });

    test('inject into another episode: 409 EVENT_EPISODE_FROZEN, the event is not moved', async () => {
      const f = await seed();
      await sqlDelete(f.episodeId);
      const other = uuid();
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
                 VALUES (:other, :show, 'Another episode', 2, 'draft', NOW(), NOW())`, { other, show: f.show });
      const res = await as(userToken)(request(app).post(`/api/v1/world/${f.show}/events/${f.eventId}/inject`)).send({ episode_id: other });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EVENT_EPISODE_FROZEN');
      expect((await eventRow(f.eventId)).used_in_episode_id).toBe(f.episodeId);
    });

    test('the link through a brief alone (the event no longer names it) still refuses', async () => {
      const f = await seed();
      await sqlDelete(f.episodeId);
      await run('UPDATE world_events SET used_in_episode_id = NULL, status = \'ready\' WHERE id = :id', { id: f.eventId });
      await expect(generateEpisodeFromEvent(await eventRow(f.eventId), models, { showId: f.show, wardrobeItems: [] }))
        .rejects.toMatchObject({ status: 409, code: 'EVENT_EPISODE_FROZEN' });
      expect(await showEpisodes(f.show)).toEqual([{ id: f.episodeId, live: false }]);
    });

    test('the readiness check lists it, the same answer Start gives', async () => {
      const f = await seed();
      await sqlDelete(f.episodeId);
      const res = await as(userToken)(request(app).get(`/api/v1/world/${f.show}/events/${f.eventId}/start-readiness`));
      expect(res.status).toBe(200);
      const body = res.body.data || res.body;
      expect(JSON.stringify(body)).toMatch(/episode_frozen/);
    });

    test('a deleted episode that was never filmed does not block its event (regression)', async () => {
      const f = await seed({ film: false });
      await sqlDelete(f.episodeId);
      const started = await generateEpisodeFromEvent(await eventRow(f.eventId), models, { showId: f.show, wardrobeItems: [] });
      expect(started).toBeTruthy();
      expect((await showEpisodes(f.show)).filter((e) => e.live)).toHaveLength(1);
    });
  });

  describe('a clip attach and a delete take turns', () => {
    test('delete first (holding the lock): the clip waits, then finds the episode deleted', async () => {
      const f = await seed({ film: false });
      const t1 = await sequelize.transaction();
      let clip;
      try {
        await lockEpisodes(sequelize, [f.episodeId], { transaction: t1 });
        await sequelize.query('UPDATE episodes SET deleted_at = NOW() WHERE id = :id', { replacements: { id: f.episodeId }, transaction: t1 });
        clip = track(clips.createClip(sequelize, clipFor(f.episodeId, f.show)));
        await wait(400);
        expect(clip.settled).toBe(false); // FOR SHARE waits on the delete's FOR UPDATE
        await t1.commit();
      } catch (err) {
        await t1.rollback().catch(() => {});
        throw err;
      }
      await clip.promise.catch(() => {});
      expect(await live(f.episodeId)).toBe(false);
    });

    test('clip first (attaching): the delete waits for it, then refuses', async () => {
      const f = await seed({ film: false });
      const t1 = await sequelize.transaction();
      let removal;
      try {
        await lockEpisodes(sequelize, [f.episodeId], { transaction: t1, mode: 'share' });
        await sequelize.query(
          `INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
           VALUES (:id, :episodeId, :show, 'lala', :key, 'none', 'medium', NOW(), NOW())`,
          { replacements: { id: uuid(), episodeId: f.episodeId, show: f.show, key: `episodes/${f.episodeId}/raw-clips/x/original.mp4` }, transaction: t1 });
        removal = track(del(adminToken, f.episodeId).then((r) => r));
        await wait(400);
        expect(removal.settled).toBe(false);
        await t1.commit();
      } catch (err) {
        await t1.rollback().catch(() => {});
        throw err;
      }
      const res = await removal.promise;
      expect(res.status).toBe(409);
      expect(await live(f.episodeId)).toBe(true);
    });
  });
});

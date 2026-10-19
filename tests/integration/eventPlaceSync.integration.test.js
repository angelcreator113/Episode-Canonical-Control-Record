/**
 * Eighth audit (2026-10-19): the episode side of Scene Sets, on the migrated
 * test database through the real routes.
 *  - An event's place and its draft episode's Event location are one: an
 *    event version made in Scene Sets, or the event's set changed on its
 *    page, moves the episode's Event location and its unlocked beats (their
 *    angle placed again); an accepted episode keeps its place; the
 *    Locations step's Event row is written to the event.
 *  - Only the look on the set the event uses now dresses the episode.
 *  - Another event's version is not an event's place; the scene-set link
 *    route keeps the Place lock.
 *  - A set linked to an episode from the Overview is a named extra, and not
 *    once the episode is accepted.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('An event\'s place and its episode (eighth audit)', () => {
  let token;
  const setIds = [];
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function show() {
    const id = uuid();
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
      { id, name: `Audit8 ${id.slice(0, 8)}`, slug: `audit8-${id.slice(0, 8)}` });
    return id;
  }
  async function set(name, fields = {}) {
    const s = await models.SceneSet.create({ name, scene_type: 'EVENT_LOCATION', generation_status: 'complete', ...fields });
    setIds.push(s.id);
    return s;
  }
  // A draft (or accepted) episode made from an event held at `at`, with its
  // Event location there and two beats: 10 unlocked, 11 locked.
  async function episodeAt(showId, at, status = 'draft') {
    const eventId = uuid();
    const episodeId = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:episodeId, :showId, 'Ep', 1, 'draft', :status, NOW(), NOW())`, { episodeId, showId, status });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, scene_set_id, used_in_episode_id, created_at, updated_at)
               VALUES (:eventId, :showId, 'Spring Gala', 'invite', 'used', :at, :episodeId, NOW(), NOW())`, { eventId, showId, at, episodeId });
    await run(`INSERT INTO episode_briefs (id, episode_id, event_id, created_at, updated_at) VALUES (:id, :episodeId, :eventId, NOW(), NOW())`,
      { id: uuid(), episodeId, eventId });
    await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, sort_order, role, created_at, updated_at)
               VALUES (:id, :at, :episodeId, 0, 'event', NOW(), NOW())`, { id: uuid(), at, episodeId });
    for (const [n, locked] of [[10, false], [11, true]]) {
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, locked, chosen_by_user, sort_order, ai_suggested, created_at, updated_at)
                 VALUES (:id, :episodeId, :n, 'Beat', :at, 'WIDE', :locked, false, :n, false, NOW(), NOW())`, { id: uuid(), episodeId, n, at, locked });
    }
    return { eventId, episodeId };
  }
  const eventLocation = async (episodeId) => (await rows(
    "SELECT scene_set_id FROM scene_set_episodes WHERE episode_id = :episodeId AND role = 'event' AND deleted_at IS NULL", { episodeId }))[0]?.scene_set_id;
  const beats = async (episodeId) => rows('SELECT beat_number, scene_set_id, angle_label FROM scene_plans WHERE episode_id = :episodeId ORDER BY beat_number', { episodeId });

  beforeAll(() => {
    // An ADMIN: these writes are ADMIN only (Evoni, 2026-10-19: this whole part of the site is admin only).
    token = TokenService.generateTokenPair({ id: 'test-user-audit8', email: 'u@audit8.dev', name: 'Editor', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (setIds.length) {
      await run('UPDATE world_events SET scene_set_id = NULL WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('UPDATE scene_sets SET version_of_set_id = NULL WHERE id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_set_looks WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_plans WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_set_episodes WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_sets WHERE id IN (:ids)', { ids: setIds });
    }
  });

  it('an event version made in Scene Sets moves the draft episode\'s Event location and unlocked beats; locked beats stay', async () => {
    const showId = await show();
    const everyday = await set('Glasshouse', { show_id: showId });
    const gala = await set('Glasshouse – Gala', { show_id: showId });
    const { eventId, episodeId } = await episodeAt(showId, everyday.id);
    const res = await auth(request(app).put(`/api/v1/scene-sets/${gala.id}/version`)).send({ everyday_set_id: everyday.id, event_id: eventId });
    expect(res.status).toBe(200);
    expect(await eventLocation(episodeId)).toBe(gala.id);
    expect(await beats(episodeId)).toEqual([
      { beat_number: 10, scene_set_id: gala.id, angle_label: null },
      { beat_number: 11, scene_set_id: everyday.id, angle_label: 'WIDE' },
    ]);

    // "Stop using these photos" brings both back.
    const back = await auth(request(app).put(`/api/v1/scene-sets/${gala.id}/version`)).send({ everyday_set_id: null, return_event: true });
    expect(back.status).toBe(200);
    expect(await eventLocation(episodeId)).toBe(everyday.id);
    expect((await beats(episodeId))[0].scene_set_id).toBe(everyday.id);
  });

  it('the event\'s set changed on its page moves the episode; an accepted episode keeps its place', async () => {
    const showId = await show();
    const a = await set('Hall A', { show_id: showId });
    const b = await set('Hall B', { show_id: showId });
    const { eventId, episodeId } = await episodeAt(showId, a.id);
    const res = await auth(request(app).put(`/api/v1/world/${showId}/events/${eventId}`)).send({ scene_set_id: b.id });
    expect(res.status).toBe(200);
    expect(await eventLocation(episodeId)).toBe(b.id);

    const { syncEpisodeEventLocation } = require('../../src/services/eventPlaceSync');
    const accepted = await episodeAt(showId, a.id, 'accepted');
    expect(await syncEpisodeEventLocation(sequelize, { eventId: accepted.eventId, fromSetId: a.id, toSetId: b.id })).toEqual([]);
    expect(await eventLocation(accepted.episodeId)).toBe(a.id);
  });

  it('the Locations step\'s Event row is written to the event', async () => {
    const showId = await show();
    const a = await set('Rooftop', { show_id: showId });
    const b = await set('Rooftop terrace', { show_id: showId });
    const { eventId, episodeId } = await episodeAt(showId, a.id);
    const res = await auth(request(app).put(`/api/v1/episodes/${episodeId}/locations`)).send({ locations: [{ role: 'event', scene_set_id: b.id }] });
    expect(res.status).toBe(200);
    expect((await rows('SELECT scene_set_id FROM world_events WHERE id = :eventId', { eventId }))[0].scene_set_id).toBe(b.id);
    expect((await beats(episodeId))[0]).toEqual({ beat_number: 10, scene_set_id: b.id, angle_label: null });
  });

  it('another event\'s version is refused as an event\'s place; the link route keeps the Place lock', async () => {
    const showId = await show();
    const everyday = await set('Atelier', { show_id: showId });
    const other = await set('Atelier – Brunch', { show_id: showId, version_of_set_id: everyday.id });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, scene_set_id, created_at, updated_at)
               VALUES (:id, :showId, 'Brunch', 'invite', 'ready', :setId, NOW(), NOW())`, { id: uuid(), showId, setId: other.id });
    const { eventId } = await episodeAt(showId, everyday.id);
    const res = await auth(request(app).put(`/api/v1/world/${showId}/events/${eventId}`)).send({ scene_set_id: other.id });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('OTHER_EVENT_VERSION');

    const locked = await episodeAt(showId, everyday.id, 'accepted');
    const plain = await set('Atelier, spare', { show_id: showId });
    const link = await auth(request(app).post(`/api/v1/world/${showId}/events/${locked.eventId}/scene-set-link`)).send({ scene_set_id: plain.id });
    expect(link.status).toBe(409);
    expect(link.body.code).toBe('PLACE_LOCKED');
  });

  it('only the look on the set the event uses now dresses the episode', async () => {
    const showId = await show();
    const everyday = await set('Garden', { show_id: showId });
    const gala = await set('Garden – Gala', { show_id: showId });
    const { eventId, episodeId } = await episodeAt(showId, gala.id);
    for (const s of [everyday, gala]) {
      await run(`INSERT INTO scene_set_looks (id, scene_set_id, event_id, status, source, image_url, created_at, updated_at)
                 VALUES (:id, :setId, :eventId, 'complete', 'uploaded', :url, NOW(), NOW())`, { id: uuid(), setId: s.id, eventId, url: `https://x/${s.id}.jpg` });
    }
    const { episodeLooks } = require('../../src/services/dressedAngleService');
    expect([...(await episodeLooks(sequelize, episodeId)).keys()]).toEqual([gala.id]);
  });

  it('a set linked from the Overview is a named extra, and not once the episode is accepted', async () => {
    const showId = await show();
    const venue = await set('Café', { show_id: showId });
    const { episodeId } = await episodeAt(showId, venue.id);
    const extra = await set('Car', { show_id: showId });
    const res = await auth(request(app).post(`/api/v1/episodes/${episodeId}/scene-sets`)).send({ sceneSetIds: [extra.id] });
    expect(res.status).toBe(200);
    expect((await rows('SELECT role, role_name FROM scene_set_episodes WHERE episode_id = :episodeId AND scene_set_id = :setId', { episodeId, setId: extra.id }))[0])
      .toEqual({ role: 'extra', role_name: 'Car' });

    const accepted = await episodeAt(showId, venue.id, 'accepted');
    const refused = await auth(request(app).post(`/api/v1/episodes/${accepted.episodeId}/scene-sets`)).send({ sceneSetIds: [extra.id] });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('EPISODE_ACCEPTED');
  });
});

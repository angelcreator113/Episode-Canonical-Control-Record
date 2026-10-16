/**
 * Everyday sets and their event versions (Evoni, 2026-10-16: "i also need to
 * be able to choose which photo is the everyday set and which ones belong to
 * an event set"; she chose whole sets), on the migrated test database
 * through the real routes:
 *  - a set becomes an event version of an everyday set for one event, and
 *    the event then uses it (its scenes and look are made on it);
 *  - the list names each version's everyday set and event, and each
 *    everyday set's versions;
 *  - refused: a version of a version, of itself, of another show's set, for
 *    another show's event, a set with versions of its own, a set other
 *    events use, a locked event; bad ids are 400s;
 *  - back to everyday: the event keeps using it.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261016150000-add-version-of-set-id-to-scene-sets');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Scene set event versions', () => {
  let token;
  const setIds = [];
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const api = (method, path) => auth(request(app)[method](`/api/v1/scene-sets${path}`));

  async function show() {
    const id = uuid();
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
      { id, name: `Versions ${id.slice(0, 8)}`, slug: `versions-${id.slice(0, 8)}` });
    return id;
  }
  async function set(name, fields = {}) {
    const s = await models.SceneSet.create({ name, scene_type: 'HOME_BASE', generation_status: 'complete', ...fields });
    setIds.push(s.id);
    return s;
  }
  async function event(showId, name, fields = {}) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, scene_set_id, used_in_episode_id, created_at, updated_at)
               VALUES (:id, :showId, :name, 'invite', 'ready', :setId, :episodeId, NOW(), NOW())`,
      { id, showId, name, setId: fields.scene_set_id || null, episodeId: fields.used_in_episode_id || null });
    return id;
  }
  const eventSet = async (id) => (await rows('SELECT scene_set_id FROM world_events WHERE id = :id', { id }))[0].scene_set_id;
  const version = (setId, body) => api('put', `/${setId}/version`).send(body);

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-versions', email: 'user@versions.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
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
      await run('DELETE FROM scene_sets WHERE id IN (:ids)', { ids: setIds });
    }
  });

  it('the migration is re-runnable', async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    expect((await rows(`SELECT 1 FROM information_schema.columns WHERE table_name = 'scene_sets' AND column_name = 'version_of_set_id'`)).length).toBe(1);
  });

  it('a set becomes an event version for one event; the event uses it; the list names both sides', async () => {
    const showId = await show();
    const [[loc]] = await sequelize.query(
      `INSERT INTO world_locations (id, name, location_type, created_at, updated_at) VALUES (gen_random_uuid(), 'Lala''s home', 'interior', NOW(), NOW()) RETURNING id`);
    const everyday = await set("Lala's bedroom", { show_id: showId, world_location_id: loc.id });
    const gala = await set("Lala's bedroom – Gala", { show_id: showId });
    const galaEvent = await event(showId, 'Spring Gala', { scene_set_id: everyday.id });
    await event(showId, 'Brunch');

    const options = await api('get', `/${gala.id}/version-options`);
    expect(options.status).toBe(200);
    expect(options.body.data.everyday_sets.map((s) => s.id)).toContain(everyday.id);
    expect(options.body.data.everyday_sets.map((s) => s.id)).not.toContain(gala.id);
    expect(options.body.data.events.map((e) => e.name)).toEqual(['Brunch', 'Spring Gala']);

    const res = await version(gala.id, { everyday_set_id: everyday.id, event_id: galaEvent });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ version_of: { id: everyday.id }, event: { id: galaEvent, name: 'Spring Gala' } });
    expect(await eventSet(galaEvent)).toBe(gala.id);
    // The version takes the everyday set's World Location, so the venue finds it.
    expect((await rows('SELECT world_location_id, version_of_set_id FROM scene_sets WHERE id = :id', { id: gala.id }))[0])
      .toEqual({ world_location_id: loc.id, version_of_set_id: everyday.id });

    const one = async (id) => (await api('get', `/${id}`)).body.data;
    expect(await one(gala.id)).toMatchObject({ version_of: { id: everyday.id, name: "Lala's bedroom" }, version_event: { id: galaEvent, name: 'Spring Gala' } });
    expect((await one(everyday.id)).event_versions).toEqual([{ id: gala.id, name: "Lala's bedroom – Gala", event: { id: galaEvent, name: 'Spring Gala' } }]);
    // An everyday set with versions is not offered as a version, and is not made one.
    expect((await version(everyday.id, { everyday_set_id: gala.id, event_id: galaEvent })).status).toBe(400);
    const other = await set('Other room', { show_id: showId });
    const hasVersions = await version(everyday.id, { everyday_set_id: other.id, event_id: galaEvent });
    expect(hasVersions.status).toBe(409);
    expect(hasVersions.body.code).toBe('HAS_VERSIONS');

    // Back to everyday: the event keeps using it.
    expect((await version(gala.id, { everyday_set_id: null })).status).toBe(200);
    expect((await one(gala.id)).version_of).toBeNull();
    expect(await eventSet(galaEvent)).toBe(gala.id);
  });

  it('refuses itself, another show, another show\'s event, a set other events use, a locked event and bad ids', async () => {
    const a = await show();
    const b = await show();
    const everyday = await set('Everyday A', { show_id: a });
    const theirs = await set('Everyday B', { show_id: b });
    const version1 = await set('Version A', { show_id: a });
    const eventA = await event(a, 'Party A');
    const eventB = await event(b, 'Party B');

    expect((await version(version1.id, { everyday_set_id: version1.id, event_id: eventA })).status).toBe(400);
    expect((await version(version1.id, { everyday_set_id: theirs.id, event_id: eventA })).body.code).toBe('OTHER_SHOW');
    expect((await version(version1.id, { everyday_set_id: everyday.id, event_id: eventB })).status).toBe(404);
    expect((await version(version1.id, { everyday_set_id: 'nope', event_id: eventA })).status).toBe(400);
    expect((await version(version1.id, { everyday_set_id: everyday.id })).status).toBe(400);
    expect((await api('get', '/not-an-id/version-options')).status).toBe(400);

    // Used by another event: a version is for one event.
    const shared = await set('Shared', { show_id: a });
    await event(a, 'Earlier party', { scene_set_id: shared.id });
    const used = await version(shared.id, { everyday_set_id: everyday.id, event_id: eventA });
    expect(used.status).toBe(409);
    expect(used.body.code).toBe('USED_BY_OTHER_EVENTS');

    // A locked event (its episode accepted) does not change place.
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:ep, :a, 'Accepted', 1, 'draft', 'accepted', NOW(), NOW())`, { ep, a });
    const locked = await event(a, 'Locked party', { used_in_episode_id: ep });
    const lockedRes = await version(version1.id, { everyday_set_id: everyday.id, event_id: locked });
    expect(lockedRes.status).toBe(409);
    expect(lockedRes.body.code).toBe('PLACE_LOCKED');
    expect((await api('get', `/${version1.id}/version-options`)).body.data.events.find((e) => e.id === locked).locked).toBe(true);
  });
});

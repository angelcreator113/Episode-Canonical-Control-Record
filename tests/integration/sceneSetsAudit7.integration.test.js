/**
 * Scene Sets seventh audit (2026-10-18): features that each held alone but
 * broke together, on the migrated test database through the real routes:
 *  - deleting a set an accepted episode's event is held at is refused, with
 *    or without a replacement (the place lock);
 *  - a shared set's other-show uses are not moved onto one show's set, and
 *    a shared set other shows use is not claimed as one event's photos;
 *  - an everyday set's event versions count as its uses, follow a
 *    replacement, read as everyday after a plain delete; a version is not a
 *    replacement;
 *  - an event version is not a location's approved everyday look, and the
 *    approved look is not made an event version;
 *  - "Stop using these photos" on a set that is no longer a version is
 *    refused, and does not move an event across shows;
 *  - an angle is not deleted while it is being generated.
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

(shouldSkip ? describe.skip : describe)('Scene Sets seventh audit', () => {
  let token;
  const setIds = [];
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const api = (method, path) => auth(request(app)[method](`/api/v1/scene-sets${path}`));

  async function show() {
    const id = uuid();
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
      { id, name: `Audit7 ${id.slice(0, 8)}`, slug: `audit7-${id.slice(0, 8)}` });
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
  async function episode(showId, status = 'accepted') {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:id, :showId, 'Ep', 1, 'draft', :status, NOW(), NOW())`, { id, showId, status });
    return id;
  }
  async function location(name) {
    const [[loc]] = await sequelize.query(
      `INSERT INTO world_locations (id, name, location_type, created_at, updated_at) VALUES (gen_random_uuid(), :name, 'interior', NOW(), NOW()) RETURNING id`,
      { replacements: { name } });
    return loc.id;
  }
  const eventSet = async (id) => (await rows('SELECT scene_set_id FROM world_events WHERE id = :id', { id }))[0].scene_set_id;
  const versionOf = async (id) => (await rows('SELECT version_of_set_id FROM scene_sets WHERE id = :id', { id }))[0].version_of_set_id;
  const version = (setId, body) => api('put', `/${setId}/version`).send(body);

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      // Scene-set writes are ADMIN only (Evoni, 2026-10-19: this whole part of the site is admin only).
      id: 'test-admin-audit7', email: 'admin@audit7.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN',
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
      await run('UPDATE world_locations SET approved_base_scene_set_id = NULL WHERE approved_base_scene_set_id IN (:ids)', { ids: setIds });
      await run('UPDATE scene_sets SET version_of_set_id = NULL WHERE id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_sets WHERE id IN (:ids)', { ids: setIds });
    }
  });

  it('a set an accepted episode\'s event is held at is not deleted, with or without a replacement', async () => {
    const showId = await show();
    const a = await set('Gala hall', { show_id: showId });
    const b = await set('Other hall', { show_id: showId });
    const gala = await event(showId, 'Gala', { scene_set_id: a.id, used_in_episode_id: await episode(showId) });
    const moved = await api('delete', `/${a.id}?replacement_id=${b.id}`);
    expect(moved.status).toBe(409);
    expect(moved.body.code).toBe('PLACE_LOCKED');
    expect(moved.body.locked_events.map((e) => e.name)).toEqual(['Gala']);
    const orphaned = await api('delete', `/${a.id}?confirm_orphan=true`);
    expect(orphaned.status).toBe(409);
    expect(await eventSet(gala)).toBe(a.id);
    expect((await rows('SELECT deleted_at FROM scene_sets WHERE id = :id', { id: a.id }))[0].deleted_at).toBeNull();
  });

  it('a shared set other shows use is not replaced by one show\'s set, nor claimed as one event\'s photos', async () => {
    const showA = await show();
    const showB = await show();
    const shared = await set('Shared loft');
    const bEvent = await event(showB, 'B brunch', { scene_set_id: shared.id });
    const aSet = await set('A loft', { show_id: showA });
    const res = await api('delete', `/${shared.id}?replacement_id=${aSet.id}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REPLACEMENT');
    expect(await eventSet(bEvent)).toBe(shared.id);

    const sharedTwo = await set('Shared studio');
    await event(showB, 'B party', { scene_set_id: sharedTwo.id });
    const everyday = await set('A studio', { show_id: showA });
    const aGala = await event(showA, 'A gala', { scene_set_id: everyday.id });
    const claimed = await version(sharedTwo.id, { everyday_set_id: everyday.id, event_id: aGala });
    expect(claimed.status).toBe(409);
    expect(['USED_BY_ANOTHER_SHOW', 'USED_BY_OTHER_EVENTS']).toContain(claimed.body.code);
    expect((await rows('SELECT show_id FROM scene_sets WHERE id = :id', { id: sharedTwo.id }))[0].show_id).toBeNull();
  });

  it('an everyday set\'s versions are uses, follow a replacement, and read as everyday after a plain delete; a version is no replacement', async () => {
    const showId = await show();
    const everyday = await set('Bedroom', { show_id: showId });
    const v = await set('Bedroom – Gala', { show_id: showId, version_of_set_id: everyday.id });
    const plain = await api('delete', `/${everyday.id}`);
    expect(plain.status).toBe(409);
    expect(plain.body.uses.versions).toBe(1);

    const asReplacement = await api('delete', `/${everyday.id}?replacement_id=${v.id}`);
    expect(asReplacement.status).toBe(400);
    expect(asReplacement.body.error).toMatch(/is an event version/);

    const next = await set('Bedroom, redone', { show_id: showId });
    const moved = await api('delete', `/${everyday.id}?replacement_id=${next.id}`);
    expect(moved.status).toBe(200);
    expect(moved.body.moved.versions).toBe(1);
    expect(await versionOf(v.id)).toBe(next.id);

    const orphan = await api('delete', `/${next.id}?confirm_orphan=true`);
    expect(orphan.status).toBe(200);
    expect(await versionOf(v.id)).toBeNull();
  });

  it('an event version is not the location\'s everyday look, and the everyday look is not an event version', async () => {
    const showId = await show();
    const loc = await location('Atelier');
    const everyday = await set('Atelier', { show_id: showId, world_location_id: loc, base_still_url: 'https://x/a.jpg' });
    const v = await set('Atelier – Gala', { show_id: showId, world_location_id: loc, base_still_url: 'https://x/g.jpg', version_of_set_id: everyday.id });
    const approveVersion = await api('post', `/${v.id}/approve-base`);
    expect(approveVersion.status).toBe(409);
    expect(approveVersion.body.error).toMatch(/event version/);

    const loc2 = await location('Studio');
    const solo = await set('Studio', { show_id: showId, world_location_id: loc2, base_still_url: 'https://x/s.jpg' });
    expect((await api('post', `/${solo.id}/approve-base`)).status).toBe(200);
    const other = await set('Studio, spare', { show_id: showId });
    const gala = await event(showId, 'Gala', { scene_set_id: other.id });
    const res = await version(solo.id, { everyday_set_id: other.id, event_id: gala });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('IS_EVERYDAY_LOOK');
    const options = await api('get', `/${v.id}/version-options`);
    expect(options.body.data.everyday_sets.find((o) => o.id === solo.id).is_everyday_look).toBe(true);
  });

  it('"Stop using these photos" on a set that is no longer a version is refused; it does not move an event across shows', async () => {
    const showA = await show();
    const showB = await show();
    const everyday = await set('Rooftop', { show_id: showA });
    const v = await set('Rooftop – Gala', { show_id: showA });
    const gala = await event(showA, 'Gala', { scene_set_id: everyday.id });
    expect((await version(v.id, { everyday_set_id: everyday.id, event_id: gala })).status).toBe(200);

    await run('UPDATE scene_sets SET show_id = :showB WHERE id = :id', { showB, id: everyday.id });
    const crossing = await version(v.id, { everyday_set_id: null, return_event: true });
    expect(crossing.status).toBe(409);
    expect(crossing.body.code).toBe('OTHER_SHOW');
    expect(await eventSet(gala)).toBe(v.id);

    expect((await version(v.id, { everyday_set_id: null })).status).toBe(200);
    const again = await version(v.id, { everyday_set_id: null, return_event: true });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('NOT_A_VERSION');
  });

  it('a version\'s event says whether its place is locked', async () => {
    const showId = await show();
    const everyday = await set('Garden', { show_id: showId });
    const v = await set('Garden – Gala', { show_id: showId, version_of_set_id: everyday.id });
    await event(showId, 'Gala', { scene_set_id: v.id, used_in_episode_id: await episode(showId) });
    const res = await api('get', `/${everyday.id}`);
    expect(res.body.data.event_versions[0].event).toMatchObject({ name: 'Gala', locked: true });
  });

  it('an angle is not deleted while it is being generated', async () => {
    const s = await set('Kitchen');
    const angle = await models.SceneAngle.create({ scene_set_id: s.id, angle_label: 'WIDE', angle_name: 'Wide', generation_status: 'generating' });
    const res = await api('delete', `/${s.id}/angles/${angle.id}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_GENERATING');
    expect(await models.SceneAngle.findByPk(angle.id)).not.toBeNull();
  });
});

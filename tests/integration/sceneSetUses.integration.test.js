/**
 * D1 and D2 (Evoni, 2026-10-02): her beats pointed at two scene sets she had
 * deleted after making new ones, and the new sets had no show.
 *
 *   D1. "Deleting a scene set that episodes, beats or locations use asks for
 *   a replacement set and moves every use (episode locations, plan beats,
 *   event scene_set_id, defaults) to it; deleting without a replacement
 *   shows how many uses will be left pointing at a removed set."
 *   D2. "A scene set created while working in a show gets that show's
 *   show_id ... Also give me a one-click 'Move my beats to…' for an episode
 *   whose beats point at removed sets (choose replacements per removed set)."
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
// scene_set_episodes is created by these two; the file runs them itself
// rather than relying on another test file having run first (CI orders
// files by size and history, #2438).
const junctionMigration = require('../../src/migrations/20260324000000-add-scene-sets-cover-and-episodes');
const sortOrderMigration = require('../../src/migrations/20260626000001-add-sort-order-to-scene-set-episodes');
const rolesMigration = require('../../src/migrations/20261002100000-add-scene-set-episode-roles');
const scenePlanIdMigration = require('../../src/migrations/20261002160000-add-scenes-scene-plan-id');
const { resolveSetShowId } = require('../../src/services/sceneSetUsesService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Scene set uses: delete with a replacement, show on create, move my beats (D1, D2)', () => {
  const show = uuid();
  const universe = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function sceneSet(name, { showId = show, deleted = false } = {}) {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, base_still_url, generation_status, created_at, updated_at, deleted_at)
               VALUES (:id, :name, 'HOME_BASE', :showId, 'https://x/base.jpg', 'complete', NOW(), NOW(), ${deleted ? 'NOW()' : 'NULL'})`, { id, name, showId });
    return id;
  }
  async function episode() {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:id, :show, 'Uses ep', :n, 'draft', NOW(), NOW())`, { id, show, n: Math.floor(Math.random() * 100000) + 900 });
    return id;
  }
  async function useEverywhere(setId, ep) {
    await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, sort_order, created_at, updated_at)
               VALUES (:id, :setId, :ep, 'home', 0, NOW(), NOW())`, { id: uuid(), setId, ep });
    for (const n of [1, 2]) {
      const plan = uuid();
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, locked, chosen_by_user, sort_order, ai_suggested, created_at, updated_at)
                 VALUES (:plan, :ep, :n, :name, :setId, false, false, :n, false, NOW(), NOW())`, { plan, ep, n, name: `Beat ${n}`, setId });
      await run(`INSERT INTO scenes (id, episode_id, scene_plan_id, scene_set_id, scene_number, title, created_at, updated_at)
                 VALUES (:id, :ep, :plan, :setId, :n, :title, NOW(), NOW())`, { id: uuid(), ep, plan, setId, n, title: `Beat ${n}` });
    }
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, scene_set_id, used_in_episode_id, created_at, updated_at)
               VALUES (:id, :show, 'Gala', 'invite', 'used', 5, :setId, :ep, NOW(), NOW())`, { id: uuid(), show, setId, ep });
  }
  const setDefault = (setId) => run(`UPDATE shows SET metadata = jsonb_set(COALESCE(metadata::jsonb, '{}'::jsonb), '{scene_defaults}', jsonb_build_object('home_set_id', CAST(:setId AS text)))::json WHERE id = :show`, { setId, show });
  const usesOf = async (setId) => ({
    locations: (await rows('SELECT COUNT(*)::int n FROM scene_set_episodes WHERE scene_set_id = :setId AND deleted_at IS NULL', { setId }))[0].n,
    beats: (await rows('SELECT COUNT(*)::int n FROM scene_plans WHERE scene_set_id = :setId AND deleted_at IS NULL', { setId }))[0].n,
    events: (await rows('SELECT COUNT(*)::int n FROM world_events WHERE scene_set_id = :setId AND deleted_at IS NULL', { setId }))[0].n,
    scenes: (await rows('SELECT COUNT(*)::int n FROM scenes WHERE scene_set_id = :setId AND deleted_at IS NULL', { setId }))[0].n,
  });
  const defaultHome = async () => (await rows("SELECT metadata::jsonb->'scene_defaults'->>'home_set_id' AS id FROM shows WHERE id = :show", { show }))[0].id;
  const isDeleted = async (setId) => Boolean((await rows('SELECT deleted_at FROM scene_sets WHERE id = :setId', { setId }))[0].deleted_at);

  beforeAll(async () => {
    const qi = sequelize.getQueryInterface();
    for (const m of [junctionMigration, sortOrderMigration, rolesMigration, scenePlanIdMigration]) await m.up(qi, Sequelize);
    token = TokenService.generateTokenPair({ id: 'test-user-set-uses', email: 'u@uses.dev', name: 'Editor', groups: ['USER'], role: 'USER' }).accessToken;
    await run(`INSERT INTO universes (id, name, slug, created_at, updated_at) VALUES (:universe, :name, :name, NOW(), NOW())`,
      { universe, name: `uses-${universe.slice(0, 8)}` }).catch(() => {});
    await run(`INSERT INTO shows (id, name, slug, metadata, universe_id, created_at, updated_at) VALUES (:show, :n, :n, '{}', :universe, NOW(), NOW())`,
      { show, n: `uses-${show.slice(0, 8)}`, universe });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const q = (sql) => sequelize.query(sql, { replacements: { show } }).catch(() => {});
    for (const t of ['scenes', 'scene_plans', 'scene_set_episodes']) await q(`DELETE FROM ${t} WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`);
    await q('UPDATE world_events SET used_in_episode_id = NULL, scene_set_id = NULL WHERE show_id = :show');
    await q('DELETE FROM world_events WHERE show_id = :show');
    await q('DELETE FROM episodes WHERE show_id = :show');
    await q('DELETE FROM scene_sets WHERE show_id = :show OR name LIKE \'d2-%\'');
    await q('DELETE FROM shows WHERE id = :show');
  });

  it('D1: a set in use lists its uses; deleting it with no replacement is refused until confirmed, and says what is left', async () => {
    const old = await sceneSet('Old closet');
    const ep = await episode();
    await useEverywhere(old, ep);
    await setDefault(old);

    const uses = await auth(request(app).get(`/api/v1/scene-sets/${old}/uses`));
    expect(uses.status).toBe(200);
    expect(uses.body.data).toMatchObject({ locations: 1, beats: 2, events: 1, defaults: 1, scenes: 2, total: 7 });

    const refused = await auth(request(app).delete(`/api/v1/scene-sets/${old}`));
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ code: 'SET_IN_USE', uses: { total: 7 } });
    expect(await isDeleted(old)).toBe(false);

    const orphaned = await auth(request(app).delete(`/api/v1/scene-sets/${old}?confirm_orphan=true`));
    expect(orphaned.status).toBe(200);
    expect(orphaned.body.uses_left).toMatchObject({ beats: 2, total: 7 });
    expect(await isDeleted(old)).toBe(true);
  });

  it('D1: deleting with a replacement moves every use to it, then deletes', async () => {
    const old = await sceneSet('Old room');
    const next = await sceneSet('New bedroom');
    const ep = await episode();
    await useEverywhere(old, ep);
    await setDefault(old);

    const bad = await auth(request(app).delete(`/api/v1/scene-sets/${old}?replacement_id=${old}`));
    expect(bad.status).toBe(400);
    const res = await auth(request(app).delete(`/api/v1/scene-sets/${old}?replacement_id=${next}`));
    expect(res.status).toBe(200);
    expect(res.body.moved).toMatchObject({ locations: 1, beats: 2, events: 1, defaults: 1, scenes: 2 });
    expect(await usesOf(old)).toEqual({ locations: 0, beats: 0, events: 0, scenes: 0 });
    expect(await usesOf(next)).toEqual({ locations: 1, beats: 2, events: 1, scenes: 2 });
    expect(await defaultHome()).toBe(next);
    expect(await isDeleted(old)).toBe(true);
  });

  it('D1: an unused set is deleted at once', async () => {
    const lone = await sceneSet('Unused');
    const res = await auth(request(app).delete(`/api/v1/scene-sets/${lone}`));
    expect(res.status).toBe(200);
    expect(await isDeleted(lone)).toBe(true);
  });

  it('D2: a new set takes its show from the request, else a linked episode, else the universe\'s only show', async () => {
    const ep = await episode();
    const fromEpisode = await auth(request(app).post('/api/v1/scene-sets')).send({ name: 'd2-from-episode', scene_type: 'HOME_BASE', episode_ids: [ep] });
    expect(fromEpisode.status).toBe(201);
    expect(fromEpisode.body.data.show_id).toBe(show);
    const fromUniverse = await auth(request(app).post('/api/v1/scene-sets')).send({ name: 'd2-from-universe', scene_type: 'HOME_BASE', universe_id: universe });
    expect(fromUniverse.body.data.show_id).toBe(show);
    const explicit = await auth(request(app).post('/api/v1/scene-sets')).send({ name: 'd2-explicit', scene_type: 'HOME_BASE', show_id: show });
    expect(explicit.body.data.show_id).toBe(show);
    expect(await resolveSetShowId(sequelize, {})).toBeNull();
  });

  // Evoni, 2026-10-02: "add a Show choice to an existing set's edit form in
  // Scene Sets, so I can give my three new sets ... this show."
  it('D2: an existing set\'s show can be set, changed to another real show, or cleared', async () => {
    const loose = await sceneSet('d2-no-show', { showId: null });
    const set = await auth(request(app).put(`/api/v1/scene-sets/${loose}`)).send({ show_id: show });
    expect(set.status).toBe(200);
    expect((await rows('SELECT show_id FROM scene_sets WHERE id = :loose', { loose }))[0].show_id).toBe(show);
    const bad = await auth(request(app).put(`/api/v1/scene-sets/${loose}`)).send({ show_id: uuid() });
    expect(bad.status).toBe(400);
    expect((await rows('SELECT show_id FROM scene_sets WHERE id = :loose', { loose }))[0].show_id).toBe(show);
    const cleared = await auth(request(app).put(`/api/v1/scene-sets/${loose}`)).send({ show_id: '' });
    expect(cleared.status).toBe(200);
    expect((await rows('SELECT show_id FROM scene_sets WHERE id = :loose', { loose }))[0].show_id).toBeNull();
  });

  it('D2: "Move my beats to…": an episode lists the removed sets it uses, and moves each to its chosen replacement', async () => {
    const goneA = await sceneSet("Lala's Closet", { deleted: true });
    const goneB = await sceneSet("Lala's Room", { deleted: true });
    const newA = await sceneSet("lala's closet");
    const newB = await sceneSet("Lala's bedroom");
    const ep = await episode();
    await useEverywhere(goneA, ep);
    await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, locked, chosen_by_user, sort_order, ai_suggested, created_at, updated_at)
               VALUES (:id, :ep, 13, 'Beat 13', :setId, false, true, 13, false, NOW(), NOW())`, { id: uuid(), ep, setId: goneB });

    const list = await auth(request(app).get(`/api/v1/episodes/${ep}/removed-sets`));
    expect(list.status).toBe(200);
    expect(list.body.data.map((s) => [s.name, s.beats])).toEqual([["Lala's Closet", [1, 2]], ["Lala's Room", [13]]]);

    const refused = await auth(request(app).post(`/api/v1/episodes/${ep}/move-removed-sets`)).send({ moves: [{ from: goneA, to: goneB }] });
    expect(refused.status).toBe(400);
    const res = await auth(request(app).post(`/api/v1/episodes/${ep}/move-removed-sets`)).send({ moves: [{ from: goneA, to: newA }, { from: goneB, to: newB }] });
    expect(res.status).toBe(200);
    expect((await rows('SELECT beat_number, scene_set_id FROM scene_plans WHERE episode_id = :ep ORDER BY beat_number', { ep })).map((r) => [r.beat_number, r.scene_set_id]))
      .toEqual([[1, newA], [2, newA], [13, newB]]);
    expect(await usesOf(newA)).toMatchObject({ locations: 1, events: 1, scenes: 2 });
    expect((await auth(request(app).get(`/api/v1/episodes/${ep}/removed-sets`))).body.data).toEqual([]);
  });

  // Bug (Evoni, 2026-10-02, production): "Move my beats" returned 500. An
  // episode has one live location per set (scene_set_episodes_unique_pair),
  // and the move only dropped the old location when the episode already had
  // the replacement in the same role.
  const locationsOf = async (ep) => (await rows(
    'SELECT scene_set_id, role FROM scene_set_episodes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY role NULLS LAST', { ep }));
  const location = (setId, ep, role) => run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, sort_order, created_at, updated_at)
               VALUES (:id, :setId, :ep, :role, 1, NOW(), NOW())`, { id: uuid(), setId, ep, role });

  it('Move my beats: the replacement is already a location of the episode in another role, or has none', async () => {
    const gone = await sceneSet("d2-Lala's Room", { deleted: true });
    const replacement = await sceneSet("d2-Lala's bedroom");
    const ep = await episode();
    await useEverywhere(gone, ep); // a 'home' location, beats 1-2, their scenes, the event
    await location(replacement, ep, null);

    const res = await auth(request(app).post(`/api/v1/episodes/${ep}/move-removed-sets`)).send({ moves: [{ from: gone, to: replacement }] });

    expect(res.status).toBe(200);
    expect(await locationsOf(ep)).toEqual([{ scene_set_id: replacement, role: 'home' }]);
    expect(await usesOf(replacement)).toMatchObject({ beats: 2, scenes: 2, events: 1 });
  });

  it('Move my beats: two removed sets moved to the same replacement', async () => {
    const goneA = await sceneSet("d2-Lala's Closet", { deleted: true });
    const goneB = await sceneSet("d2-Lala's Home", { deleted: true });
    const replacement = await sceneSet("d2-Lala's home");
    const ep = await episode();
    await useEverywhere(goneA, ep);
    await location(goneB, ep, 'closet');

    const res = await auth(request(app).post(`/api/v1/episodes/${ep}/move-removed-sets`))
      .send({ moves: [{ from: goneA, to: replacement }, { from: goneB, to: replacement }] });

    expect(res.status).toBe(200);
    expect(await locationsOf(ep)).toEqual([{ scene_set_id: replacement, role: 'home' }]);
    expect((await auth(request(app).get(`/api/v1/episodes/${ep}/removed-sets`))).body.data).toEqual([]);
  });

  it('D1: deleting with a replacement the episode already has merges the two links, keeping the more specific role', async () => {
    const old = await sceneSet('d2-old set');
    const replacement = await sceneSet('d2-new set');
    const ep = await episode();
    await useEverywhere(old, ep); // 'home'
    await location(replacement, ep, 'extra');

    const res = await auth(request(app).delete(`/api/v1/scene-sets/${old}?replacement_id=${replacement}`));

    expect(res.status).toBe(200);
    expect(await locationsOf(ep)).toEqual([{ scene_set_id: replacement, role: 'home' }]);
    expect(await usesOf(replacement)).toMatchObject({ beats: 2, scenes: 2, events: 1 });
  });

  it('merging links: a named role is kept over an extra, an extra over none, and an extra keeps its name', async () => {
    const goneA = await sceneSet('d2-gone extra', { deleted: true });
    const goneB = await sceneSet('d2-gone named extra', { deleted: true });
    const keepHome = await sceneSet('d2-keep home');
    const keepNone = await sceneSet('d2-keep none');
    const ep = await episode();
    await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, role_name, sort_order, created_at, updated_at)
               VALUES (:a, :goneA, :ep, 'extra', 'Car', 1, NOW(), NOW()), (:b, :goneB, :ep, 'extra', 'Café', 2, NOW(), NOW()),
                      (:c, :keepHome, :ep, 'home', NULL, 3, NOW(), NOW()), (:d, :keepNone, :ep, NULL, NULL, 4, NOW(), NOW())`,
    { a: uuid(), b: uuid(), c: uuid(), d: uuid(), goneA, goneB, keepHome, keepNone, ep });

    const res = await auth(request(app).post(`/api/v1/episodes/${ep}/move-removed-sets`))
      .send({ moves: [{ from: goneA, to: keepHome }, { from: goneB, to: keepNone }] });

    expect(res.status).toBe(200);
    expect(await rows(`SELECT scene_set_id, role, role_name FROM scene_set_episodes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY sort_order`, { ep }))
      .toEqual([{ scene_set_id: keepHome, role: 'home', role_name: null }, { scene_set_id: keepNone, role: 'extra', role_name: 'Café' }]);
  });
});

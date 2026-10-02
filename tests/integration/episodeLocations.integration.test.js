/**
 * Episode Locations, L(a) (Evoni's rulings L3 and L6, 2026-10-02, with her
 * answers Q12–Q16; docs/EVENT_EPISODE_FLOW.md §8(hh)):
 * - the show's saved home and closet sets (Q12);
 * - the step's proposal: the defaults and the event's set, asking for what
 *   has no default;
 * - Start Episode with the locations chosen, each with a role, extras with
 *   free names (Q15), refused before anything is created when invalid;
 * - changing them while the episode is a draft, beats following a changed
 *   role (Q16), locked once accepted;
 * - the roles migration's backfill of existing links.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const junctionMigration = require('../../src/migrations/20260324000000-add-scene-sets-cover-and-episodes');
const sortOrderMigration = require('../../src/migrations/20260626000001-add-sort-order-to-scene-set-episodes');
const rolesMigration = require('../../src/migrations/20261002100000-add-scene-set-episode-roles');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Episode Locations (§8(hh) L3, L6)', () => {
  const show = uuid(); const other = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const sets = {};
  async function sceneSet(key, type, showId = show) {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, created_at, updated_at)
               VALUES (:id, :name, :type, :showId, NOW(), NOW())`, { id, name: key, type, showId });
    sets[key] = id;
    return id;
  }
  async function readyEvent(sceneSetId) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, scene_set_id, created_at, updated_at)
               VALUES (:id, :show, 'Gala', 'invite', 'ready', 5, :sceneSetId, NOW(), NOW())`, { id, show, sceneSetId });
    return id;
  }
  const start = (eventId, body) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/generate-episode`)).send({ draft_script: false, ...body });
  const links = (ep) => rows(`SELECT scene_set_id, role, role_name, sort_order FROM scene_set_episodes
                                WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY sort_order`, { ep });

  beforeAll(async () => {
    const qi = sequelize.getQueryInterface();
    for (const m of [junctionMigration, sortOrderMigration, rolesMigration]) await m.up(qi, Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-locations', email: 'user@locations.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const id of [show, other]) {
      await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
        { id, name: `Loc ${id.slice(0, 8)}`, slug: `loc-${id.slice(0, 8)}` });
    }
    await models.CharacterState.create({ show_id: show, character_key: 'lala', coins: 1000, reputation: 3 });
    await sceneSet('apartment', 'HOME_BASE');
    await sceneSet('newHome', 'HOME_BASE');
    await sceneSet('closet', 'CLOSET');
    await sceneSet('glasshouse', 'EVENT_LOCATION');
    await sceneSet('car', 'TRANSITION');
    await sceneSet('cafe', 'OTHER');
    await sceneSet('othersHome', 'HOME_BASE', other);
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const shows = [show, other];
    const q = (sql) => sequelize.query(sql, { replacements: { shows } }).catch(() => {});
    for (const t of ['scene_plans', 'scene_set_episodes', 'episode_spending_lines', 'episode_briefs', 'episode_todo_lists']) {
      await q(`DELETE FROM ${t} WHERE episode_id IN (SELECT id FROM episodes WHERE show_id IN (:shows))`);
    }
    for (const t of ['feed_posts', 'financial_transactions', 'character_state_history', 'character_state']) {
      await q(`DELETE FROM ${t} WHERE show_id IN (:shows)`);
    }
    await q('UPDATE world_events SET used_in_episode_id = NULL, scene_set_id = NULL WHERE show_id IN (:shows)');
    await q('DELETE FROM episodes WHERE show_id IN (:shows)');
    await q('DELETE FROM world_events WHERE show_id IN (:shows)');
    await q('DELETE FROM scene_sets WHERE show_id IN (:shows)');
    await q('DELETE FROM shows WHERE id IN (:shows)');
    await sequelize.close();
  });

  it('saves the show\'s home and closet defaults; another show\'s set is refused (Q12)', async () => {
    const put = (body) => auth(request(app).put(`/api/v1/shows/${show}/scene-defaults`)).send(body);

    expect((await put({ home_set_id: sets.othersHome })).status).toBe(400);
    const res = await put({ home_set_id: sets.apartment });

    expect(res.body.scene_defaults).toEqual({ home_set_id: sets.apartment, closet_set_id: null });
    const got = await auth(request(app).get(`/api/v1/shows/${show}/scene-defaults`));
    expect(got.body.scene_defaults).toEqual({ home_set_id: sets.apartment, closet_set_id: null });
  });

  it('proposes the defaults and the event\'s set, and asks for what has no default (L3, Q12)', async () => {
    const event = await readyEvent(sets.glasshouse);

    const res = await auth(request(app).get(`/api/v1/world/${show}/events/${event}/episode-locations`));

    expect(res.status).toBe(200);
    expect(res.body.data.locations.map((l) => [l.role, l.scene_set_id])).toEqual([['event', sets.glasshouse], ['home', sets.apartment]]);
    expect(res.body.data.missing).toEqual(['closet']);
  });

  it('starts the episode with the locations chosen, each with its role (L3, L6, Q15)', async () => {
    const event = await readyEvent(sets.glasshouse);

    const res = await start(event, { locations: [
      { role: 'extra', scene_set_id: sets.car, name: 'Car' },
      { role: 'home', scene_set_id: sets.newHome },
      { role: 'event', scene_set_id: sets.glasshouse },
      { role: 'closet', scene_set_id: sets.closet },
      { role: 'extra', scene_set_id: sets.cafe, name: 'Café' },
    ] });

    expect(res.status).toBe(201);
    const ep = res.body.data.episode.id;
    expect(await links(ep)).toEqual([
      { scene_set_id: sets.glasshouse, role: 'event', role_name: null, sort_order: 0 },
      { scene_set_id: sets.newHome, role: 'home', role_name: null, sort_order: 1 },
      { scene_set_id: sets.closet, role: 'closet', role_name: null, sort_order: 2 },
      { scene_set_id: sets.car, role: 'extra', role_name: 'Car', sort_order: 3 },
      { scene_set_id: sets.cafe, role: 'extra', role_name: 'Café', sort_order: 4 },
    ]);
    // The home beats are on the home chosen, not the default.
    const [beat1] = await rows('SELECT scene_set_id FROM scene_plans WHERE episode_id = :ep AND beat_number = 1', { ep });
    expect(beat1.scene_set_id).toBe(sets.newHome);
    const [beat11] = await rows('SELECT scene_set_id FROM scene_plans WHERE episode_id = :ep AND beat_number = 11', { ep });
    expect(beat11.scene_set_id).toBe(sets.glasshouse);
  });

  it('refuses invalid locations before anything is created', async () => {
    const event = await readyEvent(sets.glasshouse);

    const two = await start(event, { locations: [{ role: 'home', scene_set_id: sets.apartment }, { role: 'home', scene_set_id: sets.newHome }] });
    const foreign = await start(event, { locations: [{ role: 'home', scene_set_id: sets.othersHome }] });
    const unnamed = await start(event, { locations: [{ role: 'extra', scene_set_id: sets.car }] });

    expect([two.status, foreign.status, unnamed.status]).toEqual([400, 400, 400]);
    expect(two.body.error).toMatch(/one home/);
    const [ev] = await rows('SELECT used_in_episode_id FROM world_events WHERE id = :event', { event });
    expect(ev.used_in_episode_id).toBeNull();
  });

  it('changes them while the episode is a draft: a changed home takes its unlocked beats; accepted locks them (L6, Q16)', async () => {
    const event = await readyEvent(sets.glasshouse);
    const ep = (await start(event, {})).body.data.episode.id; // no locations: the defaults
    expect((await links(ep)).map((l) => [l.role, l.scene_set_id])).toEqual([['event', sets.glasshouse], ['home', sets.apartment]]);
    await run('UPDATE scene_plans SET locked = true WHERE episode_id = :ep AND beat_number = 1', { ep });

    const put = (locations) => auth(request(app).put(`/api/v1/episodes/${ep}/locations`)).send({ locations });
    const res = await put([
      { role: 'event', scene_set_id: sets.glasshouse },
      { role: 'home', scene_set_id: sets.newHome },
      { role: 'extra', scene_set_id: sets.cafe, name: 'Café' },
    ]);

    expect(res.body.error).toBeUndefined();
    expect(res.status).toBe(200);
    expect(res.body.data.locations.map((l) => [l.role, l.scene_set_id, l.name])).toEqual([
      ['event', sets.glasshouse, null], ['home', sets.newHome, null], ['extra', sets.cafe, 'Café'],
    ]);
    const plan = await rows('SELECT beat_number, scene_set_id FROM scene_plans WHERE episode_id = :ep AND beat_number IN (1, 2) ORDER BY beat_number', { ep });
    expect(plan).toEqual([{ beat_number: 1, scene_set_id: sets.apartment }, { beat_number: 2, scene_set_id: sets.newHome }]);
    const got = await auth(request(app).get(`/api/v1/episodes/${ep}/locations`));
    expect(got.body.data.editable).toBe(true);

    await run("UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep", { ep });
    const late = await put([{ role: 'home', scene_set_id: sets.apartment }]);
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('EPISODE_ACCEPTED');
  });

  it('the migration gives existing links their roles: the event\'s set, the first home, the first closet, the rest as named extras', async () => {
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Old', 9, 'draft', NOW(), NOW())`, { ep, show });
    const event = await readyEvent(sets.glasshouse);
    await run('UPDATE world_events SET used_in_episode_id = :ep WHERE id = :event', { ep, event });
    const link = (setId, order) => run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, sort_order, created_at, updated_at)
                                         VALUES (gen_random_uuid(), :setId, :ep, :order, NOW(), NOW())`, { setId, ep, order });
    await link(sets.apartment, 0); await link(sets.glasshouse, 1); await link(sets.newHome, 2); await link(sets.closet, 3); await link(sets.car, 4);

    await rolesMigration.up(sequelize.getQueryInterface(), Sequelize);

    const got = await rows(`SELECT scene_set_id, role, role_name FROM scene_set_episodes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY sort_order`, { ep });
    expect(got).toEqual([
      { scene_set_id: sets.apartment, role: 'home', role_name: null },
      { scene_set_id: sets.glasshouse, role: 'event', role_name: null },
      { scene_set_id: sets.newHome, role: 'extra', role_name: 'newHome' },
      { scene_set_id: sets.closet, role: 'closet', role_name: null },
      { scene_set_id: sets.car, role: 'extra', role_name: 'car' },
    ]);
  });
});

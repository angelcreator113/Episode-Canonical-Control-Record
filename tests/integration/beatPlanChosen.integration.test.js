/**
 * L11 (Evoni, 2026-10-02, docs/EVENT_EPISODE_FLOW.md §8(hh)): "any beat
 * can use any scene set in the show's library ... choosing a set not yet
 * linked to the episode adds it to the episode's locations as an extra (or
 * the matching role if that role is empty). A beat whose set or angle
 * Evoni chose is marked 'Chosen by you' and is never replaced by a re-plan
 * or by location changes, like a locked beat."
 * On the migrated database through the real routes; the AI client is mocked.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const junctionMigration = require('../../src/migrations/20260324000000-add-scene-sets-cover-and-episodes');
const sortOrderMigration = require('../../src/migrations/20260626000001-add-sort-order-to-scene-set-episodes');
const rolesMigration = require('../../src/migrations/20261002100000-add-scene-set-episode-roles');
const kindMigration = require('../../src/migrations/20261002120000-add-scene-angle-kind');
const chosenMigration = require('../../src/migrations/20261002140000-add-scene-plan-chosen-by-user');
const { generateScenePlan } = require('../../src/services/scenePlannerService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Beat Plan: any set, Chosen by you (§8(hh) L11)', () => {
  const show = uuid(); const other = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const sets = {};
  async function sceneSet(key, type, showId = show) {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, generation_status, created_at, updated_at)
               VALUES (:id, :key, :type, :showId, 'complete', NOW(), NOW())`, { id, key, type, showId });
    sets[key] = id;
    return id;
  }
  async function episode({ accepted = false } = {}) {
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:ep, :show, 'Gala ep', :n, 'draft', :ev, NOW(), NOW())`,
    { ep, show, n: Math.floor(Math.random() * 100000) + 200, ev: accepted ? 'accepted' : 'pending' });
    const link = (setId, role, order) => run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, sort_order, created_at, updated_at)
                                              VALUES (gen_random_uuid(), :setId, :ep, :role, :order, NOW(), NOW())`, { setId, ep, role, order });
    await link(sets.apartment, 'home', 0);
    await link(sets.glasshouse, 'event', 1);
    for (let b = 1; b <= 14; b += 1) {
      const setId = b >= 10 && b <= 12 ? sets.glasshouse : sets.apartment;
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, sort_order, locked, ai_suggested, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, :b, :name, :setId, :b, false, true, NOW(), NOW())`, { ep, b, name: `Beat ${b}`, setId });
    }
    return ep;
  }
  const put = (ep, beat, body) => auth(request(app).put(`/api/v1/episode-brief/${ep}/plan/${beat}`)).send(body);
  const beatRow = async (ep, b) => (await rows('SELECT scene_set_id, angle_label, chosen_by_user FROM scene_plans WHERE episode_id = :ep AND beat_number = :b', { ep, b }))[0];
  const linksOf = (ep) => rows(`SELECT scene_set_id, role, role_name FROM scene_set_episodes
                                 WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY sort_order`, { ep });

  beforeAll(async () => {
    const qi = sequelize.getQueryInterface();
    for (const m of [junctionMigration, sortOrderMigration, rolesMigration, kindMigration, chosenMigration]) await m.up(qi, Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-beat-plan', email: 'user@beatplan.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const id of [show, other]) {
      await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
        { id, name: `BP ${id.slice(0, 8)}`, slug: `bp-${id.slice(0, 8)}` });
    }
    await sceneSet('apartment', 'HOME_BASE');
    await sceneSet('glasshouse', 'EVENT_LOCATION');
    await sceneSet('walkin', 'CLOSET');
    await sceneSet('cafe', 'OTHER');
    await sceneSet('loft', 'HOME_BASE');
    await sceneSet('shared', 'OTHER', null);
    await sceneSet('foreign', 'OTHER', other);
  });
  beforeEach(() => {
    mockCreate.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('the migration is re-runnable and adds chosen_by_user, false by default', async () => {
    await chosenMigration.up(sequelize.getQueryInterface());
    const [col] = await rows(`SELECT data_type, column_default FROM information_schema.columns
                               WHERE table_name = 'scene_plans' AND column_name = 'chosen_by_user'`);
    expect(col.data_type).toBe('boolean');
    expect(col.column_default).toBe('false');
  });

  it('a set not yet linked joins the locations: its type\'s role when empty, else an extra named after it', async () => {
    const ep = await episode();
    const closet = await put(ep, 8, { scene_set_id: sets.walkin, chosen: true });
    expect(closet.status).toBe(200);
    expect(closet.body.location).toEqual({ added: true, role: 'closet', name: null });

    const loft = await put(ep, 3, { scene_set_id: sets.loft, chosen: true });
    expect(loft.body.location).toEqual({ added: true, role: 'extra', name: 'loft' });

    const cafe = await put(ep, 4, { scene_set_id: sets.cafe, chosen: true });
    expect(cafe.body.location).toEqual({ added: true, role: 'extra', name: 'cafe' });

    const shared = await put(ep, 5, { scene_set_id: sets.shared, chosen: true });
    expect(shared.body.location.added).toBe(true);

    const again = await put(ep, 6, { scene_set_id: sets.cafe, chosen: true });
    expect(again.body.location).toEqual({ added: false, role: 'extra', name: null });

    expect((await linksOf(ep)).map((l) => [l.role, l.role_name])).toEqual([
      ['home', null], ['event', null], ['closet', null], ['extra', 'loft'], ['extra', 'cafe'], ['extra', 'shared'],
    ]);
    expect(await beatRow(ep, 8)).toMatchObject({ scene_set_id: sets.walkin, chosen_by_user: true });
  });

  it("another show's set is refused, and an accepted episode's locations stay locked", async () => {
    const ep = await episode();
    const foreign = await put(ep, 3, { scene_set_id: sets.foreign, chosen: true });
    expect(foreign.status).toBe(400);
    expect(await beatRow(ep, 3)).toMatchObject({ scene_set_id: sets.apartment, chosen_by_user: false });

    const accepted = await episode({ accepted: true });
    const refused = await put(accepted, 3, { scene_set_id: sets.cafe, chosen: true });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('EPISODE_ACCEPTED');
    // A set already linked can still be chosen.
    expect((await put(accepted, 3, { scene_set_id: sets.glasshouse, chosen: true })).status).toBe(200);
  });

  it('only a set or angle chosen in the editor marks the beat; other edits do not; chosen: false hands it back', async () => {
    const ep = await episode();
    await put(ep, 2, { emotional_intent: 'Quiet', chosen: true });
    expect((await beatRow(ep, 2)).chosen_by_user).toBe(false);
    await put(ep, 10, { angle_label: 'DOORWAY' });
    expect((await beatRow(ep, 10)).chosen_by_user).toBe(false);
    await put(ep, 11, { angle_label: 'WIDE', chosen: true });
    expect((await beatRow(ep, 11)).chosen_by_user).toBe(true);
    await put(ep, 11, { chosen: false });
    expect((await beatRow(ep, 11)).chosen_by_user).toBe(false);
  });

  it('a re-plan keeps a chosen beat as Evoni chose it', async () => {
    const ep = await episode();
    await put(ep, 4, { scene_set_id: sets.cafe, angle_label: 'CLOSE', chosen: true });
    mockCreate.mockResolvedValue({ content: [{ text: JSON.stringify(Array.from({ length: 14 }, (_, i) => ({
      beat_number: i + 1, scene_set_id: sets.glasshouse, angle_label: 'WIDE', shot_type: 'medium', emotional_intent: 'x', transition_in: 'cut',
    }))) }] });
    const out = await generateScenePlan(ep, show, {}, { save: true });
    expect(out.find((b) => b.beat_number === 4)).toMatchObject({ scene_set_id: sets.cafe, angle_label: 'CLOSE', chosen_by_user: true, locked: false });
    expect(await beatRow(ep, 4)).toMatchObject({ scene_set_id: sets.cafe, angle_label: 'CLOSE', chosen_by_user: true });
    expect((await rows('SELECT COUNT(*)::int AS n FROM scene_plans WHERE episode_id = :ep AND deleted_at IS NULL', { ep }))[0].n).toBe(14);
  });

  it("a location change moves the plan's beats but never a chosen one", async () => {
    const ep = await episode();
    await put(ep, 1, { scene_set_id: sets.apartment, chosen: true });
    const res = await auth(request(app).put(`/api/v1/episodes/${ep}/locations`)).send({ locations: [
      { role: 'home', scene_set_id: sets.loft }, { role: 'event', scene_set_id: sets.glasshouse },
    ] });
    expect(res.status).toBe(200);
    expect((await beatRow(ep, 1)).scene_set_id).toBe(sets.apartment);
    expect((await beatRow(ep, 2)).scene_set_id).toBe(sets.loft);
  });
});

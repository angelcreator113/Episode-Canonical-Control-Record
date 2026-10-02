/**
 * Each beat's scene row, L12a (Evoni, 2026-10-02, docs/EVENT_EPISODE_FLOW.md
 * §8(hh)): "every beat with a set and angle gets its scene row
 * automatically (scene_plan_id link, background = the beat's angle image,
 * the dressed one after L10, scene number from the beat's position,
 * default 5s), created or updated whenever the beat changes; the
 * Timeline's save updates rows in place ...; existing untied scenes show
 * once under 'Older scenes' until removed."
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
const venueLookMigration = require('../../src/migrations/20261002110000-add-world-events-venue-look');
const kindMigration = require('../../src/migrations/20261002120000-add-scene-angle-kind');
const looksMigration = require('../../src/migrations/20261002130000-create-scene-set-looks');
const chosenMigration = require('../../src/migrations/20261002140000-add-scene-plan-chosen-by-user');
const lookAnglesMigration = require('../../src/migrations/20261002150000-create-scene-set-look-angles');
const planIdMigration = require('../../src/migrations/20261002160000-add-scenes-scene-plan-id');
const { generateScenePlan } = require('../../src/services/scenePlannerService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)("Each beat's scene row (§8(hh) L12a)", () => {
  const show = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const sets = {};

  /** An episode: home (apartment) and event (glasshouse) linked; beats 1-3 at home, 10-11 at the venue, 14 with no set. */
  async function episode() {
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Scenes ep', :n, 'draft', NOW(), NOW())`, { ep, show, n: Math.floor(Math.random() * 100000) + 500 });
    await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, sort_order, created_at, updated_at)
               VALUES (gen_random_uuid(), :home, :ep, 'home', 0, NOW(), NOW()), (gen_random_uuid(), :venue, :ep, 'event', 1, NOW(), NOW())`,
    { home: sets.apartment, venue: sets.glasshouse, ep });
    for (const [b, setId, label] of [[1, sets.apartment, null], [2, sets.apartment, 'VANITY'], [3, sets.apartment, null],
      [10, sets.glasshouse, 'DOORWAY'], [11, sets.glasshouse, 'WIDE'], [14, null, null]]) {
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, sort_order, locked, ai_suggested, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, :b, :name, :setId, :label, :b, false, true, NOW(), NOW())`,
      { ep, b, name: `Beat ${b}`, setId, label });
    }
    return ep;
  }
  const scenesOf = (ep) => rows(`SELECT id, scene_plan_id, scene_number, title, background_url, scene_set_id, scene_angle_id, duration_seconds, characters
                                   FROM scenes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY scene_number`, { ep });
  const plan = async (ep) => (await auth(request(app).get(`/api/v1/episode-brief/${ep}/plan`))).body;
  const planId = async (ep, b) => (await rows('SELECT id FROM scene_plans WHERE episode_id = :ep AND beat_number = :b AND deleted_at IS NULL', { ep, b }))[0].id;

  beforeAll(async () => {
    const qi = sequelize.getQueryInterface();
    for (const m of [junctionMigration, sortOrderMigration, rolesMigration, venueLookMigration, kindMigration, looksMigration, chosenMigration, lookAnglesMigration, planIdMigration]) {
      await m.up(qi, Sequelize);
    }
    token = TokenService.generateTokenPair({
      id: 'test-user-beat-scenes', email: 'user@beatscenes.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `Beat scenes ${show.slice(0, 8)}`, slug: `beat-scenes-${show.slice(0, 8)}` });
    for (const [key, type, base] of [['apartment', 'HOME_BASE', 'https://x/apartment.jpg'], ['glasshouse', 'EVENT_LOCATION', 'https://x/glasshouse.jpg'], ['cafe', 'OTHER', 'https://x/cafe.jpg']]) {
      sets[key] = uuid();
      await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, base_still_url, generation_status, created_at, updated_at)
                 VALUES (:id, :key, :type, :show, :base, 'complete', NOW(), NOW())`, { id: sets[key], key, type, show, base });
    }
    sets.vanity = uuid(); sets.doorway = uuid(); sets.wide = uuid();
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_label, angle_name, angle_kind, still_image_url, generation_status, created_at, updated_at)
               VALUES (:vanity, :apartment, 'VANITY', 'Vanity', NULL, 'https://x/vanity.jpg', 'complete', NOW(), NOW()),
                      (:doorway, :glasshouse, 'DOORWAY', 'Entrance', 'entrance', NULL, 'pending', NOW(), NOW()),
                      (:wide, :glasshouse, 'WIDE', 'Main hall', 'main_interior', 'https://x/wide.jpg', 'complete', NOW(), NOW())`,
    { vanity: sets.vanity, doorway: sets.doorway, wide: sets.wide, apartment: sets.apartment, glasshouse: sets.glasshouse });
  });
  beforeEach(() => {
    mockCreate.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('the migration is re-runnable and keeps one live scene per beat', async () => {
    await planIdMigration.up(sequelize.getQueryInterface());
    const [index] = await rows(`SELECT indexdef FROM pg_indexes WHERE indexname = 'scenes_unique_scene_plan'`);
    expect(index.indexdef).toMatch(/UNIQUE.*\(scene_plan_id\).*deleted_at IS NULL/);
  });

  it('reading the plan gives every beat with a set its scene: beat number, angle image (else the base), 5s; a beat with no set has none', async () => {
    const ep = await episode();
    const body = await plan(ep);
    const scenes = await scenesOf(ep);
    expect(scenes.map((s) => [s.scene_number, s.background_url, s.scene_angle_id])).toEqual([
      [1, 'https://x/apartment.jpg', null],
      [2, 'https://x/vanity.jpg', sets.vanity],
      [3, 'https://x/apartment.jpg', null],
      [10, null, sets.doorway], // the entrance angle has no image yet
      [11, 'https://x/wide.jpg', sets.wide],
    ]);
    expect(scenes.every((s) => Number(s.duration_seconds) === 5)).toBe(true);
    expect(scenes[1].title).toBe('Beat 2');
    const beat2 = body.data.find((b) => b.beat_number === 2);
    expect(beat2.scene_id).toBe(scenes[1].id);
    expect(body.data.find((b) => b.beat_number === 14).scene_id).toBeNull();

    // Reading again changes nothing.
    await plan(ep);
    expect((await scenesOf(ep)).map((s) => s.id)).toEqual(scenes.map((s) => s.id));
  });

  it("a beat's change reaches its scene; the Timeline's edits stay", async () => {
    const ep = await episode();
    await plan(ep);
    const [s1] = await scenesOf(ep);
    const saved = await auth(request(app).post(`/api/v1/episodes/${ep}/save`)).send({ scenes: (await scenesOf(ep)).map((s) => ({
      id: s.id, scene_number: s.scene_number, title: s.title, duration_seconds: s.id === s1.id ? 9 : 5,
      characters: s.id === s1.id ? [{ id: 'lala' }] : [], scene_set_id: s.scene_set_id, scene_angle_id: s.scene_angle_id, background_url: s.background_url,
    })) });
    expect(saved.status).toBe(200);

    const put = await auth(request(app).put(`/api/v1/episode-brief/${ep}/plan/1`)).send({ scene_set_id: sets.cafe, chosen: true });
    expect(put.status).toBe(200);
    const [after] = await scenesOf(ep);
    expect(after).toMatchObject({ id: s1.id, scene_set_id: sets.cafe, background_url: 'https://x/cafe.jpg', characters: [{ id: 'lala' }] });
    expect(Number(after.duration_seconds)).toBe(9);
  });

  it("the Timeline's save never removes a beat's scene, and an older scene stays untied", async () => {
    const ep = await episode();
    const older = uuid();
    const tied = uuid();
    await run(`INSERT INTO scenes (id, episode_id, scene_number, title, created_at, updated_at) VALUES (:older, :ep, 1, 'Old scene', NOW(), NOW())`, { older, ep });
    await run(`INSERT INTO scenes (id, episode_id, scene_plan_id, scene_number, title, created_at, updated_at)
               VALUES (:tied, :ep, :plan, 2, 'Beat 2', NOW(), NOW())`, { tied, ep, plan: await planId(ep, 2) });
    const before = await scenesOf(ep);
    expect(before.map((s) => s.id)).toEqual(expect.arrayContaining([older, tied]));
    await auth(request(app).post(`/api/v1/episodes/${ep}/save`)).send({ scenes: [{ id: older, scene_number: 1, title: 'Old scene' }] });
    expect((await scenesOf(ep)).map((s) => s.id).sort()).toEqual(before.map((s) => s.id).sort());
    expect((await rows('SELECT scene_plan_id FROM scenes WHERE id = :older', { older }))[0].scene_plan_id).toBeNull();
  });

  it('the Timeline (GET /episodes/:id/scenes) loads the beats\' scenes, and a finished image reaches its scene there', async () => {
    const ep = await episode();
    let res = await auth(request(app).get(`/api/v1/episodes/${ep}/scenes`));
    expect(res.status).toBe(200);
    const list = res.body.data || res.body.scenes || [];
    expect(list.map((s) => s.scene_number)).toEqual([1, 2, 3, 10, 11]);

    await run(`UPDATE scene_angles SET still_image_url = 'https://x/doorway.jpg', generation_status = 'complete' WHERE id = :d`, { d: sets.doorway });
    res = await auth(request(app).get(`/api/v1/episodes/${ep}/scenes`));
    expect((res.body.data || res.body.scenes).find((s) => s.scene_number === 10).background_url).toBe('https://x/doorway.jpg');
    await run(`UPDATE scene_angles SET still_image_url = NULL, generation_status = 'pending' WHERE id = :d`, { d: sets.doorway });
  });

  it("at the event's look, a beat's scene shows its dressed angle (L10)", async () => {
    const ep = await episode();
    const ev = uuid(); const look = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, scene_set_id, used_in_episode_id, created_at, updated_at)
               VALUES (:ev, :show, 'Gala', 'invite', 'used', 5, :venue, :ep, NOW(), NOW())`, { ev, show, venue: sets.glasshouse, ep });
    await run(`INSERT INTO scene_set_looks (id, scene_set_id, event_id, status, image_url, created_at, updated_at)
               VALUES (:look, :venue, :ev, 'complete', 'https://x/look.jpg', NOW(), NOW())`, { look, venue: sets.glasshouse, ev });
    await run(`INSERT INTO scene_set_look_angles (id, look_id, scene_angle_id, status, image_url, source, created_at, updated_at)
               VALUES (gen_random_uuid(), :look, :wide, 'complete', 'https://x/wide-dressed.jpg', 'generated', NOW(), NOW())`, { look, wide: sets.wide });
    await plan(ep);
    const scenes = await scenesOf(ep);
    expect(scenes.find((s) => s.scene_number === 11).background_url).toBe('https://x/wide-dressed.jpg');
    expect(scenes.find((s) => s.scene_number === 1).background_url).toBe('https://x/apartment.jpg');
  });

  it("a re-plan keeps each beat's scene and its Timeline edits; a beat losing its set loses its scene", async () => {
    const ep = await episode();
    await plan(ep);
    const before = await scenesOf(ep);
    await run(`UPDATE scenes SET duration_seconds = 12 WHERE id = :id`, { id: before[1].id });
    mockCreate.mockResolvedValue({ content: [{ text: JSON.stringify([1, 2, 3, 10, 11, 14].map((n) => ({
      beat_number: n, scene_set_id: n === 3 ? null : (n >= 10 ? sets.glasshouse : sets.apartment), angle_label: n === 2 ? 'VANITY' : null,
      shot_type: 'medium', emotional_intent: 'x', transition_in: 'cut',
    }))) }] });
    await generateScenePlan(ep, show, {}, { save: true });
    expect(await planId(ep, 2)).not.toBe(before[1].scene_plan_id);
    await plan(ep);
    const after = await scenesOf(ep);
    const two = after.find((s) => s.scene_number === 2);
    expect(two.id).toBe(before[1].id);
    expect(two.scene_plan_id).toBe(await planId(ep, 2));
    expect(Number(two.duration_seconds)).toBe(12);

    const one = after.find((s) => s.scene_number === 1);
    expect((await auth(request(app).put(`/api/v1/episode-brief/${ep}/plan/1`)).send({ scene_set_id: null })).status).toBe(200);
    expect((await scenesOf(ep)).find((s) => s.scene_number === 1)).toBeUndefined();
    expect((await rows('SELECT deleted_at FROM scenes WHERE id = :id', { id: one.id }))[0].deleted_at).not.toBeNull();
  });
});

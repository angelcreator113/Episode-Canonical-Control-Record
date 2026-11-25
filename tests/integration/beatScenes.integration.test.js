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
const lockTrace = require('../helpers/lockTrace');

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
  // The plan's read writes nothing (Evoni, 2026-11-22). These episodes are made
  // by SQL, not by Start Episode, so their scene rows are made the way Start
  // Episode, generate-plan and a beat's save make them: by the sync itself.
  const sync = (ep) => require('../../src/services/beatScenesService').syncBeatScenes(sequelize, ep);
  const planId = async (ep, b) => (await rows('SELECT id FROM scene_plans WHERE episode_id = :ep AND beat_number = :b AND deleted_at IS NULL', { ep, b }))[0].id;

  beforeAll(async () => {
    // The legacy save is closed unless the server opens it, and then only for an admin (audit 2026-11-03, A7).
    process.env.LEGACY_TIMELINE_WRITES = 'on';
    const qi = sequelize.getQueryInterface();
    for (const m of [junctionMigration, sortOrderMigration, rolesMigration, venueLookMigration, kindMigration, looksMigration, chosenMigration, lookAnglesMigration, planIdMigration]) {
      await m.up(qi, Sequelize);
    }
    token = TokenService.generateTokenPair({
      id: 'test-user-beat-scenes', email: 'user@beatscenes.dev', name: 'Editor', groups: ['ADMIN'], role: 'ADMIN',
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
                      (:doorway, :glasshouse, 'DOORWAY', 'Entrance', 'front', NULL, 'pending', NOW(), NOW()),
                      (:wide, :glasshouse, 'WIDE', 'Main hall', 'inside', 'https://x/wide.jpg', 'complete', NOW(), NOW())`,
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

  it('every beat with a set has its scene: beat number, angle image (else the base), 5s; a beat with no set has none; the plan reads their ids and writes nothing', async () => {
    const ep = await episode();
    // Before any sync the read makes no scene, and says none.
    const first = await plan(ep);
    expect(await scenesOf(ep)).toEqual([]);
    expect(first.data.every((b) => b.scene_id === null)).toBe(true);

    await sync(ep);
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

  it('the plan\'s read writes nothing, whoever reads it: no scene or plan row is made, changed or removed', async () => {
    const ep = await episode();
    const as = (groups) => TokenService.generateTokenPair({ id: `reader-${groups.join('-')}`, email: 'reader@beatscenes.dev', name: 'Reader', groups, role: groups[0] }).accessToken;
    // Every column of every scene and plan row of the episode, deleted ones too.
    const snapshot = async () => ({
      scenes: await rows('SELECT * FROM scenes WHERE episode_id = :ep ORDER BY id', { ep }),
      plans: await rows('SELECT * FROM scene_plans WHERE episode_id = :ep ORDER BY id', { ep }),
    });
    const read = (t) => request(app).get(`/api/v1/episode-brief/${ep}/plan`).set('Authorization', `Bearer ${t}`);

    // With no scene rows yet: none is made.
    let before = await snapshot();
    expect(before.scenes).toEqual([]);
    for (const groups of [['viewer'], ['USER', 'EDITOR'], ['ADMIN']]) {
      const res = await read(as(groups));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(6);
      expect(await snapshot()).toEqual(before);
    }

    // With scene rows that are out of date (a finished image, a beat that lost
    // its set): the read changes none of them and removes none.
    await sync(ep);
    await run(`UPDATE scene_angles SET still_image_url = 'https://x/doorway.jpg', generation_status = 'complete' WHERE id = :d`, { d: sets.doorway });
    await run('UPDATE scene_plans SET scene_set_id = NULL WHERE episode_id = :ep AND beat_number = 3', { ep });
    before = await snapshot();
    for (const groups of [['viewer'], ['USER', 'EDITOR'], ['ADMIN']]) {
      expect((await read(as(groups))).status).toBe(200);
      expect(await snapshot()).toEqual(before);
    }
    expect((await request(app).get(`/api/v1/episode-brief/${ep}/plan`)).status).toBe(401);
    expect(await snapshot()).toEqual(before);
    await run(`UPDATE scene_angles SET still_image_url = NULL, generation_status = 'pending' WHERE id = :d`, { d: sets.doorway });
  });

  it('the plan\'s own writes still bring the scenes up to date: POST generate-plan, and a beat\'s save', async () => {
    const ep = await episode();
    expect(await scenesOf(ep)).toEqual([]);
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, created_at, updated_at) VALUES (gen_random_uuid(), :ep, :show, NOW(), NOW())`, { ep, show });
    mockCreate.mockResolvedValue({ content: [{ text: JSON.stringify([1, 2, 3, 10, 11, 14].map((n) => ({
      beat_number: n, scene_set_id: n === 14 ? null : (n >= 10 ? sets.glasshouse : sets.apartment), angle_label: n === 2 ? 'VANITY' : null,
      shot_type: 'medium', emotional_intent: 'x', transition_in: 'cut',
    }))) }] });
    const made = await auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-plan`)).send({});
    expect(made.status).toBe(200);
    // Each beat the new plan gives a set has its scene, with no read in between
    // (the route's planner also places the closing beat, so it has one too).
    const scenes = await scenesOf(ep);
    const planned = await rows('SELECT beat_number FROM scene_plans WHERE episode_id = :ep AND deleted_at IS NULL AND scene_set_id IS NOT NULL ORDER BY beat_number', { ep });
    expect(scenes.map((s) => s.scene_number)).toEqual(planned.map((r) => r.beat_number));
    expect(scenes.map((s) => s.scene_number)).toEqual(expect.arrayContaining([1, 2, 3, 10, 11]));
    const body = await plan(ep);
    expect(body.data.find((b) => b.beat_number === 2).scene_id).toBe(scenes[1].id);

    // A beat's save moves its scene, again with no read. S1-A: the set and the
    // link follow the beat; the background it already had is left alone
    // (Scene Studio is authoritative), and the scene keeps its id.
    expect((await auth(request(app).put(`/api/v1/episode-brief/${ep}/plan/1`)).send({ scene_set_id: sets.cafe, chosen: true })).status).toBe(200);
    expect((await scenesOf(ep))[0]).toMatchObject({ id: scenes[0].id, scene_set_id: sets.cafe, background_url: 'https://x/apartment.jpg' });
    await run('DELETE FROM episode_briefs WHERE episode_id = :ep', { ep });
  });

  // Not table by table: every statement the request runs is recorded
  // (tests/helpers/lockTrace wraps sequelize.query, which model writes and
  // raw SQL both go through), and none may be a write. A write to a table
  // nobody thought to snapshot would show here.
  const WRITE = /^\s*(?:WITH\b[\s\S]*?\b)?(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|ALTER|CREATE|DROP)\b/i;
  async function statementsOf(send) {
    const trace = lockTrace.install(sequelize);
    try {
      const res = await send();
      return { res, records: [...trace.records] };
    } finally {
      trace.uninstall();
    }
  }
  const writesIn = (records) => records.filter((r) => ['write', 'insert', 'lock', 'begin'].includes(r.kind) || WRITE.test(r.sql || ''));

  it('every statement the plan\'s read and the dressed angles list run is a read, for a viewer, an editor and an admin', async () => {
    const ep = await episode();
    const as = (groups) => TokenService.generateTokenPair({ id: `stmt-${groups.join('-')}`, email: 'stmt@beatscenes.dev', name: 'Reader', groups, role: groups[0] }).accessToken;
    // An event with a look on the venue, one dressed angle done and one stuck
    // generating, scenes that are out of date, and a beat that lost its set:
    // every state in which these reads used to write.
    const ev = uuid(); const look = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, scene_set_id, used_in_episode_id, created_at, updated_at)
               VALUES (:ev, :show, 'Gala', 'invite', 'used', 5, :venue, :ep, NOW(), NOW())`, { ev, show, venue: sets.glasshouse, ep });
    await run(`INSERT INTO scene_set_looks (id, scene_set_id, event_id, status, image_url, created_at, updated_at)
               VALUES (:look, :venue, :ev, 'complete', 'https://x/look.jpg', NOW(), NOW())`, { look, venue: sets.glasshouse, ev });
    await run(`INSERT INTO scene_set_look_angles (id, look_id, scene_angle_id, status, image_url, source, created_at, updated_at)
               VALUES (gen_random_uuid(), :look, :wide, 'complete', 'https://x/wide-dressed.jpg', 'generated', NOW(), NOW()),
                      (gen_random_uuid(), :look, :door, 'generating', NULL, 'generated', NOW(), NOW() - INTERVAL '20 minutes')`, { look, wide: sets.wide, door: sets.doorway });
    await sync(ep);
    await run('UPDATE scene_plans SET scene_set_id = NULL WHERE episode_id = :ep AND beat_number = 3', { ep });
    await run(`UPDATE scenes SET background_url = 'https://x/stale.jpg' WHERE episode_id = :ep AND scene_number = 1`, { ep });

    const reads = [
      `/api/v1/episode-brief/${ep}/plan`,
      `/api/v1/episode-brief/${ep}/dressed-angles?scene_set_id=${sets.glasshouse}`,
    ];
    for (const path of reads) {
      for (const groups of [['viewer'], ['USER', 'EDITOR'], ['ADMIN']]) {
        const { res, records } = await statementsOf(() => request(app).get(path).set('Authorization', `Bearer ${as(groups)}`));
        expect([path, groups, res.status]).toEqual([path, groups, 200]);
        // The read did run queries (the recorder is on), and none wrote, locked a row or opened a transaction.
        expect(records.length).toBeGreaterThan(0);
        expect(writesIn(records).map((r) => r.sql || r.kind)).toEqual([]);
      }
    }
    // The recorder does see a write when there is one: a beat's save, through the same app.
    const saved = await statementsOf(() => auth(request(app).put(`/api/v1/episode-brief/${ep}/plan/1`)).send({ scene_set_id: sets.cafe, chosen: true }));
    expect(saved.res.status).toBe(200);
    expect(writesIn(saved.records).length).toBeGreaterThan(0);

    await run('DELETE FROM scene_set_look_angles WHERE look_id = :look', { look });
    await run('DELETE FROM scene_set_looks WHERE id = :look', { look });
    await run('DELETE FROM world_events WHERE id = :ev', { ev });
  });

  it("a beat's change reaches its scene; the Timeline's edits stay", async () => {
    const ep = await episode();
    await sync(ep);
    const [s1] = await scenesOf(ep);
    const saved = await auth(request(app).post(`/api/v1/episodes/${ep}/save`)).send({ scenes: (await scenesOf(ep)).map((s) => ({
      id: s.id, scene_number: s.scene_number, title: s.title, duration_seconds: s.id === s1.id ? 9 : 5,
      characters: s.id === s1.id ? [{ id: 'lala' }] : [], scene_set_id: s.scene_set_id, scene_angle_id: s.scene_angle_id, background_url: s.background_url,
    })) });
    expect(saved.status).toBe(200);

    const put = await auth(request(app).put(`/api/v1/episode-brief/${ep}/plan/1`)).send({ scene_set_id: sets.cafe, chosen: true });
    expect(put.status).toBe(200);
    const [after] = await scenesOf(ep);
    // S1-A: the set and the link move; the stored background does not (the
    // apartment's image was already there, and only Scene Studio replaces it).
    expect(after).toMatchObject({ id: s1.id, scene_set_id: sets.cafe, background_url: 'https://x/apartment.jpg', characters: [{ id: 'lala' }] });
    expect(Number(after.duration_seconds)).toBe(9);
    // Cleared by hand, the next save does fill it in from the beat's set.
    await run('UPDATE scenes SET background_url = NULL WHERE id = :id', { id: s1.id });
    expect((await auth(request(app).put(`/api/v1/episode-brief/${ep}/plan/1`)).send({ scene_set_id: sets.cafe, chosen: true })).status).toBe(200);
    expect((await scenesOf(ep))[0]).toMatchObject({ id: s1.id, background_url: 'https://x/cafe.jpg' });
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

  // S1-A (Evoni, 2026-11-25): GET /episodes/:id/scenes is a read and writes
  // nothing. It used to run the sync as middleware, which is how a read came
  // to soft-delete and recreate rows and lose their identity and child rows.
  // This test therefore makes the rows with the sync itself, exactly as Start
  // Episode, generate-plan and a beat's save do, and then checks that the
  // read lists them, writes nothing, and leaves every stored background as it
  // is — while the Scenes tab's beat card still shows the newest image,
  // because the beat card derives it at read time (planLocationsService).
  it('the Timeline (GET /episodes/:id/scenes) loads the beats\' scenes, writes nothing, and keeps every stored background', async () => {
    const ep = await episode();
    // Before any sync the read makes nothing: it is a read.
    const empty = await statementsOf(() => auth(request(app).get(`/api/v1/episodes/${ep}/scenes`)));
    expect(empty.res.status).toBe(200);
    expect(empty.records.length).toBeGreaterThan(0);
    expect(writesIn(empty.records).map((r) => r.sql || r.kind)).toEqual([]);
    expect(await scenesOf(ep)).toEqual([]);

    await sync(ep);
    const res = await auth(request(app).get(`/api/v1/episodes/${ep}/scenes`));
    expect(res.status).toBe(200);
    const list = res.body.data || res.body.scenes || [];
    expect(list.map((s) => s.scene_number)).toEqual([1, 2, 3, 10, 11]);
    // The entrance angle has no image yet, so beat 10's background is empty —
    // the NULL case this test has always guaranteed.
    expect(list.find((s) => s.scene_number === 10).background_url).toBeNull();
    const before = await scenesOf(ep);

    await run(`UPDATE scene_angles SET still_image_url = 'https://x/doorway.jpg', generation_status = 'complete' WHERE id = :d`, { d: sets.doorway });
    // The read does not write the finished image onto the row, and runs no
    // write of any kind, for a viewer, an editor or an admin.
    for (const groups of [['viewer'], ['USER', 'EDITOR'], ['ADMIN']]) {
      const token2 = TokenService.generateTokenPair({ id: `scenes-${groups.join('-')}`, email: 'scenes@beatscenes.dev', name: 'Reader', groups, role: groups[0] }).accessToken;
      const seen = await statementsOf(() => request(app).get(`/api/v1/episodes/${ep}/scenes`).set('Authorization', `Bearer ${token2}`));
      expect([groups, seen.res.status]).toEqual([groups, 200]);
      expect(seen.records.length).toBeGreaterThan(0);
      expect(writesIn(seen.records).map((r) => r.sql || r.kind)).toEqual([]);
    }
    expect(await scenesOf(ep)).toEqual(before);

    // The beat card shows the newest derived image all the same: the plan's
    // read resolves it from the angle, without writing it anywhere.
    const body = await plan(ep);
    const beat10 = body.data.find((b) => b.beat_number === 10);
    expect(JSON.stringify(beat10.location)).toContain('https://x/doorway.jpg');
    expect(beat10.scene_id).toBe(before.find((s) => Number(s.scene_number) === 10).id);

    // The sync is what moves it onto the row, and it only does so while the
    // stored background is empty: a non-null fallback and an operator's own
    // background are both kept, and no scene changes its id.
    await sync(ep);
    const filled = await scenesOf(ep);
    expect(filled.find((s) => Number(s.scene_number) === 10).background_url).toBe('https://x/doorway.jpg');
    expect(filled.map((s) => s.id)).toEqual(before.map((s) => s.id));
    // A non-null fallback (the set's base image on beat 1) survives a change
    // of angle image, and an operator's own background survives everything.
    await run(`UPDATE scenes SET background_url = 'https://x/studio-edit.png' WHERE id = :id`, { id: before[0].id });
    await run(`UPDATE scene_angles SET still_image_url = 'https://x/doorway-v2.jpg' WHERE id = :d`, { d: sets.doorway });
    await sync(ep);
    const kept = await scenesOf(ep);
    expect(kept.find((s) => Number(s.scene_number) === 1).background_url).toBe('https://x/studio-edit.png');
    expect(kept.find((s) => Number(s.scene_number) === 3).background_url).toBe('https://x/apartment.jpg');
    expect(kept.find((s) => Number(s.scene_number) === 10).background_url).toBe('https://x/doorway.jpg');
    expect(kept.map((s) => s.id)).toEqual(before.map((s) => s.id));

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
    await sync(ep);
    const scenes = await scenesOf(ep);
    expect(scenes.find((s) => s.scene_number === 11).background_url).toBe('https://x/wide-dressed.jpg');
    expect(scenes.find((s) => s.scene_number === 1).background_url).toBe('https://x/apartment.jpg');

    // A dressed angle stuck generating reads as failed, and the reads leave its
    // row as it is (Evoni, 2026-11-22: a read writes nothing). The plan's read
    // and the dressed angles list both go through it.
    await run(`INSERT INTO scene_set_look_angles (id, look_id, scene_angle_id, status, source, created_at, updated_at)
               VALUES (gen_random_uuid(), :look, :door, 'generating', 'generated', NOW(), NOW() - INTERVAL '20 minutes')`, { look, door: sets.doorway });
    const dressedRows = () => rows('SELECT * FROM scene_set_look_angles WHERE look_id = :look ORDER BY id', { look });
    const before = await dressedRows();
    expect(before.map((r) => r.status).sort()).toEqual(['complete', 'generating']);
    expect((await auth(request(app).get(`/api/v1/episode-brief/${ep}/plan`))).status).toBe(200);
    const list = await auth(request(app).get(`/api/v1/episode-brief/${ep}/dressed-angles?scene_set_id=${sets.glasshouse}`));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).toContain('did not finish within 10 minutes');
    expect(await dressedRows()).toEqual(before);
    await run('DELETE FROM scene_set_look_angles WHERE look_id = :look AND scene_angle_id = :door', { look, door: sets.doorway });
  });

  it("a re-plan keeps each beat's scene and its Timeline edits; a beat losing its set keeps its scene too", async () => {
    const ep = await episode();
    await sync(ep);
    const before = await scenesOf(ep);
    await run(`UPDATE scenes SET duration_seconds = 12 WHERE id = :id`, { id: before[1].id });
    mockCreate.mockResolvedValue({ content: [{ text: JSON.stringify([1, 2, 3, 10, 11, 14].map((n) => ({
      beat_number: n, scene_set_id: n === 3 ? null : (n >= 10 ? sets.glasshouse : sets.apartment), angle_label: n === 2 ? 'VANITY' : null,
      shot_type: 'medium', emotional_intent: 'x', transition_in: 'cut',
    }))) }] });
    await generateScenePlan(ep, show, {}, { save: true });
    expect(await planId(ep, 2)).not.toBe(before[1].scene_plan_id);
    // The service is called here without its route; POST generate-plan runs this sync after it.
    await sync(ep);
    const after = await scenesOf(ep);
    const two = after.find((s) => s.scene_number === 2);
    expect(two.id).toBe(before[1].id);
    expect(two.scene_plan_id).toBe(await planId(ep, 2));
    expect(Number(two.duration_seconds)).toBe(12);

    // S1-A (Evoni, 2026-11-25): a beat that loses its set no longer loses its
    // scene. Nothing is soft-deleted, the scene keeps its id, its edits and
    // its dangling link, and the beat is reported instead — the save says so
    // in scene_sync, and says nothing about anything having been rolled back.
    const one = after.find((s) => s.scene_number === 1);
    const cleared = await auth(request(app).put(`/api/v1/episode-brief/${ep}/plan/1`)).send({ scene_set_id: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.scene_sync.outcome).toBe('held');
    expect(cleared.body.scene_sync.warnings.map((w) => [w.beat_number, w.code]))
      .toEqual(expect.arrayContaining([[1, 'beat_no_location']]));
    const stillThere = (await scenesOf(ep)).find((s) => Number(s.scene_number) === 1);
    expect(stillThere.id).toBe(one.id);
    expect(stillThere.scene_plan_id).toBe(one.scene_plan_id);
    expect((await rows('SELECT deleted_at FROM scenes WHERE id = :id', { id: one.id }))[0].deleted_at).toBeNull();
  });

  // ── S1-A: the export's integrity decision (Decision 3) ────────────────────
  // The non-empty check is no longer the only one. A beat of the current plan
  // with a live set, no live scene and no previously removed scene of its own
  // is content the intended export is short of, so the export is refused
  // rather than shipped truncated. Held scenes, historical removals and the
  // live production rows still pointing at them never block it.
  describe('export (Decision 3)', () => {
    const exportIt = (ep) => auth(request(app).post(`/api/v1/episodes/${ep}/export`)).send({ platform: 'youtube', quality: '720p', format: 'mp4' });

    it('refuses when a required current-plan beat has no scene, and says which beats', async () => {
      const ep = await episode();
      // An older untied scene holds beat 3's number, so beat 3 cannot get one.
      await run(`INSERT INTO scenes (id, episode_id, scene_number, title, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, 3, 'Older three', NOW(), NOW())`, { ep });
      const out = await sync(ep);
      expect(out.outcome).toBe('unresolved');
      expect(out.warnings.map((w) => [w.beat_number, w.code])).toEqual(expect.arrayContaining([[3, 'scene_number_conflict']]));
      const res = await exportIt(ep);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EXPORT_SCENES_UNVERIFIED');
      expect(res.body.beats).toEqual([3]);
      // Every other beat still has its scene: nothing partial was committed.
      expect((await scenesOf(ep)).map((s) => Number(s.scene_number))).toEqual([1, 2, 3, 10, 11]);
    });

    it('allows a valid export that carries a historical warning, and one with live production rows on the removed scene', async () => {
      const ep = await episode();
      await sync(ep);
      // A scene removed earlier that no current beat needs, with live
      // scene_assets and episode_wardrobe rows still pointing at it.
      const cut = uuid();
      await run(`INSERT INTO scenes (id, episode_id, scene_number, title, created_at, updated_at)
                 VALUES (:cut, :ep, 40, 'Cut scene', NOW(), NOW())`, { cut, ep });
      const asset = uuid(); const outfit = uuid();
      await run(`INSERT INTO assets (id, asset_type, created_at, updated_at) VALUES (:id, 'image', NOW(), NOW())`, { id: asset });
      // show_id is set deliberately: wardrobeSlotCoverage counts a show's own
      // rows AND show-less ones, so a global piece here would be inventory for
      // every other show (readinessGates GATE-02 reads that endpoint).
      await run(`INSERT INTO wardrobe (id, name, clothing_category, show_id, created_at, updated_at) VALUES (:id, 'Cut look', 'top', :show, NOW(), NOW())`, { id: outfit, show });
      await run(`INSERT INTO scene_assets (id, scene_id, asset_id, usage_type, created_at, updated_at)
                 VALUES (gen_random_uuid(), :cut, :asset, 'overlay', NOW(), NOW())`, { cut, asset });
      await run(`INSERT INTO episode_wardrobe (id, episode_id, wardrobe_id, scene_id, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, :outfit, :cut, NOW(), NOW())`, { ep, outfit, cut });
      await run('UPDATE scenes SET deleted_at = NOW() WHERE id = :cut', { cut });

      const out = await sync(ep);
      // The removed scene is reported for review, and holds nothing up.
      expect(out.outcome).toBe('held');
      expect(out.warnings.some((w) => w.code === 'scene_removed_previously_with_linked_work')).toBe(true);
      const res = await exportIt(ep);
      expect(res.status).toBeLessThan(300);
      expect(res.body.error).toBeUndefined();
      // The removed scene is not recreated and not resurrected by the export.
      expect((await scenesOf(ep)).map((s) => Number(s.scene_number))).toEqual([1, 2, 3, 10, 11]);
    });

    // ── S1-A gap 1 (Evoni, 2026-11-25): a sync that failed must not be
    // reported as a successful export unless the authoritative checks
    // establish the output is trustworthy, and a lost race — nothing written,
    // another writer mid-change — must come back as a retryable refusal.
    // syncBeatScenesQuietly used to swallow every error to a bare null, so no
    // caller could tell the two apart.
    it("a sync that lost a race reports it: nothing written, outcome failed, retryable; a material failure says so instead", async () => {
      const svc = require('../../src/services/beatScenesService');
      // No stub of the service: the real wrapper, over a handle whose
      // transaction raises the error. 55P03 is Postgres's lock-wait timeout
      // and 22P02 is invalid input syntax; no index name is involved.
      const raise = (err) => ({ transaction: async () => { throw err; } });
      const lockTimeout = Object.assign(new Error('canceling statement due to lock timeout'), { original: { code: '55P03' } });
      const deadlock = Object.assign(new Error('deadlock detected'), { original: { code: '40P01' } });
      const material = Object.assign(new Error('invalid input syntax for type uuid'), { original: { code: '22P02' } });
      jest.spyOn(console, 'error').mockImplementation(() => {});

      for (const err of [lockTimeout, deadlock]) {
        const out = await svc.syncBeatScenesQuietly(raise(err), uuid(), 'export');
        expect(out).toMatchObject({ created: 0, updated: 0, removed: 0, held: 0, outcome: 'failed', retryable: true });
        expect(out.warnings).toEqual([{ beat_number: null, scope: 'episode', code: 'sync_failed_retryable' }]);
      }
      const bad = await svc.syncBeatScenesQuietly(raise(material), uuid(), 'export');
      expect(bad).toMatchObject({ outcome: 'failed', retryable: false });
      expect(bad.warnings).toEqual([{ beat_number: null, scope: 'episode', code: 'sync_failed_material' }]);
      // It still never throws and still never returns null.
      expect(bad).not.toBeNull();
    });

    it('a retryable sync refuses the export as a retry, and a material one leaves the authoritative checks to decide', async () => {
      const ep = await episode();
      await sync(ep); // every required beat has its scene: the list itself is complete
      const svc = require('../../src/services/beatScenesService');
      const failure = (err) => svc.syncBeatScenesQuietly({ transaction: async () => { throw err; } }, ep, 'export');
      jest.spyOn(console, 'error').mockImplementation(() => {});

      // Both failures are produced by the real wrapper before it is stood in
      // for, so what the route sees is exactly what the service returns.
      const retryable = await failure(Object.assign(new Error('lock timeout'), { original: { code: '55P03' } }));
      const materialFailure = await failure(Object.assign(new Error('bad uuid'), { original: { code: '22P02' } }));
      expect([retryable.retryable, materialFailure.retryable]).toEqual([true, false]);

      // The lost race: the scenes were being changed at that moment, so the
      // list this export would freeze is not verified. The repo's own
      // retryable answer, and nothing was written.
      const spy = jest.spyOn(svc, 'syncBeatScenesQuietly').mockResolvedValue(retryable);
      const retried = await exportIt(ep);
      expect(retried.status).toBe(409);
      expect(retried.body).toMatchObject({ success: false, code: 'RETRY', retryable: true });
      expect(retried.body.scene_sync).toMatchObject({ outcome: 'failed', retryable: true });
      expect(retried.body.message).toMatch(/try the export again/i);

      // A material failure is not a refusal of its own: the existing
      // authoritative checks establish this output is trustworthy, so the
      // export is still queued. A warning never fails an export by itself.
      spy.mockResolvedValue(materialFailure);
      const allowed = await exportIt(ep);
      expect(allowed.status).toBe(202);
      expect(allowed.body.success).toBe(true);

      // And a caller's test double that resolves undefined is not a failure.
      spy.mockResolvedValue(undefined);
      expect((await exportIt(ep)).status).toBe(202);

      // None of the three changed a scene.
      expect((await scenesOf(ep)).map((s) => Number(s.scene_number))).toEqual([1, 2, 3, 10, 11]);
    });

    it('a held scene does not block a valid export, and optional omissions are allowed', async () => {
      const ep = await episode();
      await sync(ep);
      // Beat 1 loses its set (its scene stays, S1-A), beat 14 never had one:
      // both are held, neither is a required scene the export is short of.
      await run('UPDATE scene_plans SET scene_set_id = NULL WHERE episode_id = :ep AND beat_number = 1', { ep });
      const out = await sync(ep);
      expect(out.outcome).toBe('held');
      expect(out.warnings.map((w) => [w.beat_number, w.code]))
        .toEqual(expect.arrayContaining([[1, 'beat_no_location'], [14, 'beat_no_location']]));
      const res = await exportIt(ep);
      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      // The held beat's scene is still there, untouched.
      expect((await scenesOf(ep)).map((s) => Number(s.scene_number))).toEqual([1, 2, 3, 10, 11]);
    });

    // ── S1-A gap 2 (tombstone matching) ──────────────────────────────────────
    // classify's tombFor and the export's omitted-beats query both treat a
    // tombstone as a beat's when EITHER its scene_plan_id matches OR its
    // scene_number equals the beat number. Only the plan-id link is
    // authoritative. These two tests pin down what each branch does today:
    // the first is the authoritative link and is correct; the second is the
    // number-only branch, and it is MEASURED to associate a tombstone with a
    // beat it never belonged to. Narrowing it is a behaviour change with a
    // measured blast radius (/root/writer8-evidence/s1a-export-gaps/), so it
    // is reported for Evoni's ruling rather than changed here.
    it('a historical tombstone of the beat itself (the authoritative plan-id link): the beat is held, the export is allowed', async () => {
      const ep = await episode();
      await sync(ep);
      const before = await scenesOf(ep);
      const two = before.find((s) => Number(s.scene_number) === 2);
      // Deleted through the route, so the episode's remaining scenes are
      // renumbered exactly as a real delete leaves them. No re-plan: the
      // tombstone's plan row is still there, so the link is authoritative.
      expect((await auth(request(app).delete(`/api/v1/scenes/${two.id}`))).status).toBe(200);
      const [tomb] = await rows('SELECT scene_plan_id, scene_number FROM scenes WHERE id = :id', { id: two.id });
      expect(tomb.scene_plan_id).toBe(await planId(ep, 2));
      expect((await rows('SELECT id FROM scene_plans WHERE id = :id AND deleted_at IS NULL', { id: tomb.scene_plan_id }))).toHaveLength(1);

      const out = await sync(ep);
      expect(out.created).toBe(0);
      expect(out.outcome).toBe('held');
      expect(out.warnings.map((w) => [w.beat_number, w.code]))
        .toEqual(expect.arrayContaining([[2, 'scene_removed_previously_ambiguous']]));
      // The beat's scene is not recreated, and the export is allowed.
      expect((await scenesOf(ep)).some((s) => s.scene_plan_id === tomb.scene_plan_id)).toBe(false);
      expect((await exportIt(ep)).status).toBe(202);
    });

    it('MEASURED gap: after a re-plan a tombstone is matched by number alone, and holds a beat it never belonged to', async () => {
      // Its own episode: five beats at the apartment with contiguous numbers,
      // so the renumbering a delete does is easy to read off.
      const ep = uuid();
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
                 VALUES (:ep, :show, 'Gap 2 ep', :n, 'draft', NOW(), NOW())`,
        { ep, show, n: Math.floor(Math.random() * 100000) + 500 });
      for (const b of [1, 2, 3, 4, 5]) {
        await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, sort_order, locked, ai_suggested, chosen_by_user, created_at, updated_at)
                   VALUES (gen_random_uuid(), :ep, :b, :name, :setId, NULL, :b, false, true, false, NOW(), NOW())`,
        { ep, b, name: `Beat ${b}`, setId: sets.apartment });
      }
      await sync(ep);
      const owner = new Map((await rows('SELECT s.id, p.beat_number FROM scenes s JOIN scene_plans p ON p.id = s.scene_plan_id WHERE s.episode_id = :ep', { ep }))
        .map((r) => [r.id, Number(r.beat_number)]));
      // Two deletes through the route. Each one renumbers the survivors
      // 1..n (sceneController.renumberLiveScenes), so the second scene
      // removed no longer holds the number of the beat it belongs to.
      const del = async (n) => {
        const target = (await scenesOf(ep)).find((s) => Number(s.scene_number) === n);
        expect((await auth(request(app).delete(`/api/v1/scenes/${target.id}`))).status).toBe(200);
        return target.id;
      };
      await del(1);
      const second = await del(4);
      const [tomb] = await rows('SELECT scene_number FROM scenes WHERE id = :id', { id: second });
      // The removed scene is beat 5's, and it is sitting on number 4.
      expect(owner.get(second)).toBe(5);
      expect(Number(tomb.scene_number)).toBe(4);

      // A re-plan hard-deletes the unlocked, unchosen plan rows and writes new
      // ones (scenePlannerService), so the tombstone's plan link dangles.
      await run('DELETE FROM scene_plans WHERE episode_id = :ep AND locked = false AND chosen_by_user = false', { ep });
      for (const b of [1, 2, 3, 4, 5]) {
        await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, sort_order, locked, ai_suggested, chosen_by_user, created_at, updated_at)
                   VALUES (gen_random_uuid(), :ep, :b, :name, :setId, NULL, :b, false, true, false, NOW(), NOW())`,
        { ep, b, name: `Beat ${b} v2`, setId: sets.apartment });
      }
      const out = await sync(ep);
      // What the number-only branch does today: beat 4 is reported as having
      // had a scene removed, on the strength of a tombstone that was beat 5's;
      // beat 5 is given a brand-new scene; and the export is allowed.
      expect(out.warnings.map((w) => [w.beat_number, w.code]))
        .toEqual(expect.arrayContaining([[4, 'scene_removed_previously_ambiguous']]));
      expect(out.created).toBe(1);
      expect(out.outcome).toBe('held');
      expect((await exportIt(ep)).status).toBe(202);
    });

    it('allows an export whose held beat was removed before: the beat is warned about, never recreated', async () => {
      const ep = await episode();
      await sync(ep);
      const two = (await scenesOf(ep)).find((s) => Number(s.scene_number) === 2);
      await run('UPDATE scenes SET deleted_at = NOW() WHERE id = :id', { id: two.id });
      const out = await sync(ep);
      expect(out.outcome).toBe('held');
      expect(out.created).toBe(0);
      expect(out.warnings.map((w) => [w.beat_number, w.code]))
        .toEqual(expect.arrayContaining([[2, 'scene_removed_previously_ambiguous']]));
      expect(out.warnings.find((w) => w.beat_number === 2).text)
        .toBe('A scene associated with this beat was removed previously. Automatic synchronization will not recreate it. Review the beat if a scene is expected.');
      expect((await scenesOf(ep)).some((s) => Number(s.scene_number) === 2)).toBe(false);
      const res = await exportIt(ep);
      expect(res.status).toBeLessThan(300);
    });
  });
});

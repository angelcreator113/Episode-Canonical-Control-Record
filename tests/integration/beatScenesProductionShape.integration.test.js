/**
 * Each beat's scene row against production's `scenes` table (L12a; the
 * BeatScenes repair, 2026-11-06).
 *
 * The migrated test database's `scenes` has a `status` column and no
 * `(episode_id, scene_number)` unique index; production has neither the
 * column nor the gap. Read-only capture of production's table, 2026-11-06
 * (information_schema.columns, pg_indexes, pg_constraint on public.scenes):
 * 36 columns, no `status` (`production_status` is the scene's status),
 * `duration_seconds integer`, `scene_number NOT NULL`, unique indexes on
 * `id`, `(scene_plan_id) WHERE deleted_at IS NULL AND scene_plan_id IS NOT
 * NULL` and `(episode_id, scene_number) WHERE deleted_at IS NULL`, no
 * triggers.
 *
 * So this suite builds that table in its own schema (`beat_prodshape`) and
 * runs syncBeatScenes through a connection whose search_path puts it first:
 * `scenes` is the production-shaped table, everything else is public. The
 * public tables are not changed.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const { syncBeatScenes, syncBeatScenesQuietly, beatSceneIds } = require('../../src/services/beatScenesService');

const url = process.env.DATABASE_URL;
const shouldSkip = !url || url.includes('amazonaws.com') || !url.includes('episode_metadata_test');

const SCHEMA = 'beat_prodshape';

/** Production's public.scenes as read on 2026-11-06, column for column. */
const PRODUCTION_SCENES = `
  CREATE TABLE ${SCHEMA}.scenes (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
    scene_number integer NOT NULL,
    title character varying,
    description text,
    duration_seconds integer,
    location character varying,
    scene_type character varying DEFAULT 'main',
    production_status character varying DEFAULT 'draft',
    mood character varying,
    script_notes text,
    start_timecode character varying,
    end_timecode character varying,
    characters jsonb DEFAULT '[]'::jsonb,
    thumbnail_id uuid,
    is_locked boolean DEFAULT false,
    created_by character varying,
    updated_by character varying,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    locked_at timestamp without time zone,
    locked_by character varying,
    assets jsonb DEFAULT '{}'::jsonb,
    duration_auto boolean NOT NULL DEFAULT true,
    layout jsonb,
    background_url character varying,
    ui_elements jsonb DEFAULT '[]'::jsonb,
    dialogue_clips jsonb DEFAULT '[]'::jsonb,
    raw_footage_s3_key character varying,
    ai_scene_detected boolean NOT NULL DEFAULT false,
    ai_confidence_score double precision,
    canvas_settings jsonb,
    scene_set_id uuid REFERENCES public.scene_sets(id) ON UPDATE CASCADE ON DELETE SET NULL,
    scene_angle_id uuid REFERENCES public.scene_angles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    scene_plan_id uuid
  );
  CREATE UNIQUE INDEX ON ${SCHEMA}.scenes (episode_id, scene_number) WHERE deleted_at IS NULL;
  CREATE UNIQUE INDEX ON ${SCHEMA}.scenes (scene_plan_id) WHERE deleted_at IS NULL AND scene_plan_id IS NOT NULL;
`;

(shouldSkip ? describe.skip : describe)("Each beat's scene row on production's scenes table", () => {
  let db;
  const show = crypto.randomUUID();
  const sets = {};
  const run = (sql, replacements = {}) => db.query(sql, { replacements });
  const rows = async (sql, replacements = {}) => (await db.query(sql, { replacements }))[0];

  /** An episode: beats 1-3 at the apartment (2 at its vanity angle), 10-11 at the glasshouse, 14 with no set. */
  async function episode() {
    const ep = crypto.randomUUID();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Prod-shape ep', :n, 'draft', NOW(), NOW())`, { ep, show, n: Math.floor(Math.random() * 100000) + 500 });
    for (const [b, setId, label] of [[1, sets.apartment, null], [2, sets.apartment, 'VANITY'], [3, sets.apartment, null],
      [10, sets.glasshouse, 'WIDE'], [11, sets.glasshouse, null], [14, null, null]]) {
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, sort_order, locked, ai_suggested, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, :b, :name, :setId, :label, :b, false, true, NOW(), NOW())`,
      { ep, b, name: `Beat ${b}`, setId, label });
    }
    return ep;
  }
  const live = (ep) => rows(`SELECT * FROM scenes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY scene_number`, { ep });
  const planId = async (ep, b) => (await rows('SELECT id FROM scene_plans WHERE episode_id = :ep AND beat_number = :b AND deleted_at IS NULL', { ep, b }))[0].id;

  beforeAll(async () => {
    db = new Sequelize(url, { logging: false, dialectOptions: { options: `-c search_path=${SCHEMA},public` } });
    await db.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await db.query(`CREATE SCHEMA ${SCHEMA}`);
    await db.query(PRODUCTION_SCENES);

    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `Prod-shape ${show.slice(0, 8)}`, slug: `prod-shape-${show.slice(0, 8)}` });
    for (const [key, type] of [['apartment', 'HOME_BASE'], ['glasshouse', 'EVENT_LOCATION'], ['cafe', 'OTHER']]) {
      sets[key] = crypto.randomUUID();
      await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, base_still_url, generation_status, created_at, updated_at)
                 VALUES (:id, :key, :type, :show, :base, 'complete', NOW(), NOW())`, { id: sets[key], key, type, show, base: `https://x/${key}.jpg` });
    }
    sets.vanity = crypto.randomUUID(); sets.wide = crypto.randomUUID();
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_label, angle_name, angle_kind, still_image_url, generation_status, created_at, updated_at)
               VALUES (:vanity, :apartment, 'VANITY', 'Vanity', NULL, 'https://x/vanity.jpg', 'complete', NOW(), NOW()),
                      (:wide, :glasshouse, 'WIDE', 'Main hall', 'inside', 'https://x/wide.jpg', 'complete', NOW(), NOW())`,
    { vanity: sets.vanity, wide: sets.wide, apartment: sets.apartment, glasshouse: sets.glasshouse });
  });
  afterAll(async () => {
    await db.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await db.close();
  });
  afterEach(() => jest.restoreAllMocks());

  it('the suite really runs on the production shape: scenes has no status column and both partial unique indexes', async () => {
    const [{ schema }] = await rows(`SELECT n.nspname AS schema FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.oid = 'scenes'::regclass`);
    expect(schema).toBe(SCHEMA);
    const cols = (await rows(`SELECT column_name FROM information_schema.columns WHERE table_schema = :s AND table_name = 'scenes'`, { s: SCHEMA })).map((c) => c.column_name);
    expect(cols).toHaveLength(36);
    expect(cols).not.toContain('status');
    expect(cols).toEqual(expect.arrayContaining(['production_status', 'scene_type', 'scene_plan_id']));
    // The INSERT the sync made before this repair fails here, as it did in production.
    const ep = await episode();
    await expect(run(`INSERT INTO scenes (episode_id, scene_number, status) VALUES (:ep, 99, 'draft')`, { ep }))
      .rejects.toThrow(/column "status" of relation "scenes" does not exist/);
  });

  it('creates one scene per beat with a set: plan link, beat number, set, angle, background, 5s, main, draft; a beat with no set has none', async () => {
    const ep = await episode();
    expect(await syncBeatScenes(db, ep)).toMatchObject({ created: 5, updated: 0, removed: 0, outcome: 'held' });
    const scenes = await live(ep);
    expect(scenes.map((s) => [s.scene_number, s.scene_set_id, s.scene_angle_id, s.background_url])).toEqual([
      [1, sets.apartment, null, 'https://x/apartment.jpg'],
      [2, sets.apartment, sets.vanity, 'https://x/vanity.jpg'],
      [3, sets.apartment, null, 'https://x/apartment.jpg'],
      [10, sets.glasshouse, sets.wide, 'https://x/wide.jpg'],
      [11, sets.glasshouse, sets.wide, 'https://x/wide.jpg'], // no angle asked: planWithAngles picks the venue's inside angle
    ]);
    for (const s of scenes) {
      expect(s.scene_plan_id).toBe(await planId(ep, s.scene_number));
      expect(s).toMatchObject({ duration_seconds: 5, scene_type: 'main', production_status: 'draft', title: `Beat ${s.scene_number}`,
        characters: [], ui_elements: [], dialogue_clips: [] });
    }
    expect((await beatSceneIds(db, ep)).get(await planId(ep, 2))).toBe(scenes[1].id);
    expect((await beatSceneIds(db, ep)).has(await planId(ep, 14))).toBe(false);
  });

  it('is idempotent: syncing again, or two syncs at once, keeps one scene per beat and writes nothing more', async () => {
    const ep = await episode();
    await syncBeatScenes(db, ep);
    const first = await live(ep);
    expect(await syncBeatScenes(db, ep)).toMatchObject({ created: 0, updated: 0, removed: 0 });
    const again = await live(ep);
    expect(again.map((s) => [s.id, String(s.updated_at)])).toEqual(first.map((s) => [s.id, String(s.updated_at)]));

    const other = await episode();
    const both = await Promise.allSettled([syncBeatScenes(db, other), syncBeatScenes(db, other)]);
    const scenes = await live(other);
    expect(scenes.map((s) => s.scene_number)).toEqual([1, 2, 3, 10, 11]);
    // Whatever the race, no beat has two live scenes; a sync that lost the race on the
    // scene-number index fails (it is logged by the readers' quiet sync) and the next read completes.
    for (const r of both) if (r.status === 'rejected') expect(r.reason.original.code).toBe('23505');
    expect(await syncBeatScenes(db, other)).toMatchObject({ created: 0, updated: 0, removed: 0 });
  });

  // S1-A (Evoni, 2026-11-25): the background is the one column of these four
  // the sync no longer overwrites. On an UPDATE it is assigned only while
  // the stored background_url IS NULL, because Scene Studio's editing is
  // authoritative; the set, the angle and the plan link still follow the
  // beat, and the scene number is never written onto an existing row at all.
  it("keeps the Timeline's edits on a beat's scene; a beat's change updates its set, angle and link, and never its stored background or number", async () => {
    const ep = await episode();
    await syncBeatScenes(db, ep);
    const [one] = await live(ep);
    await run(`UPDATE scenes SET duration_seconds = 9, title = 'Morning', characters = '[{"id":"lala"}]', ui_elements = '[{"id":"phone"}]',
               dialogue_clips = '[{"id":"c1"}]', production_status = 'in_progress', description = 'kept' WHERE id = :id`, { id: one.id });
    await run(`UPDATE scene_plans SET scene_set_id = :cafe WHERE id = :p`, { cafe: sets.cafe, p: one.scene_plan_id });
    expect(await syncBeatScenes(db, ep)).toMatchObject({ created: 0, updated: 1, removed: 0 });
    const [after] = await live(ep);
    // The stored background stays the apartment's: the move to the cafe set
    // does not reach into a background that is already set.
    expect(after).toMatchObject({ id: one.id, scene_set_id: sets.cafe, background_url: 'https://x/apartment.jpg', scene_number: 1,
      duration_seconds: 9, title: 'Morning', characters: [{ id: 'lala' }], ui_elements: [{ id: 'phone' }], dialogue_clips: [{ id: 'c1' }],
      production_status: 'in_progress', description: 'kept' });

    // Cleared by hand, the next sync does fill it in from the beat's set.
    await run('UPDATE scenes SET background_url = NULL WHERE id = :id', { id: one.id });
    expect(await syncBeatScenes(db, ep)).toMatchObject({ created: 0, updated: 1, removed: 0 });
    expect((await live(ep))[0]).toMatchObject({ id: one.id, background_url: 'https://x/cafe.jpg', scene_number: 1 });

    // An operator's own background is then never replaced again.
    await run(`UPDATE scenes SET background_url = 'https://x/studio-edit.png' WHERE id = :id`, { id: one.id });
    await run(`UPDATE scene_plans SET scene_set_id = :apt WHERE id = :p`, { apt: sets.apartment, p: one.scene_plan_id });
    await syncBeatScenes(db, ep);
    expect((await live(ep))[0]).toMatchObject({ id: one.id, scene_set_id: sets.apartment, background_url: 'https://x/studio-edit.png' });
  });

  // S1-A (Evoni, 2026-11-25): the sync takes nothing away. The guarantee this
  // case protects is now the opposite one and a stronger one: a beat that
  // loses its set, and a beat that is gone, both keep their scene, with its
  // id, its edits and its child rows; and when the beat comes back the SAME
  // row serves it again, so nothing that hung off the old id is orphaned.
  // (Before the repair the sync soft-deleted both and then inserted a new
  // row with a new id — `back.id).not.toBe(three.id)` — which is exactly the
  // identity loss this case now forbids.)
  it("keeps a beat's scene when its set is cleared or the beat is gone, and the same row serves the beat again", async () => {
    const ep = await episode();
    await syncBeatScenes(db, ep);
    const before = await live(ep);
    const three = before.find((s) => s.scene_number === 3);
    const eleven = before.find((s) => s.scene_number === 11);
    await run(`UPDATE scenes SET duration_seconds = 8, title = 'Kept three' WHERE id = :id`, { id: three.id });
    await run('UPDATE scene_plans SET scene_set_id = NULL WHERE id = :p', { p: three.scene_plan_id });
    await run('UPDATE scene_plans SET deleted_at = NOW() WHERE id = :p', { p: eleven.scene_plan_id });

    const held = await syncBeatScenes(db, ep);
    expect(held).toMatchObject({ created: 0, updated: 0, removed: 0, outcome: 'held' });
    // Nothing was removed: every scene is still live, with its own id.
    expect((await live(ep)).map((s) => s.scene_number)).toEqual([1, 2, 3, 10, 11]);
    const kept = await rows('SELECT id, deleted_at, scene_plan_id, duration_seconds, title FROM scenes WHERE id IN (:ids)',
      { ids: [three.id, eleven.id] });
    expect(kept.every((s) => s.deleted_at === null)).toBe(true);
    // The dangling link is preserved, so the orphan adoption can still find it.
    expect(kept.find((s) => s.id === eleven.id).scene_plan_id).toBe(eleven.scene_plan_id);
    expect(kept.find((s) => s.id === three.id)).toMatchObject({ duration_seconds: 8, title: 'Kept three' });
    // The beat with no set is reported, not silently dropped.
    expect(held.warnings.map((w) => [w.beat_number, w.code])).toEqual(expect.arrayContaining([[3, 'beat_no_location']]));

    // The set given again: the SAME row serves beat 3, so nothing that hung
    // off its id is orphaned, and its Timeline edits are still there.
    await run('UPDATE scene_plans SET scene_set_id = :apt WHERE id = :p', { apt: sets.apartment, p: three.scene_plan_id });
    // Nothing needs writing: the row the beat had is already what the beat
    // says, down to its background, so the sync writes nothing at all.
    expect(await syncBeatScenes(db, ep)).toMatchObject({ created: 0, updated: 0, removed: 0, outcome: 'held' });
    const back = (await live(ep)).find((s) => s.scene_number === 3);
    expect(back.id).toBe(three.id);
    expect(back).toMatchObject({ scene_set_id: sets.apartment, duration_seconds: 8, title: 'Kept three' });
  });

  it('a re-plan moves each tied scene to its beat\'s new plan row, so the scene and its edits survive', async () => {
    const ep = await episode();
    await syncBeatScenes(db, ep);
    const two = (await live(ep)).find((s) => s.scene_number === 2);
    await run('UPDATE scenes SET duration_seconds = 12 WHERE id = :id', { id: two.id });
    // A re-plan replaces the rows (one row per beat number, live or not).
    await run('DELETE FROM scene_plans WHERE id = :p', { p: two.scene_plan_id });
    await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, sort_order, locked, ai_suggested, created_at, updated_at)
               VALUES (gen_random_uuid(), :ep, 2, 'Beat 2', :apt, 'VANITY', 2, false, true, NOW(), NOW())`, { ep, apt: sets.apartment });
    expect(await syncBeatScenes(db, ep)).toMatchObject({ created: 0, updated: 1, removed: 0 });
    const moved = (await live(ep)).find((s) => s.scene_number === 2);
    expect(moved).toMatchObject({ id: two.id, scene_plan_id: await planId(ep, 2), duration_seconds: 12 });
  });

  it('never changes an older (untied) scene; one at a free number sits beside the beats\' scenes', async () => {
    const ep = await episode();
    const older = crypto.randomUUID();
    await run(`INSERT INTO scenes (id, episode_id, scene_number, title, duration_seconds, background_url, characters)
               VALUES (:older, :ep, 50, 'Old scene', 7, 'https://x/old.jpg', '[{"id":"old"}]')`, { older, ep });
    const [snap] = await rows('SELECT * FROM scenes WHERE id = :older', { older });
    await syncBeatScenes(db, ep);
    await syncBeatScenes(db, ep);
    const [after] = await rows('SELECT * FROM scenes WHERE id = :older', { older });
    expect(after).toEqual(snap);
    expect((await live(ep)).map((s) => s.scene_number)).toEqual([1, 2, 3, 10, 11, 50]);
  });

  // S1-A (Evoni, 2026-11-25): the guarantee this case protects is that the
  // older scene is never touched and that the collision never costs the
  // episode its other beats. Before the repair the sync had no transaction,
  // so it raised 23505 at beat 3 and left beats 1-2 committed and beats
  // 10-11 absent — a truncated episode that export then shipped with a 200.
  // Now the number conflict is seen before anything is written, the beat is
  // reported instead, and every other beat still gets its scene in one
  // transaction. No SQLSTATE and no index name is asserted here, because
  // neither is raised any more; the two indexed shapes and the shape without
  // the index now behave identically.
  it('an older scene holding a beat\'s number: that beat is reported, no existing scene changes, and every other beat still gets its scene', async () => {
    const ep = await episode();
    const older = crypto.randomUUID();
    await run(`INSERT INTO scenes (id, episode_id, scene_number, title, duration_seconds) VALUES (:older, :ep, 3, 'Old scene three', 7)`, { older, ep });
    const [snap] = await rows('SELECT * FROM scenes WHERE id = :older', { older });

    const out = await syncBeatScenes(db, ep);
    expect(out).toMatchObject({ created: 4, updated: 0, removed: 0, outcome: 'unresolved' });
    expect(out.warnings.map((w) => [w.beat_number, w.code])).toEqual(expect.arrayContaining([[3, 'scene_number_conflict']]));
    // Nothing partial: the beats before AND after the collision all have
    // their scenes, and the older scene keeps number 3.
    expect((await live(ep)).map((s) => [s.scene_number, s.scene_plan_id ? 'beat' : 'older']))
      .toEqual([[1, 'beat'], [2, 'beat'], [3, 'older'], [10, 'beat'], [11, 'beat']]);
    expect((await rows('SELECT * FROM scenes WHERE id = :older', { older }))[0]).toEqual(snap);

    // Syncing again is idempotent and still reports the same beat; the quiet
    // wrapper has nothing to swallow, so it returns the outcome, not null.
    const again = await syncBeatScenesQuietly(db, ep, 'the plan');
    expect(again).toMatchObject({ created: 0, updated: 0, removed: 0, outcome: 'unresolved' });
    expect((await rows('SELECT * FROM scenes WHERE id = :older', { older }))[0]).toEqual(snap);
    expect((await live(ep)).map((s) => s.scene_number)).toEqual([1, 2, 3, 10, 11]);
    // S1-A gap 1 (Evoni, 2026-11-25): the quiet wrapper still never throws and
    // still logs, but a real failure is now reported instead of swallowed to a
    // bare null — it says it failed, that nothing was written, and whether
    // asking again could help. This one cannot: it is a material failure.
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    const failure = await syncBeatScenesQuietly(db, 'not-a-uuid', 'the plan');
    expect(failure).toMatchObject({
      created: 0, updated: 0, removed: 0, held: 0, outcome: 'failed', retryable: false,
    });
    expect(failure.warnings).toEqual([{ beat_number: null, scope: 'episode', code: 'sync_failed_material' }]);
    expect(logged.mock.calls[0][0]).toBe('[BeatScenes] sync for the plan failed:');
  });
});

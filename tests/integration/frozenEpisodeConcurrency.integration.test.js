/**
 * S1-B concurrency (Evoni, 2026-11-25): the freeze is decided under the
 * episode's own lock, so it cannot be overtaken.
 *
 * Two real connections, blocking OBSERVED in pg_stat_activity rather than
 * timed. The second connection's statements are transcriptions of the real
 * writers, cited inline:
 *   acceptance  episodeCompletionService:542  SELECT … FOR UPDATE on the episode
 *   first clip  rawClipsService.attachClip:336 lockEpisodes(…, mode:'share')
 *   planning    scenePlannerService / planAndSyncUnderEpisodeLock, which S1-B
 *               takes FOR UPDATE at entry (utils/episodeLocks MODES.update)
 *
 * MEASURED before this change: with the planner on FOR SHARE the clip attach
 * was not blocked and committed while the planning transaction was open, so a
 * plan was written onto an episode that had just become filmed.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const { Client } = require('pg');
const models = require('../../src/models');
const beatScenes = require('../../src/services/beatScenesService');
const { generateScenePlan } = require('../../src/services/scenePlannerService');
const { resumeEpisodeSetup } = require('../../src/services/episodeGeneratorService');
const { CANONICAL_BEATS } = require('../../src/constants/canonicalBeats');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const CANON = CANONICAL_BEATS.map((b) => b.number);

(shouldSkip ? describe.skip : describe)('S1-B: the freeze cannot be overtaken', () => {
  const show = uuid();
  let setA;

  /** A second real connection, so the interleaving is genuine. */
  const connect = async () => {
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    const pid = (await c.query('SELECT pg_backend_pid() AS p')).rows[0].p;
    return { c, pid };
  };
  /** Fire without awaiting, so the statement can be observed waiting. */
  const fire = (c, sql, vals) => {
    const rec = { done: false };
    rec.p = c.query(sql, vals).then((r) => { rec.done = true; rec.res = r; }, (e) => { rec.done = true; rec.err = e; });
    return rec;
  };
  /** Resolves once this backend is observably blocked on a lock. */
  const blockedOnLock = async (pid, rec, ms = 5000) => {
    const t0 = Date.now();
    for (;;) {
      if (rec.done) return false;
      const r = await rows('SELECT wait_event_type FROM pg_stat_activity WHERE pid = :pid', { pid });
      if (r[0]?.wait_event_type === 'Lock') return true;
      if (Date.now() - t0 > ms) return null;
      await new Promise((res) => setTimeout(res, 25));
    }
  };

  async function episode({ beats = CANON, withScenes = true } = {}) {
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:ep, :show, 'Conc ep', :n, 'draft', NULL, NOW(), NOW())`,
      { ep, show, n: Math.floor(Math.random() * 100000) + 500 });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, status, created_at, updated_at)
               VALUES (gen_random_uuid(), :ep, :show, 'draft', NOW(), NOW())`, { ep, show });
    // The set linked as this episode's home, so the beats Resume creates are
    // PLACED and therefore get their scene rows too. Without a role link
    // createScenePlanRows leaves them with no set and the sync rightly holds
    // them (beat_no_location), which would prove nothing about joint commit.
    await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, sort_order, created_at, updated_at)
               VALUES (gen_random_uuid(), :setA, :ep, 'home', 0, NOW(), NOW())`, { setA, ep });
    for (const n of beats) {
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label,
                   sort_order, locked, chosen_by_user, ai_suggested, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, :n, :name, :setA, 'WIDE', :n, false, false, true, NOW(), NOW())`,
      { ep, n, name: `Beat ${n}`, setA });
    }
    if (withScenes) await beatScenes.syncBeatScenes(sequelize, ep);
    return ep;
  }

  const reply = () => CANON.map((n) => ({
    beat_number: n, beat_name: `gen b${n}`, scene_set_id: setA, angle_label: 'WIDE',
    shot_type: 'medium', emotional_intent: `gen ${n}`, transition_in: 'cut', confidence: 0.9,
  }));
  const replan = (ep) => generateScenePlan(ep, show, { episode_archetype: 'a', narrative_purpose: 'p' }, { save: true });
  const planCount = async (ep) => Number((await rows('SELECT count(*)::int AS n FROM scene_plans WHERE episode_id = :ep', { ep }))[0].n);
  const sceneCount = async (ep) => Number((await rows('SELECT count(*)::int AS n FROM scenes WHERE episode_id = :ep', { ep }))[0].n);

  // Transcribed statements.
  const EPISODE_FOR_UPDATE = 'SELECT id FROM episodes WHERE id IN ($1) ORDER BY id FOR UPDATE';
  const EPISODE_FOR_SHARE = 'SELECT id FROM episodes WHERE id IN ($1) ORDER BY id FOR SHARE';

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `Conc ${show.slice(0, 8)}`, slug: `conc-${show.slice(0, 8)}` });
    setA = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, base_still_url, script_context,
                 generation_status, created_at, updated_at)
               VALUES (:id, :name, 'EVENT_LOCATION', :show, 'https://x/a.jpg', 'ctx', 'complete', NOW(), NOW())`,
      { id: setA, name: `Set ${setA.slice(0, 6)}`, show });
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_label, angle_name, still_image_url,
                 generation_status, created_at, updated_at)
               VALUES (gen_random_uuid(), :id, 'WIDE', 'Wide', 'https://x/a-wide.jpg', 'complete', NOW(), NOW())`,
      { id: setA });
  });

  beforeEach(() => { mockCreate.mockReset(); mockCreate.mockResolvedValue({ content: [{ text: JSON.stringify(reply()) }] }); });

  // ── acceptance ───────────────────────────────────────────────────────────

  it('acceptance commits first: planning refuses and writes nothing', async () => {
    const ep = await episode();
    const before = await planCount(ep);
    const { c } = await connect();
    try {
      // episodeCompletionService:542's own order: the episode FOR UPDATE, then
      // the acceptance written under it.
      await c.query('BEGIN');
      await c.query(EPISODE_FOR_UPDATE, [ep]);
      await c.query("UPDATE episodes SET evaluation_status = 'accepted' WHERE id = $1", [ep]);
      await c.query('COMMIT');
    } finally { await c.end(); }

    await expect(replan(ep)).rejects.toMatchObject({ code: 'EPISODE_FROZEN', status: 409 });
    expect(await planCount(ep)).toBe(before);
  });

  it('planning locks first: the acceptance waits for it', async () => {
    const ep = await episode();
    const { c, pid } = await connect();
    const planner = await connect();
    try {
      // The planner's own prologue under S1-B: FOR UPDATE at entry.
      await planner.c.query('BEGIN');
      await planner.c.query("SET LOCAL lock_timeout = '10s'");
      await planner.c.query(EPISODE_FOR_UPDATE, [ep]);

      await c.query('BEGIN');
      await c.query("SET LOCAL lock_timeout = '10s'");
      const accept = fire(c, EPISODE_FOR_UPDATE, [ep]);
      expect(await blockedOnLock(pid, accept)).toBe(true);

      await planner.c.query('COMMIT');
      await accept.p;
      expect(accept.err).toBeUndefined();            // it waited, then proceeded
      await c.query('ROLLBACK');
    } finally { await c.end(); await planner.c.end(); }
  });

  // ── filming ──────────────────────────────────────────────────────────────

  it('the first clip commits first: planning refuses and writes nothing', async () => {
    const ep = await episode();
    const before = await planCount(ep);
    const { c } = await connect();
    try {
      // attachClip:336's order: the episode FOR SHARE, then the clip.
      await c.query('BEGIN');
      await c.query(EPISODE_FOR_SHARE, [ep]);
      await c.query(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
                     VALUES (gen_random_uuid(), $1, $2, 'lala', $3, 'none', 'low', NOW(), NOW())`,
      [ep, show, `raw/${ep.slice(0, 8)}.mp4`]);
      await c.query('COMMIT');
    } finally { await c.end(); }

    await expect(replan(ep)).rejects.toMatchObject({ code: 'EPISODE_FROZEN', status: 409 });
    expect(await planCount(ep)).toBe(before);
  });

  it('planning locks first: the first clip\'s attach waits, and filming is never refused', async () => {
    const ep = await episode();
    const { c, pid } = await connect();
    const planner = await connect();
    try {
      await planner.c.query('BEGIN');
      await planner.c.query("SET LOCAL lock_timeout = '10s'");
      await planner.c.query(EPISODE_FOR_UPDATE, [ep]);

      await c.query('BEGIN');
      await c.query("SET LOCAL lock_timeout = '10s'");
      const attach = fire(c, EPISODE_FOR_SHARE, [ep]);
      // FOR UPDATE conflicts with FOR SHARE: this is what FOR SHARE on the
      // planner's side did NOT do, measured before the change.
      expect(await blockedOnLock(pid, attach)).toBe(true);

      await planner.c.query('COMMIT');
      await attach.p;
      expect(attach.err).toBeUndefined();
      // filming then proceeds: it waited, it was not refused
      await c.query(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
                     VALUES (gen_random_uuid(), $1, $2, 'lala', $3, 'none', 'low', NOW(), NOW())`,
      [ep, show, `raw/${ep.slice(0, 8)}-b.mp4`]);
      await c.query('COMMIT');
      expect(await rows('SELECT id FROM episode_raw_clips WHERE episode_id = :ep', { ep })).toHaveLength(1);
    } finally { await c.end(); await planner.c.end(); }
  });

  // ── Start/Resume: one unit, and it rolls back as one ─────────────────────

  it('Resume writes the plan rows and their scenes as one unit', async () => {
    const ep = await episode({ beats: [1, 2, 3], withScenes: true });
    const plansBefore = await planCount(ep);
    const scenesBefore = await sceneCount(ep);

    await resumeEpisodeSetup(models, ep);

    // the beats Resume added brought their scenes with them, in one commit
    expect(await planCount(ep)).toBeGreaterThan(plansBefore);
    expect(await sceneCount(ep)).toBeGreaterThan(scenesBefore);
    expect(await planCount(ep)).toBe(CANON.length);
    const orphans = await rows(`SELECT p.beat_number FROM scene_plans p
        LEFT JOIN scenes s ON s.scene_plan_id = p.id AND s.deleted_at IS NULL
       WHERE p.episode_id = :ep AND p.deleted_at IS NULL AND p.scene_set_id IS NOT NULL AND s.id IS NULL`, { ep });
    expect(orphans).toEqual([]);
  });

  it('a failure inside the unit rolls back the plan rows that were already written', async () => {
    // Beats 1-3 with their scenes; the rest missing, so the unit writes plan
    // rows for them FIRST and then runs the sync. A second connection holds
    // one of this episode's scene rows, which the sync's own read locks, so
    // the failure lands AFTER the plan-row writes — the only arrangement that
    // can prove a rollback rather than a refusal before any write.
    const ep = await episode({ beats: [1, 2, 3], withScenes: true });
    const plansBefore = await rows(`SELECT beat_number, id, beat_name, scene_set_id, sort_order
      FROM scene_plans WHERE episode_id = :ep ORDER BY beat_number`, { ep });
    const scenesBefore = await rows(`SELECT id, scene_plan_id, scene_number, background_url
      FROM scenes WHERE episode_id = :ep ORDER BY scene_number`, { ep });
    expect(plansBefore.map((r) => Number(r.beat_number))).toEqual([1, 2, 3]);

    const { c } = await connect();
    let resumed;
    try {
      await c.query('BEGIN');
      await c.query('SELECT id FROM scenes WHERE id = $1 FOR UPDATE', [scenesBefore[0].id]);

      // inEpisodeFirstTransaction retries a lock conflict three times, each
      // bounded by lockEpisodes' 10s lock_timeout, then gives up.
      resumed = await resumeEpisodeSetup(models, ep);

      await c.query('ROLLBACK');
    } finally { await c.end(); }

    // 1. the failure happened, and the service says so rather than presenting
    //    a successful unit.
    const step = resumed?.setup_status?.steps?.scene_plan;
    expect(step).toBeDefined();
    expect(step.status).toBe('failed');
    expect(step.created).toBe(0);
    expect(step.sync.outcome).toBe('failed');
    expect(step.sync.warnings.map((w) => w.code)).toContain('sync_failed_retryable');
    // every canonical beat is still reported missing: none of them landed
    expect(step.missing).toEqual(CANON);

    // 2 & 3. the transaction rolled back: the rows it wrote are gone, and the
    //    rows that were already there are byte-identical — not merely equal in
    //    number.
    const plansAfter = await rows(`SELECT beat_number, id, beat_name, scene_set_id, sort_order
      FROM scene_plans WHERE episode_id = :ep ORDER BY beat_number`, { ep });
    const scenesAfter = await rows(`SELECT id, scene_plan_id, scene_number, background_url
      FROM scenes WHERE episode_id = :ep ORDER BY scene_number`, { ep });
    expect(plansAfter).toEqual(plansBefore);
    expect(scenesAfter).toEqual(scenesBefore);
    // and specifically: not one of the beats the unit tried to add survived
    for (const n of CANON.filter((b) => ![1, 2, 3].includes(b))) {
      expect(plansAfter.some((r) => Number(r.beat_number) === n)).toBe(false);
    }
  }, 120000);

  it('a swallowed per-beat INSERT failure cannot commit a partial unit', async () => {
    // createScenePlanRows catches each beat's INSERT and carries on. Inside the
    // unit's single transaction that cannot leave half a plan behind, because
    // PostgreSQL aborts the whole transaction on a failed statement: every
    // later statement is refused 25P02 and the COMMIT discards everything.
    // This pins the database behaviour the atomicity rests on.
    const ep = await episode({ beats: [], withScenes: false });
    const { c } = await connect();
    try {
      await c.query('BEGIN');
      await c.query(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, sort_order, locked, chosen_by_user, ai_suggested, created_at, updated_at)
                     VALUES (gen_random_uuid(), $1, 1, 'good A', 1, false, false, true, NOW(), NOW())`, [ep]);
      // the same beat again: idx_scene_plans_episode_beat refuses it
      await expect(c.query(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, sort_order, locked, chosen_by_user, ai_suggested, created_at, updated_at)
                     VALUES (gen_random_uuid(), $1, 1, 'dupe', 1, false, false, true, NOW(), NOW())`, [ep]))
        .rejects.toMatchObject({ code: '23505' });
      // swallowed, and the loop carries on — but the transaction is aborted
      await expect(c.query(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, sort_order, locked, chosen_by_user, ai_suggested, created_at, updated_at)
                     VALUES (gen_random_uuid(), $1, 2, 'good B', 2, false, false, true, NOW(), NOW())`, [ep]))
        .rejects.toMatchObject({ code: '25P02' });
      await c.query('COMMIT');
    } finally { await c.end(); }

    // nothing at all: not even the beat that inserted cleanly
    expect(await rows('SELECT beat_number FROM scene_plans WHERE episode_id = :ep', { ep })).toEqual([]);
  });

  // ── the direct path cannot be got round ──────────────────────────────────

  it('a direct sync on an episode frozen a moment earlier is held, not a write', async () => {
    const ep = await episode();
    const before = await rows('SELECT id, scene_plan_id, background_url FROM scenes WHERE episode_id = :ep ORDER BY scene_number', { ep });
    await run("UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep", { ep });

    const sync = await beatScenes.syncBeatScenes(sequelize, ep);

    expect(sync).toMatchObject({ outcome: 'held', created: 0, updated: 0, removed: 0, frozen: true });
    expect(await rows('SELECT id, scene_plan_id, background_url FROM scenes WHERE episode_id = :ep ORDER BY scene_number', { ep }))
      .toEqual(before);
  });
});

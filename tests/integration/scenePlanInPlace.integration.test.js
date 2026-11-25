/**
 * Gap 2 (Evoni, 2026-11-25): re-planning preserves identity.
 *
 * A re-plan used to hard-delete every unlocked, un-chosen `scene_plans` row
 * and insert fresh ones, so each beat got a NEW id. The scene tied to the old
 * id was then re-matched by beat NUMBER, which is how a scene could land on a
 * beat it never belonged to; `director_note`, `feed_moment`, `script_lines`
 * and `episode_brief_id` were lost by being absent from the insert.
 *
 * Now the model's whole reply is validated before any write, and the rows that
 * are still there are updated IN PLACE. These tests run the real
 * `generateScenePlan` and the real `POST /generate-plan` route; only the
 * Anthropic SDK is mocked, so the genuine parse, validation, enrichment and
 * transaction code is what executes.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { generateScenePlan } = require('../../src/services/scenePlannerService');
const { CANONICAL_BEATS } = require('../../src/constants/canonicalBeats');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const CANONICAL = CANONICAL_BEATS.map((b) => b.number);

(shouldSkip ? describe.skip : describe)('Re-planning preserves plan identity (Gap 2)', () => {
  const show = uuid();
  let token;
  let setA;
  let setB;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  /** A reply the planner would accept: one entry per canonical beat. */
  const reply = (setId, tag, overrides = {}) => CANONICAL.map((n) => ({
    beat_number: n,
    beat_name: `${tag} beat ${n}`,
    scene_set_id: setId,
    angle_label: 'WIDE',
    shot_type: 'medium',
    emotional_intent: `${tag} intent ${n}`,
    transition_in: 'cut',
    confidence: 0.9,
    ...overrides,
  }));
  const answer = (beats) => mockCreate.mockResolvedValueOnce({ content: [{ text: JSON.stringify(beats) }] });

  /** An episode with a complete, AI-suggested plan already saved. */
  async function planned(setId = setA) {
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'In-place ep', :n, 'draft', NOW(), NOW())`,
      { ep, show, n: Math.floor(Math.random() * 100000) + 500 });
    const brief = uuid();
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, status, created_at, updated_at)
               VALUES (:brief, :ep, :show, 'draft', NOW(), NOW())`, { brief, ep, show });
    for (const n of CANONICAL) {
      await run(`INSERT INTO scene_plans (id, episode_id, episode_brief_id, beat_number, beat_name, scene_set_id,
                   angle_label, shot_type, emotional_intent, transition_in, sort_order, locked, chosen_by_user,
                   ai_suggested, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, :brief, :n, :name, :setId, 'WIDE', 'establishing',
                   :intent, 'cut', :n, false, false, true, NOW(), NOW())`,
      { ep, brief, n, name: `Original beat ${n}`, setId, intent: `original intent ${n}` });
    }
    return { ep, brief };
  }

  const planRows = (ep) => rows(`SELECT id, beat_number, beat_name, scene_set_id, shot_type, emotional_intent,
      transition_in, director_note, episode_brief_id, locked, chosen_by_user, ai_suggested, sort_order,
      (feed_moment IS NOT NULL) AS has_feed_moment, (script_lines IS NOT NULL) AS has_script_lines
    FROM scene_plans WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY beat_number`, { ep });
  const allPlanRows = (ep) => rows(`SELECT id, beat_number, beat_name, (deleted_at IS NOT NULL) AS tombstoned
    FROM scene_plans WHERE episode_id = :ep ORDER BY beat_number`, { ep });
  const at = (list, n) => list.find((r) => Number(r.beat_number) === n);
  const brief = { episode_archetype: 'glam', narrative_purpose: 'test' };
  const replan = (ep) => generateScenePlan(ep, show, brief, { save: true });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-plan-in-place', email: 'user@inplace.dev', name: 'Editor', groups: ['ADMIN'], role: 'ADMIN',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `In place ${show.slice(0, 8)}`, slug: `in-place-${show.slice(0, 8)}` });
    for (const key of ['a', 'b']) {
      const id = uuid();
      if (key === 'a') setA = id; else setB = id;
      await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, base_still_url, script_context,
                   generation_status, created_at, updated_at)
                 VALUES (:id, :name, 'EVENT_LOCATION', :show, :base, :ctx, 'complete', NOW(), NOW())`,
      { id, name: `Set ${key} ${id.slice(0, 6)}`, show, base: `https://x/${key}.jpg`, ctx: `Context ${key}` });
      await run(`INSERT INTO scene_angles (id, scene_set_id, angle_label, angle_name, still_image_url,
                   generation_status, created_at, updated_at)
                 VALUES (gen_random_uuid(), :id, 'WIDE', 'Wide', :url, 'complete', NOW(), NOW())`,
      { id, url: `https://x/${key}-wide.jpg` });
    }
  });

  beforeEach(() => mockCreate.mockReset());
  afterAll(async () => { delete process.env.LEGACY_TIMELINE_WRITES; });

  // ── validation: the whole reply, before any write ────────────────────────

  it.each([
    ['fewer beats than the canonical set', (s) => reply(s, 'short').slice(0, 6)],
    ['a duplicated beat number', (s) => [...reply(s, 'dup').slice(0, 13), { ...reply(s, 'dup')[12] }]],
    ['a beat number outside the canonical set', (s) => [...reply(s, 'odd').slice(0, 13), { ...reply(s, 'odd')[0], beat_number: 99 }]],
    ['more beats than the canonical set', (s) => [...reply(s, 'many'), { ...reply(s, 'many')[0], beat_number: 15 }]],
    ['a beat number that is not a whole number', (s) => [...reply(s, 'frac').slice(0, 13), { ...reply(s, 'frac')[0], beat_number: 'two' }]],
    ['no beats at all', () => []],
  ])('refuses %s and writes nothing', async (_label, build) => {
    const { ep } = await planned();
    const before = await allPlanRows(ep);
    answer(build(setA));

    await expect(replan(ep)).rejects.toMatchObject({ code: 'PLAN_OUTPUT_INVALID' });

    // Not one row touched: ids, content and row count are as they were.
    expect(await allPlanRows(ep)).toEqual(before);
  });

  it('names the problems it found, for the log and the operator', async () => {
    const { ep } = await planned();
    answer(reply(setA, 'short').slice(0, 6));
    await expect(replan(ep)).rejects.toMatchObject({
      code: 'PLAN_OUTPUT_INVALID',
      problems: expect.arrayContaining([expect.stringContaining('missing')]),
    });
  });

  it('sorts a valid but out-of-order reply by beat_number before enrichment', async () => {
    const { ep } = await planned();
    // Shuffled, and with no beat_name at all: the enrichment reads the
    // canonical list by ARRAY INDEX, so only a correct sort gives each beat
    // its own canonical name.
    const shuffled = [...CANONICAL].sort(() => (Math.random() < 0.5 ? 1 : -1))
      .map((n) => ({ beat_number: n, scene_set_id: setA, angle_label: 'WIDE', shot_type: 'medium', transition_in: 'cut', confidence: 0.8 }));
    answer(shuffled);

    await replan(ep);

    const after = await planRows(ep);
    for (const beat of CANONICAL_BEATS) {
      expect(at(after, beat.number).beat_name).toBe(beat.name);
    }
  });

  // ── identity and preservation ────────────────────────────────────────────

  it('keeps every surviving plan row id, and never writes beat_number', async () => {
    const { ep } = await planned();
    const before = await planRows(ep);
    answer(reply(setA, 'second'));

    await replan(ep);

    const after = await planRows(ep);
    expect(after.map((r) => r.id)).toEqual(before.map((r) => r.id));
    expect(after.map((r) => Number(r.beat_number))).toEqual(before.map((r) => Number(r.beat_number)));
    expect(after).toHaveLength(CANONICAL.length);
    // and the AI-owned fields did regenerate, so this is not a no-op
    expect(at(after, 5).beat_name).toBe('second beat 5');
  });

  it('keeps the operator\'s own writing and the beat\'s brief link', async () => {
    const { ep, brief: briefId } = await planned();
    await run(`UPDATE scene_plans SET director_note = 'Keep her hands busy',
                 feed_moment = '{"caption":"mine"}'::jsonb, script_lines = '["my line"]'::jsonb
               WHERE episode_id = :ep AND beat_number = 4`, { ep });
    answer(reply(setA, 'third'));

    await replan(ep);

    const row = at(await planRows(ep), 4);
    expect(row.director_note).toBe('Keep her hands busy');
    expect(row.has_feed_moment).toBe(true);
    expect(row.has_script_lines).toBe(true);
    expect(row.episode_brief_id).toBe(briefId);
    // every beat keeps its brief link, not only the edited one
    expect((await planRows(ep)).every((r) => r.episode_brief_id === briefId)).toBe(true);
  });

  it('keeps the three operator-editable fields on a beat she has edited, and regenerates them elsewhere', async () => {
    const { ep } = await planned();
    // The beat editor's own write: ai_suggested goes false (episodeBriefRoutes).
    await run(`UPDATE scene_plans SET ai_suggested = false, shot_type = 'close',
                 emotional_intent = 'She hesitates', transition_in = 'wipe'
               WHERE episode_id = :ep AND beat_number = 7`, { ep });
    answer(reply(setA, 'fourth'));

    await replan(ep);

    const after = await planRows(ep);
    const edited = at(after, 7);
    expect(edited.shot_type).toBe('close');
    expect(edited.emotional_intent).toBe('She hesitates');
    expect(edited.transition_in).toBe('wipe');
    // the marker survives, so the next re-plan protects her again
    expect(edited.ai_suggested).toBe(false);
    // the AI-owned fields on that same row still regenerate
    expect(edited.beat_name).toBe('fourth beat 7');
    // an untouched beat takes the new values
    const untouched = at(after, 8);
    expect(untouched.emotional_intent).toBe('fourth intent 8');
    expect(untouched.ai_suggested).toBe(true);
  });

  it('leaves a locked beat and a chosen beat byte-identical', async () => {
    const { ep } = await planned();
    await run('UPDATE scene_plans SET locked = true WHERE episode_id = :ep AND beat_number = 1', { ep });
    await run('UPDATE scene_plans SET chosen_by_user = true WHERE episode_id = :ep AND beat_number = 2', { ep });
    const before = await planRows(ep);
    answer(reply(setB, 'fifth'));

    await replan(ep);

    const after = await planRows(ep);
    expect(at(after, 1)).toEqual(at(before, 1));
    expect(at(after, 2)).toEqual(at(before, 2));
    // and the writable beats did move to the new set
    expect(at(after, 3).scene_set_id).toBe(setB);
  });

  it('inserts a canonical beat that is genuinely absent, without disturbing the rest', async () => {
    const { ep } = await planned();
    await run('DELETE FROM scene_plans WHERE episode_id = :ep AND beat_number = 9', { ep });
    const before = await planRows(ep);
    expect(before).toHaveLength(CANONICAL.length - 1);
    answer(reply(setA, 'sixth'));

    await replan(ep);

    const after = await planRows(ep);
    expect(after).toHaveLength(CANONICAL.length);
    expect(at(after, 9).beat_name).toBe('sixth beat 9');
    expect(at(after, 9).ai_suggested).toBe(true);
    // the rows that were already there kept their ids
    for (const r of before) expect(at(after, Number(r.beat_number)).id).toBe(r.id);
  });

  // ── historical irregularities ────────────────────────────────────────────

  it('leaves a non-canonical historical row alone and reports it through the existing coverage', async () => {
    const { ep } = await planned();
    // A row a past unvalidated re-plan could leave behind.
    await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, sort_order, locked,
                 chosen_by_user, ai_suggested, created_at, updated_at)
               VALUES (gen_random_uuid(), :ep, 17, 'Legacy beat 17', 17, false, false, true, NOW(), NOW())`, { ep });
    answer(reply(setA, 'seventh'));

    await replan(ep);

    const after = await planRows(ep);
    const legacy = at(after, 17);
    expect(legacy).toBeDefined();
    expect(legacy.beat_name).toBe('Legacy beat 17');          // untouched, not renumbered

    // reported, not erased: the plan read's existing coverage field says so
    const res = await auth(request(app).get(`/api/v1/episode-brief/${ep}/plan`));
    expect(res.status).toBe(200);
    expect(res.body.coverage).toMatchObject({ complete: false, unknown: 1 });
  });

  it('refuses with PLAN_BEAT_UNAVAILABLE when a soft-deleted row holds a canonical beat, and rolls back', async () => {
    const { ep } = await planned();
    await run('UPDATE scene_plans SET deleted_at = NOW() WHERE episode_id = :ep AND beat_number = 6', { ep });
    const before = await allPlanRows(ep);
    answer(reply(setA, 'eighth'));

    await expect(replan(ep)).rejects.toMatchObject({ code: 'PLAN_BEAT_UNAVAILABLE', beats: [6] });

    // nothing written, and the tombstone is neither deleted nor renumbered
    expect(await allPlanRows(ep)).toEqual(before);
  });

  // ── the response contracts ───────────────────────────────────────────────

  it('answers 409 PLAN_OUTPUT_INVALID on the route, never 500 and never RETRY', async () => {
    const { ep } = await planned();
    const before = await allPlanRows(ep);
    answer(reply(setA, 'ninth').slice(0, 10));

    const res = await auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-plan`));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PLAN_OUTPUT_INVALID');
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not changed|Nothing was saved/i);
    expect(await allPlanRows(ep)).toEqual(before);
  });

  it('answers 409 PLAN_BEAT_UNAVAILABLE naming the beats, and does not promise a retry will fix it', async () => {
    const { ep } = await planned();
    await run('UPDATE scene_plans SET deleted_at = NOW() WHERE episode_id = :ep AND beat_number = 11', { ep });
    answer(reply(setA, 'tenth'));

    const res = await auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-plan`));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PLAN_BEAT_UNAVAILABLE');
    expect(res.body.beats).toEqual([11]);
    expect(res.body.error).toMatch(/needs review/i);
    expect(res.body.code).not.toBe('RETRY');
  });

  it('reports a changed location and whether the beat carries saved work, and stores nothing for it', async () => {
    const { ep } = await planned();
    const planned4 = at(await planRows(ep), 4);
    // a saved scene with the operator's background on beat 4
    await run(`INSERT INTO scenes (id, episode_id, scene_plan_id, scene_number, title, background_url, created_at, updated_at)
               VALUES (gen_random_uuid(), :ep, :plan, 4, 'Beat 4', 'https://x/hers.png', NOW(), NOW())`,
      { ep, plan: planned4.id });
    answer(reply(setB, 'eleventh'));                  // every beat moves to set B

    const res = await auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-plan`));

    expect(res.status).toBe(200);
    const four = res.body.plan_changes.find((c) => c.beat_number === 4);
    expect(four).toMatchObject({ changed: expect.arrayContaining(['scene_set_id']), has_saved_work: true });
    // nothing is persisted for the report
    const cols = await rows(`SELECT column_name FROM information_schema.columns
      WHERE table_name = 'scene_plans' AND column_name LIKE '%plan_change%'`);
    expect(cols).toHaveLength(0);
  });

  it('reports no changes on a first plan, where every beat is new', async () => {
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Fresh ep', :n, 'draft', NOW(), NOW())`,
      { ep, show, n: Math.floor(Math.random() * 100000) + 500 });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, status, created_at, updated_at)
               VALUES (gen_random_uuid(), :ep, :show, 'draft', NOW(), NOW())`, { ep, show });
    answer(reply(setA, 'twelfth'));

    const res = await auth(request(app).post(`/api/v1/episode-brief/${ep}/generate-plan`));

    expect(res.status).toBe(200);
    expect(res.body.plan_changes).toEqual([]);
    expect(await planRows(ep)).toHaveLength(CANONICAL.length);
  });

  // ── saved scenes and their linked work ───────────────────────────────────

  it('keeps each saved scene on its own beat, including after the operator reorders them', async () => {
    const { ep } = await planned();
    const before = await planRows(ep);
    // scenes for beats 1-3, then the operator reorders them to 3,1,2
    for (const n of [1, 2, 3]) {
      await run(`INSERT INTO scenes (id, episode_id, scene_plan_id, scene_number, title, background_url, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, :plan, :n, :title, :bg, NOW(), NOW())`,
      { ep, plan: at(before, n).id, n, title: `Beat ${n}`, bg: `https://x/saved-${n}.png` });
    }
    // Two steps through free numbers: on the legacy shape a single statement
    // permuting 1,2,3 trips the partial unique (episode_id, scene_number),
    // which is the index's doing and not this case's subject.
    await run(`UPDATE scenes SET scene_number = CASE scene_number WHEN 1 THEN 1003 WHEN 2 THEN 1001 WHEN 3 THEN 1002 END
               WHERE episode_id = :ep AND scene_number IN (1,2,3)`, { ep });
    await run(`UPDATE scenes SET scene_number = scene_number - 1000
               WHERE episode_id = :ep AND scene_number IN (1001,1002,1003)`, { ep });
    const scenesBefore = await rows(`SELECT id, scene_plan_id, scene_number, background_url FROM scenes
      WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY scene_plan_id`, { ep });
    answer(reply(setA, 'thirteenth'));

    await replan(ep);

    const scenesAfter = await rows(`SELECT id, scene_plan_id, scene_number, background_url FROM scenes
      WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY scene_plan_id`, { ep });
    // same rows, same beats, same numbering, same images: the re-plan moved none of it
    expect(scenesAfter).toEqual(scenesBefore);
  });

  it('keeps a scene\'s linked creative records attached to the same scene', async () => {
    const { ep } = await planned();
    const planRow = at(await planRows(ep), 2);
    const scene = uuid();
    await run(`INSERT INTO scenes (id, episode_id, scene_plan_id, scene_number, title, created_at, updated_at)
               VALUES (:scene, :ep, :plan, 2, 'Beat 2', NOW(), NOW())`, { scene, ep, plan: planRow.id });
    const piece = uuid();
    await run(`INSERT INTO wardrobe (id, name, clothing_category, show_id, created_at, updated_at)
               VALUES (:piece, :name, 'top', :show, NOW(), NOW())`, { piece, name: `Look ${piece.slice(0, 6)}`, show });
    await run(`INSERT INTO episode_wardrobe (id, episode_id, scene_id, wardrobe_id, created_at, updated_at)
               VALUES (gen_random_uuid(), :ep, :scene, :piece, NOW(), NOW())`, { ep, scene, piece });
    answer(reply(setA, 'fourteenth'));

    await replan(ep);

    const linked = await rows(`SELECT scene_id FROM episode_wardrobe
      WHERE episode_id = :ep AND deleted_at IS NULL`, { ep });
    expect(linked).toEqual([{ scene_id: scene }]);
    expect(await rows('SELECT scene_plan_id FROM scenes WHERE id = :scene', { scene }))
      .toEqual([{ scene_plan_id: planRow.id }]);
  });

  // ── two overlapping re-plans, deterministic ──────────────────────────────

  describe('two overlapping re-plans', () => {
    const { Client } = require('pg');
    /** A second, real connection, so the interleaving is genuine. */
    const connect = async () => {
      const c = new Client({ connectionString: process.env.DATABASE_URL });
      await c.connect();
      const pid = (await c.query('SELECT pg_backend_pid() AS p')).rows[0].p;
      return { c, pid };
    };
    /** Resolves once this backend is observably waiting on a lock. */
    const waitingOnLock = async (pid) => {
      for (let i = 0; i < 400; i += 1) {
        const r = await rows('SELECT wait_event_type FROM pg_stat_activity WHERE pid = :pid', { pid });
        if (r[0]?.wait_event_type === 'Lock') return true;
        await new Promise((res) => setTimeout(res, 25));
      }
      return false;
    };

    it('serializes on the plan rows: the second waits, then commits, with no duplicate beat and no lost row', async () => {
      const { ep } = await planned();
      const before = await planRows(ep);
      const { c, pid } = await connect();
      try {
        // The other transaction holds every plan row of this episode, exactly
        // as the save's own read does (ascending, in one statement).
        await c.query('BEGIN');
        await c.query("SET LOCAL lock_timeout = '10s'");
        await c.query('SELECT id FROM scene_plans WHERE episode_id = $1 ORDER BY beat_number ASC FOR UPDATE', [ep]);

        answer(reply(setA, 'raced'));
        const replanning = replan(ep);
        // Observed, not timed: the re-plan's own backend is waiting on a lock.
        const waiter = await pidOfWaiter(pid);
        expect(waiter).toBeGreaterThan(0);
        expect(await waitingOnLock(waiter)).toBe(true);

        await c.query('COMMIT');
        await replanning;                             // completes once the lock is free
      } finally {
        await c.query('ROLLBACK').catch(() => {});
        await c.end();
      }

      const after = await planRows(ep);
      expect(after.map((r) => r.id)).toEqual(before.map((r) => r.id));
      expect(after).toHaveLength(CANONICAL.length);
      expect(new Set(after.map((r) => Number(r.beat_number))).size).toBe(CANONICAL.length);
    });

    it('never leaks a bare 23505 when both re-plans insert the same missing beat', async () => {
      const { ep } = await planned();
      await run('DELETE FROM scene_plans WHERE episode_id = :ep AND beat_number = 12', { ep });
      const { c } = await connect();
      try {
        // The other transaction inserts beat 12 and commits, while this
        // episode's re-plan is about to conclude the beat is missing.
        await c.query('BEGIN');
        await c.query(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, sort_order, locked,
            chosen_by_user, ai_suggested, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, 12, 'Raced in', 12, false, false, true, NOW(), NOW())`, [ep]);
        await c.query('COMMIT');

        answer(reply(setA, 'upserted'));
        // The guarded upsert resolves the conflict into an update instead of
        // raising a unique violation at the operator.
        await expect(replan(ep)).resolves.toBeDefined();
      } finally {
        await c.end();
      }

      const after = await planRows(ep);
      expect(after).toHaveLength(CANONICAL.length);
      expect(after.filter((r) => Number(r.beat_number) === 12)).toHaveLength(1);
      expect(at(after, 12).beat_name).toBe('upserted beat 12');
    });
  });

  /** The backend running the re-plan: the one that is not ours and not theirs. */
  async function pidOfWaiter(otherPid) {
    for (let i = 0; i < 400; i += 1) {
      const r = await rows(`SELECT pid FROM pg_stat_activity
        WHERE pid <> :other AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'
          AND query ILIKE '%scene_plans%'`, { other: otherPid });
      if (r[0]) return r[0].pid;
      await new Promise((res) => setTimeout(res, 25));
    }
    return -1;
  }
});

/**
 * P1 guarded repair (Evoni, 2026-11-26): moving beats off a removed scene set
 * is available again, under locks and a freeze check.
 *
 * SUPERSEDES tests/integration/moveRemovedSetsDisabled.integration.test.js,
 * which pinned the temporary 503 MOVE_REMOVED_SETS_DISABLED. That protection
 * is not dropped, it is strengthened: the cases below prove the refusal on an
 * accepted episode, a filmed one, an episode reachable only through an event,
 * and a multi-move where one episode is frozen — each with a before/after
 * snapshot showing byte-identical links, beats, ANGLE LABELS, scenes, events
 * and looks, which the 503 suite could only show for a route that did nothing
 * at all.
 *
 * The guarantee, stated as it is rather than more strongly: the waited locks
 * (episodes and events) are taken in one globally ascending order, and every
 * scene_sets lock is NOWAIT, so a scene_sets conflict fails at once (55P03)
 * and is retried by the existing bounded infrastructure rather than waiting.
 * That is not a claim that the whole operation is categorically deadlock-free
 * — the cases below measure the real orders instead of asserting it.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const uses = require('../../src/services/sceneSetUsesService');
const lockTrace = require('../helpers/lockTrace');
const { waitForLockWait } = require('../helpers/placeLockFixtures');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('P1 guarded: moving beats off a removed scene set', () => {
  const show = uuid();
  const tokens = {};
  let trace = null;

  beforeAll(async () => {
    tokens.admin = TokenService.generateTokenPair({ id: 'gmm-admin', email: 'a@gmm.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    tokens.editor = TokenService.generateTokenPair({ id: 'gmm-editor', email: 'e@gmm.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, '{"starting_balance":1000}'::jsonb, NOW(), NOW())`,
    { show, name: `GMM ${show.slice(0, 8)}`, slug: `gmm-${show.slice(0, 8)}` });
  });

  afterEach(() => {
    if (trace) { trace.uninstall(); trace = null; }
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await run('DELETE FROM scene_set_looks WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)', { show }).catch(() => {});
    for (const t of ['scenes', 'scene_plans', 'scene_set_episodes', 'episode_briefs', 'episode_raw_clips']) {
      await run(`DELETE FROM ${t} WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show }).catch(() => {});
    }
    await run('UPDATE world_events SET scene_set_id = NULL, used_in_episode_id = NULL WHERE show_id = :show', { show }).catch(() => {});
    await run('DELETE FROM world_events WHERE show_id = :show', { show }).catch(() => {});
    await run('DELETE FROM episodes WHERE show_id = :show', { show }).catch(() => {});
    await run('UPDATE scene_sets SET version_of_set_id = NULL WHERE show_id = :show', { show }).catch(() => {});
    await run('DELETE FROM scene_sets WHERE show_id = :show', { show }).catch(() => {});
    await run('DELETE FROM shows WHERE show_id IS NULL AND id = :show', { show }).catch(() => {});
    await run('DELETE FROM shows WHERE id = :show', { show }).catch(() => {});
  });

  // ── fixtures ───────────────────────────────────────────────────────────
  async function set(name, { deleted = false } = {}) {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, generation_status, show_id, base_still_url, script_context, deleted_at, created_at, updated_at)
               VALUES (:id, :name, 'EVENT_LOCATION', 'complete', :show, :url, 'ctx', :deletedAt, NOW(), NOW())`,
    { id, name: `${name} ${id.slice(0, 6)}`, show, url: `https://x/${id.slice(0, 6)}.png`, deletedAt: deleted ? new Date() : null });
    return id;
  }

  /** An episode using `setId` through a link, two beats with angles, scenes, its event and a look. */
  async function episodeUsing(setId, { accepted = false, filmed = false, role = 'home' } = {}) {
    const ep = uuid();
    const ev = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:ep, :show, 'GMM ep', :n, 'draft', NULL, NOW(), NOW())`,
    { ep, show, n: Math.floor(Math.random() * 100000) + 900 });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, scene_set_id, used_in_episode_id, created_at, updated_at)
               VALUES (:ev, :show, :name, 'invite', 'used', 5, :setId, :ep, NOW(), NOW())`,
    { ev, show, name: `GMM event ${ev.slice(0, 6)}`, setId, ep });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at)
               VALUES (gen_random_uuid(), :ep, :show, :ev, 'draft', NOW(), NOW())`, { ep, show, ev });
    await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, role_name, sort_order, created_at, updated_at)
               VALUES (gen_random_uuid(), :setId, :ep, :role, NULL, 1, NOW(), NOW())`, { setId, ep, role });
    for (const n of [1, 2]) {
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, sort_order, locked, ai_suggested, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, :n, :name, :setId, 'WIDE', :n, false, true, NOW(), NOW())`,
      { ep, n, name: `Beat ${n}`, setId });
    }
    const [plan] = await rows('SELECT id FROM scene_plans WHERE episode_id = :ep ORDER BY beat_number LIMIT 1', { ep });
    await run(`INSERT INTO scenes (id, episode_id, scene_number, title, scene_set_id, scene_plan_id, created_at, updated_at)
               VALUES (gen_random_uuid(), :ep, 1, 'Scene 1', :setId, :planId, NOW(), NOW())`, { ep, setId, planId: plan.id });
    await run(`INSERT INTO scene_set_looks (id, scene_set_id, event_id, status, created_at, updated_at)
               VALUES (gen_random_uuid(), :setId, :ev, 'complete', NOW(), NOW())`, { setId, ev }).catch(() => {});
    if (filmed) {
      await run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, :show, 'lala', :key, 'none', 'low', NOW(), NOW())`,
      { ep, show, key: `raw/${ep.slice(0, 8)}.mp4` });
    }
    if (accepted) await run("UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep", { ep });
    return { ep, ev };
  }

  const snapshot = async (ep, ev) => ({
    links: await rows('SELECT scene_set_id, role, role_name, deleted_at FROM scene_set_episodes WHERE episode_id = :ep ORDER BY scene_set_id', { ep }),
    beats: await rows('SELECT beat_number, scene_set_id, angle_label FROM scene_plans WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY beat_number', { ep }),
    scenes: await rows('SELECT scene_number, scene_set_id FROM scenes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY scene_number', { ep }),
    events: await rows('SELECT id, scene_set_id FROM world_events WHERE id = :ev', { ev }),
    looks: await rows('SELECT scene_set_id, event_id FROM scene_set_looks WHERE event_id = :ev ORDER BY scene_set_id', { ev }),
  });

  const post = (ep, token, moves) => {
    const r = request(app).post(`/api/v1/episodes/${ep}/move-removed-sets`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return r.send({ moves });
  };

  // ══════════════════════════════════════════════════════════════════════
  // 1. THE FREEZE, BEFORE ANY WRITE
  // ══════════════════════════════════════════════════════════════════════
  describe('a frozen episode', () => {
    test('accepted: 409 EPISODE_ACCEPTED, naming the episode, and nothing at all is written', async () => {
      const gone = await set('acc gone', { deleted: true });
      const live = await set('acc live');
      const { ep, ev } = await episodeUsing(gone, { accepted: true });
      const before = await snapshot(ep, ev);

      trace = lockTrace.install(sequelize);
      const res = await post(ep, tokens.admin, [{ from: gone, to: live }]);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EPISODE_ACCEPTED');
      expect(Array.isArray(res.body.episodes)).toBe(true);
      expect(res.body.episodes.map((e) => String(e.id))).toContain(ep);
      expect(await snapshot(ep, ev)).toEqual(before);

      // BEFORE any write, not "written then rolled back". A snapshot alone
      // cannot tell those apart, because the rollback erases both — so the
      // trace is asserted: not one statement that writes a row the move
      // touches was ever sent.
      const MOVED = ['scene_set_episodes', 'scene_plans', 'scenes', 'world_events', 'scene_set_looks'];
      const writes = trace.records.filter((r) => (r.kind === 'write' || r.kind === 'insert') && MOVED.includes(r.table));
      expect(writes).toEqual([]);
    });

    test('filmed: 409 EPISODE_SNAPSHOT_FROZEN, and nothing at all is written', async () => {
      const gone = await set('film gone', { deleted: true });
      const live = await set('film live');
      const { ep, ev } = await episodeUsing(gone, { filmed: true });
      const before = await snapshot(ep, ev);

      const res = await post(ep, tokens.admin, [{ from: gone, to: live }]);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EPISODE_SNAPSHOT_FROZEN');
      expect(res.body.episode_id).toBe(ep);
      expect(await snapshot(ep, ev)).toEqual(before);
    });

    test('an episode reached only through the event is protected too', async () => {
      // The request names a DRAFT episode. Its own event stays stamped on it,
      // but an ACCEPTED episode has a live BRIEF naming that same event — the
      // two-part special that utils/eventEpisodeLink.linkedLiveEpisodes
      // documents, where Part 2's brief copies event_id. The accepted episode
      // is therefore in the removed set's reference set even though it holds
      // no link, beat or scene of its own, and
      // assertNoAcceptedOrFilmedUses checks the WHOLE set, so the batch is
      // refused. (MEASURED: repointing used_in_episode_id instead takes the
      // event out of the draft's own scoped reference set, so that variant
      // proves nothing — setReferences scopes events by used_in_episode_id.)
      const gone = await set('via gone', { deleted: true });
      const live = await set('via live');
      const { ep: draft, ev } = await episodeUsing(gone);
      const accepted = uuid();
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
                 VALUES (:id, :show, 'GMM accepted', :n, 'draft', 'accepted', NOW(), NOW())`,
      { id: accepted, show, n: Math.floor(Math.random() * 100000) + 1200 });
      await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at)
                 VALUES (gen_random_uuid(), :accepted, :show, :ev, 'draft', NOW(), NOW())`, { accepted, show, ev });
      const before = await snapshot(draft, ev);

      const res = await post(draft, tokens.admin, [{ from: gone, to: live }]);

      expect(res.status).toBe(409);
      expect(['EPISODE_ACCEPTED', 'EPISODE_SNAPSHOT_FROZEN']).toContain(res.body.code);
      expect(await snapshot(draft, ev)).toEqual(before);
    });

    test('a multi-move where ONE episode is frozen performs zero writes for every move', async () => {
      // Two removed sets on one episode: the episode is accepted, so neither
      // move may happen. Whole-request atomicity, proved on the draft rows of
      // BOTH sources.
      const goneA = await set('multi A', { deleted: true });
      const goneB = await set('multi B', { deleted: true });
      const live = await set('multi live');
      const { ep, ev } = await episodeUsing(goneA, { accepted: true });
      await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, role_name, sort_order, created_at, updated_at)
                 VALUES (gen_random_uuid(), :setId, :ep, 'closet', NULL, 2, NOW(), NOW())`, { setId: goneB, ep });
      const before = await snapshot(ep, ev);

      const res = await post(ep, tokens.admin, [{ from: goneA, to: live }, { from: goneB, to: live }]);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EPISODE_ACCEPTED');
      expect(await snapshot(ep, ev)).toEqual(before);
      expect((await snapshot(ep, ev)).links.some((l) => l.scene_set_id === live)).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 2. A DRAFT REPAIR STILL BEHAVES EXACTLY AS IT DID
  // ══════════════════════════════════════════════════════════════════════
  describe('a draft episode', () => {
    test('two removed sets move to two replacements: beats, scenes, event and look follow, angles are placed again', async () => {
      const goneA = await set('d A', { deleted: true });
      const goneB = await set('d B', { deleted: true });
      const newA = await set('d newA');
      const newB = await set('d newB');
      const { ep, ev } = await episodeUsing(goneA);
      await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, role_name, sort_order, created_at, updated_at)
                 VALUES (gen_random_uuid(), :setId, :ep, 'closet', NULL, 2, NOW(), NOW())`, { setId: goneB, ep });
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, sort_order, locked, ai_suggested, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, 13, 'Beat 13', :setId, 'WIDE', 13, false, true, NOW(), NOW())`, { ep, setId: goneB });

      const res = await post(ep, tokens.admin, [{ from: goneA, to: newA }, { from: goneB, to: newB }]);

      expect(res.status).toBe(200);
      const after = await snapshot(ep, ev);
      expect(after.beats.map((b) => [b.beat_number, b.scene_set_id])).toEqual([[1, newA], [2, newA], [13, newB]]);
      // The angle is placed again on the replacement, as moveUses has always done.
      expect(after.beats.every((b) => b.angle_label === null)).toBe(true);
      expect(after.scenes.every((s) => s.scene_set_id === newA)).toBe(true);
      expect(after.events[0].scene_set_id).toBe(newA);
      if (after.looks.length) expect(after.looks[0].scene_set_id).toBe(newA);
      expect((await rows('SELECT scene_set_id FROM scene_set_episodes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY sort_order', { ep })).map((l) => l.scene_set_id))
        .toEqual([newA, newB]);
      expect((await request(app).get(`/api/v1/episodes/${ep}/removed-sets`).set('Authorization', `Bearer ${tokens.admin}`)).body.data).toEqual([]);
    });

    test('role merging still prefers the named role and keeps an extra\'s name', async () => {
      const goneA = await set('m gone extra', { deleted: true });
      const goneB = await set('m gone named', { deleted: true });
      const keepHome = await set('m keep home');
      const keepNone = await set('m keep none');
      const { ep } = await episodeUsing(goneA, { role: 'extra' });
      await run(`UPDATE scene_set_episodes SET role_name = 'Car' WHERE episode_id = :ep AND scene_set_id = :setId`, { ep, setId: goneA });
      await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, role_name, sort_order, created_at, updated_at)
                 VALUES (gen_random_uuid(), :goneB, :ep, 'extra', 'Café', 2, NOW(), NOW()),
                        (gen_random_uuid(), :keepHome, :ep, 'home', NULL, 3, NOW(), NOW()),
                        (gen_random_uuid(), :keepNone, :ep, NULL, NULL, 4, NOW(), NOW())`,
      { goneB, keepHome, keepNone, ep });

      const res = await post(ep, tokens.admin, [{ from: goneA, to: keepHome }, { from: goneB, to: keepNone }]);

      expect(res.status).toBe(200);
      expect(await rows('SELECT scene_set_id, role, role_name FROM scene_set_episodes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY sort_order', { ep }))
        .toEqual([{ scene_set_id: keepHome, role: 'home', role_name: null }, { scene_set_id: keepNone, role: 'extra', role_name: 'Café' }]);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 3. VALIDATION, WITHOUT TOUCHING DATA
  // ══════════════════════════════════════════════════════════════════════
  describe('a request that cannot be answered', () => {
    test.each([
      ['an empty batch', () => []],
      ['a duplicate source', (g, l) => [{ from: g, to: l }, { from: g, to: l }]],
      ['a non-uuid replacement', (g) => [{ from: g, to: 'not-a-uuid' }]],
    ])('%s is refused with nothing written', async (_label, build) => {
      const gone = await set('v gone', { deleted: true });
      const live = await set('v live');
      const { ep, ev } = await episodeUsing(gone);
      const before = await snapshot(ep, ev);

      const res = await post(ep, tokens.admin, build(gone, live));

      expect(res.status).toBe(400);
      expect(await snapshot(ep, ev)).toEqual(before);
    });

    test('a chained move — a replacement that is another move\'s removed set — is refused', async () => {
      const goneA = await set('c A', { deleted: true });
      const goneB = await set('c B', { deleted: true });
      const { ep, ev } = await episodeUsing(goneA);
      await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, role_name, sort_order, created_at, updated_at)
                 VALUES (gen_random_uuid(), :setId, :ep, 'closet', NULL, 2, NOW(), NOW())`, { setId: goneB, ep });
      const before = await snapshot(ep, ev);

      const res = await post(ep, tokens.admin, [{ from: goneA, to: goneB }, { from: goneB, to: goneA }]);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BAD_REPLACEMENT');
      expect(await snapshot(ep, ev)).toEqual(before);
    });

    test('a removed replacement is refused under the locks, and nothing is written', async () => {
      const gone = await set('r gone', { deleted: true });
      const alsoGone = await set('r also gone', { deleted: true });
      const { ep, ev } = await episodeUsing(gone);
      const before = await snapshot(ep, ev);

      const res = await post(ep, tokens.admin, [{ from: gone, to: alsoGone }]);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BAD_REPLACEMENT');
      expect(await snapshot(ep, ev)).toEqual(before);
    });

    test('a source this episode does not use is refused', async () => {
      const gone = await set('u gone', { deleted: true });
      const other = await set('u other', { deleted: true });
      const live = await set('u live');
      const { ep, ev } = await episodeUsing(gone);
      const before = await snapshot(ep, ev);

      const res = await post(ep, tokens.admin, [{ from: other, to: live }]);

      expect(res.status).toBe(400);
      expect(await snapshot(ep, ev)).toEqual(before);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 4. THE LOCK ORDER, MEASURED
  // ══════════════════════════════════════════════════════════════════════
  describe('the order the batch takes its rows in', () => {
    test('every episode first, then the events, then the scene sets — each class ascending, every set row NOWAIT', async () => {
      const goneA = await set('o A', { deleted: true });
      const goneB = await set('o B', { deleted: true });
      const live = await set('o live');
      const { ep } = await episodeUsing(goneA);
      await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, role_name, sort_order, created_at, updated_at)
                 VALUES (gen_random_uuid(), :setId, :ep, 'closet', NULL, 2, NOW(), NOW())`, { setId: goneB, ep });

      trace = lockTrace.install(sequelize);
      const res = await post(ep, tokens.admin, [{ from: goneA, to: live }, { from: goneB, to: live }]);
      expect(res.status).toBe(200);

      const locks = trace.records.filter((r) => r.kind === 'lock');
      const classOf = (t) => (t === 'episodes' ? 0 : t === 'world_events' ? 1 : t === 'scene_sets' ? 2 : -1);
      const seen = locks.filter((r) => classOf(r.table) >= 0);
      expect(seen.length).toBeGreaterThan(2);
      // Classes never go backwards: episodes, then events, then scene sets.
      const order = seen.map((r) => classOf(r.table));
      expect(order).toEqual([...order].sort((a, b) => a - b));
      // The episode statement is ordered and FOR UPDATE.
      const eps = seen.filter((r) => r.table === 'episodes');
      expect(eps[0].mode).toBe('update');
      expect(eps[0].ordered).toBe(true);
      // Every scene_sets acquisition is NOWAIT and ascending within itself.
      const sets = seen.filter((r) => r.table === 'scene_sets');
      expect(sets.length).toBeGreaterThan(0);
      expect(sets.every((r) => /NOWAIT/.test(r.sql))).toBe(true);
      expect(sets.every((r) => /ORDER BY id/.test(r.sql))).toBe(true);
      for (const r of sets) expect([...r.ids]).toEqual([...r.ids].sort());
      // No deadlock anywhere.
      expect(trace.records.filter((r) => r.kind === 'other' && /40P01/.test(r.sql || '')).length).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 5. REAL CONCURRENCY
  // ══════════════════════════════════════════════════════════════════════
  describe('[real lock] against other writers', () => {
    test('a scene set row held by another transaction: the batch fails fast and is retried, never waiting', async () => {
      const gone = await set('h gone', { deleted: true });
      const live = await set('h live');
      const { ep, ev } = await episodeUsing(gone);
      const before = await snapshot(ep, ev);

      // Another transaction holds the source row. Every scene_sets lock in
      // the batch is NOWAIT, so it cannot wait on this.
      const holder = await sequelize.transaction();
      await sequelize.query('SELECT id FROM scene_sets WHERE id = :id FOR UPDATE', { replacements: { id: gone }, transaction: holder });

      const started = Date.now();
      const res = await post(ep, tokens.admin, [{ from: gone, to: live }]);
      const took = Date.now() - started;
      await holder.rollback();

      // Retries are bounded, so it answers rather than hanging, and nothing
      // was written. The 10 s lock_timeout was never reached by a set row.
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('RETRY');
      expect(took).toBeLessThan(10000);
      expect(await snapshot(ep, ev)).toEqual(before);
    });

    test('opposite-order overlapping batches: no deadlock, and whoever loses writes nothing', async () => {
      // Two requests over the same two removed sets, in opposite move order.
      const goneA = await set('x A', { deleted: true });
      const goneB = await set('x B', { deleted: true });
      const live = await set('x live');
      const { ep } = await episodeUsing(goneA);
      await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, role_name, sort_order, created_at, updated_at)
                 VALUES (gen_random_uuid(), :setId, :ep, 'closet', NULL, 2, NOW(), NOW())`, { setId: goneB, ep });

      const [one, two] = await Promise.all([
        post(ep, tokens.admin, [{ from: goneA, to: live }, { from: goneB, to: live }]),
        post(ep, tokens.admin, [{ from: goneB, to: live }, { from: goneA, to: live }]),
      ]);

      const codes = [one.status, two.status].sort();
      // One succeeds; the other either finds nothing left to move (400) or
      // lost the race and says so (409 RETRY). Never a deadlock, never a 500.
      expect(one.status).not.toBe(500);
      expect(two.status).not.toBe(500);
      expect(codes.some((c) => c === 200)).toBe(true);
      // Whatever happened, no beat is left on a removed set.
      expect(Number((await rows(`SELECT count(*)::int AS n FROM scene_plans p JOIN scene_sets s ON s.id = p.scene_set_id
                                  WHERE p.episode_id = :ep AND p.deleted_at IS NULL AND s.deleted_at IS NOT NULL`, { ep }))[0].n)).toBe(0);
    });

    test('a concurrent delete of the replacement cannot leave a moved reference on a removed set', async () => {
      const gone = await set('dl gone', { deleted: true });
      const live = await set('dl live');
      const { ep } = await episodeUsing(gone);

      // The replacement is removed while the batch runs. Either the batch
      // holds it FOR KEY SHARE and the removal waits, or the batch reads it as
      // gone and refuses. Both are fine; a moved beat on a removed set is not.
      const racer = run('UPDATE scene_sets SET deleted_at = NOW() WHERE id = :id', { id: live });
      const res = await post(ep, tokens.admin, [{ from: gone, to: live }]);
      await racer;

      expect([200, 400, 409]).toContain(res.status);
      const orphans = Number((await rows(`SELECT count(*)::int AS n FROM scene_plans p JOIN scene_sets s ON s.id = p.scene_set_id
                                           WHERE p.episode_id = :ep AND p.deleted_at IS NULL AND s.deleted_at IS NOT NULL`, { ep }))[0].n);
      if (res.status === 200) expect(orphans).toBe(0);
    });

    test('an acceptance committing before the batch reaches its writes refuses the batch', async () => {
      const gone = await set('acc race gone', { deleted: true });
      const live = await set('acc race live');
      const { ep, ev } = await episodeUsing(gone);
      const before = await snapshot(ep, ev);

      // The acceptance needs the episode FOR UPDATE, which the batch also
      // takes. Whichever gets it first, the batch must never write onto an
      // accepted episode.
      const accept = run("UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep", { ep });
      const res = await post(ep, tokens.admin, [{ from: gone, to: live }]);
      await accept;

      if (res.status === 409) {
        expect(['EPISODE_ACCEPTED', 'EPISODE_SNAPSHOT_FROZEN', 'RETRY']).toContain(res.body.code);
        expect(await snapshot(ep, ev)).toEqual(before);
      } else {
        // It won the race and committed before the acceptance: the beats moved
        // to a LIVE set, which is the correct outcome for a draft episode.
        expect(res.status).toBe(200);
        expect((await snapshot(ep, ev)).beats.every((b) => b.scene_set_id === live)).toBe(true);
      }
    });

    test('a real failure on the last move rolls back every earlier move, angle labels included', async () => {
      const goneA = await set('rb A', { deleted: true });
      const goneB = await set('rb B', { deleted: true });
      const live = await set('rb live');
      const { ep, ev } = await episodeUsing(goneA);
      await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, role_name, sort_order, created_at, updated_at)
                 VALUES (gen_random_uuid(), :setId, :ep, 'closet', NULL, 2, NOW(), NOW())`, { setId: goneB, ep });
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, sort_order, locked, ai_suggested, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, 13, 'Beat 13', :setId, 'CLOSE', 13, false, true, NOW(), NOW())`, { ep, setId: goneB });
      const before = await snapshot(ep, ev);
      const [first, second] = [goneA, goneB].sort();

      // The SECOND move's beat UPDATE is rejected as the database would reject
      // it, so the first move is already written when it fails.
      const real = sequelize.query.bind(sequelize);
      let injected = 0;
      jest.spyOn(sequelize, 'query').mockImplementation((sql, options) => {
        const text = String(typeof sql === 'object' && sql?.query ? sql.query : sql);
        if (options?.transaction && /UPDATE scene_plans SET scene_set_id/.test(text)
            && String(options?.replacements?.fromId) === String(second) && injected === 0) {
          injected += 1;
          const err = new Error('injected failure on the last move');
          err.original = { code: '23514' };
          return Promise.reject(err);
        }
        return real(sql, options);
      });
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await post(ep, tokens.admin, [{ from: first, to: live }, { from: second, to: live }]);
      errSpy.mockRestore();
      jest.restoreAllMocks();

      expect(injected).toBe(1);
      expect(res.status).toBeGreaterThanOrEqual(400);
      // Nothing of EITHER move survived, and the angle labels are as they were.
      expect(await snapshot(ep, ev)).toEqual(before);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 6. THE LADDER ABOVE THE HANDLER
  // ══════════════════════════════════════════════════════════════════════
  describe('authentication and authorization', () => {
    test('signed out: 401, and nothing is written', async () => {
      const gone = await set('a gone', { deleted: true });
      const live = await set('a live');
      const { ep, ev } = await episodeUsing(gone);
      const before = await snapshot(ep, ev);
      const res = await post(ep, null, [{ from: gone, to: live }]);
      expect(res.status).toBe(401);
      expect(await snapshot(ep, ev)).toEqual(before);
    });

    test('signed in but not an admin: 403, and nothing is written', async () => {
      const gone = await set('b gone', { deleted: true });
      const live = await set('b live');
      const { ep, ev } = await episodeUsing(gone);
      const before = await snapshot(ep, ev);
      const res = await post(ep, tokens.editor, [{ from: gone, to: live }]);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
      expect(await snapshot(ep, ev)).toEqual(before);
    });

    test('a malformed episode id: 400 from the id check', async () => {
      const res = await request(app)
        .post('/api/v1/episodes/not-a-uuid/move-removed-sets')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({ moves: [] });
      expect(res.status).toBe(400);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 7. THE GENERALIZED LOCKER'S OWN CONTRACT
  // ══════════════════════════════════════════════════════════════════════
  describe('lockSetReferences, generalized', () => {
    test('the single-set shorthand still answers the delete path\'s shape', async () => {
      const gone = await set('s1 gone', { deleted: true });
      const live = await set('s1 live');
      await episodeUsing(gone);

      const held = await uses.withSetLocks(sequelize, { setId: gone, replacementId: live }, async (ctx) => ctx);

      // The delete path reads `refs` and `replacementHeld`.
      expect(held.refs).toBeTruthy();
      expect(Array.isArray(held.refs.episodes)).toBe(true);
      expect(held.replacementHeld).toBe(true);
      expect(typeof held.attempt).toBe('number');
    });

    const LEGACY = /^WITH gone AS \(SELECT id FROM scene_sets WHERE id = :setId FOR UPDATE NOWAIT\)/;
    // MEASURED: lockTrace classifies the `WITH gone AS (…)` statement as kind
    // 'other', because describe() only calls a statement a lock when it
    // starts with SELECT. sceneSetDeleteLockOrder reads it the same way —
    // r.sql across every record — so these cases do too.
    const setStatements = () => trace.records
      .map((r) => r.sql || '')
      .filter((q) => /scene_sets/.test(q) && /FOR (?:NO KEY )?(?:KEY )?(?:UPDATE|SHARE)/.test(q));

    test('the historical single-set call emits the ORIGINAL statement, verbatim', async () => {
      // The delete-with-replacement path's merged suite pins this text
      // (sceneSetDeleteLockOrder:245, :532, :533). The specialization exists
      // for that contract, and this case fails if the generalized form ever
      // takes that call over.
      const gone = await set('sql legacy gone', { deleted: true });
      const live = await set('sql legacy live');
      await episodeUsing(gone);

      trace = lockTrace.install(sequelize);
      await uses.withSetLocks(sequelize, { setId: gone, replacementId: live }, async () => null);

      const stmts = setStatements();
      expect(stmts.some((q) => LEGACY.test(q))).toBe(true);
      expect(stmts.filter((q) => LEGACY.test(q))).toHaveLength(1);
      // and not the generalized form
      expect(stmts.some((q) => /IN \(:ids\)/.test(q))).toBe(false);
    });

    test('a genuine batch uses the GENERALIZED statements, each mode over its own ids', async () => {
      const goneA = await set('sql batch A', { deleted: true });
      const goneB = await set('sql batch B', { deleted: true });
      const live = await set('sql batch live');
      await episodeUsing(goneA);

      trace = lockTrace.install(sequelize);
      await uses.withSetLocks(sequelize, { setIds: [goneA, goneB], replacementIds: [live] }, async () => null);

      const stmts = setStatements();
      expect(stmts.some((q) => LEGACY.test(q))).toBe(false);
      expect(stmts.some((q) => /IN \(:ids\).*FOR UPDATE NOWAIT/.test(q))).toBe(true);
      expect(stmts.every((q) => /NOWAIT/.test(q) && /ORDER BY id/.test(q))).toBe(true);
    });

    test('a ONE-MOVE repair takes the legacy statement, because its locking contract is identical', async () => {
      // Not an array-length rule: one source with one ordinary replacement
      // would acquire exactly the rows and modes the deduplication computes,
      // so the faithful statement is the original one. Asserted rather than
      // assumed, and the repair itself still works.
      const gone = await set('sql one gone', { deleted: true });
      const live = await set('sql one live');
      const { ep } = await episodeUsing(gone);

      trace = lockTrace.install(sequelize);
      const res = await post(ep, tokens.admin, [{ from: gone, to: live }]);
      expect(res.status).toBe(200);

      const stmts = setStatements();
      expect(stmts.some((q) => LEGACY.test(q))).toBe(true);
      expect(await rows('SELECT scene_set_id FROM scene_plans WHERE episode_id = :ep AND deleted_at IS NULL', { ep }))
        .toEqual([{ scene_set_id: live }, { scene_set_id: live }]);
    });

    test('one source whose replacement is also a version uses the GENERALIZED form — the branch is the contract, not the count', async () => {
      // The legacy statement locks versions by version_of_set_id and does no
      // deduplication, so it would take this replacement twice at two
      // strengths — the upgrade hazard. One source, and still generalized.
      const gone = await set('sql up gone', { deleted: true });
      const live = await set('sql up live');
      await run('UPDATE scene_sets SET version_of_set_id = :gone WHERE id = :live', { gone, live });
      await episodeUsing(gone);

      trace = lockTrace.install(sequelize);
      await uses.withSetLocks(sequelize, { setId: gone, replacementId: live }, async () => null);

      const stmts = setStatements();
      expect(stmts.some((q) => LEGACY.test(q))).toBe(false);
      expect(stmts.some((q) => /IN \(:ids\)/.test(q))).toBe(true);
      await run('UPDATE scene_sets SET version_of_set_id = NULL WHERE id = :live', { live });
    });

    test('a scene set in two roles is locked once, at its strongest mode', async () => {
      // `live` is both a replacement and a version of the source, so it would
      // otherwise be taken FOR KEY SHARE and FOR NO KEY UPDATE in one attempt
      // — an upgrade after another row is held. Deduplicated, it is taken once.
      const gone = await set('dup gone', { deleted: true });
      const live = await set('dup live');
      await run('UPDATE scene_sets SET version_of_set_id = :gone WHERE id = :live', { gone, live });
      await episodeUsing(gone);

      trace = lockTrace.install(sequelize);
      await uses.withSetLocks(sequelize, { setId: gone, replacementId: live }, async () => null);

      const setLocks = trace.records.filter((r) => r.kind === 'lock' && r.table === 'scene_sets');
      const times = setLocks.flatMap((r) => r.ids).filter((id) => String(id) === String(live));
      expect(times).toHaveLength(1);
      await run('UPDATE scene_sets SET version_of_set_id = NULL WHERE id = :live', { live });
    });
  });
});

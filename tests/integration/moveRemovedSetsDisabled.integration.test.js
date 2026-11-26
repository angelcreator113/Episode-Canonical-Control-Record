/**
 * P1 (Evoni, 2026-11-26): moving beats off a removed scene set is switched
 * off, unconditionally, server-side.
 *
 * Why: `sceneSetUsesService.moveRemovedSetsForEpisode` opened a transaction
 * of its own and called `moveUses` with NO freeze check, NO episode lock and
 * NO set lock. For the episode in the URL that rewrites
 * `scene_set_episodes`, `scene_plans` (scene_set_id, and angle_label set to
 * NULL), `scene_set_looks`, `world_events.scene_set_id` and
 * `scenes.scene_set_id` — so an ACCEPTED or FILMED episode could be rewritten
 * through this route, which S1-B's freeze never covered. The other caller of
 * `moveUses` (the delete-with-replacement path) is guarded:
 * withSetLocks → assertNoAcceptedOrFilmedUses → moveUses.
 *
 * What this suite pins:
 *   - draft, accepted and filmed episodes all get 503
 *     MOVE_REMOVED_SETS_DISABLED;
 *   - every row the write would have touched is byte-identical afterwards;
 *   - the authentication and ADMIN ladder above the refusal is unchanged
 *     (401 signed out, 403 for a non-admin, 400 for a malformed id);
 *   - GET /removed-sets still reports what is wrong;
 *   - and the route NEVER reaches the unguarded service function — asserted
 *     by spying on it, which is the negative check that the refusal cannot
 *     silently fall through to the write path.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const uses = require('../../src/services/sceneSetUsesService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

const DISABLED_CODE = 'MOVE_REMOVED_SETS_DISABLED';
const AUTHORIZE_BODY = { error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' };

(shouldSkip ? describe.skip : describe)('P1: moving beats off a removed scene set is switched off (503)', () => {
  const show = uuid();
  const tokens = {};
  let removedSet;
  let liveSet;

  beforeAll(async () => {
    tokens.admin = TokenService.generateTokenPair({ id: 'p1d-admin', email: 'admin@p1d.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    tokens.editor = TokenService.generateTokenPair({ id: 'p1d-editor', email: 'editor@p1d.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;

    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, '{"starting_balance":1000}'::jsonb, NOW(), NOW())`,
    { show, name: `P1 disabled ${show.slice(0, 8)}`, slug: `p1d-${show.slice(0, 8)}` });

    removedSet = uuid();
    liveSet = uuid();
    for (const [id, name, deleted] of [[removedSet, 'Gone hall', true], [liveSet, 'Live hall', false]]) {
      await run(`INSERT INTO scene_sets (id, name, scene_type, generation_status, show_id, base_still_url, script_context, deleted_at, created_at, updated_at)
                 VALUES (:id, :name, 'EVENT_LOCATION', 'complete', :show, :url, 'ctx', :deletedAt, NOW(), NOW())`,
      { id, name: `${name} ${id.slice(0, 6)}`, show, url: `https://x/${id.slice(0, 6)}.png`, deletedAt: deleted ? new Date() : null });
    }
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const t of ['scene_set_looks']) {
      await run(`DELETE FROM ${t} WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show }).catch(() => {});
    }
    for (const t of ['scenes', 'scene_plans', 'scene_set_episodes', 'episode_briefs']) {
      await run(`DELETE FROM ${t} WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show }).catch(() => {});
    }
    await run('UPDATE world_events SET scene_set_id = NULL, used_in_episode_id = NULL WHERE show_id = :show', { show }).catch(() => {});
    await run('DELETE FROM world_events WHERE show_id = :show', { show }).catch(() => {});
    await run('DELETE FROM episodes WHERE show_id = :show', { show }).catch(() => {});
    await run('DELETE FROM scene_sets WHERE id IN (:ids)', { ids: [removedSet, liveSet] }).catch(() => {});
    await run('DELETE FROM shows WHERE id = :show', { show }).catch(() => {});
  });

  /**
   * An episode that really does use the removed set, in every way the move
   * would have rewritten: a location link, beats with angle labels, scenes,
   * its event held at the set, and a look on it.
   */
  async function episodeUsingRemovedSet({ accepted = false, filmed = false } = {}) {
    const ep = uuid();
    const ev = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:ep, :show, 'P1 disabled ep', :n, 'draft', NULL, NOW(), NOW())`,
    { ep, show, n: Math.floor(Math.random() * 100000) + 700 });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, scene_set_id, used_in_episode_id, created_at, updated_at)
               VALUES (:ev, :show, :name, 'invite', 'used', 5, :setId, :ep, NOW(), NOW())`,
    { ev, show, name: `P1 event ${ev.slice(0, 6)}`, setId: removedSet, ep });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at)
               VALUES (gen_random_uuid(), :ep, :show, :ev, 'draft', NOW(), NOW())`, { ep, show, ev });
    await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, role_name, created_at, updated_at)
               VALUES (gen_random_uuid(), :setId, :ep, 'event', NULL, NOW(), NOW())`, { setId: removedSet, ep });
    for (const n of [1, 2]) {
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, sort_order, locked, ai_suggested, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, :n, :name, :setId, 'WIDE', :n, false, true, NOW(), NOW())`,
      { ep, n, name: `Beat ${n}`, setId: removedSet });
    }
    const [plan] = await rows('SELECT id FROM scene_plans WHERE episode_id = :ep ORDER BY beat_number LIMIT 1', { ep });
    await run(`INSERT INTO scenes (id, episode_id, scene_number, title, scene_set_id, scene_plan_id, created_at, updated_at)
               VALUES (gen_random_uuid(), :ep, 1, 'Scene 1', :setId, :planId, NOW(), NOW())`,
    { ep, setId: removedSet, planId: plan.id });
    await run(`INSERT INTO scene_set_looks (id, scene_set_id, event_id, status, created_at, updated_at)
               VALUES (gen_random_uuid(), :setId, :ev, 'complete', NOW(), NOW())`, { setId: removedSet, ev })
      .catch(() => {}); // the looks table's own required columns vary by shape; the look is a bonus surface
    if (filmed) {
      await run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, :show, 'lala', :key, 'none', 'low', NOW(), NOW())`,
      { ep, show, key: `raw/${ep.slice(0, 8)}.mp4` });
    }
    if (accepted) await run("UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep", { ep });
    return { ep, ev };
  }

  /** Every row the move would have rewritten, in one comparable shape. */
  const snapshot = async (ep, ev) => ({
    links: await rows('SELECT scene_set_id, episode_id, role, role_name, deleted_at FROM scene_set_episodes WHERE episode_id = :ep ORDER BY scene_set_id', { ep }),
    beats: await rows('SELECT beat_number, scene_set_id, angle_label, deleted_at FROM scene_plans WHERE episode_id = :ep ORDER BY beat_number', { ep }),
    scenes: await rows('SELECT scene_number, scene_set_id, scene_plan_id, deleted_at FROM scenes WHERE episode_id = :ep ORDER BY scene_number', { ep }),
    events: await rows('SELECT id, scene_set_id, used_in_episode_id FROM world_events WHERE id = :ev', { ev }),
    looks: await rows('SELECT scene_set_id, event_id, deleted_at FROM scene_set_looks WHERE event_id = :ev ORDER BY scene_set_id', { ev }),
  });

  const post = (ep, token, body) => {
    const r = request(app).post(`/api/v1/episodes/${ep}/move-removed-sets`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return r.send(body ?? { moves: [{ from: removedSet, to: liveSet }] });
  };

  // ── the refusal, on every episode state ────────────────────────────────
  describe.each([
    ['a draft episode', {}],
    ['an accepted episode', { accepted: true }],
    ['a filmed episode', { filmed: true }],
    ['an accepted and filmed episode', { accepted: true, filmed: true }],
  ])('%s', (_label, state) => {
    test('is answered 503 MOVE_REMOVED_SETS_DISABLED, and nothing it would have rewritten changes', async () => {
      const { ep, ev } = await episodeUsingRemovedSet(state);
      const before = await snapshot(ep, ev);
      // The fixture really does use the removed set, or this proves nothing.
      expect(before.beats.map((b) => b.scene_set_id)).toEqual([removedSet, removedSet]);
      expect(before.beats.map((b) => b.angle_label)).toEqual(['WIDE', 'WIDE']);
      expect(before.links.some((l) => l.scene_set_id === removedSet && !l.deleted_at)).toBe(true);
      expect(before.scenes.some((s) => s.scene_set_id === removedSet)).toBe(true);
      expect(before.events[0].scene_set_id).toBe(removedSet);

      const res = await post(ep, tokens.admin);

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ success: false, code: DISABLED_CODE });
      expect(res.body.error).toMatch(/Nothing was changed/);
      expect(res.body.error).toMatch(/Locations and Beat Plan/);
      // No database text leaked into the answer.
      expect(res.body.error).not.toMatch(/scene_plans|scene_sets|UPDATE |transaction/i);

      expect(await snapshot(ep, ev)).toEqual(before);
    });
  });

  // ── the negative check: the write path is never reached ────────────────
  test('the route never calls the unguarded service function, with any body', async () => {
    const { ep, ev } = await episodeUsingRemovedSet({ accepted: true });
    const before = await snapshot(ep, ev);
    const move = jest.spyOn(uses, 'moveRemovedSetsForEpisode');
    const moveUses = jest.spyOn(uses, 'moveUses');

    for (const body of [
      { moves: [{ from: removedSet, to: liveSet }] },
      { moves: [] },
      { moves: [{ from: removedSet, to: liveSet }, { from: liveSet, to: removedSet }] },
      {},
      undefined,
    ]) {
      const res = await post(ep, tokens.admin, body);
      expect(res.status).toBe(503);
      expect(res.body.code).toBe(DISABLED_CODE);
    }

    // The refusal cannot silently fall through: neither the wrapper nor the
    // writer was entered, whatever was sent.
    expect(move).not.toHaveBeenCalled();
    expect(moveUses).not.toHaveBeenCalled();
    expect(await snapshot(ep, ev)).toEqual(before);
  });

  // ── the ladder above the refusal is unchanged ──────────────────────────
  describe('authentication and authorization still answer first', () => {
    test('signed out: 401, and the refusal is never reached', async () => {
      const { ep } = await episodeUsingRemovedSet();
      const move = jest.spyOn(uses, 'moveRemovedSetsForEpisode');
      const res = await post(ep, null);
      expect(res.status).toBe(401);
      expect(res.body.code).not.toBe(DISABLED_CODE);
      expect(move).not.toHaveBeenCalled();
    });

    test('signed in but not an admin: 403 with authorize\'s own body', async () => {
      const { ep } = await episodeUsingRemovedSet();
      const res = await post(ep, tokens.editor);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject(AUTHORIZE_BODY);
      expect(res.body.code).not.toBe(DISABLED_CODE);
    });

    test('a malformed episode id: 400 from the id check, not the refusal', async () => {
      const res = await request(app)
        .post('/api/v1/episodes/not-a-uuid/move-removed-sets')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({ moves: [{ from: removedSet, to: liveSet }] });
      expect(res.status).toBe(400);
      expect(res.body.code).not.toBe(DISABLED_CODE);
    });
  });

  // ── detection is untouched ─────────────────────────────────────────────
  test('GET /removed-sets still reports the removed set and the beats at it', async () => {
    const { ep } = await episodeUsingRemovedSet();
    const res = await request(app)
      .get(`/api/v1/episodes/${ep}/removed-sets`)
      .set('Authorization', `Bearer ${tokens.admin}`);

    expect(res.status).toBe(200);
    const found = (res.body.data || []).find((s) => s.scene_set_id === removedSet);
    expect(found).toBeTruthy();
    expect(found.beats).toEqual([1, 2]);
    expect(found.deleted_at).toBeTruthy();
  });
});

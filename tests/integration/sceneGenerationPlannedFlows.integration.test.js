/**
 * Scene Sets uncertain outcomes (#3748): the PR B and PR C sequences, as
 * planned, run against the PR A triggers with plain SQL. No provider is
 * involved (axios is mocked and rejects; fal calls are counted, never sent).
 *
 *  - the reconciler: a stale claimed attempt becomes abandoned_unsent, a
 *    stale dispatch_started one becomes uncertain, the target follows, and no
 *    second paid claim becomes possible;
 *  - the confirmation transaction with PR C's lock order (target FOR UPDATE,
 *    then the uncertain attempt FOR UPDATE), under concurrent requests;
 *  - bypass attempts the guard suite does not already cover;
 *  - Retry storing and Upload against the image-evidence guard.
 */
jest.unmock('uuid');
jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn(), create: jest.requireActual('axios').create }));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })) };
});

const crypto = require('crypto');
const request = require('supertest');
const axios = require('axios');
const models = require('../../src/models');
const sceneGen = require('../../src/services/sceneGenerationService');
const generationClaim = require('../../src/services/generationClaimService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const run = (sql, replacements = {}, opts = {}) => sequelize.query(sql, { replacements, ...opts });
const rows = (sql, replacements = {}, opts = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT, ...opts });
const one = async (sql, replacements = {}, opts = {}) => (await rows(sql, replacements, opts))[0];
const GUARD = /scene generation guard/;
const falCalls = () => axios.post.mock.calls.filter((c) => String(c[0]).startsWith('https://fal.run/')).length;
const table = (kind) => (kind === 'set' ? 'scene_sets' : 'scene_angles');

(shouldSkip ? describe.skip : describe)('planned PR B / PR C sequences against the PR A triggers', () => {
  const setIds = [];

  beforeEach(() => {
    process.env.FAL_KEY = process.env.FAL_KEY || 'test-fal';
    axios.post.mockReset().mockRejectedValue(new Error('provider unavailable in this test'));
    axios.get.mockReset().mockRejectedValue(new Error('no downloads in this test'));
    for (const m of ['log', 'warn', 'error']) jest.spyOn(console, m).mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    if (!setIds.length) return;
    await sequelize.transaction(async (transaction) => {
      const opts = { transaction };
      await run('SET LOCAL session_replication_role = replica', {}, opts);
      await run('DELETE FROM scene_generation_attempts WHERE scene_set_id IN (:ids)', { ids: setIds }, opts);
      await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: setIds }, opts);
      await run('DELETE FROM scene_sets WHERE id IN (:ids)', { ids: setIds }, opts);
    });
  });

  async function makeSet(fields = {}) {
    const set = await models.SceneSet.create({ name: `Flows ${uuid().slice(0, 8)}`, scene_type: 'HOME_BASE', ...fields });
    setIds.push(set.id);
    return set;
  }
  const makeAngle = (set, fields = {}) => models.SceneAngle.create({ scene_set_id: set.id, angle_label: `A${uuid().slice(0, 4)}`, angle_name: 'Angle', ...fields });
  const target = (kind, id) => one(`SELECT generation_status::text AS status, current_attempt_id, updated_at FROM ${table(kind)} WHERE id = :id`, { id });
  const attempt = (id) => one('SELECT * FROM scene_generation_attempts WHERE id = :id', { id });
  const age = (kind, id, mins) => run(`UPDATE ${table(kind)} SET updated_at = NOW() - make_interval(mins => :mins) WHERE id = :id`, { id, mins });

  // PR B claim: target FOR UPDATE, insert a claimed attempt, switch the target.
  async function claim(kind, row, setId, { supersedes = null, transaction } = {}) {
    const id = uuid();
    const opts = transaction ? { transaction } : {};
    await run(`INSERT INTO scene_generation_attempts (id, target_kind, target_id, scene_set_id, provider, model, route, created_by, supersedes_attempt_id)
               VALUES (:id, :kind, :tid, :sid, 'fal', 'fal-ai/flux/dev', 'planned', 'u1', :sup)`, { id, kind, tid: row.id, sid: setId, sup: supersedes }, opts);
    await run(`UPDATE ${table(kind)} SET generation_status = 'generating', current_attempt_id = :id, updated_at = NOW() WHERE id = :tid`, { id, tid: row.id }, opts);
    return id;
  }
  // PR B dispatch marker: committed before the request; conditional on the attempt still being claimed.
  const dispatch = async (id) => {
    const [r] = await run("UPDATE scene_generation_attempts SET state = 'dispatch_started', dispatch_started_at = NOW() WHERE id = :id AND state = 'claimed' RETURNING id", { id });
    return r.length === 1;
  };
  async function makeUncertain(kind, row, setId) {
    const id = await claim(kind, row, setId);
    await dispatch(id);
    await run(`UPDATE scene_generation_attempts SET state = 'uncertain', finished_at = NOW(), error_code = 'PROVIDER_OUTCOME_UNKNOWN', estimate_usd = 0.025 WHERE id = :id`, { id });
    await run(`UPDATE ${table(kind)} SET generation_status = 'uncertain' WHERE id = :tid`, { tid: row.id });
    return id;
  }
  async function issue(attemptId, user = 'admin-1', minutes = 10) {
    const token = crypto.randomBytes(32).toString('hex');
    await run(`UPDATE scene_generation_attempts SET confirm_token_hash = :h, confirm_user_id = :u, confirm_expires_at = NOW() + make_interval(mins => :m)
               WHERE id = :id AND confirm_consumed_at IS NULL`, { h: sha(token), u: user, m: minutes, id: attemptId });
    return token;
  }

  /**
   * PR B reconciler for one target, as planned: lock the target, then its
   * current attempt; a stale claimed attempt -> abandoned_unsent and the
   * target back to `back`; a stale dispatch_started -> uncertain and the
   * target uncertain. Returns what it did.
   */
  async function reconcile(kind, id, { back = 'failed' } = {}) {
    return sequelize.transaction(async (transaction) => {
      const opts = { transaction };
      const t = await one(`SELECT generation_status::text AS status, current_attempt_id, updated_at FROM ${table(kind)} WHERE id = :id FOR UPDATE`, { id }, opts);
      if (!t.current_attempt_id) return 'none';
      const a = await one('SELECT state FROM scene_generation_attempts WHERE id = :a FOR UPDATE', { a: t.current_attempt_id }, opts);
      if (!['claimed', 'dispatch_started'].includes(a.state)) return 'settled';
      if (new Date(t.updated_at).getTime() > Date.now() - generationClaim.STALE_MS) return 'live';
      if (a.state === 'claimed') {
        await run(`UPDATE scene_generation_attempts SET state = 'abandoned_unsent', finished_at = NOW(), error_code = 'STALE_CLAIM' WHERE id = :a`, { a: t.current_attempt_id }, opts);
        await run(`UPDATE ${table(kind)} SET generation_status = :back WHERE id = :id`, { id, back }, opts);
        return 'abandoned_unsent';
      }
      await run(`UPDATE scene_generation_attempts SET state = 'uncertain', finished_at = NOW(), error_code = 'STALE_DISPATCH' WHERE id = :a`, { a: t.current_attempt_id }, opts);
      await run(`UPDATE ${table(kind)} SET generation_status = 'uncertain' WHERE id = :id`, { id }, opts);
      return 'uncertain';
    });
  }

  /**
   * PR C confirmed claim, in PR C's lock order: target FOR UPDATE, the
   * uncertain attempt FOR UPDATE, insert the replacement, consume the token
   * (conditional; 0 rows = refuse and roll back), switch the target.
   */
  async function confirmedClaim(kind, row, setId, token, user = 'admin-1', { pauseMs = 0 } = {}) {
    try {
      return await sequelize.transaction(async (transaction) => {
        const opts = { transaction };
        const t = await one(`SELECT generation_status::text AS status, current_attempt_id FROM ${table(kind)} WHERE id = :id FOR UPDATE`, { id: row.id }, opts);
        if (t.status !== 'uncertain') { const e = new Error('NOT_UNCERTAIN'); e.code = 'NOT_UNCERTAIN'; throw e; }
        await one('SELECT id FROM scene_generation_attempts WHERE id = :a FOR UPDATE', { a: t.current_attempt_id }, opts);
        if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
        const next = await claimInsertOnly(kind, row, setId, t.current_attempt_id, opts);
        const [consumed] = await run(`UPDATE scene_generation_attempts
            SET confirm_consumed_at = NOW(), confirm_consumed_by_attempt_id = :next, confirm_consumed_by_user_id = :u
          WHERE id = :old AND confirm_token_hash = :h AND confirm_user_id = :u AND confirm_consumed_at IS NULL AND confirm_expires_at > NOW()
          RETURNING id`, { next, u: user, old: t.current_attempt_id, h: sha(token) }, opts);
        if (consumed.length !== 1) { const e = new Error('CONFIRMATION_USED'); e.code = 'CONFIRMATION_USED'; throw e; }
        await run(`UPDATE ${table(kind)} SET generation_status = 'generating', current_attempt_id = :next, updated_at = NOW() WHERE id = :id`, { next, id: row.id }, opts);
        return { ok: true, next };
      });
    } catch (err) {
      return { ok: false, code: err.code || (err.parent && err.parent.code) || err.name, message: err.message };
    }
  }
  async function claimInsertOnly(kind, row, setId, supersedes, opts) {
    const id = uuid();
    await run(`INSERT INTO scene_generation_attempts (id, target_kind, target_id, scene_set_id, provider, model, route, created_by, supersedes_attempt_id)
               VALUES (:id, :kind, :tid, :sid, 'fal', 'fal-ai/flux/dev', 'planned', 'admin-1', :sup)`, { id, kind, tid: row.id, sid: setId, sup: supersedes }, opts);
    return id;
  }

  // ── 2. Reconciliation ─────────────────────────────────────────────────────
  describe('reconciler', () => {
    test('a stale claimed attempt becomes abandoned_unsent; the target goes back; the worker can no longer dispatch it', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const a = await claim('angle', angle, set.id);
      expect(await reconcile('angle', angle.id)).toBe('live');
      await age('angle', angle.id, 20);
      expect(await reconcile('angle', angle.id)).toBe('abandoned_unsent');
      expect((await attempt(a)).state).toBe('abandoned_unsent');
      expect(await target('angle', angle.id)).toMatchObject({ status: 'failed', current_attempt_id: a });
      // The worker that held the claim wakes up: its dispatch marker matches nothing.
      expect(await dispatch(a)).toBe(false);
      // Without the condition the trigger refuses it.
      await expect(run("UPDATE scene_generation_attempts SET state = 'dispatch_started' WHERE id = :a", { a })).rejects.toThrow(/cannot go from abandoned_unsent to dispatch_started/);
      // Nothing was sent, so a new claim is allowed (a new attempt, one in flight).
      const b = await claim('angle', angle, set.id);
      expect(b).not.toBe(a);
    });

    test('a stale dispatch_started attempt becomes uncertain, and so does the target; nothing can claim it again', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const a = await claim('angle', angle, set.id);
      expect(await dispatch(a)).toBe(true);
      await age('angle', angle.id, 20);
      expect(await reconcile('angle', angle.id)).toBe('uncertain');
      expect(await target('angle', angle.id)).toMatchObject({ status: 'uncertain', current_attempt_id: a });
      // No second paid claim: legacy claim, a new attempt without confirmation, a late worker result.
      await expect(generationClaim.claimRow(sequelize, 'angle', angle.id)).rejects.toThrow(GUARD);
      await expect(sequelize.transaction((transaction) => claim('angle', angle, set.id, { transaction }))).rejects.toThrow(/needs a confirmation/);
      await expect(run("UPDATE scene_generation_attempts SET state = 'stored' WHERE id = :a", { a })).rejects.toThrow(/cannot go from uncertain to stored/);
      expect((await rows('SELECT id FROM scene_generation_attempts WHERE target_id = :t', { t: angle.id })).length).toBe(1);
    });

    test('a stale set (base) is reconciled the same way', async () => {
      const set = await makeSet();
      const a = await claim('set', set, set.id);
      await dispatch(a);
      await age('set', set.id, 20);
      expect(await reconcile('set', set.id)).toBe('uncertain');
      expect((await target('set', set.id)).status).toBe('uncertain');
    });

    test('reconciler and a late dispatch race: exactly one wins, never both', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const a = await claim('angle', angle, set.id);
      await age('angle', angle.id, 20);
      const [r, d] = await Promise.all([reconcile('angle', angle.id).catch((e) => e.message), dispatch(a).catch((e) => e.message)]);
      const st = (await attempt(a)).state;
      if (d === true) {
        expect(st).toBe('dispatch_started');
        expect(r).toMatch(/guard|settled|uncertain/);
      } else {
        expect(st).toBe('abandoned_unsent');
        expect(r).toBe('abandoned_unsent');
      }
    });

    test('a confirmed replacement that is abandoned before it is sent: the target returns to uncertain', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const u = await makeUncertain('angle', angle, set.id);
      const token = await issue(u);
      const res = await confirmedClaim('angle', angle, set.id, token);
      expect(res.ok).toBe(true);
      await age('angle', angle.id, 20);
      // The plan (PR C crash injection): attempt abandoned_unsent, target back to uncertain.
      const out = await reconcile('angle', angle.id, { back: 'uncertain' }).catch((e) => e.message);
      expect(out).toBe('abandoned_unsent');
      expect((await target('angle', angle.id)).status).toBe('uncertain');
    });

    test('a confirmed replacement that is not sent: the target returns to uncertain, not failed', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const u = await makeUncertain('angle', angle, set.id);
      const res = await confirmedClaim('angle', angle, set.id, await issue(u));
      expect(res.ok).toBe(true);
      await run("UPDATE scene_generation_attempts SET state = 'not_sent', finished_at = NOW(), error_code = 'ECONNREFUSED' WHERE id = :a", { a: res.next });
      // Not failed or pending: the original outcome is still unknown.
      await expect(run("UPDATE scene_angles SET generation_status = 'failed' WHERE id = :id", { id: angle.id })).rejects.toThrow(/returns to uncertain, not failed/);
      await expect(run("UPDATE scene_angles SET generation_status = 'pending' WHERE id = :id", { id: angle.id })).rejects.toThrow(/returns to uncertain, not pending/);
      await expect(run("UPDATE scene_angles SET generation_status = 'uncertain' WHERE id = :id", { id: angle.id })).resolves.toBeTruthy();
      // A replacement that was refused (a definitive 4xx) is not this case: it fails as planned.
      const set2 = await makeSet();
      const angle2 = await makeAngle(set2, { generation_status: 'pending' });
      const u2 = await makeUncertain('angle', angle2, set2.id);
      const r2 = await confirmedClaim('angle', angle2, set2.id, await issue(u2));
      await dispatch(r2.next);
      await run("UPDATE scene_generation_attempts SET state = 'refused', finished_at = NOW(), error_code = 'HTTP_400' WHERE id = :a", { a: r2.next });
      await run("UPDATE scene_angles SET generation_status = 'failed' WHERE id = :id", { id: angle2.id });
    });

    test('after a returned confirmed replacement, another confirmation can be issued and used once', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const u = await makeUncertain('angle', angle, set.id);
      const first = await confirmedClaim('angle', angle, set.id, await issue(u));
      await run("UPDATE scene_generation_attempts SET state = 'abandoned_unsent', finished_at = NOW() WHERE id = :a", { a: first.next });
      await run("UPDATE scene_angles SET generation_status = 'uncertain' WHERE id = :id", { id: angle.id });
      const again = await confirmedClaim('angle', angle, set.id, await issue(first.next));
      expect(again).toMatchObject({ ok: true });
      expect((await attempt(u)).state).toBe('uncertain'); // the original evidence is kept
    });
  });

  // ── 3. Confirmation under concurrency ─────────────────────────────────────
  describe('confirmation transaction', () => {
    test('PR C lock order: four concurrent requests with one token, exactly one replacement attempt', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const u = await makeUncertain('angle', angle, set.id);
      const token = await issue(u);
      const results = await Promise.all([0, 1, 2, 3].map(() => confirmedClaim('angle', angle, set.id, token, 'admin-1', { pauseMs: 50 })));
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      // The losers waited on the target lock, then found it generating.
      for (const r of results.filter((x) => !x.ok)) expect(r.code).toBe('NOT_UNCERTAIN');
      const all = await rows('SELECT id, state, supersedes_attempt_id FROM scene_generation_attempts WHERE target_id = :t', { t: angle.id });
      expect(all).toHaveLength(2);
      expect(all.filter((r) => r.supersedes_attempt_id === u)).toHaveLength(1);
      expect(falCalls()).toBe(0);
    });

    test('without the row locks the database alone still allows exactly one', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const u = await makeUncertain('angle', angle, set.id);
      const token = await issue(u);
      const bare = () => sequelize.transaction(async (transaction) => {
        const opts = { transaction };
        const next = await claimInsertOnly('angle', angle, set.id, u, opts);
        await new Promise((r) => setTimeout(r, 30));
        const [c] = await run(`UPDATE scene_generation_attempts SET confirm_consumed_at = NOW(), confirm_consumed_by_attempt_id = :next, confirm_consumed_by_user_id = 'admin-1'
            WHERE id = :old AND confirm_token_hash = :h AND confirm_consumed_at IS NULL AND confirm_expires_at > NOW() RETURNING id`, { next, old: u, h: sha(token) }, opts);
        if (c.length !== 1) throw new Error('CONFIRMATION_USED');
        await run("UPDATE scene_angles SET generation_status = 'generating', current_attempt_id = :next WHERE id = :id", { next, id: angle.id }, opts);
        return next;
      }).then(() => true, (e) => e.name || e.message);
      const results = await Promise.all([bare(), bare(), bare(), bare()]);
      expect(results.filter((r) => r === true)).toHaveLength(1);
      expect((await rows('SELECT id FROM scene_generation_attempts WHERE supersedes_attempt_id = :u', { u }))).toHaveLength(1);
    });

    test('the order written in the plan (consume, then insert) is refused by the trigger: insert first', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const u = await makeUncertain('angle', angle, set.id);
      const token = await issue(u);
      const next = uuid();
      await expect(sequelize.transaction(async (transaction) => {
        await run(`UPDATE scene_generation_attempts SET confirm_consumed_at = NOW(), confirm_consumed_by_attempt_id = :next, confirm_consumed_by_user_id = 'admin-1'
            WHERE id = :old AND confirm_token_hash = :h`, { next, old: u, h: sha(token) }, { transaction });
      })).rejects.toThrow();
      expect((await attempt(u)).confirm_consumed_at).toBeNull(); // still usable once
      expect(await confirmedClaim('angle', angle, set.id, token)).toMatchObject({ ok: true });
    });
  });

  // ── 4. Bypass attempts not in the guard suite ─────────────────────────────
  describe('bypass attempts', () => {
    test('TRUNCATE of scene_angles or scene_sets while an uncertain row exists is refused', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      await makeUncertain('angle', angle, set.id);
      for (const sql of ['TRUNCATE scene_angles CASCADE', 'TRUNCATE scene_sets CASCADE']) {
        const t = await sequelize.transaction();
        let err = null;
        try { await run(sql, {}, { transaction: t }); } catch (e) { err = e; } finally { await t.rollback(); }
        expect(err && err.message).toMatch(GUARD);
      }
      expect((await target('angle', angle.id)).status).toBe('uncertain');
    });

    test('a fresh in-flight set: the legacy base generation (venue, venue look, comparison call generateBaseScene) cannot send', async () => {
      const set = await makeSet();
      await claim('set', set, set.id); // a PR B claim, then the old code runs (a rollback during a generation)
      const fresh = await models.SceneSet.findByPk(set.id);
      await sceneGen.generateBaseScene(fresh, models, {}).catch(() => {});
      expect(falCalls()).toBe(0);
    });

    test('a fresh in-flight angle: a legacy status write that keeps it generating is refused', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      await claim('angle', angle, set.id);
      await expect(models.SceneAngle.update({ generation_status: 'generating' }, { where: { id: angle.id } })).rejects.toThrow(GUARD);
      // An unrelated edit while it runs still works.
      await run("UPDATE scene_angles SET angle_name = 'Renamed' WHERE id = :id", { id: angle.id });
    });

    test('moving an uncertain angle to another set keeps it protected there', async () => {
      const set = await makeSet();
      const other = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      await makeUncertain('angle', angle, set.id);
      await run('UPDATE scene_angles SET scene_set_id = :o WHERE id = :id', { o: other.id, id: angle.id });
      await expect(run('DELETE FROM scene_sets WHERE id = :o', { o: other.id })).rejects.toThrow(GUARD);
      await expect(run("UPDATE scene_angles SET generation_status = 'failed' WHERE id = :id", { id: angle.id })).rejects.toThrow(GUARD);
    });
  });

  // ── 5. Retry storing and Upload ───────────────────────────────────────────
  describe('Retry storing and Upload against the image-evidence guard', () => {
    async function storedFailed(kind, row, setId) {
      const a = await claim(kind, row, setId);
      await dispatch(a);
      await run(`UPDATE scene_generation_attempts SET state = 'stored_failed', finished_at = NOW(), provider_image_url = 'https://fal.media/kept.jpg', storage_error = 'S3 timeout' WHERE id = :a`, { a });
      await run(`UPDATE ${table(kind)} SET generation_status = 'uncertain' WHERE id = :id`, { id: row.id });
      return a;
    }

    test('Retry storing (planned): attempt stored and target complete in one transaction, with no POST', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const a = await storedFailed('angle', angle, set.id);
      await sequelize.transaction(async (transaction) => {
        await run("UPDATE scene_generation_attempts SET state = 'stored' WHERE id = :a AND state = 'stored_failed'", { a }, { transaction });
        await run("UPDATE scene_angles SET generation_status = 'complete', still_image_url = 'https://bucket.example/stored-later.jpg' WHERE id = :id", { id: angle.id }, { transaction });
      });
      expect(await attempt(a)).toMatchObject({ state: 'stored', provider_image_url: 'https://fal.media/kept.jpg', storage_error: 'S3 timeout' });
      expect((await target('angle', angle.id)).status).toBe('complete');
      expect(falCalls()).toBe(0);
    });

    test('Retry storing for a set base', async () => {
      const set = await makeSet({ base_still_url: 'https://bucket.example/old.jpg' });
      const a = await storedFailed('set', set, set.id);
      await sequelize.transaction(async (transaction) => {
        await run("UPDATE scene_generation_attempts SET state = 'stored' WHERE id = :a", { a }, { transaction });
        await run("UPDATE scene_sets SET generation_status = 'complete', base_still_url = 'https://bucket.example/new.jpg' WHERE id = :id", { id: set.id }, { transaction });
      });
      expect((await target('set', set.id)).status).toBe('complete');
    });

    test('Retry storing must store a new image: the old URL, or the status alone, is refused', async () => {
      const set = await makeSet({ base_still_url: 'https://bucket.example/old.jpg' });
      await storedFailed('set', set, set.id);
      await expect(run("UPDATE scene_sets SET generation_status = 'complete' WHERE id = :id", { id: set.id })).rejects.toThrow(GUARD);
      await expect(run("UPDATE scene_sets SET generation_status = 'complete', base_still_url = 'https://bucket.example/old.jpg' WHERE id = :id", { id: set.id })).rejects.toThrow(GUARD);
    });

    test('the existing Upload route completes an uncertain angle; the attempt keeps its evidence', async () => {
      const app = require('../../src/app');
      const TokenService = require('../../src/services/tokenService');
      const token = TokenService.generateTokenPair({ id: 'test-user-flows', email: 'u@flows.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const u = await makeUncertain('angle', angle, set.id);
      const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
      const res = await request(app).post(`/api/v1/scene-sets/${set.id}/angles/${angle.id}/upload`)
        .set('Authorization', `Bearer ${token}`).attach('image', png, { filename: 'a.png', contentType: 'image/png' });
      expect(res.status).toBe(200);
      expect((await target('angle', angle.id)).status).toBe('complete');
      expect(await attempt(u)).toMatchObject({ state: 'uncertain', error_code: 'PROVIDER_OUTCOME_UNKNOWN' });
      expect(falCalls()).toBe(0);
    });

    test('Upload on a stored_failed angle, then Retry storing of the kept URL, is not needed and cannot complete twice', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const a = await storedFailed('angle', angle, set.id);
      await run("UPDATE scene_angles SET generation_status = 'complete', still_image_url = 'https://bucket.example/upload.jpg' WHERE id = :id", { id: angle.id });
      // The attempt may still be marked stored later (it does not touch the row).
      await run("UPDATE scene_generation_attempts SET state = 'stored' WHERE id = :a", { a });
      expect((await target('angle', angle.id)).status).toBe('complete');
    });
  });
  // ── Correction checks (Evoni, 2026-11-08: correction approved) ────────────
  describe('a confirmed replacement that was never sent is not freely retryable', () => {
    async function returnedRow() {
      const set = await makeSet({ base_still_url: 'https://bucket.example/base.jpg' });
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const u = await makeUncertain('angle', angle, set.id);
      const token = await issue(u);
      const r = await confirmedClaim('angle', angle, set.id, token);
      await run("UPDATE scene_generation_attempts SET state = 'not_sent', finished_at = NOW(), error_code = 'ECONNREFUSED' WHERE id = :a", { a: r.next });
      return { set, angle, u, token, replacement: r.next };
    }

    test('back to uncertain: legacy claim, a claim without confirmation, a reset and the old token are all refused', async () => {
      const { set, angle, token, replacement } = await returnedRow();
      await run("UPDATE scene_angles SET generation_status = 'uncertain' WHERE id = :id", { id: angle.id });
      await expect(generationClaim.claimRow(sequelize, 'angle', angle.id)).rejects.toThrow(GUARD);
      await expect(sequelize.transaction((transaction) => claim('angle', angle, set.id, { supersedes: replacement, transaction }))).rejects.toThrow(/needs a confirmation/);
      for (const st of ['failed', 'pending']) {
        await expect(run('UPDATE scene_angles SET generation_status = :st WHERE id = :id', { st, id: angle.id })).rejects.toThrow(GUARD);
      }
      // The consumed token cannot be used again.
      expect(await confirmedClaim('angle', angle, set.id, token)).toMatchObject({ ok: false });
      // Another user's confirmation on the replacement is refused at consumption.
      const other = await issue(replacement, 'admin-2');
      expect(await confirmedClaim('angle', angle, set.id, other, 'admin-1')).toMatchObject({ ok: false });
      expect((await target('angle', angle.id))).toMatchObject({ status: 'uncertain', current_attempt_id: replacement });
      expect(falCalls()).toBe(0);
    });

    test('a crash left the row generating after the replacement was recorded not_sent: no restamp, no reset, even when stale', async () => {
      const { angle } = await returnedRow();
      await age('angle', angle.id, 20);
      await expect(generationClaim.claimRow(sequelize, 'angle', angle.id)).rejects.toThrow(GUARD);
      await expect(models.SceneAngle.update({ generation_status: 'generating' }, { where: { id: angle.id } })).rejects.toThrow(GUARD);
      await expect(run("UPDATE scene_angles SET generation_status = 'failed' WHERE id = :id", { id: angle.id })).rejects.toThrow(GUARD);
      // The reconciler's move is allowed.
      await run("UPDATE scene_angles SET generation_status = 'uncertain' WHERE id = :id", { id: angle.id });
    });

    test('no second paid request through any route without a new confirmation (0 fal calls)', async () => {
      const { set, angle } = await returnedRow();
      await run("UPDATE scene_angles SET generation_status = 'uncertain' WHERE id = :id", { id: angle.id });
      const app = require('../../src/app');
      const auth = `Bearer ${require('../../src/services/tokenService').generateTokenPair({
        id: 'test-user-flows', email: 'u@flows.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken}`;
      const gen = await request(app).post(`/api/v1/scene-sets/${set.id}/angles/${angle.id}/generate`).set('Authorization', auth).send({});
      expect([gen.status, gen.body.error]).toEqual([500, expect.stringMatching(GUARD)]);
      const refine = await request(app).post(`/api/v1/scene-sets/${set.id}/angles/${angle.id}/regenerate`).set('Authorization', auth).send({ categories: ['SOFT_FOCUS'] });
      expect([refine.status, refine.body.error]).toEqual([500, expect.stringMatching(GUARD)]);
      const all = await request(app).post(`/api/v1/scene-sets/${set.id}/generate-all-angles`).set('Authorization', auth).send({ angle_ids: [angle.id] });
      expect(all.body.angle_ids).toEqual([]);
      const reset = await request(app).patch(`/api/v1/scene-sets/${set.id}/angles/${angle.id}`).set('Authorization', auth).send({ generation_status: 'pending' });
      expect(reset.status).toBe(500);
      await new Promise((r) => setTimeout(r, 200));
      expect(falCalls()).toBe(0);
      expect((await rows('SELECT id FROM scene_generation_attempts WHERE target_id = :t', { t: angle.id }))).toHaveLength(2);
    });

    test('a new confirmation (bound to one user) can be issued on it, and four concurrent uses create exactly one further attempt', async () => {
      const { set, angle, u, replacement } = await returnedRow();
      await run("UPDATE scene_angles SET generation_status = 'uncertain' WHERE id = :id", { id: angle.id });
      const token = await issue(replacement, 'admin-1');
      expect(await attempt(replacement)).toMatchObject({ state: 'not_sent', confirm_user_id: 'admin-1', confirm_consumed_at: null });
      const results = await Promise.all([0, 1, 2, 3].map(() => confirmedClaim('angle', angle, set.id, token, 'admin-1', { pauseMs: 40 })));
      const winners = results.filter((r) => r.ok);
      expect(winners).toHaveLength(1);
      const all = await rows('SELECT id, state, supersedes_attempt_id FROM scene_generation_attempts WHERE target_id = :t ORDER BY claimed_at', { t: angle.id });
      expect(all).toHaveLength(3);
      expect(all.filter((a) => a.supersedes_attempt_id === replacement)).toEqual([expect.objectContaining({ id: winners[0].next, state: 'claimed' })]);
      expect(await target('angle', angle.id)).toMatchObject({ status: 'generating', current_attempt_id: winners[0].next });
      // The chain of evidence is intact and unchanged.
      expect(await attempt(u)).toMatchObject({ state: 'uncertain', confirm_consumed_by_attempt_id: replacement });
      expect(await attempt(replacement)).toMatchObject({ state: 'not_sent', confirm_consumed_by_attempt_id: winners[0].next });
      // That one further attempt may be dispatched once.
      expect(await dispatch(winners[0].next)).toBe(true);
      expect(await dispatch(winners[0].next)).toBe(false);
      expect(falCalls()).toBe(0);
    });

    test('the same holds for an uncertain or stored_failed attempt left behind a generating row', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const a = await claim('angle', angle, set.id);
      await dispatch(a);
      await run("UPDATE scene_generation_attempts SET state = 'uncertain', finished_at = NOW() WHERE id = :a", { a });
      await expect(run("UPDATE scene_angles SET generation_status = 'failed' WHERE id = :id", { id: angle.id })).rejects.toThrow(GUARD);
      await expect(run("UPDATE scene_angles SET generation_status = 'generating' WHERE id = :id", { id: angle.id })).rejects.toThrow(GUARD);
      await run("UPDATE scene_angles SET generation_status = 'uncertain' WHERE id = :id", { id: angle.id });
    });
  });

  describe('rollback compatibility: the current application with PR B attempts in flight', () => {
    const app = () => require('../../src/app');
    const bearer = () => `Bearer ${require('../../src/services/tokenService').generateTokenPair({
      id: 'test-user-flows', email: 'u@flows.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken}`;

    test('fresh in flight: Generate is 409, Generate All skips it, claimRow reports busy, no fal request', async () => {
      const set = await makeSet({ base_still_url: 'https://bucket.example/base.jpg' });
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const a = await claim('angle', angle, set.id);
      await dispatch(a);
      const g = await request(app()).post(`/api/v1/scene-sets/${set.id}/angles/${angle.id}/generate`).set('Authorization', bearer()).send({});
      expect([g.status, g.body.code]).toEqual([409, 'ALREADY_GENERATING']);
      const all = await request(app()).post(`/api/v1/scene-sets/${set.id}/generate-all-angles`).set('Authorization', bearer()).send({ angle_ids: [angle.id] });
      expect(all.body.angle_ids).toEqual([]);
      expect(await generationClaim.claimRow(sequelize, 'angle', angle.id)).toBe(false);
      await new Promise((r) => setTimeout(r, 200));
      expect(falCalls()).toBe(0);
      expect(await attempt(a)).toMatchObject({ state: 'dispatch_started' });
    });

    test('fresh in flight: the base paths (generate-base, generateBaseScene) cannot send', async () => {
      const set = await makeSet();
      await claim('set', set, set.id);
      const b = await request(app()).post(`/api/v1/scene-sets/${set.id}/generate-base`).set('Authorization', bearer()).send({ force: true });
      expect(b.status).toBe(409);
      await expect(sceneGen.generateBaseScene(await models.SceneSet.findByPk(set.id), models, {})).rejects.toThrow(GUARD);
      expect(falCalls()).toBe(0);
    });

    test('stale in flight: Generate, generate-base and claimRow are refused by the guard, no fal request', async () => {
      const set = await makeSet({ base_still_url: 'https://bucket.example/base.jpg' });
      const angle = await makeAngle(set, { generation_status: 'pending' });
      await dispatch(await claim('angle', angle, set.id));
      await age('angle', angle.id, 20);
      const g = await request(app()).post(`/api/v1/scene-sets/${set.id}/angles/${angle.id}/generate`).set('Authorization', bearer()).send({});
      expect([g.status, g.body.error]).toEqual([500, expect.stringMatching(GUARD)]);
      const set2 = await makeSet();
      await dispatch(await claim('set', set2, set2.id));
      await age('set', set2.id, 20);
      const b = await request(app()).post(`/api/v1/scene-sets/${set2.id}/generate-base`).set('Authorization', bearer()).send({ force: true });
      expect([b.status, b.body.error]).toEqual([500, expect.stringMatching(GUARD)]);
      await expect(generationClaim.claimRow(sequelize, 'angle', angle.id)).rejects.toThrow(GUARD);
      await new Promise((r) => setTimeout(r, 200));
      expect(falCalls()).toBe(0);
    });
  });

  describe('normal generation is not restricted by the correction', () => {
    test('a row with no attempt: restamping generating, resets and generateBaseScene work as before (one fal request)', async () => {
      const set = await makeSet();
      await models.SceneSet.update({ generation_status: 'generating' }, { where: { id: set.id } });
      await models.SceneSet.update({ generation_status: 'generating' }, { where: { id: set.id } });
      await run("UPDATE scene_sets SET generation_status = 'pending' WHERE id = :id", { id: set.id });
      await sceneGen.generateBaseScene(await models.SceneSet.findByPk(set.id), models, {}).catch(() => {});
      expect(falCalls()).toBe(1);
    });

    test('a row whose attempt finished normally (stored, refused, not_sent unconfirmed) generates again as before', async () => {
      for (const end of ['stored', 'refused', 'not_sent']) {
        const set = await makeSet();
        const angle = await makeAngle(set, { generation_status: 'pending' });
        const a = await claim('angle', angle, set.id);
        if (end !== 'not_sent') await dispatch(a);
        await run('UPDATE scene_generation_attempts SET state = :end, finished_at = NOW() WHERE id = :a', { end, a });
        await run('UPDATE scene_angles SET generation_status = :st WHERE id = :id', { st: end === 'stored' ? 'complete' : 'failed', id: angle.id });
        // Legacy claim, a status restamp, resets: all as before.
        expect(await generationClaim.claimRow(sequelize, 'angle', angle.id)).toBe(true);
        await models.SceneAngle.update({ generation_status: 'generating' }, { where: { id: angle.id } });
        await run("UPDATE scene_angles SET generation_status = 'pending' WHERE id = :id", { id: angle.id });
        // A new attempt needs no confirmation.
        await claim('angle', angle, set.id);
      }
    });

    test('after Upload resolved an uncertain row, its normal edits (reset to pending, failed) work', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      await makeUncertain('angle', angle, set.id);
      await run("UPDATE scene_angles SET generation_status = 'complete', still_image_url = 'https://bucket.example/up.jpg' WHERE id = :id", { id: angle.id });
      await run("UPDATE scene_angles SET generation_status = 'pending' WHERE id = :id", { id: angle.id });
      await run("UPDATE scene_angles SET generation_status = 'failed' WHERE id = :id", { id: angle.id });
      expect(await generationClaim.claimRow(sequelize, 'angle', angle.id)).toBe(true);
    });

    test('TRUNCATE is still possible when nothing is uncertain or in flight (inside a transaction that is rolled back)', async () => {
      const t = await sequelize.transaction();
      try {
        const opts = { transaction: t };
        // Clear, within this transaction only, what would make it refuse.
        await run('SET LOCAL session_replication_role = replica', {}, opts);
        await run("UPDATE scene_angles SET generation_status = 'failed' WHERE generation_status::text = 'uncertain'", {}, opts);
        await run("UPDATE scene_sets SET generation_status = 'failed' WHERE generation_status::text = 'uncertain'", {}, opts);
        await run("UPDATE scene_generation_attempts SET state = 'abandoned_unsent' WHERE state IN ('claimed', 'dispatch_started')", {}, opts);
        await run('SET LOCAL session_replication_role = origin', {}, opts);
        await expect(run('TRUNCATE scene_angles CASCADE', {}, opts)).resolves.toBeTruthy();
      } finally {
        await t.rollback();
      }
      expect((await one('SELECT count(*)::int AS n FROM scene_angles')).n).toBeGreaterThan(0);
    });
  });
});

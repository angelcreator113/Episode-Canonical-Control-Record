/**
 * Scene Sets uncertain outcomes, PR A (#3748): the schema and its database
 * guards, exercised with direct SQL (no application code), plus both
 * migration directions. Synthetic rows only; no provider is involved.
 *
 * Cleanup deletes this suite's own attempt rows with triggers disabled for
 * the session (session_replication_role = replica, a superuser setting that
 * only the test database allows): the guards themselves forbid it, which is
 * the point.
 */
jest.unmock('uuid');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const models = require('../../src/models');
const statusMigration = require('../../src/migrations/20261108210000-scene-generation-uncertain-status');
const attemptsMigration = require('../../src/migrations/20261108210100-scene-generation-attempts');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}, opts = {}) => sequelize.query(sql, { replacements, ...opts });
const one = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT }))[0];
const GUARD = /scene generation guard/;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

(shouldSkip ? describe.skip : describe)('scene generation guards (PR A)', () => {
  const setIds = [];
  const tag = uuid().slice(0, 8);

  async function makeSet(fields = {}) {
    const set = await models.SceneSet.create({ name: `Guard ${tag} ${uuid().slice(0, 6)}`, scene_type: 'HOME_BASE', ...fields });
    setIds.push(set.id);
    return set;
  }
  async function makeAngle(set, fields = {}) {
    return models.SceneAngle.create({ scene_set_id: set.id, angle_label: `A${uuid().slice(0, 4)}`, angle_name: 'Angle', ...fields });
  }
  const table = (kind) => (kind === 'set' ? 'scene_sets' : 'scene_angles');
  const target = async (kind, id) => one(`SELECT generation_status::text AS status, current_attempt_id, deleted_at,
      ${kind === 'set' ? 'base_still_url' : 'still_image_url'} AS image FROM ${table(kind)} WHERE id = :id`, { id });
  const attempt = async (id) => one('SELECT * FROM scene_generation_attempts WHERE id = :id', { id });

  // The PR B claim, done by hand: a claimed attempt and the row generating.
  async function claim(kind, row, setId, extra = {}, opts = {}) {
    const id = uuid();
    await run(`INSERT INTO scene_generation_attempts (id, target_kind, target_id, scene_set_id, provider, model, route, created_by, supersedes_attempt_id)
               VALUES (:id, :kind, :tid, :sid, 'fal', 'fal-ai/flux/dev', 'test', 'tester', :sup)`,
    { id, kind, tid: row.id, sid: setId, sup: extra.supersedes || null }, opts);
    await run(`UPDATE ${table(kind)} SET generation_status = 'generating', current_attempt_id = :id, updated_at = NOW() WHERE id = :tid`,
      { id, tid: row.id }, opts);
    return id;
  }
  const dispatch = (id) => run("UPDATE scene_generation_attempts SET state = 'dispatch_started', dispatch_started_at = NOW() WHERE id = :id", { id });
  async function makeUncertain(kind, row, setId) {
    const id = await claim(kind, row, setId);
    await dispatch(id);
    await run(`UPDATE scene_generation_attempts SET state = 'uncertain', finished_at = NOW(), error_code = 'PROVIDER_OUTCOME_UNKNOWN',
                 error_class = 'ProviderOutcomeUnknownError', message = 'timeout', estimate_usd = 0.025 WHERE id = :id`, { id });
    await run(`UPDATE ${table(kind)} SET generation_status = 'uncertain' WHERE id = :tid`, { tid: row.id });
    return id;
  }
  async function issue(attemptId, user = 'admin-1', minutes = 10) {
    const token = crypto.randomBytes(32).toString('hex');
    await run(`UPDATE scene_generation_attempts SET confirm_token_hash = :h, confirm_user_id = :u,
                 confirm_expires_at = NOW() + make_interval(mins => :m) WHERE id = :id`, { h: sha(token), u: user, m: minutes, id: attemptId });
    return token;
  }
  // The PR C confirmed claim, in one transaction: new attempt, consume, switch.
  async function confirmedClaim(kind, row, setId, oldAttemptId, user = 'admin-1') {
    return sequelize.transaction(async (transaction) => {
      const opts = { transaction };
      const id = uuid();
      await run(`INSERT INTO scene_generation_attempts (id, target_kind, target_id, scene_set_id, provider, model, route, created_by, supersedes_attempt_id)
                 VALUES (:id, :kind, :tid, :sid, 'fal', 'fal-ai/flux/dev', 'test', :u, :old)`, { id, kind, tid: row.id, sid: setId, u: user, old: oldAttemptId }, opts);
      await run(`UPDATE scene_generation_attempts SET confirm_consumed_at = NOW(), confirm_consumed_by_attempt_id = :id, confirm_consumed_by_user_id = :u
                  WHERE id = :old AND confirm_consumed_at IS NULL`, { id, u: user, old: oldAttemptId }, opts);
      await run(`UPDATE ${table(kind)} SET generation_status = 'generating', current_attempt_id = :id, updated_at = NOW() WHERE id = :tid`,
        { id, tid: row.id }, opts);
      return id;
    });
  }

  // Sequelize reports a unique violation as "Validation error"; the index name is on the driver error.
  const IN_FLIGHT = { name: 'SequelizeUniqueConstraintError', parent: expect.objectContaining({ constraint: 'scene_generation_attempts_one_in_flight' }) };

  afterAll(async () => {
    if (!setIds.length) return;
    await sequelize.transaction(async (transaction) => {
      const opts = { transaction };
      await run('SET LOCAL session_replication_role = replica', {}, opts);
      const angleIds = (await sequelize.query('SELECT id FROM scene_angles WHERE scene_set_id IN (:ids)', { replacements: { ids: setIds }, transaction, type: sequelize.QueryTypes.SELECT })).map((r) => r.id);
      await run('UPDATE scene_sets SET current_attempt_id = NULL WHERE id IN (:ids)', { ids: setIds }, opts);
      if (angleIds.length) await run('UPDATE scene_angles SET current_attempt_id = NULL WHERE id IN (:ids)', { ids: angleIds }, opts);
      // Replica mode skips the guards and the foreign-key triggers, so the
      // self-references need no unpicking (the CHECKs would refuse that).
      await run('DELETE FROM scene_generation_attempts WHERE scene_set_id IN (:ids)', { ids: setIds }, opts);
      await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: setIds }, opts);
      await run('DELETE FROM scene_sets WHERE id IN (:ids)', { ids: setIds }, opts);
    });
  });

  describe('migrations', () => {
    test('both directions: down refuses while evidence exists; with none, down and up again round-trip', async () => {
      // Runs first, before this suite records any attempt. Other suites clean
      // up their own attempts, so the table is empty on a fresh database.
      const [{ n }] = await sequelize.query('SELECT count(*)::int AS n FROM scene_generation_attempts', { type: sequelize.QueryTypes.SELECT });
      if (n === 0) {
        await attemptsMigration.down(sequelize.getQueryInterface(), Sequelize);
        expect((await one("SELECT to_regclass('public.scene_generation_attempts') AS t")).t).toBeNull();
        expect((await one(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname LIKE 'scene_generation%'`)).n).toBe(0);
        expect((await one(`SELECT count(*)::int AS n FROM pg_proc WHERE proname LIKE 'scene_generation%'`)).n).toBe(0);
        await statusMigration.down(sequelize.getQueryInterface(), Sequelize); // no uncertain rows: a no-op
        await statusMigration.up(sequelize.getQueryInterface(), Sequelize); // IF NOT EXISTS: idempotent
        await attemptsMigration.up(sequelize.getQueryInterface(), Sequelize);
      }
      expect((await one("SELECT to_regclass('public.scene_generation_attempts') AS t")).t).toBe('scene_generation_attempts');
      expect((await one(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname LIKE 'scene_generation%' AND NOT tgisinternal`)).n).toBe(8);
      expect((await one(`SELECT count(*)::int AS n FROM pg_proc WHERE proname LIKE 'scene_generation%'`)).n).toBe(5);
      expect((await one(`SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) AS v FROM pg_enum
                           WHERE enumtypid = 'enum_scene_sets_generation_status'::regtype`)).v).toBe('pending,generating,complete,failed,uncertain');

      // Evidence present: both downs refuse and change nothing.
      const set = await makeSet();
      await makeUncertain('set', set, set.id);
      await expect(attemptsMigration.down(sequelize.getQueryInterface(), Sequelize)).rejects.toThrow(/Refusing to remove the scene generation safeguards/);
      await expect(statusMigration.down(sequelize.getQueryInterface(), Sequelize)).rejects.toThrow(/Refusing to undo the 'uncertain' generation status/);
      expect((await target('set', set.id)).status).toBe('uncertain');
      expect((await one(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname LIKE 'scene_generation%' AND NOT tgisinternal`)).n).toBe(8);
      expect((await one(`SELECT count(*)::int AS n FROM pg_proc WHERE proname LIKE 'scene_generation%'`)).n).toBe(5);
    });

    test('why two files: a new enum value cannot be used in the transaction that adds it', async () => {
      const type = `tmp_enum_${tag}`;
      await run(`CREATE TYPE ${type} AS ENUM ('a')`);
      try {
        await expect(sequelize.transaction(async (transaction) => {
          await run(`ALTER TYPE ${type} ADD VALUE 'b'`, {}, { transaction });
          await run(`SELECT 'b'::${type}`, {}, { transaction });
        })).rejects.toThrow(/unsafe use of new value/);
      } finally {
        await run(`DROP TYPE ${type}`);
      }
    });
  });

  describe('attempt rows', () => {
    test('a new attempt starts claimed and clean; it may supersede only an uncertain attempt of the same row', async () => {
      const set = await makeSet();
      await expect(run(`INSERT INTO scene_generation_attempts (target_kind, target_id, scene_set_id, state) VALUES ('set', :id, :id, 'stored')`, { id: set.id })).rejects.toThrow(GUARD);
      await expect(run(`INSERT INTO scene_generation_attempts (target_kind, target_id, scene_set_id, provider_image_url) VALUES ('set', :id, :id, 'https://x/y.jpg')`, { id: set.id })).rejects.toThrow(GUARD);
      await expect(run(`INSERT INTO scene_generation_attempts (target_kind, target_id, scene_set_id, confirm_token_hash, confirm_user_id, confirm_expires_at)
                         VALUES ('set', :id, :id, :h, 'u', NOW() + INTERVAL '1 hour')`, { id: set.id, h: sha('x') })).rejects.toThrow(GUARD);
      const other = await makeSet();
      const otherUncertain = await makeUncertain('set', other, other.id);
      await expect(claim('set', set, set.id, { supersedes: otherUncertain })).rejects.toThrow(/may only supersede an uncertain attempt of the same target/);
      const done = await claim('set', set, set.id);
      await dispatch(done);
      await run("UPDATE scene_generation_attempts SET state = 'stored', finished_at = NOW() WHERE id = :id", { id: done });
      await run("UPDATE scene_sets SET generation_status = 'complete', base_still_url = 'https://bucket/x.jpg' WHERE id = :id", { id: set.id });
      await expect(claim('set', set, set.id, { supersedes: done })).rejects.toThrow(/may only supersede an uncertain attempt/);
    });

    test('state transitions: only the defined ones', async () => {
      const set = await makeSet();
      const id = await claim('set', set, set.id);
      await expect(run("UPDATE scene_generation_attempts SET state = 'stored' WHERE id = :id", { id })).rejects.toThrow(/cannot go from claimed to stored/);
      await expect(run("UPDATE scene_generation_attempts SET state = 'uncertain' WHERE id = :id", { id })).rejects.toThrow(/cannot go from claimed to uncertain/);
      await dispatch(id);
      await expect(run("UPDATE scene_generation_attempts SET state = 'claimed' WHERE id = :id", { id })).rejects.toThrow(/cannot go from dispatch_started to claimed/);
      await expect(run("UPDATE scene_generation_attempts SET state = 'abandoned_unsent' WHERE id = :id", { id })).rejects.toThrow(/cannot go from dispatch_started to abandoned_unsent/);
      await run("UPDATE scene_generation_attempts SET state = 'stored_failed', provider_image_url = 'https://fal.media/a.jpg', storage_error = 's3 down' WHERE id = :id", { id });
      await run("UPDATE scene_generation_attempts SET storage_error = 's3 down again' WHERE id = :id", { id }); // still stored_failed
      await run("UPDATE scene_generation_attempts SET state = 'stored', finished_at = NOW() WHERE id = :id", { id }); // Retry storing
      await expect(run("UPDATE scene_generation_attempts SET state = 'uncertain' WHERE id = :id", { id })).rejects.toThrow(/cannot go from stored to uncertain/);
      await expect(run("UPDATE scene_generation_attempts SET storage_error = 'later' WHERE id = :id", { id })).rejects.toThrow(/storage error is recorded only with a failed store/);
    });

    test('evidence and identity are write-once; legitimate outcome recording is allowed', async () => {
      const set = await makeSet();
      const id = await claim('set', set, set.id);
      await dispatch(id);
      // Recording the response, usage id, estimate and error once: allowed.
      await run(`UPDATE scene_generation_attempts SET state = 'uncertain', finished_at = NOW(), usage_log_id = 42, estimate_usd = 0.025,
                   error_code = 'PROVIDER_OUTCOME_UNKNOWN', error_class = 'ProviderOutcomeUnknownError', message = 'timeout' WHERE id = :id`, { id });
      for (const [col, val] of [['message', "'other'"], ['usage_log_id', '43'], ['estimate_usd', '1'], ['error_code', "'X'"],
        ['dispatch_started_at', 'NOW()'], ['finished_at', 'NOW()']]) {
        await expect(run(`UPDATE scene_generation_attempts SET ${col} = ${val} WHERE id = :id`, { id })).rejects.toThrow(/recorded evidence cannot be changed/);
      }
      for (const [col, val] of [['target_id', `'${uuid()}'`], ['target_kind', "'angle'"], ['provider', "'openai'"], ['model', "'m'"], ['created_by', "'x'"], ['claimed_at', 'NOW()']]) {
        await expect(run(`UPDATE scene_generation_attempts SET ${col} = ${val} WHERE id = :id`, { id })).rejects.toThrow(/identity cannot change/);
      }
      await run('UPDATE scene_generation_attempts SET updated_at = NOW() WHERE id = :id', { id }); // bookkeeping is free
    });

    test('attempts cannot be deleted or truncated', async () => {
      const set = await makeSet();
      const id = await claim('set', set, set.id);
      await expect(run('DELETE FROM scene_generation_attempts WHERE id = :id', { id })).rejects.toThrow(/append-only evidence; DELETE/);
      await expect(run('TRUNCATE scene_generation_attempts')).rejects.toThrow(/append-only evidence; TRUNCATE|cannot truncate a table referenced in a foreign key constraint/);
      // With CASCADE the foreign keys no longer stop it, so the trigger must.
      // Inside a transaction that is always rolled back, whatever happens.
      const t = await sequelize.transaction();
      try {
        await expect(run('TRUNCATE scene_generation_attempts CASCADE', {}, { transaction: t })).rejects.toThrow(/append-only evidence; TRUNCATE/);
      } finally {
        await t.rollback();
      }
      expect(await attempt(id)).toBeTruthy();
    });

    test('one attempt in flight per row', async () => {
      const set = await makeSet();
      await claim('set', set, set.id);
      await expect(run(`INSERT INTO scene_generation_attempts (target_kind, target_id, scene_set_id) VALUES ('set', :id, :id)`, { id: set.id }))
        .rejects.toMatchObject(IN_FLIGHT);
    });
  });

  describe('attempt references (ownership)', () => {
    test("a row cannot take another row's attempt, a missing one, a finished one, or clear its reference", async () => {
      const a = await makeSet();
      const b = await makeSet();
      const bAttempt = await claim('set', b, b.id);
      await expect(run("UPDATE scene_sets SET generation_status = 'generating', current_attempt_id = :x WHERE id = :id", { x: bAttempt, id: a.id }))
        .rejects.toThrow(/does not belong to set/);
      await expect(run("UPDATE scene_sets SET generation_status = 'generating', current_attempt_id = :x WHERE id = :id", { x: uuid(), id: a.id }))
        .rejects.toThrow(/does not belong|foreign key/);
      const angle = await makeAngle(a);
      const angleAttempt = await claim('angle', angle, a.id);
      await expect(run("UPDATE scene_sets SET generation_status = 'generating', current_attempt_id = :x WHERE id = :id", { x: angleAttempt, id: a.id }))
        .rejects.toThrow(/does not belong to set/);
      // Clearing.
      await expect(run('UPDATE scene_sets SET current_attempt_id = NULL WHERE id = :id', { id: b.id })).rejects.toThrow(/cannot be cleared/);
      // A new attempt must come with 'generating'.
      const c = await makeSet();
      const cAttempt = uuid();
      await run(`INSERT INTO scene_generation_attempts (id, target_kind, target_id, scene_set_id) VALUES (:x, 'set', :id, :id)`, { x: cAttempt, id: c.id });
      await expect(run("UPDATE scene_sets SET current_attempt_id = :x WHERE id = :id", { x: cAttempt, id: c.id })).rejects.toThrow(/new, claimed attempt while becoming generating/);
    });

    test('an attempt in flight cannot be replaced, left behind, or reclaimed once stale', async () => {
      const set = await makeSet();
      const first = await claim('set', set, set.id);
      // Another attempt while one is in flight: the unique index stops the insert itself.
      await expect(claim('set', set, set.id)).rejects.toMatchObject(IN_FLIGHT);
      // Leaving 'generating' while the attempt is in flight.
      await expect(run("UPDATE scene_sets SET generation_status = 'failed' WHERE id = :id", { id: set.id })).rejects.toThrow(/in flight; record its outcome first/);
      await expect(run("UPDATE scene_sets SET generation_status = 'complete', base_still_url = 'https://b/x.jpg' WHERE id = :id", { id: set.id })).rejects.toThrow(/in flight/);
      // A fresh in-flight row may be touched (legacy writes while running).
      await run("UPDATE scene_sets SET base_runway_prompt = 'p' WHERE id = :id", { id: set.id });
      // Stale: the legacy reclaim (generationClaimService.claimRow's statement) is refused.
      await dispatch(first);
      await run("UPDATE scene_sets SET updated_at = NOW() - INTERVAL '20 minutes' WHERE id = :id", { id: set.id });
      await expect(run(`UPDATE scene_sets SET generation_status = 'generating', updated_at = NOW()
                         WHERE id = :id AND (generation_status IS DISTINCT FROM 'generating' OR updated_at < NOW() - make_interval(mins => 15))`, { id: set.id }))
        .rejects.toThrow(/stale attempt in flight|another generation cannot start/);
      expect(await target('set', set.id)).toMatchObject({ status: 'generating', current_attempt_id: first });
    });
  });

  describe('uncertain rows', () => {
    test('enter uncertain only through an attempt recorded as uncertain (or a failed store)', async () => {
      const set = await makeSet();
      await expect(run("UPDATE scene_sets SET generation_status = 'uncertain' WHERE id = :id", { id: set.id })).rejects.toThrow(/only through an attempt recorded as uncertain/);
      const id = await claim('set', set, set.id);
      await dispatch(id);
      await run("UPDATE scene_generation_attempts SET state = 'stored' WHERE id = :id", { id });
      await run("UPDATE scene_sets SET generation_status = 'complete', base_still_url = 'https://b/s.jpg' WHERE id = :id", { id: set.id });
      await expect(run("UPDATE scene_sets SET generation_status = 'uncertain' WHERE id = :id", { id: set.id })).rejects.toThrow(/only through an attempt recorded as uncertain/);
      const angle = await makeAngle(set);
      const sid = await claim('angle', angle, set.id);
      await dispatch(sid);
      await run("UPDATE scene_generation_attempts SET state = 'stored_failed', provider_image_url = 'https://fal.media/b.jpg', storage_error = 'x' WHERE id = :id", { id: sid });
      await run("UPDATE scene_angles SET generation_status = 'uncertain' WHERE id = :id", { id: angle.id }); // a paid image kept, not stored
      expect((await target('angle', angle.id)).status).toBe('uncertain');
    });

    test.each(['set', 'angle'])('%s: never reclassified as failed or pending, never retried without a confirmation', async (kind) => {
      const set = await makeSet();
      const row = kind === 'set' ? set : await makeAngle(set);
      const before = await makeUncertain(kind, row, set.id);
      await expect(run(`UPDATE ${table(kind)} SET generation_status = 'failed' WHERE id = :id`, { id: row.id })).rejects.toThrow(/cannot become failed/);
      await expect(run(`UPDATE ${table(kind)} SET generation_status = 'pending' WHERE id = :id`, { id: row.id })).rejects.toThrow(/cannot become pending/);
      // The legacy claim (status only).
      await expect(run(`UPDATE ${table(kind)} SET generation_status = 'generating', updated_at = NOW() WHERE id = :id AND generation_status IS DISTINCT FROM 'generating'`, { id: row.id }))
        .rejects.toThrow(GUARD);
      // A new attempt without a consumed confirmation.
      await expect(claim(kind, row, set.id, { supersedes: before })).rejects.toThrow(/needs a confirmation consumed for it/);
      expect(await target(kind, row.id)).toMatchObject({ status: 'uncertain', current_attempt_id: before });
    });

    test.each(['set', 'angle'])('%s: becomes complete only with a newly stored image (Upload)', async (kind) => {
      const set = await makeSet();
      const row = kind === 'set' ? set : await makeAngle(set);
      const col = kind === 'set' ? 'base_still_url' : 'still_image_url';
      await run(`UPDATE ${table(kind)} SET ${col} = 'https://bucket/old.jpg' WHERE id = :id`, { id: row.id });
      const before = await makeUncertain(kind, row, set.id);
      await expect(run(`UPDATE ${table(kind)} SET generation_status = 'complete' WHERE id = :id`, { id: row.id })).rejects.toThrow(/only with a newly stored image/);
      await expect(run(`UPDATE ${table(kind)} SET generation_status = 'complete', ${col} = 'https://bucket/old.jpg' WHERE id = :id`, { id: row.id })).rejects.toThrow(/newly stored image/);
      await expect(run(`UPDATE ${table(kind)} SET generation_status = 'complete', ${col} = '  ' WHERE id = :id`, { id: row.id })).rejects.toThrow(/newly stored image/);
      await expect(run(`UPDATE ${table(kind)} SET generation_status = 'complete', ${col} = NULL WHERE id = :id`, { id: row.id })).rejects.toThrow(/newly stored image/);
      await run(`UPDATE ${table(kind)} SET generation_status = 'complete', ${col} = 'https://bucket/uploaded.jpg' WHERE id = :id`, { id: row.id });
      expect(await target(kind, row.id)).toMatchObject({ status: 'complete', current_attempt_id: before, image: 'https://bucket/uploaded.jpg' });
      expect((await attempt(before)).state).toBe('uncertain'); // the evidence stays
    });

    test('Retry storing: a kept provider image stored later completes the row, no new attempt', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set);
      const id = await claim('angle', angle, set.id);
      await dispatch(id);
      await run("UPDATE scene_generation_attempts SET state = 'stored_failed', provider_image_url = 'https://fal.media/k.jpg', storage_error = 'x' WHERE id = :id", { id });
      await run("UPDATE scene_angles SET generation_status = 'uncertain' WHERE id = :id", { id: angle.id });
      await expect(run("UPDATE scene_angles SET generation_status = 'complete' WHERE id = :id", { id: angle.id })).rejects.toThrow(/newly stored image/);
      await run("UPDATE scene_generation_attempts SET state = 'stored' WHERE id = :id", { id });
      await run("UPDATE scene_angles SET generation_status = 'complete', still_image_url = 'https://bucket/stored.jpg' WHERE id = :id", { id: angle.id });
      expect(await target('angle', angle.id)).toMatchObject({ status: 'complete', current_attempt_id: id });
    });

    test('Mark reviewed: once, only on an uncertain attempt; the row stays uncertain', async () => {
      const set = await makeSet();
      const id = await makeUncertain('set', set, set.id);
      await run("UPDATE scene_generation_attempts SET reviewed_at = NOW(), reviewed_by = 'admin-1', review_note = 'checked fal' WHERE id = :id", { id });
      await expect(run("UPDATE scene_generation_attempts SET reviewed_by = 'admin-2' WHERE id = :id", { id })).rejects.toThrow(/recorded evidence cannot be changed/);
      expect((await target('set', set.id)).status).toBe('uncertain');
      const other = await makeSet();
      const done = await claim('set', other, other.id);
      await expect(run("UPDATE scene_generation_attempts SET reviewed_at = NOW(), reviewed_by = 'a' WHERE id = :id", { id: done })).rejects.toThrow(/only an uncertain attempt is marked reviewed/);
    });
  });

  describe('confirmation (single-use, short-lived, bound)', () => {
    test('a valid confirmation lets exactly one new attempt follow; the original evidence is kept', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set);
      const before = await makeUncertain('angle', angle, set.id);
      await issue(before, 'admin-1');
      const next = await confirmedClaim('angle', angle, set.id, before, 'admin-1');
      expect(await target('angle', angle.id)).toMatchObject({ status: 'generating', current_attempt_id: next });
      const orig = await attempt(before);
      expect(orig).toMatchObject({ state: 'uncertain', message: 'timeout', confirm_consumed_by_attempt_id: next, confirm_consumed_by_user_id: 'admin-1' });
      expect((await attempt(next)).supersedes_attempt_id).toBe(before);
      // Replay: the consumption is written once.
      await expect(run(`UPDATE scene_generation_attempts SET confirm_consumed_at = NOW() WHERE id = :id`, { id: before })).rejects.toThrow(/recorded evidence cannot be changed/);
      // Re-issuing after consumption is refused.
      await expect(issue(before)).rejects.toThrow(/issued only for an uncertain attempt not yet confirmed/);
    });

    test('expired, another user, a non-superseding attempt, or no confirmation: refused, nothing changes', async () => {
      const set = await makeSet();
      const before = await makeUncertain('set', set, set.id);
      // Expired.
      await issue(before, 'admin-1', 10);
      await run("UPDATE scene_generation_attempts SET confirm_expires_at = NOW() - INTERVAL '1 second' WHERE id = :id", { id: before });
      await expect(confirmedClaim('set', set, set.id, before, 'admin-1')).rejects.toThrow(/missing, expired or not this user's/);
      // Another user.
      await issue(before, 'admin-1', 10);
      await expect(confirmedClaim('set', set, set.id, before, 'admin-2')).rejects.toThrow(/missing, expired or not this user's/);
      // Consumed for an attempt that does not supersede it.
      const stray = await makeSet();
      const strayAttempt = await claim('set', stray, stray.id);
      await expect(run(`UPDATE scene_generation_attempts SET confirm_consumed_at = NOW(), confirm_consumed_by_attempt_id = :s, confirm_consumed_by_user_id = 'admin-1' WHERE id = :id`,
        { s: strayAttempt, id: before })).rejects.toThrow(/consumed only by the new attempt that supersedes it/);
      // Not issued at all (a fresh uncertain row).
      const bare = await makeSet();
      const bareAttempt = await makeUncertain('set', bare, bare.id);
      await expect(confirmedClaim('set', bare, bare.id, bareAttempt)).rejects.toThrow(/missing, expired/);
      expect(await target('set', set.id)).toMatchObject({ status: 'uncertain', current_attempt_id: before });
      expect((await attempt(before)).confirm_consumed_at).toBeNull();
    });

    test('a confirmation is issued only on an uncertain attempt', async () => {
      const set = await makeSet();
      const id = await claim('set', set, set.id);
      await expect(issue(id)).rejects.toThrow(/issued only for an uncertain attempt/);
    });

    test('two concurrent claims with one confirmation: exactly one succeeds', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set);
      const before = await makeUncertain('angle', angle, set.id);
      await issue(before, 'admin-1');
      const results = await Promise.allSettled([
        confirmedClaim('angle', angle, set.id, before, 'admin-1'),
        confirmedClaim('angle', angle, set.id, before, 'admin-1'),
        confirmedClaim('angle', angle, set.id, before, 'admin-1'),
      ]);
      const won = results.filter((r) => r.status === 'fulfilled');
      expect(won).toHaveLength(1);
      expect((await target('angle', angle.id)).current_attempt_id).toBe(won[0].value);
      const [{ n }] = await sequelize.query("SELECT count(*)::int AS n FROM scene_generation_attempts WHERE supersedes_attempt_id = :b",
        { replacements: { b: before }, type: sequelize.QueryTypes.SELECT });
      expect(n).toBe(1); // the losers' inserts rolled back with them
    });
  });

  describe('deletion', () => {
    test.each(['hard', 'soft'])('%s delete: an uncertain angle, its set, or an uncertain set is refused; ordinary rows still delete', async (how) => {
      const set = await makeSet();
      const angle = await makeAngle(set);
      const plain = await makeAngle(set);
      await makeUncertain('angle', angle, set.id);
      const del = (tbl, id) => (how === 'hard'
        ? run(`DELETE FROM ${tbl} WHERE id = :id`, { id })
        : run(`UPDATE ${tbl} SET deleted_at = NOW() WHERE id = :id`, { id }));
      await expect(del('scene_angles', angle.id)).rejects.toThrow(/cannot be deleted/);
      await expect(del('scene_sets', set.id)).rejects.toThrow(/has an angle with an uncertain outcome/);
      await del('scene_angles', plain.id); // ordinary behaviour unchanged
      const other = await makeSet();
      await makeUncertain('set', other, other.id);
      await expect(del('scene_sets', other.id)).rejects.toThrow(/cannot be deleted/);
      // Sequelize's paranoid destroy is a soft delete through the same guard.
      await expect(models.SceneAngle.destroy({ where: { id: angle.id } })).rejects.toThrow(GUARD);
      expect((await target('angle', angle.id)).deleted_at).toBeNull();
    });
  });

  describe('ordinary rows are untouched', () => {
    test('rows with no attempt keep every legacy transition', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set);
      for (const s of ['generating', 'failed', 'pending', 'generating', 'complete', 'failed']) {
        await run(`UPDATE scene_angles SET generation_status = :s WHERE id = :id`, { s, id: angle.id });
      }
      await run("UPDATE scene_sets SET generation_status = 'generating', updated_at = NOW() - INTERVAL '30 minutes' WHERE id = :id", { id: set.id });
      await run(`UPDATE scene_sets SET generation_status = 'generating', updated_at = NOW()
                  WHERE id = :id AND (generation_status IS DISTINCT FROM 'generating' OR updated_at < NOW() - make_interval(mins => 15))`, { id: set.id });
      await run("UPDATE scene_sets SET generation_status = 'complete', base_still_url = 'https://b/c.jpg' WHERE id = :id", { id: set.id });
      expect((await target('set', set.id)).status).toBe('complete');
    });
  });
});

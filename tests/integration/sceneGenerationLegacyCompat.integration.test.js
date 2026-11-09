/**
 * Scene Sets uncertain outcomes, PR A (#3748): the application as it is in
 * production today, run against the new schema. PR A ships no application
 * change, so this is the code a Deploy 1 (or a rollback of a later deploy)
 * runs beside the guards.
 *
 * Rows that are uncertain, or whose attempt is in flight and stale, are
 * seeded by SQL (the old application never writes them). Every generation
 * entry point, edit and delete is then driven through the real routes and
 * services: none may reach fal, and the rows are left as they were. Ordinary
 * rows (no attempt) behave exactly as before.
 *
 * axios is mocked and rejects: no provider is ever called. A call to
 * https://fal.run/ is counted, never sent.
 */
jest.unmock('uuid');

jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn(), create: jest.requireActual('axios').create }));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })) };
});

const request = require('supertest');
const axios = require('axios');
const crypto = require('crypto');
const { Op } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const generationClaim = require('../../src/services/generationClaimService');
const sceneGen = require('../../src/services/sceneGenerationService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}, opts = {}) => sequelize.query(sql, { replacements, ...opts });
const one = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT }))[0];
const falCalls = () => axios.post.mock.calls.filter((c) => String(c[0]).startsWith('https://fal.run/')).length
  + axios.get.mock.calls.filter((c) => String(c[0]).startsWith('https://fal.run/')).length;
// Refused by the database guard (500 through sendFail), not by some earlier check.
const byGuard = (res) => expect([res.status, res.body.error]).toEqual([500, expect.stringMatching(/^scene generation guard: /)]);
const settle = () => new Promise((r) => setTimeout(r, 300));

(shouldSkip ? describe.skip : describe)('the current application against the PR A schema', () => {
  let token;
  const saved = {};
  const setIds = [];
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const api = (method, path, body = {}) => auth(request(app)[method](`/api/v1/scene-sets${path}`)).send(body);

  beforeAll(async () => {
    // Columns the routes read that older test databases may lack (as in
    // sceneSetGenerationClaim.integration.test.js).
    await sequelize.query(`ALTER TABLE scene_sets
      ADD COLUMN IF NOT EXISTS style_reference_url text,
      ADD COLUMN IF NOT EXISTS negative_prompt text,
      ADD COLUMN IF NOT EXISTS variation_count integer DEFAULT 1,
      ADD COLUMN IF NOT EXISTS cover_angle_id uuid`);
    await sequelize.query(`ALTER TABLE scene_angles
      ADD COLUMN IF NOT EXISTS angle_description text,
      ADD COLUMN IF NOT EXISTS camera_direction text,
      ADD COLUMN IF NOT EXISTS quality_score integer,
      ADD COLUMN IF NOT EXISTS artifact_flags jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS quality_review jsonb,
      ADD COLUMN IF NOT EXISTS generation_attempt integer,
      ADD COLUMN IF NOT EXISTS refined_prompt text,
      ADD COLUMN IF NOT EXISTS camera_motion varchar(255),
      ADD COLUMN IF NOT EXISTS video_duration integer,
      ADD COLUMN IF NOT EXISTS style_reference_url text,
      ADD COLUMN IF NOT EXISTS variation_count integer,
      ADD COLUMN IF NOT EXISTS variation_data jsonb,
      ADD COLUMN IF NOT EXISTS post_processing_status text,
      ADD COLUMN IF NOT EXISTS enhanced_still_url text,
      ADD COLUMN IF NOT EXISTS enhanced_video_url text`);
    token = TokenService.generateTokenPair({
      id: 'test-user-legacy-compat', email: 'user@legacy-compat.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  beforeEach(() => {
    for (const k of ['FAL_KEY', 'ANTHROPIC_API_KEY', 'AI_DAILY_IMAGE_BUDGET_USD', 'AI_DAILY_BUDGET_USD']) saved[k] = process.env[k];
    process.env.FAL_KEY = 'test-fal';
    delete process.env.ANTHROPIC_API_KEY;
    process.env.AI_DAILY_IMAGE_BUDGET_USD = '100000';
    process.env.AI_DAILY_BUDGET_USD = '100000';
    axios.post.mockReset().mockRejectedValue(new Error('provider unavailable in this test'));
    axios.get.mockReset().mockRejectedValue(new Error('no downloads in this test'));
    for (const m of ['log', 'warn', 'error']) jest.spyOn(console, m).mockImplementation(() => {});
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    // Let background runs on ordinary rows (failing at the mocked provider) finish.
    for (let i = 0; i < 50 && setIds.length; i += 1) {
      const row = await one(`SELECT COUNT(*)::int AS n FROM scene_angles WHERE scene_set_id IN (:ids) AND generation_status = 'generating'
                               AND current_attempt_id IS NULL AND updated_at > NOW() - INTERVAL '10 minutes'`, { ids: setIds });
      if (row.n === 0) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!setIds.length) return;
    // The guards forbid deleting this evidence, which is the point; the test
    // database lets the cleanup skip triggers for its own rows.
    await sequelize.transaction(async (transaction) => {
      const opts = { transaction };
      await run('SET LOCAL session_replication_role = replica', {}, opts);
      await run('DELETE FROM generation_jobs WHERE scene_set_id IN (:ids)', { ids: setIds }, opts).catch(() => {});
      await run('DELETE FROM scene_generation_attempts WHERE scene_set_id IN (:ids)', { ids: setIds }, opts);
      await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: setIds }, opts);
      await run('DELETE FROM scene_sets WHERE id IN (:ids)', { ids: setIds }, opts);
    });
  });

  async function makeSet(fields = {}) {
    const set = await models.SceneSet.create({ name: `Compat ${uuid().slice(0, 8)}`, scene_type: 'HOME_BASE', ...fields });
    setIds.push(set.id);
    return set;
  }
  const makeAngle = (set, fields = {}) => models.SceneAngle.create({
    scene_set_id: set.id, angle_label: `A${uuid().slice(0, 4)}`, angle_name: 'Angle', ...fields,
  });
  const table = (kind) => (kind === 'set' ? 'scene_sets' : 'scene_angles');
  const snapshot = (kind, id) => one(`SELECT generation_status::text AS status, current_attempt_id, deleted_at,
      ${kind === 'set' ? 'base_still_url' : 'still_image_url'} AS image FROM ${table(kind)} WHERE id = :id`, { id });

  /** The state PR B will write, seeded by hand: an attempt dispatched, then (optionally) uncertain. */
  async function seedAttempt(kind, row, setId, { uncertain = true, staleMinutes = 0 } = {}) {
    const id = uuid();
    await run(`INSERT INTO scene_generation_attempts (id, target_kind, target_id, scene_set_id, provider, model, route, created_by)
               VALUES (:id, :kind, :tid, :sid, 'fal', 'fal-ai/flux/dev', 'seed', 'seed')`, { id, kind, tid: row.id, sid: setId });
    await run(`UPDATE ${table(kind)} SET generation_status = 'generating', current_attempt_id = :id, updated_at = NOW() WHERE id = :tid`, { id, tid: row.id });
    await run("UPDATE scene_generation_attempts SET state = 'dispatch_started', dispatch_started_at = NOW() WHERE id = :id", { id });
    if (uncertain) {
      await run(`UPDATE scene_generation_attempts SET state = 'uncertain', finished_at = NOW(), error_code = 'PROVIDER_OUTCOME_UNKNOWN',
                   message = 'timeout', estimate_usd = 0.025 WHERE id = :id`, { id });
      await run(`UPDATE ${table(kind)} SET generation_status = 'uncertain' WHERE id = :tid`, { tid: row.id });
    }
    if (staleMinutes) {
      await run(`UPDATE ${table(kind)} SET updated_at = NOW() - make_interval(mins => :m) WHERE id = :tid`, { m: staleMinutes, tid: row.id });
    }
    return id;
  }

  /** An uncertain angle on a set with a base, and an uncertain set; plus a stale in-flight angle. */
  async function seedAll() {
    const set = await makeSet({ base_still_url: 'https://bucket.example/base.jpg' });
    const uAngle = await makeAngle(set, { generation_status: 'pending' });
    const uAngleAttempt = await seedAttempt('angle', uAngle, set.id);
    const stale = await makeAngle(set, { generation_status: 'pending' });
    const staleAttempt = await seedAttempt('angle', stale, set.id, { uncertain: false, staleMinutes: 20 });
    const uSet = await makeSet({ base_still_url: 'https://bucket.example/old-base.jpg', base_runway_seed: 'seed-1' });
    const uSetAttempt = await seedAttempt('set', uSet, uSet.id);
    return { set, uAngle, uAngleAttempt, stale, staleAttempt, uSet, uSetAttempt };
  }

  async function expectUnchanged(s) {
    expect(await snapshot('angle', s.uAngle.id)).toMatchObject({ status: 'uncertain', current_attempt_id: s.uAngleAttempt, deleted_at: null });
    expect(await snapshot('angle', s.stale.id)).toMatchObject({ status: 'generating', current_attempt_id: s.staleAttempt, deleted_at: null });
    expect(await snapshot('set', s.uSet.id)).toMatchObject({ status: 'uncertain', current_attempt_id: s.uSetAttempt, deleted_at: null });
    const states = await sequelize.query('SELECT id, state FROM scene_generation_attempts WHERE id IN (:ids)',
      { replacements: { ids: [s.uAngleAttempt, s.staleAttempt, s.uSetAttempt] }, type: sequelize.QueryTypes.SELECT });
    expect(Object.fromEntries(states.map((r) => [r.id, r.state]))).toEqual({
      [s.uAngleAttempt]: 'uncertain', [s.staleAttempt]: 'dispatch_started', [s.uSetAttempt]: 'uncertain',
    });
    const [[{ n }]] = await sequelize.query('SELECT COUNT(*)::int AS n FROM scene_generation_attempts WHERE scene_set_id IN (:ids)',
      { replacements: { ids: [s.set.id, s.uSet.id] } });
    expect(n).toBe(3);
  }

  describe('uncertain and stale in-flight rows: no route starts a paid request', () => {
    test('angle Generate: refused before the provider (uncertain and stale in flight)', async () => {
      const s = await seedAll();
      for (const a of [s.uAngle, s.stale]) {
        byGuard(await api('post', `/${s.set.id}/angles/${a.id}/generate`));
      }
      await settle();
      expect(falCalls()).toBe(0);
      await expectUnchanged(s);
    });

    test('angle Refine (regenerate): refused before the provider', async () => {
      const s = await seedAll();
      for (const a of [s.uAngle, s.stale]) {
        // SOFT_FOCUS has a known fix, so the route reaches its claim.
        byGuard(await api('post', `/${s.set.id}/angles/${a.id}/regenerate`, { categories: ['SOFT_FOCUS'] }));
      }
      await settle();
      expect(falCalls()).toBe(0);
      await expectUnchanged(s);
    });

    test('Generate All, with and without angle_ids: uncertain and in-flight angles are never queued', async () => {
      const s = await seedAll();
      const named = await api('post', `/${s.set.id}/generate-all-angles`, { angle_ids: [s.uAngle.id, s.stale.id] });
      expect(named.status).toBe(200);
      expect(named.body.angle_ids).toEqual([]);
      const all = await api('post', `/${s.set.id}/generate-all-angles`);
      expect(all.body.angle_ids).toEqual([]);
      await settle();
      expect(falCalls()).toBe(0);
      await expectUnchanged(s);
    });

    test('base Generate (with and without force) and Regenerate All on an uncertain set: refused, nothing queued', async () => {
      const s = await seedAll();
      const plain = await api('post', `/${s.uSet.id}/generate-base`);
      expect(plain.status).toBe(409); // base_runway_seed set: the existing "already generated" answer
      byGuard(await api('post', `/${s.uSet.id}/generate-base`, { force: true }));
      byGuard(await api('post', `/${s.uSet.id}/cascade-regenerate`));
      const [[{ jobs }]] = await sequelize.query("SELECT COUNT(*)::int AS jobs FROM generation_jobs WHERE scene_set_id = :id", { replacements: { id: s.uSet.id } });
      expect(jobs).toBe(0);
      await settle();
      expect(falCalls()).toBe(0);
      await expectUnchanged(s);
    });

    test('generateBaseScene (venue, venue-look and model-comparison paths) on an uncertain set: refused before fal', async () => {
      const s = await seedAll();
      const set = await models.SceneSet.findByPk(s.uSet.id);
      await expect(sceneGen.generateBaseScene(set, models, {})).rejects.toThrow(/scene generation guard/);
      expect(falCalls()).toBe(0);
      await expectUnchanged(s);
    });

    test('claimRow (every claim in the application) is refused for both; it never reports a claim', async () => {
      const s = await seedAll();
      await expect(generationClaim.claimRow(sequelize, 'angle', s.uAngle.id)).rejects.toThrow(/scene generation guard/);
      await expect(generationClaim.claimRow(sequelize, 'angle', s.stale.id)).rejects.toThrow(/scene generation guard/);
      await expect(generationClaim.claimRow(sequelize, 'set', s.uSet.id)).rejects.toThrow(/scene generation guard/);
      await expectUnchanged(s);
    });

    test('an edit resetting the angle to pending or failed is refused', async () => {
      const s = await seedAll();
      for (const a of [s.uAngle, s.stale]) {
        for (const st of ['pending', 'failed']) {
          byGuard(await api('patch', `/${s.set.id}/angles/${a.id}`, { generation_status: st }));
        }
      }
      await expectUnchanged(s);
    });

    test('deleting the angle, all angles, or either set is refused; the record stays', async () => {
      const s = await seedAll();
      byGuard(await api('delete', `/${s.set.id}/angles/${s.uAngle.id}`));
      byGuard(await api('delete', `/${s.set.id}/angles/${s.stale.id}`));
      byGuard(await api('delete', `/${s.set.id}/angles`));
      byGuard(await auth(request(app).delete(`/api/v1/scene-sets/${s.set.id}?confirm_orphan=true`)));
      byGuard(await auth(request(app).delete(`/api/v1/scene-sets/${s.uSet.id}?confirm_orphan=true`)));
      await expectUnchanged(s);
    });

    test('the clean-up of failed angles (analyze-image, apply-template) leaves uncertain angles alone', async () => {
      const s = await seedAll();
      const failed = await makeAngle(s.set, { generation_status: 'failed' });
      // The where-clause those routes use.
      await models.SceneAngle.destroy({ where: { scene_set_id: s.set.id, still_image_url: null, generation_status: { [Op.in]: ['pending', 'failed'] } } });
      expect((await snapshot('angle', failed.id)).deleted_at).not.toBeNull();
      await expectUnchanged(s);
    });
  });

  describe('ordinary rows (no attempt): unchanged', () => {
    test('angle Generate: 202, one fal request, and a provider failure is recorded as failed (as today)', async () => {
      const set = await makeSet({ base_still_url: 'https://bucket.example/base.jpg' });
      const angle = await makeAngle(set, { generation_status: 'pending' });
      const res = await api('post', `/${set.id}/angles/${angle.id}/generate`);
      expect(res.status).toBe(202);
      let st = 'generating';
      for (let i = 0; i < 50 && st === 'generating'; i += 1) {
        await new Promise((r) => setTimeout(r, 100));
        st = (await snapshot('angle', angle.id)).status;
      }
      expect(st).toBe('failed');
      expect(falCalls()).toBe(1);
      expect((await snapshot('angle', angle.id)).current_attempt_id).toBeNull();
      const [[{ n }]] = await sequelize.query('SELECT COUNT(*)::int AS n FROM scene_generation_attempts WHERE scene_set_id = :id', { replacements: { id: set.id } });
      expect(n).toBe(0);
    });

    test('a failed angle is retried by Generate All with angle_ids, as before', async () => {
      const set = await makeSet({ base_still_url: 'https://bucket.example/base.jpg' });
      const angle = await makeAngle(set, { generation_status: 'failed' });
      const res = await api('post', `/${set.id}/generate-all-angles`, { angle_ids: [angle.id] });
      expect(res.body.angle_ids).toEqual([angle.id]);
    });

    test('claims, the stale reclaim, edits and deletes work as before', async () => {
      const set = await makeSet();
      const angle = await makeAngle(set, { generation_status: 'pending' });
      expect(await generationClaim.claimRow(sequelize, 'angle', angle.id)).toBe(true);
      expect(await generationClaim.claimRow(sequelize, 'angle', angle.id)).toBe(false);
      await run("UPDATE scene_angles SET updated_at = NOW() - INTERVAL '20 minutes' WHERE id = :id", { id: angle.id });
      expect(await generationClaim.claimRow(sequelize, 'angle', angle.id)).toBe(true);
      await run("UPDATE scene_angles SET generation_status = 'failed' WHERE id = :id", { id: angle.id });
      expect((await api('patch', `/${set.id}/angles/${angle.id}`, { generation_status: 'pending' })).status).toBe(200);
      expect((await api('delete', `/${set.id}/angles/${angle.id}`)).status).toBe(200);
      expect((await auth(request(app).delete(`/api/v1/scene-sets/${set.id}?confirm_orphan=true`))).status).toBe(200);
    });
  });
});

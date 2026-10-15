/**
 * The Scene Sets page's angle actions, through the real routes on the
 * migrated database (audit of the page, 2026-10-15):
 *   - Reorder: PATCH /:id/angles/reorder reached the /:id/angles/:angleId
 *     route ("reorder" taken as an angle id) and always failed.
 *   - Generate All: the route took only pending angles, at most
 *     IMAGE_CALLS_PER_OPERATION of them, and did not say which, so the page
 *     waited ten minutes on the rest; failed angles were never retried.
 *     angle_ids names the angles asked for (pending or failed); the reply
 *     names the ones queued and how many are left.
 *   - Video: a second click while the angle's video job is queued gets
 *     that job back instead of a second paid one.
 * The image generation itself is mocked.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const sceneGen = require('../../src/services/sceneGenerationService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Scene Sets angle actions', () => {
  const setId = uuid();
  const ids = Array.from({ length: 5 }, () => uuid());
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const statusOf = async (id) => (await models.SceneAngle.findByPk(id)).generation_status;

  beforeAll(async () => {
    process.env.IMAGE_CALLS_PER_OPERATION = '3';
    token = TokenService.generateTokenPair({
      id: 'test-user-angle-actions', email: 'user@angleactions.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO scene_sets (id, name, scene_type, generation_status, base_still_url, created_at, updated_at)
      VALUES (:id, 'Angle actions set', 'HOME_BASE', 'complete', 'https://img.example/base.png', NOW(), NOW())`, { id: setId });
    // 0, 1, 2 failed; 3, 4 pending.
    for (let i = 0; i < ids.length; i++) {
      await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, generation_status, beat_affinity, sort_order, created_at, updated_at)
        VALUES (:id, :set, :name, 'WIDE', :status, '[]', :order, NOW(), NOW())`,
      { id: ids[i], set: setId, name: `Angle ${i}`, status: i < 3 ? 'failed' : 'pending', order: i });
    }
  });
  beforeEach(() => {
    // The background loop's image calls: none are made.
    jest.spyOn(sceneGen, 'generateAngle').mockImplementation(async () => new Promise(() => {}));
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    delete process.env.IMAGE_CALLS_PER_OPERATION;
    await run('DELETE FROM scene_angles WHERE scene_set_id = :id', { id: setId });
    await run('DELETE FROM scene_sets WHERE id = :id', { id: setId });
  });

  test('reorder reaches the reorder route and saves the new order', async () => {
    const order = [...ids].reverse().map((id, i) => ({ id, sort_order: i }));
    const res = await auth(request(app).patch(`/api/v1/scene-sets/${setId}/angles/reorder`)).send({ order });
    expect(res.status).toBe(200);
    expect(res.body.data.map((a) => a.id)).toEqual([...ids].reverse());
    // Back to the original order for the tests below.
    await auth(request(app).patch(`/api/v1/scene-sets/${setId}/angles/reorder`)).send({ order: ids.map((id, i) => ({ id, sort_order: i })) });
  });

  test('Generate All with angle_ids queues failed angles too, names them, and says how many are left', async () => {
    const res = await auth(request(app).post(`/api/v1/scene-sets/${setId}/generate-all-angles`)).send({ angle_ids: ids });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, queued: 3, angle_ids: ids.slice(0, 3), remaining: 2 });
    // The failed angles it queued are pending again; the ones left are untouched.
    for (const id of ids.slice(0, 3)) expect(await statusOf(id)).toBe('pending');
  });

  test('without angle_ids, only pending angles, as before', async () => {
    await run(`UPDATE scene_angles SET generation_status = 'failed' WHERE id = :id`, { id: ids[0] });
    const res = await auth(request(app).post(`/api/v1/scene-sets/${setId}/generate-all-angles`)).send({});
    expect(res.status).toBe(200);
    expect(res.body.angle_ids).toEqual([ids[1], ids[2], ids[3]]);
    expect(res.body.remaining).toBe(1);
    expect(await statusOf(ids[0])).toBe('failed');
  });

  test('a second Video click while the first job is queued gets that job, not another paid one', async () => {
    const url = `/api/v1/scene-sets/${setId}/angles/${ids[4]}/generate-video`;
    const first = await auth(request(app).post(url)).send({});
    expect(first.status).toBe(202);
    const second = await auth(request(app).post(url)).send({});
    expect(second.status).toBe(202);
    expect(second.body.data).toMatchObject({ jobId: first.body.data.jobId, existing: true });
    const [[{ n }]] = await run(`SELECT COUNT(*)::int AS n FROM generation_jobs WHERE scene_angle_id = :id AND job_type = 'generate_angle_video'`, { id: ids[4] });
    expect(n).toBe(1);
    await run('DELETE FROM generation_jobs WHERE scene_angle_id = :id', { id: ids[4] });
  });

  test('angle_ids that are not ids are refused', async () => {
    const res = await auth(request(app).post(`/api/v1/scene-sets/${setId}/generate-all-angles`)).send({ angle_ids: ['reorder'] });
    expect(res.status).toBe(400);
  });
});

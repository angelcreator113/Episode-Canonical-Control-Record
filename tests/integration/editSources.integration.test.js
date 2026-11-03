/**
 * Prepare From Existing Work, B1 (Evoni, 2026-11-03): GET /edit/sources says,
 * per scene-plan row, which angle the beat uses and whether the editor can
 * place it, in the plan's order. It writes nothing.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { existingWork } = require('../../src/services/editSourcesService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Existing work for the editor (B1, Postgres)', () => {
  const show = uuid();
  const ep = uuid();
  const linkedSet = uuid();
  const otherSet = uuid();
  let token;
  let flag;

  beforeAll(async () => {
    flag = process.env.EPISODE_EDIT;
    process.env.EPISODE_EDIT = 'on';
    token = TokenService.generateTokenPair({ id: 'test-b1-user', email: 'u@b1.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())', { id: show, n: `b1-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
      VALUES (:ep, :show, 'B1', 9101, 'draft', NOW(), NOW())`, { ep, show });
    for (const [id, name] of [[linkedSet, 'Closet'], [otherSet, 'Cafe']]) {
      await run(`INSERT INTO scene_sets (id, name, scene_type, created_at, updated_at) VALUES (:id, :name, 'OTHER', NOW(), NOW())`, { id, name });
    }
    await run('INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, sort_order, created_at, updated_at) VALUES (:x, :s, :ep, 0, NOW(), NOW())', { x: uuid(), s: linkedSet, ep });
    const angle = (setId, label, { still = null, video = null, status = 'complete' } = {}) => run(`INSERT INTO scene_angles
      (id, scene_set_id, angle_name, angle_label, still_image_url, video_clip_url, generation_status, sort_order, created_at, updated_at)
      VALUES (:id, :setId, :label, :label, :still, :video, CAST(:status AS enum_scene_angles_generation_status), 0, NOW(), NOW())`,
    { id: uuid(), setId, label, still, video, status });
    await angle(linkedSet, 'WIDE', { still: 'https://cdn.example/wide.png', video: 'https://cdn.example/wide.mp4' });
    await angle(linkedSet, 'CLOSE', { status: 'pending' });
    await angle(otherSet, 'WIDE', { still: 'https://cdn.example/cafe.png' });
    const plan = (beat, setId, label, sort, chosen = false) => run(`INSERT INTO scene_plans
      (id, episode_id, beat_number, scene_set_id, angle_label, sort_order, chosen_by_user, locked, ai_suggested, created_at, updated_at)
      VALUES (:id, :ep, :beat, :setId, :label, :sort, :chosen, false, false, NOW(), NOW())`,
    { id: uuid(), ep, beat, setId, label, sort, chosen });
    await plan(5, linkedSet, 'WIDE', 0);
    await plan(1, linkedSet, 'CLOSE', 0, true);
    await plan(2, otherSet, 'WIDE', 0, true);
    await plan(3, null, null, 0);
    await plan(4, linkedSet, 'TOP', 0);
  });

  afterAll(async () => {
    if (flag === undefined) delete process.env.EPISODE_EDIT; else process.env.EPISODE_EDIT = flag;
    await run('DELETE FROM scene_plans WHERE episode_id = :ep', { ep });
    await run('DELETE FROM scene_set_episodes WHERE episode_id = :ep', { ep });
    await run('DELETE FROM scene_angles WHERE scene_set_id IN (:s)', { s: [linkedSet, otherSet] });
    await run('DELETE FROM scene_sets WHERE id IN (:s)', { s: [linkedSet, otherSet] });
    await run('DELETE FROM episodes WHERE id = :ep', { ep });
    await run('DELETE FROM shows WHERE id = :show', { show });
    await sequelize.close();
  });

  test("each beat's planned angle and whether the editor can place it, in beat order (one plan row per beat)", async () => {
    const { plan, summary } = await existingWork(sequelize, { episodeId: ep });
    expect(plan.map((p) => [p.beat_number, p.scene_set?.name || null, p.angle_label, p.status])).toEqual([
      [1, 'Closet', 'CLOSE', 'missing'],
      [2, 'Cafe', 'WIDE', 'not_linked'],
      [3, null, null, 'no_set'],
      [4, 'Closet', 'TOP', 'missing'],
      [5, 'Closet', 'WIDE', 'ready'],
    ]);
    expect(plan[0]).toMatchObject({ chosen_by_user: true, linked: true, place: null, text: expect.stringMatching(/no image/i) });
    expect(plan[4]).toMatchObject({ linked: true, place: { still: true, video: true }, angle: { label: 'WIDE', still_image_url: 'https://cdn.example/wide.png' } });
    expect(plan[1]).toMatchObject({ chosen_by_user: true, linked: false, place: null, text: expect.stringMatching(/isn't linked/) });
    expect(plan[3].text).toMatch(/missing/i);
    expect(summary).toEqual({ plan_rows: 5, beats_planned: 5, ready: 1, not_linked: 1, missing: 2, no_set: 1, set_removed: 0, set_picture: 0 });
  });

  test('it writes nothing: every statement it sends is a read', async () => {
    const sent = [];
    const watching = { query: (sql, opts) => { sent.push(String(sql)); return sequelize.query(sql, opts); } };
    await existingWork(watching, { episodeId: ep });
    expect(sent.length).toBeGreaterThan(0);
    for (const sql of sent) expect(sql).toMatch(/^\s*SELECT\b/i);
  });

  test('GET /edit/sources answers any signed-in user; an unknown episode is 404', async () => {
    const res = await request(app).get(`/api/v1/episodes/${ep}/edit/sources`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary.ready).toBe(1);
    const none = await request(app).get(`/api/v1/episodes/${uuid()}/edit/sources`).set('Authorization', `Bearer ${token}`);
    expect(none.status).toBe(404);
    const anon = await request(app).get(`/api/v1/episodes/${ep}/edit/sources`);
    expect(anon.status).toBe(401);
  });
});

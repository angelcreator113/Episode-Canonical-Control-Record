/**
 * A Feed profile's posting schedule (Evoni, 2026-10-18; services/
 * postingSchedule, migration 20261018160000), against the test database:
 *   - GET shows the saved schedule (null) and a suggestion; PUT saves one
 *     (ADMIN only, refused when invalid); null clears it
 *   - Review's suggested release time lands on their schedule and says so
 *   - the ambient planner leaves out a poster off their day or over their week
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { suggestReleaseTime } = require('../../src/services/postRelease');
const { offScheduleProfiles } = require('../../src/services/pulseAmbient');
const ps = require('../../src/services/postingSchedule');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const uuid = () => crypto.randomUUID();
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

(shouldSkip ? describe.skip : describe)('posting schedules', () => {
  const tag = uuid().slice(0, 8);
  const showId = uuid();
  let profileId;
  let admin;
  let user;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-sched', email: 'evoni@sched.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-sched', email: 'user@sched.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())', { id: showId, name: `Sched ${tag}`, slug: `sched-${tag}` });
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, society_archetype, created_at, updated_at)
      VALUES (:handle, 'pulse', 'test', 'Maren', 'lalaverse', 'The Slow Living Creator', NOW(), NOW()) RETURNING id`, { handle: `sched${tag}` });
    profileId = row.id;
  });

  afterAll(async () => {
    await run('DELETE FROM feed_posts WHERE show_id = :showId', { showId });
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid: profileId });
    await run('DELETE FROM shows WHERE id = :showId', { showId });
    await sequelize.close();
  });

  it('GET: no schedule yet, and a suggestion from who they are', async () => {
    const res = await request(app).get(`/api/v1/social-profiles/${profileId}/posting-schedule`).set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body.schedule).toBeNull();
    expect(res.body.suggestion.schedule.windows).toEqual([{ start: '07:00', end: '09:30' }]);
    expect(res.body.suggestion.why).toMatch(/morning/);
  });

  it('PUT saves a valid schedule (ADMIN only) and refuses a bad one', async () => {
    const body = { schedule: { days: ['tue', 'thu'], windows: [{ start: '07:00', end: '09:00' }], per_week: 2, tz_offset: 0 } };
    expect((await request(app).put(`/api/v1/social-profiles/${profileId}/posting-schedule`).set('Authorization', `Bearer ${user}`).send(body)).status).toBe(403);
    const bad = await request(app).put(`/api/v1/social-profiles/${profileId}/posting-schedule`).set('Authorization', `Bearer ${admin}`)
      .send({ schedule: { ...body.schedule, per_week: 0 } });
    expect(bad.status).toBe(400);
    const ok = await request(app).put(`/api/v1/social-profiles/${profileId}/posting-schedule`).set('Authorization', `Bearer ${admin}`).send(body);
    expect(ok.status).toBe(200);
    expect(ok.body.schedule).toMatchObject({ days: ['tue', 'thu'], per_week: 2, source: 'set' });
    const sug = await request(app).post(`/api/v1/social-profiles/${profileId}/posting-schedule/suggest`).set('Authorization', `Bearer ${admin}`);
    expect(sug.body.schedule.source).toBe('suggested');
  });

  it('Review suggests a release time on their schedule, and says so', async () => {
    const post = await models.FeedPost.create({
      show_id: showId, social_profile_id: profileId, poster_handle: `sched${tag}`, poster_display_name: 'Maren', poster_platform: 'lalaverse', post_type: 'post',
      content_text: 'the bread is rising.', status: 'draft', likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0,
    });
    const s = await suggestReleaseTime(models, post, { tzOffset: 0 });
    const at = new Date(s.at);
    expect(['tue', 'thu']).toContain(DAYS[at.getUTCDay()]);
    expect(at.getUTCHours() * 60 + at.getUTCMinutes()).toBeGreaterThanOrEqual(7 * 60);
    expect(at.getUTCHours() * 60 + at.getUTCMinutes()).toBeLessThan(9 * 60);
    expect(s.why).toMatch(/on their schedule \(Tue\/Thu mornings\)/);
  });

  it('the ambient planner leaves them out on another day or once their week is full', async () => {
    const today = DAYS[new Date().getUTCDay()];
    const other = DAYS[(new Date().getUTCDay() + 3) % 7];
    const set = (schedule) => run('UPDATE social_profiles SET posting_schedule = CAST(:s AS jsonb) WHERE id = :pid', { s: JSON.stringify(schedule), pid: profileId });
    const check = async () => offScheduleProfiles(models, showId, [{ id: profileId }], new Date());

    await set(ps.normalize({ days: [other], windows: [{ start: '07:00', end: '09:00' }], per_week: 3, tz_offset: 0 }));
    expect((await check()).has(Number(profileId))).toBe(true);

    await set(ps.normalize({ days: [today], windows: [{ start: '07:00', end: '09:00' }], per_week: 3, tz_offset: 0 }));
    await run('DELETE FROM feed_posts WHERE show_id = :showId', { showId });
    expect((await check()).has(Number(profileId))).toBe(false);

    await set(ps.normalize({ days: [today], windows: [{ start: '07:00', end: '09:00' }], per_week: 1, tz_offset: 0 }));
    await models.FeedPost.create({ show_id: showId, social_profile_id: profileId, poster_handle: `sched${tag}`, poster_display_name: 'Maren', poster_platform: 'lalaverse', post_type: 'post', content_text: 'one.', status: 'live', likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0 });
    expect((await check()).has(Number(profileId))).toBe(true);

    await run('UPDATE social_profiles SET posting_schedule = NULL WHERE id = :pid', { pid: profileId });
    expect((await check()).has(Number(profileId))).toBe(false);
  });
});

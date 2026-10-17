/**
 * Release times keep the story in order (Evoni, 2026-10-17: "Yes I want
 * them all"; services/postRelease guardsFor):
 * - a load-bearing post goes out before its episode airs;
 * - a post that happens during or after its episode waits until it airs;
 * - a reply goes out after the post it answers;
 * - a post with a reveal waits for it;
 * a time that breaks one is a 409 with what it breaks, until "anyway".
 * Schedule all: every draft with no release time, at its suggested time, in
 * story order (a reply after its post); applied as she adjusted it.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

(shouldSkip ? describe.skip : describe)('release times keep the story in order', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const show = crypto.randomUUID();
  const planShow = crypto.randomUUID();
  let admin;
  let editor;
  // Episode 3 airs ten days from now (a date with no time: midnight UTC).
  const air = new Date(Date.now() + 10 * DAY);
  air.setUTCHours(0, 0, 0, 0);
  const draft = (extra = {}) => models.FeedPost.create({
    show_id: show, poster_handle: `grd${TAG}`, poster_display_name: 'Grd', poster_platform: 'lalaverse', post_type: 'post',
    content_text: 'soon.', status: 'draft', story_order: 32, likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0, ...extra,
  });
  const schedule = (id, at, extra = {}) => request(app).put(`/api/v1/feed-posts/${id}/release-time`).set('Authorization', `Bearer ${admin}`)
    .send({ mode: 'schedule', at: at.toISOString(), tz_offset: 0, ...extra });

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-guards', email: 'evoni@guards.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-guards', email: 'e@guards.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    for (const [id, name] of [[show, 'Guards'], [planShow, 'Plan']]) {
      await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())', { id, name: `${name} ${TAG}`, slug: `${name.toLowerCase()}-${TAG}` });
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, air_date, created_at, updated_at)
                 VALUES (:eid, :id, 'Three', 3, 'draft', :air, NOW(), NOW())`, { eid: crypto.randomUUID(), id, air });
    }
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_reveals WHERE show_id IN (:shows)', { shows: [show, planShow] });
    await run('DELETE FROM feed_posts WHERE show_id IN (:shows)', { shows: [show, planShow] });
    await run('DELETE FROM episodes WHERE show_id IN (:shows)', { shows: [show, planShow] });
    await run('DELETE FROM shows WHERE id IN (:shows)', { shows: [show, planShow] });
    await sequelize.close();
  });

  it('a load-bearing post goes out before its episode airs; "anyway" schedules it regardless', async () => {
    const p = await draft({ post_weight: 'load_bearing' });
    const late = await schedule(p.id, new Date(air.getTime() + 12 * HOUR));
    expect(late.status).toBe(409);
    expect(late.body.problems).toEqual([expect.stringMatching(/^Too late: it is load-bearing, so it goes out before Episode 3 airs/)]);
    await p.reload();
    expect(p.release_state).toBeNull();
    expect((await schedule(p.id, new Date(air.getTime() + 12 * HOUR), { anyway: true })).status).toBe(200);
    expect((await schedule(p.id, new Date(air.getTime() - DAY))).status).toBe(200);
  });

  it('a post during or after its episode waits until it airs', async () => {
    const p = await draft({ story_order: 37 });
    const early = await schedule(p.id, new Date(air.getTime() - DAY));
    expect(early.status).toBe(409);
    expect(early.body.problems[0]).toMatch(/^Too early: it happens After Ep 3, so it waits until Episode 3 airs/);
    expect((await schedule(p.id, new Date(air.getTime() + 21 * HOUR))).status).toBe(200);
  });

  it('a reply goes out after the post it answers; before that one is scheduled, it says so', async () => {
    const parent = await draft({ poster_handle: `kai${TAG}` });
    const reply = await draft({ parent_post_id: parent.id });
    const open = await schedule(reply.id, new Date(Date.now() + 2 * DAY));
    expect(open.status).toBe(409);
    expect(open.body.problems).toEqual([`Check the order: it answers @kai${TAG}'s post, which is not scheduled yet: schedule that one first.`]);
    const parentAt = new Date(Date.now() + 3 * DAY);
    expect((await schedule(parent.id, parentAt)).status).toBe(200);
    const before = await schedule(reply.id, new Date(parentAt.getTime() - HOUR));
    expect(before.status).toBe(409);
    expect(before.body.problems[0]).toMatch(/^Too early: it answers @kai/);
    expect((await schedule(reply.id, new Date(parentAt.getTime() + HOUR))).status).toBe(200);
  });

  it('a post with a reveal waits for it; the suggestion keeps to it', async () => {
    const p = await draft({ story_order: 31 });
    await models.PulseReveal.create({ show_id: show, item_type: 'post', item_id: String(p.id), moment: 'story_time', story_order: 35, mode: 'hidden' });
    const early = await schedule(p.id, new Date(air.getTime() - 2 * DAY));
    expect(early.status).toBe(409);
    expect(early.body.problems[0]).toMatch(/^Too early: it is revealed During Ep 3/);
    const suggested = await request(app).get(`/api/v1/feed-posts/${p.id}/release-time/suggest?tz_offset=0`).set('Authorization', `Bearer ${editor}`);
    expect(suggested.status).toBe(200);
    expect(new Date(suggested.body.at).getTime()).toBeGreaterThanOrEqual(air.getTime());
    expect(suggested.body.why).toMatch(/moved to keep the story in order$/);
    expect(suggested.body.problems).toEqual([]);
  });

  it('schedule all: plans every unscheduled draft in story order, a reply after its post, and applies her plan', async () => {
    const mk = (extra) => models.FeedPost.create({
      show_id: planShow, poster_handle: `pl${TAG}`, poster_display_name: 'Pl', poster_platform: 'lalaverse', post_type: 'post',
      content_text: 'plan.', status: 'draft', likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0, ...extra,
    });
    const after = await mk({ story_order: 37 });
    const parent = await mk({ story_order: 32 });
    const reply = await mk({ story_order: 32, parent_post_id: parent.id });
    await mk({ story_order: 31, release_state: 'held' });

    const plan = await request(app).get(`/api/v1/feed-posts/release-plan?show_id=${planShow}&tz_offset=0`).set('Authorization', `Bearer ${editor}`);
    expect(plan.status).toBe(200);
    expect(plan.body.items.map((i) => i.post_id)).toEqual([parent.id, reply.id, after.id]);
    const byId = Object.fromEntries(plan.body.items.map((i) => [i.post_id, i]));
    expect(new Date(byId[reply.id].at).getTime()).toBeGreaterThan(new Date(byId[parent.id].at).getTime());
    expect(new Date(byId[after.id].at).getTime()).toBeGreaterThanOrEqual(air.getTime());
    expect(plan.body.items.every((i) => i.problems.length === 0)).toBe(true);
    expect(byId[parent.id]).toMatchObject({ story: 'Announced Ep 3', handle: `pl${TAG}` });

    const items = plan.body.items.map((i) => ({ post_id: i.post_id, at: i.at }));
    // She moves the reply before its post: that one waits for "anyway".
    items[1].at = new Date(new Date(items[0].at).getTime() - HOUR).toISOString();
    expect((await request(app).post('/api/v1/feed-posts/release-plan').set('Authorization', `Bearer ${editor}`).send({ items })).status).toBe(403);
    const applied = await request(app).post('/api/v1/feed-posts/release-plan').set('Authorization', `Bearer ${admin}`).send({ items, tz_offset: 0 });
    expect(applied.status).toBe(200);
    expect(applied.body.scheduled.sort()).toEqual([parent.id, after.id].sort());
    expect(applied.body.skipped).toEqual([{ post_id: reply.id, problems: [expect.stringMatching(/^Too early: it answers @pl/)] }]);
    const anyway = await request(app).post('/api/v1/feed-posts/release-plan').set('Authorization', `Bearer ${admin}`).send({ items: [items[1]], anyway: true });
    expect(anyway.body.scheduled).toEqual([reply.id]);

    const again = await request(app).get(`/api/v1/feed-posts/release-plan?show_id=${planShow}&tz_offset=0`).set('Authorization', `Bearer ${editor}`);
    expect(again.body.items).toEqual([]);
    expect((await request(app).get('/api/v1/feed-posts/release-plan').set('Authorization', `Bearer ${editor}`)).status).toBe(400);
  });
});

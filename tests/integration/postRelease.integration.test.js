/**
 * Release time, the second clock (Character Consistency Engine step 6c;
 * Evoni, 2026-10-16: "yes publish/schedule/hold"):
 * - a draft can be scheduled (a future time), held or cleared; admin only;
 *   a live post has no release time;
 * - the release timer publishes a scheduled draft when its time comes,
 *   posted at its release time, its story time unchanged; a held draft and a
 *   not-yet-due one stay drafts;
 * - publishing now clears a schedule or a hold.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { releaseDue } = require('../../src/services/postRelease');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const HOUR = 60 * 60 * 1000;

(shouldSkip ? describe.skip : describe)('release time: publish now, schedule, hold', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const show = crypto.randomUUID();
  let admin;
  let editor;
  const draft = (extra = {}) => models.FeedPost.create({
    show_id: show, poster_handle: `rel${TAG}`, poster_display_name: 'Rel', poster_platform: 'lalaverse', post_type: 'post',
    content_text: 'counting down.', status: 'draft', story_order: 17, likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0, ...extra,
  });
  const setTime = (id, body, token = admin) => request(app).put(`/api/v1/feed-posts/${id}/release-time`).set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-release', email: 'evoni@release.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-release', email: 'e@release.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show, name: `Release ${TAG}`, slug: `release-${TAG}` });
  });

  afterAll(async () => {
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', { show });
    await run('DELETE FROM feed_posts WHERE show_id = :show', { show });
    await run('DELETE FROM episodes WHERE show_id = :show', { show });
    await run('DELETE FROM shows WHERE id = :show', { show });
    await sequelize.close();
  });

  it('schedule needs a future time; hold and clear; admin only; a live post has none', async () => {
    const p = await draft();
    expect((await setTime(p.id, { mode: 'hold' }, editor)).status).toBe(403);
    expect((await setTime(p.id, { mode: 'schedule', at: new Date(Date.now() - HOUR).toISOString() })).status).toBe(400);
    expect((await setTime(p.id, { mode: 'schedule' })).status).toBe(400);
    expect((await setTime(p.id, { mode: 'later' })).status).toBe(400);
    const at = new Date(Date.now() + HOUR);
    const scheduled = await setTime(p.id, { mode: 'schedule', at: at.toISOString() });
    expect(scheduled.status).toBe(200);
    expect(scheduled.body.data).toMatchObject({ release_state: 'scheduled', status: 'draft' });
    expect(new Date(scheduled.body.data.release_at).getTime()).toBe(at.getTime());
    expect((await setTime(p.id, { mode: 'hold' })).body.data).toMatchObject({ release_state: 'held', release_at: null });
    expect((await setTime(p.id, { mode: 'clear' })).body.data).toMatchObject({ release_state: null, release_at: null });
    const live = await draft({ status: 'live', posted_at: new Date() });
    expect((await setTime(live.id, { mode: 'hold' })).status).toBe(409);
  });

  it('the timer publishes a due scheduled draft at its release time; held and not-yet-due ones wait', async () => {
    const dueAt = new Date(Date.now() - 5 * 60 * 1000);
    const due = await draft({ release_state: 'scheduled', release_at: dueAt });
    const later = await draft({ release_state: 'scheduled', release_at: new Date(Date.now() + HOUR) });
    const held = await draft({ release_state: 'held' });
    const released = await releaseDue(models);
    expect(released).toContain(due.id);
    expect(released).not.toContain(later.id);
    expect(released).not.toContain(held.id);
    await due.reload();
    expect(due).toMatchObject({ status: 'live', release_state: null, release_at: null, story_order: 17 });
    expect(due.posted_at.getTime()).toBe(dueAt.getTime());
    await later.reload();
    await held.reload();
    expect(later.status).toBe('draft');
    expect(held.status).toBe('draft');
  });

  it('publishing now clears a schedule or a hold', async () => {
    const p = await draft({ release_state: 'held' });
    const res = await request(app).put(`/api/v1/feed-posts/${p.id}`).set('Authorization', `Bearer ${admin}`).send({ status: 'live' });
    expect(res.status).toBe(200);
    await p.reload();
    expect(p).toMatchObject({ status: 'live', release_state: null, release_at: null });
  });

  it('suggests a release time from the story: two days before its episode airs, in her own hours; nothing saved', async () => {
    const air = new Date(Date.now() + 10 * 24 * HOUR);
    air.setUTCHours(0, 0, 0, 0);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, air_date, created_at, updated_at)
               VALUES (:id, :show, 'Air', 1, 'draft', :air, NOW(), NOW())`, { id: crypto.randomUUID(), show, air });
    const p = await draft({ story_order: 11 });
    const suggest = (id, token = editor) => request(app).get(`/api/v1/feed-posts/${id}/release-time/suggest?tz_offset=0`).set('Authorization', `Bearer ${token}`);
    const res = await suggest(p.id);
    expect(res.status).toBe(200);
    const want = new Date(air.getTime() - 2 * 24 * HOUR);
    want.setUTCHours(18);
    expect(res.body).toEqual({ at: want.toISOString(), why: 'Two days before Episode 1 airs' });
    await p.reload();
    expect(p.release_state).toBeNull();
    const live = await draft({ status: 'live', posted_at: new Date() });
    expect((await suggest(live.id)).status).toBe(409);
    expect((await suggest(crypto.randomUUID())).status).toBe(404);
    expect((await request(app).get(`/api/v1/feed-posts/${p.id}/release-time/suggest`)).status).toBe(401);
  });
});

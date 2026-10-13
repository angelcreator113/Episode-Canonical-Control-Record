/**
 * The weekly Pulse recap (Task #3008; The Pulse spec §11), against the test
 * database:
 * - the week's moments: live posts posted that week, shown as The Pulse at
 *   the present (no drafts, no other week, nothing hidden, no teaser,
 *   nothing after the present), biggest first;
 * - a draft is built once per week with the top posts (never AI); building
 *   again keeps it; admin-only writes;
 * - edit (title, intro, posts: live posts of the show only), publish (needs
 *   a post), unpublish, drop;
 * - public: published only, posts as The Pulse shows them now (a post taken
 *   down later, or made a teaser, drops out: its words never reach the site,
 *   Task #3080), no production ids; drafts are a 404;
 * - the weekly tick drafts last week for a show with live posts in it.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const recaps = require('../../src/services/pulseRecap');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The weekly Pulse recap (Task #3008)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep1: uuid() };
  const WEEK = recaps.weekStartOf(new Date('2026-09-30T12:00:00Z'));   // a Monday
  const inWeek = (day, hour = 12) => new Date(`${WEEK}T00:00:00Z`).getTime() + (day * 24 + hour) * 3600 * 1000;
  const p = {};
  let admin;
  let editor;
  let recapId;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const post = (key, parts) => models.FeedPost.create({
    show_id: ids.show, poster_handle: `${key}${tag}`, poster_display_name: key, poster_platform: 'lalaverse', post_type: 'post',
    content_text: `${key} post`, status: 'live', story_order: 15, likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0,
    ...parts,
  }).then((row) => { p[key] = row.id; return row; });

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-recap', email: 'evoni@recap.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-recap', email: 'ed@recap.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Recap ${tag}`, slug: `recap-${tag}` });
    // Episode 1 is published: the present is its After (17).
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep1, :show, 'One', 1, 'published', NOW(), NOW())`, ids);
    await post('big', { likes: 900, comments_count: 4, posted_at: new Date(inWeek(1)) });
    await post('mid', { likes: 300, comments_count: 9, posted_at: new Date(inWeek(2)) });
    await post('small', { likes: 300, comments_count: 1, posted_at: new Date(inWeek(3)) });
    await post('draft', { status: 'draft', likes: 5000, posted_at: new Date(inWeek(2)) });
    await post('lastweek', { likes: 5000, posted_at: new Date(inWeek(-2)) });
    await post('future', { likes: 5000, story_order: 25, posted_at: new Date(inWeek(2)) });
    await post('hidden', { likes: 5000, posted_at: new Date(inWeek(2)) });
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'post', item_id: p.hidden, moment: 'story_time', story_order: 99, mode: 'hidden', source: 'set' });
    // A teaser until a later moment: The Pulse shows it with no words (Task #3080).
    await post('teaser', { likes: 5000, posted_at: new Date(inWeek(2)) });
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'post', item_id: p.teaser, moment: 'story_time', story_order: 99, mode: 'teaser', source: 'set' });
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_recaps WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test("the week's moments: live, that week, shown as The Pulse at the present, biggest first", async () => {
    expect(WEEK).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${WEEK}T00:00:00Z`).getUTCDay()).toBe(1);
    const list = await recaps.candidates(models, ids.show, WEEK);
    expect(list.map((x) => x.poster_display_name)).toEqual(['big', 'mid', 'small']);
    expect(list[0]).toMatchObject({ likes: 900, comments_count: 4, content_text: 'big post', story_order: 15 });
    await expect(recaps.candidates(models, ids.show, '2026-10-01')).rejects.toMatchObject({ status: 400 });
  });

  test('Admin builds the week once, as a draft with the top posts; building again keeps it; only an admin writes', async () => {
    expect((await as(editor, request(app).post('/api/v1/pulse-recaps/build')).send({ show_id: ids.show, week_start: WEEK })).status).toBe(403);
    const first = await as(admin, request(app).post('/api/v1/pulse-recaps/build')).send({ show_id: ids.show, week_start: WEEK });
    expect(first.status).toBe(201);
    expect(first.body.recap).toMatchObject({ week_start: WEEK, status: 'draft', post_ids: [p.big, p.mid, p.small] });
    expect(first.body.recap.title).toMatch(/^The Pulse, week of \d+ \w+$/);
    expect(first.body.recap.posts.map((x) => x.poster_display_name)).toEqual(['big', 'mid', 'small']);
    recapId = first.body.recap.id;

    const again = await as(admin, request(app).post('/api/v1/pulse-recaps/build')).send({ show_id: ids.show, week_start: WEEK });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ created: false, recap: { id: recapId } });
    const list = await as(editor, request(app).get(`/api/v1/pulse-recaps?show_id=${ids.show}`));
    expect(list.body.recaps.map((r) => r.id)).toEqual([recapId]);
    expect((await as(editor, request(app).get(`/api/v1/pulse-recaps/${recapId}/candidates`))).body.posts).toHaveLength(3);
  });

  test("a draft is not public; Evoni edits it (live posts of the show only) and publishes it", async () => {
    expect((await request(app).get(`/api/v1/public/recaps/${recapId}`)).status).toBe(404);
    expect((await request(app).get('/api/v1/public/recaps')).body.recaps.find((r) => r.id === recapId)).toBeUndefined();

    const put = (body) => as(admin, request(app).put(`/api/v1/pulse-recaps/${recapId}`)).send(body);
    expect((await put({ post_ids: [p.mid, p.draft] })).status).toBe(400);
    expect((await put({ title: '' })).status).toBe(400);
    const edited = await put({ title: 'The week the gala happened', intro: 'Here is what everyone said.', post_ids: [p.mid, p.big] });
    expect(edited.body.recap).toMatchObject({ title: 'The week the gala happened', intro: 'Here is what everyone said.', post_ids: [p.mid, p.big] });
    expect(edited.body.recap.posts.map((x) => x.poster_display_name)).toEqual(['mid', 'big']);

    expect((await as(editor, request(app).post(`/api/v1/pulse-recaps/${recapId}/publish`))).status).toBe(403);
    const published = await as(admin, request(app).post(`/api/v1/pulse-recaps/${recapId}/publish`));
    expect(published.body.recap).toMatchObject({ status: 'published', published_by: 'evoni@recap.dev' });
    expect((await as(admin, request(app).post(`/api/v1/pulse-recaps/${recapId}/publish`))).status).toBe(409);
    expect((await as(admin, request(app).post(`/api/v1/pulse-recaps/${recapId}/drop`))).status).toBe(409);
  });

  test('public: published only, posts as The Pulse shows them now, no production ids; a post taken down drops out', async () => {
    const list = (await request(app).get('/api/v1/public/recaps')).body.recaps;
    expect(list.find((r) => r.id === recapId)).toEqual({ id: recapId, title: 'The week the gala happened', week_start: WEEK });
    const one = await request(app).get(`/api/v1/public/recaps/${recapId}`);
    expect(one.status).toBe(200);
    expect(one.body.recap).toMatchObject({ title: 'The week the gala happened', intro: 'Here is what everyone said.', week_start: WEEK });
    expect(one.body.recap.posts).toEqual([
      { poster_handle: `mid${tag}`, poster_display_name: 'mid', content_text: 'mid post', likes: 300, comments_count: 9, moment: 'During Ep 1', image: null },
      { poster_handle: `big${tag}`, poster_display_name: 'big', content_text: 'big post', likes: 900, comments_count: 4, moment: 'During Ep 1', image: null },
    ]);
    const raw = JSON.stringify(one.body);
    for (const secret of [ids.show, ids.ep1, p.mid, p.big]) expect(raw).not.toContain(secret);

    await run("UPDATE feed_posts SET status = 'draft' WHERE id = :id", { id: p.mid });
    expect((await request(app).get(`/api/v1/public/recaps/${recapId}`)).body.recap.posts.map((x) => x.poster_display_name)).toEqual(['big']);
    await run("UPDATE feed_posts SET status = 'live' WHERE id = :id", { id: p.mid });

    // Made a teaser after publishing: its words leave the site until its moment (Task #3080).
    const later = await models.PulseReveal.create({ show_id: ids.show, item_type: 'post', item_id: p.mid, moment: 'story_time', story_order: 99, mode: 'teaser', source: 'set' });
    const teased = await request(app).get(`/api/v1/public/recaps/${recapId}`);
    expect(teased.body.recap.posts.map((x) => x.poster_display_name)).toEqual(['big']);
    expect(JSON.stringify(teased.body)).not.toContain('mid post');
    await later.destroy({ force: true });
  });

  test('unpublish takes it off the site; a draft can be dropped; a dropped one is not edited', async () => {
    const back = await as(admin, request(app).post(`/api/v1/pulse-recaps/${recapId}/unpublish`));
    expect(back.body.recap).toMatchObject({ status: 'draft', published_at: null });
    expect((await request(app).get(`/api/v1/public/recaps/${recapId}`)).status).toBe(404);
    expect((await as(admin, request(app).post(`/api/v1/pulse-recaps/${recapId}/drop`))).body.recap.status).toBe('dropped');
    expect((await as(admin, request(app).put(`/api/v1/pulse-recaps/${recapId}`)).send({ title: 'x' })).status).toBe(409);
    expect((await as(admin, request(app).post(`/api/v1/pulse-recaps/${recapId}/publish`))).status).toBe(409);
  });

  test('a week with no moments cannot be published; the weekly tick drafts last week for a show with live posts in it', async () => {
    const empty = recaps.weekStartOf(new Date('2026-08-05T00:00:00Z'));
    const { recap } = await recaps.buildDraft(models, ids.show, empty);
    expect(recap.post_ids).toEqual([]);
    await expect(recaps.publish(models, recap, 'evoni')).rejects.toMatchObject({ status: 400 });

    // "Now" is the Monday after WEEK, so last week is WEEK, which already has a recap: nothing new.
    const monday = new Date(new Date(`${WEEK}T00:00:00Z`).getTime() + 7 * 24 * 3600 * 1000 + 3600 * 1000);
    expect((await recaps.tick(models, monday)).filter((r) => r.show_id === ids.show)).toEqual([]);
    // The week after has a live post: the tick drafts it once.
    await post('nextweek', { likes: 10, posted_at: new Date(inWeek(8)) });
    const later = new Date(monday.getTime() + 7 * 24 * 3600 * 1000);
    const made = (await recaps.tick(models, later)).filter((r) => r.show_id === ids.show);
    expect(made).toHaveLength(1);
    expect(made[0].post_ids).toEqual([p.nextweek]);
    expect((await recaps.tick(models, later)).filter((r) => r.show_id === ids.show)).toEqual([]);
  });
});

/**
 * The Pulse's production reads are an ADMIN's (Evoni's decisions of
 * 2026-11-15: "ADMIN-only restrictions for production schedules, follower
 * projections, storylines, voices, engine status, recap candidates, raw
 * analytics and draft records"; the feed moments read is an ADMIN's for
 * now), against the test database.
 *
 * Each of these asked for a signed-in account and nothing more, and every
 * caller is an Admin or production screen. What a reader of The Pulse
 * reads (trending, the latest fit, the cities, a profile, Lala's messages)
 * is not among them and stays a reader's.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const MARK = 'ZZPULSEOPS';

(shouldSkip ? describe.skip : describe)("The Pulse's production reads: who reads them", () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), episode: crypto.randomUUID(), post: crypto.randomUUID(), thread: crypto.randomUUID() };
  const none = '00000000-0000-4000-8000-000000000000';
  const tokens = {};
  let ipN = 0;
  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const get = (who, path) => {
    ipN += 1;
    const r = request(app).get(path).set('X-Forwarded-For', `198.51.113.${(ipN % 200) + 1}`);
    return tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r;
  };

  const reads = () => [
    `/api/v1/pulse-reveals?show_id=${ids.show}`,
    `/api/v1/pulse-reveals/met?show_id=${ids.show}`,
    `/api/v1/pulse-followers?show_id=${ids.show}`,
    `/api/v1/pulse-followers/history?show_id=${ids.show}&profile_id=1`,
    `/api/v1/pulse-followers/growth?show_id=${ids.show}`,
    `/api/v1/pulse-calendar?show_id=${ids.show}`,
    `/api/v1/pulse-storylines?show_id=${ids.show}`,
    `/api/v1/pulse-voices?show_id=${ids.show}`,
    `/api/v1/pulse-engine?show_id=${ids.show}`,
    `/api/v1/pulse-recaps?show_id=${ids.show}`,
    `/api/v1/pulse-recaps/${none}/candidates`,
    `/api/v1/pulse-numbers?show_id=${ids.show}`,
    `/api/v1/pulse-closeness?show_id=${ids.show}`,
    `/api/v1/pulse-fits?show_id=${ids.show}`,
    `/api/v1/feed-enhanced/event/${none}/engagement`,
    `/api/v1/feed-enhanced/${ids.show}/momentum`,
    `/api/v1/feed-enhanced/${ids.show}/chain/${none}`,
    `/api/v1/feed-enhanced/${ids.show}/moments/${ids.episode}`,
    `/api/v1/feed-enhanced/${ids.show}/viral`,
    `/api/v1/feed-enhanced/thread/${ids.thread}`,
  ];
  // What a reader of The Pulse reads: not production reads, and not changed here.
  const readers = () => [
    `/api/v1/feed-enhanced/${ids.show}/trending`,
    `/api/v1/pulse-fits/latest?show_id=${ids.show}`,
    `/api/v1/pulse-reveals/cities?show_id=${ids.show}`,
    `/api/v1/pulse-dms?show_id=${ids.show}&profile_id=2147483000`,
  ];

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@pulseops.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { ...ids, name: `PulseOps ${tag}`, slug: `pulseops-${tag}` });
    await models.Episode.create({ id: ids.episode, show_id: ids.show, title: `PulseOps ${tag}`, episode_number: 1, status: 'draft' });
    // A viral draft in a thread: what the raw analytics and thread reads gave to any signed-in account.
    await models.FeedPost.create({
      id: ids.post, show_id: ids.show, episode_id: ids.episode, thread_id: ids.thread, status: 'draft', is_viral: true, viral_reach: 99,
      poster_handle: `ops.${tag}`, content_text: `${MARK} a draft nobody has released`, post_type: 'post',
    });
  });

  afterAll(async () => {
    await run('DELETE FROM feed_posts WHERE id = :post', ids);
    await run('DELETE FROM episodes WHERE id = :episode', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    jest.restoreAllMocks();
  });

  const leaks = (res) => (JSON.stringify(res.body || {}) + (res.text || '')).includes(MARK);

  it('covers every read of the ruling', () => {
    expect(reads()).toHaveLength(20);
  });

  it('nobody signed out reads any of them: 401', async () => {
    for (const path of reads()) {
      const res = await get(null, path);
      expect(`${path} ${res.status}`).toBe(`${path} 401`);
      expect([path, leaks(res)]).toEqual([path, false]);
    }
  });

  it.each(['viewer', 'editor'])('a %s reads none of them: 403, and nothing of the draft', async (who) => {
    for (const path of reads()) {
      const res = await get(who, path);
      expect(`${path} ${res.status}`).toBe(`${path} 403`);
      expect([path, leaks(res)]).toEqual([path, false]);
    }
  });

  it('an ADMIN is refused by none of them', async () => {
    for (const path of reads()) {
      const res = await get('admin', path);
      expect([path, [401, 403].includes(res.status)]).toEqual([path, false]);
    }
  });

  it('an ADMIN still reads the raw records: the viral draft, and its thread', async () => {
    const viral = await get('admin', `/api/v1/feed-enhanced/${ids.show}/viral`);
    expect(viral.status).toBe(200);
    expect(JSON.stringify(viral.body)).toContain(MARK);
    const thread = await get('admin', `/api/v1/feed-enhanced/thread/${ids.thread}`);
    expect(thread.status).toBe(200);
    expect(JSON.stringify(thread.body)).toContain(MARK);
    for (const path of [`/api/v1/pulse-engine?show_id=${ids.show}`, `/api/v1/pulse-calendar?show_id=${ids.show}`, `/api/v1/pulse-fits?show_id=${ids.show}`]) {
      expect(`${path} ${(await get('admin', path)).status}`).toBe(`${path} 200`);
    }
  });

  it.each(['viewer', 'editor'])("what a reader reads stays a reader's: a %s is not refused, and gets nothing of the draft", async (who) => {
    for (const path of readers()) {
      const res = await get(who, path);
      expect([path, [401, 403].includes(res.status)]).toEqual([path, false]);
      expect([path, leaks(res)]).toEqual([path, false]);
    }
  });

  it('a refused read changes nothing', async () => {
    const before = (await models.FeedPost.findByPk(ids.post)).toJSON();
    await get('viewer', `/api/v1/feed-enhanced/${ids.show}/viral`);
    await get('editor', `/api/v1/feed-enhanced/thread/${ids.thread}`);
    expect((await models.FeedPost.findByPk(ids.post)).toJSON()).toEqual(before);
  });
});

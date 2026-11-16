/**
 * A read must not write, or spend, for a reader who may not (Evoni,
 * 2026-11-16), against the test database. Six reads did:
 *
 *   GET /api/v1/episode-brief/:episodeId          made the episode's brief row
 *   GET /api/v1/session/brief/latest              stamped the brief as used
 *   GET /api/v1/world/:showId/events/:eventId/feed-activity
 *                                                 generated posts and tried to save them on the event
 *   GET /api/v1/memories/books/:bookId/scenes     a paid AI call (and its POST twin)
 *   GET /api/v1/amber/greeting                    a paid AI call, with no rate limit
 *   GET /api/v1/shows/:id                         made an "Untitled Show" row for an id that
 *                                                 live episodes point at and no show has
 *
 * Any signed-in account could cause each. Now only an ADMIN's read writes or
 * calls the AI. The three reads that also carry data still answer a viewer
 * and an editor, with what is there and nothing saved; a show with no record
 * is not found for them; the two AI reads are an ADMIN's (403 otherwise). No
 * token is 401 on all six, as before.
 */
jest.unmock('uuid');
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-not-real';

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

(shouldSkip ? describe.skip : describe)('a read does not write or spend for a reader who may not', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const uuid = () => crypto.randomUUID();
  const ids = { show: uuid(), ep: uuid(), epAdmin: uuid(), event: uuid(), eventAdmin: uuid(), orphanShow: uuid(), orphanShowAdmin: uuid(), noShow: uuid() };
  // Whether this database lets an episode point at a show that has no row (no foreign key): only then can the read create one.
  let orphanPossible = false;
  const tokens = {};
  let book; let sessionBrief;
  let ipN = 0;
  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const one = async (sql, replacements = {}) => (await run(sql, replacements))[0][0];
  const call = (method, who, path) => {
    ipN += 1;
    const r = request(app)[method](path).set('X-Forwarded-For', `198.51.${160 + Math.floor(ipN / 200)}.${(ipN % 200) + 1}`);
    return tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r;
  };
  const get = (who, path) => call('get', who, path);
  const NOT_ADMIN = ['viewer', 'editor'];
  const aiAnswer = (text) => ({ content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } });

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@reads.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { ...ids, name: `Reads ${tag}`, slug: `reads-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
                 (:ep, :show, 'One', 1, 'draft', NOW(), NOW()), (:epAdmin, :show, 'Two', 2, 'draft', NOW(), NOW())`, ids);
    const cc = JSON.stringify({ automation: { host_handle: `host.${tag}`, host_display_name: 'Host', guest_profiles: [{ profile_id: 990001, handle: `guest.${tag}`, relationship: 'industry' }] } });
    for (const id of [ids.event, ids.eventAdmin]) {
      await run(`INSERT INTO world_events (id, show_id, name, event_type, status, canon_consequences, created_at, updated_at)
                 VALUES (:id, :show, :name, 'invite', 'draft', CAST(:cc AS jsonb), NOW(), NOW())`, { id, show: ids.show, name: `Gala ${tag}`, cc });
    }
    try {
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
                   (:a, :orphanShow, 'Orphan', 1, 'draft', NOW(), NOW()), (:b, :orphanShowAdmin, 'Orphan', 1, 'draft', NOW(), NOW())`,
      { a: uuid(), b: uuid(), orphanShow: ids.orphanShow, orphanShowAdmin: ids.orphanShowAdmin });
      orphanPossible = true;
    } catch (err) {
      if (!/foreign key|violates/i.test(`${err.message} ${err.parent?.message || ''}`)) throw err;
    }
    book = await models.StorytellerBook.create({ title: `Reads book ${tag}`, character_name: 'JustAWoman', status: 'draft' });
    const chapter = await models.StorytellerChapter.create({ book_id: book.id, title: 'Approved', chapter_number: 1, sort_order: 1 });
    await models.StorytellerLine.create({ chapter_id: chapter.id, text: 'Elias watched.', content: 'Elias watched.', status: 'approved', sort_order: 1, line_order: 1 });
    // The newest session brief, so it is "the latest" for this run.
    sessionBrief = await models.SessionBrief.create({ brief_text: `Brief ${tag}`, used_at: null });
    await run(`UPDATE session_briefs SET created_at = NOW() + INTERVAL '1 day' WHERE id = :id`, { id: sessionBrief.id });
  });

  beforeEach(() => { mockCreate.mockReset(); });

  afterAll(async () => {
    await run('DELETE FROM session_briefs WHERE id = :id', { id: sessionBrief.id });
    const chapters = await models.StorytellerChapter.findAll({ where: { book_id: book.id }, paranoid: false });
    for (const c of chapters) await models.StorytellerLine.destroy({ where: { chapter_id: c.id }, force: true });
    await models.StorytellerChapter.destroy({ where: { book_id: book.id }, force: true });
    await book.destroy({ force: true });
    await run('DELETE FROM episode_briefs WHERE episode_id IN (:eps)', { eps: [ids.ep, ids.epAdmin] });
    await run('DELETE FROM world_events WHERE id IN (:events)', { events: [ids.event, ids.eventAdmin] });
    await run('DELETE FROM episodes WHERE show_id IN (:shows)', { shows: [ids.show, ids.orphanShow, ids.orphanShowAdmin] });
    await run('DELETE FROM shows WHERE id IN (:shows)', { shows: [ids.show, ids.orphanShow, ids.orphanShowAdmin, ids.noShow] });
  });

  describe('GET /api/v1/shows/:id', () => {
    const showRows = async () => (await run('SELECT id, name, deleted_at FROM shows WHERE id IN (:shows) ORDER BY id', { shows: [ids.show, ids.orphanShow, ids.orphanShowAdmin, ids.noShow] }))[0];

    test('no token: 401 for an existing show, a missing one and one only episodes point at; no row is made', async () => {
      const before = await showRows();
      for (const id of [ids.show, ids.noShow, ids.orphanShow]) expect([id, (await get('anon', `/api/v1/shows/${id}`)).status]).toEqual([id, 401]);
      expect(await showRows()).toEqual(before);
    });

    test.each(['viewer', 'editor', 'admin'])('%s reads an existing show, and the read changes nothing', async (who) => {
      const before = await showRows();
      const res = await get(who, `/api/v1/shows/${ids.show}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: ids.show, name: `Reads ${tag}` });
      expect(await showRows()).toEqual(before);
    });

    test.each(['viewer', 'editor', 'admin'])('%s: a show no row and no episode has is not found, and none is made', async (who) => {
      const before = await showRows();
      expect((await get(who, `/api/v1/shows/${ids.noShow}`)).status).toBe(404);
      expect(await showRows()).toEqual(before);
      expect(before.some((r) => r.id === ids.noShow)).toBe(false);
    });

    test.each(NOT_ADMIN)('%s: a show only episodes point at is not found, however often it is asked, and no row is made', async (who) => {
      if (!orphanPossible) return;   // this database refuses such an episode, so the read has nothing to create
      const before = await showRows();
      for (let i = 0; i < 3; i += 1) expect((await get(who, `/api/v1/shows/${ids.orphanShow}`)).status).toBe(404);
      expect(await showRows()).toEqual(before);
      expect(before.some((r) => r.id === ids.orphanShow)).toBe(false);
    });

    test('an ADMIN: a show only episodes point at is made on the first read, once, and a viewer then reads it', async () => {
      if (!orphanPossible) return;
      const first = await get('admin', `/api/v1/shows/${ids.orphanShowAdmin}`);
      expect(first.status).toBe(200);
      expect(first.body.data).toMatchObject({ id: ids.orphanShowAdmin, name: 'Untitled Show' });
      expect((await get('admin', `/api/v1/shows/${ids.orphanShowAdmin}`)).status).toBe(200);
      const rows = (await showRows()).filter((r) => r.id === ids.orphanShowAdmin);
      expect(rows).toHaveLength(1);
      expect((await get('viewer', `/api/v1/shows/${ids.orphanShowAdmin}`)).body.data).toMatchObject({ id: ids.orphanShowAdmin, name: 'Untitled Show' });
      // The one the viewer and the editor asked for still has no row.
      expect((await showRows()).some((r) => r.id === ids.orphanShow)).toBe(false);
    });

    test('the route creates only inside the ADMIN branch', () => {
      const src = require('fs').readFileSync(require('path').join(__dirname, '../../src/routes/shows.js'), 'utf8');
      const handler = src.slice(src.indexOf("router.get('/:id', requireAuth,"), src.indexOf("router.", src.indexOf("router.get('/:id', requireAuth,") + 10));
      const branch = handler.indexOf("if (!show && require('../services/publicSocialProfile').readsAsAdmin(req)) {");
      expect(branch).toBeGreaterThan(0);
      expect(handler.indexOf('Show.create(')).toBeGreaterThan(branch);
      expect(handler.indexOf('INSERT INTO shows')).toBeGreaterThan(branch);
      expect(handler.slice(0, branch)).not.toMatch(/Show\.create\(|INSERT INTO/);
    });
  });

  test('no token: 401 on all five, and on the POST twin; nothing is written and the AI is not called', async () => {
    const before = await snapshot();
    for (const [method, path] of [
      ['get', `/api/v1/episode-brief/${ids.ep}`],
      ['get', '/api/v1/session/brief/latest'],
      ['get', `/api/v1/world/${ids.show}/events/${ids.event}/feed-activity`],
      ['get', `/api/v1/memories/books/${book.id}/scenes`],
      ['post', `/api/v1/memories/books/${book.id}/scenes`],
      ['get', '/api/v1/amber/greeting'],
    ]) {
      const res = await call(method, 'anon', path);
      expect([method, path, res.status]).toEqual([method, path, 401]);
    }
    expect(await snapshot()).toEqual(before);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // What these reads could change, for the rows this suite seeded.
  async function snapshot() {
    return {
      briefs: Number((await one('SELECT COUNT(*) AS n FROM episode_briefs WHERE episode_id IN (:eps)', { eps: [ids.ep, ids.epAdmin] })).n),
      used: (await one('SELECT used_at, updated_at FROM session_briefs WHERE id = :id', { id: sessionBrief.id })),
      events: (await run('SELECT id, canon_consequences, updated_at FROM world_events WHERE id IN (:events) ORDER BY id', { events: [ids.event, ids.eventAdmin] }))[0],
    };
  }

  describe.each(NOT_ADMIN)('%s', (who) => {
    test('the episode brief reads as an empty draft, and no row is made, however often it is asked', async () => {
      const before = await snapshot();
      for (let i = 0; i < 3; i += 1) {
        const res = await get(who, `/api/v1/episode-brief/${ids.ep}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ id: null, episode_id: ids.ep, show_id: ids.show, status: 'draft' });
        expect(res.body.data).toHaveProperty('her_goal');
      }
      expect(await snapshot()).toEqual(before);
      expect(before.briefs).toBe(0);
      // An episode that does not exist is still not found, and still makes nothing.
      expect((await get(who, `/api/v1/episode-brief/${uuid()}`)).status).toBe(404);
    });

    test('the latest session brief reads, and is not marked used', async () => {
      const before = await snapshot();
      const res = await get(who, '/api/v1/session/brief/latest');
      expect(res.status).toBe(200);
      expect(res.body.brief).toMatchObject({ id: sessionBrief.id, brief_text: `Brief ${tag}`, used_at: null });
      expect(await snapshot()).toEqual(before);
    });

    test('feed activity reads what is there (nothing), and nothing is generated or saved on the event', async () => {
      const before = await snapshot();
      const res = await get(who, `/api/v1/world/${ids.show}/events/${ids.event}/feed-activity`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, posts: [] });
      expect(await snapshot()).toEqual(before);
      expect(before.events.every((e) => !(e.canon_consequences || {}).feed_activity)).toBe(true);
    });

    test('scene suggestions are refused on GET and on POST (403), and the AI is not called', async () => {
      for (const method of ['get', 'post']) {
        const res = await call(method, who, `/api/v1/memories/books/${book.id}/scenes`);
        expect([method, res.status]).toEqual([method, 403]);
        expect(res.body.scenes).toBeUndefined();
      }
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test("Amber's greeting is refused (403), with no greeting or system state, and the AI is not called", async () => {
      for (const qs of ['', '?page=dashboard', '?page=universe']) {
        const res = await get(who, `/api/v1/amber/greeting${qs}`);
        expect([qs, res.status]).toEqual([qs, 403]);
        expect(res.body.greeting).toBeUndefined();
        expect(res.body.state).toBeUndefined();
      }
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('an ADMIN: as before', () => {
    test('the episode brief is made on the first read, once, and a viewer then reads that saved brief', async () => {
      const first = await get('admin', `/api/v1/episode-brief/${ids.epAdmin}`);
      expect(first.status).toBe(200);
      expect(first.body.data).toMatchObject({ episode_id: ids.epAdmin, show_id: ids.show, status: 'draft' });
      expect(first.body.data.id).toBeTruthy();
      const again = await get('admin', `/api/v1/episode-brief/${ids.epAdmin}`);
      expect(again.body.data.id).toBe(first.body.data.id);
      expect(Number((await one('SELECT COUNT(*) AS n FROM episode_briefs WHERE episode_id = :ep', { ep: ids.epAdmin })).n)).toBe(1);
      const seen = await get('viewer', `/api/v1/episode-brief/${ids.epAdmin}`);
      expect(seen.body.data.id).toBe(first.body.data.id);
    });

    test('the latest session brief is marked used', async () => {
      const res = await get('admin', '/api/v1/session/brief/latest');
      expect(res.status).toBe(200);
      expect(res.body.brief.id).toBe(sessionBrief.id);
      expect((await one('SELECT used_at FROM session_briefs WHERE id = :id', { id: sessionBrief.id })).used_at).not.toBeNull();
    });

    // Today the generated posts are not saved: the route hands the service a copy of the event that has lost its
    // id, and the save is refused and logged (an older fault, left as it is). So this pins what an ADMIN gets now,
    // and that generating stays an ADMIN's, which is what matters the day that save works.
    test('feed activity is generated on an ADMIN\'s read, and on no one else\'s', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      const service = require('../../src/services/feedActivityService');
      const generate = jest.spyOn(service, 'generatePostEventActivity');
      const url = `/api/v1/world/${ids.show}/events/${ids.eventAdmin}/feed-activity`;
      for (const who of ['viewer', 'editor']) {
        const res = await get(who, url);
        expect([who, res.status, res.body]).toEqual([who, 200, { success: true, posts: [] }]);
      }
      expect(generate).not.toHaveBeenCalled();
      const first = await get('admin', url);
      expect(first.status).toBe(200);
      expect(first.body).toMatchObject({ success: true, generated: true });
      expect(first.body.posts.length).toBeGreaterThan(0);
      expect(generate).toHaveBeenCalledTimes(1);
      generate.mockRestore();
      // Posts already saved on an event are read by anyone signed in, and nothing is generated for them.
      const saved = [{ handle: `guest.${tag}`, role: 'industry', content: 'Saved earlier.', event_id: ids.event }];
      await run(`UPDATE world_events SET canon_consequences = jsonb_set(canon_consequences, '{feed_activity}', CAST(:posts AS jsonb)) WHERE id = :id`, { id: ids.event, posts: JSON.stringify(saved) });
      for (const who of ['viewer', 'editor', 'admin']) {
        const res = await get(who, `/api/v1/world/${ids.show}/events/${ids.event}/feed-activity`);
        expect([who, res.status, res.body]).toEqual([who, 200, { success: true, posts: saved }]);
      }
    });

    test('scene suggestions call the AI and answer, on POST and on the GET alias', async () => {
      for (const method of ['post', 'get']) {
        mockCreate.mockReset();
        mockCreate.mockResolvedValue(aiAnswer(JSON.stringify([{ title: 'The first post', description: 'She posts.', chapter_hint: '' }])));
        const res = await call(method, 'admin', `/api/v1/memories/books/${book.id}/scenes`);
        expect([method, res.status]).toEqual([method, 200]);
        expect(res.body.scenes.map((s) => s.title)).toEqual(['The first post']);
        expect(mockCreate).toHaveBeenCalledTimes(1);
      }
    });

    test("Amber's greeting calls the AI and answers", async () => {
      mockCreate.mockResolvedValue(aiAnswer('The feed is alive tonight.'));
      const res = await get('admin', '/api/v1/amber/greeting?page=dashboard');
      expect(res.status).toBe(200);
      expect(res.body.greeting).toBe('The feed is alive tonight.');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  test("Amber's greeting is rate limited: an ADMIN's 31st read in the window is refused (429), and the AI is called 30 times", async () => {
    // The limiter counts by account, so this uses an ADMIN of its own. 30 per window is the limiter's default.
    const limit = parseInt(process.env.AI_RATE_LIMIT_PER_IP || '30', 10);
    tokens.limited = TokenService.generateTokenPair({ id: `admin-limit-${tag}`, email: `limit-${tag}@reads.dev`, name: 'Limit', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    mockCreate.mockResolvedValue(aiAnswer('Quiet tonight.'));
    for (let i = 0; i < limit; i += 1) expect([i, (await get('limited', '/api/v1/amber/greeting')).status]).toEqual([i, 200]);
    const over = await get('limited', '/api/v1/amber/greeting');
    expect(over.status).toBe(429);
    expect(over.body).toMatchObject({ code: 'AI_RATE_LIMITED' });
    expect(over.body.greeting).toBeUndefined();
    expect(mockCreate).toHaveBeenCalledTimes(limit);
    // Another ADMIN is not held back by it.
    expect((await get('admin', '/api/v1/amber/greeting')).status).toBe(200);
  });

  test('the routes say so: each AI read names ADMIN and the AI limiter, and no other route serves the same handlers', () => {
    const fs = require('fs');
    const path = require('path');
    const read = (f) => fs.readFileSync(path.join(__dirname, '../../src/routes', f), 'utf8');
    const core = read('memories/core.js');
    const sceneRoutes = core.split('\n').filter((l) => /bookSceneSuggestions\)/.test(l) && /^router\./.test(l));
    expect(sceneRoutes).toHaveLength(2);
    for (const line of sceneRoutes) expect(line).toMatch(/requireAuth, authorize\(\['ADMIN'\]\), aiRateLimiter, bookSceneSuggestions\)/);
    const amber = read('amberSessionRoutes.js');
    expect(amber).toMatch(/router\.get\('\/greeting', requireAuth, authorize\(\['ADMIN'\]\), aiRateLimiter,/);
    // generateGreeting is called from the greeting route only.
    expect(amber.match(/generateGreeting\(/g)).toHaveLength(2);   // its definition and that one call
  });
});

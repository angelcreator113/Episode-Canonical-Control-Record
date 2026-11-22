/**
 * The production plan and Start Episode are an ADMIN's (Evoni, 2026-11-22;
 * docs/audit/F-AUTH-1_PlanAndStartEpisode_AdminOnly_Amendment_2026-11-22.md).
 *
 * Twenty write routes carry requireAuth then authorize(['ADMIN']), before
 * any rate limiter, upload handling or handler. For each, on the migrated
 * database through the real app and the real auth middleware:
 *   - signed out: 401;
 *   - signed in but not an admin: 403 with authorize's own body;
 *   - during that refusal no statement that writes is sent to the database
 *     (every statement is recorded, tests/helpers/lockTrace), every row of
 *     the episode, its brief, plan, scenes and set links and of the event is
 *     as it was, the AI client is never called and no upload is read.
 * What an admin gets from each route is unchanged and is carried by the
 * routes' own suites, which now ask as an admin.
 *
 * The title-overlay route keeps its middleware; its clearing of a stale
 * episode link is an admin's (last block).
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));
const mockDesignTitleCard = jest.fn();
jest.mock('../../src/services/episodeTitleCardService', () => ({
  ...jest.requireActual('../../src/services/episodeTitleCardService'),
  designTitleCard: (...args) => mockDesignTitleCard(...args),
}));

const request = require('supertest');
const crypto = require('crypto');
const multer = require('multer');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const lockTrace = require('../helpers/lockTrace');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

const AUTHORIZE_BODY = { error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' };

(shouldSkip ? describe.skip : describe)("The production plan and Start Episode are an admin's", () => {
  const show = uuid();
  const episode = uuid();
  const event = uuid();
  const otherEvent = uuid();
  const set = uuid();
  const tokens = {};
  let ip = 0;
  const from = (r) => r.set('X-Forwarded-For', `10.91.${Math.floor(ip / 250)}.${(ip % 250) + 1}`);
  const as = (who) => (r) => (who ? from(r).set('Authorization', `Bearer ${tokens[who]}`) : from(r));

  const BRIEF = `/api/v1/episode-brief/${episode}`;
  const STUDIO = `/api/v1/scene-studio-episodes/${episode}`;
  const WORLD = `/api/v1/world/${show}`;
  // [name, method, path, body, upload?]: a body an admin could send.
  const ROUTES = [
    ['brief save', 'put', BRIEF, { narrative_purpose: 'changed', event_id: otherEvent }],
    ['cover marks', 'put', `${BRIEF}/cover-marks`, { key: 'requirement:0', covered: true, beat: 2 }],
    ['self-talk', 'put', `${BRIEF}/self-talk`, { tone: 'kind' }],
    ['brief lock', 'post', `${BRIEF}/lock`, {}],
    ['generate-plan', 'post', `${BRIEF}/generate-plan`, {}],
    ['feed-moments retry', 'post', `${BRIEF}/feed-moments/retry`, {}],
    ['beat save', 'put', `${BRIEF}/plan/1`, { scene_set_id: set, chosen: true }],
    ['beat lock', 'post', `${BRIEF}/plan/1/lock`, {}],
    ['lock-all', 'post', `${BRIEF}/plan/lock-all`, {}],
    ['setup resume', 'post', `${BRIEF}/setup/resume`, {}],
    ['studio beat angle', 'put', `${STUDIO}/beat/1/angle`, { angle_label: 'WIDE' }],
    ['studio beat scene-set', 'put', `${STUDIO}/beat/1/scene-set`, { scene_set_id: set }],
    ['generate-episode', 'post', `${WORLD}/events/${otherEvent}/generate-episode`, { draft_script: false }],
    ['generate-episode-from-many', 'post', `${WORLD}/events/generate-episode-from-many`, { event_ids: [otherEvent] }],
    ['regenerate-episode', 'post', `${WORLD}/events/${event}/regenerate-episode`, {}],
    ['inject', 'post', `${WORLD}/events/${otherEvent}/inject`, { episode_id: episode }],
    ['scene-set-link', 'post', `${WORLD}/events/${event}/scene-set-link`, { scene_set_id: set }],
    ['detach-episode', 'post', `${WORLD}/events/${event}/detach-episode`, {}],
    ['look generate', 'post', `${WORLD}/events/${event}/look/generate`, {}],
    ['look upload', 'post', `${WORLD}/events/${event}/look/upload`, null, true],
  ];
  const send = (who, [, method, path, body, upload]) => {
    const r = as(who)(request(app)[method](path));
    return upload ? r.attach('image', Buffer.from('not really an image'), { filename: 'look.png', contentType: 'image/png' }) : r.send(body);
  };

  // Every row a P1 route could change, whole.
  const snapshot = async () => ({
    episodes: await rows('SELECT * FROM episodes WHERE show_id = :show ORDER BY id', { show }),
    briefs: await rows('SELECT * FROM episode_briefs WHERE show_id = :show OR episode_id = :episode ORDER BY id', { show, episode }),
    plans: await rows('SELECT * FROM scene_plans WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show) ORDER BY id', { show }),
    scenes: await rows('SELECT * FROM scenes WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show) ORDER BY id', { show }),
    links: await rows('SELECT * FROM scene_set_episodes WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show) ORDER BY id', { show }),
    events: await rows('SELECT * FROM world_events WHERE show_id = :show ORDER BY id', { show }),
    sets: await rows('SELECT * FROM scene_sets WHERE show_id = :show ORDER BY id', { show }),
  });
  const writesIn = (records) => records.filter((r) => r.kind === 'write' || r.kind === 'insert'
    || (r.kind === 'other' && /^\s*(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP)\b/i.test(r.sql || '')));

  beforeAll(async () => {
    tokens.editor = TokenService.generateTokenPair({ id: 'p1-editor', email: 'editor@p1.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    tokens.viewer = TokenService.generateTokenPair({ id: 'p1-viewer', email: 'viewer@p1.dev', name: 'Viewer', groups: ['VIEWER'], role: 'USER' }).accessToken;
    tokens.admin = TokenService.generateTokenPair({ id: 'p1-admin', email: 'admin@p1.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `P1 ${show.slice(0, 8)}`, slug: `p1-${show.slice(0, 8)}` });
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, base_still_url, generation_status, created_at, updated_at)
               VALUES (:set, 'P1 set', 'EVENT_LOCATION', :show, 'https://x/p1.jpg', 'complete', NOW(), NOW())`, { set, show });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:episode, :show, 'P1 episode', :n, 'draft', NOW(), NOW())`, { episode, show, n: Math.floor(Math.random() * 100000) + 500 });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, used_in_episode_id, created_at, updated_at)
               VALUES (:event, :show, 'P1 linked event', 'invite', 'used', 5, :episode, NOW(), NOW()),
                      (:otherEvent, :show, 'P1 free event', 'invite', 'ready', 5, NULL, NOW(), NOW())`, { event, otherEvent, show, episode });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, narrative_purpose, created_at, updated_at)
               VALUES (gen_random_uuid(), :episode, :show, :event, 'draft', 'as seeded', NOW(), NOW())`, { episode, show, event });
    for (const b of [1, 2]) {
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, sort_order, locked, ai_suggested, created_at, updated_at)
                 VALUES (gen_random_uuid(), :episode, :b, :name, NULL, NULL, :b, false, true, NOW(), NOW())`, { episode, b, name: `Beat ${b}` });
    }
  });
  beforeEach(() => {
    ip += 1;
    mockCreate.mockReset();
    mockDesignTitleCard.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const q = (sql) => sequelize.query(sql, { replacements: { show } }).catch(() => {});
    await q('DELETE FROM scenes WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)');
    await q('DELETE FROM scene_plans WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)');
    await q('DELETE FROM scene_set_episodes WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)');
    await q('DELETE FROM episode_briefs WHERE show_id = :show');
    await q('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show');
    await q('DELETE FROM episodes WHERE show_id = :show');
    await q('DELETE FROM world_events WHERE show_id = :show');
    await q('DELETE FROM scene_sets WHERE show_id = :show');
    await q('DELETE FROM shows WHERE id = :show');
    await sequelize.close();
  });

  it('the table names twenty routes', () => {
    expect(ROUTES).toHaveLength(20);
    expect(new Set(ROUTES.map((r) => `${r[1]} ${r[2]}`)).size).toBe(20);
  });

  describe.each(ROUTES)('%s', (...route) => {
    it('signed out: 401, nothing written', async () => {
      const before = await snapshot();
      const trace = lockTrace.install(sequelize);
      let res;
      try { res = await send(null, route); } finally { trace.uninstall(); }
      expect(res.status).toBe(401);
      expect(writesIn(trace.records)).toEqual([]);
      expect(await snapshot()).toEqual(before);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it.each(['editor', 'viewer'])('signed in as %s, not an admin: 403 from authorize, no statement that writes, every row as it was, no AI call, no upload read', async (who) => {
      const before = await snapshot();
      const uploadSpy = jest.spyOn(multer.memoryStorage().constructor.prototype, '_handleFile');
      const trace = lockTrace.install(sequelize);
      let res;
      try { res = await send(who, route); } finally { trace.uninstall(); }
      expect(res.status).toBe(403);
      expect(res.body).toEqual(AUTHORIZE_BODY);
      expect(writesIn(trace.records)).toEqual([]);
      expect(await snapshot()).toEqual(before);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it('an admin is not stopped by the check', async () => {
      // What the route then does is its own suites' subject; here only that
      // an admin is never answered by authorize. Routes that would start or
      // replace an episode, or spend, are asked with a body they refuse.
      const harmless = {
        'generate-episode': { path: `${WORLD}/events/${uuid()}/generate-episode`, body: { draft_script: false } },
        'generate-episode-from-many': { body: { event_ids: [] } },
        'regenerate-episode': { path: `${WORLD}/events/${uuid()}/regenerate-episode` },
        inject: { path: `${WORLD}/events/${uuid()}/inject`, body: { episode_id: episode } },
        'scene-set-link': { path: `${WORLD}/events/${uuid()}/scene-set-link` },
        'detach-episode': { path: `${WORLD}/events/${uuid()}/detach-episode` },
        'look generate': { path: `${WORLD}/events/${uuid()}/look/generate` },
        'look upload': { path: `${WORLD}/events/${uuid()}/look/upload` },
        'generate-plan': { path: `/api/v1/episode-brief/${uuid()}/generate-plan` },
        'feed-moments retry': { path: `/api/v1/episode-brief/${uuid()}/feed-moments/retry` },
        'setup resume': { path: `/api/v1/episode-brief/${uuid()}/setup/resume` },
        'brief save': { path: `/api/v1/episode-brief/${uuid()}` },
        'brief lock': { path: `/api/v1/episode-brief/${uuid()}/lock` },
        'cover marks': { path: `/api/v1/episode-brief/${uuid()}/cover-marks` },
        'self-talk': { path: `/api/v1/episode-brief/${uuid()}/self-talk` },
        'beat save': { path: `/api/v1/episode-brief/${uuid()}/plan/1` },
        'beat lock': { path: `/api/v1/episode-brief/${uuid()}/plan/1/lock` },
        'lock-all': { path: `/api/v1/episode-brief/${uuid()}/plan/lock-all` },
        'studio beat angle': { path: `/api/v1/scene-studio-episodes/${uuid()}/beat/1/angle` },
        'studio beat scene-set': { path: `/api/v1/scene-studio-episodes/${uuid()}/beat/1/scene-set` },
      }[route[0]];
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await send('admin', [route[0], route[1], harmless.path || route[2], harmless.body !== undefined ? harmless.body : route[3], route[4]]);
      expect(res.status).not.toBe(401);
      expect(res.body.code).not.toBe('AUTH_GROUP_REQUIRED');
      expect(res.body).not.toEqual(AUTHORIZE_BODY);
    });
  });

  describe('the title overlay route: clearing a stale episode link is an admin\'s', () => {
    const gone = uuid();
    const url = `${WORLD}/episodes/${gone}/generate-title-overlay`;
    const stale = uuid();
    const notFound = () => Object.assign(new Error('Episode not found'), { code: 'EPISODE_NOT_FOUND' });
    const linkOf = async () => (await rows('SELECT used_in_episode_id FROM world_events WHERE id = :stale', { stale }))[0].used_in_episode_id;

    beforeAll(async () => {
      // An event whose link names an episode that is not there. The column
      // has no foreign key to hold it, as the route's own comment says.
      await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, used_in_episode_id, created_at, updated_at)
                 VALUES (:stale, :show, 'P1 stale link', 'invite', 'used', 5, :gone, NOW(), NOW())`, { stale, show, gone });
    });

    it.each(['editor', 'viewer'])('%s: the 404, and the link is left as it is (no statement that writes)', async (who) => {
      mockDesignTitleCard.mockRejectedValue(notFound());
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const trace = lockTrace.install(sequelize);
      let res;
      try { res = await as(who)(request(app).post(url)).send({}); } finally { trace.uninstall(); }
      expect(res.status).toBe(404);
      expect(res.body.stale_link_cleared).toBeUndefined();
      expect(res.body.error).not.toMatch(/cleared/i);
      expect(writesIn(trace.records)).toEqual([]);
      expect(await linkOf()).toBe(gone);
    });

    it('signed out: 401, the link untouched', async () => {
      const res = await as(null)(request(app).post(url)).send({});
      expect(res.status).toBe(401);
      expect(mockDesignTitleCard).not.toHaveBeenCalled();
      expect(await linkOf()).toBe(gone);
    });

    it('an admin: the 404 and the stale link cleared, as before', async () => {
      mockDesignTitleCard.mockRejectedValue(notFound());
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await as('admin')(request(app).post(url)).send({});
      expect(res.status).toBe(404);
      expect(res.body.stale_link_cleared).toBe(true);
      expect(await linkOf()).toBeNull();
    });
  });
});

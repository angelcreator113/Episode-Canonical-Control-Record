/**
 * ADMIN by default for every state-changing API request (Evoni's rulings of
 * 2026-11-15; src/middleware/adminWriteGuard.js, src/config/writeGuardManifest.js).
 *
 * The app's own mounts are recorded as it loads, so the test knows every
 * route by its mounted path, the legacy /api/* routers and the controllers
 * included. Then, with the guard enforcing:
 *   - every mounted write route is refused for a request with no token (401),
 *     a viewer and an editor (403), unless the manifest names it;
 *   - every manifest entry is one mounted route, and still makes its own check;
 *   - a refused write changes no row and calls no AI provider;
 *   - reads, HEAD and OPTIONS are untouched; an ADMIN gets through;
 *   - off does nothing; report refuses nothing and logs what it would refuse.
 */
jest.unmock('uuid');

// The AI client, so a call to a provider would be seen.
const mockAiCreate = jest.fn(async () => ({ content: [{ type: 'text', text: '{}' }], usage: { input_tokens: 1, output_tokens: 1 } }));
jest.mock('@anthropic-ai/sdk', () => {
  const Client = function Anthropic() { return { messages: { create: mockAiCreate, stream: mockAiCreate } }; };
  Client.default = Client; Client.Anthropic = Client;
  return Client;
});

const express = require('express');

// Record where each router is mounted, before the app loads: Express keeps a matcher, not the path.
const MOUNTS = Symbol.for('test.mountPaths');
const record = (args) => {
  const first = args[0];
  const paths = typeof first === 'string' ? [first] : (Array.isArray(first) && first.every((p) => typeof p === 'string') ? first : ['']);
  for (const fn of args.flat()) {
    if (typeof fn === 'function' && Array.isArray(fn.stack)) fn[MOUNTS] = [...(fn[MOUNTS] || []), ...paths];
  }
};
const appUse = express.application.use;
express.application.use = function use(...args) { record(args); return appUse.apply(this, args); };
const routerProto = Object.getPrototypeOf(express.Router());
const routerUse = routerProto.use;
routerProto.use = function use(...args) { record(args); return routerUse.apply(this, args); };

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { WRITE_GUARD_EXCEPTIONS } = require('../../src/config/writeGuardManifest');
const guard = require('../../src/middleware/adminWriteGuard');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const WRITE_METHODS = ['post', 'put', 'patch', 'delete'];

/** Every mounted route: { method, path } with its full mounted path. */
function mountedRoutes() {
  const out = [];
  const unknown = [];
  const walk = (stack, prefix) => {
    for (const layer of stack) {
      if (layer.route) {
        const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
        for (const p of paths) {
          const methods = layer.route.methods._all ? [...WRITE_METHODS, 'get'] : Object.keys(layer.route.methods);
          // A route by pattern, not by path (the preflight and the page catch-alls): it must not be a write.
          if (typeof p !== 'string') { if (methods.some((m) => WRITE_METHODS.includes(m))) unknown.push(`${prefix} ${String(p)}`); continue; }
          for (const m of methods) out.push({ method: m.toUpperCase(), path: `${prefix}${p === '/' ? '' : p}` || '/' });
        }
      } else if (layer.handle && Array.isArray(layer.handle.stack)) {
        const mounts = layer.handle[MOUNTS] || [''];
        for (const m of [...new Set(mounts)]) walk(layer.handle.stack, `${prefix}${m === '/' ? '' : m}`);
      }
    }
  };
  walk((app.router || app._router).stack, '');
  return { routes: out, unknown };
}

const fill = (path) => path.replace(/:([A-Za-z0-9_]+)\??/g, (_, name) => (/profile|slot|number|index|order/i.test(name) ? '2147480001' : crypto.randomUUID()));
const sameRoute = (entry, route) => entry.method === route.method && entry.path === route.path;

(shouldSkip ? describe.skip : describe)('ADMIN by default for every state-changing API request', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const tokens = {};
  const saved = process.env.ADMIN_WRITE_GUARD;
  let ipN = 0;
  let all;
  let writes;

  const send = (who, method, path, body) => {
    ipN += 1;
    let r = request(app)[method.toLowerCase()](path).set('X-Forwarded-For', `198.19.${Math.floor(ipN / 250) % 250}.${(ipN % 250) + 1}`);
    if (tokens[who]) r = r.set('Authorization', `Bearer ${tokens[who]}`);
    return body === undefined ? r : r.send(body);
  };
  const mode = (value) => { if (value === undefined) delete process.env.ADMIN_WRITE_GUARD; else process.env.ADMIN_WRITE_GUARD = value; };

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@guard.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    all = mountedRoutes();
    writes = all.routes.filter((r) => WRITE_METHODS.includes(r.method.toLowerCase()));
  });

  beforeEach(() => { mode('enforce'); mockAiCreate.mockClear(); });
  afterAll(() => { mode(saved); express.application.use = appUse; routerProto.use = routerUse; });

  describe('the helpers', () => {
    test('the setting: unset or off does nothing, report only reports, anything else enforces', () => {
      expect([undefined, '', 'off', ' OFF '].map((v) => guard.modeOf(v))).toEqual(['off', 'off', 'off', 'off']);
      expect(guard.modeOf('report')).toBe('report');
      expect(['enforce', 'ENFORCE', 'on', 'true', 'reprot', '1'].map((v) => guard.modeOf(v))).toEqual(Array(6).fill('enforce'));
    });

    test('a manifest route is matched exactly: same method, same segments, one segment per parameter', () => {
      const one = [{ method: 'POST', path: '/api/v1/public/polls/:id/vote' }];
      const hit = (m, p) => Boolean(guard.exceptionFor(m, p, one));
      expect(hit('POST', '/api/v1/public/polls/abc/vote')).toBe(true);
      expect(hit('post', '/api/v1/public/polls/abc/vote')).toBe(true);
      for (const [m, p] of [
        ['PUT', '/api/v1/public/polls/abc/vote'], ['DELETE', '/api/v1/public/polls/abc/vote'],
        ['POST', '/api/v1/public/polls/abc/vote/more'], ['POST', '/api/v1/public/polls/abc'], ['POST', '/api/v1/public/polls//vote'],
        ['POST', '/api/v1/public/polls/a/b/vote'], ['POST', '/API/v1/public/polls/abc/vote'], ['POST', '/api/v1/public/polls/abc/VOTE'],
        ['POST', '/x/api/v1/public/polls/abc/vote'], ['POST', '/api/v1/public/polls/abc/vote.json'],
      ]) expect([m, p, hit(m, p)]).toEqual([m, p, false]);
    });

    test('the path is read without its query or a trailing slash; a logged path carries no id', () => {
      expect(guard.pathOf({ originalUrl: '/api/v1/auth/login?x=/api/v1/public/polls/a/vote' })).toBe('/api/v1/auth/login');
      expect(guard.pathOf({ originalUrl: '/api/v1/auth/login/' })).toBe('/api/v1/auth/login');
      expect(guard.maskedPath(`/api/v1/feed-posts/${crypto.randomUUID()}/comments/12`)).toBe('/api/v1/feed-posts/:id/comments/:n');
    });
  });

  describe('what is mounted', () => {
    test('the walk finds the app\'s routes, the legacy routers and the controllers among them', () => {
      expect(all.unknown).toEqual([]);
      expect(writes.length).toBeGreaterThan(1200);
      const has = (method, path) => writes.some((r) => r.method === method && r.path === path);
      expect(has('POST', '/api/v1/feed-posts')).toBe(true);
      expect(has('PUT', '/api/v1/world/characters/:id')).toBe(true);
      expect(has('POST', '/api/v1/notifications/:id/read')).toBe(true);
      expect(writes.some((r) => /^\/api\/(youtube|scripts|scene-links|footage|decision-analytics)(\/|$)/.test(r.path))).toBe(true);
    });

    test('every write route is mounted under /api, where the guard is (the queue monitor aside, which is an ADMIN\'s at its mount)', () => {
      const outside = writes.filter((r) => !r.path.startsWith('/api/') && !r.path.startsWith('/admin/queues'));
      expect(outside).toEqual([]);
    });

    test('each manifest entry is exactly one mounted write route, with a reason and the check it keeps', () => {
      for (const entry of WRITE_GUARD_EXCEPTIONS) {
        expect([entry.path, writes.filter((r) => sameRoute(entry, r)).length]).toEqual([entry.path, 1]);
        expect(entry.why).toEqual(expect.any(String));
        expect(entry.keeps).toEqual(expect.any(String));
        expect(entry.path).not.toMatch(/[*(]|\/$/);
      }
      expect(WRITE_GUARD_EXCEPTIONS.map((e) => `${e.method} ${e.path}`)).toEqual([
        'POST /api/v1/auth/login', 'POST /api/v1/auth/refresh', 'POST /api/v1/auth/logout', 'POST /api/v1/auth/validate',
        'POST /api/v1/public/polls/:id/vote', 'POST /api/v1/teleprompter-remote/phone/commands',
      ]);
    });
  });

  describe('enforcing', () => {
    const guarded = () => writes.filter((r) => r.path.startsWith('/api/') && !WRITE_GUARD_EXCEPTIONS.some((e) => sameRoute(e, r)));

    test('no token: every write route answers 401', async () => {
      const wrong = [];
      for (const r of guarded()) {
        const res = await send('anon', r.method, fill(r.path), {});
        if (res.status !== 401) wrong.push(`${r.method} ${r.path} -> ${res.status}`);
      }
      expect(wrong).toEqual([]);
    }, 600000);

    test.each(['viewer', 'editor'])('%s: every write route answers 403', async (who) => {
      const wrong = [];
      for (const r of guarded()) {
        const res = await send(who, r.method, fill(r.path), {});
        if (res.status !== 403) wrong.push(`${r.method} ${r.path} -> ${res.status}`);
      }
      expect(wrong).toEqual([]);
      expect(mockAiCreate).not.toHaveBeenCalled();
    }, 600000);

    test('the manifest routes are let through to their own checks, which still refuse what they should', async () => {
      const refusedByGuard = (await send('anon', 'POST', '/api/v1/feed-posts', {})).body;
      // Sign-in routes answer for themselves (a bad request, not the guard's refusal).
      for (const path of ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/validate']) {
        const res = await send('anon', 'POST', path, {});
        expect([path, res.status === 403, JSON.stringify(res.body) === JSON.stringify(refusedByGuard)]).toEqual([path, false, false]);
      }
      // A vote on a poll that does not exist is the route's own answer, signed in or not.
      for (const who of ['anon', 'viewer']) {
        const res = await send(who, 'POST', `/api/v1/public/polls/${crypto.randomUUID()}/vote`, { option_id: crypto.randomUUID() });
        expect([401, 403]).not.toContain(res.status);
      }
      // The phone remote still needs its own token.
      const phone = await send('anon', 'POST', '/api/v1/teleprompter-remote/phone/commands', { command: 'play' });
      expect(phone.status).not.toBe(403);
      expect(JSON.stringify(phone.body)).not.toBe(JSON.stringify(refusedByGuard));
      expect([200, 201]).not.toContain(phone.status);
    });

    test('a manifest route is not a prefix: a neighbouring path, another method or other casing is refused', async () => {
      for (const [method, path] of [
        ['POST', '/api/v1/auth/login/extra'], ['PUT', '/api/v1/auth/login'], ['DELETE', '/api/v1/auth/logout'],
        ['POST', `/api/v1/public/polls/${crypto.randomUUID()}/vote/again`], ['PUT', `/api/v1/public/polls/${crypto.randomUUID()}/vote`],
        ['POST', '/api/v1/teleprompter-remote/phone/commands/x'], ['DELETE', '/api/v1/teleprompter-remote/phone/commands'],
        ['POST', '/API/V1/AUTH/LOGIN'], ['POST', '/api/v1/public/polls'],
      ]) {
        const res = await send('viewer', method, path, {});
        expect([method, path, res.status]).toEqual([method, path, 403]);
      }
    });

    test('a refused write changes no row and calls no AI provider', async () => {
      const showId = crypto.randomUUID();
      await sequelize.query('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:showId, :name, :slug, NOW(), NOW())',
        { replacements: { showId, name: `Guard ${tag}`, slug: `guard-${tag}` } });
      try {
        const post = await models.FeedPost.create({ show_id: showId, poster_handle: 'someone.else', content_text: 'As it was', status: 'draft', poster_platform: 'lalaverse', post_type: 'post' });
        const snapshot = async () => {
          const [[p]] = await sequelize.query('SELECT content_text, status, deleted_at, tags::text AS tags, updated_at FROM feed_posts WHERE id = :id', { replacements: { id: post.id } });
          const count = async (table) => (await sequelize.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE show_id = :showId`, { replacements: { showId } }))[0][0].n;
          const [[s]] = await sequelize.query('SELECT name, updated_at FROM shows WHERE id = :showId', { replacements: { showId } });
          return JSON.stringify({ p, s, posts: await count('feed_posts'), comments: await count('feed_comments'), events: await count('world_events'), episodes: await count('episodes') });
        };
        const before = await snapshot();
        for (const who of ['anon', 'viewer', 'editor']) {
          const attempts = [
            ['PUT', `/api/v1/feed-posts/${post.id}`, { status: 'live', content_text: 'Changed' }],
            ['PUT', `/api/v1/feed-posts/${post.id}/tags`, { tags: ['x'] }],
            ['POST', `/api/v1/feed-posts/${post.id}/comments`, { handle: 'x', text: 'y', status: 'live' }],
            ['POST', `/api/v1/feed-posts/${post.id}/redraft`, {}],
            ['POST', `/api/v1/feed-posts/${post.id}/comments/draft`, {}],
            ['DELETE', `/api/v1/feed-posts/${post.id}`, undefined],
            ['POST', '/api/v1/feed-posts', { show_id: showId, content_text: 'New', status: 'live' }],
            ['PUT', `/api/v1/shows/${showId}`, { name: 'Renamed' }],
            ['DELETE', `/api/v1/shows/${showId}`, undefined],
            ['POST', '/api/v1/episodes', { show_id: showId, title: 'New', episode_number: 1 }],
            ['POST', `/api/v1/world/${showId}/events`, { name: 'New event' }],
            ['POST', `/api/v1/feed-pipeline/${showId}/generate-opportunities`, {}],
            ['POST', '/api/v1/world/generate-ecosystem', { show_id: showId }],
          ];
          for (const [method, path, body] of attempts) {
            const res = await send(who, method, path, body);
            expect([who, method, path, res.status]).toEqual([who, method, path, who === 'anon' ? 401 : 403]);
          }
        }
        expect(await snapshot()).toBe(before);
        expect(mockAiCreate).not.toHaveBeenCalled();
      } finally {
        await sequelize.query('DELETE FROM feed_comments WHERE show_id = :showId', { replacements: { showId } });
        await sequelize.query('DELETE FROM feed_posts WHERE show_id = :showId', { replacements: { showId } });
        await sequelize.query('DELETE FROM shows WHERE id = :showId', { replacements: { showId } });
      }
    });

    test('an ADMIN is let through to the route (its own validation answers)', async () => {
      const res = await send('admin', 'POST', '/api/v1/feed-posts', {});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('show_id is required');
      const missing = await send('admin', 'DELETE', `/api/v1/feed-posts/${crypto.randomUUID()}`);
      expect(missing.status).toBe(404);
    });

    test('reads, HEAD and OPTIONS are untouched', async () => {
      expect((await send('anon', 'GET', '/api/v1/public/polls')).status).toBe(200);
      expect((await send('viewer', 'GET', '/api/v1/feed-posts/places')).status).toBe(200);
      expect((await send('anon', 'HEAD', '/api/v1/public/polls')).status).toBe(200);
      const preflight = await request(app).options('/api/v1/feed-posts')
        .set('Origin', 'http://localhost:5174').set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'authorization,content-type');
      expect([200, 204]).toContain(preflight.status);
      expect(preflight.headers['access-control-allow-methods'] || '').toMatch(/POST/);
    });

    test('a write route added later is an ADMIN\'s without being told', async () => {
      const later = express();
      const ran = jest.fn((req, res) => res.json({ ran: true }));
      later.use('/api', guard.adminWriteGuard);
      const router = express.Router();
      router.post('/brand-new/:id', ran);                 // no auth middleware at all
      router.get('/brand-new/:id', (req, res) => res.json({ read: true }));
      later.use('/api/v1', router);
      const call = (method, token) => {
        const r = request(later)[method]('/api/v1/brand-new/1');
        return token ? r.set('Authorization', `Bearer ${token}`) : r;
      };
      expect((await call('post')).status).toBe(401);
      expect((await call('post', tokens.viewer)).status).toBe(403);
      expect((await call('post', tokens.editor)).status).toBe(403);
      expect(ran).not.toHaveBeenCalled();
      expect((await call('post', tokens.admin)).body).toEqual({ ran: true });
      expect((await call('get')).body).toEqual({ read: true });
    });

    test('a setting that is not one of the three words enforces', async () => {
      mode('reprot');
      expect((await send('viewer', 'POST', '/api/v1/feed-posts', {})).status).toBe(403);
    });
  });

  describe('off and report', () => {
    test('off (and unset): nothing is refused by the guard; the route answers as before', async () => {
      for (const value of ['off', undefined]) {
        mode(value);
        const res = await send('viewer', 'POST', '/api/v1/feed-posts', {});
        expect(res.status).toBe(400);
        expect((await send('anon', 'POST', '/api/v1/feed-posts', {})).status).toBe(401);   // the route's own sign-in check
      }
    });

    test('report: nothing is refused; what would be is logged with no id and no person', async () => {
      mode('report');
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const id = crypto.randomUUID();
        const viewer = await send('viewer', 'PUT', `/api/v1/feed-posts/${id}/tags`, { tags: [] });
        expect(viewer.status).toBe(404);                       // reached the route: the post does not exist
        await send('anon', 'POST', '/api/v1/feed-posts', {});
        await send('admin', 'POST', '/api/v1/feed-posts', {});
        await send('anon', 'POST', '/api/v1/auth/validate', {});
        await send('anon', 'GET', '/api/v1/public/polls');
        const lines = warn.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith('[write-guard]'));
        expect(lines).toEqual([
          '[write-guard] would refuse PUT /api/v1/feed-posts/:id/tags (403)',
          '[write-guard] would refuse POST /api/v1/feed-posts (401)',
        ]);
        expect(lines.join(' ')).not.toContain(id);
        expect(lines.join(' ')).not.toMatch(/guard\.dev|viewer-|Bearer/);
      } finally { warn.mockRestore(); }
    });
  });
});

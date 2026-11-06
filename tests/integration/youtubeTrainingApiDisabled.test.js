/**
 * P0-0 security containment (2026-11-06): the YouTube training API is
 * disabled. youtubeService passed the request's URL into a shell command
 * (decision pack SAFETY-TRIAGE S1). Every /api/youtube request, signed out,
 * signed in or admin, is answered 410 before any route code or the service
 * loads. No request here carries anything but a plain YouTube URL; the
 * service is never reached.
 */
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');

const ROOT = path.join(__dirname, '../..');
const token = (role) => TokenService.generateTokenPair({
  id: `yt-containment-${role}`, email: `${role}@yt-containment.dev`, name: role,
  groups: role === 'admin' ? ['ADMIN'] : ['USER'], role: role === 'admin' ? 'ADMIN' : 'USER',
}).accessToken;

const URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const ID = '00000000-0000-4000-8000-000000000000';
// Every route the router defined (src/routes/youtube.js), plus an unknown sub-path.
const ROUTES = [
  ['get', `/api/youtube/metadata?url=${encodeURIComponent(URL)}`],
  ['post', '/api/youtube/analyze', { url: URL, detect_scenes: true }],
  ['post', `/api/youtube/${ID}/detect-scenes`, {}],
  ['get', '/api/youtube/library'],
  ['get', `/api/youtube/${ID}`],
  ['get', `/api/youtube/${ID}/scenes`],
  ['delete', `/api/youtube/${ID}`],
  ['get', '/api/youtube'],
  ['put', '/api/youtube/anything/else', {}],
];
const CALLERS = { 'signed out': null, 'signed in (not admin)': 'user', admin: 'admin' };

describe('YouTube training API is disabled', () => {
  beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
  afterAll(() => jest.restoreAllMocks());

  for (const [who, role] of Object.entries(CALLERS)) {
    // Named rows: a positional third argument would collide with Jest's done callback.
    const rows = ROUTES.map(([method, url, body]) => ({ method, url, body }));
    test.each(rows)(`${who}: $method $url answers 410 YOUTUBE_TRAINING_DISABLED`, async ({ method, url, body }) => {
      let req = request(app)[method](url);
      if (role) req = req.set('Authorization', `Bearer ${token(role)}`);
      const res = body ? await req.send(body) : await req;
      expect(res.status).toBe(410);
      expect(res.body).toMatchObject({ code: 'YOUTUBE_TRAINING_DISABLED' });
    });
  }

  test('neither the router nor the service is loaded by the app', () => {
    const loaded = Object.keys(require.cache);
    expect(loaded.some((f) => f.endsWith(path.join('src', 'routes', 'youtube.js')))).toBe(false);
    expect(loaded.some((f) => f.endsWith(path.join('src', 'services', 'youtubeService.js')))).toBe(false);
  });

  test('YouTube distribution and thumbnail routes are not caught by the block', async () => {
    // Signed out, the thumbnail templates route answers its own 401, not the block's 410.
    const res = await request(app).get('/api/v1/youtube-thumbnails/templates');
    expect(res.status).toBe(401);
    expect(res.body?.code).not.toBe('YOUTUBE_TRAINING_DISABLED');
  });

  test('no other source file mounts the router or imports the service', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.js')) {
          const rel = path.relative(ROOT, p);
          const src = fs.readFileSync(p, 'utf8');
          if (/require\(\s*['"][./]*(routes\/)?youtube['"]\s*\)/.test(src)) offenders.push(`${rel}: requires the youtube router`);
          if (/youtubeService['"]\s*\)/.test(src) && rel !== path.join('src', 'routes', 'youtube.js')) offenders.push(`${rel}: requires youtubeService`);
        }
      }
    };
    walk(path.join(ROOT, 'src'));
    expect(offenders).toEqual([]);
  });
});

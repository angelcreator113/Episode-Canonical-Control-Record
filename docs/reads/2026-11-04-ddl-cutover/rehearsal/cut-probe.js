// node cut-probe.js <code dir> : calls the affected routes as the app role (DATABASE_URL), prints status per route.
const dir = process.argv[2];
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long-for-security';
process.env.TOKEN_ISSUER = 'episode-metadata-api'; process.env.TOKEN_AUDIENCE = 'episode-metadata-app';
process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
const origLog = console.log; const origWarn = console.warn; const origErr = console.error;
const errs = [];
console.log = () => {}; console.warn = () => {}; console.error = (...a) => errs.push(a.map(String).join(' '));
const app = require(`${dir}/src/app`);
const request = require(`${dir}/node_modules/supertest`);
const token = require(`${dir}/src/services/tokenService`).generateTokenPair({ id: 'probe', email: 'p@p.dev', name: 'p', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
const ch = '11111111-1111-4111-8111-111111111111'; const ep = '22222222-2222-4222-8222-222222222222';
const routes = [
  ['GET', `/api/v1/story-health/versions/chapter/${ch}`],
  ['POST', `/api/v1/story-health/versions/chapter/${ch}`, { content: 'a b', reason: 'probe' }],
  ['GET', `/api/v1/episodes/${ep}/video-compositions`],
  ['GET', '/api/v1/continuity/timelines'],
  ['GET', '/api/v1/world/previews'],
  ['GET', '/api/v1/franchise-brain/documents'],
  ['GET', `/api/v1/scene-sets/jobs/set/${ep}`],
];
(async () => {
  const out = [];
  for (const [m, u, body] of routes) {
    let r = request(app)[m.toLowerCase()](u).set('Authorization', `Bearer ${token}`);
    if (body) r = r.send(body);
    const res = await Promise.race([r, new Promise((ok) => setTimeout(() => ok({ status: 'TIMEOUT', body: {} }), 8000))]);
    const why = res.status >= 500 ? ` (${JSON.stringify(res.body).slice(0, 70)})` : '';
    out.push(`${m} ${u.replace(ch, ':ch').replace(ep, ':ep')} -> ${res.status}${why}`);
  }
  origLog(out.join('\n'));
  process.exit(0);
})();

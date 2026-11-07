/**
 * Issue #3714: the episode worker starts only when GENERATION_WORKER_ENABLED
 * is "true" (default off). In production (Option B) it reads its own login
 * from its mode-600 credential file, holds it in memory only, and refuses
 * (exit 78) when a database password is in its environment, when the file is
 * missing or unsafe, or when the login is postgres. There is no fallback to
 * the API's login. A disabled or refused worker loads nothing that touches
 * the database, Redis or an AI provider.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const mockLoaded = [];
jest.mock('../../../src/models', () => { mockLoaded.push('models'); return {}; });
jest.mock('../../../src/workers/videoRenderer', () => { mockLoaded.push('videoRenderer'); return {}; });
jest.mock('../../../src/workers/sceneGenerationWorker', () => {
  mockLoaded.push('sceneGenerationWorker');
  return { start: jest.fn(), stop: jest.fn() };
});

const { decideStartup, scrubDbEnv, EXIT_CONFIG, FORBIDDEN_ENV_SECRETS } = require('../../../src/workers/workerStartup');
const { main } = require('../../../src/workers/start');
const { getDbCredentials, clearDbCredentials } = require('../../../src/config/dbCredentials');

const quiet = { log: () => {}, warn: () => {}, error: () => {} };
const SECRET = 'startup-secret-71c2';
let dir;
let credFile;

function writeCred(content, mode = 0o600) {
  const p = path.join(dir, `c${Math.random().toString(36).slice(2)}.env`);
  fs.writeFileSync(p, content, { mode });
  fs.chmodSync(p, mode);
  return p;
}
const prod = (extra = {}) => ({ NODE_ENV: 'production', WORKER_DB_REQUIRED: 'true', DB_USER: '', DB_PASSWORD: '', WORKER_DB_CREDENTIALS_FILE: credFile, ...extra });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-start-'));
  credFile = writeCred(`WORKER_DB_USER=episode_worker\nWORKER_DB_PASSWORD=${SECRET}\n`);
  clearDbCredentials();
  mockLoaded.length = 0;
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  clearDbCredentials();
});

describe('decideStartup', () => {
  test.each([
    [{}],
    [{ GENERATION_WORKER_ENABLED: 'false' }],
    [{ GENERATION_WORKER_ENABLED: '1' }],
    [{ GENERATION_WORKER_ENABLED: 'yes' }],
    [{ GENERATION_WORKER_ENABLED: '' }],
  ])('disabled unless exactly "true": %j', (env) => {
    expect(decideStartup(prod(env)).action).toBe('disabled');
    expect(decideStartup({ NODE_ENV: 'development', ...env }).action).toBe('disabled');
  });

  test('"TRUE" and " true " count as true', () => {
    for (const v of ['TRUE', ' true ']) expect(decideStartup(prod({ GENERATION_WORKER_ENABLED: v })).action).toBe('run');
  });

  test('production: the login comes from the file, not the environment', () => {
    const d = decideStartup(prod({ GENERATION_WORKER_ENABLED: 'true' }));
    expect(d).toEqual({ action: 'run', identity: 'worker', credentials: { user: 'episode_worker', password: SECRET } });
  });

  test.each(FORBIDDEN_ENV_SECRETS.map((k) => [k]))('production: %s in the environment is refused, enabled or not', (key) => {
    for (const enabled of ['true', 'false']) {
      const d = decideStartup(prod({ GENERATION_WORKER_ENABLED: enabled, [key]: 'leaked-value' }));
      expect(d.action).toBe('refuse');
      expect(d.message).toContain(key);
      expect(d.message).not.toContain('leaked-value');
    }
  });

  test('a stale pm2 saved env (NODE_ENV production, the old postgres password, no new keys) is refused', () => {
    const d = decideStartup({ NODE_ENV: 'production', DB_USER: 'postgres', DB_PASSWORD: 'old-master' });
    expect(d.action).toBe('refuse');
    expect(d.message).not.toContain('old-master');
  });

  test.each([
    ['the file is missing', () => ({ WORKER_DB_CREDENTIALS_FILE: path.join(dir, 'none.env') }), /cannot be found/],
    ['the file is mode 644', () => ({ WORKER_DB_CREDENTIALS_FILE: writeCred('WORKER_DB_USER=episode_worker\nWORKER_DB_PASSWORD=x\n', 0o644) }), /exactly 600/],
    ['the file names postgres', () => ({ WORKER_DB_CREDENTIALS_FILE: writeCred('WORKER_DB_USER=postgres\nWORKER_DB_PASSWORD=x\n') }), /master login/],
    ['the file has no password', () => ({ WORKER_DB_CREDENTIALS_FILE: writeCred('WORKER_DB_USER=episode_worker\n') }), /missing WORKER_DB_PASSWORD/],
    ['NODE_ENV is not production', () => ({ NODE_ENV: 'development' }), /NODE_ENV=production/],
  ])('production, enabled: refused when %s', (_label, extra, re) => {
    const d = decideStartup(prod({ GENERATION_WORKER_ENABLED: 'true', ...extra() }));
    expect(d.action).toBe('refuse');
    expect(d.message).toMatch(re);
    expect(d.message).not.toContain(SECRET);
  });

  test('the file is not read while disabled', () => {
    const fakeFs = { ...fs, lstatSync: () => { throw new Error('read'); } };
    expect(decideStartup(prod({ WORKER_DB_CREDENTIALS_FILE: path.join(dir, 'none.env') }), { fs: fakeFs }).action).toBe('disabled');
  });

  test('development: keeps the shared DB_* settings, as before', () => {
    expect(decideStartup({ GENERATION_WORKER_ENABLED: 'true', NODE_ENV: 'development', DB_PASSWORD: 'dev' }))
      .toEqual({ action: 'run', identity: 'shared', credentials: null });
  });

  test('scrubDbEnv drops every login key, even empty ones', () => {
    const env = { DB_USER: '', DB_PASSWORD: '', DB_USERNAME: 'x', DATABASE_URL: '', PGPASSWORD: '', WORKER_DB_USER: '', WORKER_DB_PASSWORD: '', DB_HOST: 'h' };
    scrubDbEnv(env);
    expect(env).toEqual({ DB_HOST: 'h' });
  });
});

describe('start.js main', () => {
  test('disabled: no model, renderer or scene worker is loaded; it only waits', () => {
    const keepAlive = jest.fn(() => 'timer');
    const exit = jest.fn();
    const r = main(prod(), { ...quiet, keepAlive, exit });
    expect(r).toEqual({ action: 'disabled', timer: 'timer' });
    expect(keepAlive).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
    expect(mockLoaded).toEqual([]);
    expect(getDbCredentials()).toBeNull();
  });

  test.each([
    ['a password in the environment', { GENERATION_WORKER_ENABLED: 'true', DB_PASSWORD: 'api' }],
    ['a password in the environment, disabled', { DB_PASSWORD: 'api' }],
    ['an unsafe credential file', { GENERATION_WORKER_ENABLED: 'true', WORKER_DB_CREDENTIALS_FILE: '/nonexistent/worker.env' }],
  ])('refused (%s): exits 78 before loading anything', (_label, extra) => {
    const exit = jest.fn();
    const keepAlive = jest.fn();
    main(prod(extra), { ...quiet, exit, keepAlive });
    expect(exit).toHaveBeenCalledWith(EXIT_CONFIG);
    expect(EXIT_CONFIG).toBe(78);
    expect(keepAlive).not.toHaveBeenCalled();
    expect(mockLoaded).toEqual([]);
    expect(getDbCredentials()).toBeNull();
  });

  test('enabled: the login is held in memory before the workers load, and is in no environment key', () => {
    const env = prod({ GENERATION_WORKER_ENABLED: 'true' });
    const seen = [];
    const start = jest.fn();
    const r = main(env, {
      ...quiet,
      loadRenderer: () => seen.push(['renderer', getDbCredentials() && getDbCredentials().user]),
      loadSceneWorker: () => { seen.push(['scene', getDbCredentials() && getDbCredentials().user]); return { start, stop: jest.fn() }; },
    });
    expect(r.action).toBe('run');
    expect(seen).toEqual([['renderer', 'episode_worker'], ['scene', 'episode_worker']]);
    expect(start).toHaveBeenCalledTimes(1);
    expect(Object.values(env).some((v) => String(v).includes(SECRET))).toBe(false);
    for (const k of ['DB_USER', 'DB_PASSWORD', 'WORKER_DB_USER', 'WORKER_DB_PASSWORD']) expect(env).not.toHaveProperty(k);
  });

  test('the password never reaches the log', () => {
    const lines = [];
    const log = (...a) => lines.push(a.join(' '));
    main(prod({ GENERATION_WORKER_ENABLED: 'true' }), { log, warn: log, error: log, loadRenderer: () => {}, loadSceneWorker: () => ({ start: () => {}, stop: () => {} }) });
    expect(lines.join('\n')).not.toContain(SECRET);
  });
});

describe('config/sequelize.js production login', () => {
  const { setDbCredentials } = require('../../../src/config/dbCredentials');
  const saved = {};
  beforeEach(() => { for (const k of ['DB_USER', 'DB_PASSWORD', 'DB_USERNAME']) saved[k] = process.env[k]; });
  afterEach(() => { for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

  test('the held login wins; without one, DB_USER / DB_PASSWORD as before (API, migrations)', () => {
    const { production } = require('../../../src/config/sequelize');
    process.env.DB_USER = 'episode_app_dev';
    process.env.DB_PASSWORD = 'api-pass';
    expect([production.username, production.password]).toEqual(['episode_app_dev', 'api-pass']);
    setDbCredentials({ user: 'episode_worker', password: SECRET });
    expect([production.username, production.password]).toEqual(['episode_worker', SECRET]);
    clearDbCredentials();
    expect(production.username).toBe('episode_app_dev');
  });

  test('the held login is frozen and needs both values', () => {
    setDbCredentials({ user: 'episode_worker', password: SECRET });
    expect(Object.isFrozen(getDbCredentials())).toBe(true);
    expect(() => setDbCredentials({ user: 'episode_worker', password: '' })).toThrow();
  });
});

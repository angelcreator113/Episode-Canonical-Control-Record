/**
 * Issue #3714 (Option B): the read-only preflight's settings. It takes the
 * worker's login only from the worker's credential file (the same loader the
 * worker uses), never DB_USER / DB_PASSWORD, never postgres; it refuses a
 * WORKER_DB_PASSWORD copy in the environment or .env; it reads .env without
 * loading it into the environment; and it keeps the password out of every
 * error (the catalog checks run against a real database in
 * tests/integration/workerRestrictedRole.integration.test.js).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadSettings, readSettingsEnv, readCredentials } = require('../../../scripts/worker/check-db-access');

const SECRET = 'preflight-secret-5d1e';
const base = { DB_HOST: 'db.internal', DB_NAME: 'episode_metadata' };
const creds = { user: 'episode_worker', password: SECRET };
let dir;

beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-pre-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('check-db-access loadSettings', () => {
  test('uses the credential file login, never DB_USER / DB_PASSWORD', () => {
    const s = loadSettings({ ...base, DB_USER: 'episode_app_dev', DB_PASSWORD: 'api-pass' }, creds);
    expect(s.error).toBeUndefined();
    expect(s.config).toMatchObject({ user: 'episode_worker', password: SECRET, database: 'episode_metadata', port: 5432 });
    expect(JSON.stringify(s)).not.toContain('api-pass');
  });

  test.each([['DB_HOST'], ['DB_NAME']])('stops when %s is missing', (key) => {
    const env = { ...base };
    delete env[key];
    const s = loadSettings(env, creds);
    expect(s.error).toContain(key);
    expect(s.config).toBeUndefined();
  });

  test('stops when the credential file was refused, naming the rule, not a value', () => {
    const s = loadSettings(base, { error: "the credential file's permissions are 644; they must be exactly 600" });
    expect(s.error).toMatch(/credential file: .*exactly 600/);
    expect(s.config).toBeUndefined();
  });

  test('a WORKER_DB_PASSWORD in the environment or .env is a stale copy: refused', () => {
    const s = loadSettings({ ...base, WORKER_DB_PASSWORD: 'stale-copy' }, creds);
    expect(s.error).toMatch(/remove that copy/);
    expect(s.error).not.toContain('stale-copy');
  });

  test('refuses the postgres login', () => {
    expect(loadSettings(base, { user: 'postgres', password: 'x' }).error).toMatch(/master login/);
  });

  test('TLS is on unless DB_SSL is "false"; certificate checking follows DB_SSL_REJECT_UNAUTHORIZED', () => {
    expect(loadSettings(base, creds).config.ssl).toEqual({ rejectUnauthorized: false });
    expect(loadSettings({ ...base, DB_SSL_REJECT_UNAUTHORIZED: 'true' }, creds).config.ssl).toEqual({ rejectUnauthorized: true });
    expect(loadSettings({ ...base, DB_SSL: 'false' }, creds).config.ssl).toBe(false);
  });

  test('error messages name what is missing, not values', () => {
    const s = loadSettings({ DB_HOST: 'db.internal' }, creds);
    expect(s.error).not.toContain(SECRET);
    expect(s.error).not.toContain('db.internal');
  });
});

describe('check-db-access readSettingsEnv / readCredentials', () => {
  test('.env is parsed, not loaded into process.env, and the environment wins', () => {
    const envFile = path.join(dir, '.env');
    fs.writeFileSync(envFile, 'DB_HOST=from-file\nDB_NAME=episode_metadata\nDB_PASSWORD=api-pass\n');
    const before = { ...process.env };
    const env = readSettingsEnv({ DB_HOST: 'from-env' }, envFile);
    expect(env).toMatchObject({ DB_HOST: 'from-env', DB_NAME: 'episode_metadata' });
    expect(process.env).toEqual(before);
  });

  test('reads the file named by WORKER_DB_CREDENTIALS_FILE with the worker\'s loader', () => {
    const p = path.join(dir, 'w.env');
    fs.writeFileSync(p, `WORKER_DB_USER=episode_worker\nWORKER_DB_PASSWORD=${SECRET}\n`, { mode: 0o600 });
    expect(readCredentials({ WORKER_DB_CREDENTIALS_FILE: p })).toEqual(creds);
    fs.chmodSync(p, 0o640);
    const r = readCredentials({ WORKER_DB_CREDENTIALS_FILE: p });
    expect(r.error).toMatch(/exactly 600/);
    expect(JSON.stringify(r)).not.toContain(SECRET);
  });
});

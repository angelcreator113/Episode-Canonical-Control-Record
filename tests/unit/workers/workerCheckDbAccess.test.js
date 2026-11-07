/**
 * Issue #3714: the read-only preflight's settings. It connects only as the
 * worker's own login, never the API's, never postgres, and keeps the password
 * out of everything it prints (the catalog checks themselves run against a
 * real database in tests/integration/workerRestrictedRole.integration.test.js).
 */
const { loadSettings } = require('../../../scripts/worker/check-db-access');

const base = { DB_HOST: 'db.internal', DB_NAME: 'episode_metadata', WORKER_DB_USER: 'episode_worker', WORKER_DB_PASSWORD: 'w-pass' };

describe('check-db-access loadSettings', () => {
  test('uses WORKER_DB_*, never DB_USER / DB_PASSWORD', () => {
    const s = loadSettings({ ...base, DB_USER: 'episode_app_dev', DB_PASSWORD: 'api-pass' });
    expect(s.error).toBeUndefined();
    expect(s.config).toMatchObject({ user: 'episode_worker', password: 'w-pass', database: 'episode_metadata', port: 5432 });
    expect(JSON.stringify(s)).not.toContain('api-pass');
  });

  test.each([['WORKER_DB_USER'], ['WORKER_DB_PASSWORD'], ['DB_HOST'], ['DB_NAME']])('stops when %s is missing', (key) => {
    const env = { ...base, DB_USER: 'episode_app_dev', DB_PASSWORD: 'api-pass' };
    delete env[key];
    const s = loadSettings(env);
    expect(s.error).toContain(key);
    expect(s.config).toBeUndefined();
  });

  test('refuses the postgres login', () => {
    expect(loadSettings({ ...base, WORKER_DB_USER: 'postgres' }).error).toMatch(/master login/);
  });

  test('TLS is on unless DB_SSL is "false"; certificate checking follows DB_SSL_REJECT_UNAUTHORIZED', () => {
    expect(loadSettings(base).config.ssl).toEqual({ rejectUnauthorized: false });
    expect(loadSettings({ ...base, DB_SSL_REJECT_UNAUTHORIZED: 'true' }).config.ssl).toEqual({ rejectUnauthorized: true });
    expect(loadSettings({ ...base, DB_SSL: 'false' }).config.ssl).toBe(false);
  });

  test('error messages name what is missing, not values', () => {
    const s = loadSettings({ DB_HOST: 'db.internal', WORKER_DB_PASSWORD: 'w-pass' });
    expect(s.error).not.toContain('w-pass');
    expect(s.error).not.toContain('db.internal');
  });
});

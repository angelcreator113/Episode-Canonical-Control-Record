/**
 * Issue #3714: the pm2 configs and the deploy script around the worker.
 *   - production (ecosystem.config.js): the worker never carries the API's
 *     database login, requires its own, is disabled unless
 *     GENERATION_WORKER_ENABLED is exactly "true", keeps its pool under the
 *     role's limit, and is not restarted when refused for its settings; the
 *     API's settings are unchanged;
 *   - dev box (ecosystem.dev.config.js): the worker keeps running as before;
 *   - the Deploy workflow's restart still leaves a stopped worker stopped;
 *   - the voice worker is not in either config;
 *   - config/sequelize.js: DB_POOL_MAX sizes only the worker's pool.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../..');
const KEYS = ['DB_USER', 'DB_PASSWORD', 'WORKER_DB_USER', 'WORKER_DB_PASSWORD', 'GENERATION_WORKER_ENABLED', 'DB_POOL_MAX'];

function loadConfig(file, env) {
  const saved = {};
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, env);
  let config;
  jest.isolateModules(() => { config = require(path.join(ROOT, file)); });
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  return config;
}
const app = (config, name) => config.apps.find((a) => a.name === name);

describe('ecosystem.config.js (production)', () => {
  const env = { DB_USER: 'episode_app_dev', DB_PASSWORD: 'api-pass', WORKER_DB_USER: 'episode_worker', WORKER_DB_PASSWORD: 'worker-pass' };

  test('the worker carries its own login only, is required to, and is disabled by default', () => {
    const w = app(loadConfig('ecosystem.config.js', env), 'episode-worker');
    for (const block of [w.env, w.env_production]) {
      expect(block).toMatchObject({
        DB_USER: '', DB_PASSWORD: '',
        WORKER_DB_REQUIRED: 'true', WORKER_DB_USER: 'episode_worker', WORKER_DB_PASSWORD: 'worker-pass',
        GENERATION_WORKER_ENABLED: 'false', DB_POOL_MAX: '4',
      });
      expect(JSON.stringify(block)).not.toContain('api-pass');
    }
    expect(w.stop_exit_codes).toEqual([78]);
  });

  test.each([['true', 'true'], ['TRUE', 'false'], ['1', 'false'], ['', 'false']])('GENERATION_WORKER_ENABLED=%j gives %j', (value, expected) => {
    const w = app(loadConfig('ecosystem.config.js', { ...env, GENERATION_WORKER_ENABLED: value }), 'episode-worker');
    expect(w.env_production.GENERATION_WORKER_ENABLED).toBe(expected);
  });

  test('without WORKER_DB_* the worker gets empty values, never the API login', () => {
    const w = app(loadConfig('ecosystem.config.js', { DB_USER: 'episode_app_dev', DB_PASSWORD: 'api-pass' }), 'episode-worker');
    expect(w.env_production).toMatchObject({ DB_USER: '', DB_PASSWORD: '', WORKER_DB_USER: '', WORKER_DB_PASSWORD: '' });
  });

  test('the API is unchanged: its own login, no worker settings, its default pool', () => {
    const a = app(loadConfig('ecosystem.config.js', env), 'episode-api-prod-hotfix');
    for (const block of [a.env, a.env_production]) {
      expect(block).toMatchObject({ DB_USER: 'episode_app_dev', DB_PASSWORD: 'api-pass' });
      for (const k of ['WORKER_DB_USER', 'WORKER_DB_PASSWORD', 'WORKER_DB_REQUIRED', 'GENERATION_WORKER_ENABLED', 'DB_POOL_MAX']) {
        expect(block).not.toHaveProperty(k);
      }
    }
    expect(a.stop_exit_codes).toBeUndefined();
  });

  test('the voice worker is not in the production config (it is started only by hand)', () => {
    expect(loadConfig('ecosystem.config.js', env).apps.map((a) => a.name)).toEqual(['episode-api-prod-hotfix', 'episode-worker']);
  });
});

describe('ecosystem.dev.config.js (dev box)', () => {
  test('the dev worker keeps running on the shared dev login, unless switched off', () => {
    const w = app(loadConfig('ecosystem.dev.config.js', { DB_USER: 'episode_dev', DB_PASSWORD: 'dev' }), 'episode-worker');
    expect(w.env).toMatchObject({ GENERATION_WORKER_ENABLED: 'true', DB_USER: 'episode_dev' });
    expect(w.env).not.toHaveProperty('WORKER_DB_REQUIRED');
    const off = app(loadConfig('ecosystem.dev.config.js', { GENERATION_WORKER_ENABLED: 'false' }), 'episode-worker');
    expect(off.env.GENERATION_WORKER_ENABLED).toBe('false');
  });
});

describe('the Deploy workflow leaves a stopped worker stopped (unchanged)', () => {
  const script = fs.readFileSync(path.join(ROOT, 'scripts/deploy/workflow-deploy.sh'), 'utf8');

  test('the worker is restarted only when it was online before the deploy', () => {
    expect(script).toMatch(/if \[ "\$worker_before" = "online" \]; then\s+if ! pm2 restart "\$WORKER_APP"/);
    expect(script).toMatch(/echo "WORKER_ACTION=left-\$worker_before"/);
  });

  test('no pm2 start of any app, and no restart-all', () => {
    expect(script).not.toMatch(/pm2 start\b/);
    expect(script).not.toMatch(/pm2 (restart|reload) all\b/);
    expect(script).not.toMatch(/startOrRestart|startOrReload/);
  });
});

describe('config/sequelize.js: the worker-only pool size', () => {
  const { poolMax, production } = require('../../../src/config/sequelize');

  test('DB_POOL_MAX from 1 to 30 sets the size; anything else keeps 30', () => {
    expect(poolMax({ DB_POOL_MAX: '4' })).toBe(4);
    expect(poolMax({ DB_POOL_MAX: '1' })).toBe(1);
    for (const v of [undefined, '', '0', '31', '4.5', 'four', '-2']) expect(poolMax({ DB_POOL_MAX: v })).toBe(30);
  });

  test('the API, which sets no DB_POOL_MAX, keeps max 30 / min 10', () => {
    expect(process.env.DB_POOL_MAX).toBeUndefined();
    expect(production.pool).toMatchObject({ max: 30, min: 10 });
  });
});

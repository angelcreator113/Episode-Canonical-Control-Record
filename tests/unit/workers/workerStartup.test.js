/**
 * Issue #3714: the episode worker starts only when GENERATION_WORKER_ENABLED
 * is "true" (default off), and in production only as its own database login,
 * with no fallback to the API's or the postgres login. A disabled or refused
 * worker loads nothing that touches the database, Redis or an AI provider.
 */
const mockLoaded = [];
jest.mock('../../../src/models', () => { mockLoaded.push('models'); return {}; });
jest.mock('../../../src/workers/videoRenderer', () => { mockLoaded.push('videoRenderer'); return {}; });
jest.mock('../../../src/workers/sceneGenerationWorker', () => {
  mockLoaded.push('sceneGenerationWorker');
  return { start: jest.fn(), stop: jest.fn() };
});

const { decideStartup, applyDbEnv, EXIT_CONFIG } = require('../../../src/workers/workerStartup');
const { main } = require('../../../src/workers/start');

const quiet = { log: () => {}, warn: () => {}, error: () => {} };

describe('decideStartup', () => {
  test.each([
    [{}],
    [{ GENERATION_WORKER_ENABLED: 'false' }],
    [{ GENERATION_WORKER_ENABLED: '1' }],
    [{ GENERATION_WORKER_ENABLED: 'yes' }],
    [{ GENERATION_WORKER_ENABLED: '' }],
  ])('disabled unless exactly "true": %j', (env) => {
    expect(decideStartup({ NODE_ENV: 'production', WORKER_DB_USER: 'episode_worker', WORKER_DB_PASSWORD: 'p', ...env }).action).toBe('disabled');
  });

  test('"TRUE" and " true " count as true', () => {
    for (const v of ['TRUE', ' true ']) {
      expect(decideStartup({ GENERATION_WORKER_ENABLED: v, WORKER_DB_USER: 'episode_worker', WORKER_DB_PASSWORD: 'p', NODE_ENV: 'production' }).action).toBe('run');
    }
  });

  test.each([
    ['production, no worker login', { NODE_ENV: 'production' }],
    ['production, the API login only', { NODE_ENV: 'production', DB_USER: 'episode_app_dev', DB_PASSWORD: 'api' }],
    ['required by the ecosystem, user only', { WORKER_DB_REQUIRED: 'true', WORKER_DB_USER: 'episode_worker' }],
    ['required by the ecosystem, password only', { WORKER_DB_REQUIRED: 'true', WORKER_DB_PASSWORD: 'p' }],
    ['the postgres login', { WORKER_DB_USER: 'postgres', WORKER_DB_PASSWORD: 'p' }],
    ['the postgres login, any case', { WORKER_DB_USER: 'Postgres', WORKER_DB_PASSWORD: 'p' }],
  ])('refused when enabled: %s', (_label, env) => {
    const d = decideStartup({ GENERATION_WORKER_ENABLED: 'true', ...env });
    expect(d.action).toBe('refuse');
    expect(d.message).not.toContain('api');
  });

  test('production with the worker login: runs as it', () => {
    const d = decideStartup({ GENERATION_WORKER_ENABLED: 'true', NODE_ENV: 'production', WORKER_DB_USER: ' episode_worker ', WORKER_DB_PASSWORD: 's3cret', DB_USER: 'episode_app_dev' });
    expect(d).toMatchObject({ action: 'run', identity: 'worker', dbEnv: { DB_USER: 'episode_worker', DB_PASSWORD: 's3cret' } });
  });

  test('development without a worker login keeps the shared DB_* settings, as before', () => {
    expect(decideStartup({ GENERATION_WORKER_ENABLED: 'true', NODE_ENV: 'development' })).toMatchObject({ action: 'run', identity: 'shared', dbEnv: null });
  });

  test('applyDbEnv replaces the login and removes the other ways in', () => {
    const env = { DB_USER: 'episode_app_dev', DB_PASSWORD: 'api', DB_USERNAME: 'x', DATABASE_URL: 'postgres://postgres:pw@h/db' };
    applyDbEnv(env, { DB_USER: 'episode_worker', DB_PASSWORD: 'w' });
    expect(env).toEqual({ DB_USER: 'episode_worker', DB_PASSWORD: 'w' });
  });
});

describe('start.js main', () => {
  beforeEach(() => { mockLoaded.length = 0; });

  test('disabled: no model, renderer or scene worker is loaded; it only waits', () => {
    const keepAlive = jest.fn(() => 'timer');
    const exit = jest.fn();
    const r = main({ NODE_ENV: 'production', WORKER_DB_REQUIRED: 'true' }, { ...quiet, keepAlive, exit });
    expect(r).toEqual({ action: 'disabled', timer: 'timer' });
    expect(keepAlive).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
    expect(mockLoaded).toEqual([]);
  });

  test('refused: exits 78 before loading anything', () => {
    const exit = jest.fn();
    const keepAlive = jest.fn();
    main({ GENERATION_WORKER_ENABLED: 'true', WORKER_DB_REQUIRED: 'true', DB_USER: 'episode_app_dev', DB_PASSWORD: 'api' }, { ...quiet, exit, keepAlive });
    expect(exit).toHaveBeenCalledWith(EXIT_CONFIG);
    expect(EXIT_CONFIG).toBe(78);
    expect(keepAlive).not.toHaveBeenCalled();
    expect(mockLoaded).toEqual([]);
  });

  test('enabled with the worker login: the login is applied before the workers load, then both start', () => {
    const env = { GENERATION_WORKER_ENABLED: 'true', WORKER_DB_REQUIRED: 'true', WORKER_DB_USER: 'episode_worker', WORKER_DB_PASSWORD: 'w', DB_USER: '', DB_PASSWORD: '' };
    const seen = [];
    const start = jest.fn();
    const r = main(env, {
      ...quiet,
      loadRenderer: () => seen.push(['renderer', env.DB_USER]),
      loadSceneWorker: () => { seen.push(['scene', env.DB_USER]); return { start, stop: jest.fn() }; },
    });
    expect(r.action).toBe('run');
    expect(seen).toEqual([['renderer', 'episode_worker'], ['scene', 'episode_worker']]);
    expect(start).toHaveBeenCalledTimes(1);
  });

  test('the password never reaches the log', () => {
    const lines = [];
    const log = (...a) => lines.push(a.join(' '));
    main({ GENERATION_WORKER_ENABLED: 'true', WORKER_DB_USER: 'episode_worker', WORKER_DB_PASSWORD: 'p4ss-w0rd', NODE_ENV: 'production' },
      { log, warn: log, error: log, loadRenderer: () => {}, loadSceneWorker: () => ({ start: () => {}, stop: () => {} }) });
    expect(lines.join('\n')).not.toContain('p4ss-w0rd');
  });
});

/**
 * src/db.js hands out the app's shared, SSL-aware pool (src/config/database.js)
 * and has no pool or login of its own (the shared-connection repair,
 * 2026-11-06). pg is mocked: no database.
 */
const fs = require('fs');
const path = require('path');

const mockPools = [];
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation((config) => {
    const pool = { config, query: jest.fn(async () => ({ rows: [] })), connect: jest.fn(async () => ({ release() {} })), on: jest.fn(), end: jest.fn(async () => {}) };
    mockPools.push(pool);
    return pool;
  }),
}));

const ENV_KEYS = ['DATABASE_URL', 'DB_SSL', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
let savedEnv;

/** A fresh src/db and src/config/database with this environment. */
function load(env) {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  mockPools.length = 0;
  let db; let config;
  jest.isolateModules(() => {
    config = require('../../../src/config/database');
    db = require('../../../src/db');
  });
  return { db, config };
}

beforeAll(() => { savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]])); });
afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k];
  }
});

describe('src/db.js', () => {
  test('opens no pool of its own: requiring it connects nothing, and every query goes to the shared getPool()', async () => {
    const { db, config } = load({ DB_HOST: 'h', DB_USER: 'u', DB_PASSWORD: 'p', DB_SSL: 'true' });
    expect(mockPools).toHaveLength(0);

    await db.pool.query('SELECT 1', [1]);
    await db.query('SELECT 2', [2]);
    await db.pool.connect();
    expect(mockPools).toHaveLength(1);
    const shared = config.getPool();
    expect(mockPools[0]).toBe(shared);
    expect(shared.query.mock.calls).toEqual([['SELECT 1', [1]], ['SELECT 2', [2]]]);
    expect(shared.connect).toHaveBeenCalledTimes(1);
  });

  test('production settings (DB_* with DB_SSL=true) connect with SSL and the configured login', async () => {
    const { db } = load({ DB_HOST: 'db.internal', DB_PORT: '5432', DB_NAME: 'episode_metadata', DB_USER: 'app', DB_PASSWORD: 'pw', DB_SSL: 'true' });
    await db.pool.query('SELECT 1');
    expect(mockPools[0].config).toMatchObject({
      host: 'db.internal', port: 5432, database: 'episode_metadata', user: 'app', password: 'pw', ssl: { rejectUnauthorized: false },
    });
  });

  test('DATABASE_URL is used as given, without its sslmode; SSL still follows DB_SSL', async () => {
    const { db } = load({ DATABASE_URL: 'postgresql://a:b@host:5432/x?sslmode=require', DB_SSL: 'true' });
    await db.pool.query('SELECT 1');
    expect(mockPools[0].config).toMatchObject({ connectionString: 'postgresql://a:b@host:5432/x', ssl: { rejectUnauthorized: false } });
    expect(mockPools[0].config.user).toBeUndefined();
  });

  test('no built-in login: with DB_USER and DB_PASSWORD unset, none is guessed (no admin/password, no postgres/empty)', async () => {
    const { db } = load({ DB_HOST: 'h' });
    await db.pool.query('SELECT 1');
    const { config } = mockPools[0];
    expect(config.user).toBeUndefined();
    expect(config.password).toBeUndefined();
    expect(config.ssl).toBe(false);
    const source = fs.readFileSync(path.join(__dirname, '../../../src/db.js'), 'utf8');
    expect(source).not.toMatch(/new Pool|require\('pg'\)|'admin'|'password'/);
  });

  test('a failed query reaches the caller as a rejection (the controllers answer it), not a crash', async () => {
    const { db, config } = load({ DB_HOST: 'h', DB_SSL: 'true' });
    await db.pool.query('SELECT 1');
    const failure = Object.assign(new Error('relation "music_cues" does not exist'), { code: '42P01' });
    config.getPool().query.mockRejectedValueOnce(failure);
    await expect(db.pool.query('SELECT * FROM music_cues')).rejects.toBe(failure);
  });
});

describe('the consumers', () => {
  const root = path.join(__dirname, '../../..');
  const CONSUMERS = [
    'src/controllers/cursorPathController.js', 'src/controllers/iconCueController.js', 'src/controllers/iconSlotController.js',
    'src/controllers/musicCueController.js', 'src/controllers/productionPackageController.js',
    'src/services/FilterService.js', 'src/services/VersioningService.js', 'src/services/cursorPathGeneratorService.js',
    'src/services/iconCueGeneratorService.js', 'src/services/musicCueGeneratorService.js', 'src/services/productionPackageService.js',
  ];

  test('the eleven files that use src/db are exactly these, and none opens a pool of its own', () => {
    const { execSync } = require('child_process');
    const found = execSync(`grep -rlE "require\\('(\\.\\./)+db'\\)" src`, { cwd: root, encoding: 'utf8' }).trim().split('\n').sort();
    expect(found).toEqual([...CONSUMERS].sort());
    for (const f of CONSUMERS) {
      expect(fs.readFileSync(path.join(root, f), 'utf8')).not.toMatch(/new Pool\(/);
    }
  });
});

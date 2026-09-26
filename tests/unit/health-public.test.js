// ============================================================================
// /health publishes no database details (Task #1999)
// ============================================================================
// Public /health returns only status, timestamp, uptime, version, environment
// and database state. The full diagnostic body is at /_diag/health, only for a
// loopback request without X-Forwarded-For. supertest connects over loopback,
// so a request without the header is "local" and one with it is not.

process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';

jest.mock('@aws-sdk/credential-providers', () => ({
  fromIni: jest.fn(() => jest.fn().mockResolvedValue({ accessKeyId: 'x', secretAccessKey: 'x' })),
  fromEnv: jest.fn(() => jest.fn().mockResolvedValue({ accessKeyId: 'x', secretAccessKey: 'x' })),
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(), GetObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(), DeleteObjectCommand: jest.fn(),
}));
jest.mock('aws-sdk', () => ({
  CognitoIdentityServiceProvider: jest.fn(() => ({
    getSigningCertificate: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Certificate: 'test' }),
    }),
  })),
  S3: jest.fn(() => ({ getSignedUrl: jest.fn((op, params, cb) => cb(null, 'https://mock')) })),
  SQS: jest.fn(() => ({ sendMessage: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({}) }) })),
}));

const request = require('supertest');

const PUBLIC_KEYS = ['database', 'environment', 'status', 'timestamp', 'uptime', 'version'];
const DETAIL_KEYS = ['config', 'currentDatabase', 'showCount', 'episodeCount', 'showsTableExists', 'databaseError', 'tableCheckError'];
const DB_ERROR = 'password authentication failed for user "some_user"';

describe('/health publishes no database details (Task #1999)', () => {
  let app;
  let db;
  const ORIGINAL_TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

  beforeAll(() => {
    app = require('../../src/app');
    db = require('../../src/models');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (ORIGINAL_TEST_DATABASE_URL === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = ORIGINAL_TEST_DATABASE_URL;
  });

  // Make collectHealth run its database check against a stubbed sequelize.
  function stubDatabase({ up }) {
    process.env.TEST_DATABASE_URL = 'postgres://stub/stub';
    if (!up) {
      jest.spyOn(db.sequelize, 'authenticate').mockRejectedValue(new Error(DB_ERROR));
      return;
    }
    jest.spyOn(db.sequelize, 'authenticate').mockResolvedValue();
    jest.spyOn(db.sequelize, 'query').mockImplementation(async (sql) => {
      if (sql.includes('information_schema')) return [[{ exists: true }]];
      if (sql.includes('current_database')) return [[{ db_name: 'some_database' }]];
      return [[{ count: '3' }]];
    });
  }

  test('public /health returns only the public fields when the database is up', async () => {
    stubDatabase({ up: true });
    const res = await request(app).get('/health').set('X-Forwarded-For', '203.0.113.9');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(PUBLIC_KEYS);
    expect(res.body.database).toBe('connected');
    for (const key of DETAIL_KEYS) expect(res.body).not.toHaveProperty(key);
    expect(JSON.stringify(res.body)).not.toMatch(/some_database|DB_HOST|DB_NAME/);
  });

  test('/health omits the details for a local request too', async () => {
    stubDatabase({ up: true });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(PUBLIC_KEYS);
  });

  test('a failed database check gives 503 with no error text, and logs the error server-side', async () => {
    stubDatabase({ up: false });
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', database: 'disconnected' });
    expect(res.body).not.toHaveProperty('databaseError');
    expect(JSON.stringify(res.body)).not.toContain('password authentication failed');
    expect(logged).toHaveBeenCalledWith('[health] database check failed:', DB_ERROR);
  });

  test('/_diag/health gives the full body to a local request without X-Forwarded-For', async () => {
    stubDatabase({ up: true });
    const res = await request(app).get('/_diag/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('config');
    expect(res.body.config).toHaveProperty('DB_HOST');
    expect(res.body).toMatchObject({ database: 'connected', currentDatabase: 'some_database', showCount: 3, episodeCount: 3 });
  });

  test('/_diag/health gives the error text locally on a failed check, still 503', async () => {
    stubDatabase({ up: false });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/_diag/health');
    expect(res.status).toBe(503);
    expect(res.body.databaseError).toBe(DB_ERROR);
  });

  test('/_diag/health refuses a request carrying X-Forwarded-For, with no detail', async () => {
    stubDatabase({ up: true });
    const res = await request(app).get('/_diag/health').set('X-Forwarded-For', '127.0.0.1');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  test('/api/v1/health still redirects to /health', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/health');
  });
});

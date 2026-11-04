/**
 * The application runs without creating schema (Evoni, 2026-11-04;
 * docs/reads/2026-11-04-runtime-ddl-inventory.md).
 *
 * The app connects as a throwaway role with the application's data
 * privileges (SELECT, INSERT, UPDATE, DELETE on every table, the sequences)
 * and no CREATE on public, the state the application role is to have once
 * its CREATE is revoked. Every statement any connection sends is captured
 * at the pg driver, which both Sequelize and the raw pool use. Then:
 *   - startup: the app loads, and the World Studio cleanup that ran 10 s
 *     after startup (and hourly) runs;
 *   - requests: every route that used to create a table;
 *   - background job: the scene generation worker starts and polls.
 * None may send DDL, and none may fail.
 */
jest.unmock('uuid');

const { Client } = require('pg');
const crypto = require('crypto');

const adminUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const shouldSkip = !adminUrl || adminUrl.includes('amazonaws.com') || !adminUrl.includes('episode_metadata_test');

const ROLE = 'rt_app_nocreate';
const PW = `pw_${crypto.randomBytes(6).toString('hex')}`;
const DDL = /^\s*(CREATE|ALTER|DROP|TRUNCATE|COMMENT|GRANT|REVOKE)\b|\bCREATE\s+(TABLE|INDEX|TYPE)\b/i;

const sent = [];
// Installed before the app loads: every query on every pg connection.
const pg = require('pg');
const originalQuery = pg.Client.prototype.query;
pg.Client.prototype.query = function capture(config, ...rest) {
  const text = typeof config === 'string' ? config : config && config.text;
  if (text) sent.push(text);
  return originalQuery.call(this, config, ...rest);
};
const ddlSent = () => sent.filter((t) => DDL.test(t));

(shouldSkip ? describe.skip : describe)('no runtime DDL: startup, requests and the worker run without CREATE', () => {
  let admin; let app; let request; let token; let models;
  const chapterId = crypto.randomUUID();
  const episodeId = crypto.randomUUID();

  beforeAll(async () => {
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    const { rows } = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [ROLE]);
    if (rows.length) await admin.query(`DROP OWNED BY ${ROLE}; DROP ROLE ${ROLE}`);
    await admin.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PW}'`);
    await admin.query(`GRANT CONNECT ON DATABASE episode_metadata_test TO ${ROLE};
      GRANT USAGE ON SCHEMA public TO ${ROLE};
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROLE};
      GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${ROLE};`);
    const { rows: [p] } = await admin.query(
      "SELECT has_schema_privilege($1, 'public', 'CREATE') AS c, has_database_privilege($1, current_database(), 'CREATE') AS d", [ROLE]);
    // The precondition: this role cannot create anything.
    expect(p).toEqual({ c: false, d: false });

    const u = new URL(adminUrl);
    u.username = ROLE; u.password = PW;
    process.env.DATABASE_URL = u.toString();
    process.env.TEST_DATABASE_URL = u.toString();
    sent.length = 0;
    app = require('../../src/app');
    request = require('supertest');
    models = require('../../src/models');
    token = require('../../src/services/tokenService').generateTokenPair({
      id: 'test-user-no-ddl', email: 'test@no-ddl.dev', name: 'No DDL Test', groups: ['ADMIN', 'USER'], role: 'ADMIN',
    }).accessToken;
  }, 30000);

  afterAll(async () => {
    pg.Client.prototype.query = originalQuery;
    if (models) await models.sequelize.close().catch(() => {});
    if (admin) {
      await admin.query('DELETE FROM chapter_versions WHERE chapter_id = $1', [chapterId]).catch(() => {});
      await admin.query(`DROP OWNED BY ${ROLE}; DROP ROLE IF EXISTS ${ROLE}`);
      await admin.end();
    }
  });

  it('startup, including the World Studio cleanup 10 s later, sends no DDL', async () => {
    await new Promise((r) => setTimeout(r, 11500));
    expect(sent.some((t) => /ecosystem_previews/.test(t))).toBe(true); // the cleanup ran
    expect(ddlSent()).toEqual([]);
  }, 30000);

  it.each([
    ['GET', '/api/v1/continuity/timelines', null],
    ['GET', '/api/v1/story-health/versions/chapter/:chapter', null],
    ['POST', '/api/v1/story-health/versions/chapter/:chapter', { content: 'one two three', reason: 'test' }],
    ['GET', '/api/v1/world/previews', null],
    ['GET', '/api/v1/world/preview/no-such-preview', null],
    ['DELETE', '/api/v1/world/previews/no-such-preview', null],
    ['GET', '/api/v1/episodes/:episode/video-compositions', null],
    ['GET', '/api/v1/scene-sets/jobs/set/:uuid', null],
    ['GET', '/api/v1/scene-sets/jobs/:uuid', null],
  // Every row has three values: with fewer, Jest passes its done callback as the last argument.
  ])('%s %s works and sends no DDL', async (method, url, body) => {
    sent.length = 0;
    const path = url.replace(':chapter', chapterId).replace(':episode', episodeId).replace(':uuid', crypto.randomUUID());
    let req = request(app)[method.toLowerCase()](path).set('Authorization', `Bearer ${token}`);
    if (body) req = req.send(body);
    const res = await req;
    expect([path, res.status < 500]).toEqual([path, true]);
    expect(JSON.stringify(res.body)).not.toMatch(/permission denied|does not exist/);
    expect(ddlSent()).toEqual([]);
  }, 20000);

  it('the removed test route that created video_compositions is gone', async () => {
    const res = await request(app).get('/api/v1/admin/create-video-compositions-table').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('the chapter version written above is really there', async () => {
    const { rows } = await admin.query('SELECT version_number, word_count FROM chapter_versions WHERE chapter_id = $1', [chapterId]);
    expect(rows).toEqual([{ version_number: 1, word_count: 3 }]);
  });

  it('the scene generation worker starts and polls without DDL or a table error', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    sent.length = 0;
    const worker = require('../../src/workers/sceneGenerationWorker');
    await worker.start();
    await new Promise((r) => setTimeout(r, 1500));
    worker.stop();
    expect(sent.some((t) => /generation_jobs/.test(t))).toBe(true); // it read the queue
    expect(ddlSent()).toEqual([]);
    const messages = errors.mock.calls.map((c) => c.join(' '));
    expect(messages.filter((m) => /GenWorker/.test(m))).toEqual([]);
    errors.mockRestore();
  }, 20000);
});

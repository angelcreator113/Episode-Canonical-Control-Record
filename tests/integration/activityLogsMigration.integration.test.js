/**
 * activity_logs: the converging migration, from every starting shape (issue
 * #1948; Evoni, 2026-11-11: "Preserve existing audit records in every
 * supported starting schema").
 *
 * It runs the REAL migration (20261111230000-converge-activity-logs) against
 * a scratch database of its own, once per starting shape:
 *   production  the table as scripts/migrations/MIGRATION.sql made it
 *               (resource_id INTEGER), which is what production and the dev
 *               box have;
 *   chain       the table as migration 20240101000005 makes it (camelCase,
 *               two enums, IP address and user agent columns), which is what
 *               CI and a fresh database have;
 *   model       the shape the old model would have made (underscored names);
 *   absent      no table at all.
 * Every one must end as the same table, with every row kept.
 *
 * The same file runs on PostgreSQL 15 (the Tests job) and PostgreSQL 17 (the
 * PostgreSQL 17 job; production is 17). The database is the isolated test
 * server only (the usual skip guard).
 */
jest.unmock('uuid');

const { Client } = require('pg');
const { Sequelize } = require('sequelize');
const original = require('../../src/migrations/20240101000005-create-activity-logs');
const converge = require('../../src/migrations/20261111230000-converge-activity-logs');

const PG_URL = process.env.DATABASE_URL;
const shouldSkip = !PG_URL || PG_URL.includes('amazonaws.com') || !PG_URL.includes('episode_metadata_test');

const SCRATCH = `episode_metadata_test_audit_${process.pid}`;
const UUID = '7f1d0e0a-2b3c-4d5e-8f90-a1b2c3d4e5f6';

const TARGET_COLUMNS = [
  { column_name: 'action', data_type: 'character varying', is_nullable: 'YES', column_default: null },
  { column_name: 'changes', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
  { column_name: 'created_at', data_type: 'timestamp without time zone', is_nullable: 'YES', column_default: 'now()' },
  { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: "nextval('activity_logs_id_seq'::regclass)" },
  { column_name: 'resource_id', data_type: 'character varying', is_nullable: 'YES', column_default: null },
  { column_name: 'resource_type', data_type: 'character varying', is_nullable: 'YES', column_default: null },
  { column_name: 'user_id', data_type: 'character varying', is_nullable: 'YES', column_default: null },
];
const TARGET_INDEXES = [
  'CREATE INDEX activity_logs_resource ON public.activity_logs USING btree (resource_type, resource_id)',
  'CREATE UNIQUE INDEX activity_logs_pkey ON public.activity_logs USING btree (id)',
];

(shouldSkip ? describe.skip : describe)('activity_logs converges to one shape from every starting shape (issue #1948)', () => {
  jest.setTimeout(120000);
  let admin;
  let db;
  let scratch;
  let serverVersion;

  const scratchUrl = () => {
    const u = new URL(PG_URL);
    u.pathname = `/${SCRATCH}`;
    return u.toString();
  };
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const up = () => converge.up(scratch.getQueryInterface(), Sequelize);
  const down = () => converge.down(scratch.getQueryInterface(), Sequelize);
  const columns = () => q(
    `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'activity_logs' ORDER BY column_name`);
  const indexes = async () => (await q(
    "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'activity_logs' ORDER BY indexname DESC")).map((r) => r.indexdef);
  const enums = async () => (await q("SELECT typname FROM pg_type WHERE typname LIKE 'enum_activity_logs%' ORDER BY 1")).map((r) => r.typname);
  const rows = () => q('SELECT user_id, action, resource_type, resource_id, changes, created_at::text AS created_at FROM activity_logs ORDER BY id');
  const reset = async () => {
    await db.query('DROP TABLE IF EXISTS activity_logs');
    for (const t of await enums()) await db.query(`DROP TYPE "${t}"`);
  };
  const expectTarget = async () => {
    expect(await columns()).toEqual(TARGET_COLUMNS);
    expect(await indexes()).toEqual(TARGET_INDEXES);
    expect(await enums()).toEqual([]);
    const lengths = await q(
      `SELECT column_name, character_maximum_length AS n FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'activity_logs' AND data_type = 'character varying' ORDER BY column_name`);
    expect(lengths).toEqual([
      { column_name: 'action', n: 100 }, { column_name: 'resource_id', n: 255 },
      { column_name: 'resource_type', n: 100 }, { column_name: 'user_id', n: 255 },
    ]);
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = new Client({ connectionString: PG_URL });
    await admin.connect();
    serverVersion = (await admin.query('SHOW server_version')).rows[0].server_version;
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH}`);
    await admin.query(`CREATE DATABASE ${SCRATCH}`);
    db = new Client({ connectionString: scratchUrl() });
    await db.connect();
    scratch = new Sequelize(scratchUrl(), { logging: false, pool: { max: 3 } });
  });
  afterAll(async () => {
    jest.restoreAllMocks();
    if (scratch) await scratch.close();
    if (db) await db.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH} WITH (FORCE)`);
      await admin.end();
    }
  });
  beforeEach(reset);

  it('runs on PostgreSQL 15 or later, against its own scratch database', async () => {
    expect(Number(serverVersion.split('.')[0])).toBeGreaterThanOrEqual(15);
    expect((await q('SELECT current_database() AS name'))[0].name).toBe(SCRATCH);
  });

  it('production\'s shape: resource_id becomes text, the index is added, nothing else changes, rows are kept', async () => {
    // Verbatim from scripts/migrations/MIGRATION.sql, the script that made production's table.
    await db.query(`CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255),
      action VARCHAR(100),
      resource_type VARCHAR(100),
      resource_id INTEGER,
      changes JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await db.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, changes, created_at)
       VALUES ('user-1', 'edit', 'episode', 42, '{"after":{"title":"Pilot"}}', '2026-01-02 03:04:05'), (NULL, 'delete', 'job', NULL, NULL, '2026-01-03 00:00:00')`);
    const before = await columns();

    await up();
    await expectTarget();
    // Only resource_id's type differs from what production had.
    expect((await columns()).filter((c, i) => JSON.stringify(c) !== JSON.stringify(before[i])).map((c) => c.column_name)).toEqual(['resource_id']);
    expect(await rows()).toEqual([
      { user_id: 'user-1', action: 'edit', resource_type: 'episode', resource_id: '42', changes: { after: { title: 'Pilot' } }, created_at: '2026-01-02 03:04:05' },
      { user_id: null, action: 'delete', resource_type: 'job', resource_id: null, changes: null, created_at: '2026-01-03 00:00:00' },
    ]);
    // A UUID fits now.
    await db.query("INSERT INTO activity_logs (user_id, action, resource_type, resource_id) VALUES ('user-1', 'create', 'episode', $1)", [UUID]);
    expect((await q('SELECT resource_id FROM activity_logs ORDER BY id DESC LIMIT 1'))[0].resource_id).toBe(UUID);
  });

  it('the migration chain\'s shape: names, enums, old and new values and the timestamp converge; every row is kept', async () => {
    await original.up(scratch.getQueryInterface(), Sequelize);
    expect(await enums()).toEqual(['enum_activity_logs_actionType', 'enum_activity_logs_resourceType']);
    await db.query(
      `INSERT INTO activity_logs ("userId", "actionType", "resourceType", "resourceId", "oldValues", "newValues", "ipAddress", "userAgent", "timestamp")
       VALUES ('user-1', 'edit', 'episode', $1, '{"title":"Old"}', '{"title":"New"}', '203.0.113.9', 'Mozilla/5.0', '2026-02-03 04:05:06+00'),
              ('user-2', 'create', 'metadata', '7', NULL, '{"tags":["a"]}', NULL, NULL, '2026-02-04 00:00:00+00'),
              ('user-3', 'delete', 'thumbnail', '9', NULL, NULL, NULL, NULL, '2026-02-05 00:00:00+00')`, [UUID]);

    await up();
    await expectTarget();
    expect(await rows()).toEqual([
      { user_id: 'user-1', action: 'edit', resource_type: 'episode', resource_id: UUID, changes: { before: { title: 'Old' }, after: { title: 'New' } }, created_at: '2026-02-03 04:05:06' },
      { user_id: 'user-2', action: 'create', resource_type: 'metadata', resource_id: '7', changes: { after: { tags: ['a'] } }, created_at: '2026-02-04 00:00:00' },
      { user_id: 'user-3', action: 'delete', resource_type: 'thumbnail', resource_id: '9', changes: null, created_at: '2026-02-05 00:00:00' },
    ]);
    // The IP address and the user agent are gone with their columns, in every form.
    const dump = JSON.stringify(await q('SELECT * FROM activity_logs'));
    expect(dump).not.toMatch(/203\.0\.113\.9|Mozilla/);
    // An action or resource type outside the old enums is storable now.
    await db.query("INSERT INTO activity_logs (action, resource_type, resource_id) VALUES ('retry', 'job', $1)", [UUID]);
  });

  it('the old model\'s shape (underscored names) converges too', async () => {
    await db.query(`CREATE TABLE activity_logs (
      id SERIAL PRIMARY KEY, user_id VARCHAR(255) NOT NULL, action_type VARCHAR(20) NOT NULL, resource_type VARCHAR(100) NOT NULL,
      resource_id VARCHAR(255) NOT NULL, old_values JSON, new_values JSON, ip_address VARCHAR(45), user_agent TEXT,
      "timestamp" TIMESTAMPTZ DEFAULT NOW())`);
    await db.query(
      `INSERT INTO activity_logs (user_id, action_type, resource_type, resource_id, old_values, ip_address, "timestamp")
       VALUES ('user-1', 'delete', 'episode', $1, '{"title":"Gone"}', '198.51.100.7', '2026-03-04 05:06:07+00')`, [UUID]);

    await up();
    await expectTarget();
    expect(await rows()).toEqual([
      { user_id: 'user-1', action: 'delete', resource_type: 'episode', resource_id: UUID, changes: { before: { title: 'Gone' } }, created_at: '2026-03-04 05:06:07' },
    ]);
  });

  it('no table at all: it is created in the target shape', async () => {
    await up();
    await expectTarget();
    expect(await rows()).toEqual([]);
  });

  it('running it again changes nothing, from any shape', async () => {
    await original.up(scratch.getQueryInterface(), Sequelize);
    await db.query(`INSERT INTO activity_logs ("userId", "actionType", "resourceType", "resourceId", "newValues") VALUES ('u', 'create', 'episode', $1, '{"a":1}')`, [UUID]);
    await up();
    const once = { columns: await columns(), indexes: await indexes(), rows: await rows() };
    await up();
    await up();
    expect({ columns: await columns(), indexes: await indexes(), rows: await rows() }).toEqual(once);
  });

  it('down refuses, changing nothing, once any audit row exists; history is never deleted for a rollback', async () => {
    await up();
    await db.query("INSERT INTO activity_logs (user_id, action, resource_type, resource_id) VALUES ('user-1', 'edit', 'episode', $1)", [UUID]);
    const before = { columns: await columns(), indexes: await indexes(), rows: await rows() };

    await expect(down()).rejects.toThrow(/down refused, nothing changed: activity_logs holds 1 audit row\(s\)/);
    expect({ columns: await columns(), indexes: await indexes(), rows: await rows() }).toEqual(before);
  });

  it('down on an empty table returns production\'s earlier shape (integer resource_id, no index); up converges it again', async () => {
    await up();
    await down();
    expect((await columns()).find((c) => c.column_name === 'resource_id').data_type).toBe('integer');
    expect(await indexes()).toEqual([TARGET_INDEXES[1]]);
    await down(); // nothing left to do
    await up();
    await expectTarget();
  });

  // The rollback contract, stated exactly (Evoni, 2026-11-11): down undoes what
  // this migration did to PRODUCTION's table. It does not rebuild the table
  // migration 20240101000005 created, whatever shape up started from.
  it('down after converging the migration chain\'s shape does NOT restore that shape: only resource_id and the index go back', async () => {
    await original.up(scratch.getQueryInterface(), Sequelize);
    const chain = (await columns()).map((c) => c.column_name);
    expect(chain).toEqual(expect.arrayContaining(['userId', 'actionType', 'oldValues', 'ipAddress', 'timestamp']));

    await up();
    await down();

    const after = await columns();
    // Production's earlier table, column for column.
    expect(after.map((c) => [c.column_name, c.data_type])).toEqual([
      ['action', 'character varying'], ['changes', 'jsonb'], ['created_at', 'timestamp without time zone'], ['id', 'integer'],
      ['resource_id', 'integer'], ['resource_type', 'character varying'], ['user_id', 'character varying'],
    ]);
    // Not rebuilt: the camelCase columns, the enums, the four old indexes.
    for (const gone of ['userId', 'actionType', 'resourceType', 'resourceId', 'oldValues', 'newValues', 'ipAddress', 'userAgent', 'timestamp']) {
      expect(after.map((c) => c.column_name)).not.toContain(gone);
    }
    expect(await enums()).toEqual([]);
    expect(await indexes()).toEqual([TARGET_INDEXES[1]]);

    // The chain can still be undone to the bottom, and brought back up.
    await original.down(scratch.getQueryInterface(), Sequelize);
    expect(await q("SELECT to_regclass('public.activity_logs') AS reg")).toEqual([{ reg: null }]);
    await original.up(scratch.getQueryInterface(), Sequelize);
    await up();
    await expectTarget();
  });

  it('existing constraints and the id sequence survive: the primary key holds and ids continue', async () => {
    await db.query(`CREATE TABLE activity_logs (
      id SERIAL PRIMARY KEY, user_id VARCHAR(255), action VARCHAR(100), resource_type VARCHAR(100),
      resource_id INTEGER, changes JSONB, created_at TIMESTAMP DEFAULT NOW())`);
    await db.query("INSERT INTO activity_logs (action, resource_type, resource_id) VALUES ('create', 'job', 1), ('create', 'job', 2)");
    const constraintsBefore = await q(
      "SELECT conname, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.activity_logs'::regclass ORDER BY conname");
    expect(constraintsBefore).toEqual([{ conname: 'activity_logs_pkey', contype: 'p', def: 'PRIMARY KEY (id)' }]);

    await up();

    expect(await q(
      "SELECT conname, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.activity_logs'::regclass ORDER BY conname"))
      .toEqual(constraintsBefore);
    const [next] = await q("INSERT INTO activity_logs (action, resource_type, resource_id) VALUES ('edit', 'episode', $1) RETURNING id", [UUID]);
    expect(next.id).toBe(3);
    await expect(db.query('INSERT INTO activity_logs (id, action) VALUES (3, $1)', ['edit'])).rejects.toMatchObject({ code: '23505' });
    // The sequence still belongs to the column, so it is dropped with the table and nothing is left behind.
    expect(await q("SELECT pg_get_serial_sequence('public.activity_logs', 'id') AS seq")).toEqual([{ seq: 'public.activity_logs_id_seq' }]);
  });

  it('an index already named activity_logs_resource, and a view over the table, do not break it or get lost', async () => {
    await db.query(`CREATE TABLE activity_logs (
      id SERIAL PRIMARY KEY, user_id VARCHAR(255), action VARCHAR(100), resource_type VARCHAR(100),
      resource_id VARCHAR(255), changes JSONB, created_at TIMESTAMP DEFAULT NOW())`);
    await db.query('CREATE INDEX activity_logs_resource ON activity_logs (resource_type, resource_id)');
    await db.query('CREATE VIEW recent_activity AS SELECT id, action, created_at FROM activity_logs');
    try {
      await up();
      await expectTarget();
      expect(await q('SELECT COUNT(*)::int AS n FROM recent_activity')).toEqual([{ n: 0 }]);
    } finally {
      await db.query('DROP VIEW IF EXISTS recent_activity');
    }
  });

  it('a view that reads resource_id blocks the type change: the migration fails whole and changes nothing', async () => {
    await db.query(`CREATE TABLE activity_logs (
      id SERIAL PRIMARY KEY, user_id VARCHAR(255), action VARCHAR(100), resource_type VARCHAR(100),
      resource_id INTEGER, changes JSONB, created_at TIMESTAMP DEFAULT NOW())`);
    await db.query('CREATE VIEW activity_by_resource AS SELECT resource_id, COUNT(*) AS n FROM activity_logs GROUP BY resource_id');
    const before = { columns: await columns(), indexes: await indexes() };
    try {
      await expect(up()).rejects.toMatchObject({ original: { code: '0A000' } });
      expect({ columns: await columns(), indexes: await indexes() }).toEqual(before);
    } finally {
      await db.query('DROP VIEW IF EXISTS activity_by_resource');
    }
  });
});

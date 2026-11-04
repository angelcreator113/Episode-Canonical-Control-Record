/**
 * data_correction_log (migration 20261104170000; Evoni, 2026-11-04): the
 * append-only undo record for approved production data corrections.
 *
 * Against the test database. Every test runs inside one transaction that is
 * rolled back at the end, because the table refuses DELETE and TRUNCATE by
 * design; each refusal is checked inside its own savepoint.
 */
const { Client } = require('pg');
const crypto = require('crypto');
const migration = require('../../src/migrations/20261104170000-create-data-correction-log');
const models = require('../../src/models');

const url = process.env.DATABASE_URL || '';
const shouldSkip = !url || url.includes('amazonaws.com') || !url.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('data_correction_log (append-only undo record)', () => {
  let db;
  const showId = crypto.randomUUID();
  const key = `T-${crypto.randomUUID().slice(0, 8)}`;

  const insertRow = (extra = {}) => db.query(
    `INSERT INTO data_correction_log (correction_key, show_id, record_table, record_id, field, before_value, after_value,
       approved_by, approval_ref, applied_by, applied_at, undone_at, undone_by, deleted_at)
     VALUES ($1, $2, 'wardrobe', $3, 'is_owned', 'true'::jsonb, 'false'::jsonb, 'Evoni', 'test approval',
       $4, $5, $6, $7, $8) RETURNING *`,
    [extra.key || key, showId, extra.recordId || 'item-1', extra.appliedBy || 'someone-else',
      extra.appliedAt || '2000-01-01T00:00:00Z', extra.undoneAt || null, extra.undoneBy || null, extra.deletedAt || null],
  );
  const refused = async (sql, params = []) => {
    await db.query('SAVEPOINT s');
    try {
      await db.query(sql, params);
      await db.query('RELEASE SAVEPOINT s');
      return null;
    } catch (err) {
      await db.query('ROLLBACK TO SAVEPOINT s');
      return err.message;
    }
  };

  // Stands in for the application role: production's default privileges give
  // it SELECT, INSERT, UPDATE and DELETE on every new table (F-Deploy-1 v1.34).
  const APP_ROLE = 'dcl_test_app_role';

  beforeAll(async () => {
    // Twice: the migration is guarded, so a second run changes nothing. Between
    // the runs the stand-in app role is given every table privilege, as default
    // privileges would; the second run must take all of it back.
    await migration.up(models.sequelize.getQueryInterface());
    await models.sequelize.query(`DO $r$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN CREATE ROLE ${APP_ROLE} NOLOGIN; END IF;
    END $r$`);
    await models.sequelize.query(`GRANT ALL ON data_correction_log TO ${APP_ROLE}`);
    await migration.up(models.sequelize.getQueryInterface());
    db = new Client({ connectionString: url });
    await db.connect();
    await db.query('BEGIN');
  });

  afterAll(async () => {
    if (db) {
      await db.query('ROLLBACK');
      await db.end();
    }
    await models.sequelize.query(`DO $r$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        REVOKE ALL ON data_correction_log FROM ${APP_ROLE}; DROP ROLE ${APP_ROLE};
      END IF;
    END $r$`);
    await models.sequelize.close();
  });

  it('records the database actor and time itself, whatever the insert says', async () => {
    const { rows: [row] } = await insertRow();
    const { rows: [{ me }] } = await db.query('SELECT session_user AS me');
    expect(row.applied_by).toBe(me);
    expect(new Date(row.applied_at).getFullYear()).toBeGreaterThan(2000);
    expect(row.undone_at).toBeNull();
    expect(row.show_id).toBe(showId);
  });

  it('refuses a second application of the same correction to the same field', async () => {
    expect(await refused(
      `INSERT INTO data_correction_log (correction_key, show_id, record_table, record_id, field, before_value, after_value, approved_by, approval_ref)
       VALUES ($1, $2, 'wardrobe', 'item-1', 'is_owned', 'true'::jsonb, 'false'::jsonb, 'Evoni', 'again')`, [key, showId],
    )).toMatch(/data_correction_log_once/);
  });

  it('refuses a record that is inserted as undone or deleted, changes nothing, or has no approval reference', async () => {
    expect(await refused(
      `INSERT INTO data_correction_log (correction_key, show_id, record_table, record_id, field, before_value, after_value, approved_by, approval_ref, undone_at, undone_by)
       VALUES ($1, $2, 'wardrobe', 'item-2', 'is_owned', 'true'::jsonb, 'false'::jsonb, 'Evoni', 'x', NOW(), 'x')`, [key, showId],
    )).toMatch(/cannot be inserted as undone or deleted/);
    expect(await refused(
      `INSERT INTO data_correction_log (correction_key, show_id, record_table, record_id, field, before_value, after_value, approved_by, approval_ref)
       VALUES ($1, $2, 'wardrobe', 'item-3', 'is_owned', 'true'::jsonb, 'true'::jsonb, 'Evoni', 'x')`, [key, showId],
    )).toMatch(/data_correction_log_changes/);
    expect(await refused(
      `INSERT INTO data_correction_log (correction_key, show_id, record_table, record_id, field, before_value, after_value, approved_by, approval_ref)
       VALUES ($1, $2, 'wardrobe', 'item-4', 'is_owned', 'true'::jsonb, 'false'::jsonb, 'Evoni', '  ')`, [key, showId],
    )).toMatch(/data_correction_log_approval_ref/);
  });

  it('never lets recorded values change', async () => {
    expect(await refused(`UPDATE data_correction_log SET before_value = 'false'::jsonb WHERE correction_key = $1`, [key]))
      .toMatch(/the only allowed change is marking a record undone/);
    expect(await refused(`UPDATE data_correction_log SET after_value = 'true'::jsonb, undone_at = NOW(), undone_by = 'x' WHERE correction_key = $1`, [key]))
      .toMatch(/recorded values are immutable/);
    expect(await refused(`UPDATE data_correction_log SET deleted_at = NOW(), undone_at = NOW(), undone_by = 'x' WHERE correction_key = $1`, [key]))
      .toMatch(/recorded values are immutable/);
  });

  it('refuses DELETE and TRUNCATE', async () => {
    expect(await refused('DELETE FROM data_correction_log WHERE correction_key = $1', [key])).toMatch(/append-only: DELETE/);
    expect(await refused('TRUNCATE data_correction_log')).toMatch(/append-only: TRUNCATE/);
  });

  it('allows exactly one undo, stamped by the database, and nothing after it', async () => {
    const { rows: [row] } = await db.query(
      `UPDATE data_correction_log SET undone_at = '2000-01-01', undone_by = 'forged' WHERE correction_key = $1 RETURNING *`, [key],
    );
    const { rows: [{ me }] } = await db.query('SELECT session_user AS me');
    expect(row.undone_by).toBe(me);
    expect(new Date(row.undone_at).getFullYear()).toBeGreaterThan(2000);
    expect(await refused(`UPDATE data_correction_log SET undone_at = NOW(), undone_by = 'x' WHERE correction_key = $1`, [key]))
      .toMatch(/already undone and cannot change/);
  });

  it('takes back every grant from roles other than the owner, so the application role cannot write or read it', async () => {
    const { rows: [acl] } = await db.query(
      `SELECT pg_get_userbyid(c.relowner) AS owner,
              ARRAY(SELECT DISTINCT a.grantee::regrole::text FROM aclexplode(c.relacl) a WHERE a.grantee <> c.relowner ORDER BY 1) AS others
         FROM pg_class c WHERE c.oid = 'public.data_correction_log'::regclass`,
    );
    expect(acl.others.filter((r) => r !== 'prime_readonly')).toEqual([]);
    for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER']) {
      const { rows: [{ ok }] } = await db.query(`SELECT has_table_privilege('${APP_ROLE}', 'public.data_correction_log', '${p}') AS ok`);
      expect([p, ok]).toEqual([p, false]);
    }
    await db.query(`SET ROLE ${APP_ROLE}`);
    const insert = await refused(
      `INSERT INTO data_correction_log (correction_key, show_id, record_table, record_id, field, before_value, after_value, approved_by, approval_ref)
       VALUES ('APP-1', $1, 'wardrobe', 'x', 'is_owned', 'true'::jsonb, 'false'::jsonb, 'Evoni', 'forged')`, [showId],
    );
    const undo = await refused(`UPDATE data_correction_log SET undone_at = NOW(), undone_by = 'x' WHERE correction_key = $1`, [key]);
    const disable = await refused('ALTER TABLE data_correction_log DISABLE TRIGGER ALL');
    await db.query('RESET ROLE');
    expect(insert).toMatch(/permission denied/);
    expect(undo).toMatch(/permission denied/);
    expect(disable).toMatch(/must be owner/);
  });

  it('grants nothing to PUBLIC', async () => {
    const { rows } = await db.query(
      `SELECT privilege_type FROM information_schema.role_table_grants WHERE table_name = 'data_correction_log' AND grantee = 'PUBLIC'`,
    );
    expect(rows).toEqual([]);
  });

  it('is guarded: after running twice there is one table, one guard of each kind and the once index', async () => {
    const { rows: triggers } = await db.query(
      `SELECT tgname FROM pg_trigger WHERE tgrelid = 'data_correction_log'::regclass AND NOT tgisinternal ORDER BY tgname`,
    );
    expect(triggers.map((t) => t.tgname)).toEqual(['data_correction_log_row_guard', 'data_correction_log_truncate_guard']);
    const { rows: [idx] } = await db.query(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'data_correction_log' AND indexname = 'data_correction_log_once'`,
    );
    expect(idx.indexdef).toMatch(/UNIQUE INDEX .*\(correction_key, record_table, record_id, field\)/);
  });

  it('pins the trigger function to pg_catalog, so no operator or function another role plants can run inside it', async () => {
    const { rows: [fn] } = await db.query(
      `SELECT n.nspname, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.oid = 'public.data_correction_log_guard()'::regprocedure`,
    );
    expect(fn.nspname).toBe('public');
    expect(fn.proconfig).toEqual(['search_path=pg_catalog, pg_temp']);
  });
});

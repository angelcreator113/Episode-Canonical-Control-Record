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

  beforeAll(async () => {
    // Twice: the migration is guarded, so a second run changes nothing.
    await migration.up(models.sequelize.getQueryInterface());
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
    await models.sequelize.close();
  });

  it('records the database actor and time itself, whatever the insert says', async () => {
    const { rows: [row] } = await insertRow();
    const { rows: [{ me }] } = await db.query('SELECT current_user AS me');
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
    const { rows: [{ me }] } = await db.query('SELECT current_user AS me');
    expect(row.undone_by).toBe(me);
    expect(new Date(row.undone_at).getFullYear()).toBeGreaterThan(2000);
    expect(await refused(`UPDATE data_correction_log SET undone_at = NOW(), undone_by = 'x' WHERE correction_key = $1`, [key]))
      .toMatch(/already undone and cannot change/);
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
});

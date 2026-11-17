'use strict';

/**
 * Three drifted assets columns, one guarded migration.
 *
 * Evoni's ruling (2026-11-16): add s3_url_no_bg, s3_url_enhanced and
 * processing_metadata to the migration tree, each nullable and with no
 * database default; do not change the model or a column that already exists.
 *
 * The three are in production and in the model (src/models/Asset.js) but in
 * no migration: they were added by hand (scripts/migrations/
 * add-missing-asset-columns-final.sql, a tree that never runs). So a
 * database built by the migration tree lacks them, and every Asset read that
 * does not name its columns fails there ("column s3_url_no_bg does not
 * exist"). The same kind of drift as 20261001090000-add-drifted-columns-2303.
 *
 * Types and nullability match the canon capture
 * (docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt):
 *   L135  assets | processing_metadata | jsonb | YES
 *   L140  assets | s3_url_enhanced     | text  | YES
 *   L141  assets | s3_url_no_bg        | text  | YES
 *
 * Every step is ADD COLUMN IF NOT EXISTS: a no-op where the column exists
 * (production), so its type, default and values there are left exactly as
 * they are. No default is added: the capture does not record one, and the
 * model supplies its own on create. Skipped when there is no assets table.
 */
const assetsExists = async (queryInterface) => {
  // Resolved by the connection's search_path (public, in every deployed database).
  const [rows] = await queryInterface.sequelize.query("SELECT to_regclass('assets') AS reg");
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface) {
    if (!(await assetsExists(queryInterface))) return;
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE assets ADD COLUMN IF NOT EXISTS s3_url_no_bg text');
    await q('ALTER TABLE assets ADD COLUMN IF NOT EXISTS s3_url_enhanced text');
    await q('ALTER TABLE assets ADD COLUMN IF NOT EXISTS processing_metadata jsonb');
  },

  async down() {
    // Deliberate no-op. Production had all three columns, with data, before
    // this migration ran; up changed nothing there. Dropping them on rollback
    // would destroy columns and data this migration never created.
  },
};

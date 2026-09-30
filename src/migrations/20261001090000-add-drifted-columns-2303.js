'use strict';

/**
 * Four drifted columns, one guarded migration (Task #2303).
 *
 * Evoni's ruling (2026-09-29): "Record the assets-table drift
 * (processing_status, s3_key_processed: in production, in no migration) as
 * owed alongside the line_id and base_still_url drift, for one guarded
 * 'IF NOT EXISTS' migration later." On line_id: "that entry is ALTER COLUMN
 * line_id DROP NOT NULL, a no-op in production; the other three are ADD
 * COLUMN IF NOT EXISTS."
 *
 * Types and nullability match the canon capture
 * (docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt):
 *   L136  assets               | processing_status | character varying | YES
 *   L138  assets               | s3_key_processed  | character varying | YES
 *   L1568 scene_sets           | base_still_url    | text              | YES
 *   L2146 storyteller_memories | line_id           | uuid              | YES
 *
 * Every step is a no-op in production (the three columns exist there, and
 * line_id is already nullable there); on a database built by the migration
 * tree it adds the three columns and relaxes the NOT NULL that
 * 20260221120000 put on line_id (the model, src/models/StorytellerMemory.js,
 * declares it allowNull: true). Each step is skipped when its table is
 * absent, so a partial database never fails here.
 */
const tableExists = async (queryInterface, table) => {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT to_regclass(:name) AS reg',
    { replacements: { name: `public.${table}` } },
  );
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    if (await tableExists(queryInterface, 'assets')) {
      await q('ALTER TABLE assets ADD COLUMN IF NOT EXISTS processing_status character varying');
      await q('ALTER TABLE assets ADD COLUMN IF NOT EXISTS s3_key_processed character varying');
    }
    if (await tableExists(queryInterface, 'scene_sets')) {
      await q('ALTER TABLE scene_sets ADD COLUMN IF NOT EXISTS base_still_url text');
    }
    if (await tableExists(queryInterface, 'storyteller_memories')) {
      // DROP NOT NULL is idempotent: on an already-nullable column it is a no-op.
      await q('ALTER TABLE storyteller_memories ALTER COLUMN line_id DROP NOT NULL');
    }
  },

  async down() {
    // Deliberate no-op. Production already had all three added columns and a
    // nullable line_id before this migration ran; up changed nothing there.
    // Dropping the columns (or restoring NOT NULL on line_id) on rollback
    // would destroy production columns and data this migration never
    // created, so there is nothing safe to undo.
  },
};

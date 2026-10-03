'use strict';

/**
 * franchise_knowledge.source_key and source_hash: the Brain sync's link from
 * an entry to the one source item that owns it (Evoni, 2026-10-03, Brain
 * Update step 1; docs/BRAIN_OWNERSHIP.md).
 *
 *   source_key  — the owning item, stable across edits, e.g.
 *                 'social_systems:archetype:the-connector'. NULL for every
 *                 entry not written by a Brain sync (seeders, document
 *                 ingestion, the assistant, episode completion).
 *   source_hash — sha256 of the item's synced title and content, so a sync
 *                 can tell Unchanged from Changed without asking the AI.
 *
 * One active entry per source_key: a partial unique index over live,
 * active rows. A changed item supersedes its old row (status 'superseded',
 * superseded_by the new id), which leaves the index.
 *
 * Guarded: each column and the indexes are added only when absent. down
 * removes them.
 */

const TABLE = 'franchise_knowledge';

const columnExists = async (sequelize, column, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = :table AND column_name = :column`,
    { replacements: { table: TABLE, column }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await columnExists(sequelize, 'source_key', transaction))) {
        await queryInterface.addColumn(TABLE, 'source_key', { type: Sequelize.STRING(200), allowNull: true }, { transaction });
      }
      if (!(await columnExists(sequelize, 'source_hash', transaction))) {
        await queryInterface.addColumn(TABLE, 'source_hash', { type: Sequelize.STRING(64), allowNull: true }, { transaction });
      }
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${TABLE}_active_source_key
           ON ${TABLE} (source_key)
           WHERE source_key IS NOT NULL AND status = 'active' AND deleted_at IS NULL`,
        { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_source_key
           ON ${TABLE} (source_key) WHERE source_key IS NOT NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(`DROP INDEX IF EXISTS ${TABLE}_active_source_key`, { transaction });
      await sequelize.query(`DROP INDEX IF EXISTS ${TABLE}_source_key`, { transaction });
      if (await columnExists(sequelize, 'source_hash', transaction)) await queryInterface.removeColumn(TABLE, 'source_hash', { transaction });
      if (await columnExists(sequelize, 'source_key', transaction)) await queryInterface.removeColumn(TABLE, 'source_key', { transaction });
    });
  },
};

'use strict';

/**
 * franchise_knowledge.scope and show_id: an entry says which tier it belongs
 * to instead of the Show Bible guessing from its category (review item 6,
 * 2026-10-04; docs/BRAIN_OWNERSHIP.md).
 *
 *   scope    — 'franchise' (the LalaVerse: true for every show) or 'show'
 *              (one show's canon). NOT NULL, default 'franchise'.
 *   show_id  — the show a 'show' entry belongs to; NULL for franchise
 *              entries and for a show entry not yet assigned. No foreign
 *              key: the model is intentionally isolated.
 *
 * Backfill, run only when the column is first added so a re-run never
 * resets a scope set since: the categories the Show Bible treated as
 * show-scoped (technical, brand, locked_decision) become 'show', and so do
 * the Show Brain seeder's entries (source_document 'show-brain-v1.0'), the
 * canon of Styling Adventures with Lala. When that show exists exactly as
 * named, every 'show' entry gets its id; otherwise show_id stays NULL and
 * the Show Bible assigns it.
 *
 * Guarded: each column, the check constraint and the index are added only
 * when absent. down removes them.
 */

const TABLE = 'franchise_knowledge';
const SHOW_CATEGORIES = ['technical', 'brand', 'locked_decision'];
const SHOW_BRAIN_DOCUMENT = 'show-brain-v1.0';
const SHOW_SLUG = 'styling-adventures-with-lala';
const SHOW_NAME = 'Styling Adventures with Lala';

const columnExists = async (sequelize, column, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = :table AND column_name = :column`,
    { replacements: { table: TABLE, column }, transaction });
  return rows.length > 0;
};

module.exports = {
  SHOW_CATEGORIES,
  SHOW_BRAIN_DOCUMENT,

  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const hadScope = await columnExists(sequelize, 'scope', transaction);
      if (!hadScope) {
        await queryInterface.addColumn(TABLE, 'scope',
          { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'franchise' }, { transaction });
      }
      if (!(await columnExists(sequelize, 'show_id', transaction))) {
        await queryInterface.addColumn(TABLE, 'show_id', { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      }
      await sequelize.query(
        `ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${TABLE}_scope_check`, { transaction });
      await sequelize.query(
        `ALTER TABLE ${TABLE} ADD CONSTRAINT ${TABLE}_scope_check CHECK (scope IN ('franchise', 'show'))`,
        { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_show_id ON ${TABLE} (show_id) WHERE show_id IS NOT NULL`,
        { transaction });

      if (hadScope) return;

      await sequelize.query(
        `UPDATE ${TABLE} SET scope = 'show'
          WHERE scope = 'franchise'
            AND (category IN (:categories) OR source_document = :document)`,
        { replacements: { categories: SHOW_CATEGORIES, document: SHOW_BRAIN_DOCUMENT }, transaction });

      const [tables] = await sequelize.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shows'`,
        { transaction });
      if (tables.length === 0) return;
      const [shows] = await sequelize.query(
        `SELECT id FROM shows
          WHERE deleted_at IS NULL AND (slug = :slug OR name ILIKE :name)
          ORDER BY id LIMIT 2`,
        { replacements: { slug: SHOW_SLUG, name: SHOW_NAME }, transaction });
      if (shows.length !== 1) return;
      await sequelize.query(
        `UPDATE ${TABLE} SET show_id = :id WHERE scope = 'show' AND show_id IS NULL`,
        { replacements: { id: shows[0].id }, transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(`DROP INDEX IF EXISTS ${TABLE}_show_id`, { transaction });
      await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${TABLE}_scope_check`, { transaction });
      if (await columnExists(sequelize, 'show_id', transaction)) await queryInterface.removeColumn(TABLE, 'show_id', { transaction });
      if (await columnExists(sequelize, 'scope', transaction)) await queryInterface.removeColumn(TABLE, 'scope', { transaction });
    });
  },
};

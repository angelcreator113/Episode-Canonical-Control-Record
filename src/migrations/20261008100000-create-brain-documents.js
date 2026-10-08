'use strict';

/**
 * brain_documents: the documents read into the Show Bible by ingest-document
 * (franchiseBrainRoutes.js, POST /franchise-brain/ingest-document), listed on
 * its Documents tab and counted in "from N documents" (BrainDocument).
 *
 * The table's only migration, migrations/20260315100000-create-brain-documents.js,
 * is in the dead root tree; .sequelizerc runs ./src/migrations only, so no
 * database built from this tree has the table, and the canon schema capture
 * (docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt) lists none.
 * Every ingest's document row failed (logged, not raised) and the Documents
 * tab read nothing (wiring map, docs/reads/2026-10-06-lalaverse-wiring-map.md
 * §5 finding 5a, fix-list item 19).
 *
 * Guarded: the table is created when absent, with the columns the model and
 * the dead migration name, plus deleted_at. A table already there (the dead
 * migration or a sync ran) only gains deleted_at when it lacks it.
 *
 * down drops the table only when it holds no rows: a table this migration
 * did not create, or documents read in since, are not dropped with it.
 */

const TABLE = 'brain_documents';

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

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
      if (await tableExists(sequelize, TABLE, transaction)) {
        if (!(await columnExists(sequelize, 'deleted_at', transaction))) {
          await queryInterface.addColumn(TABLE, 'deleted_at', { type: Sequelize.DATE, allowNull: true }, { transaction });
        }
        return;
      }
      await queryInterface.createTable(TABLE, {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        source_name: { type: Sequelize.STRING(300), allowNull: false },
        document_text: { type: Sequelize.TEXT, allowNull: false },
        entries_created: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
        ingested_by: { type: Sequelize.STRING(100), allowNull: true, defaultValue: 'manual' },
        ingested_at: { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.literal('NOW()') },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, TABLE))) return;
    const [[{ count }]] = await sequelize.query(`SELECT COUNT(*)::int AS count FROM ${TABLE}`);
    if (count > 0) {
      console.warn(`[migration] ${TABLE} holds ${count} document(s); not dropped`);
      return;
    }
    await queryInterface.dropTable(TABLE);
  },
};

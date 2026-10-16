'use strict';

/**
 * storyteller_books gains the six story fields its model already declares.
 *
 * StorytellerBook declares theme, pov, tone, setting, conflict and stakes,
 * but no migration created them, so a database built only from
 * src/migrations/ fails every book create or read with
 * `column "theme" does not exist` (found 2026-10-16 on a database migrated
 * from scratch). Databases that already carry the columns from an earlier
 * hand change keep them as they are: each column is added only if it is
 * missing.
 *
 * Each column this migration adds is tagged with a column comment, and down
 * removes only the tagged columns, so a column that existed before this
 * migration ran is never dropped by its rollback.
 */

const exists = async (sequelize, sql, replacements) => (await sequelize.query(sql, { replacements }))[0].length > 0;
const columnExists = (sequelize, table, column) => exists(sequelize,
  'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column', { table, column });
const tableExists = (sequelize, name) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name });

const TABLE = 'storyteller_books';
const MARK = 'added by 20261016110000-add-story-fields-to-storyteller-books';

const addedHere = (sequelize, column) => exists(sequelize,
  `SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = :table AND a.attname = :column AND NOT a.attisdropped
      AND col_description(c.oid, a.attnum) = :mark`, { table: TABLE, column, mark: MARK });

const COLUMNS = ['theme', 'pov', 'tone', 'setting', 'conflict', 'stakes'];

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, TABLE))) return;
    const columns = {
      theme: { type: Sequelize.TEXT, allowNull: true },
      pov: { type: Sequelize.STRING(255), allowNull: true },
      tone: { type: Sequelize.TEXT, allowNull: true },
      setting: { type: Sequelize.TEXT, allowNull: true },
      conflict: { type: Sequelize.TEXT, allowNull: true },
      stakes: { type: Sequelize.TEXT, allowNull: true },
    };
    for (const column of COLUMNS) {
      if (await columnExists(sequelize, TABLE, column)) continue;
      await queryInterface.addColumn(TABLE, column, columns[column]);
      await sequelize.query(`COMMENT ON COLUMN ${TABLE}.${column} IS '${MARK}'`);
    }
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, TABLE))) return;
    for (const column of [...COLUMNS].reverse()) {
      if (await addedHere(sequelize, column)) {
        await queryInterface.removeColumn(TABLE, column);
      }
    }
  },
};

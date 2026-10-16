'use strict';

/**
 * storyteller_chapters gains the two columns its model already declares.
 *
 * StorytellerChapter declares sections (JSONB) and chapter_template
 * (STRING(100)), but no migration created them, so a database built only
 * from src/migrations/ fails every chapter create or read with
 * `column "sections" of relation "storyteller_chapters" does not exist`
 * (found 2026-10-15 on a database migrated from scratch). Databases that
 * already carry the columns from an earlier hand change keep them as they
 * are: each column is added only if it is missing.
 *
 * Each column this migration adds is tagged with a column comment, and down
 * removes only the tagged columns, so a column that existed before this
 * migration ran is never dropped by its rollback.
 */

const exists = async (sequelize, sql, replacements) => (await sequelize.query(sql, { replacements }))[0].length > 0;
const columnExists = (sequelize, table, column) => exists(sequelize,
  'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column', { table, column });
const tableExists = (sequelize, name) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name });

const TABLE = 'storyteller_chapters';
const MARK = 'added by 20261016100000-add-sections-and-template-to-storyteller-chapters';

const addedHere = (sequelize, column) => exists(sequelize,
  `SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = :table AND a.attname = :column AND NOT a.attisdropped
      AND col_description(c.oid, a.attnum) = :mark`, { table: TABLE, column, mark: MARK });

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, TABLE))) return;
    const columns = {
      sections: { type: Sequelize.JSONB, allowNull: true, defaultValue: null },
      chapter_template: { type: Sequelize.STRING(100), allowNull: true, defaultValue: null },
    };
    for (const [column, definition] of Object.entries(columns)) {
      if (await columnExists(sequelize, TABLE, column)) continue;
      await queryInterface.addColumn(TABLE, column, definition);
      await sequelize.query(`COMMENT ON COLUMN ${TABLE}.${column} IS '${MARK}'`);
    }
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, TABLE))) return;
    for (const column of ['chapter_template', 'sections']) {
      if (await addedHere(sequelize, column)) {
        await queryInterface.removeColumn(TABLE, column);
      }
    }
  },
};

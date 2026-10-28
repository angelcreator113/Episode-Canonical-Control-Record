'use strict';

/**
 * A1c correction (Evoni, 2026-10-27, decisions 1 and 2 of the Voice Studio
 * B1 review): the episode's script save number.
 *
 *   episodes.script_seq  BIGINT NOT NULL DEFAULT 0
 *
 * services/scriptSave.js adds one, under the episode row lock, on every save
 * that changes the script text (a clear and a restore included); a save of
 * the locks alone, and every other episode edit, leave it. So it only goes
 * up, and two saves never share a number, whatever the clock or the version
 * rows say: the script revision (utils/scriptRevision.js) is a hash of the
 * text and comes back with the text (A -> B -> A); script_seq does not. A
 * record that must know the script was not saved since pins both.
 *
 * Existing rows start at 0. Adding a NOT NULL column with a constant default
 * changes the table's catalog only (PostgreSQL 11+): no rewrite, no scan.
 * down() drops the column. Runs only through the Deploy workflow.
 */

const COLUMN = 'script_seq';

const hasColumn = async (sequelize, transaction) => {
  const [rows] = await sequelize.query(`SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'episodes' AND column_name = :column`, { replacements: { column: COLUMN }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await hasColumn(sequelize, transaction)) return;
      await sequelize.query(`ALTER TABLE episodes ADD COLUMN ${COLUMN} BIGINT NOT NULL DEFAULT 0`, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await hasColumn(sequelize, transaction))) return;
      await sequelize.query(`ALTER TABLE episodes DROP COLUMN ${COLUMN}`, { transaction });
    });
  },
};

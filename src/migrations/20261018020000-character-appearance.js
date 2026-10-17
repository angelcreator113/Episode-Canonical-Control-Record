'use strict';

/**
 * A character's appearance (Evoni, 2026-10-17: "we need an appearance tab
 * and a generator"; services/characterAppearance): registry_characters.
 * appearance JSONB, { summary, face, hair, skin, build, presence, marks,
 * signature_style, palette[], accessories, at_home, going_out, never_wears,
 * why, set_by, set_at, portraits: [{ url, prompt, created_at }] }. Added
 * only when missing and tagged, so down drops it only if this migration
 * added it.
 */

const TABLE = 'registry_characters';
const MARK = 'added by 20261018020000-character-appearance';

const exists = async (sequelize, sql, replacements, transaction) => (await sequelize.query(sql, { replacements, transaction }))[0].length > 0;
const tableExists = (sequelize, t) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name: TABLE }, t);
const columnExists = (sequelize, t) => exists(sequelize,
  "SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = 'appearance'", { table: TABLE }, t);
const ourColumn = (sequelize, t) => exists(sequelize,
  `SELECT 1 FROM pg_description d JOIN pg_attribute a ON a.attrelid = d.objoid AND a.attnum = d.objsubid
    WHERE d.objoid = :table::regclass AND a.attname = 'appearance' AND d.description = :mark`,
  { table: TABLE, mark: MARK }, t);

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction)) || await columnExists(sequelize, transaction)) return;
      await queryInterface.addColumn(TABLE, 'appearance', { type: Sequelize.JSONB, allowNull: true }, { transaction });
      await sequelize.query(`COMMENT ON COLUMN ${TABLE}.appearance IS '${MARK}'`, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, transaction) && await columnExists(sequelize, transaction) && await ourColumn(sequelize, transaction)) {
        await queryInterface.removeColumn(TABLE, 'appearance', { transaction });
      }
    });
  },
};

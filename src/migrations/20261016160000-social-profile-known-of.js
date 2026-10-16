'use strict';

/**
 * Known of (Evoni, 2026-10-16: "Maren is a public figure with 2M followers,
 * and Lala should be able to see her public posts before they meet. Public
 * posts can appear in Lala's feed before the meeting, while DMs, replies to
 * Lala and relationship moves still wait until they've met";
 * services/pulseReveals).
 *
 *   social_profiles.lala_knows_of   true for a public figure Lala knows of
 *                                   before they meet. Default false.
 *   Maren Elise Volk (@slowsift) is set to true.
 *
 * The column is added only when missing and tagged, so down drops it only
 * if this migration added it (Maren's flag goes with it).
 */

const TABLE = 'social_profiles';
const MARK = 'added by 20261016160000-social-profile-known-of';

const exists = async (sequelize, sql, replacements, transaction) => (await sequelize.query(sql, { replacements, transaction }))[0].length > 0;
const tableExists = (sequelize, t) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name: TABLE }, t);
const columnExists = (sequelize, t) => exists(sequelize,
  "SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = 'lala_knows_of'", { table: TABLE }, t);
const ourColumn = (sequelize, t) => exists(sequelize,
  `SELECT 1 FROM pg_description d JOIN pg_attribute a ON a.attrelid = d.objoid AND a.attnum = d.objsubid
    WHERE d.objoid = :table::regclass AND a.attname = 'lala_knows_of' AND d.description = :mark`,
  { table: TABLE, mark: MARK }, t);

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      if (!(await columnExists(sequelize, transaction))) {
        await queryInterface.addColumn(TABLE, 'lala_knows_of', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }, { transaction });
        await sequelize.query(`COMMENT ON COLUMN ${TABLE}.lala_knows_of IS '${MARK}'`, { transaction });
      }
      await sequelize.query(
        `UPDATE ${TABLE} SET lala_knows_of = true WHERE LOWER(LTRIM(handle, '@')) = 'slowsift' AND deleted_at IS NULL`, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      if (await columnExists(sequelize, transaction) && await ourColumn(sequelize, transaction)) {
        await queryInterface.removeColumn(TABLE, 'lala_knows_of', { transaction });
      }
    });
  },
};

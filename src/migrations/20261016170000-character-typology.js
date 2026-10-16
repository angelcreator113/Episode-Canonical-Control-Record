'use strict';

/**
 * A character's typology seed (Character Consistency Engine step 6a;
 * services/characterTypology): registry_characters.typology JSONB,
 * { enneagram: { type, wing }, mbti, why, set_by, set_at }. Added only when
 * missing and tagged, so down drops it only if this migration added it.
 */

const TABLE = 'registry_characters';
const MARK = 'added by 20261016170000-character-typology';

const exists = async (sequelize, sql, replacements, transaction) => (await sequelize.query(sql, { replacements, transaction }))[0].length > 0;
const tableExists = (sequelize, t) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name: TABLE }, t);
const columnExists = (sequelize, t) => exists(sequelize,
  "SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = 'typology'", { table: TABLE }, t);
const ourColumn = (sequelize, t) => exists(sequelize,
  `SELECT 1 FROM pg_description d JOIN pg_attribute a ON a.attrelid = d.objoid AND a.attnum = d.objsubid
    WHERE d.objoid = :table::regclass AND a.attname = 'typology' AND d.description = :mark`,
  { table: TABLE, mark: MARK }, t);

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction)) || await columnExists(sequelize, transaction)) return;
      await queryInterface.addColumn(TABLE, 'typology', { type: Sequelize.JSONB, allowNull: true }, { transaction });
      await sequelize.query(`COMMENT ON COLUMN ${TABLE}.typology IS '${MARK}'`, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, transaction) && await columnExists(sequelize, transaction) && await ourColumn(sequelize, transaction)) {
        await queryInterface.removeColumn(TABLE, 'typology', { transaction });
      }
    });
  },
};

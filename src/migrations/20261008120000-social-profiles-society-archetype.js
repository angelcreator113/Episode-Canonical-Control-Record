'use strict';

/**
 * social_profiles.society_archetype (wiring map,
 * docs/reads/2026-10-06-lalaverse-wiring-map.md, fix-list item 26; Evoni's
 * ruling, 2026-10-08: "Feed also uses your 15"): the Society tab's
 * archetype a LalaVerse Feed profile was given (src/services/
 * societyArchetypes.js), by name, beside the Feed's own ten in archetype.
 * A name, not an ENUM: Evoni edits the list on the Society tab. Profiles
 * made before stay NULL. Nullable VARCHAR(100); guarded; down removes it.
 */

const TABLE = 'social_profiles';
const COLUMN = 'society_archetype';

const columnExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = :table AND column_name = :column`,
    { replacements: { table: TABLE, column: COLUMN }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await columnExists(sequelize, transaction))) {
        await queryInterface.addColumn(TABLE, COLUMN, { type: Sequelize.STRING(100), allowNull: true }, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await columnExists(sequelize, transaction)) await queryInterface.removeColumn(TABLE, COLUMN, { transaction });
    });
  },
};

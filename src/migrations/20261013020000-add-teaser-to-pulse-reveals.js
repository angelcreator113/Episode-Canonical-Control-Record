'use strict';

/**
 * pulse_reveals: the teaser image (Task #3034; Evoni, 2026-10-12: "Teasers:
 * cropped by default … Use blur when concealing the full reveal matters.
 * Create the teaser from the existing image"; docs/reads/2026-10-12-pulse-decisions-read.md §4).
 *
 *   teaser_style  crop | blur, default crop
 *   crop_json     the detail, as fractions of the image: { x, y, w, h }
 *   teaser_url    the teaser image, cut once from the existing image
 *                 (services/pulseTeasers.js); a teaser response sends this
 *                 in place of the full image URL
 *
 * Additive and guarded: each column is added only when absent. down removes
 * them.
 */

const TABLE = 'pulse_reveals';
const COLUMNS = ['teaser_style', 'crop_json', 'teaser_url'];

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable(TABLE, { transaction });
      if (!table.teaser_style) {
        await queryInterface.addColumn(TABLE, 'teaser_style', { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'crop' }, { transaction });
      }
      if (!table.crop_json) await queryInterface.addColumn(TABLE, 'crop_json', { type: Sequelize.JSONB, allowNull: true }, { transaction });
      if (!table.teaser_url) await queryInterface.addColumn(TABLE, 'teaser_url', { type: Sequelize.TEXT, allowNull: true }, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable(TABLE, { transaction });
      for (const column of COLUMNS) if (table[column]) await queryInterface.removeColumn(TABLE, column, { transaction });
    });
  },
};

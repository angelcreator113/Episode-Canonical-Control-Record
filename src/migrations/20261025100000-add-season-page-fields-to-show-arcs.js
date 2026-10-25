'use strict';

/**
 * The Season page (Evoni, 2026-10-25, from her mockup): a season has a cover
 * picture, a start and end date, and a logline beside its title, tagline and
 * description. Edited in the Edit season form (seasonSetupService).
 *
 *   show_arcs.cover_url   TEXT, nullable: the hero's picture, chosen from Files.
 *   show_arcs.starts_on   DATE, nullable: the season's first day.
 *   show_arcs.ends_on     DATE, nullable: its last day (not before starts_on;
 *                         the service refuses the wrong order).
 *   show_arcs.logline     TEXT, nullable: the season in a sentence.
 *
 * A part's picture lives in its entry of the phases JSONB (picture_url), so
 * it needs no column. show_arcs has no JSON column for season-level fields
 * (phases is the list of parts; debt and the log are their own lists), hence
 * the columns.
 *
 * Added columns, so no deleted_at (the table has its own). down drops all four.
 */

const COLUMNS = ['cover_url', 'starts_on', 'ends_on', 'logline'];

const columnExists = async (sequelize, column, transaction) => {
  const [rows] = await sequelize.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'show_arcs' AND column_name = :column",
    { replacements: { column }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    const types = {
      cover_url: Sequelize.TEXT,
      starts_on: Sequelize.DATEONLY,
      ends_on: Sequelize.DATEONLY,
      logline: Sequelize.TEXT,
    };
    await sequelize.transaction(async (transaction) => {
      for (const column of COLUMNS) {
        if (!(await columnExists(sequelize, column, transaction))) {
          await queryInterface.addColumn('show_arcs', column, { type: types[column], allowNull: true }, { transaction });
        }
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      for (const column of [...COLUMNS].reverse()) {
        if (await columnExists(sequelize, column, transaction)) {
          await queryInterface.removeColumn('show_arcs', column, { transaction });
        }
      }
    });
  },
};

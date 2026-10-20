'use strict';

/**
 * episode_raw_clips.is_favorite and episode_raw_clips.start_line (Evoni,
 * 2026-10-20, Teleprompter batch 2):
 *   is_favorite  the take she starred for its beat; at most one per beat,
 *                kept so by rawClipsService.updateClip, not by the database
 *   start_line   the line within the beat a teleprompter take was read from
 *                (0 = the top); null for clips not recorded there
 *
 * Its own migration because the earlier episode_raw_clips migrations have
 * merged. Guarded: each column is added only when absent; down drops each
 * one that is there. Until this runs, the service lists clips without the
 * two fields and refuses to set them with a plain message.
 */

const TABLE = 'episode_raw_clips';

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
      if (!(await columnExists(sequelize, 'is_favorite', transaction))) {
        await queryInterface.addColumn(TABLE, 'is_favorite', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }, { transaction });
      }
      if (!(await columnExists(sequelize, 'start_line', transaction))) {
        await queryInterface.addColumn(TABLE, 'start_line', { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await columnExists(sequelize, 'start_line', transaction)) {
        await queryInterface.removeColumn(TABLE, 'start_line', { transaction });
      }
      if (await columnExists(sequelize, 'is_favorite', transaction)) {
        await queryInterface.removeColumn(TABLE, 'is_favorite', { transaction });
      }
    });
  },
};

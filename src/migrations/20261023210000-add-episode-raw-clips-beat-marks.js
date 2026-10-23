'use strict';

/**
 * episode_raw_clips.beat_marks (Evoni, 2026-10-23, "Record whole episode"):
 *   beat_marks  a full-episode teleprompter take's beat markers, JSONB
 *               [{ beat, t }]: the beat (1-14) and the second into the take
 *               at which its heading reached the reading line; null for
 *               every other clip. Checked by rawClipsService.readBeatMarks
 *               (at most 30, each beat once, t from 0 to 36000), not by the
 *               database.
 *
 * Its own migration because the earlier episode_raw_clips migrations have
 * merged. Guarded: the column is added only when absent; down drops it only
 * when there. Until this runs, the service lists clips without beat_marks
 * and refuses to set it with a plain message (409); the teleprompter still
 * saves the take and offers the markers as a download.
 */

const TABLE = 'episode_raw_clips';
const COLUMN = 'beat_marks';

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
        await queryInterface.addColumn(TABLE, COLUMN, { type: Sequelize.JSONB, allowNull: true }, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await columnExists(sequelize, transaction)) {
        await queryInterface.removeColumn(TABLE, COLUMN, { transaction });
      }
    });
  },
};

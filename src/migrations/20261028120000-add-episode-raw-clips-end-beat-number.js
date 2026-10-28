'use strict';

/**
 * episode_raw_clips.end_beat_number (Evoni, 2026-10-28: "show where a video
 * starts and ends"):
 *   end_beat_number  the beat an uploaded clip with no beat markers ends on,
 *                    a whole number from 1 to 14, or null (the clip is one
 *                    beat, beat_number). The card then reads "Beat 1 →
 *                    Beat 11". That it is at least beat_number is checked by
 *                    rawClipsService.updateClip, not by the database, so
 *                    moving a clip's start beat never fails on it.
 *
 * Its own migration because the earlier episode_raw_clips migrations have
 * merged. The table already has deleted_at (20261017150000). Guarded: the
 * column and its 1-14 check are added only when absent, so it can run
 * twice; down removes them only when there. Until this runs, the service
 * lists clips without end_beat_number and refuses to set it with a plain
 * message (409); everything else works as before.
 */

const TABLE = 'episode_raw_clips';
const COLUMN = 'end_beat_number';
const CHECK = 'episode_raw_clips_end_beat_number_range';

const columnExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = :table AND column_name = :column`,
    { replacements: { table: TABLE, column: COLUMN }, transaction });
  return rows.length > 0;
};

const checkExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = :table AND c.conname = :check`,
    { replacements: { table: TABLE, check: CHECK }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await columnExists(sequelize, transaction))) {
        await queryInterface.addColumn(TABLE, COLUMN, { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      }
      if (!(await checkExists(sequelize, transaction))) {
        await sequelize.query(
          `ALTER TABLE ${TABLE} ADD CONSTRAINT ${CHECK} CHECK (${COLUMN} IS NULL OR (${COLUMN} BETWEEN 1 AND 14))`,
          { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await checkExists(sequelize, transaction)) {
        await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT ${CHECK}`, { transaction });
      }
      if (await columnExists(sequelize, transaction)) {
        await queryInterface.removeColumn(TABLE, COLUMN, { transaction });
      }
    });
  },
};

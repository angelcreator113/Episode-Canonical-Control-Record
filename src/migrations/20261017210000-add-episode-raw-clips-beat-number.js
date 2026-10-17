'use strict';

/**
 * episode_raw_clips.beat_number: the scene (canonical beat 1-14) a raw clip
 * is linked to, set by Evoni in Files once a clip is edited down; null until
 * then (Evoni, 2026-10-17). Production's scene workspace plays a scene's
 * linked clip and takes the scene's length from it.
 *
 * Its own migration because 20261017150000-create-episode-raw-clips.js has
 * merged. Guarded: the column and its check are added only when absent;
 * down drops them.
 */

const TABLE = 'episode_raw_clips';
const CHECK = `${TABLE}_beat_range`;

const columnExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = :table AND column_name = 'beat_number'`,
    { replacements: { table: TABLE }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await columnExists(sequelize, transaction)) return;
      await queryInterface.addColumn(TABLE, 'beat_number', { type: Sequelize.SMALLINT, allowNull: true }, { transaction });
      await sequelize.query(
        `ALTER TABLE ${TABLE} ADD CONSTRAINT ${CHECK} CHECK (beat_number IS NULL OR beat_number BETWEEN 1 AND 14)`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await columnExists(sequelize, transaction))) return;
      await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${CHECK}`, { transaction });
      await queryInterface.removeColumn(TABLE, 'beat_number', { transaction });
    });
  },
};

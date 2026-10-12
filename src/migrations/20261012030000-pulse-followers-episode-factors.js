'use strict';

/**
 * The episode follower change (Task #2956; The Pulse spec §8 "Episode
 * follower change: proposed when an episode is completed … approved by
 * Evoni"). Adds to pulse_followers (migration 20261012010000):
 *
 *   factors_json   why a proposed change is what it is, kept for Review
 *                  (an episode's tier, score, its posts' likes, the
 *                  followers it is a share of)
 *   pulse_followers_one_per_episode   one episode change per profile per
 *                  episode, so completing twice proposes once
 *
 * Additive only. Guarded: each part is added only when absent. down
 * removes both.
 */

const TABLE = 'pulse_followers';
const INDEX = 'pulse_followers_one_per_episode';

const columnExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = 'factors_json'`,
    { replacements: { t: TABLE }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await columnExists(sequelize, transaction))) {
        await queryInterface.addColumn(TABLE, 'factors_json', { type: Sequelize.JSONB, allowNull: true }, { transaction });
      }
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX} ON ${TABLE} (show_id, social_profile_id, cause_id)
          WHERE cause = 'episode' AND deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(`DROP INDEX IF EXISTS ${INDEX}`, { transaction });
      if (await columnExists(sequelize, transaction)) await queryInterface.removeColumn(TABLE, 'factors_json', { transaction });
    });
  },
};

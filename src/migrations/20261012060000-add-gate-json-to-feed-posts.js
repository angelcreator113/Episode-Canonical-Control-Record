'use strict';

/**
 * feed_posts.gate_json: the quality gate's result for an engine draft (Task
 * #2969; The Pulse spec §7 "Quality gate: a second check scores each draft
 * for voice match and canon"; services/pulseGate.js). Review shows it on
 * the post's card: { pass, voice, flags, review, checked_at }. Null for
 * every post the engine did not draft.
 *
 * One nullable column, added only when absent. down removes it.
 */

const columnExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'feed_posts' AND column_name = 'gate_json'`,
    { transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await columnExists(sequelize, transaction)) return;
      await queryInterface.addColumn('feed_posts', 'gate_json', { type: Sequelize.JSONB, allowNull: true }, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await columnExists(sequelize, transaction)) await queryInterface.removeColumn('feed_posts', 'gate_json', { transaction });
    });
  },
};

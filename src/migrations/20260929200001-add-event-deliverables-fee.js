'use strict';

/**
 * event_deliverables.fee (deal build PR 1, M-2; docs/DEAL_DESIGN.md §8;
 * Task #2319): the Prime Coins a deliverable pays on approval. Nullable and
 * read by no code yet; the content fee is paid from it in the payout PR.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('event_deliverables');
    if (!cols.fee) {
      await queryInterface.addColumn('event_deliverables', 'fee', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Prime Coins paid on approval (Task #2319)',
      });
    }
  },

  async down(queryInterface) {
    const cols = await queryInterface.describeTable('event_deliverables');
    if (cols.fee) await queryInterface.removeColumn('event_deliverables', 'fee');
  },
};

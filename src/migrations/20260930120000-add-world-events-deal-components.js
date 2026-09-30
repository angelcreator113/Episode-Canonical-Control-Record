'use strict';

/**
 * Deal components on world_events (deal build PR 3; Task #2341). Evoni's
 * Deal PR 3 ruling (2026-09-30; docs/EVENT_EPISODE_FLOW.md §8(cc)):
 *
 *   1. "A Brand Partnership Base is its own guaranteed deal component, not an
 *      appearance fee. ... If the partnership also requires Lala to
 *      attend/appear, the Paid Appearance anchor is added separately."
 *   4. "Performance Booking with the Performance anchor plus separately
 *      required deliverables."
 *
 *   partnership_base_fee — Prime Coins, the partnership's guaranteed base
 *   performance_fee      — Prime Coins, the performance booking's fee
 *   appearance_required  — a brand partnership that also requires Lala to
 *                          attend/appear; only then does it carry an
 *                          appearance_fee (default false)
 *
 * All three are nullable or defaulted, and no existing row changes meaning:
 * appearance_required defaults to false, and the two fees are null.
 *
 * Guarded: each column is added only if describeTable lacks it; down removes
 * only these three.
 */
const COLUMNS = (Sequelize) => ({
  partnership_base_fee: { type: Sequelize.INTEGER, allowNull: true, comment: 'Brand partnership base, Prime Coins (Task #2341)' },
  performance_fee: { type: Sequelize.INTEGER, allowNull: true, comment: 'Performance booking fee, Prime Coins (Task #2341)' },
  appearance_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false, comment: 'Brand partnership also requires an appearance (Task #2341)' },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('world_events');
    for (const [name, spec] of Object.entries(COLUMNS(Sequelize))) {
      if (!cols[name]) await queryInterface.addColumn('world_events', name, spec);
    }
  },

  async down(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('world_events');
    for (const name of Object.keys(COLUMNS(Sequelize))) {
      if (cols[name]) await queryInterface.removeColumn('world_events', name);
    }
  },
};

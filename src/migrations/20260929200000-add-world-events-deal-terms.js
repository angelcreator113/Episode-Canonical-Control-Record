'use strict';

/**
 * Deal terms on world_events (deal build PR 1, M-1; docs/DEAL_DESIGN.md §8;
 * Task #2319). Five nullable columns, none read by any code yet: deal_type
 * is null on every event, and a null deal_type keeps today's finalize and
 * Complete (DEAL_DESIGN.md §9).
 *
 *   deal_type       — one of eight (WorldEvent.DEAL_TYPES, checked by the
 *                     model's isIn, not a Postgres ENUM)
 *   appearance_fee  — Prime Coins paid for showing up
 *   bonus_terms     — a performance bonus the accepted deal contains, if any
 *                     (Q12, §8(cc): a bonus exists only when the deal says so)
 *   gifted_value    — non-cash value of gifted or comped product (Q4)
 *   pricing_version — the deal_rate_anchors version the terms were priced from
 *
 * Guarded: each column is added only if describeTable lacks it; down removes
 * only these five.
 */
const COLUMNS = (Sequelize) => ({
  deal_type: { type: Sequelize.STRING(30), allowNull: true, comment: 'Deal type (Task #2319); null = legacy event' },
  appearance_fee: { type: Sequelize.INTEGER, allowNull: true, comment: 'Prime Coins for the appearance (Task #2319)' },
  bonus_terms: { type: Sequelize.JSONB, allowNull: true, comment: 'Contractual performance bonus, if any (Task #2319)' },
  gifted_value: { type: Sequelize.INTEGER, allowNull: true, comment: 'Non-cash gifted/comped value (Task #2319)' },
  pricing_version: { type: Sequelize.INTEGER, allowNull: true, comment: 'deal_rate_anchors version used (Task #2319)' },
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

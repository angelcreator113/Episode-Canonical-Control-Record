'use strict';

/**
 * event_costs (deal build PR 1, M-4; docs/DEAL_DESIGN.md §8; Task #2319):
 * an event's itemised costs, and who pays each. Empty and read by no code
 * yet; the itemised-costs PR writes and charges them.
 *
 *   kind    — entry | travel | glam | styling | accommodation | extras | other
 *   paid_by — lala | host | brand
 *
 * Travel is a reimbursement, not income (Q4, §8(cc)): a travel row a host
 * or brand pays is a cost Lala does not bear, never a payout.
 *
 * Both are STRINGs checked by the model's isIn (EventCost.js). Guarded by
 * showAllTables; down drops the table.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    if (!tables.includes('event_costs')) {
      await queryInterface.createTable('event_costs', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
        event_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'world_events', key: 'id' },
          onDelete: 'CASCADE',
        },
        kind: { type: Sequelize.STRING(20), allowNull: false },
        label: { type: Sequelize.STRING(200), allowNull: true },
        amount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        paid_by: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'lala' },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });
    }
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS event_costs_event_id ON event_costs (event_id)');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS event_costs');
  },
};

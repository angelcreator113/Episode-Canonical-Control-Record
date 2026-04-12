'use strict';

/**
 * Create financial_transactions table — the execution ledger.
 *
 * Every coin movement (income, expense, reward, deduction) gets a row here.
 * This is the transactional layer that was missing — connects events, wardrobe,
 * social tasks, and brand deals to actual coin balance changes.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('financial_transactions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      show_id: { type: Sequelize.UUID, allowNull: false },
      episode_id: { type: Sequelize.UUID, allowNull: true },
      event_id: { type: Sequelize.UUID, allowNull: true },

      // Transaction type
      type: {
        type: Sequelize.STRING(30), allowNull: false,
        // income | expense | reward | deduction | refund
      },
      category: {
        type: Sequelize.STRING(50), allowNull: false,
        // event_entry | event_payment | brand_deal | content_revenue |
        // wardrobe_purchase | wardrobe_rental | social_task_reward |
        // styling_extras | outfit_bonus | tip | gift
      },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },

      // Reference to what generated this transaction
      source_type: { type: Sequelize.STRING(50), allowNull: true }, // event | wardrobe | social_task | brand_deal
      source_id: { type: Sequelize.UUID, allowNull: true },         // ID of the source record
      source_name: { type: Sequelize.STRING(255), allowNull: true }, // Human-readable source name

      // Balance tracking
      balance_before: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      balance_after: { type: Sequelize.DECIMAL(10, 2), allowNull: true },

      // Metadata
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },

      // Status: pending transactions from episode generation, executed when finalized
      status: {
        type: Sequelize.STRING(20), allowNull: false, defaultValue: 'executed',
        // pending | executed | reversed
      },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    }).catch(() => { /* table may already exist */ });

    // Indexes
    await queryInterface.addIndex('financial_transactions', ['show_id'], { name: 'idx_ft_show' }).catch(() => {});
    await queryInterface.addIndex('financial_transactions', ['episode_id'], { name: 'idx_ft_episode' }).catch(() => {});
    await queryInterface.addIndex('financial_transactions', ['event_id'], { name: 'idx_ft_event' }).catch(() => {});
    await queryInterface.addIndex('financial_transactions', ['status'], { name: 'idx_ft_status' }).catch(() => {});
    await queryInterface.addIndex('financial_transactions', ['created_at'], { name: 'idx_ft_created' }).catch(() => {});

    // Also add source enum value for financial transactions
    try {
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_character_state_history_source" ADD VALUE IF NOT EXISTS 'financial'`
      );
    } catch { /* enum value may already exist */ }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('financial_transactions').catch(() => {});
  },
};

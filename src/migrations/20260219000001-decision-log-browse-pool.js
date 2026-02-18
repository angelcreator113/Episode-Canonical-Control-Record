'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // ── decision_log table ──────────────────────────────────
    await queryInterface.createTable('decision_log', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'tier_override | evaluation_accepted | autofix_accepted | browse_pool | style_adjust | …',
      },
      episode_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'episodes', key: 'id' },
        onDelete: 'SET NULL',
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'shows', key: 'id' },
        onDelete: 'SET NULL',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      context_json: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Snapshot of state at decision time',
      },
      decision_json: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'What was chosen',
      },
      alternatives_json: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Options that were NOT chosen',
      },
      confidence: {
        type: Sequelize.FLOAT,
        allowNull: true,
        comment: '0-1 confidence if AI-assisted',
      },
      source: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'user',
        comment: 'user | ai | system',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Indexes
    await queryInterface.addIndex('decision_log', ['type']);
    await queryInterface.addIndex('decision_log', ['episode_id']);
    await queryInterface.addIndex('decision_log', ['show_id']);
    await queryInterface.addIndex('decision_log', ['created_at']);
    await queryInterface.addIndex('decision_log', ['source']);

    // ── browse_pool_json on episodes ────────────────────────
    await queryInterface.addColumn('episodes', 'browse_pool_json', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Generated closet-browse pool for this episode',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('episodes', 'browse_pool_json');
    await queryInterface.dropTable('decision_log');
  },
};

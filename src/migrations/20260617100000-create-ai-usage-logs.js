'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ai_usage_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      route_name: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      model_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      input_tokens: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      output_tokens: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      cache_creation_input_tokens: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      cache_read_input_tokens: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      cost_usd: {
        type: Sequelize.DECIMAL(10, 6),
        defaultValue: 0,
      },
      duration_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      is_error: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      error_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('ai_usage_logs', ['created_at']);
    await queryInterface.addIndex('ai_usage_logs', ['model_name']);
    await queryInterface.addIndex('ai_usage_logs', ['route_name']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_usage_logs');
  },
};

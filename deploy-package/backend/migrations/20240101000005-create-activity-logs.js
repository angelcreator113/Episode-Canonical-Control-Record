'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('activity_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Cognito user ID',
      },
      actionType: {
        type: Sequelize.ENUM('view', 'create', 'edit', 'delete', 'download', 'upload'),
        allowNull: false,
      },
      resourceType: {
        type: Sequelize.ENUM('episode', 'thumbnail', 'metadata', 'processing'),
        allowNull: false,
      },
      resourceId: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      oldValues: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      newValues: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      ipAddress: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      userAgent: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      timestamp: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('activity_logs', {
      fields: ['userId', 'timestamp'],
      name: 'idx_user_timestamp',
    });

    await queryInterface.addIndex('activity_logs', {
      fields: ['resourceType', 'resourceId'],
      name: 'idx_resource',
    });

    await queryInterface.addIndex('activity_logs', {
      fields: ['actionType'],
      name: 'idx_action_type',
    });

    await queryInterface.addIndex('activity_logs', {
      fields: ['timestamp'],
      name: 'idx_timestamp',
    });
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.dropTable('activity_logs');
  },
};

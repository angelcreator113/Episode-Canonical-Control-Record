'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('processing_queues', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      episodeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'episodes',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      jobType: {
        type: Sequelize.ENUM('thumbnail_generation', 'metadata_extraction', 'transcription'),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
        defaultValue: 'pending',
        allowNull: false,
      },
      sqsMessageId: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
      },
      sqsReceiptHandle: {
        type: Sequelize.STRING(1024),
        allowNull: true,
      },
      jobConfig: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      retryCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      maxRetries: {
        type: Sequelize.INTEGER,
        defaultValue: 3,
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('processing_queues', {
      fields: ['episodeId', 'status'],
      name: 'idx_episode_status',
    });

    await queryInterface.addIndex('processing_queues', {
      fields: ['jobType', 'status'],
      name: 'idx_job_status',
    });

    await queryInterface.addIndex('processing_queues', {
      fields: ['createdAt'],
      name: 'idx_created_at',
    });

    await queryInterface.addIndex('processing_queues', {
      fields: ['sqsMessageId'],
      name: 'idx_sqs_message_id',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('processing_queues');
  },
};

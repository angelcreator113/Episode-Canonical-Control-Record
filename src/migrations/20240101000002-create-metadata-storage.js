'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('metadata_storage', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      episodeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'episodes',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      extractedText: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      scenesDetected: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      sentimentAnalysis: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      visualObjects: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      transcription: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      categories: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      extractionTimestamp: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      processingDurationSeconds: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('metadata_storage', {
      fields: ['episodeId'],
      name: 'idx_metadata_episode_id',
    });
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.dropTable('metadata_storage');
  },
};

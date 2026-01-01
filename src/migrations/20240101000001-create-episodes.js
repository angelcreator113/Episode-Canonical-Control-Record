'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('episodes', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      showName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      seasonNumber: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      episodeNumber: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      episodeTitle: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      airDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      plotSummary: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      director: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      writer: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      durationMinutes: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      rating: {
        type: Sequelize.DECIMAL(3, 1),
        allowNull: true,
      },
      genre: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      thumbnailUrl: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      posterUrl: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      videoUrl: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      rawVideoS3Key: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      processedVideoS3Key: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      metadataJsonS3Key: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      processingStatus: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
        defaultValue: 'pending',
        allowNull: false,
      },
      uploadDate: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
      lastModified: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Create indexes
    await queryInterface.addIndex('episodes', {
      fields: ['showName', 'seasonNumber', 'episodeNumber'],
      unique: true,
      name: 'idx_show_season_episode',
    });

    await queryInterface.addIndex('episodes', {
      fields: ['airDate'],
      name: 'idx_air_date',
    });

    await queryInterface.addIndex('episodes', {
      fields: ['processingStatus'],
      name: 'idx_processing_status',
    });

    await queryInterface.addIndex('episodes', {
      fields: ['deletedAt'],
      name: 'idx_deleted_at',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('episodes');
  },
};

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('episodes', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      show_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      season_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      episode_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'draft',
      },
      episode_title: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      air_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      plot_summary: {
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
      duration_minutes: {
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
      thumbnail_url: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      poster_url: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      video_url: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      raw_video_s3_key: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      processed_video_s3_key: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      metadata_json_s3_key: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      processing_status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
        defaultValue: 'pending',
        allowNull: false,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      upload_date: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
      last_modified: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Create indexes
    await queryInterface.addIndex('episodes', {
      fields: ['show_name', 'season_number', 'episode_number'],
      unique: true,
      name: 'idx_show_season_episode',
    });

    await queryInterface.addIndex('episodes', {
      fields: ['air_date'],
      name: 'idx_air_date',
    });

    await queryInterface.addIndex('episodes', {
      fields: ['processing_status'],
      name: 'idx_processing_status',
    });

    await queryInterface.addIndex('episodes', {
      fields: ['deleted_at'],
      name: 'idx_deleted_at',
    });

    await queryInterface.addIndex('episodes', {
      fields: ['show_id'],
      name: 'idx_show_id',
    });
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.dropTable('episodes');
  },
};

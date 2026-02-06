'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('scene_library', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'shows',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Show this scene belongs to',
      },
      video_asset_url: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'S3 URL to the video file',
      },
      thumbnail_url: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'S3 URL to the thumbnail',
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Scene title/name',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Scene description',
      },
      characters: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Characters appearing in this scene',
      },
      tags: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Tags for organization (intro clip, b-roll, transition, etc.)',
      },
      duration_seconds: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
        comment: 'Video duration in seconds (auto-extracted)',
      },
      resolution: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Video resolution (e.g., 1920x1080)',
      },
      file_size_bytes: {
        type: Sequelize.BIGINT,
        allowNull: true,
        comment: 'File size in bytes',
      },
      processing_status: {
        type: Sequelize.ENUM('uploading', 'processing', 'ready', 'failed'),
        allowNull: false,
        defaultValue: 'uploading',
        comment: 'Processing status of the video',
      },
      processing_error: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Error message if processing failed',
      },
      s3_key: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'S3 object key for the video file',
      },
      created_by: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'User who created this scene',
      },
      updated_by: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'User who last updated this scene',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes for performance
    await queryInterface.addIndex('scene_library', ['show_id']);
    await queryInterface.addIndex('scene_library', ['processing_status']);
    await queryInterface.addIndex('scene_library', ['created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('scene_library');
  },
};

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('thumbnails', {
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
      s3Bucket: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      s3Key: {
        type: Sequelize.STRING(512),
        allowNull: false,
        unique: true,
      },
      fileSizeBytes: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      mimeType: {
        type: Sequelize.ENUM('image/jpeg', 'image/png', 'image/webp', 'image/gif'),
        defaultValue: 'image/jpeg',
      },
      widthPixels: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      heightPixels: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      format: {
        type: Sequelize.ENUM('thumbnail', 'poster', 'cover'),
        defaultValue: 'thumbnail',
      },
      thumbnailType: {
        type: Sequelize.ENUM('primary', 'cover', 'poster', 'frame'),
        defaultValue: 'primary',
      },
      positionSeconds: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      generatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      qualityRating: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'excellent'),
        allowNull: true,
      },
    });

    await queryInterface.addIndex('thumbnails', {
      fields: ['episodeId'],
      name: 'idx_thumbnail_episode_id',
    });

    await queryInterface.addIndex('thumbnails', {
      fields: ['s3Key'],
      unique: true,
      name: 'idx_thumbnail_s3_key',
    });

    await queryInterface.addIndex('thumbnails', {
      fields: ['thumbnailType', 'episodeId'],
      name: 'idx_thumbnail_type_episode',
    });
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.dropTable('thumbnails');
  },
};

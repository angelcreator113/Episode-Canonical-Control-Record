'use strict';
const { DataTypes } = require('sequelize');

/**
 * Asset Model
 * Represents all media assets (images, videos) including wardrobe items
 */
module.exports = (sequelize) => {
  const Asset = sequelize.define(
    'Asset',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      asset_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Type of asset (PROMO_LALA, CLOTHING_DRESS, etc.)',
      },
      approval_status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'PENDING',
        comment: 'Approval status: PENDING, APPROVED, REJECTED',
      },
      s3_key_raw: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      s3_url_raw: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      file_size_bytes: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      s3_key_processed: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      s3_url_processed: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      processed_file_size_bytes: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      width: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      height: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      media_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'image',
        comment: 'Media type: image, video',
      },
      duration_seconds: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      video_codec: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      audio_codec: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      bitrate: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      processing_job_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      processing_error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      processed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      s3_key: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      url: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Additional metadata including wardrobe details, episodeId, etc.',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deleted_at',
      },
    },
    {
      tableName: 'assets',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      paranoid: false,
    }
  );

  // Define associations
  Asset.associate = function (models) {
    // Many-to-many with Episodes through episode_assets junction table
    Asset.belongsToMany(models.Episode, {
      through: models.EpisodeAsset,
      foreignKey: 'asset_id',
      otherKey: 'episode_id',
      as: 'episodes',
    });
  };

  return Asset;
};

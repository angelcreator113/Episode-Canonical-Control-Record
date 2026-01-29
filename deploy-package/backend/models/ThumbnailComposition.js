'use strict';
const { DataTypes } = require('sequelize');

/**
 * ThumbnailComposition Model
 * Stores composition metadata for generated thumbnails with versioning support
 * Schema matches migrations with versioning columns: current_version, version_history, last_modified_by, modification_timestamp
 */
module.exports = (sequelize) => {
  const ThumbnailComposition = sequelize.define(
    'ThumbnailComposition',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      template_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      background_frame_asset_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      lala_asset_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      guest_asset_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      justawomen_asset_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      selected_formats: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'draft',
      },
      created_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      // Versioning columns
      current_version: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      version_history: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      last_modified_by: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      modification_timestamp: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      // Template tracking
      template_version: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Frozen template version at generation time',
      },
      // Generation tracking
      generation_status: {
        type: DataTypes.ENUM('DRAFT', 'GENERATING', 'COMPLETED', 'FAILED'),
        allowNull: false,
        defaultValue: 'DRAFT',
        comment: 'Current generation status',
      },
      validation_errors: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Array of validation errors (missing required assets, etc.)',
      },
      validation_warnings: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Array of validation warnings (missing optional assets, etc.)',
      },
      generated_formats: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Map of format to S3 URL for generated thumbnails',
      },
    },
    {
      tableName: 'thumbnail_compositions',
      timestamps: false,
      underscored: true,
    }
  );

  // Define associations
  ThumbnailComposition.associate = function (models) {
    // Composition belongs to an Episode
    ThumbnailComposition.belongsTo(models.Episode, {
      foreignKey: 'episode_id',
      as: 'episode',
    });

    // Composition uses a Template
    ThumbnailComposition.belongsTo(models.ThumbnailTemplate, {
      foreignKey: 'template_id',
      as: 'template',
    });

    // Composition has many assets via CompositionAsset junction
    ThumbnailComposition.hasMany(models.CompositionAsset, {
      foreignKey: 'composition_id',
      as: 'compositionAssets',
      onDelete: 'CASCADE',
    });

    // Legacy direct asset references (kept for backward compatibility)
    ThumbnailComposition.belongsTo(models.Asset, {
      foreignKey: 'background_frame_asset_id',
      as: 'backgroundFrame',
      constraints: false,
    });

    ThumbnailComposition.belongsTo(models.Asset, {
      foreignKey: 'lala_asset_id',
      as: 'lalaAsset',
      constraints: false,
    });

    ThumbnailComposition.belongsTo(models.Asset, {
      foreignKey: 'guest_asset_id',
      as: 'guestAsset',
      constraints: false,
    });

    ThumbnailComposition.belongsTo(models.Asset, {
      foreignKey: 'justawomen_asset_id',
      as: 'justaWomenAsset',
      constraints: false,
    });
  };

  return ThumbnailComposition;
};

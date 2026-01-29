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
      asset_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Legacy type field - kept for backward compatibility',
      },
      asset_role: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Canonical role - hierarchical (e.g., CHAR.HOST.LALA, UI.ICON.CLOSET)',
      },
      asset_group: {
        type: DataTypes.ENUM('LALA', 'SHOW', 'GUEST', 'EPISODE', 'WARDROBE'),
        allowNull: true,
        comment: 'Identity bucket - which brand/entity this asset belongs to',
      },
      asset_scope: {
        type: DataTypes.ENUM('GLOBAL', 'SHOW', 'EPISODE'),
        allowNull: true,
        defaultValue: 'GLOBAL',
        comment: 'Scope of asset availability - GLOBAL, SHOW, or EPISODE',
      },
      show_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Show ID if asset_scope is SHOW',
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Episode ID if asset_scope is EPISODE',
      },
      purpose: {
        type: DataTypes.ENUM('MAIN', 'TITLE', 'ICON', 'BACKGROUND'),
        allowNull: true,
        comment: 'Category - what kind of asset this is',
      },
      allowed_uses: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: true,
        defaultValue: [],
        comment: 'What this asset CAN be used for',
      },
      is_global: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Available globally vs scoped to show/episode',
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      s3_url_raw: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      s3_url_processed: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      s3_key_raw: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      file_name: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      content_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      media_type: {
        type: DataTypes.STRING(100),
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
      file_size_bytes: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      approval_status: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Soft delete timestamp',
      },
      s3_url_no_bg: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'S3 URL for version with background removed',
      },
      s3_url_enhanced: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'S3 URL for enhanced version (skin smoothing, color correction, etc)',
      },
      processing_status: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'none',
        comment:
          'Status: none, processing_bg_removal, bg_removed, processing_enhancement, enhanced, failed',
      },
      processing_metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Processing parameters and results (provider, settings, timestamps)',
      },
    },
    {
      tableName: 'assets',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      underscored: true,
      paranoid: true,
    }
  );

  // Define associations
  Asset.associate = function (models) {
    // Many-to-many with Episodes through episode_assets junction table
    Asset.belongsToMany(models.Episode, {
      through: 'episode_assets',
      foreignKey: 'asset_id',
      otherKey: 'episode_id',
      as: 'episodes',
    });
  };

  return Asset;
};

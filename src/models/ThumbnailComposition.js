'use strict';
const { DataTypes } = require('sequelize');

/**
 * ThumbnailComposition Model
 * Stores composition metadata for generated thumbnails with versioning support
 * Schema matches migrations with versioning columns: current_version, version_history, last_modified_by, modification_timestamp
 */
module.exports = (sequelize) => {
  const ThumbnailComposition = sequelize.define('ThumbnailComposition', {
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
  }, {
    tableName: 'thumbnail_compositions',
    timestamps: false,
    underscored: true,
  });

  return ThumbnailComposition;
};

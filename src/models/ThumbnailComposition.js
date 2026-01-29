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
      is_primary: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        comment: 'Whether this is the primary/canonical composition for the episode',
      },
      composition_config: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Stores visibility toggles, text field values, and per-composition overrides',
      },
    },
    {
      tableName: 'thumbnail_compositions',
      timestamps: false,
      underscored: true,
    }
  );

  /**
   * Get visibility config for a role
   */
  ThumbnailComposition.prototype.getRoleVisibility = function (role) {
    return this.composition_config?.visibility?.[role] ?? null;
  };

  /**
   * Get text field value for a role
   */
  ThumbnailComposition.prototype.getTextField = function (role) {
    return this.composition_config?.text_fields?.[role] ?? null;
  };

  /**
   * Check if icon holder is required based on enabled icons
   */
  ThumbnailComposition.prototype.requiresIconHolder = function () {
    const { shouldRequireIconHolder } = require('../constants/canonicalRoles');
    return shouldRequireIconHolder(this.composition_config?.visibility || {});
  };

  /**
   * Validate composition config structure
   */
  ThumbnailComposition.prototype.validateConfig = function () {
    const config = this.composition_config || {};
    const errors = [];

    // Validate structure
    if (config.visibility && typeof config.visibility !== 'object') {
      errors.push('visibility must be an object');
    }
    if (config.text_fields && typeof config.text_fields !== 'object') {
      errors.push('text_fields must be an object');
    }
    if (config.overrides && typeof config.overrides !== 'object') {
      errors.push('overrides must be an object');
    }

    return errors.length > 0 ? errors : null;
  };

  return ThumbnailComposition;
};

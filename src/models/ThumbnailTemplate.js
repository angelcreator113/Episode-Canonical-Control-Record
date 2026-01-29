'use strict';
const { DataTypes } = require('sequelize');

/**
 * ThumbnailTemplate Model
 * Stores template configurations for role-based asset composition system
 */
module.exports = (sequelize) => {
  const ThumbnailTemplate = sequelize.define(
    'ThumbnailTemplate',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Template ID',
      },
      show_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Show ID if show-specific, NULL for global templates',
        references: {
          model: 'shows',
          key: 'id',
        },
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
        comment: 'Display name: Styling Adventures v1',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Template description',
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Template version number',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether template is active',
      },
      required_roles: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of required asset roles',
      },
      optional_roles: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of optional asset roles',
      },
      conditional_roles: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Conditional role logic: {role: {if: condition, required: boolean}}',
      },
      paired_roles: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Paired roles that must be used together',
      },
      layout_config: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Layer configuration for rendering',
      },
    },
    {
      tableName: 'thumbnail_templates',
      timestamps: true,
      underscored: true,
      paranoid: false, // Don't use soft deletes
    }
  );

  return ThumbnailTemplate;
};

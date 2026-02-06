'use strict';
const { DataTypes } = require('sequelize');

/**
 * LayerPreset Model
 * Saved layer configurations for reuse
 */
module.exports = (sequelize) => {
  const LayerPreset = sequelize.define(
    'LayerPreset',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'name',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'description',
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'category',
        comment: 'intro | main_content | product_showcase | outro',
      },
      layer_template: {
        type: DataTypes.JSONB,
        allowNull: false,
        field: 'layer_template',
        comment: '5-layer template with placeholders',
      },
      placeholders: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'placeholders',
        comment: 'List of placeholders (BACKGROUND_IMAGE, MAIN_CLIP, etc.)',
      },
      preview_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'preview_url',
      },
      is_system_preset: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_system_preset',
        comment: 'True if built-in, false if user-created',
      },
      times_used: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'times_used',
      },
      created_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'created_by',
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
      sequelize,
      modelName: 'LayerPreset',
      tableName: 'layer_presets',
      underscored: true,
      timestamps: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    }
  );

  return LayerPreset;
};

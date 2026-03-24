'use strict';
const { DataTypes } = require('sequelize');

/**
 * SceneAsset Model
 * Junction table linking scenes with their assets
 */
module.exports = (sequelize) => {
  const SceneAsset = sequelize.define(
    'SceneAsset',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      scene_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'scenes',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      asset_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'assets',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      usage_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'overlay',
        comment: 'How asset is used: overlay, background, promo, watermark',
      },
      start_timecode: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'When asset appears in scene (HH:MM:SS:FF)',
      },
      end_timecode: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'When asset disappears from scene (HH:MM:SS:FF)',
      },
      layer_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Z-index/stacking order (higher = on top)',
      },
      opacity: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 1.0,
        validate: {
          min: 0.0,
          max: 1.0,
        },
        comment: 'Asset opacity 0.00-1.00',
      },
      position: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: { x: 0, y: 0, width: '100%', height: '100%' },
        comment: 'Asset position/size: {x, y, width, height}',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Additional metadata about this asset usage',
      },
      // ── Extended placement columns ──
      asset_role: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Role in scene: background, character, ui_element, prop',
      },
      character_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Character name if role = character',
      },
      position_x: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'X position on canvas',
      },
      position_y: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Y position on canvas',
      },
      scale: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 1.0,
        comment: 'Scale factor for asset',
      },
      z_index: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: 'Z-index stacking order',
      },
      // ── Scene Studio fields ──
      rotation: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Rotation in degrees (0-360)',
      },
      width: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Pixel width on canvas',
      },
      height: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Pixel height on canvas',
      },
      is_visible: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether object is visible on canvas',
      },
      is_locked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether object is locked from editing',
      },
      object_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'image',
        comment: 'Object type: image, video, text, shape, overlay, decor',
      },
      object_label: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'User-facing name (e.g., "Chandelier", "Wall Art")',
      },
      flip_x: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Horizontal flip',
      },
      flip_y: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Vertical flip',
      },
      crop_data: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Crop rectangle: { x, y, width, height }',
      },
      style_data: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Style properties: { fill, stroke, strokeWidth, fontSize, fontFamily, textContent, shadow }',
      },
      group_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Group ID for grouped objects',
      },
      variant_group_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Links objects that are variants of each other',
      },
      variant_label: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Variant label: "open", "closed", "day", "night"',
      },
      is_active_variant: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Only one variant per group is active/visible',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'scene_assets',
      timestamps: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['scene_id', 'asset_id', 'usage_type'],
        },
        {
          fields: ['scene_id'],
        },
        {
          fields: ['asset_id'],
        },
        {
          fields: ['usage_type'],
        },
        {
          fields: ['layer_order'],
        },
      ],
    }
  );

  return SceneAsset;
};

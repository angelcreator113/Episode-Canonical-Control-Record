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
        defaultValue: 1.00,
        validate: {
          min: 0.00,
          max: 1.00,
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

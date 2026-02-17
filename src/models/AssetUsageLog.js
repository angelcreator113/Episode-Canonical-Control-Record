'use strict';
const { DataTypes } = require('sequelize');

/**
 * AssetUsageLog Model
 * Tracks every time an asset is used in a scene/episode for pattern learning
 */
module.exports = (sequelize) => {
  const AssetUsageLog = sequelize.define(
    'AssetUsageLog',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
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
      episode_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'episodes',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      scene_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'scenes',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      context: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Usage context: scene_background, scene_character, timeline_overlay, etc.',
      },
      used_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'asset_usage_log',
      timestamps: false,
      underscored: true,
      indexes: [
        { fields: ['asset_id'], name: 'idx_asset_usage_asset' },
        { fields: ['episode_id'], name: 'idx_asset_usage_episode' },
        { fields: ['scene_id'], name: 'idx_asset_usage_scene' },
      ],
    }
  );

  return AssetUsageLog;
};

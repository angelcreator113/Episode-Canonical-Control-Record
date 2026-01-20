'use strict';
const { DataTypes } = require('sequelize');

/**
 * EpisodeAsset Model
 * Junction table linking episodes with their assets
 */
module.exports = (sequelize) => {
  const EpisodeAsset = sequelize.define(
    'EpisodeAsset',
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
        references: {
          model: 'episodes',
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
        defaultValue: 'general',
        comment: 'Usage type: thumbnail, promo, scene_background, general',
      },
      scene_number: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Scene number if asset is used in a specific scene',
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Order for displaying assets in the episode',
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
      tableName: 'episode_assets',
      timestamps: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['episode_id', 'asset_id', 'usage_type'],
        },
        {
          fields: ['episode_id'],
        },
        {
          fields: ['asset_id'],
        },
        {
          fields: ['usage_type'],
        },
      ],
    }
  );

  return EpisodeAsset;
};

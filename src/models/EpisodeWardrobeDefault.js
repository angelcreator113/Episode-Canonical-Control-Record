'use strict';
const { DataTypes } = require('sequelize');

/**
 * EpisodeWardrobeDefault Model
 * Stores per-episode default outfit for each character
 */
module.exports = (sequelize) => {
  const EpisodeWardrobeDefault = sequelize.define(
    'EpisodeWardrobeDefault',
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
      character_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Character name (e.g., Lala)',
      },
      default_outfit_asset_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'assets',
          key: 'id',
        },
        onDelete: 'SET NULL',
        comment: 'Default outfit asset for this character in this episode',
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
    },
    {
      tableName: 'episode_wardrobe_defaults',
      timestamps: false,  // We define created_at/updated_at manually
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['episode_id', 'character_name'],
          name: 'idx_wardrobe_defaults_episode_character',
        },
      ],
    }
  );

  return EpisodeWardrobeDefault;
};

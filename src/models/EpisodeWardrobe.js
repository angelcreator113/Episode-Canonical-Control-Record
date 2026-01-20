'use strict';
const { DataTypes } = require('sequelize');

/**
 * EpisodeWardrobe Model
 * Junction table linking episodes to wardrobe items
 */
module.exports = (sequelize) => {
  const EpisodeWardrobe = sequelize.define(
    'EpisodeWardrobe',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      episode_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'episodes',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      wardrobe_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'wardrobe',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      scene: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Scene where this item was worn',
      },
      worn_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'When this item was linked to the episode',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Episode-specific notes about wearing this item',
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
      tableName: 'episode_wardrobe',
      timestamps: false,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['episode_id', 'wardrobe_id'],
          name: 'unique_episode_wardrobe',
        },
        {
          fields: ['episode_id'],
        },
        {
          fields: ['wardrobe_id'],
        },
      ],
    }
  );

  // Define associations
  EpisodeWardrobe.associate = function (models) {
    EpisodeWardrobe.belongsTo(models.Episode, {
      foreignKey: 'episode_id',
      as: 'episode',
    });

    EpisodeWardrobe.belongsTo(models.Wardrobe, {
      foreignKey: 'wardrobe_id',
      as: 'wardrobeItem',
    });
  };

  return EpisodeWardrobe;
};

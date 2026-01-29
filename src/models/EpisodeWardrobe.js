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
        type: DataTypes.UUID,
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
      scene_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'scenes',
          key: 'id',
        },
        onDelete: 'SET NULL',
        comment: 'Link to specific scene where wardrobe was used',
      },
      scene: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Scene description/name (legacy text field - use scene_id instead)',
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
      approval_status: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'pending',
        comment: 'Approval status: pending, approved, rejected',
      },
      approved_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'User who approved this item',
      },
      approved_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When this item was approved',
      },
      rejection_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for rejection if applicable',
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
      as: 'wardrobe',
    });

    EpisodeWardrobe.belongsTo(models.Scene, {
      foreignKey: 'scene_id',
      as: 'sceneDetails', // Use different alias to avoid collision with 'scene' attribute
    });
  };

  return EpisodeWardrobe;
};

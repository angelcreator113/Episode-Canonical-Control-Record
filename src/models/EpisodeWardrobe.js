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
      // Task #1909: canon has it (2026-09-17 capture: boolean NOT NULL).
      // toggleEpisodeFavorite (src/controllers/wardrobeController.js) wrote
      // it through a loaded link and Sequelize dropped it, so the toggle
      // never stuck. The default keeps creates that do not set it valid.
      is_episode_favorite: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // Task #1924: approval_status, approved_by, approved_at and
      // rejection_reason were declared here and absent from the table
      // (Evoni's production read, ATTESTED 2026-09-25), so every
      // EpisodeWardrobe query failed. They arrive with
      // src/migrations/20260925000001-add-approval-columns-to-episode-wardrobe.js,
      // which must run before this code deploys.
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
    },
    {
      tableName: 'episode_wardrobe',
      // Task #1924, Evoni's ruling (a): paranoid, so removing a wardrobe row
      // keeps its record ("a removed wardrobe row is a styling decision").
      // Paranoid needs timestamps; the three map onto the snake_case
      // columns (deleted_at arrives with the #1924 migration).
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      paranoid: true,
      underscored: true,
      // Task #1933: the table's only indexes on these columns, after
      // src/migrations/20260926000000-dedupe-episode-wardrobe-indexes.js
      // drops the duplicates and keeps one of each under these names.
      indexes: [
        {
          unique: true,
          fields: ['episode_id', 'wardrobe_id'],
          name: 'unique_episode_wardrobe',
        },
        {
          fields: ['episode_id'],
          name: 'episode_wardrobe_episode_id',
        },
        {
          fields: ['wardrobe_id'],
          name: 'episode_wardrobe_wardrobe_id',
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

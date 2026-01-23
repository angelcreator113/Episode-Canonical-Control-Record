'use strict';
const { DataTypes } = require('sequelize');

/**
 * WardrobeUsageHistory Model
 * Track detailed usage history across episodes and shows
 */
module.exports = (sequelize) => {
  const WardrobeUsageHistory = sequelize.define(
    'WardrobeUsageHistory',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      // References
      libraryItemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'library_item_id',
        references: {
          model: 'wardrobe_library',
          key: 'id',
        },
      },
      episodeId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'episode_id',
        references: {
          model: 'episodes',
          key: 'id',
        },
      },
      sceneId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'scene_id',
        references: {
          model: 'scenes',
          key: 'id',
        },
      },
      showId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'show_id',
        references: {
          model: 'shows',
          key: 'id',
        },
      },
      // Usage details
      usageType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'usage_type',
        comment: 'assigned, viewed, selected, approved, rejected, removed',
        validate: {
          isIn: [['assigned', 'viewed', 'selected', 'approved', 'rejected', 'removed']],
        },
      },
      character: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      occasion: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      // Metadata
      userId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'user_id',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
    },
    {
      tableName: 'wardrobe_usage_history',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: false, // No updated_at column in this table
      indexes: [
        { fields: ['library_item_id'] },
        { fields: ['episode_id'] },
        { fields: ['show_id'] },
        { fields: ['usage_type'] },
        { fields: ['created_at'] },
      ],
    }
  );

  // Associations will be defined in models/index.js
  WardrobeUsageHistory.associate = function (models) {
    // Belongs to library item
    WardrobeUsageHistory.belongsTo(models.WardrobeLibrary, {
      foreignKey: 'library_item_id',
      as: 'libraryItem',
    });

    // Belongs to episode (optional)
    WardrobeUsageHistory.belongsTo(models.Episode, {
      foreignKey: 'episode_id',
      as: 'episode',
    });

    // Belongs to scene (optional)
    WardrobeUsageHistory.belongsTo(models.Scene, {
      foreignKey: 'scene_id',
      as: 'scene',
    });

    // Belongs to show (optional)
    WardrobeUsageHistory.belongsTo(models.Show, {
      foreignKey: 'show_id',
      as: 'show',
    });
  };

  return WardrobeUsageHistory;
};

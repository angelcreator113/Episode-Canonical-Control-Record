'use strict';
const { DataTypes } = require('sequelize');

/**
 * SceneObjectVariant Model
 * Groups scene objects that represent variants of the same thing
 * (e.g., curtains: open/closed, lighting: day/night)
 */
module.exports = (sequelize) => {
  const SceneObjectVariant = sequelize.define(
    'SceneObjectVariant',
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
      variant_group_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Human-readable group name: "Curtains", "Chandelier Style", "Lighting Mood"',
      },
      active_variant_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'scene_assets',
          key: 'id',
        },
        onDelete: 'SET NULL',
        comment: 'Which variant is currently shown',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Extra configuration for the variant group',
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
      tableName: 'scene_object_variants',
      timestamps: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      underscored: true,
      indexes: [
        { fields: ['scene_id'] },
        { fields: ['active_variant_id'] },
      ],
    }
  );

  SceneObjectVariant.associate = (models) => {
    SceneObjectVariant.belongsTo(models.Scene, {
      foreignKey: 'scene_id',
      as: 'scene',
    });
    SceneObjectVariant.belongsTo(models.SceneAsset, {
      foreignKey: 'active_variant_id',
      as: 'activeVariant',
    });
  };

  return SceneObjectVariant;
};

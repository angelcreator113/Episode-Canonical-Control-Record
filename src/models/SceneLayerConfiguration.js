'use strict';
const { DataTypes } = require('sequelize');

/**
 * SceneLayerConfiguration Model
 * 5-layer composition configuration per scene
 */
module.exports = (sequelize) => {
  const SceneLayerConfiguration = sequelize.define(
    'SceneLayerConfiguration',
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
        unique: true,
        references: {
          model: 'scenes',
          key: 'id',
        },
        onDelete: 'CASCADE',
        field: 'scene_id',
      },
      layers: {
        type: DataTypes.JSONB,
        allowNull: false,
        field: 'layers',
        comment: '5-layer structure with placeholders or actual content',
      },
      composite_complexity: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'medium',
        field: 'composite_complexity',
        comment: 'simple | medium | complex',
      },
      estimated_render_time_seconds: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'estimated_render_time_seconds',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
      },
    },
    {
      sequelize,
      modelName: 'SceneLayerConfiguration',
      tableName: 'scene_layer_configuration',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return SceneLayerConfiguration;
};

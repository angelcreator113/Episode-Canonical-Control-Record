'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class SceneFootageLink extends Model {
    static associate(models) {
      // Link to AI-detected scene
      SceneFootageLink.belongsTo(models.ScriptMetadata, {
        foreignKey: 'script_metadata_id',
        as: 'aiScene',
      });

      // Link to uploaded footage
      SceneFootageLink.belongsTo(models.Scene, {
        foreignKey: 'scene_id',
        as: 'footage',
      });
    }
  }

  SceneFootageLink.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      script_metadata_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      scene_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      match_type: {
        type: DataTypes.ENUM('auto', 'manual', 'suggested'),
        allowNull: false,
        defaultValue: 'manual',
      },
      confidence_score: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'SceneFootageLink',
      tableName: 'scene_footage_links',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: false, // No updated_at needed
    }
  );

  return SceneFootageLink;
};

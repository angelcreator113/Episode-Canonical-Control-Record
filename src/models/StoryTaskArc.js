'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StoryTaskArc = sequelize.define('StoryTaskArc', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    character_key: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    display_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    world: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    narrative_spine: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    tasks: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
  }, {
    tableName: 'story_task_arcs',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return StoryTaskArc;
};

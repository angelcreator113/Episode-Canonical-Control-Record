'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('PressCareer', {
    id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    character_slug:     { type: DataTypes.STRING, allowNull: false },
    current_stage:      { type: DataTypes.INTEGER, defaultValue: 1 },
    stage_history:      { type: DataTypes.JSONB, defaultValue: [] },
    sessions_completed: { type: DataTypes.INTEGER, defaultValue: 0 },
    content_generated:  { type: DataTypes.INTEGER, defaultValue: 0 },
  }, {
    tableName: 'press_careers',
    timestamps: true,
    underscored: true,
  });
};

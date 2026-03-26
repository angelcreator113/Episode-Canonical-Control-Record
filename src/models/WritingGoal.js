'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class WritingGoal extends Model {
    static associate(_models) {}
  }
  WritingGoal.init({
    id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    goal_type: {
      type: DataTypes.ENUM('daily', 'weekly', 'arc_stage', 'book'),
      defaultValue: 'weekly',
    },
    target_scenes:   { type: DataTypes.INTEGER, allowNull: true },
    target_words:    { type: DataTypes.INTEGER, allowNull: true },
    target_sessions: { type: DataTypes.INTEGER, allowNull: true },
    cadence: {
      type: DataTypes.ENUM('daily', 'weekdays', '3_per_week', 'burst'),
      defaultValue: 'weekdays',
    },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, {
    sequelize, modelName: 'WritingGoal',
    tableName: 'writing_goals', underscored: true,
  });
  return WritingGoal;
};

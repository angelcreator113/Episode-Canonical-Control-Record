// models/WritingGoal.js
// Writing goals — tracks session and project-level writing targets

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WritingGoal = sequelize.define('WritingGoal', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    show_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    goal_type: {
      type: DataTypes.ENUM('session', 'daily', 'weekly', 'project'),
      allowNull: false,
      defaultValue: 'session',
    },
    target_word_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    target_scene_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    actual_word_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    actual_scene_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('active', 'completed', 'missed', 'cancelled'),
      defaultValue: 'active',
    },
    due_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'writing_goals',
    underscored: true,
    timestamps: true,
  });

  return WritingGoal;
};

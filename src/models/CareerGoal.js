'use strict';
const { DataTypes } = require('sequelize');

/**
 * CareerGoal — multi-goal tension system.
 * 1 Primary + 2 Secondary + Passive background goals.
 * Drives opportunity generation and event selection.
 */
module.exports = (sequelize) => {
  const CareerGoal = sequelize.define('CareerGoal', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    show_id: { type: DataTypes.UUID, allowNull: false },
    season_id: { type: DataTypes.UUID, allowNull: true },

    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    type: {
      type: DataTypes.STRING(20), allowNull: false, defaultValue: 'secondary',
      // primary | secondary | passive
    },

    target_metric: {
      type: DataTypes.STRING(50), allowNull: false,
      // coins, reputation, followers, brand_trust, influence, engagement_rate, portfolio_strength, consistency_streak, custom
    },
    target_value: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    current_value: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    starting_value: { type: DataTypes.FLOAT, allowNull: true },

    status: {
      type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active',
      // active | completed | failed | paused | abandoned
    },
    priority: { type: DataTypes.INTEGER, defaultValue: 3 },

    unlocks_on_complete: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    fail_consequence: { type: DataTypes.TEXT, allowNull: true },

    arc_id: { type: DataTypes.UUID, allowNull: true },
    episode_range: { type: DataTypes.JSONB, allowNull: true },

    icon: { type: DataTypes.STRING(10), allowNull: true, defaultValue: '🎯' },
    color: { type: DataTypes.STRING(20), allowNull: true, defaultValue: '#6366f1' },

    completed_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'career_goals',
    timestamps: true,
    paranoid: false,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  CareerGoal.associate = (models) => {
    if (models.Show) CareerGoal.belongsTo(models.Show, { foreignKey: 'show_id', as: 'show' });
  };

  return CareerGoal;
};

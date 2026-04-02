'use strict';
const { DataTypes } = require('sequelize');

/**
 * ScenePlan — AI-generated beat-by-beat scene mapping.
 * 14 beats per episode, each mapped to a scene set + angle.
 * Feeds the script generator with grounded location context.
 */
module.exports = (sequelize) => {
  const ScenePlan = sequelize.define('ScenePlan', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    episode_id: { type: DataTypes.UUID, allowNull: false },
    episode_brief_id: { type: DataTypes.UUID, allowNull: true },
    beat_number: { type: DataTypes.INTEGER, allowNull: false },
    beat_name: { type: DataTypes.STRING, allowNull: true },
    scene_set_id: { type: DataTypes.UUID, allowNull: true },
    angle_label: { type: DataTypes.STRING(50), allowNull: true },
    shot_type: {
      type: DataTypes.ENUM('establishing', 'medium', 'close', 'tracking', 'cutaway', 'transition'),
      allowNull: true,
    },
    emotional_intent: { type: DataTypes.TEXT, allowNull: true },
    transition_in: {
      type: DataTypes.ENUM('cut', 'glow', 'push', 'wipe', 'dissolve', 'none'),
      allowNull: true,
      defaultValue: 'cut',
    },
    scene_context: { type: DataTypes.TEXT, allowNull: true },
    director_note: { type: DataTypes.TEXT, allowNull: true },
    locked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ai_suggested: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ai_confidence: { type: DataTypes.FLOAT, allowNull: true },
  }, {
    tableName: 'scene_plans',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['episode_id', 'beat_number'], unique: true, name: 'idx_scene_plans_episode_beat' },
    ],
  });

  ScenePlan.associate = (models) => {
    ScenePlan.belongsTo(models.Episode, { foreignKey: 'episode_id', as: 'episode' });
    if (models.EpisodeBrief) ScenePlan.belongsTo(models.EpisodeBrief, { foreignKey: 'episode_brief_id', as: 'brief' });
    if (models.SceneSet) ScenePlan.belongsTo(models.SceneSet, { foreignKey: 'scene_set_id', as: 'sceneSet' });
  };

  return ScenePlan;
};

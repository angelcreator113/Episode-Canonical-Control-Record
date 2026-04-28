'use strict';
const { DataTypes } = require('sequelize');

/**
 * EpisodeBrief — pre-production creative intent per episode.
 * One brief per episode. Feeds the scene planner and script generator.
 */
module.exports = (sequelize) => {
  const EpisodeBrief = sequelize.define('EpisodeBrief', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    episode_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    show_id: { type: DataTypes.UUID, allowNull: true },
    arc_number: { type: DataTypes.INTEGER, allowNull: true },
    position_in_arc: { type: DataTypes.INTEGER, allowNull: true },
    episode_archetype: {
      type: DataTypes.ENUM('Trial', 'Temptation', 'Breakdown', 'Redemption', 'Showcase', 'Rising', 'Pressure', 'Cliffhanger'),
      allowNull: true,
    },
    narrative_purpose: { type: DataTypes.TEXT, allowNull: true },
    designed_intent: { type: DataTypes.ENUM('slay', 'pass', 'safe', 'fail'), allowNull: true },
    allowed_outcomes: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    forward_hook: { type: DataTypes.TEXT, allowNull: true },
    lala_state_snapshot: { type: DataTypes.JSONB, allowNull: true },
    event_id: { type: DataTypes.UUID, allowNull: true },
    event_difficulty: { type: DataTypes.JSONB, allowNull: true },
    // Captures which saved OutfitSet drove this episode at generate time.
    // Separate from the individual EpisodeWardrobe rows so we keep the
    // "this came from set X" audit trail even after the pieces explode.
    outfit_set_id: { type: DataTypes.UUID, allowNull: true },
    // AI-drafted beat outline at generate time. Each entry:
    // { beat_number, summary, dramatic_function }. Lets the Suggest-Scenes
    // feature have something to chew on before a script exists.
    beat_outline: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    status: { type: DataTypes.ENUM('draft', 'locked'), allowNull: false, defaultValue: 'draft' },
    ai_generated_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'episode_briefs',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  EpisodeBrief.associate = (models) => {
    EpisodeBrief.belongsTo(models.Episode, { foreignKey: 'episode_id', as: 'episode' });
    if (models.Show) EpisodeBrief.belongsTo(models.Show, { foreignKey: 'show_id', as: 'show' });
  };

  return EpisodeBrief;
};

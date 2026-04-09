'use strict';
const { DataTypes } = require('sequelize');

/**
 * EpisodeScript — versioned AI-generated scripts per episode.
 * Each generation creates a new version. Authors can edit and approve.
 */
module.exports = (sequelize) => {
  const EpisodeScript = sequelize.define('EpisodeScript', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    episode_id: { type: DataTypes.UUID, allowNull: false },
    show_id: { type: DataTypes.UUID, allowNull: true },
    episode_brief_id: { type: DataTypes.UUID, allowNull: true },

    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    status: {
      type: DataTypes.STRING(30), allowNull: false, defaultValue: 'draft',
      // draft → review → approved → locked → archived
    },

    title: { type: DataTypes.STRING(255), allowNull: true },
    script_text: { type: DataTypes.TEXT, allowNull: true },
    script_json: { type: DataTypes.JSONB, allowNull: true, defaultValue: null },

    generation_model: { type: DataTypes.STRING(60), allowNull: true },
    generation_tokens: { type: DataTypes.INTEGER, allowNull: true },
    generation_cost: { type: DataTypes.DECIMAL(10, 4), allowNull: true },
    generation_prompt_hash: { type: DataTypes.STRING(64), allowNull: true },

    context_snapshot: { type: DataTypes.JSONB, allowNull: true, defaultValue: null },
    feed_moments_used: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    financial_context: { type: DataTypes.JSONB, allowNull: true, defaultValue: null },
    wardrobe_locked: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    scene_angles_used: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },

    word_count: { type: DataTypes.INTEGER, allowNull: true },
    beat_count: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 14 },
    voice_score: { type: DataTypes.INTEGER, allowNull: true },

    author_notes: { type: DataTypes.TEXT, allowNull: true },
    edited_by: { type: DataTypes.STRING(100), allowNull: true },
    edited_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'episode_scripts',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['episode_id', 'version'], unique: true, name: 'idx_episode_scripts_episode_version' },
    ],
  });

  EpisodeScript.associate = (models) => {
    EpisodeScript.belongsTo(models.Episode, { foreignKey: 'episode_id', as: 'episode' });
    if (models.EpisodeBrief) {
      EpisodeScript.belongsTo(models.EpisodeBrief, { foreignKey: 'episode_brief_id', as: 'brief' });
    }
    if (models.Show) {
      EpisodeScript.belongsTo(models.Show, { foreignKey: 'show_id', as: 'show' });
    }
  };

  return EpisodeScript;
};

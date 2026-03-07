'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SceneProposal = sequelize.define('SceneProposal', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    book_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    chapter_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    registry_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    arc_stage: {
      type: DataTypes.ENUM('establishment', 'pressure', 'crisis', 'integration'),
      allowNull: true,
    },
    arc_stage_score: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    wounds_unaddressed: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    tensions_unresolved: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    recent_beats: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    recent_revelations: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    scene_type: {
      type: DataTypes.ENUM(
        'production_breakdown',
        'creator_study',
        'interior_reckoning',
        'david_mirror',
        'paying_man_pressure',
        'bestie_moment',
        'lala_seed',
        'general'
      ),
      allowNull: false,
      defaultValue: 'general',
    },
    proposed_characters: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    emotional_stakes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    arc_function: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    scene_brief: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    why_these_characters: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    suggested_tone: {
      type: DataTypes.ENUM('longing', 'tension', 'sensual', 'explicit', 'aftermath'),
      allowNull: true,
      defaultValue: 'tension',
    },
    lala_seed_potential: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    status: {
      type: DataTypes.ENUM('proposed', 'adjusted', 'accepted', 'dismissed', 'generated'),
      defaultValue: 'proposed',
    },
    author_edits: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    final_brief: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    final_characters: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    story_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    raw_proposal: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  }, {
    tableName: 'scene_proposals',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  SceneProposal.associate = (models) => {
    SceneProposal.belongsTo(models.StorytellerBook, {
      foreignKey: 'book_id',
      as: 'book',
    });
    SceneProposal.belongsTo(models.StorytellerChapter, {
      foreignKey: 'chapter_id',
      as: 'chapter',
    });
    SceneProposal.belongsTo(models.CharacterRegistry, {
      foreignKey: 'registry_id',
      as: 'registry',
    });
  };

  return SceneProposal;
};

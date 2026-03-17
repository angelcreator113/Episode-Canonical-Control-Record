'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StorytellerStory = sequelize.define('StorytellerStory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    character_key: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    story_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    phase: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    story_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    word_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'draft',
    },
    task_brief: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    consistency_result: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    therapy_memories: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    new_character: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    new_character_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    new_character_role: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    opening_line: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    editor_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // ── Multi-agent evaluation columns ──
    tone_dial: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    characters_in_scene: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    registry_dossiers_used: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    scene_brief: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    story_a: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    story_b: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    story_c: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    evaluation_result: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    plot_memory_proposal: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    character_revelation_proposal: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    registry_update_proposals: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    memory_confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    written_back_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    written_back_chapter_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    // ── Tier feature columns ──
    pipeline_step: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    franchise_guard_result: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    continuity_check_result: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    enrichment_status: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  }, {
    tableName: 'storyteller_stories',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return StorytellerStory;
};

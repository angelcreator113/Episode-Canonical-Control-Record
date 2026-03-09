'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StoryThread = sequelize.define('StoryThread', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    book_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    universe_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    thread_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    thread_type: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: 'subplot', // main_plot, subplot, mystery, relationship_arc, character_arc, theme
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'active', // active, resolved, abandoned, dormant
    },
    introduced_chapter_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    resolved_chapter_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    characters_involved: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    key_events: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    last_referenced_chapter_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    chapters_since_last_reference: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    tension_level: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  }, {
    tableName: 'story_threads',
    timestamps: true,
    underscored: true,
  });

  return StoryThread;
};

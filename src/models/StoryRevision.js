'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StoryRevision = sequelize.define('StoryRevision', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    story_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    revision_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    word_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    revision_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'edit', // original, synthesis, edit, ai_rewrite
    },
    revision_source: {
      type: DataTypes.STRING(50),
      allowNull: true, // user, evaluation_engine, ai_tool
    },
    change_summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  }, {
    tableName: 'story_revisions',
    timestamps: true,
    underscored: true,
  });

  return StoryRevision;
};

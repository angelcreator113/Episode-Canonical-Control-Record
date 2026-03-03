'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NovelAssembly = sequelize.define('NovelAssembly', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    character_key: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    story_ids: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    social_import_ids: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    assembly_order: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    emotional_curve: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    total_word_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    chapter_breaks: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'draft',
    },
    compiled_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  }, {
    tableName: 'novel_assemblies',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return NovelAssembly;
};

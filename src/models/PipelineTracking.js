'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PipelineTracking = sequelize.define('PipelineTracking', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    story_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    book_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    chapter_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    current_step: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'brief', // brief, generate, read, evaluate, memory, registry, write_back
    },
    step_brief: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    step_generate: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    step_read: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    step_evaluate: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    step_memory: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    step_registry: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    step_write_back: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    started_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  }, {
    tableName: 'pipeline_tracking',
    timestamps: true,
    underscored: true,
  });

  return PipelineTracking;
};

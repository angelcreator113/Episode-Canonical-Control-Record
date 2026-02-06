'use strict';
const { DataTypes } = require('sequelize');

/**
 * AITrainingData Model
 * Stores YouTube video analysis for style learning
 */
module.exports = (sequelize) => {
  const AITrainingData = sequelize.define(
    'AITrainingData',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      video_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        field: 'video_id',
        comment: 'YouTube video ID or internal identifier',
      },
      source_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'source_type',
        comment: 'youtube_user | youtube_inspiration | manual_upload',
      },
      video_title: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'video_title',
      },
      video_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'video_url',
      },
      s3_key: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 's3_key',
        comment: 'S3 key if downloaded',
      },
      duration_seconds: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'duration_seconds',
      },
      avg_clip_duration: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        field: 'avg_clip_duration',
        comment: 'Average clip duration in seconds',
      },
      total_clips: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'total_clips',
      },
      pacing_rhythm: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'pacing_rhythm',
        comment: 'fast | medium | slow | dynamic',
      },
      transition_patterns: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'transition_patterns',
        comment: 'Cut, dissolve, wipe frequencies',
      },
      overlay_usage: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'overlay_usage',
        comment: 'How overlays are used',
      },
      text_style: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'text_style',
        comment: 'Font, size, animation patterns',
      },
      music_presence: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        field: 'music_presence',
      },
      is_user_style: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_user_style',
        comment: "Is this the user's own content?",
      },
      analyzed_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'analyzed_at',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
    },
    {
      sequelize,
      modelName: 'AITrainingData',
      tableName: 'ai_training_data',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );

  return AITrainingData;
};

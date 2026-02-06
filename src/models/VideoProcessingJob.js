'use strict';
const { DataTypes } = require('sequelize');

/**
 * VideoProcessingJob Model
 * Tracks video rendering jobs with status and progress
 */
module.exports = (sequelize) => {
  const VideoProcessingJob = sequelize.define(
    'VideoProcessingJob',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'episodes',
          key: 'id',
        },
        onDelete: 'CASCADE',
        field: 'episode_id',
      },
      edit_plan_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'ai_edit_plans',
          key: 'id',
        },
        onDelete: 'CASCADE',
        field: 'edit_plan_id',
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'queued',
        field: 'status',
        comment: 'queued | processing | completed | failed | cancelled',
      },
      processing_method: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'processing_method',
        comment: 'lambda | ec2',
      },
      complexity_score: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
        field: 'complexity_score',
        comment: 'Estimated complexity (0.00-1.00)',
      },
      estimated_duration_seconds: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'estimated_duration_seconds',
        comment: 'Estimated processing time',
      },
      processing_duration_seconds: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'processing_duration_seconds',
        comment: 'Actual processing time (calculated by trigger)',
      },
      progress_percentage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'progress_percentage',
        comment: '0-100',
      },
      output_s3_key: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'output_s3_key',
        comment: 'S3 key of final rendered video',
      },
      output_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'output_url',
        comment: 'Presigned URL for final video',
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'error_message',
      },
      lambda_request_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'lambda_request_id',
      },
      ec2_instance_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'ec2_instance_id',
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'started_at',
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'completed_at',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
      },
    },
    {
      sequelize,
      modelName: 'VideoProcessingJob',
      tableName: 'video_processing_jobs',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return VideoProcessingJob;
};

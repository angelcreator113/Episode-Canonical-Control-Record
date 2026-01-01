'use strict';
const { DataTypes } = require('sequelize');

/**
 * ProcessingQueue Model
 * Tracks thumbnail generation and metadata extraction jobs
 */
module.exports = (sequelize) => {
  const ProcessingQueue = sequelize.define('ProcessingQueue', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    episodeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'episodes',
        key: 'id',
      },
    },

    // Job metadata
    jobType: {
      type: DataTypes.ENUM('thumbnail_generation', 'metadata_extraction', 'transcription'),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
      comment: 'Type of processing job',
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'processing', 'completed', 'failed']],
      },
      comment: 'Current job status',
    },

    // SQS integration
    sqsMessageId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      comment: 'SQS message ID for job',
    },
    sqsReceiptHandle: {
      type: DataTypes.STRING(1024),
      allowNull: true,
      comment: 'SQS receipt handle for acknowledgment',
    },

    // Job configuration
    jobConfig: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Configuration parameters for the job',
    },

    // Error handling
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Error message if job failed',
    },
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        isInt: true,
        min: 0,
      },
      comment: 'Number of times job has been retried',
    },
    maxRetries: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
      validate: {
        isInt: true,
        min: 0,
      },
      comment: 'Maximum number of retries allowed',
    },

    // Timestamps
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'When job was created',
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When job processing started',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When job completed (success or failure)',
    },
  }, {
    sequelize,
    modelName: 'ProcessingQueue',
    tableName: 'processing_queue',
    timestamps: false,
    indexes: [
      {
        name: 'idx_episode_status',
        fields: ['episodeId', 'status'],
      },
      {
        name: 'idx_job_status',
        fields: ['status'],
      },
      {
        name: 'idx_created_at',
        fields: ['createdAt'],
      },
      {
        name: 'idx_sqs_message_id',
        fields: ['sqsMessageId'],
      },
    ],
  });

  /**
   * Instance Methods
   */

  /**
   * Mark job as processing
   */
  ProcessingQueue.prototype.startProcessing = async function() {
    this.status = 'processing';
    this.startedAt = new Date();
    return this.save();
  };

  /**
   * Mark job as completed successfully
   */
  ProcessingQueue.prototype.complete = async function() {
    this.status = 'completed';
    this.completedAt = new Date();
    return this.save();
  };

  /**
   * Mark job as failed
   */
  ProcessingQueue.prototype.fail = async function(errorMessage) {
    this.status = 'failed';
    this.errorMessage = errorMessage;
    this.completedAt = new Date();
    return this.save();
  };

  /**
   * Retry job (increment retry count)
   */
  ProcessingQueue.prototype.retry = async function() {
    if (this.retryCount >= this.maxRetries) {
      throw new Error(`Max retries (${this.maxRetries}) exceeded`);
    }
    this.retryCount += 1;
    this.status = 'pending';
    this.startedAt = null;
    this.completedAt = null;
    this.errorMessage = null;
    return this.save();
  };

  /**
   * Check if job can be retried
   */
  ProcessingQueue.prototype.canRetry = function() {
    return this.retryCount < this.maxRetries;
  };

  /**
   * Get processing duration in seconds
   */
  ProcessingQueue.prototype.getDurationSeconds = function() {
    if (!this.startedAt || !this.completedAt) {
      return null;
    }
    return Math.floor((this.completedAt - this.startedAt) / 1000);
  };

  /**
   * Class Methods
   */

  /**
   * Create new processing job
   */
  ProcessingQueue.createJob = async function(episodeId, jobType, config = {}) {
    return ProcessingQueue.create({
      episodeId,
      jobType,
      jobConfig: config,
      status: 'pending',
    });
  };

  /**
   * Find pending jobs
   */
  ProcessingQueue.findPending = function(limit = 10) {
    return ProcessingQueue.findAll({
      where: { status: 'pending' },
      order: [['createdAt', 'ASC']],
      limit,
    });
  };

  /**
   * Find failed jobs
   */
  ProcessingQueue.findFailed = function() {
    return ProcessingQueue.findAll({
      where: { status: 'failed' },
      order: [['completedAt', 'DESC']],
    });
  };

  /**
   * Find retryable jobs (failed but within retry limit)
   */
  ProcessingQueue.findRetryable = function() {
    return ProcessingQueue.sequelize.query(
      `SELECT * FROM processing_queue 
       WHERE status = 'failed' 
       AND retry_count < max_retries
       ORDER BY completed_at ASC`,
      { type: sequelize.QueryTypes.SELECT }
    );
  };

  /**
   * Get jobs for episode
   */
  ProcessingQueue.getEpisodeJobs = async function(episodeId) {
    return ProcessingQueue.findAll({
      where: { episodeId },
      order: [['createdAt', 'DESC']],
    });
  };

  /**
   * Get job statistics
   */
  ProcessingQueue.getStats = async function() {
    const stats = await ProcessingQueue.sequelize.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM processing_queue`,
      { type: sequelize.QueryTypes.SELECT }
    );
    return stats[0];
  };

  return ProcessingQueue;
};

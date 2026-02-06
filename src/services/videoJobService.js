'use strict';

const { VideoProcessingJob } = require('../models');
const sqsService = require('./sqsService');

/**
 * Video Processing Service
 * Orchestrates video rendering jobs between database and queue
 */
class VideoJobService {
  /**
   * Create and queue a video processing job
   * @param {Object} jobData
   * @param {string} jobData.episodeId - Episode UUID
   * @param {string} jobData.editPlanId - AIEditPlan UUID
   * @param {Object} jobData.editStructure - Complete edit plan
   * @param {string} jobData.processingMethod - 'lambda' or 'ec2'
   * @param {number} jobData.complexityScore - 0.00-1.00
   * @returns {Promise<{job: Object, queueResult: Object}>}
   */
  async createAndQueueJob(jobData) {
    // 1. Create database record
    const job = await VideoProcessingJob.create({
      episode_id: jobData.episodeId,
      edit_plan_id: jobData.editPlanId,
      status: 'queued',
      processing_method: jobData.processingMethod,
      complexity_score: jobData.complexityScore,
      estimated_duration_seconds: this._estimateDuration(jobData.editStructure),
    });

    try {
      // 2. Send to SQS queue
      const queueResult = await sqsService.sendProcessingJob({
        jobId: job.id,
        episodeId: jobData.episodeId,
        editPlanId: jobData.editPlanId,
        processingMethod: jobData.processingMethod,
        editStructure: jobData.editStructure,
      });

      return { job, queueResult };

    } catch (error) {
      // If queue fails, mark job as failed
      await job.update({
        status: 'failed',
        error_message: `Failed to queue: ${error.message}`,
      });
      throw error;
    }
  }

  /**
   * Mark job as processing started
   * @param {string} jobId - Job UUID
   * @param {Object} metadata - Lambda request ID or EC2 instance ID
   */
  async markJobStarted(jobId, metadata = {}) {
    const job = await VideoProcessingJob.findByPk(jobId);
    if (!job) throw new Error('Job not found');

    await job.update({
      status: 'processing',
      started_at: new Date(),
      lambda_request_id: metadata.lambdaRequestId || null,
      ec2_instance_id: metadata.ec2InstanceId || null,
    });

    return job;
  }

  /**
   * Update job progress
   * @param {string} jobId - Job UUID
   * @param {number} progressPercentage - 0-100
   */
  async updateProgress(jobId, progressPercentage) {
    const job = await VideoProcessingJob.findByPk(jobId);
    if (!job) throw new Error('Job not found');

    await job.update({ progress_percentage: progressPercentage });
    return job;
  }

  /**
   * Mark job as completed
   * @param {string} jobId - Job UUID
   * @param {Object} result
   * @param {string} result.outputS3Key - S3 key of rendered video
   * @param {string} result.outputUrl - Presigned URL
   */
  async markJobCompleted(jobId, result) {
    const job = await VideoProcessingJob.findByPk(jobId);
    if (!job) throw new Error('Job not found');

    await job.update({
      status: 'completed',
      completed_at: new Date(),
      progress_percentage: 100,
      output_s3_key: result.outputS3Key,
      output_url: result.outputUrl,
    });

    // Note: processing_duration_seconds is calculated by database trigger

    return job;
  }

  /**
   * Mark job as failed
   * @param {string} jobId - Job UUID
   * @param {string} errorMessage - Error description
   */
  async markJobFailed(jobId, errorMessage) {
    const job = await VideoProcessingJob.findByPk(jobId);
    if (!job) throw new Error('Job not found');

    await job.update({
      status: 'failed',
      completed_at: new Date(),
      error_message: errorMessage,
    });

    return job;
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>}
   */
  async getQueueStats() {
    const [queueStats, dlqStats] = await Promise.all([
      sqsService.getQueueStats(),
      sqsService.getDLQStats(),
    ]);

    const dbStats = await VideoProcessingJob.findAll({
      attributes: [
        'status',
        [VideoProcessingJob.sequelize.fn('COUNT', '*'), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    const statusCounts = {};
    dbStats.forEach(row => {
      statusCounts[row.status] = parseInt(row.count);
    });

    return {
      queue: queueStats,
      dlq: dlqStats,
      database: statusCounts,
    };
  }

  /**
   * Estimate processing duration based on edit structure
   * @private
   * @param {Object} editStructure
   * @returns {number} Estimated seconds
   */
  _estimateDuration(editStructure) {
    // Simple estimation: 2x the total video duration
    const totalDuration = editStructure.totalDuration || 0;
    return Math.ceil(totalDuration * 2);
  }
}

module.exports = new VideoJobService();

/* eslint-disable no-unused-vars, no-undef */
/**
 * Job Controller - HTTP endpoints for job management
 * Handles job creation, status tracking, and admin operations
 */

const { Job, JOB_STATUS, JOB_TYPE } = require('../models/job');
const { ProcessingQueue } = require('../models');
const QueueService = require('../services/QueueService');
const ErrorRecovery = require('../services/ErrorRecovery');
const logger = require('../utils/logger');
const ActivityService = require('../services/ActivityService');
const NotificationService = require('../services/NotificationService');
const SocketService = require('../services/SocketService');

class JobController {
  /**
   * Create a new job
   * POST /api/v1/jobs
   */
  static async createJob(req, res) {
    try {
      const { jobType, payload, maxRetries } = req.body;
      const userId = req.user.id;
      const { episodeId, fileId, metadata } = payload || {};
      const type = jobType;

      // Validate job type
      if (!Object.values(JOB_TYPE).includes(jobType)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_JOB_TYPE',
          message: `Invalid job type: ${jobType}`
        });
      }

      // Create job record
      const job = await Job.create({
        userId,
        jobType,
        payload,
        maxRetries: maxRetries || 3
      });

      // Send to queue
      try {
        await QueueService.sendJob(job.id);
      } catch (queueError) {
        logger.warn('Failed to send job to queue', { jobId: job.id, error: queueError.message });
      }

      // Create processing queue record for tracking
      const processingRecord = await ProcessingQueue.create({
        id: job.id,
        job_type: type,
        episode_id: episodeId,
        file_id: fileId,
        status: 'pending',
        progress: 0,
        data: { metadata },
        sqs_message_id: job.id,
      });

      logger.info('Job created', {
        jobId: job.id,
        type,
        episodeId,
      });

      // Phase 3A Integration: Activity Logging (non-blocking)
      ActivityService.logActivity({
        userId: req.user?.id,
        action: 'CREATE',
        resourceType: 'job',
        resourceId: job.id,
        metadata: { jobType: job.job_type, episodeId, payload: job.payload }
      }).catch((err) => console.error('Activity logging error:', err));

      // Phase 3A Integration: WebSocket broadcast (non-blocking)
      SocketService.broadcastMessage({
        event: 'job_created',
        data: {
          jobId: job.id,
          type: job.job_type,
          episodeId,
          createdBy: req.user?.email || 'unknown',
          timestamp: new Date()
        }
      }).catch((err) => console.error('WebSocket broadcast error:', err));

      // Phase 3A Integration: Notification (non-blocking)
      NotificationService.create({
        userId: req.user?.id,
        type: 'info',
        message: `Job created (${job.job_type})`,
        data: { resourceType: 'job', resourceId: job.id }
      }).catch((err) => console.error('Notification error:', err));

      res.status(201).json({
        jobId: job.id,
        type: job.job_type,
        status: job.status,
        progress: job.progress,
        createdAt: job.created_at,
      });
    } catch (error) {
      logger.error('Job creation failed', { error: error.message });
      res.status(500).json({ error: 'Job creation failed' });
    }
  }

  /**
   * Get job status
   * @param {object} req - Request object
   * @param {object} res - Response object
   */
  async getJobStatus(req, res) {
    try {
      const { jobId } = req.params;

      const job = await ProcessingQueue.findByPk(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json({
        jobId: job.id,
        type: job.job_type,
        status: job.status,
        progress: job.progress,
        retryCount: job.retry_count,
        error: job.error,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        completedAt: job.completed_at,
      });
    } catch (error) {
      logger.error('Failed to get job status', { error: error.message });
      res.status(500).json({ error: 'Failed to get job status' });
    }
  }

  /**
   * List jobs with filtering
   * @param {object} req - Request object
   * @param {object} res - Response object
   */
  async listJobs(req, res) {
    try {
      const {
        episodeId,
        status,
        type,
        limit = 20,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'DESC',
      } = req.query;

      const where = {};
      if (episodeId) where.episode_id = episodeId;
      if (status) where.status = status;
      if (type) where.job_type = type;

      const jobs = await ProcessingQueue.findAndCountAll({
        where,
        limit: Math.min(parseInt(limit), 100),
        offset: parseInt(offset),
        order: [[sortBy, sortOrder.toUpperCase()]],
      });

      res.json({
        total: jobs.count,
        limit: Math.min(parseInt(limit), 100),
        offset: parseInt(offset),
        jobs: jobs.rows.map((job) => ({
          jobId: job.id,
          type: job.job_type,
          status: job.status,
          progress: job.progress,
          retryCount: job.retry_count,
          createdAt: job.created_at,
          updatedAt: job.updated_at,
        })),
      });
    } catch (error) {
      logger.error('Failed to list jobs', { error: error.message });
      res.status(500).json({ error: 'Failed to list jobs' });
    }
  }

  /**
   * Retry failed job
   * @param {object} req - Request object
   * @param {object} res - Response object
   */
  async retryJob(req, res) {
    try {
      const { jobId } = req.params;

      const job = await ProcessingQueue.findByPk(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.status !== 'failed') {
        return res.status(400).json({ error: 'Only failed jobs can be retried' });
      }

      // Re-enqueue to SQS
      const sqsResult = await JobQueueService.enqueueJob({
        type: job.job_type,
        episodeId: job.episode_id,
        fileId: job.file_id,
        metadata: job.data?.metadata,
      });

      // Update job record
      await job.update({
        status: 'pending',
        progress: 0,
        error: null,
        retry_count: job.retry_count + 1,
        sqs_message_id: sqsResult.messageId,
      });

      logger.info('Job retried', {
        jobId,
        retryCount: job.retry_count + 1,
      });

      // Phase 3A Integration: Activity Logging (non-blocking)
      ActivityService.logActivity({
        userId: req.user?.id,
        action: 'RETRY',
        resourceType: 'job',
        resourceId: jobId,
        metadata: { retryCount: job.retry_count + 1, jobType: job.job_type }
      }).catch((err) => console.error('Activity logging error:', err));

      // Phase 3A Integration: WebSocket broadcast (non-blocking)
      SocketService.broadcastMessage({
        event: 'job_retried',
        data: {
          jobId,
          retryCount: job.retry_count + 1,
          timestamp: new Date()
        }
      }).catch((err) => console.error('WebSocket broadcast error:', err));

      res.json({
        jobId: job.id,
        status: job.status,
        retryCount: job.retry_count + 1,
        message: 'Job re-enqueued for processing',
      });
    } catch (error) {
      logger.error('Job retry failed', { error: error.message });
      res.status(500).json({ error: 'Job retry failed' });
    }
  }

  /**
   * Cancel pending job
   * @param {object} req - Request object
   * @param {object} res - Response object
   */
  async cancelJob(req, res) {
    try {
      const { jobId } = req.params;

      const job = await ProcessingQueue.findByPk(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.status !== 'pending' && job.status !== 'processing') {
        return res.status(400).json({
          error: 'Only pending or processing jobs can be cancelled',
        });
      }

      await job.update({
        status: 'cancelled',
      });

      logger.info('Job cancelled', { jobId });

      // Phase 3A Integration: Activity Logging (non-blocking)
      ActivityService.logActivity({
        userId: req.user?.id,
        action: 'CANCEL',
        resourceType: 'job',
        resourceId: jobId,
        metadata: { jobType: job.job_type }
      }).catch((err) => console.error('Activity logging error:', err));

      // Phase 3A Integration: WebSocket broadcast (non-blocking)
      SocketService.broadcastMessage({
        event: 'job_cancelled',
        data: {
          jobId,
          timestamp: new Date()
        }
      }).catch((err) => console.error('WebSocket broadcast error:', err));

      res.json({
        jobId: job.id,
        status: job.status,
        message: 'Job cancelled successfully',
      });
    } catch (error) {
      logger.error('Job cancellation failed', { error: error.message });
      res.status(500).json({ error: 'Job cancellation failed' });
    }
  }
}

module.exports = new JobController();

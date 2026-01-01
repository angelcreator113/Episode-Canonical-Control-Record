/**
 * JobController
 * Handles async job queue management endpoints
 */
const { ProcessingQueue } = require('../models');
const JobQueueService = require('../services/JobQueueService');
const logger = require('../utils/logger');

class JobController {
  /**
   * Create and enqueue a new job
   * @param {object} req - Request object
   * @param {object} res - Response object
   */
  async createJob(req, res) {
    try {
      const { type, episodeId, fileId, metadata } = req.body;

      if (!type || !episodeId) {
        return res.status(400).json({ error: 'type and episodeId are required' });
      }

      // Enqueue job to SQS
      const sqsResult = await JobQueueService.enqueueJob({
        type,
        episodeId,
        fileId,
        metadata,
      });

      // Create processing queue record for tracking
      const job = await ProcessingQueue.create({
        id: sqsResult.jobId,
        job_type: type,
        episode_id: episodeId,
        file_id: fileId,
        status: 'pending',
        progress: 0,
        data: { metadata },
        sqs_message_id: sqsResult.messageId,
      });

      logger.info('Job created', {
        jobId: job.id,
        type,
        episodeId,
      });

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

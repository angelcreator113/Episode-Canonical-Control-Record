const { models } = require('../models');
const { Episode, ProcessingQueue } = models;
const {
  NotFoundError,
  ValidationError,
} = require('../middleware/errorHandler');
const { logger } = require('../middleware/auditLog');

/**
 * Processing Queue Controller
 * Manages async job tracking for thumbnail generation, metadata extraction, and transcription
 */

module.exports = {
  /**
   * GET /processing-queue - List all processing jobs
   */
  async listJobs(req, res, next) {
    const { page = 1, limit = 20, status, jobType, episodeId } = req.query;
    const offset = (page - 1) * limit;

    let where = {};
    if (status) where.status = status;
    if (jobType) where.jobType = jobType;
    if (episodeId) where.episodeId = parseInt(episodeId);

    const { count, rows } = await ProcessingQueue.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: {
        model: Episode,
        as: 'episode',
        attributes: ['id', 'episodeTitle', 'showName', 'seasonNumber', 'episodeNumber'],
      },
    });

    // Log activity
    await logger.logAction(
      req.user?.id || 'anonymous',
      'view',
      'processing',
      'all',
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit),
      },
      summary: {
        total: count,
        byStatus: {
          pending: await ProcessingQueue.count({ where: { status: 'pending' } }),
          processing: await ProcessingQueue.count({ where: { status: 'processing' } }),
          completed: await ProcessingQueue.count({ where: { status: 'completed' } }),
          failed: await ProcessingQueue.count({ where: { status: 'failed' } }),
        },
      },
    });
  },

  /**
   * GET /processing-queue/:id - Get single job
   */
  async getJob(req, res, next) {
    const { id } = req.params;

    const job = await ProcessingQueue.findByPk(id, {
      include: {
        model: Episode,
        as: 'episode',
        attributes: ['id', 'episodeTitle', 'showName', 'seasonNumber', 'episodeNumber'],
      },
    });

    if (!job) {
      throw new NotFoundError('Processing job', id);
    }

    // Log activity
    await logger.logAction(
      req.user?.id || 'anonymous',
      'view',
      'processing',
      id,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({ data: job });
  },

  /**
   * POST /processing-queue - Create new processing job
   */
  async createJob(req, res, next) {
    const { episodeId, jobType, jobConfig = {} } = req.body;

    if (!episodeId || !jobType) {
      throw new ValidationError(
        'Missing required fields',
        {
          episodeId: !episodeId ? 'required' : null,
          jobType: !jobType ? 'required' : null,
        }
      );
    }

    // Validate jobType
    const validJobTypes = ['thumbnail_generation', 'metadata_extraction', 'transcription'];
    if (!validJobTypes.includes(jobType)) {
      throw new ValidationError(
        'Invalid job type',
        {
          jobType: `Must be one of: ${validJobTypes.join(', ')}`,
        }
      );
    }

    // Verify episode exists
    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      throw new NotFoundError('Episode', episodeId);
    }

    const job = await ProcessingQueue.create({
      episodeId,
      jobType,
      status: 'pending',
      jobConfig,
      maxRetries: 3,
      retryCount: 0,
    });

    // Log activity
    await logger.logAction(
      req.user?.id,
      'create',
      'processing',
      job.id,
      {
        newValues: {
          episodeId,
          jobType,
          status: 'pending',
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.status(201).json({
      data: job,
      message: 'Processing job created successfully',
    });
  },

  /**
   * PUT /processing-queue/:id - Update job status
   */
  async updateJob(req, res, next) {
    const { id } = req.params;
    const { status, errorMessage } = req.body;

    const job = await ProcessingQueue.findByPk(id);
    if (!job) {
      throw new NotFoundError('Processing job', id);
    }

    const oldValues = job.toJSON();
    const validStatuses = ['pending', 'processing', 'completed', 'failed'];

    if (status && !validStatuses.includes(status)) {
      throw new ValidationError(
        'Invalid status',
        { status: `Must be one of: ${validStatuses.join(', ')}` }
      );
    }

    const updateData = {};
    if (status) {
      updateData.status = status;
      if (status === 'processing' && !job.startedAt) {
        updateData.startedAt = new Date();
      }
      if ((status === 'completed' || status === 'failed') && !job.completedAt) {
        updateData.completedAt = new Date();
      }
    }
    if (errorMessage !== undefined) {
      updateData.errorMessage = errorMessage;
    }

    await job.update(updateData);

    // Log activity
    await logger.logAction(
      req.user?.id,
      'edit',
      'processing',
      id,
      {
        oldValues: { status: oldValues.status, errorMessage: oldValues.errorMessage },
        newValues: { status: job.status, errorMessage: job.errorMessage },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      data: job,
      message: 'Job updated successfully',
    });
  },

  /**
   * POST /processing-queue/:id/retry - Retry failed job
   */
  async retryJob(req, res, next) {
    const { id } = req.params;

    const job = await ProcessingQueue.findByPk(id);
    if (!job) {
      throw new NotFoundError('Processing job', id);
    }

    const oldValues = job.toJSON();

    if (!job.canRetry()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Job has exceeded maximum retries (${job.maxRetries})`,
        code: 'JOB_MAX_RETRIES_EXCEEDED',
      });
    }

    await job.retry();

    // Log activity
    await logger.logAction(
      req.user?.id,
      'edit',
      'processing',
      id,
      {
        oldValues: {
          status: oldValues.status,
          retryCount: oldValues.retryCount,
        },
        newValues: {
          status: job.status,
          retryCount: job.retryCount,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      data: job,
      message: `Job retried (attempt ${job.retryCount} of ${job.maxRetries})`,
    });
  },

  /**
   * DELETE /processing-queue/:id - Cancel job
   */
  async cancelJob(req, res, next) {
    const { id } = req.params;

    const job = await ProcessingQueue.findByPk(id);
    if (!job) {
      throw new NotFoundError('Processing job', id);
    }

    const oldValues = job.toJSON();

    // Only cancel pending jobs
    if (job.status !== 'pending') {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Cannot cancel job with status: ${job.status}`,
        code: 'JOB_CANNOT_CANCEL',
      });
    }

    await job.destroy();

    // Log activity
    await logger.logAction(
      req.user?.id,
      'delete',
      'processing',
      id,
      {
        oldValues,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      message: 'Processing job cancelled',
    });
  },

  /**
   * GET /processing-queue/episode/:episodeId - Get all jobs for episode
   */
  async getEpisodeJobs(req, res, next) {
    const { episodeId } = req.params;

    // Verify episode exists
    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      throw new NotFoundError('Episode', episodeId);
    }

    const jobs = await ProcessingQueue.getEpisodeJobs(episodeId);

    res.json({
      data: jobs,
      episodeId,
      count: jobs.length,
      summary: {
        byStatus: {
          pending: jobs.filter(j => j.status === 'pending').length,
          processing: jobs.filter(j => j.status === 'processing').length,
          completed: jobs.filter(j => j.status === 'completed').length,
          failed: jobs.filter(j => j.status === 'failed').length,
        },
        byType: {
          thumbnail_generation: jobs.filter(j => j.jobType === 'thumbnail_generation').length,
          metadata_extraction: jobs.filter(j => j.jobType === 'metadata_extraction').length,
          transcription: jobs.filter(j => j.jobType === 'transcription').length,
        },
      },
    });
  },

  /**
   * GET /processing-queue/pending - Get all pending jobs
   */
  async getPendingJobs(req, res, next) {
    const jobs = await ProcessingQueue.findPending();

    res.json({
      data: jobs,
      count: jobs.length,
      message: `${jobs.length} pending job(s) found`,
    });
  },

  /**
   * GET /processing-queue/failed - Get all failed jobs
   */
  async getFailedJobs(req, res, next) {
    const jobs = await ProcessingQueue.findFailed();

    res.json({
      data: jobs,
      count: jobs.length,
      message: `${jobs.length} failed job(s) found`,
    });
  },

  /**
   * GET /processing-queue/retryable - Get jobs ready for retry
   */
  async getRetryableJobs(req, res, next) {
    const jobs = await ProcessingQueue.findRetryable();

    res.json({
      data: jobs,
      count: jobs.length,
      message: `${jobs.length} job(s) available for retry`,
    });
  },

  /**
   * GET /processing-queue/stats - Get processing statistics
   */
  async getStats(req, res, next) {
    const stats = await ProcessingQueue.getStats();

    res.json({
      data: stats,
      message: 'Processing queue statistics',
    });
  },
};

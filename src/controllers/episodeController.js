const { models } = require('../models');
const { Episode, MetadataStorage, Thumbnail, ProcessingQueue, ActivityLog } = models;
const {
  NotFoundError,
  ValidationError,
  asyncHandler,
} = require('../middleware/errorHandler');
const { logger } = require('../middleware/auditLog');

/**
 * Episode Controller
 * Handles all episode-related API operations
 */

module.exports = {
  /**
   * GET /episodes - List all episodes
   */
  async listEpisodes(req, res, next) {
    const { page = 1, limit = 20, status, season } = req.query;
    const offset = (page - 1) * limit;

    let where = {};
    // Validate status if provided
    if (status) {
      const validStatuses = ['pending', 'processing', 'complete', 'failed', 'draft'];
      if (validStatuses.includes(status)) {
        where.processingStatus = status;
      }
    }
    if (season) where.seasonNumber = parseInt(season);

    const { count, rows } = await Episode.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['seasonNumber', 'ASC'], ['episodeNumber', 'ASC']],
      include: {
        model: Thumbnail,
        as: 'thumbnails',
        where: { thumbnail_type: 'primary' },
        required: false,
        attributes: ['id', 's3_bucket', 's3_key', 'mime_type', 'width_pixels', 'height_pixels'],
      },
    });

    // Log activity
    await logger.logAction(
      req.user?.id || 'anonymous',
      'view',
      'episode',
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
    });
  },

  /**
   * GET /episodes/:id - Get single episode
   */
  async getEpisode(req, res, next) {
    const { id } = req.params;

    const episode = await Episode.findByPk(id, {
      include: [
        // TODO: Include metadata when schema is fixed
        // {
        //   model: MetadataStorage,
        //   as: 'metadata',
        // },
        {
          model: Thumbnail,
          as: 'thumbnails',
          attributes: ['id', 's3_bucket', 's3_key', 'mime_type', 'width_pixels', 'height_pixels', 'thumbnail_type'],
        },
        // TODO: Include processing jobs when schema is fixed
        // {
        //   model: ProcessingQueue,
        //   as: 'processingJobs',
        // },
      ],
    });

    if (!episode) {
      throw new NotFoundError('Episode', id);
    }

    // Log activity
    await logger.logAction(
      req.user?.id || 'anonymous',
      'view',
      'episode',
      id,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({ data: episode });
  },

  /**
   * POST /episodes - Create new episode
   */
  async createEpisode(req, res, next) {
    const {
      showName,
      seasonNumber,
      episodeNumber,
      episodeTitle,
      airDate,
      plotSummary,
      director,
      writer,
      durationMinutes,
      rating,
      genre,
    } = req.body;

    // Validate required fields
    if (!showName || !seasonNumber || !episodeNumber || !episodeTitle) {
      throw new ValidationError(
        'Missing required fields',
        {
          showName: !showName ? 'required' : null,
          seasonNumber: !seasonNumber ? 'required' : null,
          episodeNumber: !episodeNumber ? 'required' : null,
          episodeTitle: !episodeTitle ? 'required' : null,
        }
      );
    }

    const episode = await Episode.create({
      showName,
      seasonNumber: parseInt(seasonNumber),
      episodeNumber: parseInt(episodeNumber),
      episodeTitle,
      airDate: airDate ? new Date(airDate) : null,
      plotSummary,
      director,
      writer,
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
      rating: rating ? parseFloat(rating) : null,
      genre,
      processingStatus: 'pending',
    });

    // Log activity
    await logger.logAction(
      req.user?.id,
      'create',
      'episode',
      episode.id,
      {
        newValues: episode.toJSON(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.status(201).json({
      data: episode,
      message: 'Episode created successfully',
    });
  },

  /**
   * PUT /episodes/:id - Update episode
   */
  async updateEpisode(req, res, next) {
    const { id } = req.params;
    const updates = req.body;

    const episode = await Episode.findByPk(id);
    if (!episode) {
      throw new NotFoundError('Episode', id);
    }

    const oldValues = episode.toJSON();

    // Whitelist updatable fields
    const allowedFields = [
      'episodeTitle',
      'airDate',
      'plotSummary',
      'director',
      'writer',
      'durationMinutes',
      'rating',
      'genre',
      'thumbnailUrl',
      'posterUrl',
      'videoUrl',
      'rawVideoS3Key',
      'processedVideoS3Key',
      'metadataJsonS3Key',
      'processingStatus',
    ];

    const updateData = {};
    allowedFields.forEach(field => {
      if (field in updates) {
        updateData[field] = updates[field];
      }
    });

    await episode.update(updateData);

    // Log activity
    await logger.logAction(
      req.user?.id,
      'edit',
      'episode',
      id,
      {
        oldValues,
        newValues: episode.toJSON(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      data: episode,
      message: 'Episode updated successfully',
    });
  },

  /**
   * DELETE /episodes/:id - Delete episode
   */
  async deleteEpisode(req, res, next) {
    const { id } = req.params;
    const { hard = false } = req.query;

    const episode = await Episode.findByPk(id);
    if (!episode) {
      throw new NotFoundError('Episode', id);
    }

    const oldValues = episode.toJSON();

    if (hard === 'true' && process.env.NODE_ENV !== 'production') {
      await episode.destroy({ force: true });
    } else {
      await episode.softDelete();
    }

    // Log activity
    await logger.logAction(
      req.user?.id,
      'delete',
      'episode',
      id,
      {
        oldValues,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      message: `Episode ${id} deleted successfully`,
      type: hard === 'true' ? 'permanent' : 'soft',
    });
  },

  /**
   * GET /episodes/:id/status - Get episode processing status
   */
  async getEpisodeStatus(req, res, next) {
    const { id } = req.params;

    const episode = await Episode.findByPk(id, {
      attributes: ['id', 'episodeTitle', 'processingStatus', 'uploadDate'],
      include: {
        model: ProcessingQueue,
        as: 'processingJobs',
        attributes: ['jobType', 'status', 'createdAt', 'completedAt'],
      },
    });

    if (!episode) {
      throw new NotFoundError('Episode', id);
    }

    res.json({ data: episode });
  },

  /**
   * POST /episodes/:id/enqueue - Enqueue episode for processing
   */
  async enqueueEpisode(req, res, next) {
    const { id } = req.params;
    const { jobTypes = ['thumbnail_generation', 'metadata_extraction'] } = req.body;

    const episode = await Episode.findByPk(id);
    if (!episode) {
      throw new NotFoundError('Episode', id);
    }

    const jobs = await Promise.all(
      jobTypes.map(jobType =>
        ProcessingQueue.create({
          episodeId: id,
          jobType,
          status: 'pending',
          jobConfig: req.body.jobConfig || {},
        })
      )
    );

    // Update episode status
    await episode.updateStatus('processing');

    // Log activity
    await logger.logAction(
      req.user?.id,
      'create',
      'processing',
      id,
      {
        newValues: { jobTypes, count: jobs.length },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      data: jobs,
      message: `${jobs.length} job(s) enqueued for episode ${id}`,
    });
  },
};

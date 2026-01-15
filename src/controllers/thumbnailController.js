const { models } = require('../models');
const { Episode, Thumbnail } = models;
const {
  NotFoundError,
  ValidationError,
  ConflictError,
} = require('../middleware/errorHandler');
const { logger } = require('../middleware/auditLog');

/**
 * Thumbnail Controller
 * Handles thumbnail image metadata and S3 reference management
 */

module.exports = {
  /**
   * GET /thumbnails - List all thumbnails
   */
  async listThumbnails(req, res, _next) {
    try {
      const { page = 1, limit = 20, episodeId, type } = req.query;
      const offset = (page - 1) * limit;

      const where = {};
      if (episodeId) where.episodeId = parseInt(episodeId);
      if (type) where.thumbnailType = type;

      const { count, rows } = await Thumbnail.findAndCountAll({
        attributes: [
          'id',
          'episodeId',
          's3Bucket',
          's3Key',
          'fileSizeBytes',
          'mimeType',
          'widthPixels',
          'heightPixels',
          'format',
          'thumbnailType',
          'positionSeconds',
          'generatedAt',
          'qualityRating'
        ],
        where,
        limit: parseInt(limit),
        offset,
        order: [['generatedAt', 'DESC']],
        include: {
          model: Episode,
          as: 'episode',
          attributes: ['id', 'episodeTitle', 'showName'],
        },
      });

      res.json({
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit),
        },
      });
    } catch (error) {
      console.error('❌ Error in listThumbnails:', error);
      res.status(500).json({
        error: 'Failed to list thumbnails',
        message: error.message
      });
    }
  },

  /**
   * GET /thumbnails/:id - Get single thumbnail
   */
  async getThumbnail(req, res, _next) {
    try {
      const { id } = req.params;

      const thumbnail = await Thumbnail.findByPk(id, {
        attributes: [
          'id',
          'episodeId',
          's3Bucket',
          's3Key',
          'fileSizeBytes',
          'mimeType',
          'widthPixels',
          'heightPixels',
          'format',
          'thumbnailType',
          'positionSeconds',
          'generatedAt',
          'qualityRating'
        ],
        include: {
          model: Episode,
          as: 'episode',
          attributes: ['id', 'episodeTitle', 'showName', 'seasonNumber', 'episodeNumber'],
        },
      });

      if (!thumbnail) {
        return res.status(404).json({
          error: 'Thumbnail not found',
          id
        });
      }

      res.json({ data: thumbnail });
    } catch (error) {
      console.error('❌ Error in getThumbnail:', error);
      res.status(500).json({
        error: 'Failed to get thumbnail',
        message: error.message
      });
    }
  },

  /**
   * POST /thumbnails - Create new thumbnail
   */
  async createThumbnail(req, res, _next) {
    const {
      episodeId,
      s3Bucket,
      s3Key,
      fileSizeBytes,
      mimeType = 'image/jpeg',
      widthPixels,
      heightPixels,
      format = 'thumbnail',
      thumbnailType = 'primary',
      positionSeconds,
      qualityRating,
    } = req.body;

    // Validate required fields
    if (!episodeId || !s3Bucket || !s3Key) {
      throw new ValidationError(
        'Missing required fields',
        {
          episodeId: !episodeId ? 'required' : null,
          s3Bucket: !s3Bucket ? 'required' : null,
          s3Key: !s3Key ? 'required' : null,
        }
      );
    }

    // Verify episode exists
    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      throw new NotFoundError('Episode', episodeId);
    }

    // Check for duplicate s3Key
    const existingThumbnail = await Thumbnail.findOne({ where: { s3Key } });
    if (existingThumbnail) {
      throw new ConflictError(
        'Thumbnail with this S3 key already exists',
        { s3Key }
      );
    }

    const thumbnail = await Thumbnail.create({
      episodeId,
      s3Bucket,
      s3Key,
      fileSizeBytes: fileSizeBytes ? parseInt(fileSizeBytes) : null,
      mimeType,
      widthPixels: widthPixels ? parseInt(widthPixels) : null,
      heightPixels: heightPixels ? parseInt(heightPixels) : null,
      format,
      thumbnailType,
      positionSeconds: positionSeconds ? parseFloat(positionSeconds) : null,
      qualityRating,
    });

    // Log activity
    await logger.logAction(
      req.user?.id,
      'create',
      'thumbnail',
      thumbnail.id,
      {
        newValues: thumbnail.toJSON(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.status(201).json({
      data: thumbnail,
      message: 'Thumbnail created successfully',
    });
  },

  /**
   * PUT /thumbnails/:id - Update thumbnail
   */
  async updateThumbnail(req, res, _next) {
    const { id } = req.params;
    const updates = req.body;

    const thumbnail = await Thumbnail.findByPk(id);
    if (!thumbnail) {
      throw new NotFoundError('Thumbnail', id);
    }

    const oldValues = thumbnail.toJSON();

    // Whitelist updatable fields
    const allowedFields = [
      'fileSizeBytes',
      'widthPixels',
      'heightPixels',
      'format',
      'qualityRating',
    ];

    const updateData = {};
    allowedFields.forEach(field => {
      if (field in updates) {
        updateData[field] = updates[field];
      }
    });

    await thumbnail.update(updateData);

    // Log activity
    await logger.logAction(
      req.user?.id,
      'edit',
      'thumbnail',
      id,
      {
        oldValues,
        newValues: thumbnail.toJSON(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      data: thumbnail,
      message: 'Thumbnail updated successfully',
    });
  },

  /**
   * DELETE /thumbnails/:id - Delete thumbnail
   */
  async deleteThumbnail(req, res, _next) {
    const { id } = req.params;

    const thumbnail = await Thumbnail.findByPk(id);
    if (!thumbnail) {
      throw new NotFoundError('Thumbnail', id);
    }

    const oldValues = thumbnail.toJSON();

    await thumbnail.destroy();

    // Log activity
    await logger.logAction(
      req.user?.id,
      'delete',
      'thumbnail',
      id,
      {
        oldValues,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      message: `Thumbnail ${id} deleted successfully`,
    });
  },

  /**
   * GET /thumbnails/:id/url - Get S3 URL for thumbnail
   */
  async getThumbnailUrl(req, res, _next) {
    const { id } = req.params;
    const { cdn = false } = req.query;

    const thumbnail = await Thumbnail.findByPk(id);
    if (!thumbnail) {
      throw new NotFoundError('Thumbnail', id);
    }

    const url = cdn ? thumbnail.getCloudfrontUrl() : thumbnail.getS3Url();

    res.json({
      data: {
        id: thumbnail.id,
        url,
        s3Bucket: thumbnail.s3Bucket,
        s3Key: thumbnail.s3Key,
        mimeType: thumbnail.mimeType,
        useCdn: cdn,
      },
      message: 'Thumbnail URL retrieved successfully',
    });
  },

  /**
   * GET /thumbnails/:id/download - Prepare thumbnail for download
   */
  async prepareThumbnailDownload(req, res, _next) {
    const { id } = req.params;

    const thumbnail = await Thumbnail.findByPk(id, {
      include: {
        model: Episode,
        as: 'episode',
        attributes: ['episodeTitle', 'showName', 'seasonNumber', 'episodeNumber'],
      },
    });

    if (!thumbnail) {
      throw new NotFoundError('Thumbnail', id);
    }

    // Log activity
    await logger.logAction(
      req.user?.id,
      'download',
      'thumbnail',
      id,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    // Prepare download response
    const episode = thumbnail.episode;
    const filename = `${episode.showName}-S${episode.seasonNumber}E${episode.episodeNumber}-${thumbnail.thumbnailType}.${thumbnail.mimeType.split('/')[1]}`;

    res.json({
      data: {
        id: thumbnail.id,
        filename,
        url: thumbnail.getS3Url(),
        s3Bucket: thumbnail.s3Bucket,
        s3Key: thumbnail.s3Key,
        mimeType: thumbnail.mimeType,
        fileSize: thumbnail.fileSizeBytes,
        generatedAt: thumbnail.generatedAt,
      },
      message: 'Thumbnail download prepared',
    });
  },

  /**
   * POST /thumbnails/:id/rate-quality - Rate thumbnail quality
   */
  async rateThumbnailQuality(req, res, _next) {
    const { id } = req.params;
    const { rating } = req.body;

    if (!rating || !['low', 'medium', 'high', 'excellent'].includes(rating)) {
      throw new ValidationError(
        'Invalid quality rating',
        {
          rating: 'Must be one of: low, medium, high, excellent',
        }
      );
    }

    const thumbnail = await Thumbnail.findByPk(id);
    if (!thumbnail) {
      throw new NotFoundError('Thumbnail', id);
    }

    const oldValue = thumbnail.qualityRating;
    await thumbnail.setQualityRating(rating);

    // Log activity
    await logger.logAction(
      req.user?.id,
      'edit',
      'thumbnail',
      id,
      {
        oldValues: { qualityRating: oldValue },
        newValues: { qualityRating: rating },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      data: thumbnail,
      message: 'Thumbnail quality rated successfully',
    });
  },

  /**
   * GET /episodes/:episodeId/thumbnails - Get all thumbnails for episode
   */
  async getEpisodeThumbnails(req, res, _next) {
    const { episodeId } = req.params;

    // Verify episode exists
    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      throw new NotFoundError('Episode', episodeId);
    }

    const thumbnails = await Thumbnail.findAll({
      where: { episodeId },
      order: [['thumbnailType', 'ASC'], ['generatedAt', 'DESC']],
    });

    res.json({
      data: thumbnails,
      count: thumbnails.length,
      episodeId,
    });
  },

  /**
   * GET /episodes/:episodeId/thumbnails/primary - Get primary thumbnail for episode
   */
  async getPrimaryThumbnail(req, res, _next) {
    const { episodeId } = req.params;

    const thumbnail = await Thumbnail.findOne({
      where: {
        episodeId,
        thumbnailType: 'primary',
      },
    });

    if (!thumbnail) {
      throw new NotFoundError(
        'Primary thumbnail for episode',
        episodeId
      );
    }

    res.json({
      data: thumbnail,
      message: 'Primary thumbnail retrieved successfully',
    });
  },
};

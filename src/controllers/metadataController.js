const { models } = require('../models');
const { Episode, MetadataStorage } = models;
const {
  NotFoundError,
  ValidationError,
} = require('../middleware/errorHandler');
const { logger } = require('../middleware/auditLog');

/**
 * Metadata Storage Controller
 * Handles ML/AI extracted metadata and analysis results
 */

module.exports = {
  /**
   * GET /metadata - List all metadata
   */
  async listMetadata(req, res, next) {
    const { page = 1, limit = 20, episodeId } = req.query;
    const offset = (page - 1) * limit;

    let where = {};
    if (episodeId) where.episodeId = parseInt(episodeId);

    try {
      const { count, rows } = await MetadataStorage.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset,
        order: [['createdAt', 'DESC']],
        include: {
          model: Episode,
          as: 'episode',
          attributes: ['id', 'episodeTitle', 'showName'],
        },
        raw: false,
      });

      // Log activity
      await logger.logAction(
        req.user?.id || 'anonymous',
        'view',
        'metadata',
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
    } catch (error) {
      // If metadata table schema is mismatched, return empty list
      console.error('Metadata query error (schema mismatch):', error.message);
      res.json({
        data: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0,
        },
        warning: 'Metadata table schema mismatch - returning empty results',
      });
    }
  },

  /**
   * GET /metadata/:id - Get single metadata record
   */
  async getMetadata(req, res, next) {
    const { id } = req.params;

    const metadata = await MetadataStorage.findByPk(id, {
      include: {
        model: Episode,
        as: 'episode',
        attributes: ['id', 'episodeTitle', 'showName', 'seasonNumber', 'episodeNumber'],
      },
    });

    if (!metadata) {
      throw new NotFoundError('Metadata', id);
    }

    // Log activity
    await logger.logAction(
      req.user?.id || 'anonymous',
      'view',
      'metadata',
      id,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({ data: metadata });
  },

  /**
   * GET /metadata/episode/:episodeId - Get metadata for specific episode
   */
  async getMetadataForEpisode(req, res, next) {
    const { episodeId } = req.params;

    // Verify episode exists
    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      throw new NotFoundError('Episode', episodeId);
    }

    const metadata = await MetadataStorage.getForEpisode(episodeId);

    if (!metadata) {
      return res.json({
        data: null,
        message: 'No metadata found for this episode',
      });
    }

    res.json({
      data: metadata,
      episodeId,
    });
  },

  /**
   * POST /metadata - Create or update metadata
   */
  async createOrUpdateMetadata(req, res, next) {
    const {
      episodeId,
      extractedText,
      scenesDetected,
      sentimentAnalysis,
      visualObjects,
      transcription,
      tags,
      categories,
      processingDurationSeconds,
    } = req.body;

    if (!episodeId) {
      throw new ValidationError(
        'Missing required fields',
        { episodeId: 'required' }
      );
    }

    // Verify episode exists
    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      throw new NotFoundError('Episode', episodeId);
    }

    const metadata = await MetadataStorage.createOrUpdate(episodeId, {
      extractedText,
      scenesDetected: scenesDetected ? JSON.parse(JSON.stringify(scenesDetected)) : null,
      sentimentAnalysis: sentimentAnalysis ? JSON.parse(JSON.stringify(sentimentAnalysis)) : null,
      visualObjects: visualObjects ? JSON.parse(JSON.stringify(visualObjects)) : null,
      transcription,
      tags: tags ? Array.isArray(tags) ? tags : JSON.parse(tags) : null,
      categories: categories ? Array.isArray(categories) ? categories : JSON.parse(categories) : null,
      processingDurationSeconds: processingDurationSeconds ? parseInt(processingDurationSeconds) : null,
      extractionTimestamp: new Date(),
    });

    // Log activity
    await logger.logAction(
      req.user?.id,
      'create',
      'metadata',
      metadata.id,
      {
        newValues: {
          episodeId,
          extractedText: extractedText ? 'present' : null,
          scenesDetected: scenesDetected ? 'present' : null,
          sentimentAnalysis: sentimentAnalysis ? 'present' : null,
          visualObjects: visualObjects ? 'present' : null,
          transcription: transcription ? 'present' : null,
          tags,
          categories,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.status(201).json({
      data: metadata,
      message: 'Metadata created/updated successfully',
    });
  },

  /**
   * PUT /metadata/:id - Update metadata
   */
  async updateMetadata(req, res, next) {
    const { id } = req.params;
    const updates = req.body;

    const metadata = await MetadataStorage.findByPk(id);
    if (!metadata) {
      throw new NotFoundError('Metadata', id);
    }

    const oldValues = metadata.toJSON();

    // Whitelist updatable fields
    const allowedFields = [
      'extractedText',
      'scenesDetected',
      'sentimentAnalysis',
      'visualObjects',
      'transcription',
      'tags',
      'categories',
      'processingDurationSeconds',
    ];

    const updateData = {
      extractionTimestamp: new Date(),
    };

    allowedFields.forEach(field => {
      if (field in updates) {
        if (typeof updates[field] === 'string' && 
            ['scenesDetected', 'sentimentAnalysis', 'visualObjects', 'tags', 'categories'].includes(field)) {
          try {
            updateData[field] = JSON.parse(updates[field]);
          } catch (e) {
            updateData[field] = updates[field];
          }
        } else {
          updateData[field] = updates[field];
        }
      }
    });

    await metadata.update(updateData);

    // Log activity
    await logger.logAction(
      req.user?.id,
      'edit',
      'metadata',
      id,
      {
        oldValues: {
          ...oldValues,
          extractedText: oldValues.extractedText ? 'present' : null,
          scenesDetected: oldValues.scenesDetected ? 'present' : null,
          sentimentAnalysis: oldValues.sentimentAnalysis ? 'present' : null,
          visualObjects: oldValues.visualObjects ? 'present' : null,
          transcription: oldValues.transcription ? 'present' : null,
        },
        newValues: {
          ...metadata.toJSON(),
          extractedText: metadata.extractedText ? 'present' : null,
          scenesDetected: metadata.scenesDetected ? 'present' : null,
          sentimentAnalysis: metadata.sentimentAnalysis ? 'present' : null,
          visualObjects: metadata.visualObjects ? 'present' : null,
          transcription: metadata.transcription ? 'present' : null,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      data: metadata,
      message: 'Metadata updated successfully',
    });
  },

  /**
   * DELETE /metadata/:id - Delete metadata
   */
  async deleteMetadata(req, res, next) {
    const { id } = req.params;

    const metadata = await MetadataStorage.findByPk(id);
    if (!metadata) {
      throw new NotFoundError('Metadata', id);
    }

    const oldValues = metadata.toJSON();

    await metadata.destroy();

    // Log activity
    await logger.logAction(
      req.user?.id,
      'delete',
      'metadata',
      id,
      {
        oldValues,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      message: `Metadata ${id} deleted successfully`,
    });
  },

  /**
   * POST /metadata/:id/add-tags - Add tags to metadata
   */
  async addTags(req, res, next) {
    const { id } = req.params;
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      throw new ValidationError(
        'Invalid tags',
        { tags: 'Must be non-empty array' }
      );
    }

    const metadata = await MetadataStorage.findByPk(id);
    if (!metadata) {
      throw new NotFoundError('Metadata', id);
    }

    const oldTags = metadata.tags || [];
    await metadata.addTags(tags);

    // Log activity
    await logger.logAction(
      req.user?.id,
      'edit',
      'metadata',
      id,
      {
        oldValues: { tags: oldTags },
        newValues: { tags: metadata.tags },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      data: metadata,
      message: `${tags.length} tag(s) added to metadata`,
    });
  },

  /**
   * POST /metadata/:id/set-scenes - Set detected scenes
   */
  async setDetectedScenes(req, res, next) {
    const { id } = req.params;
    const { scenes, duration } = req.body;

    if (!scenes || !Array.isArray(scenes)) {
      throw new ValidationError(
        'Invalid scenes data',
        { scenes: 'Must be array' }
      );
    }

    const metadata = await MetadataStorage.findByPk(id);
    if (!metadata) {
      throw new NotFoundError('Metadata', id);
    }

    const oldScenes = metadata.scenesDetected;
    const oldDuration = metadata.processingDurationSeconds;

    await metadata.setDetectedScenes(scenes, duration);

    // Log activity
    await logger.logAction(
      req.user?.id,
      'edit',
      'metadata',
      id,
      {
        oldValues: {
          scenesDetected: oldScenes ? 'present' : null,
          processingDurationSeconds: oldDuration,
        },
        newValues: {
          scenesDetected: 'present',
          processingDurationSeconds: duration,
          sceneCount: scenes.length,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    res.json({
      data: metadata,
      message: `${scenes.length} scene(s) detected and saved`,
    });
  },

  /**
   * GET /metadata/:id/summary - Get metadata summary without large JSON fields
   */
  async getMetadataSummary(req, res, next) {
    const { id } = req.params;

    const metadata = await MetadataStorage.findByPk(id);
    if (!metadata) {
      throw new NotFoundError('Metadata', id);
    }

    const summary = {
      id: metadata.id,
      episodeId: metadata.episodeId,
      extractedText: metadata.extractedText ? 'present' : null,
      scenesCount: metadata.scenesDetected ? metadata.scenesDetected.length : 0,
      sentimentAnalysis: metadata.sentimentAnalysis ? 'present' : null,
      visualObjectsCount: metadata.visualObjects ? Object.keys(metadata.visualObjects).length : 0,
      hasTranscription: !!metadata.transcription,
      tagsCount: metadata.tags ? metadata.tags.length : 0,
      categoriesCount: metadata.categories ? metadata.categories.length : 0,
      processingDurationSeconds: metadata.processingDurationSeconds,
      extractionTimestamp: metadata.extractionTimestamp,
      createdAt: metadata.createdAt,
    };

    res.json({
      data: summary,
      message: 'Metadata summary retrieved',
    });
  },
};

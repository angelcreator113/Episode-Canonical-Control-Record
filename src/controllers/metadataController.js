/* eslint-disable no-unused-vars */
const { models } = require('../models');
const { Episode, MetadataStorage } = models;
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { logger, fieldChanges } = require('../middleware/auditLog');

const ANALYSIS_FIELDS = ['extractedText', 'scenesDetected', 'sentimentAnalysis', 'visualObjects', 'transcription'];
/**
 * A metadata row as an audit entry keeps it: its ids, tags, categories and
 * processing time, and for each analysis field only whether it is present.
 */
function metadataSummary(row) {
  const m = row && typeof row.toJSON === 'function' ? row.toJSON() : row || {};
  return {
    id: m.id ?? null,
    episodeId: m.episodeId ?? m.episode_id ?? null,
    tags: m.tags ?? null,
    categories: m.categories ?? null,
    processingDurationSeconds: m.processingDurationSeconds ?? null,
    ...Object.fromEntries(ANALYSIS_FIELDS.map((field) => [field, m[field] ? 'present' : null])),
  };
}

/**
 * Metadata Storage Controller
 * Handles ML/AI extracted metadata and analysis results
 */

module.exports = {
  /**
   * GET /metadata - List all metadata
   */
  async listMetadata(req, res, _next) {
    const { page = 1, limit = 20, episodeId } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (episodeId) where.episodeId = parseInt(episodeId);

    try {
      const { count, rows } = await MetadataStorage.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset,
        // #1883: MetadataStorage has timestamps: false (no createdAt) and
        // Episode declares neither episodeTitle nor showName; order by the
        // autoincrement id and select the declared title instead.
        order: [['id', 'DESC']],
        include: {
          model: Episode,
          as: 'episode',
          attributes: ['id', 'title'],
        },
        raw: false,
      });

      // Log activity
      // Viewing is not audited (Evoni, 2026-11-11: no page-view entries).

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
      // #1883: this used to answer 200 with an empty list and a "schema
      // mismatch" warning, which hid a query that fails on every call. Fail.
      console.error('Metadata list query error:', error.message);
      res.status(500).json({ error: 'Failed to list metadata', message: error.message });
    }
  },

  /**
   * GET /metadata/:id - Get single metadata record
   */
  async getMetadata(req, res, _next) {
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
    // Viewing is not audited (Evoni, 2026-11-11: no page-view entries).

    res.json({ data: metadata });
  },

  /**
   * GET /metadata/episode/:episodeId - Get metadata for specific episode
   */
  async getMetadataForEpisode(req, res, _next) {
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
  async createOrUpdateMetadata(req, res, _next) {
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
      throw new ValidationError('Missing required fields', { episodeId: 'required' });
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
      tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : null,
      categories: categories
        ? Array.isArray(categories)
          ? categories
          : JSON.parse(categories)
        : null,
      processingDurationSeconds: processingDurationSeconds
        ? parseInt(processingDurationSeconds)
        : null,
      extractionTimestamp: new Date(),
    });

    // Log activity
    await logger.logAction(req.user?.id, 'create', 'metadata', metadata.id, {
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
    });

    res.status(201).json({
      data: metadata,
      message: 'Metadata created/updated successfully',
    });
  },

  /**
   * PUT /metadata/:id - Update metadata
   */
  async updateMetadata(req, res, _next) {
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

    allowedFields.forEach((field) => {
      if (field in updates) {
        if (
          typeof updates[field] === 'string' &&
          ['scenesDetected', 'sentimentAnalysis', 'visualObjects', 'tags', 'categories'].includes(
            field
          )
        ) {
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
    // Only what changed. The five analysis fields are large and are recorded
    // as present or not; tags and categories are kept (bounded by the logger).
    // sentFields names what the request set: an analysis field replaced by
    // another value is "present" on both sides and would otherwise not show.
    await logger.logAction(req.user?.id, 'edit', 'metadata', id, {
      ...fieldChanges(metadataSummary(oldValues), metadataSummary(metadata)),
      sentFields: allowedFields.filter((field) => field in updates),
    });

    res.json({
      data: metadata,
      message: 'Metadata updated successfully',
    });
  },

  /**
   * DELETE /metadata/:id - Delete metadata
   */
  async deleteMetadata(req, res, _next) {
    const { id } = req.params;

    const metadata = await MetadataStorage.findByPk(id);
    if (!metadata) {
      throw new NotFoundError('Metadata', id);
    }

    const oldValues = metadata.toJSON();

    await metadata.destroy();

    // Log activity
    await logger.logAction(req.user?.id, 'delete', 'metadata', id, { oldValues: metadataSummary(oldValues) });

    res.json({
      message: `Metadata ${id} deleted successfully`,
    });
  },

  /**
   * POST /metadata/:id/add-tags - Add tags to metadata
   */
  async addTags(req, res, _next) {
    const { id } = req.params;
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      throw new ValidationError('Invalid tags', { tags: 'Must be non-empty array' });
    }

    const metadata = await MetadataStorage.findByPk(id);
    if (!metadata) {
      throw new NotFoundError('Metadata', id);
    }

    const oldTags = metadata.tags || [];
    await metadata.addTags(tags);

    // Log activity
    await logger.logAction(req.user?.id, 'edit', 'metadata', id, {
      oldValues: { tags: oldTags },
      newValues: { tags: metadata.tags },
    });

    res.json({
      data: metadata,
      message: `${tags.length} tag(s) added to metadata`,
    });
  },

  /**
   * POST /metadata/:id/set-scenes - Set detected scenes
   */
  async setDetectedScenes(req, res, _next) {
    const { id } = req.params;
    const { scenes, duration } = req.body;

    if (!scenes || !Array.isArray(scenes)) {
      throw new ValidationError('Invalid scenes data', { scenes: 'Must be array' });
    }

    const metadata = await MetadataStorage.findByPk(id);
    if (!metadata) {
      throw new NotFoundError('Metadata', id);
    }

    const oldScenes = metadata.scenesDetected;
    const oldDuration = metadata.processingDurationSeconds;

    await metadata.setDetectedScenes(scenes, duration);

    // Log activity
    await logger.logAction(req.user?.id, 'edit', 'metadata', id, {
      oldValues: {
        scenesDetected: oldScenes ? 'present' : null,
        processingDurationSeconds: oldDuration,
      },
      newValues: {
        scenesDetected: 'present',
        processingDurationSeconds: duration,
        sceneCount: scenes.length,
      },
    });

    res.json({
      data: metadata,
      message: `${scenes.length} scene(s) detected and saved`,
    });
  },

  /**
   * GET /metadata/:id/summary - Get metadata summary without large JSON fields
   */
  async getMetadataSummary(req, res, _next) {
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

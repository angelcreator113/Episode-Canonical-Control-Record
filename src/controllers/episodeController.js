/* eslint-disable no-unused-vars */
const { models } = require('../models');
const {
  Episode,
  MetadataStorage,
  Thumbnail,
  ProcessingQueue,
  ActivityLog,
  Show,
  Asset,
  EpisodeAsset,
} = models;
const { NotFoundError, ValidationError, asyncHandler } = require('../middleware/errorHandler');
const { logger } = require('../middleware/auditLog');
const AuditLogger = require('../services/AuditLogger');

// Phase 3A Services
const ActivityService = require('../services/ActivityService');
const NotificationService = require('../services/NotificationService');
const PresenceService = require('../services/PresenceService');
const SocketService = require('../services/SocketService');
/* eslint-enable no-unused-vars */

/**
 * Episode Controller
 * Handles all episode-related API operations
 */

module.exports = {
  /**
   * GET /episodes - List all episodes
   */
  async listEpisodes(req, res, _next) {
    try {
      const { page = 1, limit = 20, status, sort } = req.query;
      const offset = (page - 1) * limit;

      const where = {
        // ✅ FIX: Only show episodes that haven't been soft-deleted
        deleted_at: null,
      };
      // Validate status if provided
      if (status) {
        const validStatuses = ['pending', 'approved', 'rejected', 'archived', 'draft', 'published'];
        if (validStatuses.includes(status)) {
          where.status = status;
        }
      }

      // Parse sort parameter (format: "field:direction")
      let order = [['created_at', 'DESC']]; // default
      if (sort) {
        const [field, direction] = sort.split(':');
        const validFields = ['title', 'episode_number', 'air_date', 'created_at', 'status'];
        const validDirections = ['ASC', 'DESC'];

        if (validFields.includes(field) && validDirections.includes(direction?.toUpperCase())) {
          order = [[field, direction.toUpperCase()]];
        }
      }

      const { count, rows } = await Episode.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset,
        order,
        attributes: [
          'id',
          'episode_number',
          'title',
          'description',
          'air_date',
          'status',
          'categories',
          'show_id',
          'created_at',
          'updated_at',
        ],
        include: [
          {
            model: Show,
            as: 'show',
            attributes: ['id', 'name', 'icon', 'color'],
          },
        ],
      });

      // Log activity (wrapped in try-catch to prevent failures)
      // TEMPORARILY DISABLED DUE TO AUDIT LOG ERRORS
      /*
      try {
        await logger.logAction(req.user?.id, 'view', 'episode', 'all', {
          count,
          filters: { status, sort },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (logError) {
        console.warn('⚠️ Failed to log activity:', logError.message);
      }
      */

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
      console.error('❌ Error in listEpisodes:', error);
      res.status(500).json({
        error: 'Failed to list episodes',
        message: error.message,
      });
    }
  },

  /**
   * GET /episodes/:id - Get single episode
   */
  async getEpisode(req, res, _next) {
    try {
      const { id } = req.params;

      // Query with proper column names that match the model
      const episode = await Episode.findByPk(id, {
        attributes: [
          'id',
          'episode_number',
          'title',
          'description',
          'air_date',
          'status',
          'categories',
          'show_id',
          'created_at',
          'updated_at',
        ],
        include: [
          {
            model: Show,
            as: 'show',
            attributes: ['id', 'name', 'icon', 'color'],
          },
        ],
      });

      if (!episode) {
        return res.status(404).json({
          error: 'Episode not found',
          id,
        });
      }

      // Log viewing activity (wrapped in try-catch to prevent failures)
      // TEMPORARILY DISABLED DUE TO AUDIT LOG ERRORS
      /*
      try {
        await logger.logAction(req.user?.id, 'view', 'episode', id, {
          episodeTitle: episode.title,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (logError) {
        console.warn('⚠️ Failed to log activity:', logError.message);
      }
      */

      res.json({
        data: episode,
      });
    } catch (error) {
      console.error('❌ Error in getEpisode:', error);
      res.status(500).json({
        error: 'Failed to get episode',
        message: error.message,
      });
    }
  },

  /**
   * POST /episodes - Create new episode
   */
  async createEpisode(req, res, _next) {
    try {
      const {
        // New field names (from frontend form)
        title,
        episode_number,
        description,
        air_date,
        status,
        categories,
        // Old field names (for backward compatibility)
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

      // Use new field names if provided, otherwise fall back to old ones
      const finalTitle = title || episodeTitle || showName;
      const finalEpisodeNumber = episode_number || episodeNumber;
      const finalDescription = description || plotSummary;
      const finalAirDate = air_date || airDate;
      const finalStatus = status || 'draft';

      // Validate required fields
      if (!finalTitle || !finalEpisodeNumber) {
        return res.status(400).json({
          error: 'Missing required fields',
          fields: {
            title: !finalTitle ? 'required' : null,
            episode_number: !finalEpisodeNumber ? 'required' : null,
          },
        });
      }

      // Get show_id from request, let database foreign key constraint validate it
      const validatedShowId = req.body.show_id || null;

      // Prepare episode data
      const episodeData = {
        title: finalTitle,
        episode_number: parseInt(finalEpisodeNumber),
        description: finalDescription || null,
        air_date: finalAirDate ? new Date(finalAirDate) : null,
        status: finalStatus,
        categories: Array.isArray(categories) ? categories : [],
        show_id: validatedShowId,
      };

      console.log('📝 Creating episode with data:', JSON.stringify(episodeData, null, 2));

      // Create episode with explicit error handling
      let episode;
      try {
        episode = await Episode.create(episodeData);
        console.log('✅ Episode created successfully:', { id: episode.id, title: episode.title });
      } catch (createError) {
        console.error('❌ Episode.create failed:', {
          name: createError.name,
          message: createError.message,
          sql: createError.sql,
          original: createError.original,
        });
        throw createError; // Re-throw to be caught by outer catch
      }

      // Log creation activity (fully non-blocking, won't affect response)
      if (logger && typeof logger.logAction === 'function') {
        logger.logAction(req.user?.id, 'create', 'episode', episode.id, {
          newValues: episode.toJSON(),
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        }).catch((logError) => {
          console.warn('⚠️ Failed to log activity:', logError.message);
        });
      }

      // ✅ SAFE: Phase 3A Integration with proper checks
      const userId = req.user?.id || 'anonymous';
      const userEmail = req.user?.email || 'anonymous';

      // Phase 3A Integration: Activity Logging (non-blocking, safe)
      try {
        const ActivityServiceModule = require('../services/ActivityService');
        if (ActivityServiceModule && typeof ActivityServiceModule.logActivity === 'function') {
          ActivityServiceModule.logActivity({
            userId,
            action: 'CREATE',
            resourceType: 'episode',
            resourceId: episode.id,
            metadata: {
              title: finalTitle,
              categories: categories,
              status: finalStatus,
            },
          }).catch((err) => console.error('Activity logging error:', err));
        }
      } catch (err) {
        // Service not available, skip silently
      }

      // Phase 3A Integration: Broadcast WebSocket Event (non-blocking, safe)
      try {
        const SocketServiceModule = require('../services/SocketService');
        if (SocketServiceModule && typeof SocketServiceModule.broadcastMessage === 'function') {
          SocketServiceModule.broadcastMessage({
            event: 'episode_created',
            data: {
              episode: {
                id: episode.id,
                title: finalTitle,
                episode_number: parseInt(finalEpisodeNumber),
                status: finalStatus,
                categories: categories,
              },
              createdBy: userEmail,
              timestamp: new Date(),
            },
          }).catch((err) => console.error('WebSocket broadcast error:', err));
        }
      } catch (err) {
        // Service not available, skip silently
      }

      // Phase 3A Integration: Send Notification (non-blocking, safe)
      try {
        const NotificationServiceModule = require('../services/NotificationService');
        if (NotificationServiceModule && typeof NotificationServiceModule.create === 'function') {
          NotificationServiceModule.create({
            userId,
            type: 'info',
            message: `Episode "${finalTitle}" created successfully`,
            data: {
              resourceType: 'episode',
              resourceId: episode.id,
            },
          }).catch((err) => console.error('Notification error:', err));
        }
      } catch (err) {
        // Service not available, skip silently
      }

      // Log audit event (non-blocking, safe)
      try {
        const AuditLoggerModule = require('../services/AuditLogger');
        if (AuditLoggerModule && typeof AuditLoggerModule.log === 'function') {
          AuditLoggerModule.log({
            userId,
            action: 'CREATE',
            resource: 'Episode',
            resourceId: episode.id,
            resourceName: finalTitle,
            username: userEmail,
          }).catch((err) => console.error('Audit log error:', err));
        }
      } catch (err) {
        // Service not available, skip silently
      }

      res.status(201).json({
        data: episode,
        message: 'Episode created successfully',
      });
    } catch (error) {
      console.error('❌ Error in createEpisode:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        sql: error.sql,
      });
      
      // Handle Sequelize validation errors
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          error: 'Validation failed',
          message: error.message,
          fields: error.errors.map(err => ({
            field: err.path,
            message: err.message,
          })),
        });
      }
      
      // Handle foreign key constraint errors
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
          error: 'Invalid reference',
          message: 'The show_id you provided does not exist. Please create a show first or leave show_id empty.',
          details: error.message,
        });
      }
      
      // Handle unique constraint errors
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          error: 'Duplicate entry',
          message: 'An episode with this information already exists',
          fields: error.errors.map(err => err.path),
        });
      }
      
      res.status(500).json({
        error: 'Failed to create episode',
        message: error.message,
        type: error.name,
      });
    }
  },

  /**
   * PUT /episodes/:id - Update episode
   */
  async updateEpisode(req, res, _next) {
    const { id } = req.params;
    const updates = req.body;

    const episode = await Episode.findByPk(id);
    if (!episode) {
      throw new NotFoundError('Episode', id);
    }

    const oldValues = episode.toJSON();

    // Whitelist updatable fields
    const allowedFields = {
      title: true,
      episode_number: true,
      description: true,
      air_date: true,
      status: true,
      categories: true,
    };

    const updateData = {};

    // Process each field in the updates
    Object.keys(updates).forEach((field) => {
      if (allowedFields[field]) {
        // Handle type conversions
        if (field === 'episode_number') {
          updateData.episode_number = parseInt(updates[field]);
        } else if (field === 'air_date') {
          updateData.air_date = updates[field] ? new Date(updates[field]) : null;
        } else {
          updateData[field] = updates[field];
        }
      }
    });

    await episode.update(updateData);

    // Log activity (existing logger) - wrapped in try-catch to prevent failures
    try {
      await logger.logAction(req.user?.id, 'edit', 'episode', id, {
        oldValues,
        newValues: episode.toJSON(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    } catch (logError) {
      console.warn('⚠️ Failed to log activity:', logError.message);
    }

    // Phase 3A Integration: Activity Logging (non-blocking)
    ActivityService.logActivity({
      userId: req.user?.id,
      action: 'UPDATE',
      resourceType: 'episode',
      resourceId: id,
      metadata: {
        title: episode.title,
        changedFields: Object.keys(updateData),
        changes: updateData,
      },
    }).catch((err) => console.error('Activity logging error:', err));

    // Phase 3A Integration: Broadcast WebSocket Event (non-blocking)
    SocketService.broadcastMessage({
      event: 'episode_updated',
      data: {
        episode: {
          id: episode.id,
          title: episode.title,
          status: episode.status,
          categories: episode.categories,
        },
        changedFields: Object.keys(updateData),
        updatedBy: req.user?.email || 'unknown',
        timestamp: new Date(),
      },
    }).catch((err) => console.error('WebSocket broadcast error:', err));

    // Log audit event (non-blocking)
    AuditLogger.log({
      userId: req.user?.id || 'unknown',
      action: 'UPDATE',
      resource: 'Episode',
      resourceId: id,
      resourceName: episode.title,
      username: req.user?.email || 'unknown',
    }).catch((err) => console.error('Audit log error:', err));

    res.json({
      data: episode,
      message: 'Episode updated successfully',
    });
  },

  /**
   * DELETE /episodes/:id - Delete episode
   */
  async deleteEpisode(req, res, _next) {
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

    // Log activity - wrapped in try-catch to prevent failures
    try {
      await logger.logAction(req.user?.id, 'delete', 'episode', id, {
        oldValues,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    } catch (logError) {
      console.warn('⚠️ Failed to log activity:', logError.message);
    }

    // Phase 3A Integration: Activity Logging (non-blocking)
    ActivityService.logActivity({
      userId: req.user?.id,
      action: 'DELETE',
      resourceType: 'episode',
      resourceId: id,
      metadata: {
        title: oldValues.title,
        deleteType: hard === 'true' ? 'permanent' : 'soft',
      },
    }).catch((err) => console.error('Activity logging error:', err));

    // Phase 3A Integration: Broadcast WebSocket Event (non-blocking)
    SocketService.broadcastMessage({
      event: 'episode_deleted',
      data: {
        episodeId: id,
        title: oldValues.title,
        deleteType: hard === 'true' ? 'permanent' : 'soft',
        deletedBy: req.user?.email || 'unknown',
        timestamp: new Date(),
      },
    }).catch((err) => console.error('WebSocket broadcast error:', err));

    // Phase 3A Integration: Send Notification (non-blocking)
    NotificationService.create({
      userId: req.user?.id,
      type: 'info',
      message: `Episode "${oldValues.title}" has been deleted`,
      data: {
        resourceType: 'episode',
        resourceId: id,
        deleteType: hard === 'true' ? 'permanent' : 'soft',
      },
    }).catch((err) => console.error('Notification error:', err));

    // Log audit event (non-blocking)
    AuditLogger.log({
      userId: req.user?.id || 'unknown',
      action: 'DELETE',
      resource: 'Episode',
      resourceId: id,
      resourceName: oldValues.title,
      username: req.user?.email || 'unknown',
    }).catch((err) => console.error('Audit log error:', err));

    res.json({
      message: `Episode ${id} deleted successfully`,
      type: hard === 'true' ? 'permanent' : 'soft',
    });
  },

  /**
   * GET /episodes/:id/status - Get episode processing status
   */
  async getEpisodeStatus(req, res, _next) {
    const { id } = req.params;

    const episode = await Episode.findByPk(id, {
      attributes: ['id', 'title', 'status', 'created_at'],
    });

    if (!episode) {
      throw new NotFoundError('Episode', id);
    }

    res.json({ data: episode });
  },

  /**
   * POST /episodes/:id/enqueue - Enqueue episode for processing
   */
  async enqueueEpisode(req, res, _next) {
    const { id } = req.params;
    const { jobTypes = ['thumbnail_generation', 'metadata_extraction'] } = req.body;

    const episode = await Episode.findByPk(id);
    if (!episode) {
      throw new NotFoundError('Episode', id);
    }

    const jobs = await Promise.all(
      jobTypes.map((jobType) =>
        ProcessingQueue.create({
          episodeId: id,
          jobType,
          status: 'pending',
          jobConfig: req.body.jobConfig || {},
        })
      )
    );

    // Update episode status
    await episode.update({ status: 'processing' });

    // Log activity - wrapped in try-catch to prevent failures
    try {
      await logger.logAction(req.user?.id, 'create', 'processing', id, {
        newValues: { jobTypes, count: jobs.length },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    } catch (logError) {
      console.warn('⚠️ Failed to log activity:', logError.message);
    }

    res.json({
      data: jobs,
      message: `${jobs.length} job(s) enqueued for episode ${id}`,
    });
  },

  /**
   * GET /episodes/:id/assets - Get all assets for an episode
   */
  async getEpisodeAssets(req, res, _next) {
    try {
      const { id } = req.params;

      const episode = await Episode.findByPk(id, {
        include: [
          {
            model: Asset,
            as: 'assets',
            through: {
              attributes: ['usage_type', 'scene_number', 'display_order', 'metadata', 'created_at'],
            },
            attributes: [
              'id',
              'name',
              'asset_type',
              'asset_group',
              'purpose',
              'allowed_uses',
              'is_global',
              'approval_status',
              's3_url_raw',
              's3_url_processed',
              'media_type',
              'width',
              'height',
              'file_size_bytes',
              'metadata',
              'created_at',
            ],
          },
        ],
      });

      if (!episode) {
        return res.status(404).json({
          error: 'Episode not found',
          id,
        });
      }

      // Filter out soft-deleted assets
      const activeAssets = (episode.assets || []).filter((asset) => !asset.deleted_at);

      res.json({
        data: activeAssets,
        count: activeAssets.length,
      });
    } catch (error) {
      console.error('❌ Error getting episode assets:', error);
      res.status(500).json({
        error: 'Failed to get episode assets',
        message: error.message,
      });
    }
  },

  /**
   * POST /episodes/:id/assets - Add asset(s) to episode
   */
  async addEpisodeAsset(req, res, _next) {
    try {
      const { id } = req.params;
      const {
        assetId,
        assetIds,
        usageType = 'general',
        sceneNumber,
        displayOrder = 0,
        metadata = {},
      } = req.body;

      // Validate episode exists
      const episode = await Episode.findByPk(id);
      if (!episode) {
        return res.status(404).json({
          error: 'Episode not found',
          id,
        });
      }

      // Support both single asset and multiple assets
      const idsToAdd = assetIds || (assetId ? [assetId] : []);

      if (idsToAdd.length === 0) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'assetId or assetIds required',
        });
      }

      // Validate all assets exist
      const assets = await Asset.findAll({
        where: {
          id: idsToAdd,
        },
      });

      if (assets.length !== idsToAdd.length) {
        return res.status(404).json({
          error: 'One or more assets not found',
          requested: idsToAdd.length,
          found: assets.length,
        });
      }

      // Create episode asset links
      const episodeAssets = await Promise.all(
        idsToAdd.map((aid, index) =>
          EpisodeAsset.findOrCreate({
            where: {
              episode_id: id,
              asset_id: aid,
              usage_type: usageType,
            },
            defaults: {
              scene_number: sceneNumber,
              display_order: displayOrder + index,
              metadata,
            },
          })
        )
      );

      const created = episodeAssets.filter(([_, wasCreated]) => wasCreated).length;

      res.json({
        message: `Added ${created} asset(s) to episode`,
        data: episodeAssets.map(([ea]) => ea),
        created,
        skipped: idsToAdd.length - created,
      });
    } catch (error) {
      console.error('❌ Error adding episode asset:', error);
      res.status(500).json({
        error: 'Failed to add asset to episode',
        message: error.message,
      });
    }
  },

  /**
   * DELETE /episodes/:id/assets/:assetId - Remove asset from episode
   */
  async removeEpisodeAsset(req, res, _next) {
    try {
      const { id, assetId } = req.params;
      const { usageType } = req.query;

      const where = {
        episode_id: id,
        asset_id: assetId,
      };

      if (usageType) {
        where.usage_type = usageType;
      }

      const deleted = await EpisodeAsset.destroy({ where });

      if (deleted === 0) {
        return res.status(404).json({
          error: 'Episode asset link not found',
          episode_id: id,
          asset_id: assetId,
        });
      }

      res.json({
        message: `Removed asset from episode`,
        deleted,
      });
    } catch (error) {
      console.error('❌ Error removing episode asset:', error);
      res.status(500).json({
        error: 'Failed to remove asset from episode',
        message: error.message,
      });
    }
  },

  /**
   * PATCH /episodes/:id/assets/:assetId - Update asset usage in episode
   */
  async updateEpisodeAsset(req, res, _next) {
    try {
      const { id, assetId } = req.params;
      const { usageType, sceneNumber, displayOrder, metadata } = req.body;

      const episodeAsset = await EpisodeAsset.findOne({
        where: {
          episode_id: id,
          asset_id: assetId,
        },
      });

      if (!episodeAsset) {
        return res.status(404).json({
          error: 'Episode asset link not found',
          episode_id: id,
          asset_id: assetId,
        });
      }

      const updates = {};
      if (usageType !== undefined) updates.usage_type = usageType;
      if (sceneNumber !== undefined) updates.scene_number = sceneNumber;
      if (displayOrder !== undefined) updates.display_order = displayOrder;
      if (metadata !== undefined) updates.metadata = metadata;

      await episodeAsset.update(updates);

      res.json({
        message: 'Episode asset updated',
        data: episodeAsset,
      });
    } catch (error) {
      console.error('❌ Error updating episode asset:', error);
      res.status(500).json({
        error: 'Failed to update episode asset',
        message: error.message,
      });
    }
  },
};

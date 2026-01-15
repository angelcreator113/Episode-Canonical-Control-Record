/* eslint-disable no-unused-vars */
const { models } = require('../models');
const { Episode, MetadataStorage, Thumbnail, ProcessingQueue, ActivityLog } = models;
const {
  NotFoundError,
  ValidationError,
  asyncHandler,
} = require('../middleware/errorHandler');
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
        attributes: ['id', 'episode_number', 'title', 'description', 'air_date', 'status', 'categories', 'created_at', 'updated_at'],
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
      console.error('❌ Error in listEpisodes:', error);
      res.status(500).json({
        error: 'Failed to list episodes',
        message: error.message
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
        attributes: ['id', 'episode_number', 'title', 'description', 'air_date', 'status', 'categories', 'created_at', 'updated_at'],
      });

      if (!episode) {
        return res.status(404).json({
          error: 'Episode not found',
          id
        });
      }

      res.json({ 
        data: episode
      });
    } catch (error) {
      console.error('❌ Error in getEpisode:', error);
      res.status(500).json({
        error: 'Failed to get episode',
        message: error.message
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
          }
        });
      }

      const episode = await Episode.create({
        title: finalTitle,
        episode_number: parseInt(finalEpisodeNumber),
        description: finalDescription,
        air_date: finalAirDate ? new Date(finalAirDate) : null,
        status: finalStatus,
        categories: Array.isArray(categories) ? categories : [],
        // Keep old fields for backward compatibility
        showName,
        seasonNumber: seasonNumber ? parseInt(seasonNumber) : null,
        episodeTitle: episodeTitle || finalTitle,
        airDate: finalAirDate ? new Date(finalAirDate) : null,
        plotSummary: finalDescription,
        director,
        writer,
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
        rating: rating ? parseFloat(rating) : null,
        genre,
        processingStatus: 'pending',
      });

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
      res.status(500).json({
        error: 'Failed to create episode',
        message: error.message
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

    // Whitelist updatable fields (support both new and old field names)
    const allowedFields = {
      // New field names
      'title': true,
      'episode_number': true,
      'description': true,
      'air_date': true,
      'status': true,
      'categories': true,
      // Old field names
      'episodeTitle': true,
      'episodeNumber': true,
      'airDate': true,
      'plotSummary': true,
      'director': true,
      'writer': true,
      'durationMinutes': true,
      'rating': true,
      'genre': true,
      'thumbnailUrl': true,
      'posterUrl': true,
      'videoUrl': true,
      'rawVideoS3Key': true,
      'processedVideoS3Key': true,
      'metadataJsonS3Key': true,
      'processingStatus': true,
    };

    const updateData = {};
    
    // Process each field in the updates
    Object.keys(updates).forEach(field => {
      if (allowedFields[field]) {
        // Map new field names to their Sequelize equivalents
        if (field === 'title' || field === 'episodeTitle') {
          updateData.title = updates[field];
        } else if (field === 'episode_number' || field === 'episodeNumber') {
          updateData.episode_number = parseInt(updates[field]);
        } else if (field === 'description' || field === 'plotSummary') {
          updateData.description = updates[field];
        } else if (field === 'air_date' || field === 'airDate') {
          updateData.air_date = updates[field] ? new Date(updates[field]) : null;
        } else if (field === 'status') {
          updateData.status = updates[field];
        } else {
          // For other fields, just pass through
          updateData[field] = updates[field];
        }
      }
    });

    await episode.update(updateData);

    // Log activity (existing logger)
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
  async enqueueEpisode(req, res, _next) {
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

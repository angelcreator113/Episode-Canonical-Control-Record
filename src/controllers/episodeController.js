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
      const { page = 1, limit = 20, status, sort, show_id } = req.query;
      const offset = (page - 1) * limit;

      const where = {
        // ✅ FIX: Only show episodes that haven't been soft-deleted
        deleted_at: null,
      };

      // Filter by show
      if (show_id) {
        where.show_id = show_id;
      }

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
      console.log('📥 Received episode creation request');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      console.log('Request headers:', req.headers['content-type']);

      const {
        // New field names (from frontend form)
        title,
        episode_number,
        description,
        air_date,
        status,
        categories,
        // Distribution & Platforms
        platforms,
        platforms_other,
        content_strategy,
        platform_descriptions,
        // Content Intent
        content_types,
        primary_audience,
        tones,
        // Structure
        structure,
        // Visual Requirements
        visual_requirements,
        // Ownership
        owner_creator,
        needs_approval,
        collaborators,
        // Old field names (for backward compatibility)
        showName,
        episodeNumber,
        episodeTitle,
        airDate,
        plotSummary,
      } = req.body;

      // Use new field names if provided, otherwise fall back to old ones
      const finalTitle = title || episodeTitle || showName;
      const finalEpisodeNumber = episode_number || episodeNumber;
      const finalDescription = description || plotSummary;
      const finalAirDate = air_date || airDate;
      const finalStatus = status || 'draft';

      console.log('📊 Parsed fields:', {
        finalTitle,
        finalEpisodeNumber,
        finalDescription,
        finalAirDate,
        finalStatus,
      });

      // Validate required fields (only title is required)
      if (!finalTitle) {
        console.log('❌ Validation failed: title is required');
        return res.status(400).json({
          error: 'Missing required fields',
          fields: {
            title: 'required',
          },
        });
      }

      // Get show_id from request, let database foreign key constraint validate it
      const validatedShowId = req.body.show_id || null;

      // Prepare episode data
      const episodeData = {
        title: finalTitle,
        episode_number: finalEpisodeNumber ? parseInt(finalEpisodeNumber) : null,
        description: finalDescription || null,
        air_date: finalAirDate ? new Date(finalAirDate) : null,
        status: finalStatus,
        categories: Array.isArray(categories) ? categories : [],
        show_id: validatedShowId,
        // Distribution & Platforms
        platforms: platforms || {},
        platforms_other: platforms_other || null,
        content_strategy: content_strategy || 'same-everywhere',
        platform_descriptions: platform_descriptions || {},
        // Content Intent
        content_types: content_types || {},
        primary_audience: primary_audience || null,
        tones: tones || {},
        // Structure
        structure: structure || {},
        // Visual Requirements
        visual_requirements: visual_requirements || {},
        // Ownership
        owner_creator: owner_creator || null,
        needs_approval: needs_approval || false,
        collaborators: collaborators || null,
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
        logger
          .logAction(req.user?.id, 'create', 'episode', episode.id, {
            newValues: episode.toJSON(),
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          })
          .catch((logError) => {
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
          fields: error.errors.map((err) => ({
            field: err.path,
            message: err.message,
          })),
        });
      }

      // Handle foreign key constraint errors
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
          error: 'Invalid reference',
          message:
            'The show_id you provided does not exist. Please create a show first or leave show_id empty.',
          details: error.message,
        });
      }

      // Handle unique constraint errors
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          error: 'Duplicate entry',
          message: 'An episode with this information already exists',
          fields: error.errors.map((err) => err.path),
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
      const db = require('../models');

      // Use raw SQL query with UNION to get assets from both linking methods
      // Method 1: episode_assets join table (new, proper many-to-many)
      // Method 2: assets.episode_id direct link (legacy)
      const assets = await db.sequelize.query(
        `SELECT DISTINCT
          a.id,
          a.name,
          a.asset_type,
          a.asset_role,
          a.asset_group,
          a.asset_scope,
          a.show_id,
          a.episode_id,
          a.purpose,
          a.allowed_uses,
          a.is_global,
          a.approval_status,
          a.s3_url_raw,
          a.s3_url_processed,
          a.media_type,
          a.width,
          a.height,
          a.file_size_bytes,
          a.metadata,
          a.created_at,
          ea.usage_type,
          COALESCE(ea.display_order, 0) as display_order,
          COALESCE(ea.created_at, a.created_at) as linked_at
        FROM assets a
        LEFT JOIN episode_assets ea ON ea.asset_id = a.id AND ea.episode_id = :episodeId AND ea.deleted_at IS NULL
        WHERE (a.episode_id = :episodeId OR ea.episode_id = :episodeId)
        AND a.deleted_at IS NULL
        AND (a.episode_id IS NOT NULL OR ea.id IS NOT NULL)
        ORDER BY display_order ASC, linked_at DESC`,
        {
          replacements: { episodeId: id },
          type: db.sequelize.QueryTypes.SELECT,
        }
      );

      res.json({
        data: assets,
        count: assets.length,
      });
    } catch (error) {
      console.error('❌ Error getting episode assets:', error);
      console.error('Error details:', error.name, error.message);
      res.status(500).json({
        error: 'Failed to get episode assets',
        message: error.message,
        errorName: error.name,
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

      console.log('🗑️ DELETE Episode Asset Request:');
      console.log('  Episode ID:', id);
      console.log('  Asset ID:', assetId);

      // Strategy: Remove from both possible locations
      // 1. episode_assets join table (many-to-many)
      // 2. assets.episode_id direct link (legacy)

      let deletedCount = 0;
      let deletionMethods = [];

      // Method 1: Remove from episode_assets join table
      const where = {
        episode_id: id,
        asset_id: assetId,
      };

      if (usageType) {
        where.usage_type = usageType;
      }

      const joinTableDeleted = await EpisodeAsset.destroy({ where });
      if (joinTableDeleted > 0) {
        deletedCount += joinTableDeleted;
        deletionMethods.push('episode_assets join table');
        console.log(`  ✅ Removed from episode_assets join table (${joinTableDeleted} record(s))`);
      }

      // Method 2: Clear episode_id from asset if it matches this episode
      const asset = await Asset.findByPk(assetId);
      if (asset && asset.episode_id === id) {
        await asset.update({ episode_id: null });
        deletedCount++;
        deletionMethods.push('asset.episode_id cleared');
        console.log('  ✅ Cleared episode_id from asset');
      }

      // If asset wasn't linked in any way, treat as success (idempotent delete)
      if (deletedCount === 0) {
        console.log('  ℹ️  Asset was not linked to episode (already removed or never linked)');
        return res.json({
          message: `Asset already removed or not linked to episode`,
          deleted: 0,
          methods: ['none - already removed'],
        });
      }

      console.log(`  ✅ Total removals: ${deletedCount} (${deletionMethods.join(', ')})`);

      res.json({
        message: `Removed asset from episode`,
        deleted: deletedCount,
        methods: deletionMethods,
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

  /**
   * GET /episodes/:id/scenes - List episode scenes
   */
  async listEpisodeScenes(req, res) {
    try {
      console.log('[listEpisodeScenes] Starting...', { episodeId: req.params.id });
      const { id } = req.params;
      const { SceneLibrary, EpisodeScene } = models;
      const S3Service = require('../services/S3Service');
      const BUCKET_NAME =
        process.env.AWS_S3_BUCKET || process.env.S3_ASSET_BUCKET || 'primepisodes-assets';

      // Verify episode exists
      console.log('[listEpisodeScenes] Checking episode exists...');
      const episode = await Episode.findByPk(id);
      if (!episode) {
        console.log('[listEpisodeScenes] Episode not found:', id);
        return res.status(404).json({ error: 'Episode not found' });
      }
      console.log('[listEpisodeScenes] Episode found:', episode.title);

      // Get all scenes for this episode with library data
      console.log('[listEpisodeScenes] Fetching episode scenes...');
      const episodeScenes = await EpisodeScene.findAll({
        where: { episode_id: id },
        include: [
          {
            model: SceneLibrary,
            as: 'libraryScene',
            required: false, // Allow notes without library scenes
            attributes: [
              'id',
              'title',
              'description',
              'video_asset_url',
              'thumbnail_url',
              'duration_seconds',
              'resolution',
              'characters',
              'tags',
              'processing_status',
            ],
          },
        ],
        order: [['scene_order', 'ASC']],
      });
      console.log(`[listEpisodeScenes] Found ${episodeScenes.length} scenes`);

      // Skip stats and S3 signing for now - just return the data
      res.json({
        episode_id: id,
        total: episodeScenes.length,
        data: episodeScenes,
        stats: {
          totalClips: episodeScenes.length,
          readyClips: 0,
          processingClips: 0,
          readyDuration: 0,
          processingDuration: 0,
          totalDuration: 0,
        },
      });
    } catch (error) {
      console.error('❌ Error listing episode scenes:', error);
      res.status(500).json({
        error: 'Failed to list episode scenes',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  },

  /**
   * PUT /episodes/:id/sequence-items/reorder - Batch reorder sequence items
   */
  async reorderSequenceItems(req, res) {
    try {
      const { id } = req.params;
      const { itemIds } = req.body;
      const { EpisodeScene } = models;

      // Validate input
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ error: 'itemIds must be a non-empty array' });
      }

      // Verify episode exists
      const episode = await Episode.findByPk(id);
      if (!episode) {
        return res.status(404).json({ error: 'Episode not found' });
      }

      // Verify all items belong to this episode
      const items = await EpisodeScene.findAll({
        where: {
          id: itemIds,
          episode_id: id,
        },
      });

      if (items.length !== itemIds.length) {
        return res.status(400).json({ error: 'Some items do not belong to this episode' });
      }

      // Use transaction for atomic update
      const sequelize = require('../models').sequelize;
      await sequelize.transaction(async (t) => {
        // Update scene_order for each item
        for (let i = 0; i < itemIds.length; i++) {
          await EpisodeScene.update(
            {
              scene_order: i + 1,
              last_edited_at: new Date(),
            },
            {
              where: { id: itemIds[i] },
              transaction: t,
            }
          );
        }
      });

      // Fetch updated data with stats
      const S3Service = require('../services/S3Service');
      const BUCKET_NAME =
        process.env.AWS_S3_BUCKET || process.env.S3_ASSET_BUCKET || 'primepisodes-assets';

      const updatedScenes = await EpisodeScene.findAll({
        where: { episode_id: id },
        include: [
          {
            model: models.SceneLibrary,
            as: 'libraryScene',
            required: false,
          },
        ],
        order: [['scene_order', 'ASC']],
      });

      // Generate signed URLs and calculate stats
      let readyDuration = 0;
      let processingDuration = 0;
      let readyCount = 0;
      let processingCount = 0;

      for (const scene of updatedScenes) {
        const effectiveDuration = scene.effectiveDuration || 0;
        const clipStatus = scene.clipStatus;

        if (clipStatus === 'ready') {
          readyDuration += effectiveDuration;
          readyCount++;
        } else if (clipStatus === 'processing' || clipStatus === 'uploading') {
          processingDuration += effectiveDuration;
          processingCount++;
        }

        if (scene.libraryScene) {
          const libScene = scene.libraryScene;
          if (libScene.thumbnail_url?.startsWith('shows/')) {
            try {
              libScene.thumbnail_url = await S3Service.getPreSignedUrl(
                BUCKET_NAME,
                libScene.thumbnail_url,
                604800
              );
            } catch (err) {
              console.error('Failed to sign thumbnail URL:', err);
            }
          }
          if (libScene.video_asset_url?.startsWith('shows/')) {
            try {
              libScene.video_asset_url = await S3Service.getPreSignedUrl(
                BUCKET_NAME,
                libScene.video_asset_url,
                604800
              );
            } catch (err) {
              console.error('Failed to sign video URL:', err);
            }
          }
        }
      }

      res.json({
        success: true,
        message: 'Sequence items reordered successfully',
        data: updatedScenes,
        stats: {
          totalClips: updatedScenes.length,
          readyClips: readyCount,
          processingClips: processingCount,
          readyDuration: Math.round(readyDuration),
          processingDuration: Math.round(processingDuration),
          totalDuration: Math.round(readyDuration + processingDuration),
        },
      });
    } catch (error) {
      console.error('❌ Error reordering sequence items:', error);
      res.status(500).json({
        error: 'Failed to reorder sequence items',
        message: error.message,
      });
    }
  },

  /**
   * POST /episodes/:id/sequence-items/note - Add a note to the sequence
   */
  async addNoteToEpisode(req, res) {
    try {
      const { id } = req.params;
      const { title, noteText, manualDurationSeconds, position } = req.body;
      const { EpisodeScene } = models;

      // Validate input
      if (!noteText || noteText.trim().length === 0) {
        return res.status(400).json({ error: 'noteText is required' });
      }

      // Verify episode exists
      const episode = await Episode.findByPk(id);
      if (!episode) {
        return res.status(404).json({ error: 'Episode not found' });
      }

      // Get current max scene_order
      const maxOrderScene = await EpisodeScene.findOne({
        where: { episode_id: id },
        order: [['scene_order', 'DESC']],
      });

      const nextOrder = maxOrderScene ? maxOrderScene.scene_order + 1 : 1;
      const noteOrder = position !== undefined ? position : nextOrder;

      // Create note
      const note = await EpisodeScene.create({
        episode_id: id,
        type: 'note',
        scene_library_id: null,
        scene_order: noteOrder,
        title_override: title || null,
        note_text: noteText,
        manual_duration_seconds: manualDurationSeconds || 0,
        added_by: req.user?.id || req.user?.username || 'system',
        last_edited_at: new Date(),
      });

      res.status(201).json({
        success: true,
        message: 'Note added successfully',
        data: note,
      });
    } catch (error) {
      console.error('❌ Error adding note to episode:', error);
      res.status(500).json({
        error: 'Failed to add note',
        message: error.message,
      });
    }
  },

  /**
   * POST /episodes/:id/scenes - Add scene to episode
   */
  async addSceneToEpisode(req, res) {
    try {
      const { id } = req.params;
      const { sceneLibraryId, sceneOrder, trimStart, trimEnd, sceneType, episodeNotes } = req.body;
      const { SceneLibrary, EpisodeScene } = models;

      if (!sceneLibraryId) {
        return res.status(400).json({ error: 'sceneLibraryId is required' });
      }

      // Verify episode exists
      const episode = await Episode.findByPk(id);
      if (!episode) {
        return res.status(404).json({ error: 'Episode not found' });
      }

      // Verify library scene exists
      const libraryScene = await SceneLibrary.findByPk(sceneLibraryId);
      if (!libraryScene) {
        return res.status(404).json({ error: 'Scene not found in library' });
      }

      // Auto-calculate scene order if not provided
      let order = sceneOrder;
      if (!order) {
        const maxOrder = await EpisodeScene.max('scene_order', {
          where: { episode_id: id },
        });
        order = (maxOrder || 0) + 1;
      }

      // Create episode scene link
      const episodeScene = await EpisodeScene.create({
        episode_id: id,
        scene_library_id: sceneLibraryId,
        scene_order: order,
        trim_start: trimStart !== undefined ? trimStart : 0,
        trim_end: trimEnd !== undefined ? trimEnd : parseFloat(libraryScene.duration_seconds || 0),
        scene_type: sceneType || 'standard',
        episode_notes: episodeNotes,
        type: 'clip', // New field for clip sequence manager
      });

      // Return with library scene data
      const result = await EpisodeScene.findByPk(episodeScene.id, {
        include: [
          {
            model: SceneLibrary,
            as: 'libraryScene',
          },
        ],
      });

      res.status(201).json({
        message: 'Scene added to episode',
        data: result,
      });
    } catch (error) {
      console.error('❌ Error adding scene to episode:', error);
      res.status(500).json({
        error: 'Failed to add scene to episode',
        message: error.message,
      });
    }
  },

  /**
   * PUT /episodes/:id/scenes/:sceneId - Update episode scene
   */
  async updateEpisodeScene(req, res) {
    try {
      const { id, sceneId } = req.params;
      const { sceneOrder, trimStart, trimEnd, sceneType, episodeNotes, productionStatus } =
        req.body;
      const { EpisodeScene, SceneLibrary } = models;

      // Find episode scene
      const episodeScene = await EpisodeScene.findOne({
        where: {
          id: sceneId,
          episode_id: id,
        },
      });

      if (!episodeScene) {
        return res.status(404).json({ error: 'Episode scene not found' });
      }

      // Build updates
      const updates = {};
      if (sceneOrder !== undefined) updates.scene_order = sceneOrder;
      if (trimStart !== undefined) updates.trim_start = trimStart;
      if (trimEnd !== undefined) updates.trim_end = trimEnd;
      if (sceneType !== undefined) updates.scene_type = sceneType;
      if (episodeNotes !== undefined) updates.episode_notes = episodeNotes;
      if (productionStatus !== undefined) updates.production_status = productionStatus;

      await episodeScene.update(updates);

      // Return with library scene data
      const result = await EpisodeScene.findByPk(sceneId, {
        include: [
          {
            model: SceneLibrary,
            as: 'libraryScene',
          },
        ],
      });

      res.json({
        message: 'Episode scene updated',
        data: result,
      });
    } catch (error) {
      console.error('❌ Error updating episode scene:', error);
      res.status(500).json({
        error: 'Failed to update episode scene',
        message: error.message,
      });
    }
  },

  /**
   * DELETE /episodes/:id/scenes/:sceneId - Remove scene from episode
   */
  async removeSceneFromEpisode(req, res) {
    try {
      const { id, sceneId } = req.params;
      const { EpisodeScene } = models;

      // Find episode scene
      const episodeScene = await EpisodeScene.findOne({
        where: {
          id: sceneId,
          episode_id: id,
        },
      });

      if (!episodeScene) {
        return res.status(404).json({ error: 'Episode scene not found' });
      }

      // Delete the link (not the library scene)
      await episodeScene.destroy();

      res.json({
        message: 'Scene removed from episode',
        episode_id: id,
        scene_id: sceneId,
      });
    } catch (error) {
      console.error('❌ Error removing episode scene:', error);
      res.status(500).json({
        error: 'Failed to remove episode scene',
        message: error.message,
      });
    }
  },
};

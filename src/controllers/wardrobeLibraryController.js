const { models } = require('../models');
const {
  WardrobeLibrary,
  OutfitSetItems,
  WardrobeUsageHistory,
  WardrobeLibraryReferences,
  Wardrobe,
  EpisodeWardrobe,
  Episode,
  Show,
  Scene,
} = models;
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { Op } = require('sequelize');

/**
 * Wardrobe Library Controller
 * Handles all wardrobe library operations
 */

module.exports = {
  /**
   * POST /api/v1/wardrobe-library - Upload new item to library
   */
  async uploadToLibrary(req, res) {
    try {
      const {
        name,
        description,
        type,
        itemType,
        color,
        tags,
        website,
        price,
        vendor,
        showId,
        defaultCharacter,
        defaultOccasion,
        defaultSeason,
      } = req.body;

      // Validate required fields
      if (!name || !type) {
        throw new ValidationError('Name and type are required');
      }

      if (!['item', 'set'].includes(type)) {
        throw new ValidationError('Type must be either "item" or "set"');
      }

      // For now, we'll use a placeholder image URL until S3 upload is implemented
      const imageUrl = req.body.imageUrl || req.file?.location || 'https://via.placeholder.com/300';
      const thumbnailUrl = req.body.thumbnailUrl || imageUrl;
      const s3Key = req.file?.key || req.body.s3Key || null;

      // Parse tags if string
      let parsedTags = tags;
      if (typeof tags === 'string') {
        try {
          parsedTags = JSON.parse(tags);
        } catch (e) {
          parsedTags = tags.split(',').map((t) => t.trim());
        }
      }

      // Create library item
      const libraryItem = await WardrobeLibrary.create({
        name,
        description,
        type,
        itemType,
        imageUrl,
        thumbnailUrl,
        s3Key,
        defaultCharacter,
        defaultOccasion,
        defaultSeason,
        color,
        tags: parsedTags || [],
        website,
        price,
        vendor,
        showId,
        createdBy: req.user?.id || 'system',
        updatedBy: req.user?.id || 'system',
      });

      // Create S3 reference if s3Key exists
      if (s3Key) {
        await WardrobeLibraryReferences.create({
          libraryItemId: libraryItem.id,
          s3Key,
          referenceCount: 1,
          fileSize: req.file?.size || null,
          contentType: req.file?.mimetype || 'image/jpeg',
        });
      }

      res.status(201).json({
        success: true,
        data: libraryItem,
        message: 'Library item created successfully',
      });
    } catch (error) {
      console.error('Error uploading to library:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * GET /api/v1/wardrobe-library - List library items with filters
   */
  async listLibrary(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        itemType,
        showId,
        character,
        occasion,
        season,
        color,
        search,
        sort = 'created_at:DESC',
      } = req.query;

      const offset = (page - 1) * limit;

      // Build where clause
      const where = {
        deletedAt: null,
      };

      if (type) where.type = type;
      if (itemType) where.itemType = itemType;
      if (showId) where.showId = showId;
      if (character) where.defaultCharacter = character;
      if (occasion) where.defaultOccasion = occasion;
      if (season) where.defaultSeason = season;
      if (color) where.color = { [Op.iLike]: `%${color}%` };

      // Full-text search
      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
        ];
      }

      // Parse sort
      const [sortField, sortDirection] = sort.split(':');
      const order = [[sortField || 'created_at', sortDirection || 'DESC']];

      const { count, rows } = await WardrobeLibrary.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset,
        order,
        include: [
          {
            model: Show,
            as: 'show',
            attributes: ['id', 'name', 'icon', 'color'],
          },
        ],
      });

      res.json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (error) {
      console.error('Error listing library:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * GET /api/v1/wardrobe-library/:id - Get single library item with usage stats
   */
  async getLibraryItem(req, res) {
    try {
      const { id } = req.params;

      const libraryItem = await WardrobeLibrary.findOne({
        where: { id, deletedAt: null },
        include: [
          {
            model: Show,
            as: 'show',
            attributes: ['id', 'name', 'icon', 'color'],
          },
          {
            model: WardrobeUsageHistory,
            as: 'usageHistory',
            limit: 10,
            order: [['created_at', 'DESC']],
            include: [
              {
                model: Episode,
                as: 'episode',
                attributes: ['id', 'title', 'episode_number'],
              },
              {
                model: Show,
                as: 'show',
                attributes: ['id', 'name'],
              },
            ],
          },
          {
            model: OutfitSetItems,
            as: 'outfitItems',
            include: [
              {
                model: WardrobeLibrary,
                as: 'wardrobeItem',
                attributes: ['id', 'name', 'imageUrl', 'thumbnailUrl'],
              },
            ],
          },
        ],
      });

      if (!libraryItem) {
        throw new NotFoundError('Library item not found');
      }

      res.json({
        success: true,
        data: libraryItem,
      });
    } catch (error) {
      console.error('Error getting library item:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * PUT /api/v1/wardrobe-library/:id - Update library item metadata
   */
  async updateLibraryItem(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        itemType,
        color,
        tags,
        website,
        price,
        vendor,
        defaultCharacter,
        defaultOccasion,
        defaultSeason,
      } = req.body;

      const libraryItem = await WardrobeLibrary.findOne({
        where: { id, deletedAt: null },
      });

      if (!libraryItem) {
        throw new NotFoundError('Library item not found');
      }

      // Parse tags if string
      let parsedTags = tags;
      if (typeof tags === 'string') {
        try {
          parsedTags = JSON.parse(tags);
        } catch (e) {
          parsedTags = tags.split(',').map((t) => t.trim());
        }
      }

      // Update fields
      await libraryItem.update({
        name: name || libraryItem.name,
        description: description !== undefined ? description : libraryItem.description,
        itemType: itemType || libraryItem.itemType,
        color: color !== undefined ? color : libraryItem.color,
        tags: parsedTags || libraryItem.tags,
        website: website !== undefined ? website : libraryItem.website,
        price: price !== undefined ? price : libraryItem.price,
        vendor: vendor !== undefined ? vendor : libraryItem.vendor,
        defaultCharacter:
          defaultCharacter !== undefined ? defaultCharacter : libraryItem.defaultCharacter,
        defaultOccasion:
          defaultOccasion !== undefined ? defaultOccasion : libraryItem.defaultOccasion,
        defaultSeason: defaultSeason !== undefined ? defaultSeason : libraryItem.defaultSeason,
        updatedBy: req.user?.id || 'system',
      });

      res.json({
        success: true,
        data: libraryItem,
        message: 'Library item updated successfully',
      });
    } catch (error) {
      console.error('Error updating library item:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/wardrobe-library/:id - Soft delete with usage validation
   */
  async deleteLibraryItem(req, res) {
    try {
      const { id } = req.params;

      const libraryItem = await WardrobeLibrary.findOne({
        where: { id, deletedAt: null },
      });

      if (!libraryItem) {
        throw new NotFoundError('Library item not found');
      }

      // Check if item is in use
      const usageCount = await Wardrobe.count({
        where: { library_item_id: id, deleted_at: null },
      });

      if (usageCount > 0) {
        // Get episodes using this item
        const episodeWardrobe = await EpisodeWardrobe.findAll({
          include: [
            {
              model: Wardrobe,
              as: 'wardrobeItem',
              where: { library_item_id: id },
              required: true,
            },
            {
              model: Episode,
              as: 'episode',
              attributes: ['id', 'title', 'episode_number'],
            },
          ],
          limit: 5,
        });

        const episodes = episodeWardrobe.map((ew) => ew.episode);

        return res.status(409).json({
          success: false,
          error: 'Cannot delete library item: currently in use',
          data: {
            usageCount,
            episodes,
          },
        });
      }

      // Soft delete
      await libraryItem.destroy();

      res.json({
        success: true,
        message: 'Library item deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting library item:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wardrobe-library/:id/assign - Assign library item to episode
   */
  async assignToEpisode(req, res) {
    try {
      const { id } = req.params;
      const { episodeId, sceneId, character, occasion, season } = req.body;

      if (!episodeId) {
        throw new ValidationError('Episode ID is required');
      }

      // Verify library item exists
      const libraryItem = await WardrobeLibrary.findOne({
        where: { id, deletedAt: null },
      });

      if (!libraryItem) {
        throw new NotFoundError('Library item not found');
      }

      // Verify episode exists
      const episode = await Episode.findByPk(episodeId);
      if (!episode) {
        throw new NotFoundError('Episode not found');
      }

      // Create wardrobe entry
      const wardrobeItem = await Wardrobe.create({
        name: libraryItem.name,
        character: character || libraryItem.defaultCharacter,
        clothing_category: libraryItem.itemType || 'other',
        description: libraryItem.description,
        s3_url: libraryItem.imageUrl,
        thumbnail_url: libraryItem.thumbnailUrl,
        color: libraryItem.color,
        season: season || libraryItem.defaultSeason,
        library_item_id: libraryItem.id,
      });

      // Create episode-wardrobe link
      const episodeWardrobe = await EpisodeWardrobe.create({
        episode_id: episodeId,
        wardrobe_id: wardrobeItem.id,
        scene_id: sceneId || null,
        override_character: character !== libraryItem.defaultCharacter ? character : null,
        override_occasion: occasion !== libraryItem.defaultOccasion ? occasion : null,
        override_season: season !== libraryItem.defaultSeason ? season : null,
        approval_status: 'pending',
      });

      // Track usage
      await WardrobeUsageHistory.create({
        libraryItemId: libraryItem.id,
        episodeId,
        sceneId: sceneId || null,
        showId: episode.show_id || null,
        usageType: 'assigned',
        character: character || libraryItem.defaultCharacter,
        occasion: occasion || libraryItem.defaultOccasion,
        userId: req.user?.id || 'system',
      });

      // Update usage count
      await libraryItem.incrementUsage();

      res.status(201).json({
        success: true,
        data: {
          wardrobeItem,
          episodeWardrobe,
        },
        message: 'Library item assigned to episode successfully',
      });
    } catch (error) {
      console.error('Error assigning to episode:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * GET /api/v1/wardrobe-library/:id/usage - Get usage history
   */
  async getUsageHistory(req, res) {
    try {
      const { id } = req.params;
      const { showId, limit = 50 } = req.query;

      const where = { libraryItemId: id };
      if (showId) where.showId = showId;

      const usageHistory = await WardrobeUsageHistory.findAll({
        where,
        limit: parseInt(limit),
        order: [['created_at', 'DESC']],
        include: [
          {
            model: Episode,
            as: 'episode',
            attributes: ['id', 'title', 'episode_number', 'air_date'],
          },
          {
            model: Scene,
            as: 'scene',
            attributes: ['id', 'scene_number', 'title'],
          },
          {
            model: Show,
            as: 'show',
            attributes: ['id', 'name', 'icon'],
          },
        ],
      });

      // Calculate analytics
      const analytics = {
        totalUsage: usageHistory.length,
        byType: {},
        byShow: {},
        byEpisode: {},
        recentActivity: usageHistory.slice(0, 10),
      };

      usageHistory.forEach((h) => {
        // By type
        analytics.byType[h.usageType] = (analytics.byType[h.usageType] || 0) + 1;

        // By show
        if (h.show) {
          const showName = h.show.name;
          analytics.byShow[showName] = (analytics.byShow[showName] || 0) + 1;
        }

        // By episode
        if (h.episode) {
          const episodeTitle = h.episode.title;
          analytics.byEpisode[episodeTitle] = (analytics.byEpisode[episodeTitle] || 0) + 1;
        }
      });

      res.json({
        success: true,
        data: {
          history: usageHistory,
          analytics,
        },
      });
    } catch (error) {
      console.error('Error getting usage history:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wardrobe-library/:id/track-view - Track view event
   */
  async trackView(req, res) {
    try {
      const { id } = req.params;

      const libraryItem = await WardrobeLibrary.findOne({
        where: { id, deletedAt: null },
      });

      if (!libraryItem) {
        throw new NotFoundError('Library item not found');
      }

      // Track view
      await libraryItem.trackView();

      // Record in history
      await WardrobeUsageHistory.create({
        libraryItemId: libraryItem.id,
        usageType: 'viewed',
        userId: req.user?.id || 'system',
      });

      res.json({
        success: true,
        message: 'View tracked',
      });
    } catch (error) {
      console.error('Error tracking view:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wardrobe-library/:id/track-selection - Track selection event
   */
  async trackSelection(req, res) {
    try {
      const { id } = req.params;
      const { episodeId, showId } = req.body;

      const libraryItem = await WardrobeLibrary.findOne({
        where: { id, deletedAt: null },
      });

      if (!libraryItem) {
        throw new NotFoundError('Library item not found');
      }

      // Track selection
      await libraryItem.trackSelection();

      // Record in history
      await WardrobeUsageHistory.create({
        libraryItemId: libraryItem.id,
        episodeId: episodeId || null,
        showId: showId || null,
        usageType: 'selected',
        userId: req.user?.id || 'system',
      });

      res.json({
        success: true,
        message: 'Selection tracked',
      });
    } catch (error) {
      console.error('Error tracking selection:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },
};

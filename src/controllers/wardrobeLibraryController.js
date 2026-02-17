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
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

// S3 configuration
const BUCKET_NAME = process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'episode-assets-dev';

let s3Client = null;
const getS3Client = () => {
  if (!s3Client) {
    const config = {
      region: process.env.AWS_REGION || 'us-east-1',
    };
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }
    s3Client = new S3Client(config);
  }
  return s3Client;
};

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

      console.log('📥 Wardrobe upload request:', { name, type, itemType, hasFile: !!req.file });

      // Validate required fields
      if (!name || !type) {
        throw new ValidationError('Name and type are required');
      }

      if (!['item', 'set'].includes(type)) {
        throw new ValidationError('Type must be either "item" or "set"');
      }

      let imageUrl = req.body.imageUrl || 'https://via.placeholder.com/300';
      let thumbnailUrl = req.body.thumbnailUrl || imageUrl;
      let s3Key = req.body.s3Key || null;

      // Handle file upload to S3
      if (req.file) {
        try {
          const assetId = uuidv4();
          const timestamp = Date.now();
          const extension = req.file.mimetype === 'image/png' ? '.png' : 
                           req.file.mimetype === 'image/webp' ? '.webp' : '.jpg';
          
          s3Key = `wardrobe/${timestamp}-${assetId}${extension}`;
          
          // Upload to S3
          const s3 = getS3Client();
          await s3.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
          }));
          
          imageUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
          console.log(`✅ Uploaded wardrobe image to S3: ${imageUrl}`);
          
          // Generate thumbnail
          try {
            const thumbBuffer = await sharp(req.file.buffer)
              .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 80 })
              .toBuffer();
            
            const thumbKey = `wardrobe/thumbnails/${timestamp}-${assetId}-thumb.jpg`;
            await s3.send(new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: thumbKey,
              Body: thumbBuffer,
              ContentType: 'image/jpeg',
            }));
            
            thumbnailUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${thumbKey}`;
            console.log(`✅ Generated thumbnail: ${thumbnailUrl}`);
          } catch (thumbError) {
            console.warn('⚠️ Thumbnail generation failed:', thumbError.message);
            thumbnailUrl = imageUrl;
          }
        } catch (s3Error) {
          console.error('❌ S3 upload failed:', s3Error.message);
          // Fall back to data URL for development
          const base64 = req.file.buffer.toString('base64');
          imageUrl = `data:${req.file.mimetype};base64,${base64}`;
          thumbnailUrl = imageUrl;
          console.log('⚠️ Using data URL fallback for image');
        }
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

      // Create library item
      const now = new Date();
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
        createdAt: now,
        updatedAt: now,
        showId,
        createdBy: req.user?.id || 'system',
        updatedBy: req.user?.id || 'system',
      });

      // Create S3 reference if s3Key exists (non-critical, wrap in try-catch)
      if (s3Key) {
        try {
          await WardrobeLibraryReferences.create({
            libraryItemId: libraryItem.id,
            s3Key,
            referenceCount: 1,
            fileSize: req.file?.size || null,
            contentType: req.file?.mimetype || 'image/jpeg',
          });
        } catch (refError) {
          console.warn('⚠️ S3 reference tracking failed (non-critical):', refError.message);
          // Don't throw — upload was successful
        }
      }

      console.log(`✅ Created wardrobe library item: ${libraryItem.id}`);

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
   * GET /api/v1/wardrobe-library/stats - Get library statistics
   */
  async getStats(req, res) {
    try {
      // Use raw query to ensure we're querying the actual table
      const { sequelize } = require('../models');

      const [results] = await sequelize.query(`
        SELECT 
          COUNT(*) FILTER (WHERE deleted_at IS NULL) as total,
          COUNT(*) FILTER (WHERE type = 'item' AND deleted_at IS NULL) as items,
          COUNT(*) FILTER (WHERE type = 'set' AND deleted_at IS NULL) as sets,
          COUNT(*) FILTER (WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '30 days') as recent_uploads
        FROM wardrobe_library
      `);

      const stats = results[0] || { total: '0', items: '0', sets: '0', recent_uploads: '0' };

      res.json({
        success: true,
        data: {
          total: parseInt(stats.total),
          items: parseInt(stats.items),
          sets: parseInt(stats.sets),
          recentUploads: parseInt(stats.recent_uploads),
        },
      });
    } catch (error) {
      console.error('❌ Error fetching stats:', error);
      res.status(500).json({
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
            as: 'sceneDetails',
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

  // ========================================================================
  // PHASE 3: OUTFIT SETS
  // ========================================================================

  /**
   * GET /api/v1/wardrobe-library/:id/items - Get all items in an outfit set
   */
  async getOutfitItems(req, res) {
    try {
      const { id } = req.params;

      // Verify outfit set exists and is type='set'
      const outfitSet = await WardrobeLibrary.findOne({
        where: { id, deletedAt: null, type: 'set' },
      });

      if (!outfitSet) {
        throw new NotFoundError('Outfit set not found');
      }

      // Get all items in the outfit set with full item details
      const outfitItems = await OutfitSetItems.findAll({
        where: { outfitSetId: id },
        include: [
          {
            model: WardrobeLibrary,
            as: 'wardrobeItem',
            attributes: [
              'id',
              'name',
              'description',
              'itemType',
              'imageUrl',
              'thumbnailUrl',
              'color',
              'tags',
              'totalUsageCount',
            ],
          },
        ],
        order: [['position', 'ASC']],
      });

      res.json({
        success: true,
        data: outfitItems.map((item) => ({
          id: item.id,
          position: item.position,
          layer: item.layer,
          isOptional: item.isOptional,
          notes: item.notes,
          wardrobeItem: item.wardrobeItem,
        })),
      });
    } catch (error) {
      console.error('Error getting outfit items:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wardrobe-library/:id/items - Add items to outfit set
   */
  async addItemsToOutfit(req, res) {
    try {
      const { id } = req.params;
      const { wardrobeItemIds, positions, layers, isOptional, notes } = req.body;

      // Validate input
      if (!wardrobeItemIds || !Array.isArray(wardrobeItemIds) || wardrobeItemIds.length === 0) {
        throw new ValidationError('wardrobeItemIds array is required');
      }

      // Verify outfit set exists and is type='set'
      const outfitSet = await WardrobeLibrary.findOne({
        where: { id, deletedAt: null, type: 'set' },
      });

      if (!outfitSet) {
        throw new NotFoundError('Outfit set not found');
      }

      // Validate all items exist and are type='item'
      const items = await WardrobeLibrary.findAll({
        where: {
          id: wardrobeItemIds,
          deletedAt: null,
          type: 'item',
        },
      });

      if (items.length !== wardrobeItemIds.length) {
        throw new ValidationError('Some wardrobe items not found or are not of type "item"');
      }

      // Create outfit_set_items records
      const itemsToCreate = wardrobeItemIds.map((itemId, index) => ({
        outfitSetId: id,
        wardrobeItemId: itemId,
        position: positions && positions[index] !== undefined ? positions[index] : index,
        layer: layers && layers[index] ? layers[index] : null,
        isOptional: isOptional && isOptional[index] !== undefined ? isOptional[index] : false,
        notes: notes && notes[index] ? notes[index] : null,
      }));

      let addedCount = 0;
      const errors = [];

      // Insert items, handling duplicates gracefully
      for (const itemData of itemsToCreate) {
        try {
          await OutfitSetItems.create(itemData);
          addedCount++;
        } catch (error) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            errors.push(`Item ${itemData.wardrobeItemId} already in outfit set`);
          } else {
            throw error;
          }
        }
      }

      res.json({
        success: true,
        message: `Added ${addedCount} item(s) to outfit set`,
        addedCount,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error('Error adding items to outfit:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/wardrobe-library/:setId/items/:itemId - Remove item from outfit set
   */
  async removeItemFromOutfit(req, res) {
    try {
      const { setId, itemId } = req.params;

      // Verify outfit set exists
      const outfitSet = await WardrobeLibrary.findOne({
        where: { id: setId, deletedAt: null, type: 'set' },
      });

      if (!outfitSet) {
        throw new NotFoundError('Outfit set not found');
      }

      // Remove the item from outfit_set_items
      const deleted = await OutfitSetItems.destroy({
        where: {
          outfitSetId: setId,
          wardrobeItemId: itemId,
        },
      });

      if (deleted === 0) {
        throw new NotFoundError('Item not found in outfit set');
      }

      res.json({
        success: true,
        message: 'Item removed from outfit set',
      });
    } catch (error) {
      console.error('Error removing item from outfit:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  // ========================================================================
  // PHASE 5: USAGE TRACKING ENHANCED
  // ========================================================================

  /**
   * GET /api/v1/wardrobe-library/:id/usage/shows - Get cross-show usage
   */
  async getCrossShowUsage(req, res) {
    try {
      const { id } = req.params;

      const libraryItem = await WardrobeLibrary.findOne({
        where: { id, deletedAt: null },
      });

      if (!libraryItem) {
        throw new NotFoundError('Library item not found');
      }

      // Query usage history grouped by show_id
      const usageByShow = await WardrobeUsageHistory.findAll({
        where: {
          libraryItemId: id,
          showId: { [Op.ne]: null },
        },
        include: [
          {
            model: Show,
            as: 'show',
            attributes: ['id', 'name'],
          },
        ],
        attributes: [
          'showId',
          [
            models.sequelize.fn('COUNT', models.sequelize.col('WardrobeUsageHistory.id')),
            'usageCount',
          ],
          [
            models.sequelize.fn(
              'COUNT',
              models.sequelize.fn('DISTINCT', models.sequelize.col('episode_id'))
            ),
            'episodeCount',
          ],
        ],
        group: ['showId', 'show.id', 'show.name'],
        raw: false,
      });

      res.json({
        success: true,
        data: usageByShow.map((item) => ({
          showId: item.showId,
          showName: item.show ? item.show.name : 'Unknown',
          episodeCount: parseInt(item.dataValues.episodeCount || 0),
          usageCount: parseInt(item.dataValues.usageCount || 0),
        })),
      });
    } catch (error) {
      console.error('Error getting cross-show usage:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * GET /api/v1/wardrobe-library/:id/usage/timeline - Get usage timeline
   */
  async getUsageTimeline(req, res) {
    try {
      const { id } = req.params;
      const { granularity = 'month' } = req.query;

      const libraryItem = await WardrobeLibrary.findOne({
        where: { id, deletedAt: null },
      });

      if (!libraryItem) {
        throw new NotFoundError('Library item not found');
      }

      // Determine date format based on granularity
      let dateFormat;
      switch (granularity) {
        case 'day':
          dateFormat = 'YYYY-MM-DD';
          break;
        case 'week':
          dateFormat = 'YYYY-"W"WW';
          break;
        case 'month':
        default:
          dateFormat = 'YYYY-MM';
          break;
      }

      // Query usage history grouped by time period
      const timeline = await WardrobeUsageHistory.findAll({
        where: { libraryItemId: id },
        attributes: [
          [
            models.sequelize.fn('TO_CHAR', models.sequelize.col('created_at'), dateFormat),
            'period',
          ],
          [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'usageCount'],
          [
            models.sequelize.fn(
              'json_agg',
              models.sequelize.fn('DISTINCT', models.sequelize.col('usage_type'))
            ),
            'usageTypes',
          ],
        ],
        group: [models.sequelize.fn('TO_CHAR', models.sequelize.col('created_at'), dateFormat)],
        order: [
          [models.sequelize.fn('TO_CHAR', models.sequelize.col('created_at'), dateFormat), 'ASC'],
        ],
        raw: true,
      });

      res.json({
        success: true,
        data: timeline.map((item) => ({
          period: item.period,
          usageCount: parseInt(item.usageCount || 0),
          usageTypes: item.usageTypes || [],
        })),
      });
    } catch (error) {
      console.error('Error getting usage timeline:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * GET /api/v1/wardrobe-library/analytics/most-used - Get most used items
   */
  async getMostUsedItems(req, res) {
    try {
      const { limit = 10, showId } = req.query;

      const whereClause = { deletedAt: null };
      if (showId) {
        whereClause.showId = showId;
      }

      const mostUsed = await WardrobeLibrary.findAll({
        where: whereClause,
        order: [
          ['totalUsageCount', 'DESC'],
          ['lastUsedAt', 'DESC NULLS LAST'],
        ],
        limit: parseInt(limit),
        attributes: [
          'id',
          'name',
          'type',
          'itemType',
          'imageUrl',
          'thumbnailUrl',
          'color',
          'totalUsageCount',
          'lastUsedAt',
          'viewCount',
          'selectionCount',
        ],
      });

      res.json({
        success: true,
        data: mostUsed,
      });
    } catch (error) {
      console.error('Error getting most used items:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * GET /api/v1/wardrobe-library/analytics/never-used - Get never used items
   */
  async getNeverUsedItems(req, res) {
    try {
      const { limit = 10, showId } = req.query;

      const whereClause = {
        deletedAt: null,
        totalUsageCount: 0,
      };
      if (showId) {
        whereClause.showId = showId;
      }

      const neverUsed = await WardrobeLibrary.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        attributes: [
          'id',
          'name',
          'type',
          'itemType',
          'imageUrl',
          'thumbnailUrl',
          'color',
          'tags',
          'createdAt',
          'createdBy',
        ],
      });

      res.json({
        success: true,
        data: neverUsed,
      });
    } catch (error) {
      console.error('Error getting never used items:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  // ========================================================================
  // PHASE 6: ADVANCED FEATURES
  // ========================================================================

  /**
   * GET /api/v1/wardrobe-library/advanced-search - Advanced search with full-text
   */
  async advancedSearch(req, res) {
    try {
      const {
        query,
        type,
        itemType,
        color,
        showId,
        tags,
        occasion,
        season,
        sortBy = 'relevance',
        order = 'desc',
        page = 1,
        limit = 20,
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const whereClause = { deletedAt: null };

      // Build where clause
      if (type) whereClause.type = type;
      if (itemType) whereClause.itemType = itemType;
      if (color) whereClause.color = { [Op.iLike]: `%${color}%` };
      if (showId) whereClause.showId = showId;
      if (occasion) whereClause.defaultOccasion = { [Op.iLike]: `%${occasion}%` };
      if (season) whereClause.defaultSeason = { [Op.iLike]: `%${season}%` };
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        whereClause.tags = { [Op.contains]: tagArray };
      }

      let orderClause;
      if (query && sortBy === 'relevance') {
        // Use full-text search with ranking
        whereClause[Op.and] = models.sequelize.literal(
          `to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', ${models.sequelize.escape(query)})`
        );
        orderClause = [
          [
            models.sequelize.literal(
              `ts_rank(to_tsvector('english', name || ' ' || COALESCE(description, '')), plainto_tsquery('english', ${models.sequelize.escape(query)}))`
            ),
            'DESC',
          ],
        ];
      } else {
        // Regular sorting
        if (query) {
          whereClause[Op.or] = [
            { name: { [Op.iLike]: `%${query}%` } },
            { description: { [Op.iLike]: `%${query}%` } },
          ];
        }

        const sortColumn =
          sortBy === 'usage' ? 'totalUsageCount' : sortBy === 'date' ? 'createdAt' : 'name';
        orderClause = [[sortColumn, order.toUpperCase()]];
      }

      const { count, rows } = await WardrobeLibrary.findAndCountAll({
        where: whereClause,
        order: orderClause,
        limit: parseInt(limit),
        offset,
      });

      res.json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit)),
        },
      });
    } catch (error) {
      console.error('Error in advanced search:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * GET /api/v1/wardrobe-library/suggestions - Get wardrobe suggestions
   */
  async getSuggestions(req, res) {
    try {
      const { episodeId, character, occasion, season, limit = 10 } = req.query;

      if (!episodeId) {
        throw new ValidationError('episodeId is required');
      }

      // Get episode to determine show context
      const episode = await Episode.findByPk(episodeId, {
        include: [{ model: Show, as: 'show' }],
      });

      if (!episode) {
        throw new NotFoundError('Episode not found');
      }

      // Get already assigned items for this episode
      const assignedWardrobe = await EpisodeWardrobe.findAll({
        where: { episode_id: episodeId },
        include: [
          {
            model: Wardrobe,
            as: 'wardrobe',
            attributes: ['library_item_id'],
            where: { library_item_id: { [Op.ne]: null } },
            required: true,
          },
        ],
      });

      const excludeIds = assignedWardrobe
        .map((ew) => ew.wardrobe?.library_item_id)
        .filter((id) => id);

      // Build query for similar items
      const whereClause = {
        deletedAt: null,
        id: { [Op.notIn]: excludeIds.length > 0 ? excludeIds : [0] },
      };

      // Match show or cross-show items
      whereClause[Op.or] = [{ showId: episode.showId }, { showId: null }];

      // Match context
      if (character) {
        whereClause.defaultCharacter = { [Op.iLike]: `%${character}%` };
      }
      if (occasion) {
        whereClause.defaultOccasion = { [Op.iLike]: `%${occasion}%` };
      }
      if (season) {
        whereClause.defaultSeason = { [Op.iLike]: `%${season}%` };
      }

      const suggestions = await WardrobeLibrary.findAll({
        where: whereClause,
        order: [
          ['totalUsageCount', 'DESC'],
          ['lastUsedAt', 'DESC NULLS LAST'],
        ],
        limit: parseInt(limit),
      });

      res.json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      console.error('Error getting suggestions:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * GET /api/v1/wardrobe-library/check-duplicates - Check for duplicate items
   */
  async duplicateDetection(req, res) {
    try {
      const { name, imageUrl } = req.query;

      if (!name && !imageUrl) {
        throw new ValidationError('Either name or imageUrl is required');
      }

      const whereClause = { deletedAt: null };
      const orConditions = [];

      // Fuzzy name match (similarity > 0.7)
      if (name) {
        orConditions.push(
          models.sequelize.literal(`similarity(name, ${models.sequelize.escape(name)}) > 0.7`)
        );
      }

      // Exact image URL match
      if (imageUrl) {
        orConditions.push({ imageUrl });
      }

      if (orConditions.length > 0) {
        whereClause[Op.or] = orConditions;
      }

      const duplicates = await WardrobeLibrary.findAll({
        where: whereClause,
        attributes: [
          'id',
          'name',
          'type',
          'itemType',
          'imageUrl',
          'thumbnailUrl',
          'createdAt',
          'createdBy',
          [
            models.sequelize.literal(`similarity(name, ${models.sequelize.escape(name || '')})`),
            'nameSimilarity',
          ],
        ],
        order: [
          [
            models.sequelize.literal(
              'similarity(name, ' + models.sequelize.escape(name || '') + ')'
            ),
            'DESC',
          ],
        ],
        limit: 10,
      });

      res.json({
        success: true,
        data: duplicates,
        message:
          duplicates.length > 0
            ? `Found ${duplicates.length} potential duplicate(s)`
            : 'No duplicates found',
      });
    } catch (error) {
      console.error('Error checking duplicates:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wardrobe-library/bulk-assign - Bulk assign items to episodes
   */
  async bulkAssign(req, res) {
    try {
      const { libraryItemIds, episodeIds, character, occasion, season, sceneId } = req.body;

      // Validate inputs
      if (!libraryItemIds || !Array.isArray(libraryItemIds) || libraryItemIds.length === 0) {
        throw new ValidationError('libraryItemIds array is required');
      }
      if (!episodeIds || !Array.isArray(episodeIds) || episodeIds.length === 0) {
        throw new ValidationError('episodeIds array is required');
      }

      // Verify all library items exist
      const libraryItems = await WardrobeLibrary.findAll({
        where: { id: libraryItemIds, deletedAt: null },
      });

      if (libraryItems.length !== libraryItemIds.length) {
        throw new ValidationError('Some library items not found');
      }

      // Verify all episodes exist
      const episodes = await Episode.findAll({
        where: { id: episodeIds },
      });

      if (episodes.length !== episodeIds.length) {
        throw new ValidationError('Some episodes not found');
      }

      // Use transaction for bulk assignment
      const transaction = await models.sequelize.transaction();

      try {
        let assignedCount = 0;
        const errors = [];

        for (const libraryItemId of libraryItemIds) {
          const libraryItem = libraryItems.find((item) => item.id === libraryItemId);

          for (const episodeId of episodeIds) {
            try {
              // Create wardrobe entry
              const wardrobeEntry = await Wardrobe.create(
                {
                  id: models.sequelize.literal('uuid_generate_v4()'),
                  name: libraryItem.name,
                  description: libraryItem.description,
                  imageUrl: libraryItem.imageUrl,
                  thumbnailUrl: libraryItem.thumbnailUrl,
                  library_item_id: libraryItemId,
                  character: character || libraryItem.defaultCharacter,
                  occasion: occasion || libraryItem.defaultOccasion,
                  season: season || libraryItem.defaultSeason,
                  created_by: req.user?.id || 'system',
                },
                { transaction }
              );

              // Link to episode
              await EpisodeWardrobe.create(
                {
                  id: models.sequelize.literal('uuid_generate_v4()'),
                  episode_id: episodeId,
                  wardrobe_id: wardrobeEntry.id,
                  scene: sceneId || null,
                },
                { transaction }
              );

              // Record in usage history
              await WardrobeUsageHistory.create(
                {
                  libraryItemId,
                  episodeId,
                  showId: episodes.find((e) => e.id === episodeId)?.showId,
                  usageType: 'assigned',
                  character: character || libraryItem.defaultCharacter,
                  occasion: occasion || libraryItem.defaultOccasion,
                  userId: req.user?.id || 'system',
                },
                { transaction }
              );

              // Update usage count
              await libraryItem.increment('totalUsageCount', { transaction });
              await libraryItem.update({ lastUsedAt: new Date() }, { transaction });

              assignedCount++;
            } catch (error) {
              errors.push({
                libraryItemId,
                episodeId,
                error: error.message,
              });
            }
          }
        }

        await transaction.commit();

        res.json({
          success: true,
          message: `Bulk assignment completed: ${assignedCount} assignment(s)`,
          assignedCount,
          errors: errors.length > 0 ? errors : undefined,
        });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error in bulk assign:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },
};

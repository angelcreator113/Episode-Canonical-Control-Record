const { models } = require('../models');
const { Wardrobe, EpisodeWardrobe, Episode } = models;
const { NotFoundError, ValidationError, asyncHandler } = require('../middleware/errorHandler');
const { Op } = require('sequelize');
const multer = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

// S3 client setup (reuse from assets)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

const BUCKET_NAME = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || 'episode-metadata-storage-dev';

/**
 * Wardrobe Controller
 * Handles all wardrobe-related API operations
 */

module.exports = {
  /**
   * POST /api/v1/wardrobe - Create new wardrobe item
   */
  async createWardrobeItem(req, res) {
    try {
      const {
        name,
        character,
        clothingCategory,
        brand,
        price,
        purchaseLink,
        website,
        color,
        size,
        season,
        occasion,
        outfitSetId,
        outfitSetName,
        sceneDescription,
        outfitNotes,
        isFavorite,
        tags,
      } = req.body;

      // Validation
      if (!name || !character || !clothingCategory) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['name', 'character', 'clothingCategory'],
        });
      }

      // Handle file upload if present
      let s3Key = null;
      let s3Url = null;

      if (req.file) {
        try {
          const fileExtension = req.file.originalname.split('.').pop();
          s3Key = `wardrobe/${character}/${uuidv4()}.${fileExtension}`;

          const uploadParams = {
            Bucket: BUCKET_NAME,
            Key: s3Key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
          };

          await s3Client.send(new PutObjectCommand(uploadParams));
          s3Url = `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
          console.log('✅ File uploaded to S3:', s3Url);
        } catch (s3Error) {
          console.error('⚠️ S3 upload failed:', s3Error.message);
          // Continue without image - don't fail the entire request
          console.warn('Creating wardrobe item without image due to S3 error');
          s3Key = null;
          s3Url = null;
        }
      }

      // Create wardrobe item
      const wardrobeItem = await Wardrobe.create({
        name,
        character,
        clothing_category: clothingCategory,
        s3_key: s3Key,
        s3_url: s3Url,
        brand: brand || null,
        price: price ? parseFloat(price) : null,
        purchase_link: purchaseLink || null,
        website: website || null,
        color: color || null,
        size: size || null,
        season: season || null,
        occasion: occasion || null,
        outfit_set_id: outfitSetId || null,
        outfit_set_name: outfitSetName || null,
        scene_description: sceneDescription || null,
        outfit_notes: outfitNotes || null,
        is_favorite: isFavorite === 'true' || isFavorite === true,
        tags: tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [],
      });

      res.status(201).json({
        success: true,
        data: wardrobeItem,
      });
    } catch (error) {
      console.error('❌ Error creating wardrobe item:', error);
      res.status(500).json({
        error: 'Failed to create wardrobe item',
        message: error.message,
      });
    }
  },

  /**
   * GET /api/v1/wardrobe - List all wardrobe items
   */
  async listWardrobeItems(req, res) {
    try {
      const {
        character,
        category,
        favorite,
        search,
        page = 1,
        limit = 50,
        sortBy = 'created_at',
        sortOrder = 'DESC',
      } = req.query;

      const where = { deleted_at: null };

      // Filter by character
      if (character) {
        where.character = character;
      }

      // Filter by category
      if (category) {
        where.clothing_category = category;
      }

      // Filter by favorite
      if (favorite === 'true') {
        where.is_favorite = true;
      }

      // Search by name, brand, color
      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { brand: { [Op.iLike]: `%${search}%` } },
          { color: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows } = await Wardrobe.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset,
        order: [[sortBy, sortOrder.toUpperCase()]],
      });

      res.json({
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit),
        },
      });
    } catch (error) {
      console.error('❌ Error listing wardrobe items:', error);
      res.status(500).json({
        error: 'Failed to list wardrobe items',
        message: error.message,
      });
    }
  },

  /**
   * GET /api/v1/wardrobe/:id - Get single wardrobe item
   */
  async getWardrobeItem(req, res) {
    try {
      const { id } = req.params;

      const wardrobeItem = await Wardrobe.findOne({
        where: { id, deleted_at: null },
        include: [
          {
            model: Episode,
            as: 'episodes',
            through: { attributes: ['scene', 'worn_at', 'notes'] },
            attributes: ['id', 'episode_number', 'title', 'air_date'],
          },
        ],
      });

      if (!wardrobeItem) {
        return res.status(404).json({
          error: 'Wardrobe item not found',
        });
      }

      res.json({
        success: true,
        data: wardrobeItem,
      });
    } catch (error) {
      console.error('❌ Error fetching wardrobe item:', error);
      res.status(500).json({
        error: 'Failed to fetch wardrobe item',
        message: error.message,
      });
    }
  },

  /**
   * PUT /api/v1/wardrobe/:id - Update wardrobe item
   */
  async updateWardrobeItem(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const wardrobeItem = await Wardrobe.findOne({
        where: { id, deleted_at: null },
      });

      if (!wardrobeItem) {
        return res.status(404).json({
          error: 'Wardrobe item not found',
        });
      }

      // Handle file upload if present
      if (req.file) {
        // Delete old file if exists
        if (wardrobeItem.s3_key) {
          try {
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: wardrobeItem.s3_key,
              })
            );
          } catch (err) {
            console.warn('Failed to delete old image:', err);
          }
        }

        // Upload new file
        const fileExtension = req.file.originalname.split('.').pop();
        const s3Key = `wardrobe/${updates.character || wardrobeItem.character}/${uuidv4()}.${fileExtension}`;

        const uploadParams = {
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        };

        await s3Client.send(new PutObjectCommand(uploadParams));
        updates.s3_key = s3Key;
        updates.s3_url = `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
      }

      // Map camelCase to snake_case
      const updateData = {
        name: updates.name,
        character: updates.character,
        clothing_category: updates.clothingCategory,
        brand: updates.brand,
        price: updates.price ? parseFloat(updates.price) : null,
        purchase_link: updates.purchaseLink,
        website: updates.website,
        color: updates.color,
        size: updates.size,
        season: updates.season,
        occasion: updates.occasion,
        outfit_set_id: updates.outfitSetId,
        outfit_set_name: updates.outfitSetName,
        scene_description: updates.sceneDescription,
        outfit_notes: updates.outfitNotes,
        is_favorite: updates.isFavorite === 'true' || updates.isFavorite === true,
        tags: updates.tags ? (typeof updates.tags === 'string' ? JSON.parse(updates.tags) : updates.tags) : undefined,
        s3_key: updates.s3_key,
        s3_url: updates.s3_url,
        updated_at: new Date(),
      };

      // Remove undefined values
      Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);

      await wardrobeItem.update(updateData);

      res.json({
        success: true,
        data: wardrobeItem,
      });
    } catch (error) {
      console.error('❌ Error updating wardrobe item:', error);
      res.status(500).json({
        error: 'Failed to update wardrobe item',
        message: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/wardrobe/:id - Delete wardrobe item (soft delete)
   */
  async deleteWardrobeItem(req, res) {
    try {
      const { id } = req.params;

      const wardrobeItem = await Wardrobe.findOne({
        where: { id, deleted_at: null },
      });

      if (!wardrobeItem) {
        return res.status(404).json({
          error: 'Wardrobe item not found',
        });
      }

      // Soft delete
      await wardrobeItem.update({
        deleted_at: new Date(),
      });

      res.json({
        success: true,
        message: 'Wardrobe item deleted successfully',
      });
    } catch (error) {
      console.error('❌ Error deleting wardrobe item:', error);
      res.status(500).json({
        error: 'Failed to delete wardrobe item',
        message: error.message,
      });
    }
  },

  /**
   * GET /api/v1/episodes/:id/wardrobe - Get wardrobe for specific episode
   */
  async getEpisodeWardrobe(req, res) {
    try {
      const { id } = req.params;

      const episode = await Episode.findByPk(id);
      if (!episode) {
        return res.status(404).json({
          error: 'Episode not found',
        });
      }

      const wardrobeItems = await Wardrobe.findAll({
        include: [
          {
            model: EpisodeWardrobe,
            as: 'episodeLinks',
            where: { episode_id: id },
            attributes: ['scene', 'worn_at', 'notes'],
            required: false,
          },
        ],
        attributes: [
          'id',
          'name',
          'character',
          'clothing_category',
          's3_url',
          's3_url_processed',
          'thumbnail_url',
          'color',
          'season',
          'is_favorite',
          'created_at',
        ],
        where: { deleted_at: null },
        order: [['created_at', 'DESC']],
      });

      res.json({
        success: true,
        data: wardrobeItems,
        count: wardrobeItems.length,
      });
    } catch (error) {
      console.error('❌ Error fetching episode wardrobe:', error);
      res.status(500).json({
        error: 'Failed to fetch episode wardrobe',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/episodes/:id/wardrobe/:wardrobeId - Link wardrobe item to episode
   */
  async linkWardrobeToEpisode(req, res) {
    try {
      const { id: episodeId, wardrobeId } = req.params;
      const { scene, notes } = req.body;

      // Check if both exist
      const episode = await Episode.findByPk(episodeId);
      if (!episode) {
        return res.status(404).json({ error: 'Episode not found' });
      }

      const wardrobeItem = await Wardrobe.findOne({
        where: { id: wardrobeId, deleted_at: null },
      });
      if (!wardrobeItem) {
        return res.status(404).json({ error: 'Wardrobe item not found' });
      }

      // Check if already linked
      const existing = await EpisodeWardrobe.findOne({
        where: { episode_id: episodeId, wardrobe_id: wardrobeId },
      });

      if (existing) {
        return res.status(400).json({
          error: 'Wardrobe item already linked to this episode',
        });
      }

      // Create link
      const link = await EpisodeWardrobe.create({
        episode_id: episodeId,
        wardrobe_id: wardrobeId,
        scene: scene || null,
        notes: notes || null,
      });

      // Update wardrobe wear count
      await wardrobeItem.incrementWearCount(new Date());

      res.status(201).json({
        success: true,
        data: link,
      });
    } catch (error) {
      console.error('❌ Error linking wardrobe to episode:', error);
      res.status(500).json({
        error: 'Failed to link wardrobe to episode',
        message: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/episodes/:id/wardrobe/:wardrobeId - Unlink wardrobe from episode
   */
  async unlinkWardrobeFromEpisode(req, res) {
    try {
      const { id: episodeId, wardrobeId } = req.params;

      const link = await EpisodeWardrobe.findOne({
        where: { episode_id: episodeId, wardrobe_id: wardrobeId },
      });

      if (!link) {
        return res.status(404).json({
          error: 'Link not found',
        });
      }

      await link.destroy();

      res.json({
        success: true,
        message: 'Wardrobe item unlinked from episode',
      });
    } catch (error) {
      console.error('❌ Error unlinking wardrobe from episode:', error);
      res.status(500).json({
        error: 'Failed to unlink wardrobe from episode',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wardrobe/:id/process-background - Process background removal
   */
  async processBackgroundRemoval(req, res) {
    try {
      const { id } = req.params;

      const wardrobeItem = await Wardrobe.findOne({
        where: { id, deleted_at: null },
      });

      if (!wardrobeItem) {
        return res.status(404).json({
          error: 'Wardrobe item not found',
        });
      }

      if (!wardrobeItem.s3_url) {
        return res.status(400).json({
          error: 'No image to process',
        });
      }

      // Download the image from S3
      const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
      const getCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: wardrobeItem.s3_key,
      });

      const response = await s3Client.send(getCommand);
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      const imageBuffer = Buffer.concat(chunks);

      // Call background removal API
      const runwayApiKey = process.env.RUNWAY_ML_API_KEY;
      const removeBgApiKey = process.env.REMOVEBG_API_KEY;
      
      if (!runwayApiKey && !removeBgApiKey) {
        return res.status(500).json({
          error: 'No background removal API key configured',
        });
      }

      const FormData = require('form-data');
      const axios = require('axios');

      const formData = new FormData();
      formData.append('image_file', imageBuffer, {
        filename: wardrobeItem.file_name || 'image.jpg',
        contentType: wardrobeItem.content_type || 'image/jpeg',
      });
      formData.append('size', 'auto'); // Auto-detect best output size

      let runwayResponse;
      
      // Try remove.bg first (more reliable)
      if (removeBgApiKey) {
        console.log(`📤 Sending to remove.bg API for wardrobe item ${id}...`);
        try {
          runwayResponse = await axios.post(
            'https://api.remove.bg/v1.0/removebg',
            formData,
            {
              headers: {
                ...formData.getHeaders(),
                'X-Api-Key': removeBgApiKey,
              },
              responseType: 'arraybuffer',
              timeout: 60000, // 60 second timeout for large images
            }
          );
        } catch (error) {
          console.error('remove.bg failed:', error.message);
          if (!runwayApiKey) throw error;
        }
      }
      
      // Fallback to RunwayML if remove.bg failed or not configured
      if (!runwayResponse && runwayApiKey) {
        console.log(`📤 Sending to RunwayML API for wardrobe item ${id}...`);
        runwayResponse = await axios.post(
          'https://api.runwayml.com/v1/remove-background',
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              'Authorization': `Bearer ${runwayApiKey}`,
            },
            responseType: 'arraybuffer',
            timeout: 60000, // 60 second timeout
          }
        );
      }

      // Upload processed image to S3 (add _processed to filename)
      const processedKey = wardrobeItem.s3_key.replace(/(\.\w+)$/, '_processed.png');
      const putCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: processedKey,
        Body: Buffer.from(runwayResponse.data),
        ContentType: 'image/png', // RunwayML returns PNG
      });

      await s3Client.send(putCommand);
      const processedUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${processedKey}`;

      // Update wardrobe item with processed version
      await wardrobeItem.update({
        s3_key_processed: processedKey,
        s3_url_processed: processedUrl,
        updated_at: new Date(),
      });

      console.log(`✅ Background removed for wardrobe item ${id}`);

      res.json({
        success: true,
        message: 'Background removed successfully',
        data: {
          id: wardrobeItem.id,
          s3_url_processed: processedUrl,
        },
      });
    } catch (error) {
      console.error('❌ Error processing background removal:', error);
      if (error.response) {
        console.error('RunwayML API error:', error.response.status, error.response.data);
      }
      res.status(500).json({
        error: 'Failed to remove background',
        message: error.message,
      });
    }
  },
};

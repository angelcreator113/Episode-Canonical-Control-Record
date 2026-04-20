const db = require('../models');
const { models, sequelize, Sequelize } = db;
const { Wardrobe, EpisodeWardrobe, Episode } = models;
const { Op } = require('sequelize');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const wardrobeImageService = require('../services/wardrobeImageService');
const { applyRemoveBgParams } = require('../services/removeBgParams');

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

const BUCKET_NAME =
  process.env.S3_PRIMARY_BUCKET ||
  process.env.AWS_S3_BUCKET ||
  process.env.S3_BUCKET_NAME ||
  'episode-metadata-storage-dev';

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
        description,
        brand,
        price,
        purchaseLink,
        website,
        color,
        size,
        season,
        occasion,
        tier,
        outfitSetId,
        outfitSetName,
        sceneDescription,
        outfitNotes,
        isFavorite,
        tags,
        showId, // NEW: Primary show ownership
      } = req.body;

      // Validation - character is REQUIRED, name and category auto-fill
      if (!character) {
        return res.status(400).json({
          error: 'Missing required field: character',
          required: ['character'],
          message: 'Character is required for all wardrobe items',
        });
      }

      // Auto-generate name from filename if not provided
      const resolvedName = name || (req.file ? req.file.originalname.replace(/\.[^.]+$/, '') : `Outfit ${Date.now()}`);
      const resolvedCategory = clothingCategory || 'general';

      // Handle file upload if present — now with auto-sharpening and thumbnail generation
      let s3Key = null;
      let s3Url = null;
      let thumbnailUrl = null;

      if (req.file) {
        try {
          console.log('📸 Processing wardrobe upload with auto-enhancement...');
          
          // Use new image processing pipeline: sharpen + generate thumbnail
          const processedImages = await wardrobeImageService.processWardrobeUpload(
            req.file.buffer,
            character,
            { skipThumbnail: false, thumbnailSize: 300 }
          );

          s3Key = processedImages.mainImage.s3Key;
          s3Url = processedImages.mainImage.s3Url;
          thumbnailUrl = processedImages.thumbnail?.s3Url || null;

          console.log('✅ Image enhanced and uploaded:', s3Url);
          if (thumbnailUrl) console.log('✅ Thumbnail generated:', thumbnailUrl);
        } catch (imgError) {
          console.error('⚠️ Image processing failed, using raw upload:', imgError.message);
          
          // Fallback to raw upload without enhancement
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
            console.log('✅ Raw file uploaded to S3:', s3Url);
          } catch (s3Error) {
            console.error('⚠️ S3 upload failed:', s3Error.message);
            console.warn('Creating wardrobe item without image due to S3 error');
            s3Key = null;
            s3Url = null;
          }
        }
      }

      // Resolve character_id from character name
      let resolvedCharacterId = null;
      try {
        const { Character } = require('../models');
        if (Character) {
          const charRecord = await Character.findOne({ where: { name: character } });
          if (charRecord) resolvedCharacterId = charRecord.id;
        }
      } catch (lookupErr) {
        console.warn('⚠️ Could not resolve character_id:', lookupErr.message);
      }

      // Create wardrobe item
      // Parse tags — could be JSON array, comma-separated string, or already an array
      let parsedTags = [];
      if (tags) {
        if (Array.isArray(tags)) parsedTags = tags;
        else if (typeof tags === 'string') {
          try { parsedTags = JSON.parse(tags); } catch { parsedTags = tags.split(',').map(s => s.trim()).filter(Boolean); }
        }
      }

      const wardrobeItem = await Wardrobe.create({
        name: resolvedName,
        character, // Required field
        character_id: resolvedCharacterId,
        clothing_category: resolvedCategory,
        description: description || null,
        show_id: showId || null, // Primary show ownership
        s3_key: s3Key,
        s3_url: s3Url,
        thumbnail_url: thumbnailUrl,
        brand: brand || null,
        price: price ? parseFloat(price) : null,
        purchase_link: purchaseLink || null,
        website: website || null,
        color: color || null,
        size: size || null,
        season: season || null,
        occasion: occasion || null,
        tier: tier || null,
        outfit_set_id: outfitSetId || null,
        outfit_set_name: outfitSetName || null,
        scene_description: sceneDescription || null,
        outfit_notes: outfitNotes || null,
        is_favorite: isFavorite === 'true' || isFavorite === true,
        tags: parsedTags,
      });

      // Auto background removal — runs async, updates the record when done
      if (s3Url && s3Key && process.env.REMOVEBG_API_KEY) {
        // Don't await — let it run in background so upload returns fast
        (async () => {
          try {
            const axios = require('axios');
            const FormData = require('form-data');
            const { GetObjectCommand } = require('@aws-sdk/client-s3');
            const { v4: bgUuid } = require('uuid');
            console.log(`[Wardrobe] Auto-removing background for ${wardrobeItem.id} (key=${s3Key})...`);

            // Download the original from S3 ourselves rather than handing remove.bg
            // an `image_url` — the latter requires the bucket/object to be
            // publicly readable, which isn't guaranteed and produced silent
            // failures. form-data upload works regardless of bucket ACL.
            const obj = await s3Client.send(new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: s3Key,
            }));
            const chunks = [];
            for await (const chunk of obj.Body) chunks.push(chunk);
            const imageBuffer = Buffer.concat(chunks);

            const fd = new FormData();
            fd.append('image_file', imageBuffer, {
              filename: `${wardrobeItem.id}.jpg`,
              contentType: 'image/jpeg',
            });
            applyRemoveBgParams(fd, resolvedCategory);

            const bgRes = await axios.post(
              'https://api.remove.bg/v1.0/removebg',
              fd,
              {
                headers: { ...fd.getHeaders(), 'X-Api-Key': process.env.REMOVEBG_API_KEY },
                responseType: 'arraybuffer',
                timeout: 60000,
              }
            );

            const processedKey = `wardrobe/${character}/${bgUuid()}-nobg.png`;
            await s3Client.send(new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: processedKey,
              Body: Buffer.from(bgRes.data),
              ContentType: 'image/png',
              CacheControl: 'max-age=31536000',
            }));

            const processedUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${processedKey}`;
            await wardrobeItem.update({
              s3_key_processed: processedKey,
              s3_url_processed: processedUrl,
            });
            console.log(`[Wardrobe] Background removed: ${wardrobeItem.id}`);
          } catch (bgErr) {
            // Surface HTTP status + response body when the error came from
            // remove.bg, so pm2 logs tell us exactly why (credits, bad key,
            // image rejected, rate limit, etc.) instead of just a message.
            const status = bgErr.response?.status;
            let body = '';
            if (bgErr.response?.data) {
              try {
                body = Buffer.isBuffer(bgErr.response.data)
                  ? bgErr.response.data.toString('utf8')
                  : JSON.stringify(bgErr.response.data);
              } catch (_) {
                body = String(bgErr.response.data).slice(0, 500);
              }
            }
            console.warn(
              `[Wardrobe] Background removal failed (non-blocking) for ${wardrobeItem.id}: ${bgErr.message}` +
                (status ? ` [status=${status}]` : '') +
                (body ? ` body=${body.slice(0, 500)}` : '')
            );
          }
        })();
      }

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
        show_id,
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

      // Filter by show — include items belonging to this show OR unscoped (null show_id)
      if (show_id) {
        where.show_id = { [Op.or]: [show_id, null] };
      }

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

      // Whitelist sortBy to prevent invalid column errors
      const validSortCols = ['created_at', 'updated_at', 'name', 'clothing_category', 'tier', 'brand', 'color'];
      const safeSortBy = validSortCols.includes(sortBy) ? sortBy : 'created_at';
      const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      let count, rows;
      try {
        ({ count, rows } = await Wardrobe.findAndCountAll({
          where,
          limit: parseInt(limit),
          offset,
          order: [[safeSortBy, safeSortOrder]],
        }));
      } catch (ormError) {
        // Fallback to raw SQL if ORM fails (model/DB column mismatch)
        console.warn('⚠️ ORM query failed, using raw SQL fallback:', ormError.message);

        // Check which columns actually exist in the table
        const [cols] = await sequelize.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'wardrobe'`
        );
        const colNames = new Set(cols.map(c => c.column_name));

        const conditions = [];
        const replacements = {};
        if (colNames.has('deleted_at')) conditions.push('deleted_at IS NULL');
        if (show_id && colNames.has('show_id')) { conditions.push('show_id = :show_id'); replacements.show_id = show_id; }
        if (character && colNames.has('character')) { conditions.push('"character" = :character'); replacements.character = character; }
        if (category && colNames.has('clothing_category')) { conditions.push('clothing_category = :category'); replacements.category = category; }
        if (search) { conditions.push('(name ILIKE :search OR brand ILIKE :search OR color ILIKE :search)'); replacements.search = `%${search}%`; }

        const realSortBy = colNames.has(safeSortBy) ? safeSortBy : 'created_at';
        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const [countResult] = await sequelize.query(
          `SELECT COUNT(*) as total FROM wardrobe ${whereClause}`,
          { replacements }
        );
        count = parseInt(countResult[0].total);
        const [rawRows] = await sequelize.query(
          `SELECT * FROM wardrobe ${whereClause} ORDER BY ${realSortBy} ${safeSortOrder} LIMIT :limit OFFSET :offset`,
          { replacements: { ...replacements, limit: parseInt(limit), offset } }
        );
        rows = rawRows;
      }

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
            through: { attributes: ['scene_id', 'worn_at', 'notes'] },
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

      // Map camelCase to snake_case (original fields)
      const updateData = {
        name: updates.name,
        character: updates.character,
        clothing_category: updates.clothing_category ?? updates.clothingCategory,
        brand: updates.brand,
        price: updates.price != null ? parseFloat(updates.price) : undefined,
        purchase_link: updates.purchase_link ?? updates.purchaseLink,
        website: updates.website,
        color: updates.color,
        size: updates.size,
        season: updates.season,
        occasion: updates.occasion,
        outfit_set_id: updates.outfit_set_id ?? updates.outfitSetId,
        outfit_set_name: updates.outfit_set_name ?? updates.outfitSetName,
        scene_description: updates.scene_description ?? updates.sceneDescription,
        outfit_notes: updates.outfit_notes ?? updates.outfitNotes,
        is_favorite: updates.is_favorite != null
          ? (updates.is_favorite === 'true' || updates.is_favorite === true)
          : updates.isFavorite != null
            ? (updates.isFavorite === 'true' || updates.isFavorite === true)
            : undefined,
        tags: updates.tags
          ? typeof updates.tags === 'string'
            ? JSON.parse(updates.tags)
            : updates.tags
          : undefined,
        s3_key: updates.s3_key,
        s3_url: updates.s3_url,
        // Game-layer fields
        tier: updates.tier,
        lock_type: updates.lock_type,
        unlock_requirement: updates.unlock_requirement,
        is_owned: updates.is_owned != null ? (updates.is_owned === 'true' || updates.is_owned === true) : undefined,
        is_visible: updates.is_visible != null ? (updates.is_visible === 'true' || updates.is_visible === true) : undefined,
        era_alignment: updates.era_alignment,
        aesthetic_tags: updates.aesthetic_tags
          ? typeof updates.aesthetic_tags === 'string'
            ? JSON.parse(updates.aesthetic_tags)
            : updates.aesthetic_tags
          : undefined,
        event_types: updates.event_types
          ? typeof updates.event_types === 'string'
            ? JSON.parse(updates.event_types)
            : updates.event_types
          : undefined,
        outfit_match_weight: updates.outfit_match_weight != null ? parseInt(updates.outfit_match_weight) : undefined,
        coin_cost: updates.coin_cost != null ? parseInt(updates.coin_cost) : undefined,
        reputation_required: updates.reputation_required != null ? parseInt(updates.reputation_required) : undefined,
        influence_required: updates.influence_required != null ? parseInt(updates.influence_required) : undefined,
        season_unlock_episode: updates.season_unlock_episode != null ? parseInt(updates.season_unlock_episode) : undefined,
        lala_reaction_own: updates.lala_reaction_own,
        lala_reaction_locked: updates.lala_reaction_locked,
        lala_reaction_reject: updates.lala_reaction_reject,
        updated_at: new Date(),
      };

      // Remove undefined values
      Object.keys(updateData).forEach(
        (key) => updateData[key] === undefined && delete updateData[key]
      );

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
      const { force } = req.query; // Allow force delete with ?force=true

      const wardrobeItem = await Wardrobe.findOne({
        where: { id, deleted_at: null },
      });

      if (!wardrobeItem) {
        return res.status(404).json({
          error: 'Wardrobe item not found',
        });
      }

      // SAFEGUARD: Check if item is used in any episodes
      const usageCount = await EpisodeWardrobe.count({
        where: { wardrobe_id: id },
      });

      if (usageCount > 0 && force !== 'true') {
        return res.status(400).json({
          error: 'Cannot delete item',
          message: `This item is used in ${usageCount} episode${usageCount > 1 ? 's' : ''}. Remove it from all episodes first, or use ?force=true to delete anyway.`,
          usageCount,
          canForceDelete: true,
        });
      }

      // If forcing delete, remove all episode links first
      if (force === 'true' && usageCount > 0) {
        await EpisodeWardrobe.destroy({
          where: { wardrobe_id: id },
        });
        console.log(`⚠️ Force deleted ${usageCount} episode links for wardrobe item ${id}`);
      }

      // Soft delete
      await wardrobeItem.update({
        deleted_at: new Date(),
      });

      res.json({
        success: true,
        message: 'Wardrobe item deleted successfully',
        unlinkedEpisodes: force === 'true' ? usageCount : 0,
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

      console.log('📥 Fetching wardrobe for episode:', id);

      // Validate episode exists (non-blocking check)
      const episode = await Episode.findOne({
        where: { id, deleted_at: null },
        attributes: ['id'],
      });

      if (!episode) {
        console.log('❌ Episode not found:', id);
        return res.status(404).json({
          error: 'Episode not found',
        });
      }

      console.log('✅ Episode found, fetching wardrobe items...');

      // Query episode_wardrobe junction table directly
      const wardrobeLinks = await sequelize.query(
        `SELECT ew.wardrobe_id, ew.scene_id, ew.worn_at, ew.notes,
                w.id, w.name, w.character, w.clothing_category, 
                w.s3_url, w.s3_url_processed, w.thumbnail_url, 
                w.color, w.season, w.is_favorite, w.created_at
         FROM episode_wardrobe ew
         JOIN wardrobe w ON w.id = ew.wardrobe_id
         WHERE ew.episode_id = :episode_id 
         AND w.deleted_at IS NULL
         ORDER BY ew.created_at DESC`,
        {
          replacements: { episode_id: id },
          type: Sequelize.QueryTypes.SELECT,
        }
      );

      console.log(`✅ Found ${wardrobeLinks.length} wardrobe items`);

      res.json({
        success: true,
        data: wardrobeLinks,
        count: wardrobeLinks.length,
      });
    } catch (error) {
      console.error('❌ Error fetching episode wardrobe:', error);
      console.error('Error details:', error.name, error.message);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        error: 'Failed to fetch episode wardrobe',
        message: error.message,
        errorName: error.name,
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

      // Update wardrobe wear count - disabled until columns are added to model
      // await wardrobeItem.incrementWearCount(new Date());

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
      applyRemoveBgParams(formData, wardrobeItem.clothing_category);

      let runwayResponse;

      // Try remove.bg first (more reliable)
      if (removeBgApiKey) {
        console.log(`📤 Sending to remove.bg API for wardrobe item ${id}...`);
        try {
          runwayResponse = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
            headers: {
              ...formData.getHeaders(),
              'X-Api-Key': removeBgApiKey,
            },
            responseType: 'arraybuffer',
            timeout: 60000, // 60 second timeout for large images
          });
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
              Authorization: `Bearer ${runwayApiKey}`,
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

  /**
   * POST /api/v1/wardrobe/:id/regenerate-product-shot
   *
   * Produces a polished studio-style variant of the item using Flux Kontext
   * (image-to-image). Preserves the garment's silhouette / color / pattern
   * while swapping the backdrop, removing hangers, and simulating an
   * invisible-mannequin pose — so amateur uploads start to look like the
   * vendor product shots that already exist in the library.
   *
   * Cost: ~$0.04/call, charged against AI_DAILY_IMAGE_BUDGET_USD.
   * Stored on a dedicated column pair (s3_key_regenerated / s3_url_regenerated)
   * so the original and background-removed variants are preserved untouched.
   */
  async regenerateProductShot(req, res) {
    const { id } = req.params;

    try {
      const wardrobeItem = await Wardrobe.findOne({
        where: { id, deleted_at: null },
      });

      if (!wardrobeItem) {
        return res.status(404).json({ error: 'Wardrobe item not found' });
      }

      // Prefer the background-removed version as reference — it has a cleaner
      // subject isolation. Fall back to the original upload if not processed.
      const referenceKey = wardrobeItem.s3_key_processed || wardrobeItem.s3_key;
      if (!referenceKey) {
        return res.status(400).json({ error: 'No image to regenerate from' });
      }

      // Mark pending so the UI can show progress; any existing regenerated
      // variant stays accessible until success replaces it.
      await wardrobeItem.update({
        regeneration_status: 'pending',
        regeneration_error: null,
      });

      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const getCmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: referenceKey });
      const obj = await s3Client.send(getCmd);
      const chunks = [];
      for await (const chunk of obj.Body) chunks.push(chunk);
      const imageBuffer = Buffer.concat(chunks);

      // Pass as data URI so we don't depend on the S3 object being
      // publicly readable (same reasoning as the remove.bg form-data path).
      const isPng = referenceKey.toLowerCase().endsWith('.png');
      const mime = isPng ? 'image/png' : 'image/jpeg';
      const dataUri = `data:${mime};base64,${imageBuffer.toString('base64')}`;

      // Default studio prompt — Kontext will use the reference image for
      // identity (silhouette, color, pattern) and this prompt for the vibe.
      const prompt = req.body?.prompt ||
        'Professional studio product photograph of this clothing item. ' +
        'Clean neutral off-white backdrop, soft even studio lighting, ' +
        'invisible-mannequin pose showing the garment shape, no hanger, ' +
        'no wrinkles, fashion e-commerce style, centered composition, ' +
        'sharp focus on fabric details and trim.';

      const { generateImageFromImage } = require('../services/imageGenerationService');
      const result = await generateImageFromImage(dataUri, prompt, {
        size: 'portrait',
      });

      // Persist the generated image to S3 so it survives the provider's
      // expiring URL.
      const axios = require('axios');
      const genRes = await axios.get(result.url, {
        responseType: 'arraybuffer',
        timeout: 120000,
      });

      const newKey = `wardrobe/${wardrobeItem.character || 'uncategorized'}/${uuidv4()}-product.jpg`;
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: newKey,
        Body: Buffer.from(genRes.data),
        ContentType: 'image/jpeg',
        CacheControl: 'max-age=31536000',
      }));

      const newUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${newKey}`;

      await wardrobeItem.update({
        s3_key_regenerated: newKey,
        s3_url_regenerated: newUrl,
        regeneration_status: 'success',
        regeneration_error: null,
        regenerated_at: new Date(),
      });

      console.log(`[Wardrobe] Product-shot regenerated for ${id} → ${newUrl}`);

      return res.json({
        success: true,
        data: {
          id: wardrobeItem.id,
          s3_url_regenerated: newUrl,
          regenerated_at: wardrobeItem.regenerated_at,
          cost_estimate: result.cost_estimate,
          provider: result.provider,
        },
      });
    } catch (error) {
      console.error(`[Wardrobe] Product-shot regeneration failed for ${id}:`, error.message);
      // Capture HTTP status + body when the failure came from fal.ai so pm2
      // logs tell us exactly what went wrong (quota, bad reference, etc.).
      const status = error.response?.status;
      let body = '';
      if (error.response?.data) {
        try {
          body = Buffer.isBuffer(error.response.data)
            ? error.response.data.toString('utf8').slice(0, 500)
            : JSON.stringify(error.response.data).slice(0, 500);
        } catch (_) {
          body = String(error.response.data).slice(0, 500);
        }
      }
      const detail = status ? `${error.message} [status=${status}] ${body}` : error.message;

      try {
        const item = await Wardrobe.findOne({ where: { id } });
        if (item) {
          await item.update({
            regeneration_status: 'failed',
            regeneration_error: detail.slice(0, 1000),
          });
        }
      } catch (_) { /* best-effort status write */ }

      return res.status(500).json({
        error: 'Failed to regenerate product shot',
        message: error.message,
        detail: status ? { status, body } : undefined,
      });
    }
  },

  /**
   * PATCH /api/v1/wardrobe/:id/primary-variant
   *
   * Persist the user's preference for which image variant the grid card
   * should show (original | processed | regenerated | null=auto). The
   * lightbox can preview any variant locally without hitting this, but
   * writing changes which one non-hovering viewers see in the grid.
   */
  async setPrimaryImageVariant(req, res) {
    try {
      const { id } = req.params;
      const { variant } = req.body || {};

      const ALLOWED = new Set(['original', 'processed', 'regenerated', null]);
      if (!ALLOWED.has(variant) && variant !== undefined) {
        return res.status(400).json({
          error: 'Invalid variant',
          message: `variant must be one of: original, processed, regenerated, or null. Got: ${JSON.stringify(variant)}`,
        });
      }

      const item = await Wardrobe.findOne({ where: { id, deleted_at: null } });
      if (!item) return res.status(404).json({ error: 'Wardrobe item not found' });

      // Refuse to set a variant the row doesn't actually have — otherwise
      // the grid card would fall back to the default chain silently and the
      // user would wonder why their click did nothing.
      if (variant === 'regenerated' && !item.s3_url_regenerated) {
        return res.status(400).json({ error: 'No regenerated image exists for this item yet' });
      }
      if (variant === 'processed' && !item.s3_url_processed) {
        return res.status(400).json({ error: 'No background-removed image exists for this item yet' });
      }
      if (variant === 'original' && !item.s3_url) {
        return res.status(400).json({ error: 'No original image exists for this item' });
      }

      await item.update({ primary_image_variant: variant === undefined ? null : variant });

      return res.json({
        success: true,
        data: {
          id: item.id,
          primary_image_variant: item.primary_image_variant,
        },
      });
    } catch (err) {
      console.error('[Wardrobe] setPrimaryImageVariant failed:', err.message);
      return res.status(500).json({
        error: 'Failed to set primary image variant',
        message: err.message,
      });
    }
  },

  /**
   * GET /api/v1/wardrobe/staging - Get unassigned wardrobe items (staging area)
   */
  async getStagingItems(req, res) {
    try {
      const { showId } = req.query;

      // Get all wardrobe items that have ZERO episode usages
      const stagingQuery = `
        SELECT w.*, 
               COALESCE(usage.usage_count, 0) as usage_count
        FROM wardrobe w
        LEFT JOIN (
          SELECT wardrobe_id, COUNT(*) as usage_count
          FROM episode_wardrobe
          GROUP BY wardrobe_id
        ) usage ON usage.wardrobe_id = w.id
        WHERE w.deleted_at IS NULL
        ${showId ? 'AND w.show_id = :showId' : ''}
        AND COALESCE(usage.usage_count, 0) = 0
        ORDER BY w.created_at DESC
      `;

      const stagingItems = await sequelize.query(stagingQuery, {
        replacements: { showId },
        type: Sequelize.QueryTypes.SELECT,
      });

      res.json({
        success: true,
        data: stagingItems,
        count: stagingItems.length,
      });
    } catch (error) {
      console.error('❌ Error fetching staging items:', error);
      res.status(500).json({
        error: 'Failed to fetch staging items',
        message: error.message,
      });
    }
  },

  /**
   * PATCH /api/v1/episodes/:id/wardrobe/:wardrobeId/favorite - Toggle episode favorite
   */
  async toggleEpisodeFavorite(req, res) {
    try {
      const { id: episodeId, wardrobeId } = req.params;
      const { isFavorite } = req.body;

      const link = await EpisodeWardrobe.findOne({
        where: { episode_id: episodeId, wardrobe_id: wardrobeId },
      });

      if (!link) {
        return res.status(404).json({
          error: 'Wardrobe item not linked to this episode',
        });
      }

      await link.update({
        is_episode_favorite: isFavorite !== undefined ? isFavorite : !link.is_episode_favorite,
      });

      res.json({
        success: true,
        data: link,
        message: `Episode favorite ${link.is_episode_favorite ? 'added' : 'removed'}`,
      });
    } catch (error) {
      console.error('❌ Error toggling episode favorite:', error);
      res.status(500).json({
        error: 'Failed to toggle episode favorite',
        message: error.message,
      });
    }
  },

  /**
   * GET /api/v1/wardrobe/:id/usage - Get item usage across shows/episodes
   */
  async getItemUsage(req, res) {
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

      // Get all episodes and shows where this item appears
      const usageQuery = `
        SELECT 
          e.id as episode_id,
          e.title as episode_title,
          e.episode_number,
          e.show_id,
          s.name as show_title,
          ew.scene,
          ew.worn_at,
          ew.notes,
          ew.is_episode_favorite,
          ew.created_at as linked_at
        FROM episode_wardrobe ew
        JOIN episodes e ON e.id = ew.episode_id
        LEFT JOIN shows s ON s.id = e.show_id
        WHERE ew.wardrobe_id = :itemId
        AND e.deleted_at IS NULL
        ORDER BY e.episode_number DESC
      `;

      const usage = await sequelize.query(usageQuery, {
        replacements: { itemId: id },
        type: Sequelize.QueryTypes.SELECT,
      });

      // Group by show
      const byShow = usage.reduce((acc, item) => {
        const showId = item.show_id || 'unknown';
        if (!acc[showId]) {
          acc[showId] = {
            showId: item.show_id,
            showName: item.show_title || 'Unknown Show',
            episodes: [],
          };
        }
        acc[showId].episodes.push({
          episodeId: item.episode_id,
          title: item.episode_title,
          episodeNumber: item.episode_number,
          scene: item.scene,
          wornAt: item.worn_at,
          notes: item.notes,
          isFavorite: item.is_episode_favorite,
          linkedAt: item.linked_at,
        });
        return acc;
      }, {});

      // Calculate summary stats
      const uniqueShows = new Set(usage.map(u => u.show_id).filter(Boolean));
      const episodeFavoriteCount = usage.filter(u => u.is_episode_favorite).length;

      res.json({
        success: true,
        data: {
          item: wardrobeItem,
          totalEpisodes: usage.length,
          totalShows: uniqueShows.size,
          episodeFavoriteCount,
          shows: Object.values(byShow),
        },
      });
    } catch (error) {
      console.error('❌ Error fetching item usage:', error);
      res.status(500).json({
        error: 'Failed to fetch item usage',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wardrobe/:id/upscale - AI upscale wardrobe image using Real-ESRGAN
   */
  async aiUpscaleItem(req, res) {
    try {
      const { id } = req.params;
      const { scale = 4, faceEnhance = false } = req.body;

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
          error: 'No image to upscale',
        });
      }

      if (!process.env.REPLICATE_API_TOKEN) {
        return res.status(500).json({
          error: 'AI upscaling not configured',
          message: 'REPLICATE_API_TOKEN is required',
        });
      }

      console.log(`🔍 Starting ${scale}x AI upscale for wardrobe item ${id}...`);

      // Run AI upscaling
      const upscaleResult = await wardrobeImageService.aiUpscaleImage(
        wardrobeItem.s3_url,
        { scale, faceEnhance }
      );

      // Upload upscaled image to S3
      const uploaded = await wardrobeImageService.uploadWardrobeImage(
        upscaleResult.buffer,
        wardrobeItem.character || 'unknown',
        '-upscaled',
        upscaleResult.contentType
      );

      // Update the wardrobe item with the upscaled URL
      // Store in a new field or update the main image based on preference
      await wardrobeItem.update({
        s3_url: uploaded.s3Url, // Replace main image with upscaled version
        s3_key: uploaded.s3Key,
      });

      // Regenerate thumbnail from upscaled image
      const thumbnail = await wardrobeImageService.generateThumbnail(upscaleResult.buffer);
      const thumbUploaded = await wardrobeImageService.uploadWardrobeImage(
        thumbnail.buffer,
        wardrobeItem.character || 'unknown',
        '-thumb',
        thumbnail.contentType
      );

      await wardrobeItem.update({
        thumbnail_url: thumbUploaded.s3Url,
      });

      console.log(`✅ AI upscale complete for wardrobe item ${id}`);

      res.json({
        success: true,
        data: {
          id: wardrobeItem.id,
          s3_url: uploaded.s3Url,
          thumbnail_url: thumbUploaded.s3Url,
          upscaleMetadata: {
            scale,
            originalWidth: upscaleResult.metadata.width / scale,
            originalHeight: upscaleResult.metadata.height / scale,
            newWidth: upscaleResult.metadata.width,
            newHeight: upscaleResult.metadata.height,
          },
        },
        message: `Image upscaled ${scale}x successfully`,
      });
    } catch (error) {
      console.error('❌ Error upscaling wardrobe item:', error);
      res.status(500).json({
        error: 'Failed to upscale image',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wardrobe/:id/regenerate-thumbnail - Regenerate thumbnail for existing item
   */
  async regenerateThumbnail(req, res) {
    try {
      const { id } = req.params;
      const { size = 300 } = req.body;

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
          error: 'No image to generate thumbnail from',
        });
      }

      console.log(`🖼️ Regenerating thumbnail for wardrobe item ${id}...`);

      // Download the source image
      const axios = require('axios');
      const response = await axios.get(wardrobeItem.s3_url, { responseType: 'arraybuffer', timeout: 60000 });
      const imageBuffer = Buffer.from(response.data);

      // Generate thumbnail
      const thumbnail = await wardrobeImageService.generateThumbnail(imageBuffer, { size });
      const uploaded = await wardrobeImageService.uploadWardrobeImage(
        thumbnail.buffer,
        wardrobeItem.character || 'unknown',
        '-thumb',
        thumbnail.contentType
      );

      await wardrobeItem.update({
        thumbnail_url: uploaded.s3Url,
      });

      console.log(`✅ Thumbnail regenerated for wardrobe item ${id}`);

      res.json({
        success: true,
        data: {
          id: wardrobeItem.id,
          thumbnail_url: uploaded.s3Url,
        },
        message: 'Thumbnail regenerated successfully',
      });
    } catch (error) {
      console.error('❌ Error regenerating thumbnail:', error);
      res.status(500).json({
        error: 'Failed to regenerate thumbnail',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wardrobe/:id/premium-enhance - Apply full premium enhancement pipeline
   */
  async premiumEnhance(req, res) {
    try {
      const { id } = req.params;
      const { skipColorNorm, skipTexture, skipCenter, skipShadow, skipThumbnail } = req.body;

      const wardrobeItem = await Wardrobe.findOne({
        where: { id, deleted_at: null },
      });

      if (!wardrobeItem) {
        return res.status(404).json({ error: 'Wardrobe item not found' });
      }

      if (!wardrobeItem.s3_url) {
        return res.status(400).json({ error: 'No image to enhance' });
      }

      console.log(`✨ Starting premium enhancement for wardrobe item ${id}...`);

      // Download the source image
      const axios = require('axios');
      const response = await axios.get(wardrobeItem.s3_url, { responseType: 'arraybuffer', timeout: 60000 });
      const imageBuffer = Buffer.from(response.data);

      // Run premium pipeline
      const result = await wardrobeImageService.premiumEnhance(
        imageBuffer,
        wardrobeItem.character || 'unknown',
        { skipColorNorm, skipTexture, skipCenter, skipShadow, skipThumbnail }
      );

      // Update the wardrobe item
      await wardrobeItem.update({
        s3_url: result.mainImage.s3Url,
        s3_key: result.mainImage.s3Key,
        thumbnail_url: result.thumbnail?.s3Url || wardrobeItem.thumbnail_url,
      });

      console.log(`✅ Premium enhancement complete for wardrobe item ${id}`);

      res.json({
        success: true,
        data: {
          id: wardrobeItem.id,
          s3_url: result.mainImage.s3Url,
          thumbnail_url: result.thumbnail?.s3Url,
          processing: result.processing,
        },
        message: `Premium enhancement complete (${result.processing.steps.length} steps applied)`,
      });
    } catch (error) {
      console.error('❌ Error in premium enhancement:', error);
      res.status(500).json({
        error: 'Failed to enhance image',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wardrobe/:id/add-shadow - Add drop shadow to transparent PNG
   */
  async addDropShadow(req, res) {
    try {
      const { id } = req.params;
      const { shadowOffsetX, shadowOffsetY, shadowBlur, shadowOpacity } = req.body;

      const wardrobeItem = await Wardrobe.findOne({
        where: { id, deleted_at: null },
      });

      if (!wardrobeItem) {
        return res.status(404).json({ error: 'Wardrobe item not found' });
      }

      const imageUrl = wardrobeItem.s3_url_processed || wardrobeItem.s3_url;
      if (!imageUrl) {
        return res.status(400).json({ error: 'No image to process' });
      }

      console.log(`🌑 Adding drop shadow to wardrobe item ${id}...`);

      const axios = require('axios');
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 60000 });
      const imageBuffer = Buffer.from(response.data);

      const result = await wardrobeImageService.addDropShadow(imageBuffer, {
        shadowOffsetX, shadowOffsetY, shadowBlur, shadowOpacity,
      });

      if (result.skipped) {
        return res.status(400).json({
          error: 'Image has no transparency',
          message: 'Drop shadows can only be added to PNG images with alpha channel',
        });
      }

      const uploaded = await wardrobeImageService.uploadWardrobeImage(
        result.buffer,
        wardrobeItem.character || 'unknown',
        '-shadow',
        result.contentType
      );

      // Store as the processed version
      await wardrobeItem.update({
        s3_url_processed: uploaded.s3Url,
        s3_key_processed: uploaded.s3Key,
      });

      res.json({
        success: true,
        data: {
          id: wardrobeItem.id,
          s3_url_processed: uploaded.s3Url,
        },
        message: 'Drop shadow added successfully',
      });
    } catch (error) {
      console.error('❌ Error adding drop shadow:', error);
      res.status(500).json({
        error: 'Failed to add drop shadow',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wardrobe/:id/analyze - AI analysis (colors + tags) using Claude Vision
   */
  async analyzeItem(req, res) {
    try {
      const { id } = req.params;
      const { autoApply = false } = req.body;

      const wardrobeItem = await Wardrobe.findOne({
        where: { id, deleted_at: null },
      });

      if (!wardrobeItem) {
        return res.status(404).json({ error: 'Wardrobe item not found' });
      }

      if (!wardrobeItem.s3_url) {
        return res.status(400).json({ error: 'No image to analyze' });
      }

      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({
          error: 'AI analysis not configured',
          message: 'ANTHROPIC_API_KEY is required',
        });
      }

      console.log(`🔍 Running AI analysis for wardrobe item ${id}...`);

      const analysis = await wardrobeImageService.analyzeImage(wardrobeItem.s3_url);

      // Optionally auto-apply the results
      if (autoApply) {
        const updates = {};
        if (analysis.primaryColor) updates.color = analysis.primaryColor;
        if (analysis.category) updates.clothing_category = analysis.category;
        if (analysis.allTags?.length) {
          updates.tags = [...new Set([...(wardrobeItem.tags || []), ...analysis.allTags])];
        }
        if (analysis.suggestedName && !wardrobeItem.name) {
          updates.name = analysis.suggestedName;
        }

        if (Object.keys(updates).length > 0) {
          await wardrobeItem.update(updates);
          console.log(`✅ Auto-applied ${Object.keys(updates).length} fields from AI analysis`);
        }
      }

      res.json({
        success: true,
        data: {
          id: wardrobeItem.id,
          analysis,
          autoApplied: autoApply,
        },
        message: 'AI analysis complete',
      });
    } catch (error) {
      console.error('❌ Error in AI analysis:', error);
      res.status(500).json({
        error: 'Failed to analyze image',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wardrobe/bulk/enhance - Bulk enhance multiple wardrobe items
   */
  async bulkEnhance(req, res) {
    try {
      const { itemIds, options = {} } = req.body;

      if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ error: 'itemIds array is required' });
      }

      if (itemIds.length > 20) {
        return res.status(400).json({ error: 'Maximum 20 items per bulk operation' });
      }

      console.log(`📦 Starting bulk enhance for ${itemIds.length} items...`);

      const results = { succeeded: [], failed: [] };
      const axios = require('axios');

      for (const id of itemIds) {
        try {
          const wardrobeItem = await Wardrobe.findOne({
            where: { id, deleted_at: null },
          });

          if (!wardrobeItem || !wardrobeItem.s3_url) {
            results.failed.push({ id, error: 'Item not found or has no image' });
            continue;
          }

          const response = await axios.get(wardrobeItem.s3_url, { responseType: 'arraybuffer', timeout: 60000 });
          const imageBuffer = Buffer.from(response.data);

          const enhanced = await wardrobeImageService.sharpEnhanceWardrobe(imageBuffer);
          const uploaded = await wardrobeImageService.uploadWardrobeImage(
            enhanced.buffer,
            wardrobeItem.character || 'unknown',
            '-enhanced',
            enhanced.contentType
          );

          // Generate new thumbnail
          const thumbnail = await wardrobeImageService.generateThumbnail(enhanced.buffer);
          const thumbUploaded = await wardrobeImageService.uploadWardrobeImage(
            thumbnail.buffer,
            wardrobeItem.character || 'unknown',
            '-thumb',
            thumbnail.contentType
          );

          await wardrobeItem.update({
            s3_url: uploaded.s3Url,
            s3_key: uploaded.s3Key,
            thumbnail_url: thumbUploaded.s3Url,
          });

          results.succeeded.push({ id, s3_url: uploaded.s3Url });
        } catch (itemError) {
          results.failed.push({ id, error: itemError.message });
        }
      }

      console.log(`✅ Bulk enhance complete: ${results.succeeded.length} succeeded, ${results.failed.length} failed`);

      res.json({
        success: true,
        data: results,
        message: `Enhanced ${results.succeeded.length} of ${itemIds.length} items`,
      });
    } catch (error) {
      console.error('❌ Error in bulk enhance:', error);
      res.status(500).json({
        error: 'Failed to bulk enhance',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wardrobe/bulk/upscale - Bulk AI upscale multiple wardrobe items
   */
  async bulkUpscale(req, res) {
    try {
      const { itemIds, scale = 4 } = req.body;

      if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ error: 'itemIds array is required' });
      }

      if (itemIds.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 items per bulk upscale (API cost control)' });
      }

      if (!process.env.REPLICATE_API_TOKEN) {
        return res.status(500).json({
          error: 'AI upscaling not configured',
          message: 'REPLICATE_API_TOKEN is required',
        });
      }

      console.log(`🔍 Starting bulk ${scale}x upscale for ${itemIds.length} items...`);

      const results = { succeeded: [], failed: [] };

      for (const id of itemIds) {
        try {
          const wardrobeItem = await Wardrobe.findOne({
            where: { id, deleted_at: null },
          });

          if (!wardrobeItem || !wardrobeItem.s3_url) {
            results.failed.push({ id, error: 'Item not found or has no image' });
            continue;
          }

          const upscaleResult = await wardrobeImageService.aiUpscaleImage(wardrobeItem.s3_url, { scale });

          const uploaded = await wardrobeImageService.uploadWardrobeImage(
            upscaleResult.buffer,
            wardrobeItem.character || 'unknown',
            '-upscaled',
            upscaleResult.contentType
          );

          // Generate new thumbnail from upscaled
          const thumbnail = await wardrobeImageService.generateThumbnail(upscaleResult.buffer);
          const thumbUploaded = await wardrobeImageService.uploadWardrobeImage(
            thumbnail.buffer,
            wardrobeItem.character || 'unknown',
            '-thumb',
            thumbnail.contentType
          );

          await wardrobeItem.update({
            s3_url: uploaded.s3Url,
            s3_key: uploaded.s3Key,
            thumbnail_url: thumbUploaded.s3Url,
          });

          results.succeeded.push({ id, s3_url: uploaded.s3Url });
        } catch (itemError) {
          results.failed.push({ id, error: itemError.message });
        }
      }

      console.log(`✅ Bulk upscale complete: ${results.succeeded.length} succeeded, ${results.failed.length} failed`);

      res.json({
        success: true,
        data: results,
        message: `Upscaled ${results.succeeded.length} of ${itemIds.length} items`,
      });
    } catch (error) {
      console.error('❌ Error in bulk upscale:', error);
      res.status(500).json({
        error: 'Failed to bulk upscale',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wardrobe/bulk/analyze - Bulk AI analysis for multiple items
   */
  async bulkAnalyze(req, res) {
    try {
      const { itemIds, autoApply = false } = req.body;

      if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ error: 'itemIds array is required' });
      }

      if (itemIds.length > 20) {
        return res.status(400).json({ error: 'Maximum 20 items per bulk analysis' });
      }

      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({
          error: 'AI analysis not configured',
          message: 'ANTHROPIC_API_KEY is required',
        });
      }

      console.log(`🔍 Starting bulk AI analysis for ${itemIds.length} items...`);

      const results = { succeeded: [], failed: [] };

      for (const id of itemIds) {
        try {
          const wardrobeItem = await Wardrobe.findOne({
            where: { id, deleted_at: null },
          });

          if (!wardrobeItem || !wardrobeItem.s3_url) {
            results.failed.push({ id, error: 'Item not found or has no image' });
            continue;
          }

          const analysis = await wardrobeImageService.analyzeImage(wardrobeItem.s3_url);

          if (autoApply) {
            const updates = {};
            if (analysis.primaryColor) updates.color = analysis.primaryColor;
            if (analysis.category) updates.clothing_category = analysis.category;
            if (analysis.allTags?.length) {
              updates.tags = [...new Set([...(wardrobeItem.tags || []), ...analysis.allTags])];
            }

            if (Object.keys(updates).length > 0) {
              await wardrobeItem.update(updates);
            }
          }

          results.succeeded.push({ id, analysis, autoApplied: autoApply });
        } catch (itemError) {
          results.failed.push({ id, error: itemError.message });
        }
      }

      console.log(`✅ Bulk analysis complete: ${results.succeeded.length} succeeded, ${results.failed.length} failed`);

      res.json({
        success: true,
        data: results,
        message: `Analyzed ${results.succeeded.length} of ${itemIds.length} items`,
      });
    } catch (error) {
      console.error('❌ Error in bulk analysis:', error);
      res.status(500).json({
        error: 'Failed to bulk analyze',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wardrobe/bulk/regenerate-thumbnails - Regenerate thumbnails for all items missing them
   */
  async bulkRegenerateThumbnails(req, res) {
    try {
      const { limit = 50 } = req.body;

      // Find items without thumbnails
      const items = await Wardrobe.findAll({
        where: {
          deleted_at: null,
          s3_url: { [Op.ne]: null },
          [Op.or]: [
            { thumbnail_url: null },
            { thumbnail_url: '' },
          ],
        },
        limit: Math.min(limit, 100),
        order: [['created_at', 'DESC']],
      });

      if (items.length === 0) {
        return res.json({
          success: true,
          data: { processed: 0 },
          message: 'No items need thumbnail regeneration',
        });
      }

      console.log(`🖼️ Regenerating thumbnails for ${items.length} items...`);

      const axios = require('axios');
      const results = { succeeded: [], failed: [] };

      for (const item of items) {
        try {
          const response = await axios.get(item.s3_url, { responseType: 'arraybuffer', timeout: 60000 });
          const imageBuffer = Buffer.from(response.data);

          const thumbnail = await wardrobeImageService.generateThumbnail(imageBuffer);
          const uploaded = await wardrobeImageService.uploadWardrobeImage(
            thumbnail.buffer,
            item.character || 'unknown',
            '-thumb',
            thumbnail.contentType
          );

          await item.update({ thumbnail_url: uploaded.s3Url });
          results.succeeded.push(item.id);
        } catch (itemError) {
          results.failed.push({ id: item.id, error: itemError.message });
        }
      }

      console.log(`✅ Bulk thumbnail regeneration complete: ${results.succeeded.length} succeeded`);

      res.json({
        success: true,
        data: {
          processed: results.succeeded.length,
          failed: results.failed.length,
          failedItems: results.failed,
        },
        message: `Regenerated ${results.succeeded.length} thumbnails`,
      });
    } catch (error) {
      console.error('❌ Error in bulk thumbnail regeneration:', error);
      res.status(500).json({
        error: 'Failed to regenerate thumbnails',
        message: error.message,
      });
    }
  },
};

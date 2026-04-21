const express = require('express');
const router = express.Router();
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

// Lazy load Show model to avoid circular dependencies
let Show = null;
const getShow = () => {
  if (!Show) {
    const models = require('../models');
    Show = models.Show;
  }
  return Show;
};

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images allowed'));
    }
  },
});

// Configure S3 client
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

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'episode-metadata-assets-dev';

/**
 * POST /api/v1/shows/:id/cover-image
 * Upload cover image for a show (portrait 2:3 ratio)
 */
router.post('/:id/cover-image', upload.single('image'), async (req, res) => {
  try {
    const Show = getShow();
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const show = await Show.findByPk(id);
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    // Process image: resize to portrait format (2:3 ratio) and optimize
    const processedImage = await sharp(file.buffer)
      .resize(800, 1200, {
        // 2:3 ratio (portrait like Netflix)
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Upload to S3
    const fileExt = 'jpg';
    const s3Key = `shows/covers/${id}-${Date.now()}.${fileExt}`;

    const s3 = getS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: processedImage,
        ContentType: 'image/jpeg',
      })
    );

    // Construct public URL
    const coverImageUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;

    // Update show with new cover image
    await show.update({
      coverImageUrl,
      coverS3Key: s3Key,
    });

    res.json({
      status: 'SUCCESS',
      data: {
        show,
        coverImageUrl,
      },
      message: 'Cover image uploaded successfully',
    });
  } catch (error) {
    console.error('Failed to upload cover image:', error);
    res.status(500).json({
      error: 'Failed to upload cover image',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/shows
 * Get all shows
 */
router.get('/', async (req, res) => {
  try {
    const Show = getShow();

    if (!Show) {
      console.error('GET /shows — Show model is not available');
      return res.status(503).json({ error: 'Show model not loaded', message: 'Database models are still initializing' });
    }

    // Helper: timeout a promise after N ms
    const withTimeout = (promise, ms) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Query timeout after ${ms}ms`)), ms)),
    ]);

    let shows;

    // Primary: Sequelize model query (10s timeout)
    try {
      shows = await withTimeout(Show.findAll({ order: [['name', 'ASC']] }), 10000);
    } catch (modelErr) {
      console.error('GET /shows — Sequelize findAll failed, trying raw SQL fallback:', modelErr.message);
      // Fallback: raw SQL (10s timeout)
      try {
        const sequelize = Show.sequelize || require('../models').sequelize;
        shows = await withTimeout(
          sequelize.query('SELECT * FROM shows WHERE deleted_at IS NULL ORDER BY name ASC', { type: sequelize.QueryTypes.SELECT }),
          10000
        );
      } catch (rawErr) {
        console.error('GET /shows — Raw SQL fallback also failed:', rawErr.message);
        // Return empty instead of hanging
        return res.json({ status: 'SUCCESS', data: [], count: 0, note: 'Database query failed: ' + rawErr.message });
      }
    }

    // Attach episode counts via a separate lightweight query
    if (shows && shows.length > 0) {
      try {
        const { Episode } = require('../models');
        const { fn, col } = require('sequelize');
        const counts = await Episode.findAll({
          attributes: ['show_id', [fn('COUNT', col('id')), 'episodeCount']],
          where: { show_id: shows.map(s => s.id || s.dataValues?.id) },
          group: ['show_id'],
          raw: true,
        });
        const countMap = {};
        counts.forEach(c => { countMap[c.show_id] = parseInt(c.episodeCount); });
        shows.forEach(s => {
          if (s.dataValues) {
            s.dataValues.episodeCount = countMap[s.id] || 0;
          } else {
            s.episodeCount = countMap[s.id] || 0;
          }
        });
      } catch (countErr) {
        console.warn('Failed to count episodes for shows:', countErr.message);
        // Still return shows even if episode counts fail
        shows.forEach(s => {
          if (s.dataValues) {
            s.dataValues.episodeCount = 0;
          } else {
            s.episodeCount = 0;
          }
        });
      }
    }

    console.log(`GET /shows — returning ${(shows || []).length} shows`);
    res.json({
      status: 'SUCCESS',
      data: shows || [],
      count: (shows || []).length,
    });
  } catch (error) {
    console.error('Failed to get shows:', error);
    res.status(500).json({
      error: 'Failed to get shows',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/shows/:id
 * Get a single show by ID
 * Falls back to auto-creating a minimal show record if episodes exist for this show_id
 * Includes raw SQL fallback if Sequelize model query fails
 */
router.get('/:id', async (req, res) => {
  try {
    const Show = getShow();
    const { id } = req.params;

    if (!Show) {
      console.error('GET /shows/:id — Show model is not available');
      return res.status(503).json({ error: 'Show model not loaded', message: 'Database models are still initializing' });
    }

    let show = null;

    // Primary: use Sequelize model
    try {
      show = await Show.findByPk(id);
    } catch (modelErr) {
      console.error('GET /shows/:id — Sequelize findByPk failed, trying raw SQL fallback:', modelErr.message);
      // Fallback: raw SQL in case the model has column mismatch with DB
      try {
        const sequelize = Show.sequelize || require('../models').sequelize;
        const [rows] = await sequelize.query(
          'SELECT * FROM shows WHERE id = :id AND deleted_at IS NULL LIMIT 1',
          { replacements: { id }, type: sequelize.QueryTypes.SELECT }
        );
        show = rows || null;
      } catch (rawErr) {
        console.error('GET /shows/:id — Raw SQL fallback also failed:', rawErr.message);
      }
    }

    // If no show record but episodes reference this show_id, auto-create a minimal record
    if (!show) {
      try {
        const { Episode, sequelize } = require('../models');
        const episodeCount = await Episode.count({ where: { show_id: id } });
        if (episodeCount > 0) {
          try {
            show = await Show.create({ id, name: 'Untitled Show', slug: `show-${id.slice(0, 8)}`, status: 'in_development' });
          } catch (createErr) {
            console.error('GET /shows/:id — Show.create failed, trying raw INSERT:', createErr.message);
            // Raw SQL fallback for create
            const seq = Show.sequelize || sequelize;
            const slug = `show-${id.slice(0, 8)}`;
            await seq.query(
              `INSERT INTO shows (id, name, slug, status, is_active, created_at, updated_at)
               VALUES (:id, 'Untitled Show', :slug, 'in_development', true, NOW(), NOW())
               ON CONFLICT (id) DO NOTHING`,
              { replacements: { id, slug } }
            );
            const [rows] = await seq.query(
              'SELECT * FROM shows WHERE id = :id LIMIT 1',
              { replacements: { id }, type: seq.QueryTypes.SELECT }
            );
            show = rows || null;
          }
        }
      } catch (epErr) {
        console.error('GET /shows/:id — Episode count / auto-create failed:', epErr.message);
      }
    }

    if (!show) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Show not found',
      });
    }

    res.json({
      status: 'SUCCESS',
      data: show,
    });
  } catch (error) {
    console.error('Failed to get show:', error);
    res.status(500).json({
      error: 'Failed to get show',
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    });
  }
});

/**
 * POST /api/v1/shows
 * Create a new show
 */
router.post('/', async (req, res) => {
  try {
    const Show = getShow();
    const { name, description, icon, color, status, coverImageUrl, genre, metadata, tagline } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        error: 'Show name is required',
        message: 'Please provide a name for the show.',
      });
    }

    const trimmedName = name.trim();
    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const { Op } = require('sequelize');
    const sequelize = Show.sequelize;

    // Case-insensitive check for existing active show with same name or slug
    const existingActive = await Show.findOne({
      where: {
        [Op.or]: [
          sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), trimmedName.toLowerCase()),
          { slug },
        ],
      },
    });
    if (existingActive) {
      return res.status(409).json({
        error: 'A show with this name already exists',
        message: `A show named "${existingActive.name}" already exists. Please choose a different name.`,
        existingId: existingActive.id,
      });
    }

    // If a soft-deleted show with the same name/slug exists, hard-delete it first
    const existingSoftDeleted = await Show.findOne({
      where: {
        [Op.or]: [
          sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), trimmedName.toLowerCase()),
          { slug },
        ],
      },
      paranoid: false, // include soft-deleted
    });
    if (existingSoftDeleted && existingSoftDeleted.deletedAt) {
      await existingSoftDeleted.destroy({ force: true }); // hard delete
    }

    // Merge tagline into metadata if sent as top-level field
    const mergedMetadata = { ...(metadata || {}), ...(tagline ? { tagline } : {}) };

    const show = await Show.create({
      name: trimmedName,
      slug,
      description,
      icon,
      color,
      genre,
      status,
      coverImageUrl,
      metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
    });

    res.status(201).json({
      status: 'SUCCESS',
      data: show,
    });
  } catch (error) {
    console.error('Failed to create show:', error);

    // Handle unique constraint violations (check multiple error indicators)
    const isUniqueError =
      error.name === 'SequelizeUniqueConstraintError' ||
      (error.parent && error.parent.code === '23505') ||
      (error.original && error.original.code === '23505') ||
      (error.message && error.message.includes('Validation error') && error.errors?.length > 0);

    if (isUniqueError) {
      return res.status(409).json({
        error: 'A show with this name already exists',
        message: 'Please choose a different name for your show.',
      });
    }

    res.status(500).json({
      error: 'Failed to create show',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/shows/:id/financial-config
 * Returns the show's starting balance + financial goals ladder (with
 * triggered_at timestamps) alongside the current live balance. Frontend
 * uses this to render the milestones widget + progress bar.
 */
router.get('/:id/financial-config', async (req, res) => {
  try {
    const Show = getShow();
    const show = await Show.findByPk(req.params.id);
    if (!show) return res.status(404).json({ error: 'Show not found' });
    const {
      getCurrentBalance, getStartingBalance, getFinancialGoals,
    } = require('../services/financialTransactionService');
    const sequelize = Show.sequelize;
    const [startingBalance, goals, currentBalance] = await Promise.all([
      getStartingBalance(sequelize, show.id),
      getFinancialGoals(sequelize, show.id),
      getCurrentBalance(sequelize, show.id),
    ]);
    // Next goal = lowest not-yet-triggered goal (sorted by threshold). Null
    // if every goal is already triggered (Lala has reached Legacy status).
    const sortedGoals = [...goals].sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
    const nextGoal = sortedGoals.find(g => !g.triggered_at) || null;
    return res.json({
      success: true,
      starting_balance: startingBalance,
      current_balance: currentBalance,
      goals: sortedGoals,
      next_goal: nextGoal,
      progress_to_next: nextGoal ? Math.max(0, Math.min(1, currentBalance / nextGoal.threshold)) : 1,
    });
  } catch (err) {
    console.error('GET /shows/:id/financial-config error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/v1/shows/:id/financial-config
 * Body: { starting_balance?: number, financial_goals?: [{ id, threshold, reward_coins, label, description }] }
 * Persists onto Show.metadata. Non-destructive: preserves other metadata keys.
 * After updating starting_balance, call the seed endpoint to write the tx.
 */
router.put('/:id/financial-config', async (req, res) => {
  try {
    const Show = getShow();
    const show = await Show.findByPk(req.params.id);
    if (!show) return res.status(404).json({ error: 'Show not found' });
    const { starting_balance, financial_goals } = req.body || {};
    if (starting_balance !== undefined && (!Number.isFinite(Number(starting_balance)) || Number(starting_balance) < 0)) {
      return res.status(400).json({ error: 'starting_balance must be a non-negative number' });
    }
    if (financial_goals !== undefined && !Array.isArray(financial_goals)) {
      return res.status(400).json({ error: 'financial_goals must be an array' });
    }
    const nextMeta = { ...(show.metadata || {}) };
    if (starting_balance !== undefined) nextMeta.starting_balance = Number(starting_balance);
    if (financial_goals !== undefined) nextMeta.financial_goals = financial_goals;
    await show.update({ metadata: nextMeta });
    return res.json({ success: true, metadata: nextMeta });
  } catch (err) {
    console.error('PUT /shows/:id/financial-config error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/shows/:id/seed-balance
 * Idempotent: writes a single 'seed' transaction granting the starting
 * balance if one doesn't already exist. Safe to call multiple times — it
 * won't duplicate the seed. Called automatically from the frontend when
 * the finance widget first loads on an empty ledger.
 *
 * Body: { force?: boolean } — when true, deletes the existing seed row
 * (if any) and writes a fresh one with the current starting_balance. Use
 * this after changing the starting balance via PUT /financial-config so
 * the ledger reflects the new amount. Non-seed transactions are left
 * untouched, so history from prior play sessions is preserved.
 */
router.post('/:id/seed-balance', async (req, res) => {
  try {
    const Show = getShow();
    const show = await Show.findByPk(req.params.id);
    if (!show) return res.status(404).json({ error: 'Show not found' });
    const force = req.body?.force === true;
    const sequelize = Show.sequelize;
    if (force) {
      // Soft-delete any existing seed transactions so getCurrentBalance
      // doesn't double-count. Uses the same deleted_at convention the
      // rest of the codebase relies on for paranoid mode.
      try {
        await sequelize.query(
          `UPDATE financial_transactions
           SET deleted_at = NOW()
           WHERE show_id = :showId AND category = 'seed' AND deleted_at IS NULL`,
          { replacements: { showId: show.id } }
        );
      } catch { /* non-blocking */ }
    }
    const { seedStartingBalance } = require('../services/financialTransactionService');
    const result = await seedStartingBalance(sequelize, show.id);
    return res.json({ success: true, forced: !!force, ...result });
  } catch (err) {
    console.error('POST /shows/:id/seed-balance error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/v1/shows/:id/wardrobe-config
 * Persist show-level wardrobe settings onto Show.metadata.
 * Body: { required_slots: ['outfit','shoes','jewelry','accessories','fragrance'] }
 * The outfit scorer (wardrobeIntelligenceService.scoreOutfitForEvent) reads
 * this via worldEvents.js to mark missing slots as required. Non-destructive:
 * preserves any other metadata keys the show already has.
 */
router.put('/:id/wardrobe-config', async (req, res) => {
  try {
    const Show = getShow();
    const { id } = req.params;
    const show = await Show.findByPk(id);
    if (!show) return res.status(404).json({ error: 'Show not found' });
    const { required_slots } = req.body || {};
    if (required_slots !== undefined && !Array.isArray(required_slots)) {
      return res.status(400).json({ error: 'required_slots must be an array' });
    }
    const nextMeta = { ...(show.metadata || {}) };
    if (required_slots !== undefined) nextMeta.required_slots = required_slots;
    await show.update({ metadata: nextMeta });
    return res.json({ success: true, metadata: nextMeta });
  } catch (err) {
    console.error('PUT /shows/:id/wardrobe-config error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/v1/shows/:id
 * Update a show
 */
router.put('/:id', async (req, res) => {
  try {
    const Show = getShow();
    const { id } = req.params;
    const updates = req.body;

    const show = await Show.findByPk(id);
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    await show.update(updates);

    res.json({
      status: 'SUCCESS',
      data: show,
    });
  } catch (error) {
    console.error('Failed to update show:', error);
    res.status(500).json({
      error: 'Failed to update show',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/v1/shows/:id
 * Delete a show
 */
router.delete('/:id', async (req, res) => {
  try {
    const Show = getShow();
    const { id } = req.params;

    const show = await Show.findByPk(id);
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    await show.destroy();

    res.json({
      status: 'SUCCESS',
      message: 'Show deleted',
    });
  } catch (error) {
    console.error('Failed to delete show:', error);
    res.status(500).json({
      error: 'Failed to delete show',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/shows/:id/config
 * Get show configuration (for script generator)
 */
router.get('/:id/config', async (req, res) => {
  try {
    const Show = getShow();
    const { id } = req.params;

    const show = await Show.findByPk(id);
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    // Return show configuration for script generator
    res.json({
      status: 'SUCCESS',
      data: {
        showId: show.id,
        showName: show.name,
        description: show.description,
        icon: show.icon,
        color: show.color,
        status: show.status,
        // Configuration fields for script generation
        format: show.format || 'interview',
        targetDuration: show.targetDuration || 300, // 5 minutes default
        niche_category: show.niche_category || 'general',
        toneOfVoice: show.toneOfVoice || 'professional',
        createdAt: show.createdAt,
        updatedAt: show.updatedAt,
      },
    });
  } catch (error) {
    console.error('Failed to get show config:', error);
    res.status(500).json({
      error: 'Failed to get show config',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/shows/:id/template
 * Get default script template for a show
 */
router.get('/:id/template', async (req, res) => {
  try {
    const Show = getShow();
    const { id } = req.params;

    const show = await Show.findByPk(id);
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    // Return default template with variables
    const template = {
      id: 'default-interview',
      name: 'Default Interview Template',
      description: 'Flexible interview template with customizable variables',
      structure: ['intro', 'questions', 'outro'],
      variables: [
        {
          key: 'opening_line',
          label: 'Opening Line',
          description: 'How to start the episode',
          type: 'text',
          required: true,
          examples: [
            'Welcome to Styling Adventures!',
            'Hey fashion lovers, let\'s style together!',
            'Today we\'re creating the perfect outfit!'
          ]
        },
        {
          key: 'main_topic',
          label: 'Main Topic',
          description: 'What is this episode about?',
          type: 'text',
          required: true,
          examples: [
            'Building a professional wardrobe',
            'Casual weekend styling',
            'Fashion on a budget'
          ]
        },
        {
          key: 'key_points',
          label: 'Key Points to Cover',
          description: 'Main points to discuss (comma-separated)',
          type: 'text',
          required: true,
          examples: [
            'Color theory, fabric quality, seasonal trends',
            'Comfort, practicality, personal style',
            'Smart shopping, timeless pieces'
          ]
        },
        {
          key: 'closing_message',
          label: 'Closing Message',
          description: 'How to wrap up the episode',
          type: 'text',
          required: true,
          examples: [
            'Remember, fashion is about expressing yourself!',
            'Keep styling and stay fabulous!',
            'Thanks for joining Styling Adventures!'
          ]
        }
      ]
    };

    res.json({
      status: 'SUCCESS',
      data: template
    });
  } catch (error) {
    console.error('Failed to get template:', error);
    res.status(500).json({
      error: 'Failed to get template',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/shows/:id/wardrobe
 * Get all wardrobe items belonging to a show
 */
router.get('/:id/wardrobe', async (req, res) => {
  try {
    const { id } = req.params;
    const { character, category } = req.query;
    const models = require('../models');

    // Build optional filters
    const filters = [];
    const replacements = { show_id: id };

    if (character) {
      filters.push('AND w.character = :character');
      replacements.character = character;
    }
    if (category) {
      filters.push('AND w.clothing_category = :category');
      replacements.category = category;
    }

    const items = await models.sequelize.query(
      `SELECT w.id, w.name, w.character, w.clothing_category,
              w.s3_url, w.s3_url_processed, w.thumbnail_url,
              w.color, w.season, w.tags, w.is_favorite,
              w.description, w.created_at, w.updated_at
       FROM wardrobe w
       WHERE (w.show_id = :show_id OR w.show_id IS NULL)
         AND w.deleted_at IS NULL
         ${filters.join(' ')}
       ORDER BY w.character, w.clothing_category, w.name`,
      {
        replacements,
        type: require('sequelize').QueryTypes.SELECT,
      }
    );

    res.json({
      success: true,
      data: items || [],
      count: (items || []).length,
    });
  } catch (error) {
    console.error('Failed to get show wardrobe:', error);
    res.status(500).json({
      error: 'Failed to get show wardrobe',
      message: error.message,
    });
  }
});

module.exports = router;

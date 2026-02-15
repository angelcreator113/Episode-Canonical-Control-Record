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
        ACL: 'public-read',
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
    const { Episode } = require('../models');
    const { fn, col, literal } = require('sequelize');

    const shows = await Show.findAll({
      attributes: {
        include: [
          [fn('COUNT', col('episodes.id')), 'episodeCount']
        ]
      },
      include: [{
        model: Episode,
        as: 'episodes',
        attributes: [],
        required: false,
      }],
      group: ['Show.id'],
      order: [['name', 'ASC']],
    });

    res.json({
      status: 'SUCCESS',
      data: shows,
      count: shows.length,
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
 */
router.get('/:id', async (req, res) => {
  try {
    const Show = getShow();
    const { id } = req.params;

    const show = await Show.findByPk(id);

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

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // If a soft-deleted show with the same name/slug exists, hard-delete it first
    const existingSoftDeleted = await Show.findOne({
      where: {
        [require('sequelize').Op.or]: [{ name }, { slug }],
      },
      paranoid: false, // include soft-deleted
    });
    if (existingSoftDeleted && existingSoftDeleted.deletedAt) {
      await existingSoftDeleted.destroy({ force: true }); // hard delete
    }

    // Merge tagline into metadata if sent as top-level field
    const mergedMetadata = { ...(metadata || {}), ...(tagline ? { tagline } : {}) };

    const show = await Show.create({
      name,
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
    res.status(500).json({
      error: 'Failed to create show',
      message: error.message,
    });
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
       WHERE w.show_id = :show_id
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

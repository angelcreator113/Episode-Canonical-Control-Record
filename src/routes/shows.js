const express = require('express');
const router = express.Router();
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { Show } = require('../models');

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
    const shows = await Show.findAll({
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
 * POST /api/v1/shows
 * Create a new show
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, icon, color, status, coverImageUrl } = req.body;

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const show = await Show.create({
      name,
      slug,
      description,
      icon,
      color,
      status,
      coverImageUrl,
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

module.exports = router;

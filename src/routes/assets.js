/**
 * Asset Management Routes
 * POST /api/v1/assets/upload - Upload new asset
 * GET /api/v1/assets/approved/:type - Get approved assets by type
 * GET /api/v1/assets/pending - List pending assets
 * GET /api/v1/assets/:id - Get asset by ID
 * PUT /api/v1/assets/:id/approve - Approve asset
 * PUT /api/v1/assets/:id/reject - Reject asset
 * PUT /api/v1/assets/:id/process - Process background removal (Runway ML)
 */

const express = require('express');
const multer = require('multer');
const AssetService = require('../services/AssetService');
const RunwayMLService = require('../services/RunwayMLService');
const { models } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const aws = require('aws-sdk');

const router = express.Router();
const s3 = new aws.S3();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP allowed'));
    }
  },
});

/**
 * GET /api/v1/assets/approved/:type
 * Get approved assets by type
 */
router.get('/approved/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['PROMO_LALA', 'PROMO_GUEST', 'BRAND_LOGO', 'EPISODE_FRAME'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid asset type',
        valid_types: validTypes,
      });
    }

    const assets = await AssetService.getApprovedAssets(type);

    res.json({
      status: 'SUCCESS',
      data: assets,
      count: assets.length,
    });
  } catch (error) {
    console.error('Failed to get approved assets:', error);
    res.status(500).json({
      error: 'Failed to get approved assets',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/assets/pending
 * List pending assets (admin only)
 */
router.get('/pending', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const assets = await AssetService.getPendingAssets();

    res.json({
      status: 'SUCCESS',
      data: assets,
      count: assets.length,
    });
  } catch (error) {
    console.error('Failed to get pending assets:', error);
    res.status(500).json({
      error: 'Failed to get pending assets',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/assets/:id
 * Get asset by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await AssetService.getAsset(id);

    if (!asset) {
      return res.status(404).json({
        error: 'Asset not found',
      });
    }

    res.json({
      status: 'SUCCESS',
      data: asset,
    });
  } catch (error) {
    console.error('Failed to get asset:', error);
    res.status(500).json({
      error: 'Failed to get asset',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/assets/upload
 * Upload new asset
 */
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
      });
    }

    const { assetType, metadata } = req.body;
    const validTypes = ['PROMO_LALA', 'PROMO_GUEST', 'BRAND_LOGO', 'EPISODE_FRAME'];

    if (!assetType || !validTypes.includes(assetType)) {
      return res.status(400).json({
        error: 'Invalid or missing asset type',
        valid_types: validTypes,
      });
    }

    // Upload to S3
    const asset = await AssetService.uploadAsset(
      req.file,
      assetType,
      metadata ? JSON.parse(metadata) : {},
      req.user.id
    );

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Asset uploaded successfully',
      data: asset,
    });
  } catch (error) {
    console.error('Failed to upload asset:', error);
    res.status(500).json({
      error: 'Failed to upload asset',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v1/assets/:id/approve
 * Approve asset (admin only)
 */
router.put('/:id/approve', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await AssetService.approveAsset(id);

    if (!asset) {
      return res.status(404).json({
        error: 'Asset not found',
      });
    }

    res.json({
      status: 'SUCCESS',
      message: 'Asset approved',
      data: asset,
    });
  } catch (error) {
    console.error('Failed to approve asset:', error);
    res.status(500).json({
      error: 'Failed to approve asset',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v1/assets/:id/reject
 * Reject asset (admin only)
 */
router.put('/:id/reject', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const asset = await AssetService.rejectAsset(id, reason);

    if (!asset) {
      return res.status(404).json({
        error: 'Asset not found',
      });
    }

    res.json({
      status: 'SUCCESS',
      message: 'Asset rejected',
      data: asset,
    });
  } catch (error) {
    console.error('Failed to reject asset:', error);
    res.status(500).json({
      error: 'Failed to reject asset',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v1/assets/:id/process
 * Process asset background removal using Runway ML (admin only)
 */
router.put('/:id/process', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    // Get asset
    const asset = await AssetService.getAsset(id);
    if (!asset) {
      return res.status(404).json({
        error: 'Asset not found',
      });
    }

    // Download raw image from S3
    console.log(`📥 Downloading raw asset from S3: ${asset.s3_key_raw}`);
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: asset.s3_key_raw,
    };
    const rawImageBuffer = (await s3.getObject(params).promise()).Body;

    // Process with Runway ML
    console.log(`🎨 Processing asset with Runway ML...`);
    const processedBuffer = await RunwayMLService.processWithFallback(rawImageBuffer);

    // Upload processed image to S3
    const processedKey = asset.s3_key_raw.replace('/raw/', '/processed/');
    console.log(`📤 Uploading processed asset to S3: ${processedKey}`);
    await s3
      .putObject({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: processedKey,
        Body: processedBuffer,
        ContentType: 'image/png',
      })
      .promise();

    // Update asset with processed key and approve it
    const updatedAsset = await models.Asset.update(
      {
        s3_key_processed: processedKey,
        approval_status: 'APPROVED',
      },
      { where: { id }, returning: true }
    );

    console.log(`✅ Asset processed and approved: ${id}`);
    res.json({
      status: 'SUCCESS',
      message: 'Asset processed with background removal and approved',
      data: updatedAsset[1][0].toJSON(),
    });
  } catch (error) {
    console.error('Failed to process asset:', error);
    res.status(500).json({
      error: 'Failed to process asset',
      message: error.message,
    });
  }
});

module.exports = router;

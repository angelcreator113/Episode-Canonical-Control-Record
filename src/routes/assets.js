/**
 * Asset Management Routes
 * POST /api/v1/assets - Upload new asset
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
const { _models } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { validateAssetUpload, validateUUIDParam } = require('../middleware/requestValidation');

const router = express.Router();

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

// ✅ FIXED: Correct spelling everywhere
const VALID_ASSET_TYPES = [
  'PROMO_LALA',
  'PROMO_JUSTAWOMANINHERPRIME',
  'PROMO_GUEST',
  'BRAND_LOGO',
  'EPISODE_FRAME',
];

/**
 * GET /api/v1/assets/approved/:type
 * Get approved assets by type
 */
router.get('/approved/:type', async (req, res) => {
  try {
    const { type } = req.params;

    console.log('📥 GET /approved/:type - Requested type:', type);

    if (!VALID_ASSET_TYPES.includes(type)) {
      console.error('❌ Invalid asset type:', type);
      return res.status(400).json({
        error: 'Invalid asset type',
        valid_types: VALID_ASSET_TYPES,
        received: type,
      });
    }

    const assets = await AssetService.getApprovedAssets(type);

    console.log(`✅ Found ${assets.length} assets for type: ${type}`);

    res.json({
      status: 'SUCCESS',
      data: assets,
      count: assets.length,
    });
  } catch (error) {
    console.error('❌ Failed to get approved assets:', error);
    res.status(500).json({
      error: 'Failed to get approved assets',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * GET /api/v1/assets/pending
 * List pending assets
 */
router.get('/pending', async (req, res) => {
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
router.get('/:id', validateUUIDParam('id'), async (req, res) => {
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
    if (error.message.includes('Asset not found')) {
      return res.status(404).json({
        error: 'Asset not found',
      });
    }
    res.status(500).json({
      error: 'Failed to get asset',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/assets
 * Upload new asset
 */
router.post('/', upload.single('file'), validateAssetUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'No file provided',
        details: ['No file provided'],
      });
    }

    const { assetType, metadata } = req.body;

    if (!assetType) {
      return res.status(400).json({
        error: 'Validation failed',
        details: ['assetType is required'],
      });
    }

    if (!VALID_ASSET_TYPES.includes(assetType)) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [`assetType must be one of: ${VALID_ASSET_TYPES.join(', ')}`],
        received: assetType,
      });
    }

    // Parse metadata
    let parsedMetadata = {};
    if (metadata) {
      try {
        if (typeof metadata === 'string') {
          parsedMetadata = JSON.parse(metadata);
        } else if (typeof metadata === 'object') {
          parsedMetadata = metadata;
        }

        if (typeof parsedMetadata !== 'object' || parsedMetadata === null) {
          return res.status(400).json({
            error: 'Validation failed',
            details: ['Metadata must be valid JSON object'],
          });
        }
      } catch (parseError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: ['Metadata must be valid JSON'],
        });
      }
    }

    // Upload to S3 and create database record
    const asset = await AssetService.uploadAsset(
      req.file,
      assetType,
      parsedMetadata,
      req.user?.id || 'system'
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
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
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
    const asset = await AssetService.approveAsset(id, req.user?.id);

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
    if (error.message.includes('Asset not found')) {
      return res.status(404).json({ error: 'Asset not found' });
    }
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
    if (error.message.includes('Asset not found')) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.status(500).json({
      error: 'Failed to reject asset',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v1/assets/:id/process
 * Process asset background removal
 */
router.put('/:id/process', async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await AssetService.processAssetBackgroundRemoval(id);

    if (!asset) {
      return res.status(404).json({
        error: 'Asset not found',
      });
    }

    res.json({
      status: 'SUCCESS',
      message: 'Asset processed with background removal and approved',
      data: asset,
    });
  } catch (error) {
    console.error('Failed to process asset:', error);
    if (error.message.includes('Asset not found')) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.status(500).json({
      error: 'Failed to process asset',
      message: error.message,
    });
  }
});

module.exports = router;

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

// Configure multer for file upload (supports images and videos)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB for videos
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      // Videos
      'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF, WebP) and videos (MP4, MOV, WebM) allowed'));
    }
  },
});

// ✅ FIXED: Correct spelling everywhere + video types
const VALID_ASSET_TYPES = [
  'PROMO_LALA',
  'PROMO_JUSTAWOMANINHERPRIME',
  'PROMO_GUEST',
  'BRAND_LOGO',
  'EPISODE_FRAME',
  'PROMO_VIDEO',
  'EPISODE_VIDEO',
  'BACKGROUND_VIDEO',
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

// ==================== LABEL ENDPOINTS (MUST BE BEFORE /:id) ====================

/**
 * GET /api/v1/assets/labels
 * Get all available labels
 */
router.get('/labels', async (req, res) => {
  try {
    const labels = await AssetService.getAllLabels();

    res.json({
      status: 'SUCCESS',
      data: labels,
      count: labels.length,
    });
  } catch (error) {
    console.error('Failed to get labels:', error);
    res.status(500).json({
      error: 'Failed to get labels',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/assets/labels
 * Create new label (admin only)
 */
router.post('/labels', async (req, res) => {
  try {
    const { name, color, description } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Label name is required',
      });
    }

    const label = await AssetService.createLabel(name, color, description);

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Label created successfully',
      data: label,
    });
  } catch (error) {
    console.error('Failed to create label:', error);
    res.status(error.message.includes('already exists') ? 409 : 500).json({
      error: 'Failed to create label',
      message: error.message,
    });
  }
});

// ==================== BULK OPERATIONS (MUST BE BEFORE /:id) ====================

/**
 * POST /api/v1/assets/bulk/delete
 * Bulk delete assets
 */
router.post('/bulk/delete', async (req, res) => {
  try {
    const { assetIds } = req.body;

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'assetIds array is required',
      });
    }

    const result = await AssetService.bulkDeleteAssets(assetIds);

    res.json({
      status: 'SUCCESS',
      message: `Deleted ${result.succeeded} assets, ${result.failed} failed`,
      ...result,
    });
  } catch (error) {
    console.error('Bulk delete failed:', error);
    res.status(500).json({
      error: 'Bulk delete failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/assets/bulk/process-background
 * Bulk background removal
 */
router.post('/bulk/process-background', async (req, res) => {
  try {
    const { assetIds } = req.body;

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'assetIds array is required',
      });
    }

    const result = await AssetService.bulkProcessBackground(assetIds);

    res.json({
      status: 'SUCCESS',
      message: `Processed ${result.succeeded} assets, ${result.failed} failed`,
      ...result,
    });
  } catch (error) {
    console.error('Bulk processing failed:', error);
    res.status(500).json({
      error: 'Bulk processing failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/assets/bulk/add-labels
 * Bulk add labels to assets
 */
router.post('/bulk/add-labels', async (req, res) => {
  try {
    const { assetIds, labelIds } = req.body;

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'assetIds array is required',
      });
    }

    if (!Array.isArray(labelIds) || labelIds.length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'labelIds array is required',
      });
    }

    const result = await AssetService.bulkAddLabels(assetIds, labelIds);

    res.json({
      status: 'SUCCESS',
      message: `Added labels to ${result.succeeded} assets, ${result.failed} failed`,
      ...result,
    });
  } catch (error) {
    console.error('Bulk label addition failed:', error);
    res.status(500).json({
      error: 'Bulk label addition failed',
      message: error.message,
    });
  }
});

// ==================== SEARCH (MUST BE BEFORE /:id) ====================

/**
 * POST /api/v1/assets/search
 * Search assets with advanced filters
 */
router.post('/search', async (req, res) => {
  try {
    const filters = req.body;
    const assets = await AssetService.searchAssets(filters);

    res.json({
      status: 'SUCCESS',
      data: assets,
      count: assets.length,
    });
  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({
      error: 'Search failed',
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

/**
 * POST /api/v1/assets/:id/process-background
 * On-demand background removal
 */
router.post('/:id/process-background', validateUUIDParam('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await AssetService.processAssetBackgroundRemoval(id);

    res.json({
      status: 'SUCCESS',
      message: 'Background removed successfully',
      data: asset,
    });
  } catch (error) {
    console.error('Background processing failed:', error);
    res.status(500).json({
      error: 'Background processing failed',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v1/assets/:id
 * Update asset metadata
 */
router.put('/:id', validateUUIDParam('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const asset = await AssetService.updateAsset(id, updates);

    res.json({
      status: 'SUCCESS',
      message: 'Asset updated successfully',
      data: asset,
    });
  } catch (error) {
    console.error('Failed to update asset:', error);
    res.status(500).json({
      error: 'Failed to update asset',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/v1/assets/:id
 * Delete asset
 */
router.delete('/:id', validateUUIDParam('id'), async (req, res) => {
  try {
    const { id } = req.params;
    await AssetService.bulkDeleteAssets([id]);

    res.json({
      status: 'SUCCESS',
      message: 'Asset deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete asset:', error);
    res.status(500).json({
      error: 'Failed to delete asset',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/assets/:id/labels
 * Add labels to asset
 */
router.post('/:id/labels', validateUUIDParam('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const { labelIds } = req.body;

    if (!Array.isArray(labelIds) || labelIds.length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'labelIds array is required',
      });
    }

    const asset = await AssetService.addLabelsToAsset(id, labelIds);

    res.json({
      status: 'SUCCESS',
      message: 'Labels added successfully',
      data: asset,
    });
  } catch (error) {
    console.error('Failed to add labels:', error);
    res.status(500).json({
      error: 'Failed to add labels',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/v1/assets/:id/labels/:labelId
 * Remove label from asset
 */
router.delete('/:id/labels/:labelId', validateUUIDParam('id'), async (req, res) => {
  try {
    const { id, labelId } = req.params;
    const asset = await AssetService.removeLabelFromAsset(id, labelId);

    res.json({
      status: 'SUCCESS',
      message: 'Label removed successfully',
      data: asset,
    });
  } catch (error) {
    console.error('Failed to remove label:', error);
    res.status(500).json({
      error: 'Failed to remove label',
      message: error.message,
    });
  }
});

// ==================== USAGE TRACKING ====================

/**
 * GET /api/v1/assets/:id/usage
 * Get asset usage information
 */
router.get('/:id/usage', validateUUIDParam('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const usages = await AssetService.getAssetUsage(id);

    res.json({
      status: 'SUCCESS',
      data: usages,
      count: usages.length,
    });
  } catch (error) {
    console.error('Failed to get asset usage:', error);
    res.status(500).json({
      error: 'Failed to get asset usage',
      message: error.message,
    });
  }
});

module.exports = router;

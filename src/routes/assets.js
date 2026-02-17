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
const { models } = require('../models');
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
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      // Videos
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'video/x-msvideo',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Invalid file type. Only images (JPEG, PNG, GIF, WebP) and videos (MP4, MOV, WebM) allowed'
        )
      );
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
  'BACKGROUND_IMAGE',
  'PROMO_VIDEO',
  'EPISODE_VIDEO',
  'BACKGROUND_VIDEO',
  'SHOW_JAIA',
  'PROMO_JUSTAMOVIE',
  'THUMBNAIL',
  'GUEST_PHOTO',
  'CUSTOM_GRAPHIC',
  'B_ROLL',
];

/**
 * GET /api/v1/assets
 * List all assets (with optional filters)
 */
router.get('/', async (req, res) => {
  try {
    const {
      limit = 500,
      offset = 0,
      approval_status,
      asset_type,
      show_id,
      episode_id,
      asset_scope,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query;

    console.log('📥 GET /assets - Listing assets with filters:', {
      limit,
      offset,
      approval_status,
      asset_type,
      show_id,
      episode_id,
      asset_scope,
      sortBy,
      sortOrder,
    });

    const { category, character_name, entity_type: entityTypeFilter, location_name, include_global } = req.query;
    const { Op } = require('sequelize');

    const where = {};
    if (approval_status) {
      where.approval_status = approval_status;
    }
    if (asset_type) {
      where.asset_type = asset_type;
    }
    // When show_id is provided, also include GLOBAL assets (available everywhere)
    if (show_id) {
      if (include_global === 'true') {
        // Include both show-specific and GLOBAL assets
        where[Op.or] = [
          { show_id: show_id },
          { asset_scope: 'GLOBAL' },
          { show_id: null } // Assets without show_id
        ];
      } else {
        where.show_id = show_id;
      }
    }
    if (episode_id) {
      where.episode_id = episode_id;
    }
    if (asset_scope && !include_global) {
      where.asset_scope = asset_scope;
    }
    // New wardrobe system filters
    if (category) {
      // Support multiple categories as comma-separated values
      if (category.includes(',')) {
        const categories = category.split(',').map((c) => c.trim()).filter(Boolean);
        where.category = { [Op.in]: categories };
      } else {
        where.category = category;
      }
    }
    if (character_name) {
      where.character_name = character_name;
    }
    if (entityTypeFilter) {
      where.entity_type = entityTypeFilter;
    }
    if (location_name) {
      where.location_name = location_name;
    }

    const assets = await models.Asset.findAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder]],
      attributes: [
        'id',
        'name',
        'asset_type',
        'asset_role',
        'asset_group',
        'asset_scope',
        'purpose',
        'show_id',
        'episode_id',
        's3_url_raw',
        's3_url_processed',
        'media_type',
        'approval_status',
        'is_global',
        'allowed_uses',
        'width',
        'height',
        'file_size_bytes',
        'metadata', // CRITICAL: Include metadata for thumbnail_url
        // New wardrobe system columns
        'entity_type',
        'category',
        'character_name',
        'outfit_name',
        'outfit_era',
        'transformation_stage',
        'usage_count',
        'color_palette',
        'mood_tags',
        'location_name',
        'location_version',
        'active_from_episode',
        'active_to_episode',
        'created_at',
        'updated_at',
      ],
      // Paranoid mode is enabled on model, but being explicit
      paranoid: true,
    });

    console.log(`✅ Found ${assets.length} assets`);
    console.log(`   (Soft-deleted assets automatically excluded by paranoid mode)`);

    res.json({
      status: 'SUCCESS',
      data: assets,
      count: assets.length,
      filters: { limit, offset, approval_status, asset_type },
    });
  } catch (error) {
    console.error('❌ Failed to list assets:', error);
    res.status(500).json({
      error: 'Failed to list assets',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * GET /api/v1/assets/eligible
 * Get assets eligible for a specific role, filtered by scope and context
 * Query params:
 *  - role: Asset role (e.g., BG.MAIN, CHAR.HOST.PRIMARY)
 *  - showId: Show UUID (required for show/episode-scoped assets)
 *  - episodeId: Episode UUID (optional, includes episode-scoped assets)
 *  - approvalStatus: Filter by approval status (default: APPROVED)
 */
router.get('/eligible', async (req, res) => {
  try {
    const { role, showId, episodeId, approvalStatus = 'APPROVED' } = req.query;

    if (!role) {
      return res.status(400).json({
        error: 'Missing required parameter: role',
        message: 'role query parameter is required',
      });
    }

    console.log('📥 GET /assets/eligible - Fetching eligible assets:', {
      role,
      showId,
      episodeId,
      approvalStatus,
    });

    // Build where clause
    const where = {
      asset_role: role,
      approval_status: approvalStatus,
    };

    // Build scope filter using OR conditions
    const scopeConditions = [
      { asset_scope: 'GLOBAL' }, // Always include global assets
    ];

    if (showId) {
      scopeConditions.push({
        asset_scope: 'SHOW',
        show_id: showId,
      });
    }

    if (episodeId) {
      scopeConditions.push({
        asset_scope: 'EPISODE',
        episode_id: episodeId,
      });
    }

    // Combine role/approval with scope conditions
    const { Op } = require('sequelize');
    const finalWhere = {
      ...where,
      [Op.or]: scopeConditions,
    };

    const assets = await models.Asset.findAll({
      where: finalWhere,
      order: [
        ['asset_scope', 'ASC'], // EPISODE first, then SHOW, then GLOBAL
        ['created_at', 'DESC'],
      ],
      attributes: [
        'id',
        'name',
        'asset_role',
        'asset_scope',
        'show_id',
        'episode_id',
        's3_url_raw',
        's3_url_processed',
        'media_type',
        'approval_status',
        'width',
        'height',
        'file_size_bytes',
        'metadata', // Include for thumbnail_url
        'created_at',
        'updated_at',
      ],
      paranoid: true, // Explicitly exclude soft-deleted records
    });

    console.log(`✅ Found ${assets.length} eligible assets for role: ${role}`);

    res.json({
      status: 'SUCCESS',
      data: assets,
      count: assets.length,
      filters: { role, showId, episodeId, approvalStatus },
    });
  } catch (error) {
    console.error('❌ Failed to get eligible assets:', error);
    res.status(500).json({
      error: 'Failed to get eligible assets',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * GET /api/v1/assets/by-folder
 * Get assets organized by asset_group folders for flexible selection
 * Query params:
 *  - folders: Comma-separated list of asset_groups (e.g., "LALA,GUEST")
 *  - showId: Show UUID (optional)
 *  - episodeId: Episode UUID (optional)
 *  - approvalStatus: Filter by approval status (default: APPROVED)
 */
router.get('/by-folder', async (req, res) => {
  try {
    const { folders, showId, episodeId, approvalStatus = 'APPROVED' } = req.query;

    if (!folders) {
      return res.status(400).json({
        error: 'Missing required parameter: folders',
        message: 'folders query parameter is required (e.g., "LALA,GUEST")',
      });
    }

    console.log('📥 GET /assets/by-folder - Fetching assets by folders:', {
      folders,
      showId,
      episodeId,
      approvalStatus,
    });

    const folderList = folders.split(',').map((f) => f.trim());

    // Build where clause
    const { Op } = require('sequelize');
    const where = {
      asset_group: { [Op.in]: folderList },
      approval_status: approvalStatus,
    };

    // Build scope filter
    const scopeConditions = [
      { asset_scope: 'GLOBAL' }, // Always include global assets
    ];

    if (showId) {
      console.log('✅ Adding SHOW scope filter with showId:', showId);
      scopeConditions.push({
        asset_scope: 'SHOW',
        show_id: showId,
      });
    } else {
      console.log('⚠️ No showId provided - SHOW assets will NOT be included');
    }

    if (episodeId) {
      console.log('✅ Adding EPISODE scope filter with episodeId:', episodeId);
      scopeConditions.push({
        asset_scope: 'EPISODE',
        episode_id: episodeId,
      });
    }

    console.log('🔍 Scope conditions:', JSON.stringify(scopeConditions, null, 2));

    const finalWhere = {
      ...where,
      [Op.or]: scopeConditions,
    };

    console.log('🔍 Final where clause:', JSON.stringify(finalWhere, null, 2));

    const assets = await models.Asset.findAll({
      where: finalWhere,
      order: [
        ['asset_group', 'ASC'],
        ['asset_scope', 'ASC'],
        ['created_at', 'DESC'],
      ],
      attributes: [
        'id',
        'name',
        'asset_role',
        'asset_group',
        'asset_scope',
        'show_id',
        'episode_id',
        's3_url_raw',
        's3_url_processed',
        'media_type',
        'approval_status',
        'width',
        'height',
        'file_size_bytes',
        'metadata', // Include for thumbnail_url
        'created_at',
        'updated_at',
      ],
      paranoid: true, // Explicitly exclude soft-deleted records
    });

    console.log(`✅ Found ${assets.length} assets for folders: ${folderList.join(', ')}`);

    res.json({
      status: 'SUCCESS',
      data: assets,
      count: assets.length,
      filters: { folders: folderList, showId, episodeId, approvalStatus },
    });
  } catch (error) {
    console.error('❌ Failed to get assets by folder:', error);
    res.status(500).json({
      error: 'Failed to get assets by folder',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

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

/**
 * POST /api/v1/assets/bulk/change-type
 * Bulk change asset type
 */
router.post('/bulk/change-type', async (req, res) => {
  try {
    const { assetIds, assetType } = req.body;

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'assetIds array is required',
      });
    }

    if (!assetType || typeof assetType !== 'string') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'assetType string is required',
      });
    }

    const result = await AssetService.bulkChangeAssetType(assetIds, assetType);

    res.json({
      status: 'SUCCESS',
      message: `Changed type for ${result.succeeded} assets, ${result.failed} failed`,
      ...result,
    });
  } catch (error) {
    console.error('Bulk type change failed:', error);
    res.status(500).json({
      error: 'Bulk type change failed',
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

    const { assetType, assetRole, metadata } = req.body;

    // Extract wardrobe system fields from body
    const {
      category: assetCategory,
      entity_type: entityType,
      character_name: charName,
      outfit_name: outfitName,
      outfit_era: outfitEra,
      transformation_stage: transformStage,
      location_name: locName,
      location_version: locVersion,
      tags: rawTags,
      color_palette: rawPalette,
      mood_tags: rawMoodTags,
      show_id: bodyShowId,
      episode_id: bodyEpisodeId,
    } = req.body;

    console.log('📥 Asset upload request body:', {
      assetType,
      assetRole,
      assetCategory,
      entityType,
      charName,
      metadata,
      allBodyFields: Object.keys(req.body),
      bodyShowId,
      bodyEpisodeId,
      FULL_REQ_BODY: req.body,
    });

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

    // ✅ CRITICAL: Add show_id and asset_scope to metadata so AssetService can use it
    if (bodyShowId) parsedMetadata.show_id = bodyShowId;
    if (bodyShowId) parsedMetadata.showId = bodyShowId;  // Also add camelCase for compatibility

    // Upload to S3 and create database record
    const asset = await AssetService.uploadAsset(
      req.file,
      assetType,
      assetRole,
      parsedMetadata,
      req.user?.id || 'system'
    );

    // Apply wardrobe system metadata if provided
    const wardrobeUpdates = {};
    if (assetCategory) wardrobeUpdates.category = assetCategory;
    if (entityType) wardrobeUpdates.entity_type = entityType;
    if (charName) wardrobeUpdates.character_name = charName;
    if (outfitName) wardrobeUpdates.outfit_name = outfitName;
    if (outfitEra) wardrobeUpdates.outfit_era = outfitEra;
    if (transformStage) wardrobeUpdates.transformation_stage = transformStage;
    if (locName) wardrobeUpdates.location_name = locName;
    if (locVersion) wardrobeUpdates.location_version = parseInt(locVersion);
    
    // Extract show_id and episode_id (from body or metadata)
    const showId = bodyShowId || parsedMetadata?.show_id || parsedMetadata?.showId;
    const episodeId = bodyEpisodeId || parsedMetadata?.episode_id || parsedMetadata?.episodeId;
    if (showId) wardrobeUpdates.show_id = showId;
    if (episodeId) wardrobeUpdates.episode_id = episodeId;
    
    if (rawPalette) {
      try {
        wardrobeUpdates.color_palette = typeof rawPalette === 'string' ? JSON.parse(rawPalette) : rawPalette;
      } catch (e) { /* skip invalid JSON */ }
    }
    if (rawMoodTags) {
      wardrobeUpdates.mood_tags = typeof rawMoodTags === 'string' ? rawMoodTags.split(',').map(t => t.trim()) : rawMoodTags;
    }

    if (Object.keys(wardrobeUpdates).length > 0) {
      console.log('🔄 Applying wardrobe updates:', wardrobeUpdates);
      await models.Asset.update(wardrobeUpdates, {
        where: { id: asset.id },
      });
      Object.assign(asset, wardrobeUpdates);
      console.log('✅ Updates applied. Asset now:', {
        id: asset.id,
        show_id: asset.show_id,
        entity_type: asset.entity_type,
        category: asset.category,
      });
    }

    console.log('✅ Asset created:', {
      id: asset.id,
      name: asset.name,
      asset_type: asset.asset_type,
      asset_role: asset.asset_role,
      category: asset.category,
      wasRoleProvided: !!assetRole,
    });

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

/**
 * GET /api/v1/assets/:id/download/:type
 * Generate pre-signed download URL for asset
 * @param {string} type - 'raw' or 'processed'
 */
router.get('/:id/download/:type', validateUUIDParam('id'), async (req, res) => {
  try {
    const { id, type } = req.params;

    if (!['raw', 'processed'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid download type',
        message: 'Type must be "raw" or "processed"',
      });
    }

    const downloadUrl = await AssetService.generateDownloadUrl(id, type);

    res.json({
      status: 'SUCCESS',
      data: {
        downloadUrl,
        expiresIn: 3600, // 1 hour
      },
    });
  } catch (error) {
    console.error('Failed to generate download URL:', error);
    res.status(500).json({
      error: 'Failed to generate download URL',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/assets/process
 * Process an asset with transformations (background removal, enhancement, etc.)
 * Body: { asset_id, template_id, processing: { removeBackground, smoothSkin, autoEnhance }, provider }
 */
router.post('/process', async (req, res) => {
  try {
    const { asset_id, template_id, processing = {}, provider = 'runway' } = req.body;

    console.log('🔧 Processing asset:', { asset_id, template_id, processing, provider });

    // Validate input
    if (!asset_id) {
      return res.status(400).json({
        status: 'ERROR',
        error: 'asset_id is required',
      });
    }

    if (!template_id) {
      return res.status(400).json({
        status: 'ERROR',
        error: 'template_id is required',
      });
    }

    // Get asset
    const asset = await models.Asset.findByPk(asset_id);
    if (!asset) {
      return res.status(404).json({
        status: 'ERROR',
        error: 'Asset not found',
      });
    }

    // Check cache first
    const AssetProcessingService = require('../services/AssetProcessingService');
    const processingType =
      Object.entries(processing)
        .filter(([_, enabled]) => enabled)
        .map(([key]) => key)
        .join('-') || 'processed';

    const cached = await AssetProcessingService.checkCache(template_id, asset_id, processingType);

    if (cached) {
      console.log('✅ Using cached processed asset:', cached);
      return res.json({
        status: 'SUCCESS',
        message: 'Using cached processed asset',
        data: {
          processed_url: cached,
          cached: true,
        },
      });
    }

    // Process the asset
    const assetUrl =
      asset.s3_url_raw || (asset.s3_bucket && asset.s3_key)
        ? `https://${asset.s3_bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${asset.s3_key}`
        : null;

    if (!assetUrl) {
      return res.status(400).json({
        status: 'ERROR',
        error: 'Asset does not have a valid S3 URL',
      });
    }

    const result = await AssetProcessingService.processAsset(assetUrl, {
      ...processing,
      provider,
    });

    // Save to cache
    const savedUrl = await AssetProcessingService.saveProcessedAsset(
      template_id,
      asset_id,
      result.processedUrl,
      processingType
    );

    console.log('✅ Asset processed and cached:', savedUrl);

    res.json({
      status: 'SUCCESS',
      message: 'Asset processed successfully',
      data: {
        processed_url: savedUrl,
        original_url: assetUrl,
        processing_steps: result.processingSteps,
        provider: result.provider,
        cached: false,
      },
    });
  } catch (error) {
    console.error('❌ Asset processing failed:', error);
    res.status(500).json({
      status: 'ERROR',
      error: 'Asset processing failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/assets/config/check
 * Check AWS and API configuration (for debugging)
 */
router.get('/config/check', async (req, res) => {
  try {
    const config = {
      awsRegion: process.env.AWS_REGION || 'not set',
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID
        ? `${process.env.AWS_ACCESS_KEY_ID.substring(0, 8)}...`
        : 'not set',
      awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY ? 'configured' : 'not set',
      s3Bucket: process.env.AWS_S3_BUCKET || 'not set',
      runwayApiKey: process.env.RUNWAY_ML_API_KEY ? 'configured' : 'not set',
      removeBgApiKey: process.env.REMOVEBG_API_KEY ? 'configured' : 'not set',
    };

    res.json({
      status: 'SUCCESS',
      message: 'Configuration check',
      data: config,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check config',
      message: error.message,
    });
  }
});

module.exports = router;

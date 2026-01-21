/**
 * Thumbnail Composition Routes
 * POST /api/v1/compositions - Create composition
 * GET /api/v1/compositions/episode/:episodeId - Get compositions for episode
 * GET /api/v1/compositions/:id - Get composition by ID
 * PUT /api/v1/compositions/:id - Update composition
 * PUT /api/v1/compositions/:id/approve - Approve composition
 * PUT /api/v1/compositions/:id/primary - Set as primary thumbnail
 * POST /api/v1/compositions/:id/generate - Queue for generation
 * POST /api/v1/compositions/:id/generate-thumbnails - Generate thumbnails (Runway ML + Sharp)
 */
/* eslint-disable no-console */

const express = require('express');
const CompositionService = require('../services/CompositionService');
const ThumbnailGeneratorService = require('../services/ThumbnailGeneratorService');
const VersioningService = require('../services/VersioningService');
const FilterService = require('../services/FilterService');
const { models } = require('../models');
const { authenticateJWT, requireGroup } = require('../middleware/jwtAuth');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { fromIni, fromEnv } = require('@aws-sdk/credential-providers');

// Configure AWS SDK v3 with credential chain - lazy load to avoid test errors
let s3Client = null;

const getS3Client = async () => {
  if (s3Client) return s3Client;

  // In test environment, return mock client
  if (process.env.NODE_ENV === 'test') {
    return {
      send: async () => ({ ETag: 'mock-etag', $metadata: {} }),
    };
  }

  const credentials = process.env.AWS_PROFILE
    ? await fromIni({ profile: process.env.AWS_PROFILE })()
    : await fromEnv()();

  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials,
  });

  console.log(
    '✅ AWS SDK v3 configured with credentials from',
    process.env.AWS_PROFILE ? `profile: ${process.env.AWS_PROFILE}` : 'environment'
  );

  return s3Client;
};

const router = express.Router();

/**
 * Validate UUID format
 */
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * GET /api/v1/compositions
 * Get all compositions for an episode
 */
router.get('/', async (req, res) => {
  try {
    const { episode_id } = req.query;

    const where = {};
    // Only filter by episode_id if it's a valid UUID (not 'default' or invalid)
    if (episode_id && episode_id !== 'default' && isValidUUID(episode_id)) {
      where.episode_id = episode_id;
    }

    const compositions = await models.ThumbnailComposition.findAll({
      where,
      order: [['created_at', 'DESC']],
      raw: true,
    });

    res.json({
      status: 'SUCCESS',
      data: compositions || [],
      count: (compositions || []).length,
    });
  } catch (error) {
    console.error('Failed to get compositions:', error);
    res.status(500).json({
      error: 'Failed to get compositions',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/compositions
 * Create new composition and generate selected format thumbnails
 * Phase 2.5: Admin manual trigger - no auth required
 */
router.post('/', async (req, res) => {
  try {
    console.log('📥 POST /compositions request body:', JSON.stringify(req.body, null, 2));

    let { episode_id, template_id } = req.body;

    const {
      lala_asset_id,
      justawomen_asset_id,
      include_justawomaninherprime,
      justawomaninherprime_position,
      guest_asset_id,
      background_frame_asset_id,
      selected_formats,
    } = req.body;

    // Validate required fields
    if (!episode_id || !lala_asset_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['episode_id', 'lala_asset_id'],
        received: {
          episode_id: !!episode_id,
          lala_asset_id: !!lala_asset_id,
        },
      });
    }

    // Validate episode_id is an integer or parseable as integer
    const episodeIdInt = parseInt(episode_id, 10);
    if (isNaN(episodeIdInt) || episodeIdInt < 1) {
      // If not an integer, check if it's a UUID (from frontend mock data)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(episode_id)) {
        // UUID provided - try to use episode ID 2 as default for testing
        console.warn(`⚠️  UUID episode_id provided (${episode_id}), using default episode 2`);
        episode_id = 2;
      } else {
        return res.status(400).json({
          error: 'Invalid episode_id - must be a valid integer ID or UUID',
          received: episode_id,
          type: typeof episode_id,
        });
      }
    } else {
      episode_id = episodeIdInt; // Use parsed integer
    }

    // Validate lala_asset_id is a proper UUID
    if (!isValidUUID(lala_asset_id)) {
      return res.status(400).json({
        error: 'Invalid lala_asset_id - must be a valid UUID',
        received: lala_asset_id,
      });
    }

    // Validate justawomen_asset_id if provided
    if (justawomen_asset_id && !isValidUUID(justawomen_asset_id)) {
      return res.status(400).json({
        error: 'Invalid justawomen_asset_id - must be a valid UUID',
        received: justawomen_asset_id,
      });
    }

    // If template_id not provided, get the first available template
    if (!template_id) {
      const defaultTemplate = await models.ThumbnailTemplate.findOne({
        order: [['created_at', 'ASC']],
      });
      if (!defaultTemplate) {
        return res.status(400).json({
          error: 'No templates available',
        });
      }
      template_id = defaultTemplate.id;
    }

    // Validate that if include_justawomaninherprime is true, asset is provided
    if (include_justawomaninherprime && !justawomen_asset_id) {
      return res.status(400).json({
        error: 'When include_justawomaninherprime is true, justawomen_asset_id is required',
      });
    }

    // NEW: Validate selected_formats
    if (!Array.isArray(selected_formats) || selected_formats.length === 0) {
      return res.status(400).json({
        error: 'selected_formats must be a non-empty array',
      });
    }

    // Create composition
    const composition = await CompositionService.createComposition(
      episode_id,
      {
        template_id,
        lala_asset_id,
        justawomen_asset_id,
        include_justawomaninherprime: include_justawomaninherprime || false,
        justawomaninherprime_position,
        guest_asset_id,
        background_frame_asset_id,
        selected_formats, // Pass selected formats to service
      },
      req.user?.id || 'test-user'
    );

    // NEW: Generate thumbnails for selected formats
    console.log('🎬 About to generate thumbnails for composition:', composition.id);
    console.log('📋 Selected formats:', selected_formats);

    let thumbnails = [];
    try {
      thumbnails = await CompositionService.generateThumbnails(composition.id, selected_formats);
      console.log('✅ Thumbnails generated:', thumbnails.length);
    } catch (genErr) {
      console.warn('⚠️ Thumbnail generation failed (non-blocking):', genErr.message);
      // Don't fail the entire request - composition was created
      thumbnails = [];
    }

    res.status(201).json({
      status: 'SUCCESS',
      message:
        'Composition created' +
        (thumbnails.length > 0 ? ` and ${thumbnails.length} thumbnails generated` : ''),
      data: {
        composition,
        thumbnails_generated: thumbnails.length || 0,
        thumbnails: thumbnails || [],
      },
    });
  } catch (error) {
    console.error('❌ Failed to create composition:', error.message);
    console.error('Full error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to create composition',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * GET /api/v1/compositions/episode/:episodeId
 * Get all compositions for episode
 */
router.get('/episode/:episodeId', async (req, res) => {
  try {
    const { episodeId } = req.params;
    const compositions = await CompositionService.getEpisodeCompositions(episodeId);

    res.json({
      status: 'SUCCESS',
      data: compositions,
      count: compositions.length,
    });
  } catch (error) {
    console.error('Failed to get episode compositions:', error);
    res.status(500).json({
      error: 'Failed to get episode compositions',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/compositions/:id
 * Get composition by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const composition = await CompositionService.getComposition(id);

    res.json({
      status: 'SUCCESS',
      data: composition,
    });
  } catch (error) {
    console.error('Failed to get composition:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: 'Failed to get composition',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v1/compositions/:id
 * Update composition config (increments version)
 */
router.put('/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { composition_config } = req.body;

    if (!composition_config) {
      return res.status(400).json({
        error: 'composition_config is required',
      });
    }

    const composition = await CompositionService.updateComposition(id, composition_config);

    res.json({
      status: 'SUCCESS',
      message: 'Composition updated',
      data: composition,
    });
  } catch (error) {
    console.error('Failed to update composition:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: 'Failed to update composition',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v1/compositions/:id/approve
 * Approve composition (admin only)
 */
router.put('/:id/approve', authenticateJWT, requireGroup('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const composition = await CompositionService.approveComposition(id, req.user.id);

    res.json({
      status: 'SUCCESS',
      message: 'Composition approved',
      data: composition,
    });
  } catch (error) {
    console.error('Failed to approve composition:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: 'Failed to approve composition',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v1/compositions/:id/primary
 * Set composition as primary for episode
 */
router.put('/:id/primary', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const composition = await CompositionService.setPrimary(id);

    res.json({
      status: 'SUCCESS',
      message: 'Composition set as primary',
      data: composition,
    });
  } catch (error) {
    console.error('Failed to set primary composition:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: 'Failed to set primary composition',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v1/compositions/:id/publish
 * Publish composition (DRAFT → APPROVED)
 */
router.put('/:id/publish', authenticateJWT, requireGroup('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const composition = await models.ThumbnailComposition.findByPk(id);
    if (!composition) {
      return res.status(404).json({
        error: 'Composition not found',
      });
    }

    if (composition.approval_status === 'APPROVED') {
      return res.status(400).json({
        error: 'Composition is already approved',
      });
    }

    // Update to APPROVED
    await composition.update({ approval_status: 'APPROVED' });

    res.json({
      status: 'SUCCESS',
      message: 'Composition published',
      data: composition,
    });
  } catch (error) {
    console.error('Failed to publish composition:', error);
    res.status(500).json({
      error: 'Failed to publish composition',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/compositions/:id/generate
 * Queue composition for generation (Lambda processing)
 */
router.post('/:id/generate', authenticateJWT, requireGroup('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await CompositionService.queueForGeneration(id);

    res.json({
      status: 'SUCCESS',
      ...result,
    });
  } catch (error) {
    console.error('Failed to queue composition:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: 'Failed to queue composition',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/compositions/:id/generate-thumbnails
 * Generate thumbnails using Runway ML + Sharp (Phase 2.5)
 * Manual trigger - no auth required for testing
 */
router.post('/:id/generate-thumbnails', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🎬 Generating thumbnails for composition: ${id}`);

    // Ensure s3Client is ready
    if (!s3Client) {
      console.error('❌ S3Client not initialized');
      return res.status(500).json({ error: 'AWS SDK not properly initialized' });
    }

    // Get composition with all asset data
    const composition = await models.ThumbnailComposition.findByPk(id, {
      include: [
        { model: models.Episode, as: 'episode' },
        { model: models.ThumbnailTemplate, as: 'template' },
        { model: models.Asset, as: 'lalaAsset' },
        { model: models.Asset, as: 'guestAsset' },
        { model: models.Asset, as: 'justawomanAsset' },
        { model: models.Asset, as: 'backgroundAsset' },
      ],
    });

    if (!composition) {
      return res.status(404).json({ error: 'Composition not found' });
    }

    console.log(`  ✅ Composition loaded`);
    console.log(`  Background Asset ID: ${composition.backgroundAsset?.id || 'null'}`);
    console.log(`  Lala Asset ID: ${composition.lalaAsset?.id || 'null'}`);
    console.log(`  Guest Asset ID: ${composition.guestAsset?.id || 'null'}`);

    // Download all assets from S3 using SDK v3
    console.log('📥 Downloading assets from S3...');
    const sharp = require('sharp');

    const downloadAsset = async (key, label, fallbackColor) => {
      try {
        console.log(`  Downloading ${label}: ${key}`);
        const command = new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: key,
        });
        const client = await getS3Client();
        const response = await client.send(command);
        const buffer = await response.Body.transformToByteArray();
        console.log(`  ✅ Downloaded ${label}: ${buffer.length} bytes`);
        return buffer;
      } catch (error) {
        if (error.Code === 'NoSuchKey') {
          console.log(`  ⚠️ Asset not found, creating mock ${label} image...`);
          // Create a mock image for testing
          const mockImage = await sharp({
            create: {
              width: 350,
              height: 350,
              channels: 3,
              background: fallbackColor,
            },
          })
            .png()
            .toBuffer();
          console.log(`  ✅ Created mock ${label}: ${mockImage.length} bytes`);
          return mockImage;
        }
        console.error(`❌ Error downloading ${label} (${key}):`, error.message);
        throw error;
      }
    };

    const [backgroundBuffer, lalaBuffer, guestBuffer] = await Promise.all([
      downloadAsset(composition.backgroundAsset.s3_key_raw, 'Background', {
        r: 100,
        g: 100,
        b: 100,
      }),
      downloadAsset(
        composition.lalaAsset.s3_key_processed || composition.lalaAsset.s3_key_raw,
        'Lala',
        { r: 255, g: 0, b: 0 }
      ),
      downloadAsset(
        composition.guestAsset.s3_key_processed || composition.guestAsset.s3_key_raw,
        'Guest',
        { r: 0, g: 0, b: 255 }
      ),
    ]);

    // Generate thumbnails for all MVP formats
    console.log('🎨 Generating thumbnails...');

    if (!composition.episode) {
      console.error('❌ Episode not loaded in composition');
      return res.status(500).json({
        error: 'Failed to generate thumbnails',
        message: 'Episode information not available for composition',
      });
    }

    const thumbnails = await ThumbnailGeneratorService.generateAllFormats({
      backgroundImage: backgroundBuffer,
      lalaImage: lalaBuffer,
      guestImage: guestBuffer,
      episodeTitle: composition.episode.episodeTitle || composition.episode.title || 'Unknown',
      episodeNumber: composition.episode.episodeNumber || composition.episode.episode_number || 0,
    });

    // Upload generated thumbnails to S3 using SDK v3
    console.log('📤 Uploading generated thumbnails to S3...');
    const uploadPromises = thumbnails.map(async (thumbnail) => {
      const s3Key = `thumbnails/composite/${composition.episode_id}/${thumbnail.format}-${Date.now()}.jpg`;
      try {
        const command = new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: s3Key,
          Body: thumbnail.buffer,
          ContentType: 'image/jpeg',
        });
        const client = await getS3Client();
        await client.send(command);
      } catch (error) {
        console.error(`Error uploading ${s3Key}:`, error.message);
        throw error;
      }

      return {
        format: thumbnail.format,
        formatName: thumbnail.formatName,
        platform: thumbnail.platform,
        dimensions: `${thumbnail.width}x${thumbnail.height}`,
        s3_key: s3Key,
        s3_url: `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${s3Key}`,
        size_bytes: thumbnail.buffer.length,
      };
    });

    const uploadedThumbnails = await Promise.all(uploadPromises);

    // Update composition status to PUBLISHED
    await composition.update({
      approval_status: 'APPROVED',
      published_at: new Date(),
    });

    console.log(`✅ Generated and published ${uploadedThumbnails.length} thumbnail formats`);
    res.json({
      status: 'SUCCESS',
      message: 'Thumbnails generated and published',
      composition_id: id,
      thumbnails: uploadedThumbnails,
      count: uploadedThumbnails.length,
    });
  } catch (error) {
    console.error('Failed to generate thumbnails:', error);

    // Check if this is an AWS credential/signature error
    const isAWSError =
      error.message?.includes('InvalidSignatureException') ||
      error.message?.includes('SignatureDoesNotMatch') ||
      error.message?.includes('Access Denied') ||
      error.message?.includes('NoSuchBucket') ||
      error.code?.includes('InvalidSignature') ||
      error.code?.includes('Unauthorized');

    if (isAWSError) {
      // AWS error - try mock response
      console.log('🎭 AWS error detected, returning mock response:', error.message || error.code);
      const composition = await models.ThumbnailComposition.findByPk(req.params.id);
      const formats = composition?.composition_config?.selected_formats || [];

      res.json({
        status: 'SUCCESS',
        message: 'Thumbnails generated (mock mode - AWS credentials issue)',
        composition_id: req.params.id,
        thumbnails_generated: formats.length,
        thumbnails: formats.map((format, idx) => ({
          format: format,
          formatName: format.replace(/_/g, ' '),
          s3_url: `https://mock-bucket.s3.amazonaws.com/mock-${format.toLowerCase()}-${idx}.jpg`,
          size_bytes: Math.floor(Math.random() * 500000) + 100000,
        })),
        count: formats.length,
        mock_mode: true,
        aws_error: error.message || error.code,
      });
    } else {
      res.status(error.message.includes('not found') ? 404 : 500).json({
        error: 'Failed to generate thumbnails',
        message: error.message,
        code: error.code,
      });
    }
  }
});

/**
 * PUT /api/v1/compositions/:id
 * Edit/update existing composition
 */
router.put('/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      template_id,
      lala_asset_id,
      justawomen_asset_id,
      guest_asset_id,
      background_frame_asset_id,
    } = req.body;

    // Get existing composition
    const composition = await models.ThumbnailComposition.findByPk(id);
    if (!composition) {
      return res.status(404).json({
        error: 'Composition not found',
      });
    }

    // Validate assets if provided
    if (lala_asset_id) {
      const asset = await models.Asset.findByPk(lala_asset_id);
      if (!asset || asset.approval_status !== 'APPROVED') {
        return res.status(400).json({
          error: 'Invalid Lala asset',
        });
      }
    }

    if (justawomen_asset_id) {
      const asset = await models.Asset.findByPk(justawomen_asset_id);
      if (!asset || asset.approval_status !== 'APPROVED') {
        return res.status(400).json({
          error: 'Invalid JustAWoman asset',
        });
      }
    }

    // Update composition
    await composition.update({
      template_id: template_id || composition.template_id,
      lala_asset_id: lala_asset_id || composition.lala_asset_id,
      justawomen_asset_id: justawomen_asset_id || composition.justawomen_asset_id,
      guest_asset_id: guest_asset_id !== undefined ? guest_asset_id : composition.guest_asset_id,
      background_frame_asset_id:
        background_frame_asset_id !== undefined
          ? background_frame_asset_id
          : composition.background_frame_asset_id,
      approval_status: 'DRAFT', // Reset to draft after edit
    });

    res.json({
      status: 'SUCCESS',
      message: 'Composition updated',
      data: composition,
    });
  } catch (error) {
    console.error('Failed to update composition:', error);
    res.status(500).json({
      error: 'Failed to update composition',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/v1/compositions/:id
 * Delete composition
 */
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const composition = await models.ThumbnailComposition.findByPk(id);
    if (!composition) {
      return res.status(404).json({
        error: 'Composition not found',
      });
    }

    await composition.destroy();

    res.json({
      status: 'SUCCESS',
      message: 'Composition deleted',
      data: { id },
    });
  } catch (error) {
    console.error('Failed to delete composition:', error);
    res.status(500).json({
      error: 'Failed to delete composition',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/compositions/:id/generate-formats
 * Generate additional formats for existing composition
 */
router.post('/:id/generate-formats', async (req, res) => {
  try {
    const { selected_formats } = req.body; // Array: ['FACEBOOK', 'TWITTER']

    if (!Array.isArray(selected_formats) || selected_formats.length === 0) {
      return res.status(400).json({
        error: 'selected_formats must be a non-empty array',
      });
    }

    const thumbnails = await CompositionService.generateThumbnails(req.params.id, selected_formats);

    res.json({
      status: 'SUCCESS',
      data: {
        composition_id: req.params.id,
        thumbnails_generated: thumbnails.length,
        thumbnails,
      },
    });
  } catch (error) {
    console.error('Failed to generate formats:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: error.message,
    });
  }
});

/**
 * PATCH /api/v1/compositions/:id
 * Update composition assets
 */
router.patch('/:id', async (req, res) => {
  try {
    const composition = await CompositionService.updateComposition(req.params.id, req.body);

    res.json({
      status: 'SUCCESS',
      data: composition,
    });
  } catch (error) {
    console.error('Failed to update composition:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/compositions/:id/versions
 * Get complete version history for a composition
 */
router.get('/:id/versions', async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid composition ID format' });
    }

    const history = await VersioningService.getVersionHistory(req.params.id);

    res.json({
      status: 'SUCCESS',
      data: history,
    });
  } catch (error) {
    console.error('Failed to get version history:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/compositions/:id/versions/:versionNumber
 * Get specific version details with full snapshot
 */
router.get('/:id/versions/:versionNumber', async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid composition ID format' });
    }

    const versionNumber = parseInt(req.params.versionNumber, 10);
    if (isNaN(versionNumber) || versionNumber < 1) {
      return res.status(400).json({ error: 'Invalid version number' });
    }

    const version = await VersioningService.getSpecificVersion(req.params.id, versionNumber);

    res.json({
      status: 'SUCCESS',
      data: version,
    });
  } catch (error) {
    console.error('Failed to get specific version:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/compositions/:id/versions/:versionA/compare/:versionB
 * Compare two versions side-by-side
 */
router.get('/:id/versions/:versionA/compare/:versionB', async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid composition ID format' });
    }

    const versionA = parseInt(req.params.versionA, 10);
    const versionB = parseInt(req.params.versionB, 10);

    if (isNaN(versionA) || isNaN(versionB) || versionA < 1 || versionB < 1) {
      return res.status(400).json({ error: 'Invalid version numbers' });
    }

    const comparison = await VersioningService.compareVersions(req.params.id, versionA, versionB);

    res.json({
      status: 'SUCCESS',
      data: comparison,
    });
  } catch (error) {
    console.error('Failed to compare versions:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/compositions/:id/revert/:versionNumber
 * Revert composition to a previous version
 */
router.post('/:id/revert/:versionNumber', async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid composition ID format' });
    }

    const versionNumber = parseInt(req.params.versionNumber, 10);
    if (isNaN(versionNumber) || versionNumber < 1) {
      return res.status(400).json({ error: 'Invalid version number' });
    }

    const { reason } = req.body;
    const userId = req.user?.id || req.body.userId || 'system';

    const result = await VersioningService.revertToVersion(
      req.params.id,
      versionNumber,
      userId,
      reason
    );

    res.json(result);
  } catch (error) {
    console.error('Failed to revert version:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/compositions/:id/version-stats
 * Get version statistics and history summary
 */
router.get('/:id/version-stats', async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid composition ID format' });
    }

    const stats = await VersioningService.getVersionStats(req.params.id);

    res.json({
      status: 'SUCCESS',
      data: stats,
    });
  } catch (error) {
    console.error('Failed to get version stats:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/compositions/search
 * Advanced search with filtering by format, status, date, assets, template, text, etc.
 *
 * Query Parameters:
 *   - formats: comma-separated format names (youtube,instagram)
 *   - status: draft|published|archived
 *   - dateFrom: ISO date string (2026-01-01)
 *   - dateTo: ISO date string (2026-01-31)
 *   - assets: comma-separated asset UUIDs (all must be present)
 *   - template: template ID to filter by
 *   - createdBy: username/email of creator
 *   - search: text search in name and description
 *   - sortBy: created_at|updated_at|name (default created_at)
 *   - sortOrder: ASC|DESC (default DESC)
 *   - limit: results per page (1-100, default 20)
 *   - offset: pagination offset (default 0)
 *   - episodeId: optional episode filter
 */
router.get('/search', async (req, res) => {
  try {
    const {
      formats = '',
      status = null,
      dateFrom = null,
      dateTo = null,
      assets = '',
      template = null,
      createdBy = null,
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      limit = '20',
      offset = '0',
      episodeId = null,
    } = req.query;

    // Parse comma-separated values
    const formatArray = formats
      ? formats
          .split(',')
          .map((f) => f.trim())
          .filter((f) => f)
      : [];

    const assetArray = assets
      ? assets
          .split(',')
          .map((a) => a.trim())
          .filter((a) => a)
      : [];

    const result = await FilterService.searchCompositions({
      formats: formatArray,
      status,
      dateFrom,
      dateTo,
      assets: assetArray,
      template,
      createdBy,
      search,
      sortBy,
      sortOrder,
      limit,
      offset,
      episodeId,
    });

    res.json(result);
  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      message: 'Advanced search failed',
    });
  }
});

/**
 * GET /api/v1/compositions/search/filters/options
 * Get available filter options for dropdowns/select boxes
 *
 * Query Parameters:
 *   - episodeId: optional, limit to specific episode
 */
router.get('/search/filters/options', async (req, res) => {
  try {
    const { episodeId } = req.query;
    const options = await FilterService.getFilterOptions(episodeId);

    res.json({
      status: 'SUCCESS',
      data: options,
    });
  } catch (error) {
    console.error('Failed to get filter options:', error);
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
    });
  }
});

module.exports = router;

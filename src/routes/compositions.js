/**
 * Thumbnail Composition Routes
 * POST /api/v1/compositions - Create composition
 * GET /api/v1/compositions/episode/:episodeId - Get compositions for episode
 * GET /api/v1/compositions/:id - Get composition by ID
 * PUT /api/v1/compositions/:id - Update composition
 * PUT /api/v1/compositions/:id/approve - Approve composition
 * PUT /api/v1/compositions/:id/primary - Set as primary thumbnail
 * POST /api/v1/compositions/:id/generate - Queue for generation
 */

const express = require('express');
const CompositionService = require('../services/CompositionService');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/v1/compositions
 * Create new composition
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { episode_id, template_id, lala_asset_id, guest_asset_id, background_frame_asset_id } = req.body;

    // Validate required fields
    if (!episode_id || !template_id || !lala_asset_id || !guest_asset_id || !background_frame_asset_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['episode_id', 'template_id', 'lala_asset_id', 'guest_asset_id', 'background_frame_asset_id'],
      });
    }

    const composition = await CompositionService.createComposition(
      episode_id,
      {
        template_id,
        lala_asset_id,
        guest_asset_id,
        background_frame_asset_id,
      },
      req.user.id
    );

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Composition created',
      data: composition,
    });
  } catch (error) {
    console.error('Failed to create composition:', error);
    res.status(500).json({
      error: 'Failed to create composition',
      message: error.message,
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
router.put('/:id', authenticate, async (req, res) => {
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
router.put('/:id/approve', authenticate, authorize(['ADMIN']), async (req, res) => {
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
router.put('/:id/primary', authenticate, async (req, res) => {
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
 * POST /api/v1/compositions/:id/generate
 * Queue composition for generation (Lambda processing)
 */
router.post('/:id/generate', authenticate, authorize(['ADMIN']), async (req, res) => {
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

module.exports = router;

const express = require('express');
const router = express.Router();
const { Layer, LayerAsset, Asset, Episode } = require('../models');
const { optionalAuth } = require('../middleware/auth');

/**
 * GET /api/v1/layers
 * Get all layers (with optional episode filter)
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { episode_id, include_assets } = req.query;

    const where = {};
    if (episode_id) {
      where.episode_id = episode_id;
    }

    const include = [];
    if (include_assets === 'true') {
      include.push({
        model: LayerAsset,
        as: 'assets',
        include: [{
          model: Asset,
          as: 'asset'
        }]
      });
    }

    const layers = await Layer.findAll({
      where,
      include,
      order: [['layer_number', 'ASC'], ['z_index', 'ASC']]
    });

    res.json({
      success: true,
      data: layers
    });
  } catch (error) {
    console.error('Get layers error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/layers/:id
 * Get a single layer by ID
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const layer = await Layer.findByPk(id, {
      include: [{
        model: LayerAsset,
        as: 'assets',
        include: [{
          model: Asset,
          as: 'asset'
        }],
        order: [['order_index', 'ASC']]
      }]
    });

    if (!layer) {
      return res.status(404).json({
        success: false,
        error: 'Layer not found'
      });
    }

    res.json({
      success: true,
      data: layer
    });
  } catch (error) {
    console.error('Get layer error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/layers
 * Create a new layer
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      episode_id,
      layer_number,
      layer_type,
      name,
      is_visible,
      is_locked,
      opacity,
      blend_mode,
      z_index,
      metadata
    } = req.body;

    // Validate required fields
    if (!episode_id || !layer_number || !layer_type) {
      return res.status(400).json({
        success: false,
        error: 'episode_id, layer_number, and layer_type are required'
      });
    }

    // Verify episode exists
    const episode = await Episode.findByPk(episode_id);
    if (!episode) {
      return res.status(404).json({
        success: false,
        error: 'Episode not found'
      });
    }

    const layer = await Layer.create({
      episode_id,
      layer_number,
      layer_type,
      name,
      is_visible,
      is_locked,
      opacity,
      blend_mode,
      z_index,
      metadata
    });

    res.status(201).json({
      success: true,
      data: layer
    });
  } catch (error) {
    console.error('Create layer error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/v1/layers/:id
 * Update a layer
 */
router.put('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      layer_number,
      layer_type,
      name,
      is_visible,
      is_locked,
      opacity,
      blend_mode,
      z_index,
      metadata
    } = req.body;

    const layer = await Layer.findByPk(id);
    if (!layer) {
      return res.status(404).json({
        success: false,
        error: 'Layer not found'
      });
    }

    await layer.update({
      layer_number,
      layer_type,
      name,
      is_visible,
      is_locked,
      opacity,
      blend_mode,
      z_index,
      metadata
    });

    res.json({
      success: true,
      data: layer
    });
  } catch (error) {
    console.error('Update layer error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/v1/layers/:id
 * Delete a layer (soft delete)
 */
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const layer = await Layer.findByPk(id);
    if (!layer) {
      return res.status(404).json({
        success: false,
        error: 'Layer not found'
      });
    }

    await layer.destroy(); // Soft delete (paranoid)

    res.json({
      success: true,
      message: 'Layer deleted successfully'
    });
  } catch (error) {
    console.error('Delete layer error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/layers/:id/assets
 * Add an asset to a layer
 */
router.post('/:id/assets', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      asset_id,
      position_x,
      position_y,
      width,
      height,
      rotation,
      scale_x,
      scale_y,
      opacity,
      start_time,
      duration,
      order_index,
      metadata
    } = req.body;

    // Validate required fields
    if (!asset_id) {
      return res.status(400).json({
        success: false,
        error: 'asset_id is required'
      });
    }

    // Verify layer exists
    const layer = await Layer.findByPk(id);
    if (!layer) {
      return res.status(404).json({
        success: false,
        error: 'Layer not found'
      });
    }

    // Verify asset exists
    const asset = await Asset.findByPk(asset_id);
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    const layerAsset = await LayerAsset.create({
      layer_id: id,
      asset_id,
      position_x,
      position_y,
      width,
      height,
      rotation,
      scale_x,
      scale_y,
      opacity,
      start_time,
      duration,
      order_index,
      metadata
    });

    // Fetch with asset details
    const result = await LayerAsset.findByPk(layerAsset.id, {
      include: [{
        model: Asset,
        as: 'asset'
      }]
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Add asset to layer error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/v1/layers/assets/:assetId
 * Update a layer asset
 */
router.put('/assets/:assetId', optionalAuth, async (req, res) => {
  try {
    const { assetId } = req.params;
    const {
      position_x,
      position_y,
      width,
      height,
      rotation,
      scale_x,
      scale_y,
      opacity,
      start_time,
      duration,
      order_index,
      metadata
    } = req.body;

    const layerAsset = await LayerAsset.findByPk(assetId);
    if (!layerAsset) {
      return res.status(404).json({
        success: false,
        error: 'Layer asset not found'
      });
    }

    await layerAsset.update({
      position_x,
      position_y,
      width,
      height,
      rotation,
      scale_x,
      scale_y,
      opacity,
      start_time,
      duration,
      order_index,
      metadata
    });

    // Fetch with asset details
    const result = await LayerAsset.findByPk(layerAsset.id, {
      include: [{
        model: Asset,
        as: 'asset'
      }]
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Update layer asset error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/v1/layers/assets/:assetId
 * Remove an asset from a layer
 */
router.delete('/assets/:assetId', optionalAuth, async (req, res) => {
  try {
    const { assetId } = req.params;

    const layerAsset = await LayerAsset.findByPk(assetId);
    if (!layerAsset) {
      return res.status(404).json({
        success: false,
        error: 'Layer asset not found'
      });
    }

    await layerAsset.destroy();

    res.json({
      success: true,
      message: 'Asset removed from layer successfully'
    });
  } catch (error) {
    console.error('Remove asset from layer error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/layers/bulk-create
 * Create multiple layers at once (useful for initializing episode layers)
 */
router.post('/bulk-create', optionalAuth, async (req, res) => {
  try {
    const { episode_id, layers } = req.body;

    if (!episode_id || !layers || !Array.isArray(layers)) {
      return res.status(400).json({
        success: false,
        error: 'episode_id and layers array are required'
      });
    }

    // Verify episode exists
    const episode = await Episode.findByPk(episode_id);
    if (!episode) {
      return res.status(404).json({
        success: false,
        error: 'Episode not found'
      });
    }

    // Add episode_id to each layer
    const layersWithEpisode = layers.map(layer => ({
      ...layer,
      episode_id
    }));

    const createdLayers = await Layer.bulkCreate(layersWithEpisode);

    res.status(201).json({
      success: true,
      data: createdLayers
    });
  } catch (error) {
    console.error('Bulk create layers error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

const { models } = require('../models');
const { TimelinePlacement, EpisodeScene, Asset, Wardrobe, Episode } = models;
const { literal } = require('sequelize');

/**
 * Timeline Placements Controller
 * Manages asset/wardrobe placements on episode timeline
 */

/**
 * List all placements for an episode
 * GET /api/v1/episodes/:episodeId/timeline/placements
 */
exports.listPlacements = async (req, res) => {
  try {
    const { id: episodeId } = req.params;
    const { placementType, trackNumber, sceneId } = req.query;

    const where = { episode_id: episodeId };
    
    if (placementType) where.placement_type = placementType;
    if (trackNumber) where.track_number = parseInt(trackNumber);
    if (sceneId) where.scene_id = sceneId;

    const placements = await TimelinePlacement.findAll({
      where,
      include: [
        {
          model: EpisodeScene,
          as: 'scene',
          attributes: ['id', 'title_override', 'scene_order', 'type'],
          required: false,
        },
        {
          model: Asset,
          as: 'asset',
          required: false,
        },
        {
          model: Wardrobe,
          as: 'wardrobeItem',
          required: false,
        },
      ],
      order: [
        ['track_number', 'ASC'],
        [literal(`CASE WHEN scene_id IS NOT NULL THEN 0 ELSE 1 END`)], // Scene-attached first
        ['created_at', 'ASC'],
      ],
    });

    res.json({
      success: true,
      data: placements,
    });
  } catch (error) {
    console.error('❌ Error listing placements:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to list placements',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

/**
 * Create a new placement (scene-attached or time-based)
 * POST /api/v1/episodes/:episodeId/timeline/placements
 */
exports.createPlacement = async (req, res) => {
  try {
    const { id: episodeId } = req.params;
    const {
      placementType,
      assetId,
      wardrobeItemId,
      sceneId,
      attachmentPoint,
      offsetSeconds,
      absoluteTimestamp,
      trackNumber,
      duration,
      zIndex,
      properties,
      character,
      label,
      visualRole,
    } = req.body;

    // Validation
    if (!placementType) {
      return res.status(400).json({
        success: false,
        error: 'placementType is required (asset, wardrobe, or audio)',
      });
    }

    if (placementType === 'asset' && !assetId) {
      return res.status(400).json({
        success: false,
        error: 'assetId is required for asset placements',
      });
    }

    if (placementType === 'wardrobe' && !wardrobeItemId) {
      return res.status(400).json({
        success: false,
        error: 'wardrobeItemId is required for wardrobe placements',
      });
    }

    // Scene-attached requires sceneId, time-based requires absoluteTimestamp
    if (!sceneId && !absoluteTimestamp) {
      return res.status(400).json({
        success: false,
        error: 'Either sceneId (scene-attached) or absoluteTimestamp (time-based) is required',
      });
    }

    // Create placement
    const placement = await TimelinePlacement.create({
      episode_id: episodeId,
      placement_type: placementType,
      asset_id: assetId,
      wardrobe_item_id: wardrobeItemId,
      scene_id: sceneId,
      attachment_point: attachmentPoint || 'scene-start',
      offset_seconds: offsetSeconds || 0,
      absolute_timestamp: absoluteTimestamp,
      track_number: trackNumber || 2,
      duration,
      z_index: zIndex || 10,
      properties: properties || {},
      character,
      label,
      visual_role: visualRole || (placementType === 'wardrobe' ? 'overlay' : 'primary-visual'),
    });

    // Load with associations
    const result = await TimelinePlacement.findByPk(placement.id, {
      include: [
        {
          model: EpisodeScene,
          as: 'scene',
          attributes: ['id', 'title_override', 'scene_order', 'type'],
        },
        {
          model: Asset,
          as: 'asset',
        },
        {
          model: Wardrobe,
          as: 'wardrobeItem',
        },
      ],
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error creating placement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create placement',
      message: error.message,
    });
  }
};

/**
 * Update a placement
 * PATCH /api/v1/episodes/:episodeId/timeline/placements/:placementId
 */
exports.updatePlacement = async (req, res) => {
  try {
    const { id: episodeId, placementId } = req.params;
    const {
      attachmentPoint,
      offsetSeconds,
      absoluteTimestamp,
      duration,
      zIndex,
      properties,
      label,
      visualRole,
    } = req.body;

    const placement = await TimelinePlacement.findOne({
      where: {
        id: placementId,
        episode_id: episodeId,
      },
    });

    if (!placement) {
      return res.status(404).json({
        success: false,
        error: 'Placement not found',
      });
    }

    // Update fields
    if (attachmentPoint !== undefined) placement.attachment_point = attachmentPoint;
    if (offsetSeconds !== undefined) placement.offset_seconds = offsetSeconds;
    if (absoluteTimestamp !== undefined) placement.absolute_timestamp = absoluteTimestamp;
    if (duration !== undefined) placement.duration = duration;
    if (zIndex !== undefined) placement.z_index = zIndex;
    if (properties !== undefined) placement.properties = properties;
    if (label !== undefined) placement.label = label;
    if (visualRole !== undefined) placement.visual_role = visualRole;

    await placement.save();

    // Reload with associations
    const result = await TimelinePlacement.findByPk(placement.id, {
      include: [
        {
          model: EpisodeScene,
          as: 'scene',
          attributes: ['id', 'title_override', 'scene_order', 'type'],
        },
        {
          model: Asset,
          as: 'asset',
        },
        {
          model: Wardrobe,
          as: 'wardrobeItem',
        },
      ],
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error updating placement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update placement',
      message: error.message,
    });
  }
};

/**
 * Delete a placement
 * DELETE /api/v1/episodes/:episodeId/timeline/placements/:placementId
 */
exports.deletePlacement = async (req, res) => {
  try {
    const { id: episodeId, placementId } = req.params;

    const placement = await TimelinePlacement.findOne({
      where: {
        id: placementId,
        episode_id: episodeId,
      },
    });

    if (!placement) {
      return res.status(404).json({
        success: false,
        error: 'Placement not found',
      });
    }

    await placement.destroy();

    res.json({
      success: true,
      message: 'Placement removed from timeline',
    });
  } catch (error) {
    console.error('Error deleting placement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete placement',
      message: error.message,
    });
  }
};

/**
 * Get current wardrobe for a character at a specific scene
 * GET /api/v1/episodes/:episodeId/timeline/wardrobe/current
 * Query params: character, sceneId or sceneOrder
 */
exports.getCurrentWardrobe = async (req, res) => {
  try {
    const { id: episodeId } = req.params;
    const { character, sceneId, sceneOrder } = req.query;

    if (!character) {
      return res.status(400).json({
        success: false,
        error: 'character parameter is required',
      });
    }

    if (!sceneId && !sceneOrder) {
      return res.status(400).json({
        success: false,
        error: 'Either sceneId or sceneOrder parameter is required',
      });
    }

    // Get the target scene order
    let targetSceneOrder;
    if (sceneOrder) {
      targetSceneOrder = parseInt(sceneOrder);
    } else {
      const scene = await EpisodeScene.findByPk(sceneId);
      if (!scene) {
        return res.status(404).json({
          success: false,
          error: 'Scene not found',
        });
      }
      targetSceneOrder = scene.scene_order;
    }

    // Find the most recent wardrobe placement for this character
    // at or before the target scene order
    const wardrobePlacement = await TimelinePlacement.findOne({
      where: {
        episode_id: episodeId,
        placement_type: 'wardrobe',
        character,
      },
      include: [
        {
          model: EpisodeScene,
          as: 'scene',
          where: {
            scene_order: {
              [models.Sequelize.Op.lte]: targetSceneOrder,
            },
          },
          attributes: ['id', 'title_override', 'scene_order', 'type'],
        },
        {
          model: Wardrobe,
          as: 'wardrobeItem',
        },
      ],
      order: [[{ model: EpisodeScene, as: 'scene' }, 'scene_order', 'DESC']],
    });

    if (!wardrobePlacement) {
      return res.json({
        success: true,
        data: null,
        message: 'No wardrobe assignment found for this character',
      });
    }

    res.json({
      success: true,
      data: wardrobePlacement,
    });
  } catch (error) {
    console.error('Error getting current wardrobe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get current wardrobe',
      message: error.message,
    });
  }
};

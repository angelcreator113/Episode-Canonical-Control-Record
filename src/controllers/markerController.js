const { models, sequelize } = require('../models');
const { Marker, Episode, Scene } = models;
const { Op } = require('sequelize');

/**
 * Marker Controller
 * Handles timeline marker CRUD operations (Phase 2)
 *
 * @module controllers/markerController
 */

/**
 * @route   GET /api/v1/episodes/:episodeId/markers
 * @desc    List all markers for an episode
 * @access  Authenticated
 * @query   {string} marker_type - Filter by type
 * @query   {string} category - Filter by category
 * @query   {number} start_time - Filter by time range start
 * @query   {number} end_time - Filter by time range end
 */
exports.listMarkers = async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { marker_type, category, start_time, end_time, include } = req.query;

    // Verify episode exists
    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      return res.status(404).json({
        success: false,
        error: 'Episode not found',
      });
    }

    const where = { episode_id: episodeId };

    // Apply filters
    if (marker_type) where.marker_type = marker_type;
    if (category) where.category = category;
    if (start_time && end_time) {
      where.timecode = {
        [Op.between]: [parseFloat(start_time), parseFloat(end_time)],
      };
    }

    const includeOptions = [];
    if (include && include.includes('scene')) {
      includeOptions.push({
        model: Scene,
        as: 'scene',
        attributes: ['id', 'title', 'scene_number', 'duration_seconds'],
      });
    }

    const markers = await Marker.findAll({
      where,
      include: includeOptions,
      order: [['timecode', 'ASC']],
    });

    res.json({
      success: true,
      data: markers,
      count: markers.length,
    });
  } catch (error) {
    console.error('Error listing markers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list markers',
      message: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/markers/:id
 * @desc    Get single marker by ID
 * @access  Authenticated
 */
exports.getMarker = async (req, res) => {
  try {
    const { id } = req.params;
    const { include } = req.query;

    const includeOptions = [];
    if (include && include.includes('episode')) {
      includeOptions.push({
        model: Episode,
        as: 'episode',
        attributes: ['id', 'title', 'episode_number'],
      });
    }
    if (include && include.includes('scene')) {
      includeOptions.push({
        model: Scene,
        as: 'scene',
        attributes: ['id', 'title', 'scene_number', 'duration_seconds'],
      });
    }

    const marker = await Marker.findByPk(id, { include: includeOptions });

    if (!marker) {
      return res.status(404).json({
        success: false,
        error: 'Marker not found',
      });
    }

    res.json({
      success: true,
      data: marker,
    });
  } catch (error) {
    console.error('Error getting marker:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get marker',
      message: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/episodes/:episodeId/markers
 * @desc    Create new marker
 * @access  Authenticated
 * @body    {number} timecode - Position in seconds (required)
 * @body    {string} title - Marker title
 * @body    {string} marker_type - Type (note, chapter, cue, script, deliverable)
 * @body    {string} category - Category
 * @body    {string} color - Hex color code
 * @body    {string} description - Description
 * @body    {string[]} tags - Array of tags
 * @body    {string} scene_id - Optional scene reference
 */
exports.createMarker = async (req, res) => {
  try {
    const { episodeId } = req.params;
    const {
      timecode,
      title,
      marker_type = 'note',
      category,
      color = '#3B82F6',
      description,
      tags = [],
      scene_id,
      deliverable_id,
      fulfillment_checkpoint = false,
      created_by,
    } = req.body;

    // Validate required fields
    if (timecode === undefined || timecode === null) {
      return res.status(400).json({
        success: false,
        error: 'Timecode is required',
      });
    }

    if (parseFloat(timecode) < 0) {
      return res.status(400).json({
        success: false,
        error: 'Timecode must be non-negative',
      });
    }

    // Verify episode exists
    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      return res.status(404).json({
        success: false,
        error: 'Episode not found',
      });
    }

    // Verify scene exists if provided
    if (scene_id) {
      const scene = await Scene.findByPk(scene_id);
      if (!scene) {
        return res.status(404).json({
          success: false,
          error: 'Scene not found',
        });
      }
      if (scene.episode_id !== episodeId) {
        return res.status(400).json({
          success: false,
          error: 'Scene does not belong to this episode',
        });
      }
    }

    // Create marker
    const marker = await Marker.create({
      episode_id: episodeId,
      scene_id: scene_id || null,
      timecode: parseFloat(timecode),
      title,
      marker_type,
      category,
      color,
      description,
      tags: Array.isArray(tags) ? tags : [],
      deliverable_id,
      fulfillment_checkpoint,
      created_by,
    });

    // Calculate scene relative time if scene is referenced
    if (scene_id) {
      await marker.calculateSceneRelativeTime();
      await marker.save();
    }

    res.status(201).json({
      success: true,
      data: marker,
      message: 'Marker created successfully',
    });
  } catch (error) {
    console.error('Error creating marker:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create marker',
      message: error.message,
    });
  }
};

/**
 * @route   PUT /api/v1/markers/:id
 * @desc    Update marker
 * @access  Authenticated
 */
exports.updateMarker = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      timecode,
      title,
      marker_type,
      category,
      color,
      description,
      tags,
      scene_id,
      deliverable_id,
      fulfillment_checkpoint,
      updated_by,
    } = req.body;

    console.log('🔵 [API] Updating marker:', id, 'with body:', req.body);

    const marker = await Marker.findByPk(id);
    if (!marker) {
      return res.status(404).json({
        success: false,
        error: 'Marker not found',
      });
    }

    // Validate timecode if provided
    if (timecode !== undefined && parseFloat(timecode) < 0) {
      return res.status(400).json({
        success: false,
        error: 'Timecode must be non-negative',
      });
    }

    // Verify scene exists if provided
    if (scene_id) {
      const scene = await Scene.findByPk(scene_id);
      if (!scene) {
        return res.status(404).json({
          success: false,
          error: 'Scene not found',
        });
      }
      if (scene.episode_id !== marker.episode_id) {
        return res.status(400).json({
          success: false,
          error: 'Scene does not belong to marker episode',
        });
      }
    }

    // Update fields
    if (timecode !== undefined) marker.timecode = parseFloat(timecode);
    if (title !== undefined) marker.title = title;
    if (marker_type !== undefined) marker.marker_type = marker_type;
    if (category !== undefined) marker.category = category;
    if (color !== undefined) marker.color = color;
    if (description !== undefined) marker.description = description;
    if (tags !== undefined) marker.tags = Array.isArray(tags) ? tags : [];
    if (scene_id !== undefined) marker.scene_id = scene_id;
    if (deliverable_id !== undefined) marker.deliverable_id = deliverable_id;
    if (fulfillment_checkpoint !== undefined)
      marker.fulfillment_checkpoint = fulfillment_checkpoint;
    if (updated_by !== undefined) marker.updated_by = updated_by;

    // Recalculate scene relative time if timecode or scene changed
    if ((timecode !== undefined || scene_id !== undefined) && marker.scene_id) {
      await marker.calculateSceneRelativeTime();
    }

    console.log('💾 [API] Saving marker:', id, 'timecode:', marker.timecode, 'scene_id:', marker.scene_id);
    await marker.save();
    console.log('✅ [API] Marker saved successfully');

    res.json({
      success: true,
      data: marker,
      message: 'Marker updated successfully',
    });
  } catch (error) {
    console.error('Error updating marker:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update marker',
      message: error.message,
    });
  }
};

/**
 * @route   DELETE /api/v1/markers/:id
 * @desc    Delete marker
 * @access  Authenticated
 */
exports.deleteMarker = async (req, res) => {
  try {
    const { id } = req.params;

    const marker = await Marker.findByPk(id);
    if (!marker) {
      return res.status(404).json({
        success: false,
        error: 'Marker not found',
      });
    }

    await marker.destroy();

    res.json({
      success: true,
      message: 'Marker deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting marker:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete marker',
      message: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/markers/:id/auto-scene-link
 * @desc    Automatically link marker to containing scene
 * @access  Authenticated
 */
exports.autoLinkScene = async (req, res) => {
  try {
    const { id } = req.params;

    const marker = await Marker.findByPk(id);
    if (!marker) {
      return res.status(404).json({
        success: false,
        error: 'Marker not found',
      });
    }

    const containingScene = await marker.findContainingScene();

    if (!containingScene) {
      return res.status(200).json({
        success: true,
        data: marker,
        message: 'Marker is outside scene boundaries - no scene linked',
      });
    }

    marker.scene_id = containingScene.scene.id;
    marker.scene_relative_timecode = containingScene.relativeTime;
    await marker.save();

    res.json({
      success: true,
      data: marker,
      scene: containingScene.scene,
      message: `Marker linked to scene: ${containingScene.scene.title}`,
    });
  } catch (error) {
    console.error('Error auto-linking scene:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to auto-link scene',
      message: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/episodes/:episodeId/markers/by-type/:markerType
 * @desc    Get markers by type
 * @access  Authenticated
 */
exports.getMarkersByType = async (req, res) => {
  try {
    const { episodeId, markerType } = req.params;

    const markers = await Marker.getByType(episodeId, markerType);

    res.json({
      success: true,
      data: markers,
      count: markers.length,
    });
  } catch (error) {
    console.error('Error getting markers by type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get markers by type',
      message: error.message,
    });
  }
};

const { models } = require('../models');
const { Op } = require('sequelize');

/**
 * Character Clip Controller
 * Handles character clip CRUD operations (Phase 2.5 - Animatic System)
 * Character clips are video segments for each character in a scene
 *
 * @module controllers/characterClipController
 */

// Get models from the models object
const CharacterClip = models.CharacterClip;
const Scene = models.Scene;
const Beat = models.Beat;
const CharacterProfile = models.CharacterProfile;

/**
 * @route   GET /api/v1/scenes/:sceneId/character-clips
 * @desc    List all character clips for a scene
 * @access  Authenticated
 * @query   {string} character_id - Filter by character
 * @query   {string} role - Filter by role
 * @query   {string} status - Filter by status
 */
exports.listCharacterClips = async (req, res) => {
  try {
    const { sceneId } = req.params;
    const { character_id, role, status, include } = req.query;

    // Verify scene exists
    const scene = await Scene.findByPk(sceneId);
    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    const where = { scene_id: sceneId };

    // Apply filters
    if (character_id) where.character_id = character_id;
    if (role) where.role = role;
    if (status) where.status = status;

    const includeOptions = [];
    if (include && include.includes('beat')) {
      includeOptions.push({
        model: Beat,
        as: 'beat',
        attributes: ['id', 'label', 'beat_type'],
      });
    }
    if (include && include.includes('character') && CharacterProfile) {
      includeOptions.push({
        model: CharacterProfile,
        as: 'character',
        attributes: ['id', 'name', 'avatar_url'],
      });
    }

    const clips = await CharacterClip.findAll({
      where,
      include: includeOptions,
      order: [['character_id', 'ASC'], ['start_time', 'ASC']],
    });

    res.json({
      success: true,
      data: clips,
      count: clips.length,
    });
  } catch (error) {
    console.error('Error listing character clips:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list character clips',
      message: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/character-clips/:id
 * @desc    Get single character clip by ID
 * @access  Authenticated
 */
exports.getCharacterClip = async (req, res) => {
  try {
    const { id } = req.params;

    const clip = await CharacterClip.findByPk(id, {
      include: [
        {
          model: Scene,
          as: 'scene',
          attributes: ['id', 'title', 'duration_seconds'],
        },
        {
          model: Beat,
          as: 'beat',
          attributes: ['id', 'label', 'beat_type'],
        },
      ],
    });

    if (!clip) {
      return res.status(404).json({
        success: false,
        error: 'Character clip not found',
      });
    }

    res.json({
      success: true,
      data: clip,
    });
  } catch (error) {
    console.error('Error getting character clip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get character clip',
      message: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/scenes/:sceneId/character-clips
 * @desc    Create new character clip
 * @access  Authenticated
 */
exports.createCharacterClip = async (req, res) => {
  try {
    const { sceneId } = req.params;
    const {
      character_id,
      beat_id,
      role,
      start_time,
      duration,
      video_url,
      expression,
      animation_type,
      metadata,
      status,
    } = req.body;

    // Verify scene exists
    const scene = await Scene.findByPk(sceneId);
    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    // Validate required fields
    if (!character_id || !role || start_time === undefined || !duration) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: character_id, role, start_time, duration',
      });
    }

    const clip = await CharacterClip.create({
      scene_id: sceneId,
      character_id,
      beat_id: beat_id || null,
      role,
      start_time,
      duration,
      video_url: video_url || null,
      expression: expression || null,
      animation_type: animation_type || null,
      metadata: metadata || {},
      status: status || 'placeholder',
    });

    res.status(201).json({
      success: true,
      data: clip,
    });
  } catch (error) {
    console.error('Error creating character clip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create character clip',
      message: error.message,
    });
  }
};

/**
 * @route   PATCH /api/v1/character-clips/:id
 * @desc    Update character clip
 * @access  Authenticated
 */
exports.updateCharacterClip = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const clip = await CharacterClip.findByPk(id);
    if (!clip) {
      return res.status(404).json({
        success: false,
        error: 'Character clip not found',
      });
    }

    await clip.update(updates);

    res.json({
      success: true,
      data: clip,
    });
  } catch (error) {
    console.error('Error updating character clip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update character clip',
      message: error.message,
    });
  }
};

/**
 * @route   DELETE /api/v1/character-clips/:id
 * @desc    Delete character clip
 * @access  Authenticated
 */
exports.deleteCharacterClip = async (req, res) => {
  try {
    const { id } = req.params;

    const clip = await CharacterClip.findByPk(id);
    if (!clip) {
      return res.status(404).json({
        success: false,
        error: 'Character clip not found',
      });
    }

    await clip.destroy();

    res.json({
      success: true,
      message: 'Character clip deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting character clip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete character clip',
      message: error.message,
    });
  }
};

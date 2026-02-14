const { models } = require('../models');
const { Op } = require('sequelize');

/**
 * Beat Controller
 * Handles beat CRUD operations (Phase 2.5 - Animatic System)
 * Beats are auto-generated timing markers linking script to timeline
 *
 * @module controllers/beatController
 */

// Get models from the models object
const Beat = models.Beat;
const Scene = models.Scene;
const CharacterProfile = models.CharacterProfile;

/**
 * @route   GET /api/v1/scenes/:sceneId/beats
 * @desc    List all beats for a scene
 * @access  Authenticated
 * @query   {string} beat_type - Filter by type
 * @query   {string} status - Filter by status
 */
exports.listBeats = async (req, res) => {
  try {
    const { sceneId } = req.params;
    const { beat_type, status, include } = req.query;

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
    if (beat_type) where.beat_type = beat_type;
    if (status) where.status = status;

    const includeOptions = [];
    if (include && include.includes('character') && CharacterProfile) {
      includeOptions.push({
        model: CharacterProfile,
        as: 'character',
        attributes: ['id', 'name', 'avatar_url'],
      });
    }

    const beats = await Beat.findAll({
      where,
      include: includeOptions,
      order: [['start_time', 'ASC']],
    });

    res.json({
      success: true,
      data: beats,
      count: beats.length,
    });
  } catch (error) {
    console.error('Error listing beats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list beats',
      message: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/beats/:id
 * @desc    Get single beat by ID
 * @access  Authenticated
 */
exports.getBeat = async (req, res) => {
  try {
    const { id } = req.params;

    const beat = await Beat.findByPk(id, {
      include: [
        {
          model: Scene,
          as: 'scene',
          attributes: ['id', 'title', 'duration_seconds'],
        },
      ],
    });

    if (!beat) {
      return res.status(404).json({
        success: false,
        error: 'Beat not found',
      });
    }

    res.json({
      success: true,
      data: beat,
    });
  } catch (error) {
    console.error('Error getting beat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get beat',
      message: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/scenes/:sceneId/beats
 * @desc    Create new beat
 * @access  Authenticated
 */
exports.createBeat = async (req, res) => {
  try {
    const { sceneId } = req.params;
    const { beat_type, character_id, label, start_time, duration, payload, status } = req.body;

    // Verify scene exists
    const scene = await Scene.findByPk(sceneId);
    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    // Validate required fields
    if (!beat_type || !label || start_time === undefined || !duration) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: beat_type, label, start_time, duration',
      });
    }

    const beat = await Beat.create({
      scene_id: sceneId,
      beat_type,
      character_id: character_id || null,
      label,
      start_time,
      duration,
      payload: payload || {},
      status: status || 'draft',
    });

    res.status(201).json({
      success: true,
      data: beat,
    });
  } catch (error) {
    console.error('Error creating beat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create beat',
      message: error.message,
    });
  }
};

/**
 * @route   PATCH /api/v1/beats/:id
 * @desc    Update beat
 * @access  Authenticated
 */
exports.updateBeat = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const beat = await Beat.findByPk(id);
    if (!beat) {
      return res.status(404).json({
        success: false,
        error: 'Beat not found',
      });
    }

    await beat.update(updates);

    res.json({
      success: true,
      data: beat,
    });
  } catch (error) {
    console.error('Error updating beat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update beat',
      message: error.message,
    });
  }
};

/**
 * @route   DELETE /api/v1/beats/:id
 * @desc    Delete beat
 * @access  Authenticated
 */
exports.deleteBeat = async (req, res) => {
  try {
    const { id } = req.params;

    const beat = await Beat.findByPk(id);
    if (!beat) {
      return res.status(404).json({
        success: false,
        error: 'Beat not found',
      });
    }

    await beat.destroy();

    res.json({
      success: true,
      message: 'Beat deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting beat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete beat',
      message: error.message,
    });
  }
};

const { models } = require('../models');
const { Op } = require('sequelize');

/**
 * Audio Clip Controller
 * Handles audio clip CRUD operations (Phase 2.5 - Animatic System)
 * Audio clips are TTS or real voice-over tracks
 *
 * @module controllers/audioClipController
 */

// Get models from the models object
const AudioClip = models.AudioClip;
const Scene = models.Scene;
const Beat = models.Beat;

/**
 * @route   GET /api/v1/scenes/:sceneId/audio-clips
 * @desc    List all audio clips for a scene
 * @access  Authenticated
 * @query   {string} track_type - Filter by type
 * @query   {string} status - Filter by status
 */
exports.listAudioClips = async (req, res) => {
  try {
    const { sceneId } = req.params;
    const { track_type, status, include } = req.query;

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
    if (track_type) where.track_type = track_type;
    if (status) where.status = status;

    const includeOptions = [];
    if (include && include.includes('beat')) {
      includeOptions.push({
        model: Beat,
        as: 'beat',
        attributes: ['id', 'label', 'beat_type'],
      });
    }

    const clips = await AudioClip.findAll({
      where,
      include: includeOptions,
      order: [['track_type', 'ASC'], ['start_time', 'ASC']],
    });

    res.json({
      success: true,
      data: clips,
      count: clips.length,
    });
  } catch (error) {
    console.error('Error listing audio clips:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list audio clips',
      message: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/audio-clips/:id
 * @desc    Get single audio clip by ID
 * @access  Authenticated
 */
exports.getAudioClip = async (req, res) => {
  try {
    const { id } = req.params;

    const clip = await AudioClip.findByPk(id, {
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
        error: 'Audio clip not found',
      });
    }

    res.json({
      success: true,
      data: clip,
    });
  } catch (error) {
    console.error('Error getting audio clip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audio clip',
      message: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/scenes/:sceneId/audio-clips
 * @desc    Create new audio clip
 * @access  Authenticated
 */
exports.createAudioClip = async (req, res) => {
  try {
    const { sceneId } = req.params;
    const { beat_id, track_type, start_time, duration, url, metadata, status } = req.body;

    // Verify scene exists
    const scene = await Scene.findByPk(sceneId);
    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    // Validate required fields
    if (!track_type || start_time === undefined || !duration || !url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: track_type, start_time, duration, url',
      });
    }

    const clip = await AudioClip.create({
      scene_id: sceneId,
      beat_id: beat_id || null,
      track_type,
      start_time,
      duration,
      url,
      metadata: metadata || {},
      status: status || 'tts',
    });

    res.status(201).json({
      success: true,
      data: clip,
    });
  } catch (error) {
    console.error('Error creating audio clip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create audio clip',
      message: error.message,
    });
  }
};

/**
 * @route   PATCH /api/v1/audio-clips/:id
 * @desc    Update audio clip
 * @access  Authenticated
 */
exports.updateAudioClip = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const clip = await AudioClip.findByPk(id);
    if (!clip) {
      return res.status(404).json({
        success: false,
        error: 'Audio clip not found',
      });
    }

    await clip.update(updates);

    res.json({
      success: true,
      data: clip,
    });
  } catch (error) {
    console.error('Error updating audio clip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update audio clip',
      message: error.message,
    });
  }
};

/**
 * @route   DELETE /api/v1/audio-clips/:id
 * @desc    Delete audio clip
 * @access  Authenticated
 */
exports.deleteAudioClip = async (req, res) => {
  try {
    const { id } = req.params;

    const clip = await AudioClip.findByPk(id);
    if (!clip) {
      return res.status(404).json({
        success: false,
        error: 'Audio clip not found',
      });
    }

    await clip.destroy();

    res.json({
      success: true,
      message: 'Audio clip deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting audio clip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete audio clip',
      message: error.message,
    });
  }
};

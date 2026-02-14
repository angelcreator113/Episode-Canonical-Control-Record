// animatic.js - Extended API Routes for Animatic System
// Phase 2.5: Beat Generation and Scene Composition

const express = require('express');
const router = express.Router();
const beatService = require('../services/beatService');
const { Scene, Beat, CharacterClip, AudioClip } = require('../models');
const asyncHandler = require('express-async-handler');

// ==========================================
// BEAT AUTO-GENERATION
// ==========================================

/**
 * POST /api/v1/scenes/:sceneId/beats/generate
 * Auto-generate beats from script lines
 * 
 * Body: {
 *   scriptLines: Array,
 *   options: { defaultDuration, paddingBetweenLines, autoGenerateIdle, includeUIBeats }
 * }
 */
router.post('/scenes/:sceneId/beats/generate', asyncHandler(async (req, res) => {
  const { sceneId } = req.params;
  const { scriptLines, options } = req.body;

  if (!scriptLines || !Array.isArray(scriptLines)) {
    return res.status(400).json({
      success: false,
      error: 'scriptLines array is required',
      message: 'Please provide an array of script lines'
    });
  }

  // Verify scene exists
  const scene = await Scene.findByPk(sceneId);
  if (!scene) {
    return res.status(404).json({
      success: false,
      error: 'Scene not found'
    });
  }

  const beats = await beatService.generateBeatsFromScript(
    sceneId,
    scriptLines,
    options || {}
  );

  res.status(201).json({
    success: true,
    data: {
      beats,
      count: beats.length,
      sceneId
    },
    message: `Generated ${beats.length} beats successfully`
  });
}));

/**
 * POST /api/v1/scenes/:sceneId/beats/preview
 * Preview beat generation without creating
 * 
 * Body: {
 *   scriptLines: Array,
 *   options: { defaultDuration, paddingBetweenLines, autoGenerateIdle, includeUIBeats }
 * }
 */
router.post('/scenes/:sceneId/beats/preview', asyncHandler(async (req, res) => {
  const { sceneId } = req.params;
  const { scriptLines, options } = req.body;

  if (!scriptLines || !Array.isArray(scriptLines)) {
    return res.status(400).json({
      success: false,
      error: 'scriptLines array is required'
    });
  }

  const preview = await beatService.previewGeneration(
    sceneId,
    scriptLines,
    options || {}
  );

  res.json({
    success: true,
    data: preview,
    message: 'Preview generated successfully'
  });
}));

/**
 * DELETE /api/v1/scenes/:sceneId/beats/clear
 * Clear all beats and character clips for a scene
 */
router.delete('/scenes/:sceneId/beats/clear', asyncHandler(async (req, res) => {
  const { sceneId } = req.params;

  // Verify scene exists
  const scene = await Scene.findByPk(sceneId);
  if (!scene) {
    return res.status(404).json({
      success: false,
      error: 'Scene not found'
    });
  }

  const result = await beatService.clearSceneBeats(sceneId);

  res.json({
    success: true,
    data: result,
    message: `Cleared ${result.beats_deleted} beats and ${result.clips_deleted} clips`
  });
}));

/**
 * POST /api/v1/scenes/:sceneId/beats/dialogue-clips
 * Generate dialogue clips for all dialogue beats
 */
router.post('/scenes/:sceneId/beats/dialogue-clips', asyncHandler(async (req, res) => {
  const { sceneId } = req.params;

  // Verify scene exists
  const scene = await Scene.findByPk(sceneId);
  if (!scene) {
    return res.status(404).json({
      success: false,
      error: 'Scene not found'
    });
  }

  const clips = await beatService.generateDialogueClips(sceneId);

  res.status(201).json({
    success: true,
    data: {
      clips,
      count: clips.length
    },
    message: `Generated ${clips.length} dialogue clips`
  });
}));

// ==========================================
// SCENE COMPOSITION
// ==========================================

/**
 * GET /api/v1/scenes/:sceneId/composition
 * Get complete scene composition (beats + character clips + audio clips)
 */
router.get('/scenes/:sceneId/composition', asyncHandler(async (req, res) => {
  const { sceneId } = req.params;

  // Verify scene exists
  const scene = await Scene.findByPk(sceneId, {
    attributes: ['id', 'title', 'duration_seconds']
  });

  if (!scene) {
    return res.status(404).json({
      success: false,
      error: 'Scene not found'
    });
  }

  // Get all components
  const beats = await beatService.getSceneBeats(sceneId);
  const characterClips = await beatService.getSceneCharacterClips(sceneId);
  
  const audioClips = await AudioClip.findAll({
    where: { scene_id: sceneId },
    order: [['track_type', 'ASC'], ['start_time', 'ASC']]
  });

  // Calculate statistics
  const stats = {
    total_beats: beats.length,
    dialogue_beats: beats.filter(b => b.beat_type === 'dialogue').length,
    ui_beats: beats.filter(b => b.beat_type === 'ui_action').length,
    total_character_clips: characterClips.length,
    dialogue_clips: characterClips.filter(c => c.role === 'dialogue').length,
    idle_clips: characterClips.filter(c => c.role === 'idle').length,
    total_audio_clips: audioClips.length,
    audio_by_type: {
      dialogue: audioClips.filter(a => a.track_type === 'dialogue').length,
      ambience: audioClips.filter(a => a.track_type === 'ambience').length,
      music: audioClips.filter(a => a.track_type === 'music').length,
      sfx: audioClips.filter(a => a.track_type === 'sfx').length,
      foley: audioClips.filter(a => a.track_type === 'foley').length
    }
  };

  res.json({
    success: true,
    data: {
      scene: {
        id: scene.id,
        title: scene.title,
        duration_seconds: scene.duration_seconds
      },
      beats,
      character_clips: characterClips,
      audio_clips: audioClips,
      stats
    }
  });
}));

/**
 * GET /api/v1/scenes/:sceneId/timeline
 * Get timeline-friendly representation of all tracks
 */
router.get('/scenes/:sceneId/timeline', asyncHandler(async (req, res) => {
  const { sceneId } = req.params;

  // Verify scene exists
  const scene = await Scene.findByPk(sceneId, {
    attributes: ['id', 'title', 'duration_seconds']
  });

  if (!scene) {
    return res.status(404).json({
      success: false,
      error: 'Scene not found'
    });
  }

  // Get all components
  const beats = await beatService.getSceneBeats(sceneId);
  const characterClips = await beatService.getSceneCharacterClips(sceneId);
  const audioClips = await AudioClip.findAll({
    where: { scene_id: sceneId },
    order: [['start_time', 'ASC']]
  });

  // Format for timeline visualization
  const timeline = {
    scene: {
      id: scene.id,
      title: scene.title,
      duration: parseFloat(scene.duration_seconds)
    },
    tracks: {
      beats: beats.map(b => ({
        id: b.id,
        type: b.beat_type,
        label: b.label,
        start: parseFloat(b.start_time),
        duration: parseFloat(b.duration),
        end: parseFloat(b.start_time) + parseFloat(b.duration),
        status: b.status,
        payload: b.payload
      })),
      character_clips: characterClips.map(c => ({
        id: c.id,
        character_id: c.character_id,
        role: c.role,
        start: parseFloat(c.start_time),
        duration: parseFloat(c.duration),
        end: parseFloat(c.start_time) + parseFloat(c.duration),
        expression: c.expression,
        animation: c.animation_type,
        status: c.status,
        video_url: c.video_url
      })),
      audio_clips: audioClips.map(a => ({
        id: a.id,
        track_type: a.track_type,
        start: parseFloat(a.start_time),
        duration: parseFloat(a.duration),
        end: parseFloat(a.start_time) + parseFloat(a.duration),
        status: a.status,
        url: a.url,
        metadata: a.metadata
      }))
    }
  };

  res.json({
    success: true,
    data: timeline
  });
}));

module.exports = router;

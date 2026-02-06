'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Scene, Episode } = require('../models');
const s3AIService = require('../services/s3AIService');
const videoJobService = require('../services/videoJobService');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configure multer for memory storage (we'll upload directly to S3)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, MOV, AVI, and WebM are allowed.'));
    }
  },
});

/**
 * POST /api/footage/upload
 * Upload raw video footage to S3 and create Scene record
 */
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
    const { episodeId, filename } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    if (!episodeId) {
      return res.status(400).json({ error: 'Episode ID is required' });
    }

    // Verify episode exists
    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    // Parse filename for scene detection (optional)
    const sceneInfo = parseFilename(filename || file.originalname);

    // Generate S3 key
    const fileExtension = path.extname(file.originalname);
    const s3Key = `episodes/${episodeId}/raw-footage/${uuidv4()}${fileExtension}`;

    console.log(`Uploading footage: ${s3Key}`);

    // Upload to S3
    const s3Result = await s3AIService.uploadRawFootage(
      file.buffer,
      s3Key,
      file.mimetype
    );

    console.log('S3 upload complete:', s3Result.key);

    // Queue FFmpeg metadata extraction job
    const job = await videoJobService.createJob({
      episode_id: episodeId,
      job_type: 'metadata_extraction',
      input_s3_key: s3Key,
      status: 'pending',
      priority: 1,
    });

    console.log('Metadata extraction job queued:', job.id);

    // Create Scene record with temporary metadata
    const scene = await Scene.create({
      episode_id: episodeId,
      name: sceneInfo.sceneName || file.originalname,
      scene_number: sceneInfo.sceneNumber || null,
      raw_footage_s3_key: s3Key,
      type: sceneInfo.sceneType || 'main',
      duration_seconds: null, // Will be populated by FFmpeg job
      ai_scene_detected: false,
      ai_confidence_score: null,
    });

    console.log('Scene created:', scene.id);

    res.json({
      success: true,
      scene: {
        id: scene.id,
        name: scene.name,
        raw_footage_s3_key: scene.raw_footage_s3_key,
        duration_seconds: scene.duration_seconds,
        s3_url: s3Result.url,
      },
      job: {
        id: job.id,
        status: job.status,
      },
    });

  } catch (error) {
    console.error('Footage upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed', 
      message: error.message 
    });
  }
});

/**
 * GET /api/footage/scenes/:episodeId
 * Get all scenes for an episode
 */
router.get('/scenes/:episodeId', async (req, res) => {
  try {
    const { episodeId } = req.params;

    const scenes = await Scene.findAll({
      where: { episode_id: episodeId },
      order: [
        ['scene_number', 'ASC'],
        ['created_at', 'ASC']
      ],
    });

    res.json({
      success: true,
      scenes,
      count: scenes.length,
    });

  } catch (error) {
    console.error('Get scenes error:', error);
    res.status(500).json({ error: 'Failed to get scenes' });
  }
});

/**
 * DELETE /api/footage/scenes/:sceneId
 * Delete a scene and its associated S3 file
 */
router.delete('/scenes/:sceneId', async (req, res) => {
  try {
    const { sceneId } = req.params;

    const scene = await Scene.findByPk(sceneId);
    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    // Delete from S3 if exists
    if (scene.raw_footage_s3_key) {
      try {
        await s3AIService.deleteFile(scene.raw_footage_s3_key);
        console.log('Deleted S3 file:', scene.raw_footage_s3_key);
      } catch (s3Error) {
        console.error('S3 deletion error:', s3Error);
        // Continue with database deletion even if S3 fails
      }
    }

    // Soft delete scene
    await scene.update({ deleted_at: new Date() });

    res.json({
      success: true,
      message: 'Scene deleted successfully',
    });

  } catch (error) {
    console.error('Delete scene error:', error);
    res.status(500).json({ error: 'Failed to delete scene' });
  }
});

/**
 * Parse filename for scene information
 * Expected format: EPISODE-SCENE-TAKE-N.mp4
 * Example: EP01-INTRO-TAKE-1.mp4
 */
function parseFilename(filename) {
  const baseName = path.basename(filename, path.extname(filename));
  const parts = baseName.split('-');

  const result = {
    sceneName: baseName,
    sceneNumber: null,
    sceneType: 'main',
    takeNumber: null,
  };

  if (parts.length >= 2) {
    // Try to detect scene type from name
    const secondPart = parts[1].toLowerCase();
    if (['intro', 'outro', 'transition'].includes(secondPart)) {
      result.sceneType = secondPart;
      result.sceneName = parts.slice(0, 2).join('-');
    }

    // Try to extract take number
    const lastPart = parts[parts.length - 1];
    const takeMatch = lastPart.match(/(\d+)$/);
    if (takeMatch) {
      result.takeNumber = parseInt(takeMatch[1]);
    }
  }

  return result;
}

module.exports = router;

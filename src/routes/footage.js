'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Scene, Episode } = require('../models');
const s3AIService = require('../services/s3AIService');
const logger = require('../utils/logger');
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

    // TODO: Queue FFmpeg metadata extraction job (Week 3)
    // For now, we'll skip the job queuing and just create the scene record
    console.log('Note: FFmpeg metadata extraction will be implemented in Week 3');

    // Create Scene record with temporary metadata
    const scene = await Scene.create({
      episode_id: episodeId,
      title: sceneInfo.sceneName || file.originalname,
      scene_number: sceneInfo.sceneNumber || null,
      raw_footage_s3_key: s3Key,
      type: sceneInfo.sceneType || 'main',
      duration_seconds: null, // Will be populated by FFmpeg job later
      ai_scene_detected: false,
      ai_confidence_score: null,
    });

    console.log('Scene created:', scene.id);

    res.json({
      success: true,
      scene: {
        id: scene.id,
        title: scene.title,
        raw_footage_s3_key: scene.raw_footage_s3_key,
        duration_seconds: scene.duration_seconds,
        s3_url: s3Result.url,
      },
    });

  } catch (error) {
    logger.error('Footage upload error', { error: error.message, stack: error.stack });
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
      where: { 
        episode_id: episodeId,
        deleted_at: null
      },
      attributes: [
        'id',
        'episode_id',
        'scene_number',
        'title',
        'description',
        'duration_seconds',
        'scene_type',
        'raw_footage_s3_key',
        'ai_scene_detected',
        'ai_confidence_score',
        'created_at',
        'updated_at'
      ],
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
    logger.error('Get scenes error', { error: error.message });
    res.status(500).json({ error: 'Failed to get scenes' });
  }
});

/**
 * POST /api/footage/episodes/:episodeId/assets
 * Link assets to an episode from the asset library
 */
router.post('/episodes/:episodeId/assets', async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { assetIds } = req.body;

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ error: 'assetIds must be a non-empty array' });
    }

    const { Episode, Asset } = require('../models');

    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    // Verify all assets exist
    const assets = await Asset.findAll({
      where: {
        id: assetIds
      }
    });

    if (assets.length !== assetIds.length) {
      return res.status(404).json({ error: 'One or more assets not found' });
    }

    // Link assets to episode (creates rows in episode_assets table)
    await episode.addAssets(assets);

    // Return the updated episode with its linked assets
    const updatedEpisode = await Episode.findByPk(episodeId, {
      include: [{
        model: Asset,
        as: 'assets',
        through: { attributes: [] } // Exclude junction table fields
      }]
    });

    res.json({
      success: true,
      episode: updatedEpisode,
      message: `Successfully linked ${assets.length} asset(s) to episode`
    });

  } catch (error) {
    console.error('Link assets error:', error);
    res.status(500).json({ error: 'Failed to link assets to episode' });
  }
});

/**
 * GET /api/footage/episodes/:episodeId/assets
 * Get all assets linked to an episode
 */
router.get('/episodes/:episodeId/assets', async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { Episode, Asset } = require('../models');

    const episode = await Episode.findByPk(episodeId, {
      include: [{
        model: Asset,
        as: 'assets',
        through: { attributes: [] }
      }]
    });

    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    res.json({
      success: true,
      assets: episode.assets || [],
      count: episode.assets ? episode.assets.length : 0
    });

  } catch (error) {
    console.error('Get episode assets error:', error);
    res.status(500).json({ error: 'Failed to get episode assets' });
  }
});

/**
 * DELETE /api/footage/episodes/:episodeId/assets/:assetId
 * Unlink a specific asset from an episode
 */
router.delete('/episodes/:episodeId/assets/:assetId', async (req, res) => {
  try {
    const { episodeId, assetId } = req.params;
    const { Episode, Asset } = require('../models');

    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const asset = await Asset.findByPk(assetId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Remove the association
    await episode.removeAsset(asset);

    res.json({
      success: true,
      message: 'Asset unlinked from episode'
    });

  } catch (error) {
    console.error('Unlink asset error:', error);
    res.status(500).json({ error: 'Failed to unlink asset from episode' });
  }
});

/**
 * DELETE /api/footage/scenes/:sceneId
 * Delete a scene and its associated S3 file
 */
router.delete('/scenes/:sceneId', async (req, res) => {
  try {
    const { sceneId } = req.params;
    console.log('DELETE request for scene:', sceneId);

    const scene = await Scene.findByPk(sceneId);
    if (!scene) {
      console.log('Scene not found:', sceneId);
      return res.status(404).json({ error: 'Scene not found' });
    }

    console.log('Scene found:', { id: scene.id, title: scene.title, s3_key: scene.raw_footage_s3_key });

    // Delete from S3 if exists
    if (scene.raw_footage_s3_key) {
      try {
        await s3AIService.deleteFile('episode-metadata-raw-footage-dev', scene.raw_footage_s3_key);
        console.log('Deleted S3 file:', scene.raw_footage_s3_key);
      } catch (s3Error) {
        console.error('S3 deletion error:', s3Error);
        // Continue with database deletion even if S3 fails
      }
    }

    // Soft delete scene (paranoid mode will set deleted_at automatically)
    await scene.destroy();
    console.log('Scene soft-deleted successfully:', sceneId);

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

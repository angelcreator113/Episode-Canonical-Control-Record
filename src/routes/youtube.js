const express = require('express');
const router = express.Router();
const youtubeService = require('../services/youtubeService');
const { optionalAuth } = require('../middleware/auth');

/**
 * POST /api/youtube/analyze
 * Analyze a YouTube video and save to training data
 */
router.post('/analyze', optionalAuth, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'YouTube URL is required'
      });
    }

    // Validate URL
    if (!youtubeService.isValidURL(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL'
      });
    }

    // Process video (this will take a while)
    const trainingData = await youtubeService.processVideo(url);

    res.json({
      success: true,
      data: trainingData
    });

  } catch (error) {
    console.error('YouTube analyze error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/youtube/metadata
 * Get metadata only (quick, no download)
 */
router.get('/metadata', optionalAuth, async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'YouTube URL is required'
      });
    }

    if (!youtubeService.isValidURL(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL'
      });
    }

    const metadata = await youtubeService.getMetadata(url);

    res.json({
      success: true,
      data: metadata
    });

  } catch (error) {
    console.error('YouTube metadata error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/youtube/library
 * Get all training videos
 */
router.get('/library', optionalAuth, async (req, res) => {
  try {
    const videos = await youtubeService.getTrainingVideos();

    res.json({
      success: true,
      data: videos,
      count: videos.length
    });

  } catch (error) {
    console.error('YouTube library error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/youtube/:id
 * Get single training video
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const video = await youtubeService.getTrainingVideo(req.params.id);

    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Training video not found'
      });
    }

    res.json({
      success: true,
      data: video
    });

  } catch (error) {
    console.error('YouTube get error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/youtube/:id
 * Delete training video
 */
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    await youtubeService.deleteTrainingVideo(req.params.id);

    res.json({
      success: true,
      message: 'Training video deleted'
    });

  } catch (error) {
    console.error('YouTube delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

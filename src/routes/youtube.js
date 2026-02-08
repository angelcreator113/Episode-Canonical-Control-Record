const express = require('express');
const router = express.Router();
const youtubeService = require('../services/youtubeService');
const { optionalAuth } = require('../middleware/auth');
const { sequelize, AITrainingData } = require('../models');

/**
 * POST /api/youtube/analyze
 * Analyze a YouTube video and save to training data
 */
router.post('/analyze', optionalAuth, async (req, res) => {
  try {
    const { url, detect_scenes = false } = req.body;

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
    const { trainingData, videoPath } = await youtubeService.processVideo(url, null, detect_scenes);

    // Process scenes if requested
    let scenes = [];
    if (detect_scenes && videoPath) {
      console.log('🎬 Processing scenes for video:', trainingData.id);
      try {
        scenes = await youtubeService.processScenes(
          trainingData.id,
          videoPath,
          {
            videoId: trainingData.video_id,
            duration: trainingData.duration_seconds || 0,
            title: trainingData.video_title || 'Unknown'
          }
        );
        console.log(`✅ Detected ${scenes.length} scenes`);
      } catch (sceneError) {
        console.error('Scene detection error:', sceneError);
        // Don't fail the whole request if scene detection fails
      }
    }

    res.json({
      success: true,
      data: {
        ...trainingData.toJSON(),
        scenes_count: scenes.length
      }
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
 * GET /api/youtube/:id/scenes
 * Get all scenes for a training video
 */
router.get('/:id/scenes', optionalAuth, async (req, res) => {
  try {
    const [scenes] = await sequelize.query(`
      SELECT 
        id,
        scene_number,
        start_time,
        end_time,
        duration,
        thumbnail_url,
        scene_type,
        shot_type,
        brightness_level,
        motion_level,
        analysis_result,
        created_at
      FROM video_scenes
      WHERE training_video_id = :video_id
      ORDER BY scene_number ASC
    `, {
      replacements: { video_id: req.params.id },
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: scenes,
      count: scenes.length
    });

  } catch (error) {
    console.error('Get scenes error:', error);
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

/**
 * POST /api/youtube/:id/detect-scenes
 * Re-analyze existing video to detect scenes
 */
router.post('/:id/detect-scenes', optionalAuth, async (req, res) => {
  try {
    const videoId = req.params.id;
    
    console.log(`🎬 Starting scene detection for video ${videoId}`);

    // Get video from database
    const video = await AITrainingData.findByPk(videoId);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    // Check if video has S3 key, if not download from YouTube
    let videoPath;
    
    if (video.s3_key) {
      // Download from S3
      console.log('📦 Downloading video from S3...');
      const s3Service = require('../services/s3Service');
      const bucketName = process.env.S3_TRAINING_DATA_BUCKET || 'episode-metadata-training-data-dev';
      videoPath = await s3Service.downloadFromS3(video.s3_key, bucketName);
    } else if (video.video_url) {
      // Download from YouTube if we have the URL
      console.log('📥 Downloading video from YouTube...');
      const path = require('path');
      videoPath = path.join('/tmp', `${video.video_id}.mp4`);
      await youtubeService.downloadVideo(video.video_url, videoPath);
      
      // Upload to S3 for future use
      console.log('☁️ Uploading to S3 for future use...');
      const s3Info = await youtubeService.uploadToS3(videoPath, video.video_id, false);
      
      // Update database with S3 key
      await video.update({ s3_key: s3Info.key });
      console.log('✅ Video uploaded to S3');
    } else {
      return res.status(400).json({
        success: false,
        error: 'Video not available - no S3 copy or YouTube URL found'
      });
    }

    console.log(`📹 Video downloaded to: ${videoPath}`);

    // Process scenes
    const scenes = await youtubeService.processScenes(
      video.id,
      videoPath,
      {
        videoId: video.video_id,
        duration: video.duration_seconds || 0,
        title: video.video_title || 'Unknown'
      }
    );

    console.log(`✅ Detected ${scenes.length} scenes`);

    res.json({
      success: true,
      data: {
        video_id: video.id,
        scenes_count: scenes.length,
        scenes: scenes
      }
    });

  } catch (error) {
    console.error('Scene detection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;




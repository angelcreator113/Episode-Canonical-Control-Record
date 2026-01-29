/**
 * SceneLibraryController
 * Handles scene library operations: upload, processing, CRUD
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const { models } = require('../models');
const { SceneLibrary, Show } = models;
const videoProcessingService = require('../services/VideoProcessingService');
const S3Service = require('../services/S3Service');

// Configure S3 Client
let s3Client = null;
const getS3Client = () => {
  if (!s3Client) {
    const config = {
      region: process.env.AWS_REGION || 'us-east-1',
    };

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    s3Client = new S3Client(config);
  }
  return s3Client;
};

const BUCKET_NAME =
  process.env.AWS_S3_BUCKET || process.env.S3_ASSET_BUCKET || 'primepisodes-assets';

/**
 * @route   GET /api/scene-library
 * @desc    List all scene library clips (show-scoped with filters)
 * @access  Public (temp - add auth later)
 * @query   showId, search, tags, processingStatus, sortBy, limit, offset
 */
exports.listLibraryScenes = async (req, res) => {
  try {
    const {
      showId,
      search,
      tags,
      processingStatus,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      limit = 50,
      offset = 0,
    } = req.query;

    // Build where clause
    const where = {};

    if (showId) {
      where.show_id = showId;
    }

    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (tags && tags.length > 0) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      where.tags = { [Op.overlap]: tagArray };
    }

    if (processingStatus) {
      where.processing_status = processingStatus;
    }

    // Fetch scenes
    const { rows: scenes, count: total } = await SceneLibrary.findAndCountAll({
      where,
      include: [
        {
          model: Show,
          as: 'show',
          attributes: ['id', 'name'],
        },
      ],
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.status(200).json({
      success: true,
      data: scenes,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total,
      },
    });
  } catch (error) {
    console.error('Error listing scene library:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list scene library',
      message: error.message,
    });
  }
};

/**
 * @route   GET /api/scene-library/:id
 * @desc    Get single scene library clip with details
 * @access  Public (temp)
 */
exports.getLibraryScene = async (req, res) => {
  try {
    const { id } = req.params;

    const scene = await SceneLibrary.findByPk(id, {
      include: [
        {
          model: Show,
          as: 'show',
          attributes: ['id', 'name'],
        },
        {
          model: models.EpisodeScene,
          as: 'episodeScenes',
          include: [
            {
              model: models.Episode,
              as: 'episode',
              attributes: ['id', 'title', 'season_number', 'episode_number'],
            },
          ],
        },
      ],
    });

    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    res.status(200).json({
      success: true,
      data: scene,
    });
  } catch (error) {
    console.error('Error getting scene library clip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scene',
      message: error.message,
    });
  }
};

/**
 * @route   POST /api/scene-library/upload
 * @desc    Upload video clip to scene library
 * @access  Public (temp)
 * @body    file (multipart), showId, title, description, tags, characters
 */
exports.uploadSceneClip = async (req, res) => {
  try {
    const { showId, title, description, tags, characters } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No video file provided',
      });
    }

    if (!showId) {
      return res.status(400).json({
        success: false,
        error: 'showId is required',
      });
    }

    // Verify show exists
    const show = await Show.findByPk(showId);
    if (!show) {
      return res.status(404).json({
        success: false,
        error: 'Show not found',
      });
    }

    // Generate unique IDs
    const sceneId = uuidv4();
    const fileExtension = file.originalname.split('.').pop();
    const s3Key = `shows/${showId}/scene-library/${sceneId}/clip.${fileExtension}`;

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await getS3Client().send(uploadCommand);

    const videoUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

    // Create scene library entry with "uploading" status
    const scene = await SceneLibrary.create({
      id: sceneId,
      show_id: showId,
      video_asset_url: videoUrl,
      s3_key: s3Key,
      title: title || `Scene ${Date.now()}`,
      description: description || null,
      tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
      characters: characters
        ? Array.isArray(characters)
          ? characters
          : JSON.parse(characters)
        : [],
      processing_status: 'processing',
      created_by: req.user?.id || 'system',
      updated_by: req.user?.id || 'system',
    });

    // Queue async processing (metadata extraction, thumbnail generation)
    // This would happen in background - for MVP, we'll return immediately
    // TODO: Implement async video processing queue

    // For now, simulate async by updating status after a delay (in production this would be a background job)
    setTimeout(async () => {
      try {
        await extractVideoMetadata(sceneId);
      } catch (error) {
        console.error('Error in async processing:', error);
        await SceneLibrary.update(
          {
            processing_status: 'failed',
            processing_error: error.message,
          },
          { where: { id: sceneId } }
        );
      }
    }, 100);

    res.status(201).json({
      success: true,
      data: scene,
      message: 'Video uploaded successfully, processing in background',
    });
  } catch (error) {
    console.error('Error uploading scene clip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload scene clip',
      message: error.message,
    });
  }
};

/**
 * @route   PUT /api/scene-library/:id
 * @desc    Update scene library metadata
 * @access  Public (temp)
 */
exports.updateLibraryScene = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, tags, characters } = req.body;

    const scene = await SceneLibrary.findByPk(id);

    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    // Update fields
    const updateData = {
      updated_by: req.user?.id || 'system',
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.tags = tags;
    if (characters !== undefined) updateData.characters = characters;

    await scene.update(updateData);

    res.status(200).json({
      success: true,
      data: scene,
      message: 'Scene updated successfully',
    });
  } catch (error) {
    console.error('Error updating scene:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update scene',
      message: error.message,
    });
  }
};

/**
 * @route   DELETE /api/scene-library/:id
 * @desc    Delete scene library clip (soft delete)
 * @access  Public (temp)
 */
exports.deleteLibraryScene = async (req, res) => {
  try {
    const { id } = req.params;

    const scene = await SceneLibrary.findByPk(id);

    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    // Check if scene is in use
    const episodeSceneCount = await models.EpisodeScene.count({
      where: { scene_library_id: id },
    });

    if (episodeSceneCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete scene that is used in episodes',
        message: `This scene is used in ${episodeSceneCount} episode(s)`,
      });
    }

    // Soft delete
    await scene.destroy();

    res.status(200).json({
      success: true,
      message: 'Scene deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting scene:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete scene',
      message: error.message,
    });
  }
};

/**
 * Extract video metadata and generate thumbnail
 * This is called asynchronously after upload
 */
async function extractVideoMetadata(sceneId) {
  try {
    console.log(`🎬 Starting video processing for scene ${sceneId}`);

    // Get the scene from database
    const scene = await SceneLibrary.findByPk(sceneId);
    if (!scene) {
      throw new Error('Scene not found');
    }

    // Download video from S3 to temp buffer for processing
    const s3Service = require('../services/S3Service');
    const bucket = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;

    // Get file from S3
    const videoBuffer = await s3Service.getFileAsBuffer(bucket, scene.s3_key);

    // Extract video metadata using ffmpeg
    console.log('📊 Extracting video metadata...');
    const metadata = await videoProcessingService.extractMetadata(videoBuffer);

    console.log('✅ Metadata extracted:', {
      duration: metadata.duration,
      width: metadata.video?.width,
      height: metadata.video?.height,
      size: metadata.size,
    });

    // Generate thumbnail (at 3 seconds or 20% into video, whichever is less)
    const thumbnailTimestamp = Math.min(3, metadata.duration * 0.2);
    console.log('🖼️  Generating thumbnail...');
    const thumbnailBuffer = await videoProcessingService.generateThumbnail(videoBuffer, {
      timestamp: thumbnailTimestamp,
      width: 320,
    });

    // Upload thumbnail to S3
    const thumbnailKey = `shows/${scene.show_id}/scene-library/${sceneId}/thumbnail.jpg`;
    console.log('☁️  Uploading thumbnail to S3...');
    await s3Service.uploadFile(bucket, thumbnailKey, thumbnailBuffer, {
      ContentType: 'image/jpeg',
    });

    const thumbnailUrl = `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${thumbnailKey}`;

    // Update scene with extracted metadata
    await SceneLibrary.update(
      {
        duration_seconds: Math.round(metadata.duration * 10) / 10, // Round to 1 decimal
        resolution: metadata.video ? `${metadata.video.width}x${metadata.video.height}` : null,
        file_size_bytes: metadata.size,
        thumbnail_url: thumbnailUrl,
        processing_status: 'ready',
        processing_error: null,
      },
      {
        where: { id: sceneId },
      }
    );

    console.log(`✅ Video processing complete for scene ${sceneId}`);
  } catch (error) {
    console.error(`❌ Video processing failed for scene ${sceneId}:`, error);

    // Update scene with error status
    await SceneLibrary.update(
      {
        processing_status: 'failed',
        processing_error: error.message,
      },
      {
        where: { id: sceneId },
      }
    );

    throw error;
  }
}

// Import Op for query operations
const { Op } = require('sequelize');

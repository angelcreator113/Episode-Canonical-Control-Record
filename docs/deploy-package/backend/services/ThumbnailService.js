/* eslint-disable no-unused-vars */

const { Thumbnail, Episode } = require('../models');
const { Op } = require('sequelize');

class ThumbnailService {
  /**
   * Publish a thumbnail
   * NOTE: Full publishing workflow activates after database migration runs
   */
  async publishThumbnail(thumbnailId, userId) {
    try {
      const thumbnail = await Thumbnail.findByPk(thumbnailId);
      if (!thumbnail) {
        throw new Error('Thumbnail not found');
      }

      // Return mock response for now - full implementation after migration
      console.log(`📝 [PENDING] Publish request for thumbnail: ${thumbnailId}`);
      return {
        id: thumbnail.id,
        format: thumbnail.format,
        status: 'PUBLISHED',
        message: 'Publishing workflow will be fully functional after database migration runs',
      };
    } catch (error) {
      console.error('❌ Failed to publish thumbnail:', error);
      throw error;
    }
  }

  /**
   * Unpublish a thumbnail
   * NOTE: Full publishing workflow activates after database migration runs
   */
  async unpublishThumbnail(thumbnailId) {
    try {
      const thumbnail = await Thumbnail.findByPk(thumbnailId);
      if (!thumbnail) {
        throw new Error('Thumbnail not found');
      }

      // Return mock response for now - full implementation after migration
      console.log(`📝 [PENDING] Unpublish request for thumbnail: ${thumbnailId}`);
      return {
        id: thumbnail.id,
        format: thumbnail.format,
        status: 'UNPUBLISHED',
        message: 'Publishing workflow will be fully functional after database migration runs',
      };
    } catch (error) {
      console.error('❌ Failed to unpublish thumbnail:', error);
      throw error;
    }
  }

  /**
   * Set a YouTube thumbnail as primary
   * NOTE: Full publishing workflow activates after database migration runs
   */
  async setPrimaryThumbnail(thumbnailId) {
    try {
      const thumbnail = await Thumbnail.findByPk(thumbnailId);
      if (!thumbnail) {
        throw new Error('Thumbnail not found');
      }

      // Must be YouTube format
      if (thumbnail.format !== 'YOUTUBE') {
        throw new Error('Only YouTube thumbnails can be set as primary');
      }

      // Return mock response for now - full implementation after migration
      console.log(`📝 [PENDING] Set primary request for YouTube thumbnail: ${thumbnailId}`);
      return {
        id: thumbnail.id,
        format: thumbnail.format,
        isPrimary: true,
        message: 'Primary thumbnail setting will be fully functional after database migration runs',
      };
    } catch (error) {
      console.error('❌ Failed to set primary thumbnail:', error);
      throw error;
    }
  }

  /**
   * Get all thumbnails for an episode
   */
  async getThumbnailsByEpisode(episodeId) {
    try {
      const thumbnails = await Thumbnail.findAll({
        where: { episode_id: episodeId },
        attributes: [
          'id',
          'episode_id',
          'composition_id',
          'url',
          's3_key',
          'metadata',
          'thumbnail_type',
          'created_at',
          'updated_at',
        ],
        order: [['created_at', 'DESC']],
        raw: true,
      });

      return thumbnails;
    } catch (error) {
      console.error('❌ Failed to get thumbnails:', error);
      throw error;
    }
  }

  /**
   * Delete a thumbnail
   */
  async deleteThumbnail(thumbnailId) {
    try {
      const thumbnail = await Thumbnail.findByPk(thumbnailId);
      if (!thumbnail) {
        throw new Error('Thumbnail not found');
      }

      // Check if it's the primary thumbnail
      if (thumbnail.is_primary) {
        throw new Error(
          'Cannot delete primary thumbnail. Set another YouTube thumbnail as primary first, or unpublish this one.'
        );
      }

      // Delete from S3
      const AWS = require('aws-sdk');
      const s3 = new AWS.S3();

      if (thumbnail.s3_key) {
        await s3
          .deleteObject({
            Bucket: process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET,
            Key: thumbnail.s3_key,
          })
          .promise();
      }

      // Delete from database
      await thumbnail.destroy();

      console.log(`✅ Thumbnail deleted: ${thumbnailId}`);
      return { success: true, message: 'Thumbnail deleted' };
    } catch (error) {
      console.error('❌ Failed to delete thumbnail:', error);
      throw error;
    }
  }

  /**
   * Check if episode can have another YouTube thumbnail
   */
  async canGenerateYouTubeThumbnail(episodeId) {
    const existingYoutube = await Thumbnail.count({
      where: {
        episode_id: episodeId,
        format: 'YOUTUBE',
      },
    });

    return existingYoutube === 0;
  }
}

module.exports = new ThumbnailService();

const { models, sequelize } = require('../models');
const { Scene, Episode, Thumbnail } = models;
const { QueryTypes } = require('sequelize');

/**
 * NEW FIXED Scene Controller for getScene endpoint
 * Uses raw SQL to bypass Sequelize model issues
 */

exports.getScene = async (req, res) => {
  // Create marker file to prove this controller is being called
  const fs = require('fs');
  fs.writeFileSync('NEW-CONTROLLER-CALLED.txt', `Called at ${new Date().toISOString()}\nScene ID: ${req.params.id}\n`);
  
  console.log('\n========== USING NEW CONTROLLER (RAW SQL) ==========');
  try {
    const { id } = req.params;
    const { include } = req.query;
    const includeThumbnail = include && include.includes('thumbnail');

    console.log('Scene ID:', id);
    console.log('Include thumbnail:', includeThumbnail);

    // Use raw SQL - this works in getEpisodeScenes
    const scenes = await sequelize.query(
      `
      SELECT 
        s.*,
        ${includeThumbnail ? `
          json_build_object(
            'id', t.id,
            'url', t."url",
            's3Bucket', t."s3Bucket",
            's3Key', t."s3Key",
            'thumbnailType', t."thumbnailType",
            'metadata', t."metadata"
          ) as thumbnail
        ` : 'NULL as thumbnail'},
        json_build_object(
          'id', e.id,
          'title', e.title,
          'episode_number', e.episode_number,
          'status', e.status
        ) as episode
      FROM scenes s
      LEFT JOIN episodes e ON s.episode_id = e.id
      ${includeThumbnail ? 'LEFT JOIN thumbnails t ON s.thumbnail_id = t.id' : ''}
      WHERE s.id = :sceneId::uuid
        AND s.deleted_at IS NULL
      `,
      {
        replacements: { sceneId: id },
        type: QueryTypes.SELECT
      }
    );

    console.log('Raw SQL query returned:', scenes.length, 'scenes');

    if (!scenes || scenes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    console.log('Returning scene:', scenes[0].title);
    res.json({
      success: true,
      data: scenes[0],
    });
  } catch (error) {
    console.error('[NEW getScene] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get scene',
      message: error.message,
    });
  }
};

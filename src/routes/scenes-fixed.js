const express = require('express');
const router = express.Router();
const { models, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateUUIDParam } = require('../middleware/requestValidation');

console.log('!!!!!!!!! LOADING FIXED SCENES ROUTE FILE !!!!!!!!!');

/**
 * FIXED Scene Route - bypasses all caching issues
 */

router.get('/:id', validateUUIDParam('id'), asyncHandler(async (req, res) => {
  const fs = require('fs');
  fs.writeFileSync('INLINE-HANDLER-CALLED.txt', `Called at ${new Date().toISOString()}\n`);
  
  console.log('========== INLINE HANDLER IN FIXED ROUTE FILE ==========');
  console.log('Scene ID:', req.params.id);
  
  try {
    const { id } = req.params;
    const { include } = req.query;
    const includeThumbnail = include && include.includes('thumbnail');

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

    if (!scenes || scenes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    res.json({
      success: true,
      data: scenes[0],
      _note: 'Retrieved via FIXED route with inline handler'
    });
  } catch (error) {
    console.error('[FIXED ROUTE] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get scene',
      message: error.message,
    });
  }
}));

module.exports = router;

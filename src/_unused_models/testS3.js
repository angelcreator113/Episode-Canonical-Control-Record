const express = require('express');
const router = express.Router();
const s3AIService = require('../services/s3AIService');

/**
 * Test S3 upload endpoint
 * POST /api/test-s3/upload-raw
 */
router.post('/upload-raw', async (req, res) => {
  try {
    const testBuffer = Buffer.from('Test raw footage file');
    const result = await s3AIService.uploadRawFootage(
      testBuffer,
      'test-clip.mp4',
      'test-episode-id',
      'test-scene-id'
    );
    
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test presigned URL generation
 * GET /api/test-s3/presigned-url
 */
router.get('/presigned-url', async (req, res) => {
  try {
    const { bucket, key } = req.query;
    const url = await s3AIService.getPresignedUrl(bucket, key, 3600);
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

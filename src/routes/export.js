/**
 * Export API Routes
 * Handles video export job creation, status tracking, listing, and cancellation
 */

const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { addExportJob, getExportJob, getQueueStats, cancelExportJob, videoQueue } = require('../queues/videoQueue');
const db = require('../config/database');
const { sequelize } = require('../models');
const s3Service = require('../services/S3Service');
const AWS = require('aws-sdk');

// Use optionalAuth in dev so exports work without Cognito tokens
const authMiddleware = process.env.NODE_ENV === 'production' ? authenticate : optionalAuth;

// ============================================================================
// POST /api/v1/episodes/:episodeId/export  — Start a new export job
// ============================================================================
router.post('/episodes/:episodeId/export', authMiddleware, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { platform, quality, format, compositionId } = req.body;
    const userId = req.user?.id || 'anonymous';

    // Validate required fields
    if (!platform || !quality || !format) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'platform, quality, and format are required',
      });
    }

    // Platform resolution map
    const platformResolutions = {
      youtube:   { width: 1920, height: 1080 },
      instagram: { width: 1080, height: 1920 },
      tiktok:    { width: 1080, height: 1920 },
      twitter:   { width: 1200, height: 675 },
      square:    { width: 1080, height: 1080 },
      cinema:    { width: 2560, height: 1440 },
    };

    // Quality override (quality preset can override platform-default res)
    const qualityResolutions = {
      '4k':    { width: 3840, height: 2160 },
      '1080p': { width: 1920, height: 1080 },
      '720p':  { width: 1280, height: 720 },
      '480p':  { width: 854,  height: 480 },
    };

    const platformRes = platformResolutions[platform] || platformResolutions.youtube;
    const qualityRes = qualityResolutions[quality];
    const resolution = qualityRes
      ? `${qualityRes.width}x${qualityRes.height}`
      : `${platformRes.width}x${platformRes.height}`;

    // Fetch episode to verify it exists
    const [episodeRows] = await sequelize.query(
      'SELECT id, title, episode_number, show_id FROM episodes WHERE id = $1',
      { bind: [episodeId] }
    );

    if (!episodeRows || episodeRows.length === 0) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const episode = episodeRows[0];

    // Fetch scenes for this episode
    const [scenes] = await sequelize.query(
      `SELECT id, title, scene_number, duration_seconds, background_url,
              characters, ui_elements
       FROM scenes
       WHERE episode_id = $1
       ORDER BY scene_number ASC`,
      { bind: [episodeId] }
    );

    if (scenes.length === 0) {
      return res.status(400).json({
        error: 'No scenes found',
        message: 'Episode must have at least one scene to export',
      });
    }

    // Fetch timeline data (keyframes, etc) if available
    let timelineData = null;
    try {
      const [tlRows] = await sequelize.query(
        `SELECT keyframes, beats, markers, audio_clips, character_clips
         FROM timeline_data
         WHERE episode_id = $1
         LIMIT 1`,
        { bind: [episodeId] }
      );
      if (tlRows && tlRows.length > 0) {
        timelineData = tlRows[0];
      }
    } catch (e) {
      // timeline_data table may not exist — non-fatal
      console.warn('Could not fetch timeline data:', e.message);
    }

    // Build the export job payload
    const jobData = {
      episodeId,
      compositionId: compositionId || null,
      format: format || 'mp4',
      resolution,
      quality: quality || '1080p',
      platform,
      userId,
      episode: {
        id: episode.id,
        title: episode.title,
        episode_number: episode.episode_number,
      },
      scenes: scenes.map((s) => ({
        id: s.id,
        title: s.title,
        scene_number: s.scene_number,
        duration_seconds: s.duration_seconds || 5,
        background_url: s.background_url,
        background_color: '#1a1a2e',
        characters: s.characters || [],
        ui_elements: s.ui_elements || [],
      })),
      timelineData,
    };

    // Add to Bull queue (requires Redis)
    let job;
    try {
      job = await addExportJob(jobData);
    } catch (queueError) {
      // Redis/Bull unavailable — return a clear error instead of generic 500
      const isRedisDown = queueError.message.includes('Connection is closed')
        || queueError.message.includes('ECONNREFUSED');
      if (isRedisDown) {
        console.warn('Export queue unavailable (Redis not running):', queueError.message);
        return res.status(503).json({
          success: false,
          error: 'Export service unavailable',
          message: 'Video export requires Redis which is not currently running. Please try again later or contact support.',
        });
      }
      throw queueError; // Re-throw non-Redis errors
    }

    return res.status(202).json({
      success: true,
      message: 'Export job queued',
      jobId: job.id,
      status: 'queued',
      episode: {
        id: episode.id,
        title: episode.title,
      },
      settings: { platform, quality, format, resolution },
    });
  } catch (error) {
    console.error('Export route error:', error);
    return res.status(500).json({
      error: 'Failed to start export',
      message: error.message,
    });
  }
});

// ============================================================================
// GET /api/v1/export/status/:jobId  — Get status of a specific export job
// ============================================================================
router.get('/export/status/:jobId', authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await getExportJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Export job not found' });
    }

    const state = await job.getState();
    const progress = job.progress();
    const result = job.returnvalue;
    const failedReason = job.failedReason;

    return res.json({
      jobId: job.id,
      state,
      progress: typeof progress === 'number' ? progress : progress?.percent || 0,
      stage: progress?.stage || null,
      createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      settings: {
        platform: job.data.platform,
        quality: job.data.quality,
        format: job.data.format,
        resolution: job.data.resolution,
      },
      result: state === 'completed' ? result : null,
      error: state === 'failed' ? failedReason : null,
      attempts: job.attemptsMade,
    });
  } catch (error) {
    console.error('Export status error:', error);
    return res.status(500).json({ error: 'Failed to get export status', message: error.message });
  }
});

// ============================================================================
// GET /api/v1/exports  — List recent export jobs for the current user
// ============================================================================
router.get('/exports', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const limit = parseInt(req.query.limit) || 20;

    // Get recent jobs from all states
    const [waiting, active, completed, failed] = await Promise.all([
      videoQueue.getWaiting(0, limit),
      videoQueue.getActive(0, limit),
      videoQueue.getCompleted(0, limit),
      videoQueue.getFailed(0, limit),
    ]);

    const allJobs = [...waiting, ...active, ...completed, ...failed];

    // Filter by userId and format response
    const userJobs = allJobs
      .filter((job) => job.data.userId === userId)
      .map((job) => ({
        jobId: job.id,
        episodeId: job.data.episodeId,
        episodeTitle: job.data.episode?.title || 'Unknown',
        platform: job.data.platform,
        quality: job.data.quality,
        format: job.data.format,
        resolution: job.data.resolution,
        createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
        completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        progress: typeof job.progress() === 'number' ? job.progress() : 0,
        result: job.returnvalue || null,
        error: job.failedReason || null,
      }));

    // Sort by created date descending
    userJobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Get queue stats
    const stats = await getQueueStats();

    return res.json({
      exports: userJobs.slice(0, limit),
      total: userJobs.length,
      queueStats: stats,
    });
  } catch (error) {
    console.error('List exports error:', error);
    return res.status(500).json({ error: 'Failed to list exports', message: error.message });
  }
});

// ============================================================================
// DELETE /api/v1/export/:jobId  — Cancel a pending export job
// ============================================================================
router.delete('/export/:jobId', authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await getExportJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Export job not found' });
    }

    const state = await job.getState();

    if (state === 'completed') {
      return res.status(400).json({
        error: 'Cannot cancel completed job',
        message: 'This export has already finished',
      });
    }

    await cancelExportJob(jobId);

    return res.json({
      success: true,
      message: `Export job ${jobId} cancelled`,
      previousState: state,
    });
  } catch (error) {
    console.error('Cancel export error:', error);
    return res.status(500).json({ error: 'Failed to cancel export', message: error.message });
  }
});

// ============================================================================
// GET /api/v1/export/download/:jobId  — Get download URL for completed export
// ============================================================================
router.get('/export/download/:jobId', authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await getExportJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Export job not found' });
    }

    const state = await job.getState();

    if (state !== 'completed') {
      return res.status(400).json({
        error: 'Export not ready',
        message: `Export is currently ${state}`,
      });
    }

    const result = job.returnvalue;

    const rawUrl = result?.downloadUrl || result?.s3Url || result?.videoUrl;

    if (!rawUrl) {
      return res.status(404).json({
        error: 'Download not available',
        message: 'Export completed but no download URL available',
      });
    }

    // Generate a presigned URL so the browser can actually download the file
    let downloadUrl = rawUrl;
    try {
      const urlObj = new URL(rawUrl);
      // Parse bucket and key from S3 URL patterns:
      //   https://<bucket>.s3.amazonaws.com/<key>
      //   https://s3.<region>.amazonaws.com/<bucket>/<key>
      let bucket, key;
      if (urlObj.hostname.endsWith('.s3.amazonaws.com')) {
        bucket = urlObj.hostname.replace('.s3.amazonaws.com', '');
        key = decodeURIComponent(urlObj.pathname.slice(1));
      } else if (urlObj.hostname.startsWith('s3.') && urlObj.hostname.endsWith('.amazonaws.com')) {
        const parts = urlObj.pathname.slice(1).split('/');
        bucket = parts[0];
        key = decodeURIComponent(parts.slice(1).join('/'));
      }

      if (bucket && key) {
        const fileName = result.fileName || `export-${jobId}.${job.data.format || 'mp4'}`;
        downloadUrl = await s3Service.getPreSignedUrl(bucket, key, 3600, {
          ResponseContentDisposition: `attachment; filename="${fileName}"`,
        });
        console.log(`[Export] Generated presigned URL for ${bucket}/${key}`);
      }
    } catch (presignErr) {
      console.warn('[Export] Could not generate presigned URL, using raw URL:', presignErr.message);
    }

    return res.json({
      downloadUrl,
      fileName: result.fileName || `export-${jobId}.${job.data.format || 'mp4'}`,
      fileSize: result.fileSize || null,
      format: job.data.format,
    });
  } catch (error) {
    console.error('Download export error:', error);
    return res.status(500).json({ error: 'Failed to get download URL', message: error.message });
  }
});

// ============================================================================
// GET /api/v1/export/file/:jobId  — Stream the file through the backend (avoids CORS)
// ============================================================================
router.get('/export/file/:jobId', authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await getExportJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Export job not found' });
    }

    const state = await job.getState();
    if (state !== 'completed') {
      return res.status(400).json({ error: 'Export not ready', message: `Export is currently ${state}` });
    }

    const result = job.returnvalue;
    const rawUrl = result?.downloadUrl || result?.s3Url || result?.videoUrl;

    if (!rawUrl) {
      return res.status(404).json({ error: 'Download not available' });
    }

    // Parse bucket and key from the S3 URL
    let bucket, key;
    try {
      const urlObj = new URL(rawUrl);
      if (urlObj.hostname.endsWith('.s3.amazonaws.com')) {
        bucket = urlObj.hostname.replace('.s3.amazonaws.com', '');
        key = decodeURIComponent(urlObj.pathname.slice(1));
      } else if (urlObj.hostname.startsWith('s3.') && urlObj.hostname.endsWith('.amazonaws.com')) {
        const parts = urlObj.pathname.slice(1).split('/');
        bucket = parts[0];
        key = decodeURIComponent(parts.slice(1).join('/'));
      }
    } catch (e) {
      return res.status(500).json({ error: 'Could not parse S3 URL' });
    }

    if (!bucket || !key) {
      return res.status(500).json({ error: 'Could not determine S3 bucket/key' });
    }

    const format = job.data.format || 'mp4';
    const fileName = result.fileName || `export-${jobId}.${format}`;
    const mimeTypes = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

    // If ?preview=true, serve inline for in-browser playback; otherwise attachment for download
    const isPreview = req.query.preview === 'true';
    const disposition = isPreview ? 'inline' : `attachment; filename="${fileName}"`;

    console.log(`[Export] Streaming file ${bucket}/${key} as ${fileName} (${isPreview ? 'preview' : 'download'})`);

    const s3 = new AWS.S3({
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    // Get the object metadata first to set Content-Length
    try {
      const head = await s3.headObject({ Bucket: bucket, Key: key }).promise();
      res.setHeader('Content-Length', head.ContentLength);
    } catch (headErr) {
      console.warn('[Export] Could not HEAD object:', headErr.message);
    }

    res.setHeader('Content-Type', mimeTypes[format] || 'application/octet-stream');
    res.setHeader('Content-Disposition', disposition);

    const s3Stream = s3.getObject({ Bucket: bucket, Key: key }).createReadStream();
    s3Stream.on('error', (err) => {
      console.error('[Export] S3 stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file from S3' });
      } else {
        res.end();
      }
    });
    s3Stream.pipe(res);
  } catch (error) {
    console.error('File stream error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to stream file', message: error.message });
    }
  }
});

module.exports = router;

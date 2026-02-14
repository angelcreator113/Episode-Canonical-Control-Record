/**
 * Export API Routes
 * Handles video export job creation, status tracking, listing, and cancellation
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { addExportJob, getExportJob, getQueueStats, cancelExportJob, videoQueue } = require('../queues/videoQueue');
const db = require('../config/database');

// ============================================================================
// POST /api/v1/episodes/:episodeId/export  — Start a new export job
// ============================================================================
router.post('/episodes/:episodeId/export', authenticate, async (req, res) => {
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
    const episodeResult = await db.query(
      'SELECT id, title, episode_number, show_id FROM episodes WHERE id = $1',
      [episodeId]
    );

    if (episodeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const episode = episodeResult.rows[0];

    // Fetch scenes for this episode
    const scenesResult = await db.query(
      `SELECT id, title, scene_order, duration_seconds, background_url,
              characters, ui_elements, background_color
       FROM scenes
       WHERE episode_id = $1
       ORDER BY scene_order ASC`,
      [episodeId]
    );

    const scenes = scenesResult.rows;

    if (scenes.length === 0) {
      return res.status(400).json({
        error: 'No scenes found',
        message: 'Episode must have at least one scene to export',
      });
    }

    // Fetch timeline data (keyframes, etc) if available
    let timelineData = null;
    try {
      const tlResult = await db.query(
        `SELECT keyframes, beats, markers, audio_clips, character_clips
         FROM timeline_data
         WHERE episode_id = $1
         LIMIT 1`,
        [episodeId]
      );
      if (tlResult.rows.length > 0) {
        timelineData = tlResult.rows[0];
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
        scene_order: s.scene_order,
        duration_seconds: s.duration_seconds || 5,
        background_url: s.background_url,
        background_color: s.background_color || '#1a1a2e',
        characters: s.characters || [],
        ui_elements: s.ui_elements || [],
      })),
      timelineData,
    };

    // Add to Bull queue
    const job = await addExportJob(jobData);

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
router.get('/export/status/:jobId', authenticate, async (req, res) => {
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
router.get('/exports', authenticate, async (req, res) => {
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
router.delete('/export/:jobId', authenticate, async (req, res) => {
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
router.get('/export/download/:jobId', authenticate, async (req, res) => {
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

    if (!result?.downloadUrl && !result?.s3Url) {
      return res.status(404).json({
        error: 'Download not available',
        message: 'Export completed but no download URL available',
      });
    }

    return res.json({
      downloadUrl: result.downloadUrl || result.s3Url,
      fileName: result.fileName || `export-${jobId}.${job.data.format || 'mp4'}`,
      fileSize: result.fileSize || null,
      format: job.data.format,
    });
  } catch (error) {
    console.error('Download export error:', error);
    return res.status(500).json({ error: 'Failed to get download URL', message: error.message });
  }
});

module.exports = router;

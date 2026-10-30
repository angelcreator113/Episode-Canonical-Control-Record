'use strict';

/**
 * Voice from footage (Voice plan V2; Evoni, 2026-10-30), mounted at
 * /api/v1/voice-footage. Admin only, and 404 unless VOICE_FROM_FOOTAGE=on
 * (with Voice Studio on).
 *
 *   GET  /:episodeId/status                    the voice line for each clip: { [clipId]: { status, attempt, error, … } }
 *   POST /:episodeId/clips/:clipId/prepare     Prepare Voice: queues the clip's extraction (a clip already
 *                                              prepared, or queued, returns its job; after a failure, a new attempt)
 *
 * These only read and queue jobs. The footage-only worker
 * (src/workers/voiceFootageWorker.js) does the work; until it runs, a job
 * waits as queued. Nothing here changes a clip.
 */

const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');
const models = require('../models');
const clips = require('../services/rawClipsService');
const jobs = require('../services/voiceFootageJobs');

const router = express.Router();
const admin = [requireAuth, authorize(['ADMIN'])];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.use((req, res, next) => {
  if (jobs.enabled()) return next();
  return res.status(404).json({ success: false, error: 'Voice from footage is not switched on', code: 'VOICE_FROM_FOOTAGE_OFF' });
});

const userOf = (req) => (req.user?.id ? String(req.user.id).slice(0, 255) : null);

/** A job in the shape the Files page reads. */
const shapeJob = (j) => (j ? {
  id: j.id, clip_id: j.raw_clip_id, status: j.status, attempt: j.attempt, error: j.status === 'failed' ? j.error_message : null,
  needs_action: j.status === 'failed', waiting_for_retry: j.status === 'queued' && j.trigger === 'retry',
} : null);

router.get('/:episodeId/status', ...admin, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.episodeId)) return res.status(404).json({ success: false, error: 'Episode not found' });
    return res.json({ success: true, data: await jobs.statusForEpisode(models.sequelize, req.params.episodeId) });
  } catch (err) {
    console.error('[VoiceFootage] status failed:', err.message);
    return res.status(500).json({ success: false, error: 'The voice status could not be read.' });
  }
});

router.post('/:episodeId/clips/:clipId/prepare', ...admin, async (req, res) => {
  try {
    const { episodeId, clipId } = req.params;
    if (!UUID_RE.test(episodeId) || !UUID_RE.test(clipId)) return res.status(404).json({ success: false, error: 'Clip not found' });
    const clip = await clips.getClip(models.sequelize, episodeId, clipId);
    if (!clip) return res.status(404).json({ success: false, error: 'Clip not found' });
    if (!jobs.footageExtractionEnabledFor(clip.performer)) {
      return res.status(409).json({ success: false, error: "Voice is prepared only for Lala's footage for now.", code: 'NOT_ELIGIBLE' });
    }
    const { job, created } = await jobs.prepare(models.sequelize, clip, { userId: userOf(req) });
    return res.status(created ? 202 : 200).json({ success: true, data: shapeJob(job), created });
  } catch (err) {
    if (err instanceof jobs.FootageJobError) return res.status(409).json({ success: false, error: err.message, code: err.code });
    console.error('[VoiceFootage] prepare failed:', err.message);
    return res.status(500).json({ success: false, error: 'Prepare Voice could not be started. Nothing was changed.' });
  }
});

module.exports = router;

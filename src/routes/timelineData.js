const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, authorize } = require('../middleware/auth');
const { legacyTimelineWritesOpen } = require('../utils/timelineSaveGuard');
const { validateUUIDParam } = require('../middleware/requestValidation');

/**
 * Timeline Data Routes
 * Base path: /api/v1/episodes/:episodeId/timeline-data
 * 
 * Manages beats, markers, audio clips, and character clips 
 * stored in the timeline_data table (one row per episode).
 */

// GET /api/v1/episodes/:episodeId/timeline-data
// Returns timeline data for an episode (creates default if none exists)
router.get('/:episodeId/timeline-data', validateUUIDParam('episodeId'), requireAuth, asyncHandler(async (req, res) => {
  const { episodeId } = req.params;
  const { TimelineData } = require('../models');

  const timelineData = await TimelineData.findOne({
    where: { episode_id: episodeId }
  });

  // A read writes nothing (2026-11-03): with no row it answers the empty
  // timeline and basis null, instead of creating a row.
  const { timelineBasis } = require('../utils/timelineSaveGuard');
  if (!timelineData) {
    return res.json({ id: null, episode_id: episodeId, beats: [], markers: [], audio_clips: [], character_clips: [], keyframes: [], basis: null });
  }
  res.json({ ...timelineData.toJSON(), basis: timelineBasis(timelineData) });
}));

// PUT /api/v1/episodes/:episodeId/timeline-data
// Update timeline data (upsert)
// Closed with the old Timeline Editor (2026-11-03): 410 unless LEGACY_TIMELINE_WRITES=on, then admin only.
router.put('/:episodeId/timeline-data', validateUUIDParam('episodeId'), requireAuth, legacyTimelineWritesOpen, authorize(['ADMIN']), asyncHandler(async (req, res) => {
  const { episodeId } = req.params;
  const { beats, markers, audio_clips, audioClips, character_clips, characterClips, keyframes } = req.body;
  const { TimelineData } = require('../models');

  let timelineData = await TimelineData.findOne({
    where: { episode_id: episodeId }
  });

  const updatePayload = {
    beats: beats !== undefined ? beats : (timelineData ? timelineData.beats : []),
    markers: markers !== undefined ? markers : (timelineData ? timelineData.markers : []),
    audio_clips: (audio_clips || audioClips) !== undefined 
      ? (audio_clips || audioClips) 
      : (timelineData ? timelineData.audio_clips : []),
    character_clips: (character_clips || characterClips) !== undefined 
      ? (character_clips || characterClips) 
      : (timelineData ? timelineData.character_clips : []),
    keyframes: keyframes !== undefined 
      ? keyframes 
      : (timelineData ? timelineData.keyframes : []),
  };

  if (timelineData) {
    await timelineData.update(updatePayload);
  } else {
    timelineData = await TimelineData.create({
      episode_id: episodeId,
      ...updatePayload
    });
  }

  res.json(timelineData);
}));

module.exports = router;

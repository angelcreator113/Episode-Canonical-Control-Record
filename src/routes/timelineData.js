const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Timeline Data Routes
 * Base path: /api/v1/episodes/:episodeId/timeline-data
 * 
 * Manages beats, markers, audio clips, and character clips 
 * stored in the timeline_data table (one row per episode).
 */

// GET /api/v1/episodes/:episodeId/timeline-data
// Returns timeline data for an episode (creates default if none exists)
router.get('/:episodeId/timeline-data', asyncHandler(async (req, res) => {
  const { episodeId } = req.params;
  const { TimelineData } = require('../models');

  let timelineData = await TimelineData.findOne({
    where: { episode_id: episodeId }
  });

  // Auto-create default if not found
  if (!timelineData) {
    timelineData = await TimelineData.create({
      episode_id: episodeId,
      beats: [],
      markers: [],
      audio_clips: [],
      character_clips: []
    });
  }

  res.json(timelineData);
}));

// PUT /api/v1/episodes/:episodeId/timeline-data
// Update timeline data (upsert)
router.put('/:episodeId/timeline-data', asyncHandler(async (req, res) => {
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

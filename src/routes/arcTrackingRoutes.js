'use strict';

const express = require('express');
const router = express.Router();
const { buildArcContext, updateArcTracking } = require('../services/arcTrackingService');
const { checkSceneEligibility } = require('../services/sceneEligibilityService');

let optionalAuth;
try {
  optionalAuth = require('../middleware/optionalAuth');
} catch {
  optionalAuth = (req, res, next) => next();
}

const db = require('../models/index');

// ── GET /arc-tracking/:characterKey — Full arc tracking data ─────────
router.get('/arc-tracking/:characterKey', optionalAuth, async (req, res) => {
  try {
    const context = await buildArcContext(db, req.params.characterKey);
    if (!context) return res.status(404).json({ error: 'No arc found' });

    // Pull story-by-story data for visualization
    const stories = await db.StorytellerStory.findAll({
      where: { character_key: req.params.characterKey, status: 'approved' },
      attributes: ['story_number', 'phase', 'story_type', 'created_at'],
      order: [['story_number', 'ASC']],
    });

    const arcPoints = stories.map(s => ({
      story_number: s.story_number,
      phase: s.phase,
      story_type: s.story_type,
    }));

    res.json({ context, arc_points: arcPoints });
  } catch (err) {
    console.error('[arc-tracking] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /arc-tracking/update — Update arc after story approval ──────
router.post('/arc-tracking/update', optionalAuth, async (req, res) => {
  try {
    const { character_key, story_number, story_type, phase, phone_appeared } = req.body;
    if (!character_key) return res.status(400).json({ error: 'character_key is required' });

    const result = await updateArcTracking(db, character_key, {
      storyNumber: story_number,
      storyType: story_type,
      phase,
      phoneAppeared: phone_appeared || false,
    });

    res.json({ updated: true, arc: result });
  } catch (err) {
    console.error('[arc-tracking] update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /world/scenes/check-eligibility — Scene eligibility check ───
router.post('/world/scenes/check-eligibility', optionalAuth, async (req, res) => {
  try {
    const { story_id, character_key, story_text, story_type, story_number, characters_present } = req.body;
    if (!character_key) return res.status(400).json({ error: 'character_key is required' });

    const result = await checkSceneEligibility(db, {
      storyId: story_id,
      characterKey: character_key,
      storyText: story_text,
      storyType: story_type,
      storyNumber: story_number,
      charactersPresent: characters_present || [],
    });

    res.json(result);
  } catch (err) {
    console.error('[scene-eligibility] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

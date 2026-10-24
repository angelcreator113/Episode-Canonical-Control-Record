'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

// POST /api/v1/feed-pipeline/:showId/generate-opportunities
// Scan feed profiles and auto-generate opportunities
router.post('/:showId/generate-opportunities', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const models = require('../models');
    const { generateOpportunitiesFromFeed } = require('../services/feedEventPipelineService');
    const generated = await generateOpportunitiesFromFeed(req.params.showId, models);
    return res.json({ success: true, data: generated, count: generated.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/feed-pipeline/:showId/schedule/:opportunityId
// One-click: opportunity → fully-formed event
router.post('/:showId/schedule/:opportunityId', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const models = require('../models');
    const { scheduleOpportunityAsEvent } = require('../services/feedEventPipelineService');
    // One held for beat 14 is offered as it is scheduled, which is what the
    // ADMIN-only Release offer does (routes/opportunityRoutes), so only an
    // admin schedules it early (Evoni, 2026-10-23).
    const isAdmin = (req.user?.groups || []).some((g) => String(g).toLowerCase() === 'admin');
    if (!isAdmin) {
      const [held] = await models.sequelize.query(
        "SELECT id FROM opportunities WHERE id = :id AND show_id = :showId AND status = 'held' AND deleted_at IS NULL LIMIT 1",
        { replacements: { id: req.params.opportunityId, showId: req.params.showId }, type: models.sequelize.QueryTypes.SELECT }
      );
      if (held) return res.status(403).json({ success: false, error: "Only an admin can schedule one held for an episode's beat 14." });
    }
    // Task #2156: the user id is the creation draft's rate-limit key.
    const result = await scheduleOpportunityAsEvent(req.params.opportunityId, req.params.showId, models, { userId: req.user?.id || null });
    return res.json({ success: true, data: result });
  } catch (err) {
    // A held one that changed while it was scheduled is a 409 (Evoni,
    // 2026-10-23; services/feedEventPipelineService scheduleHeldEarly).
    console.error('[FeedPipeline] schedule failed:', err.message);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/feed-pipeline/:showId/suggestions
// AI-driven event suggestions based on narrative state
router.get('/:showId/suggestions', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { suggestNextEvents } = require('../services/feedEventPipelineService');
    const suggestions = await suggestNextEvents(req.params.showId, models);
    return res.json({ success: true, data: suggestions, count: suggestions.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

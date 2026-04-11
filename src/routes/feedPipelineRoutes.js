'use strict';

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');

// POST /api/v1/feed-pipeline/:showId/generate-opportunities
// Scan feed profiles and auto-generate opportunities
router.post('/:showId/generate-opportunities', optionalAuth, async (req, res) => {
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
router.post('/:showId/schedule/:opportunityId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { scheduleOpportunityAsEvent } = require('../services/feedEventPipelineService');
    const result = await scheduleOpportunityAsEvent(req.params.opportunityId, req.params.showId, models);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/feed-pipeline/:showId/suggestions
// AI-driven event suggestions based on narrative state
router.get('/:showId/suggestions', optionalAuth, async (req, res) => {
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

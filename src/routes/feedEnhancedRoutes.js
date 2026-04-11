'use strict';

/**
 * Enhanced Feed Routes
 * Mount at: /api/v1/feed-enhanced
 *
 * New endpoints for trending topics, engagement analysis,
 * ripple effects, feed moments, and event chaining.
 */

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');

// ── TRENDING TOPICS ─────────────────────────────────────────────────────────
// GET /api/v1/feed-enhanced/:showId/trending
router.get('/:showId/trending', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getTrendingTopics } = require('../services/feedEngagementService');
    const topics = await getTrendingTopics(req.params.showId, models);
    return res.json({ success: true, data: topics, count: topics.length });
  } catch (err) {
    console.error('[FeedEnhanced] Trending error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── EVENT ENGAGEMENT ANALYSIS ───────────────────────────────────────────────
// GET /api/v1/feed-enhanced/event/:eventId/engagement
router.get('/event/:eventId/engagement', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { analyzeEventEngagement } = require('../services/feedEngagementService');
    const analysis = await analyzeEventEngagement(req.params.eventId, models);
    return res.json({ success: true, data: analysis });
  } catch (err) {
    console.error('[FeedEnhanced] Engagement analysis error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GENERATE RIPPLE EFFECTS FROM VIRAL POST ─────────────────────────────────
// POST /api/v1/feed-enhanced/post/:postId/ripple
router.post('/post/:postId/ripple', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { generateRippleEffects } = require('../services/feedEngagementService');
    const result = await generateRippleEffects(req.params.postId, models);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[FeedEnhanced] Ripple error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── FEED MOMENTUM FOR SHOW ──────────────────────────────────────────────────
// GET /api/v1/feed-enhanced/:showId/momentum
router.get('/:showId/momentum', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { computeFeedMomentum } = require('../services/feedEngagementService');
    const momentum = await computeFeedMomentum(req.params.showId, models);
    return res.json({ success: true, data: momentum });
  } catch (err) {
    console.error('[FeedEnhanced] Momentum error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── CHAIN EVENT FROM MOMENTUM ───────────────────────────────────────────────
// POST /api/v1/feed-enhanced/:showId/chain/:eventId
router.post('/:showId/chain/:eventId', optionalAuth, async (req, res) => {
  try {
    const { type, reason, suggested_prestige } = req.body;
    if (!type) return res.status(400).json({ error: 'type is required (e.g., brand_deal, interview, runway)' });

    const models = require('../models');
    const { chainEventFromMomentum } = require('../services/feedEventPipelineService');
    const result = await chainEventFromMomentum(
      req.params.eventId, { type, reason, suggested_prestige }, req.params.showId, models
    );
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[FeedEnhanced] Chain event error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET EVENT CHAIN ─────────────────────────────────────────────────────────
// GET /api/v1/feed-enhanced/:showId/chain/:eventId
router.get('/:showId/chain/:eventId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getEventChain } = require('../services/feedEventPipelineService');
    const chain = await getEventChain(req.params.eventId, req.params.showId, models);
    return res.json({ success: true, data: chain });
  } catch (err) {
    console.error('[FeedEnhanced] Event chain error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── FEED MOMENTS ────────────────────────────────────────────────────────────
// GET /api/v1/feed-enhanced/:showId/moments/:episodeId
router.get('/:showId/moments/:episodeId', optionalAuth, async (req, res) => {
  try {
    const { FeedMoment } = require('../models');
    if (!FeedMoment) return res.status(404).json({ error: 'FeedMoment model not available' });

    const moments = await FeedMoment.findAll({
      where: { show_id: req.params.showId, episode_id: req.params.episodeId, deleted_at: null },
      order: [['beat_number', 'ASC'], ['sort_order', 'ASC']],
    });

    return res.json({
      success: true,
      data: moments,
      count: moments.length,
      beats: [...new Set(moments.map(m => m.beat_number))].sort((a, b) => a - b),
    });
  } catch (err) {
    console.error('[FeedEnhanced] Moments error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── PERSIST MOMENTS AFTER GENERATION ────────────────────────────────────────
// POST /api/v1/feed-enhanced/:showId/moments/:episodeId/persist
router.post('/:showId/moments/:episodeId/persist', optionalAuth, async (req, res) => {
  try {
    const { moments, eventId } = req.body;
    if (!moments || typeof moments !== 'object') {
      return res.status(400).json({ error: 'moments object is required' });
    }

    const models = require('../models');
    const { persistFeedMoments } = require('../services/feedPostGeneratorService');
    const saved = await persistFeedMoments(
      req.params.episodeId, req.params.showId, eventId || null, moments, models
    );

    return res.json({ success: true, data: saved, count: saved.length });
  } catch (err) {
    console.error('[FeedEnhanced] Persist moments error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── VIRAL POSTS FOR SHOW ────────────────────────────────────────────────────
// GET /api/v1/feed-enhanced/:showId/viral
router.get('/:showId/viral', optionalAuth, async (req, res) => {
  try {
    const { FeedPost } = require('../models');
    const posts = await FeedPost.findAll({
      where: { show_id: req.params.showId, is_viral: true, deleted_at: null },
      order: [['viral_reach', 'DESC']],
      limit: parseInt(req.query.limit) || 20,
    });

    return res.json({ success: true, data: posts, count: posts.length });
  } catch (err) {
    console.error('[FeedEnhanced] Viral posts error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST THREAD ─────────────────────────────────────────────────────────────
// GET /api/v1/feed-enhanced/thread/:threadId
router.get('/thread/:threadId', optionalAuth, async (req, res) => {
  try {
    const { FeedPost } = require('../models');
    const posts = await FeedPost.findAll({
      where: { thread_id: req.params.threadId, deleted_at: null },
      order: [['posted_at', 'ASC'], ['sort_order', 'ASC']],
    });

    // Find the original post (no parent_post_id or parent_post_id is itself)
    const original = posts.find(p => !p.parent_post_id) || posts[0];
    const replies = posts.filter(p => p.id !== original?.id);

    return res.json({
      success: true,
      data: { original, replies, total: posts.length },
    });
  } catch (err) {
    console.error('[FeedEnhanced] Thread error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

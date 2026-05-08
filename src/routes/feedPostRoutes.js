'use strict';

/**
 * Feed Post Routes
 * Mount at: /api/v1/feed-posts
 *
 * Timeline posts generated after episodes — characters react in the feed.
 */

const express = require('express');
const router = express.Router();
// F-AUTH-1 Step 3 CP8: mixed Tier 1+4 within single file (per v2.32 §5.21,
// 5th cumulative instance after worldStudio.js @ CP3 + universe.js @ CP6 +
// franchiseBrainRoutes.js @ CP7 + socialProfileRoutes.js @ CP8). 3 GETs are
// timeline catalog reads (no req.user consumption); 3 handlers are Tier 1.
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

// ── GET FEED TIMELINE (QUERY COMPAT) ────────────────────────────────────────
// GET /api/v1/feed-posts?show_id=...&episode_id=...&limit=...&offset=...
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { show_id, episode_id, profile_id, narrative_function, limit, offset } = req.query;
    const { FeedPost, SocialProfile } = require('../models');

    if (!show_id && !episode_id) {
      return res.status(400).json({ error: 'show_id or episode_id is required' });
    }

    const where = { deleted_at: null };
    if (show_id) where.show_id = show_id;
    if (episode_id) where.episode_id = episode_id;
    if (profile_id) where.social_profile_id = profile_id;
    if (narrative_function) where.narrative_function = narrative_function;

    const posts = await FeedPost.findAll({
      where,
      order: [['posted_at', 'DESC'], ['sort_order', 'ASC']],
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
      include: SocialProfile ? [{
        model: SocialProfile,
        as: 'socialProfile',
        attributes: ['id', 'handle', 'display_name', 'platform', 'archetype',
          'follower_tier', 'aesthetic_dna'],
        required: false,
      }] : [],
    });

    const total = await FeedPost.count({ where });

    return res.json({
      data: posts,
      count: posts.length,
      total,
      hasMore: (parseInt(offset, 10) || 0) + posts.length < total,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GENERATE FEED POSTS FOR EPISODE ──────────────────────────────────────────
// POST /api/v1/feed-posts/:episodeId/generate
router.post('/:episodeId/generate', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { showId } = req.body;

    if (!showId) return res.status(400).json({ error: 'showId is required' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

    const models = require('../models');
    const episode = await models.Episode.findByPk(episodeId);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    const { generateEpisodeFeedPosts } = require('../services/feedPostGeneratorService');
    const posts = await generateEpisodeFeedPosts(episodeId, showId, models);

    return res.json({
      success: true,
      message: `${posts.length} feed posts generated.`,
      data: posts,
    });
  } catch (err) {
    console.error('[FeedPosts] Generate error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET FEED TIMELINE ────────────────────────────────────────────────────────
// GET /api/v1/feed-posts/:showId/timeline
// Query: episode_id, profile_id, narrative_function, limit, offset
router.get('/:showId/timeline', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { episode_id, profile_id, narrative_function, limit, offset } = req.query;
    const { FeedPost, SocialProfile } = require('../models');

    const where = { show_id: showId, deleted_at: null };
    if (episode_id) where.episode_id = episode_id;
    if (profile_id) where.social_profile_id = profile_id;
    if (narrative_function) where.narrative_function = narrative_function;

    const posts = await FeedPost.findAll({
      where,
      order: [['posted_at', 'DESC'], ['sort_order', 'ASC']],
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      include: SocialProfile ? [{
        model: SocialProfile,
        as: 'socialProfile',
        attributes: ['id', 'handle', 'display_name', 'platform', 'archetype',
                     'follower_tier', 'aesthetic_dna'],
        required: false,
      }] : [],
    });

    const total = await FeedPost.count({ where });

    return res.json({
      data: posts,
      count: posts.length,
      total,
      hasMore: (parseInt(offset) || 0) + posts.length < total,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET EPISODE FEED ─────────────────────────────────────────────────────────
// GET /api/v1/feed-posts/episode/:episodeId
router.get('/episode/:episodeId', optionalAuth, async (req, res) => {
  try {
    const { FeedPost } = require('../models');
    const posts = await FeedPost.findAll({
      where: { episode_id: req.params.episodeId, deleted_at: null },
      order: [['sort_order', 'ASC']],
    });

    // Group by timeline position
    const grouped = {
      before_episode: posts.filter(p => p.timeline_position === 'before_episode'),
      during_episode: posts.filter(p => p.timeline_position === 'during_episode'),
      after_episode: posts.filter(p => p.timeline_position === 'after_episode'),
      next_day: posts.filter(p => p.timeline_position === 'next_day'),
      week_later: posts.filter(p => p.timeline_position === 'week_later'),
    };

    return res.json({
      data: posts,
      grouped,
      count: posts.length,
      stats: {
        total_likes: posts.reduce((sum, p) => sum + (p.likes || 0), 0),
        total_comments: posts.reduce((sum, p) => sum + (p.comments_count || 0), 0),
        narrative_functions: [...new Set(posts.map(p => p.narrative_function).filter(Boolean))],
        emotional_impacts: [...new Set(posts.map(p => p.emotional_impact).filter(Boolean))],
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── UPDATE POST ──────────────────────────────────────────────────────────────
// PUT /api/v1/feed-posts/:postId
router.put('/:postId', requireAuth, async (req, res) => {
  try {
    const { FeedPost } = require('../models');
    const post = await FeedPost.findByPk(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const updatable = ['content_text', 'image_description', 'image_url', 'likes',
                       'comments_count', 'shares', 'sample_comments', 'posted_at',
                       'timeline_position', 'narrative_function', 'lala_reaction',
                       'lala_internal_thought', 'emotional_impact', 'sort_order',
                       'is_viral', 'viral_reach', 'engagement_velocity', 'trending_topic',
                       'thread_id', 'parent_post_id', 'ripple_effect', 'audience_sentiment'];
    const updates = {};
    for (const field of updatable) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    await post.update(updates);
    return res.json({ data: post });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE POST ──────────────────────────────────────────────────────────────
// DELETE /api/v1/feed-posts/:postId
router.delete('/:postId', requireAuth, async (req, res) => {
  try {
    const { FeedPost } = require('../models');
    const post = await FeedPost.findByPk(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    await post.destroy();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

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
const { statusWhere, isLive, LOCKED_MESSAGE } = require('../services/feedPostStatus');
const { draftReactions, pickReactors, recountComments, DraftError, COMMENT_LOCKED } = require('../services/feedCommentDrafter');

// ── GET FEED TIMELINE (QUERY COMPAT) ────────────────────────────────────────
// GET /api/v1/feed-posts?show_id=...&episode_id=...&limit=...&offset=...
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { show_id, episode_id, profile_id, narrative_function, post_type, limit, offset, status, with: withWhat } = req.query;
    const { FeedPost, SocialProfile, FeedComment, Episode } = require('../models');

    if (!show_id && !episode_id) {
      return res.status(400).json({ error: 'show_id or episode_id is required' });
    }

    // Live posts by default (?status=draft|live|all): services/feedPostStatus.js.
    const scoped = statusWhere(status);
    if (scoped.error) return res.status(400).json({ error: scoped.error });
    const where = { deleted_at: null, ...scoped };
    if (show_id) where.show_id = show_id;
    if (episode_id) where.episode_id = episode_id;
    if (profile_id) where.social_profile_id = profile_id;
    if (narrative_function) where.narrative_function = narrative_function;
    // ?post_type= (e.g. 'relationship', docs/FEED_POSTS.md rule 8).
    if (post_type) {
      if (typeof post_type !== 'string' || post_type.length > 30) return res.status(400).json({ error: 'post_type must be a short string' });
      where.post_type = post_type;
    }

    const posts = await FeedPost.findAll({
      where,
      order: [['posted_at', 'DESC'], ['sort_order', 'ASC']],
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
      include: [
        ...(SocialProfile ? [{
          model: SocialProfile,
          as: 'socialProfile',
          attributes: ['id', 'handle', 'display_name', 'platform', 'archetype',
            'follower_tier', 'aesthetic_dna'],
          required: false,
        }] : []),
        // The post's episode number, for its story time (services/storyClock.js).
        ...(withWhat === 'comments' && Episode ? [{ model: Episode, as: 'episode', attributes: ['id', 'episode_number'], required: false }] : []),
        // ?with=comments: each post's live comments, as records (the wall).
        ...(withWhat === 'comments' && FeedComment ? [{
          model: FeedComment, as: 'comments', where: { status: 'live' }, required: false,
          attributes: ['id', 'handle', 'display_name', 'text', 'posted_at', 'sort_order', 'social_profile_id'],
        }] : []),
      ],
    });

    const total = await FeedPost.count({ where, distinct: true, col: 'id' });

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

// ── WRITE A POST BY HAND (the wall's "What's on your mind?", 2026-10-04) ────
// POST /api/v1/feed-posts { show_id, content_text, poster_handle?, poster_display_name?,
//   social_profile_id?, poster_platform?, post_type?, status? (live by default), episode_id? }
router.post('/', requireAuth, async (req, res) => {
  try {
    const { FeedPost } = require('../models');
    const { show_id, content_text, poster_handle, poster_display_name, social_profile_id, poster_platform, post_type, status, episode_id } = req.body || {};
    if (!show_id) return res.status(400).json({ error: 'show_id is required' });
    if (!content_text?.trim()) return res.status(400).json({ error: 'content_text is required' });
    const scoped = statusWhere(status === undefined ? 'live' : status);
    if (scoped.error || !scoped.status) return res.status(400).json({ error: 'status must be draft or live' });
    const post = await FeedPost.create({
      show_id,
      episode_id: episode_id || null,
      social_profile_id: social_profile_id || null,
      poster_handle: String(poster_handle || 'lala').replace(/^@/, ''),
      poster_display_name: poster_display_name || null,
      poster_platform: poster_platform || 'lalaverse',
      post_type: post_type || 'post',
      content_text: content_text.trim(),
      likes: 0, comments_count: 0, shares: 0, sample_comments: [],
      posted_at: scoped.status === 'live' ? new Date() : null,
      timeline_position: episode_id ? 'during_episode' : null,
      // A wall post's story time: after the latest published episode (services/storyClock.js).
      story_order: episode_id ? null : await require('../services/storyClock').presentOrder(require('../models'), show_id),
      narrative_function: null,
      ai_generated: false,
      status: scoped.status,
      sort_order: 0,
    });
    return res.json({ data: post });
  } catch (err) {
    console.error('[FeedPosts] Create error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── PENDING REACTION DRAFTS ACROSS A SHOW (the wall's Requests box) ─────────
// GET /api/v1/feed-posts/comments/pending?show_id=
router.get('/comments/pending', requireAuth, async (req, res) => {
  try {
    const { FeedComment, FeedPost } = require('../models');
    const { show_id } = req.query;
    if (!show_id) return res.status(400).json({ error: 'show_id is required' });
    const drafts = await FeedComment.findAll({
      where: { show_id, status: 'draft', deleted_at: null },
      order: [['created_at', 'DESC']],
      limit: 100,
      include: FeedPost ? [{ model: FeedPost, as: 'post', attributes: ['id', 'poster_handle', 'content_text', 'status'], required: false }] : [],
    });
    return res.json({ data: drafts, count: drafts.length });
  } catch (err) {
    console.error('[FeedComments] Pending error:', err);
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
    const { episode_id, profile_id, narrative_function, limit, offset, status } = req.query;
    const { FeedPost, SocialProfile } = require('../models');

    const scoped = statusWhere(status);
    if (scoped.error) return res.status(400).json({ error: scoped.error });
    const where = { show_id: showId, deleted_at: null, ...scoped };
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

// ── GET ONE POST ─────────────────────────────────────────────────────────────
// GET /api/v1/feed-posts/post/:postId — the post a phone zone or a beat draws live.
router.get('/post/:postId', optionalAuth, async (req, res) => {
  try {
    const { FeedPost, SocialProfile, FeedComment } = require('../models');
    const post = await FeedPost.findOne({
      where: { id: req.params.postId, deleted_at: null },
      include: [
        ...(SocialProfile ? [{ model: SocialProfile, as: 'socialProfile', attributes: ['id', 'handle', 'display_name', 'platform'], required: false }] : []),
        // The post's live comments, as records (docs/FEED_POSTS.md rule 6).
        ...(FeedComment ? [{ model: FeedComment, as: 'comments', where: { status: 'live' }, required: false, attributes: ['id', 'handle', 'display_name', 'text', 'posted_at', 'sort_order', 'social_profile_id'] }] : []),
      ],
      order: FeedComment ? [[{ model: FeedComment, as: 'comments' }, 'sort_order', 'ASC']] : [],
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    // Which beats show this post (feed_moments.feed_post_id), for the wall.
    const { FeedMoment, Episode } = require('../models');
    const beats = FeedMoment ? await FeedMoment.findAll({
      where: { feed_post_id: post.id, deleted_at: null },
      attributes: ['id', 'episode_id', 'beat_number'],
      include: Episode ? [{ model: Episode, as: 'episode', attributes: ['id', 'episode_number', 'title'], required: false }] : [],
      order: [['beat_number', 'ASC']],
    }) : [];
    return res.json({ data: { ...post.toJSON(), beats: beats.map((b) => ({ moment_id: b.id, episode_id: b.episode_id, beat_number: b.beat_number, episode_number: b.episode?.episode_number ?? null, episode_title: b.episode?.title ?? null })) } });
  } catch (err) {
    console.error('[FeedPosts] Get post error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── COMMENTS (the Feed project, step 4; docs/FEED_POSTS.md rule 6) ──────────
// GET /api/v1/feed-posts/:postId/comments?status=live|draft|all — live by default.
router.get('/:postId/comments', optionalAuth, async (req, res) => {
  try {
    const { FeedComment } = require('../models');
    const scoped = statusWhere(req.query.status);
    if (scoped.error) return res.status(400).json({ error: scoped.error });
    const comments = await FeedComment.findAll({
      where: { feed_post_id: req.params.postId, deleted_at: null, ...scoped },
      order: [['sort_order', 'ASC'], ['created_at', 'ASC']],
    });
    return res.json({ data: comments, count: comments.length });
  } catch (err) {
    console.error('[FeedComments] List error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/feed-posts/:postId/comments/reactors — who would react, and why.
router.get('/:postId/comments/reactors', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const post = await models.FeedPost.findOne({ where: { id: req.params.postId, deleted_at: null } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const reactors = await pickReactors(models, post, { limit: Math.min(parseInt(req.query.limit, 10) || 4, 8) });
    return res.json({ data: reactors.map(({ profile, relationship }) => ({ id: profile.id, handle: profile.handle, display_name: profile.display_name, archetype: profile.archetype, relationship })) });
  } catch (err) {
    console.error('[FeedComments] Reactors error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/feed-posts/:postId/comments — write one by hand (a draft unless told live).
router.post('/:postId/comments', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { FeedPost, FeedComment } = models;
    const post = await FeedPost.findOne({ where: { id: req.params.postId, deleted_at: null } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const { handle, display_name, social_profile_id, text, status } = req.body || {};
    if (!handle?.trim() || !text?.trim()) return res.status(400).json({ error: 'handle and text are required' });
    if (status !== undefined && !['draft', 'live'].includes(status)) return res.status(400).json({ error: 'status must be draft or live' });
    const existing = await FeedComment.count({ where: { feed_post_id: post.id } });
    const comment = await FeedComment.create({
      feed_post_id: post.id, show_id: post.show_id, social_profile_id: social_profile_id || null,
      handle: handle.trim().replace(/^@/, ''), display_name: display_name || null, text: text.trim(),
      status: status || 'draft', posted_at: status === 'live' ? new Date() : null, sort_order: existing, ai_generated: false,
    });
    if (comment.status === 'live') await recountComments(models, post.id);
    return res.json({ data: comment });
  } catch (err) {
    console.error('[FeedComments] Create error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/feed-posts/:postId/comments/draft { reactor_ids?, limit? } — draft reactions for approval.
router.post('/:postId/comments/draft', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { reactor_ids, limit } = req.body || {};
    const { drafts, reactors } = await draftReactions(require('../models'), req.params.postId, {
      reactorIds: Array.isArray(reactor_ids) ? reactor_ids : null,
      limit: Math.min(parseInt(limit, 10) || 4, 8),
    });
    return res.json({ data: drafts, count: drafts.length, reactors: reactors.map((r) => r.profile.handle), message: `${drafts.length} reaction(s) drafted for approval` });
  } catch (err) {
    if (err instanceof DraftError) return res.status(err.status).json({ error: err.message });
    console.error('[FeedComments] Draft error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/feed-posts/comments/:commentId { text?, status? } — a draft only; approving sets it live.
router.patch('/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const comment = await models.FeedComment.findByPk(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.status === 'live') return res.status(409).json({ error: COMMENT_LOCKED, status: 'live' });
    const { text, status } = req.body || {};
    if (status !== undefined && !['draft', 'live'].includes(status)) return res.status(400).json({ error: 'status must be draft or live' });
    const updates = {};
    if (text !== undefined) {
      if (!String(text).trim()) return res.status(400).json({ error: 'text is required' });
      updates.text = String(text).trim();
    }
    if (status === 'live') { updates.status = 'live'; updates.posted_at = comment.posted_at || new Date(); }
    await comment.update(updates);
    if (comment.status === 'live') await recountComments(models, comment.feed_post_id);
    return res.json({ data: comment });
  } catch (err) {
    console.error('[FeedComments] Update error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/feed-posts/comments/:commentId — a draft or a live comment; the one way a live comment goes.
router.delete('/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const comment = await models.FeedComment.findByPk(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    const wasLive = comment.status === 'live';
    await comment.destroy();
    if (wasLive) await recountComments(models, comment.feed_post_id);
    return res.json({ success: true });
  } catch (err) {
    console.error('[FeedComments] Delete error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET EPISODE FEED ─────────────────────────────────────────────────────────
// GET /api/v1/feed-posts/episode/:episodeId
router.get('/episode/:episodeId', optionalAuth, async (req, res) => {
  try {
    const { FeedPost } = require('../models');
    // The episode's own view: its drafts and its live posts alike, unless asked.
    const scoped = statusWhere(req.query.status === undefined ? 'all' : req.query.status);
    if (scoped.error) return res.status(400).json({ error: scoped.error });
    const posts = await FeedPost.findAll({
      where: { episode_id: req.params.episodeId, deleted_at: null, ...scoped },
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

    // It is 2009: a live post has no edit button (services/feedPostStatus.js).
    if (isLive(post)) return res.status(409).json({ error: LOCKED_MESSAGE, status: post.status });
    if (req.body.status !== undefined && !['draft', 'live'].includes(req.body.status)) {
      return res.status(400).json({ error: 'status must be draft or live' });
    }

    const updatable = ['status', 'content_text', 'image_description', 'image_url', 'likes',
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

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
// Setting a draft's release time is an admin's (step 6c, services/postRelease).
const { authorize } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');
const { statusWhere, isLive, LOCKED_MESSAGE } = require('../services/feedPostStatus');
const { cleanTags } = require('../utils/postTags');
const { draftReactions, pickReactors, recountComments, DraftError, COMMENT_LOCKED } = require('../services/feedCommentDrafter');

/**
 * Why a post goes live only through Review (The Pulse spec, "Always to
 * Review: Lala's posts, posts or comments about Lala"; Task #3047): Lala's
 * own posts and posts about her, by pulseGate.reviewReasons. [] means no
 * hold. Evoni, 2026-10-13 (Task #3103): Lala's posts ALWAYS go to Review,
 * even an admin's, so a new one is held whoever writes it (lalaHold); only
 * releasing a held draft is an admin's, her Approve in Review (releaseHold).
 */
async function lalaHold(post) {
  const { sequelize } = require('../models');
  const lalaProfileId = await require('../services/lalaFeedProfile').lalaProfileId(sequelize);
  return require('../services/pulseGate').reviewReasons(post, { pass: true }, { lalaProfileId })
    .filter((r) => r === 'lala' || r === 'about_lala');
}

/** Releasing a held draft is Review's approval: an admin's. Anyone else's is refused. */
async function releaseHold(req, post) {
  const { userInGroup } = require('../middleware/auth');
  if (userInGroup(req.user, 'admin')) return [];
  return lalaHold(post);
}

/**
 * A comment read as a post for the same checks (Task #3135; as
 * pulseDrafter.routeComment): its commenter and its words. Comments by Lala
 * or about her wait for Review like posts.
 */
const commentAsPost = (comment) => ({
  social_profile_id: comment.social_profile_id || null, poster_handle: comment.handle, content_text: comment.text,
});

/**
 * Adds author_portrait_url to each post and portrait_url to each of its
 * comments, from the registry character linked to the author's profile
 * (registry_characters.feed_profile_id; Task #2924). One query for the page.
 * A missing link, or a failed read, leaves the photo null.
 */
async function withAuthorPortraits(models, posts) {
  const ids = new Set();
  for (const post of posts) {
    if (post.social_profile_id) ids.add(post.social_profile_id);
    for (const c of post.comments || []) if (c.social_profile_id) ids.add(c.social_profile_id);
  }
  let byProfile = new Map();
  if (ids.size && models.RegistryCharacter) {
    try {
      const rows = await models.RegistryCharacter.findAll({
        where: { feed_profile_id: [...ids] },
        attributes: ['feed_profile_id', 'portrait_url', 'updated_at'],
        order: [['updated_at', 'DESC']],
      });
      byProfile = new Map();
      for (const r of rows) if (r.portrait_url && !byProfile.has(r.feed_profile_id)) byProfile.set(r.feed_profile_id, r.portrait_url);
    } catch (err) {
      console.error('[feed-posts] author portraits could not be read:', err.message);
    }
  }
  return posts.map((post) => ({
    ...post,
    author_portrait_url: byProfile.get(post.social_profile_id) || null,
    ...(post.comments ? { comments: post.comments.map((c) => ({ ...c, portrait_url: byProfile.get(c.social_profile_id) || null })) } : {}),
  }));
}

/**
 * A post as Lala sees it at a story moment (Task #2939): a teaser keeps its
 * author and time, loses its words and comments, and shows a "first look"
 * (teaser: true); a post photo's own reveal makes a first look of (teaser)
 * or removes (hidden) the photo alone; comments by characters Lala has not
 * met yet are left out. A first look's photo is its teaser image, cut from
 * the full one (Task #3034): the full image URL and its description never
 * go out before the moment; with no teaser image, no photo goes out.
 */
function applyPostReveal(post, reveals) {
  const out = { ...post };
  if (Array.isArray(out.comments)) out.comments = out.comments.filter((c) => !reveals.hiddenProfiles.has(c.social_profile_id));
  const photo = reveals.stateOf('image', post.id, 'post_photo');
  const postTeaser = reveals.stateOf('post', post.id) === 'teaser';
  // Every photo of a hidden post stays back; a teaser shows only its teaser image (Task #3089: up to four photos).
  if (photo === 'hidden') { out.image_url = null; out.image_urls = []; out.image_description = null; out.photos = []; }
  if (postTeaser || (photo === 'teaser' && out.image_url)) {
    const teaser = (postTeaser && reveals.teaserOf('post', post.id)) || reveals.teaserOf('image', post.id, 'post_photo');
    out.photo_teaser = true;
    out.teaser_style = teaser?.style || 'crop';
    out.image_url = photo === 'hidden' ? null : teaser?.url || null;
    out.image_urls = out.image_url ? [out.image_url] : [];
    out.photos = out.image_url ? [{ url: out.image_url, alt: '' }] : [];
    out.image_description = null;
  }
  if (postTeaser) {
    out.teaser = true;
    out.content_text = null;
    out.trending_topic = null;
    out.comments = [];
  }
  return out;
}

// ── GET FEED TIMELINE (QUERY COMPAT) ────────────────────────────────────────
// GET /api/v1/feed-posts?show_id=...&episode_id=...&limit=...&offset=...
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { show_id, episode_id, profile_id, narrative_function, post_type, limit, offset, status, with: withWhat, from, at, city } = req.query;
    const { day_from: dayFrom, day_to: dayTo } = req.query;
    const { FeedPost, SocialProfile, FeedComment, Episode, sequelize } = require('../models');

    if (!show_id && !episode_id) {
      return res.status(400).json({ error: 'show_id or episode_id is required' });
    }

    // Live posts by default (?status=draft|live|all): services/feedPostStatus.js.
    const scoped = statusWhere(status);
    if (scoped.error) return res.status(400).json({ error: scoped.error });
    const where = { deleted_at: null, ...scoped };
    if (show_id) where.show_id = show_id;
    if (episode_id) where.episode_id = episode_id;
    // ?from=episode|wall: the posts written inside an episode, or on the wall
    // (Requests counts them apart, Task #2749).
    if (from !== undefined) {
      if (from !== 'episode' && from !== 'wall') return res.status(400).json({ error: 'from must be episode or wall' });
      if (!episode_id) where.episode_id = from === 'episode' ? { [require('sequelize').Op.ne]: null } : null;
    }
    if (profile_id) where.social_profile_id = profile_id;
    if (narrative_function) where.narrative_function = narrative_function;
    // ?post_type= (e.g. 'relationship', docs/FEED_POSTS.md rule 8).
    if (post_type) {
      if (typeof post_type !== 'string' || post_type.length > 30) return res.status(400).json({ error: 'post_type must be a short string' });
      where.post_type = post_type;
    }
    // ?city= (Task #2987): one Dream City's feed: posts tagged there, and
    // untagged posts of its profiles (utils/feedCities.cityPostsSql; Task #3090).
    const and = [];
    if (city !== undefined) {
      const { DREAM_CITY_KEYS, cityPostsSql } = require('../utils/feedCities');
      if (!DREAM_CITY_KEYS.includes(city)) return res.status(400).json({ error: `city must be one of ${DREAM_CITY_KEYS.join(', ')}` });
      and.push(sequelize.literal(cityPostsSql('FeedPost', city)));
    }
    // ?at= (Task #2937): The Pulse as of a story moment ("present", an
    // order, or ep:<n>:<phase>; services/storyClock.js). Keeps posts whose
    // story order is no later than it, and those of unknown story time;
    // newest story time first. Without it, nothing changes.
    let order = [['posted_at', 'DESC'], ['sort_order', 'ASC']];
    let reveals = null;
    let atOrder;
    if (at !== undefined) {
      if (at === 'present' && !show_id) return res.status(400).json({ error: 'at=present needs show_id' });
      const clock = require('../services/storyClock');
      try { atOrder = await clock.resolveAt(require('../models'), show_id, at); } catch (err) {
        if (err.status === 400) return res.status(400).json({ error: err.message });
        throw err;
      }
      const storyOrder = clock.postOrderSql('FeedPost');
      const { Op } = require('sequelize');
      and.push(sequelize.literal(`(${storyOrder} IS NULL OR ${storyOrder} <= ${Number(atOrder)})`));
      order = [[sequelize.literal(`${storyOrder} DESC NULLS LAST`)], ['posted_at', 'DESC'], ['sort_order', 'ASC']];
      // Reveals at that moment (Task #2939, services/pulseReveals.js): a
      // hidden post, and the posts of a character Lala has not met yet, are
      // left out here, so they never reach the browser.
      if (show_id) {
        const models = require('../models');
        const { lalaProfileId } = require('../services/lalaFeedProfile');
        reveals = await require('../services/pulseReveals').revealsAt(models, show_id, atOrder, { lalaProfileId: await lalaProfileId(sequelize) });
        const hiddenPosts = reveals.hiddenIds('post');
        if (hiddenPosts.length) and.push({ id: { [Op.notIn]: hiddenPosts } });
        if (reveals.hiddenProfiles.size) {
          and.push({ [Op.or]: [{ social_profile_id: null }, { social_profile_id: { [Op.notIn]: [...reveals.hiddenProfiles] } }] });
        }
      }
    }
    // ?day_from=&day_to= (ISO times; Story Clock's planner, Evoni 2026-10-17):
    // the posts going out in that window, by the clock: drafts whose release
    // time falls in it, and live posts posted in it; earliest first.
    if (dayFrom !== undefined || dayTo !== undefined) {
      const fromAt = new Date(String(dayFrom || ''));
      const toAt = new Date(String(dayTo || ''));
      if (Number.isNaN(fromAt.getTime()) || Number.isNaN(toAt.getTime()) || toAt <= fromAt) {
        return res.status(400).json({ error: 'day_from and day_to must be times, day_from first' });
      }
      if (toAt - fromAt > 8 * 24 * 60 * 60 * 1000) return res.status(400).json({ error: 'day_from to day_to is 8 days at most' });
      const { Op } = require('sequelize');
      const window = { [Op.gte]: fromAt, [Op.lt]: toAt };
      and.push({ [Op.or]: [{ release_at: window }, { status: 'live', posted_at: window }] });
      order = [[sequelize.literal('COALESCE("FeedPost"."release_at", "FeedPost"."posted_at")'), 'ASC'], ['sort_order', 'ASC']];
    }
    if (and.length) where[require('sequelize').Op.and] = and;

    const posts = await FeedPost.findAll({
      where,
      order,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
      include: [
        ...(SocialProfile ? [{
          model: SocialProfile,
          as: 'socialProfile',
          attributes: ['id', 'handle', 'display_name', 'platform', 'archetype',
            'follower_tier', 'aesthetic_dna', 'city'],
          required: false,
        }] : []),
        // The post's episode number, for its story time (services/storyClock.js).
        ...(withWhat === 'comments' && Episode ? [{ model: Episode, as: 'episode', attributes: ['id', 'episode_number'], required: false }] : []),
        // ?with=comments: each post's live comments, as records (the wall).
        // At a moment, only those at or before it; no story time reads as the
        // post's, which is already at or before it (Task #3064).
        ...(withWhat === 'comments' && FeedComment ? [{
          model: FeedComment, as: 'comments', required: false,
          where: Number.isInteger(atOrder)
            ? { status: 'live', [require('sequelize').Op.or]: [{ story_order: null }, { story_order: { [require('sequelize').Op.lte]: atOrder } }] }
            : { status: 'live' },
          attributes: ['id', 'handle', 'display_name', 'text', 'posted_at', 'sort_order', 'social_profile_id', 'story_order'],
        }] : []),
      ],
    });

    const total = await FeedPost.count({ where, distinct: true, col: 'id' });

    // Authors' photos for The Pulse (Task #2924): a post's or comment's
    // profile links to a registry character, whose portrait_url is the photo.
    let data = await withAuthorPortraits(require('../models'), posts.map((p) => p.toJSON()));
    // Each tagged post's place, with its venue's name (Task #3090).
    data = await require('../utils/feedPlaces').withPlaces(require('../models'), data);
    if (reveals) data = data.map((p) => applyPostReveal(p, reveals));
    // Likes and shares as they stand at the story moment, on the growth
    // curve; without ?at=, the final numbers (Task #2955, services/pulseNumbers.js).
    data = await require('../services/pulseNumbers').applyNumbers(require('../models'), data, atOrder);

    return res.json({
      data,
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
    const { show_id, content_text, poster_handle, poster_display_name, social_profile_id, poster_platform, post_type, status, episode_id, tags } = req.body || {};
    if (!show_id) return res.status(400).json({ error: 'show_id is required' });
    if (!content_text?.trim()) return res.status(400).json({ error: 'content_text is required' });
    const tagged = tags === undefined ? { tags: [] } : cleanTags(tags);
    if (tagged.error) return res.status(400).json({ error: tagged.error });
    const scoped = statusWhere(status === undefined ? 'live' : status);
    if (scoped.error || !scoped.status) return res.status(400).json({ error: 'status must be draft or live' });
    // Its location, if tagged (Task #3090): a Dream City or a venue, whose city is filled in.
    const place = await require('../utils/feedPlaces').resolvePlace(require('../models'), req.body || {});
    if (place.error) return res.status(400).json({ error: place.error });
    const fields = {
      social_profile_id: social_profile_id || null,
      poster_handle: String(poster_handle || 'lala').replace(/^@/, ''),
      content_text: content_text.trim(),
    };
    // Lala's posts and posts about her wait in Review, an admin's too (Task #3047; #3103).
    const held = scoped.status === 'live' ? await lalaHold(fields) : [];
    if (held.length) scoped.status = 'draft';
    const post = await FeedPost.create({
      ...fields,
      ...place.values,
      show_id,
      episode_id: episode_id || null,
      poster_display_name: poster_display_name || null,
      poster_platform: poster_platform || 'lalaverse',
      post_type: post_type || 'post',
      likes: 0, comments_count: 0, shares: 0, sample_comments: [],
      posted_at: scoped.status === 'live' ? new Date() : null,
      timeline_position: episode_id ? 'during_episode' : null,
      // A wall post's story time: after the latest published episode (services/storyClock.js).
      story_order: episode_id ? null : await require('../services/storyClock').presentOrder(require('../models'), show_id),
      narrative_function: null,
      ai_generated: false,
      status: scoped.status,
      sort_order: 0,
      tags: tagged.tags,
    });
    res.json(held.length ? { data: post, held_for_review: true, review_reasons: held } : { data: post });
    // A post created live has its numbers proposed after the response (Task #2953).
    require('../services/pulseNumbers').proposeLater(post);
    // …and the closeness changes it causes (Task #2983).
    if (post.status === 'live') require('../services/pulseCloseness').proposeLater(post.id);
    return undefined;
  } catch (err) {
    console.error('[FeedPosts] Create error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── PLACES (Task #3090) ──────────────────────────────────────────────────────
// GET /api/v1/feed-posts/places: the five Dream Cities and the venues, each
// with its city, for the composer's Location picker.
router.get('/places', requireAuth, async (req, res) => {
  try {
    return res.json(await require('../utils/feedPlaces').listPlaces(require('../models')));
  } catch (err) {
    console.error('[FeedPosts] GET places error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST MOMENTS IN THE EPISODE SCRIPT (Task #2885) ──────────────────────
// GET  /api/v1/feed-posts/episodes/:episodeId/script-drafts: each [UI:POST]
//      line of the saved script with its draft, if it has one.
// POST the same path: drafts a feed post for each one that has none, linked
//      to its beat (services/scriptPostDrafts). Saving again drafts nothing twice.
router.get('/episodes/:episodeId/script-drafts', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getScriptPostDrafts } = require('../services/scriptPostDrafts');
    return res.json({ success: true, data: await getScriptPostDrafts(models, req.params.episodeId) });
  } catch (err) {
    console.error('[FeedPosts] script drafts read failed:', err.message);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

router.post('/episodes/:episodeId/script-drafts', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { draftScriptPosts } = require('../services/scriptPostDrafts');
    return res.json({ success: true, data: await draftScriptPosts(models, req.params.episodeId) });
  } catch (err) {
    console.error('[FeedPosts] script drafts failed:', err.message);
    return res.status(err.status || 500).json({ success: false, error: err.message });
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
    // Today's manual requests are used (Task #3051): nothing was drafted.
    if (err instanceof require('../services/pulseRequests').RequestCapError) {
      console.error('[FeedPosts] Generate refused:', err.message);
      return res.status(429).json({ error: err.message, code: err.code });
    }
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
    // Lala's comment, or one about her, waits for Review whoever writes it (Task #3135).
    const held = status === 'live'
      ? await lalaHold(commentAsPost({ social_profile_id, handle: handle.trim().replace(/^@/, ''), text: text.trim() }))
      : [];
    const live = status === 'live' && !held.length;
    const comment = await FeedComment.create({
      feed_post_id: post.id, show_id: post.show_id, social_profile_id: social_profile_id || null,
      handle: handle.trim().replace(/^@/, ''), display_name: display_name || null, text: text.trim(),
      status: live ? 'live' : 'draft', posted_at: live ? new Date() : null, sort_order: existing, ai_generated: false,
      // Its story time: now, never before the post (Task #3064).
      story_order: await require('../services/storyClock').commentOrder(models, post),
    });
    if (comment.status === 'live') {
      await recountComments(models, post.id);
      require('../services/pulseCloseness').proposeLater(post.id);   // Task #2983
    }
    return res.json(held.length ? { data: comment, held_for_review: true, review_reasons: held } : { data: comment });
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
    if (err instanceof require('../services/pulseRequests').RequestCapError) {
      console.error('[FeedComments] Draft refused:', err.message);
      return res.status(429).json({ error: err.message, code: err.code });
    }
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
      // Evoni changing an AI draft's words is remembered (Task #3070).
      if (comment.ai_generated && updates.text !== String(comment.text || '').trim()) updates.edited_at = new Date();
    }
    if (status === 'live') {
      // Releasing Lala's comment, or one about her, is Review's: an admin's (Task #3135).
      const held = await releaseHold(req, commentAsPost({ ...comment.get(), ...updates }));
      if (held.length) {
        return res.status(403).json({ error: 'Lala\'s comments and comments about her go live through Review.', code: 'REVIEW_REQUIRED', review_reasons: held });
      }
      updates.status = 'live'; updates.posted_at = comment.posted_at || new Date();
    }
    const learn = status === 'live' && comment.ai_generated && Boolean(updates.edited_at || comment.edited_at);
    await comment.update(updates);
    // An approved draft Evoni edited becomes an example of the commenter's voice (Task #3070).
    if (learn) await require('../services/pulseVoices').learnFromEdit(models, { socialProfileId: comment.social_profile_id, text: comment.text, commentId: comment.id, by: req.user?.email || null });
    if (comment.status === 'live') {
      await recountComments(models, comment.feed_post_id);
      require('../services/pulseCloseness').proposeLater(comment.feed_post_id);   // Task #2983
    }
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
    if (req.body.tags !== undefined) {
      const tagged = cleanTags(req.body.tags);
      if (tagged.error) return res.status(400).json({ error: tagged.error });
      updates.tags = tagged.tags;
    }
    // A draft's location can change (Task #3090); a venue fills its city.
    const place = await require('../utils/feedPlaces').resolvePlace(require('../models'), req.body || {});
    if (place.error) return res.status(400).json({ error: place.error });
    Object.assign(updates, place.values);
    // Release (Task #2748): a draft going live with no posted_at is posted
    // now (approving an episode's post, Task #2749, does the same); its story
    // time stays as stamped.
    if (updates.status === 'live' && !post.posted_at && updates.posted_at === undefined) updates.posted_at = new Date();
    // Published now: any schedule or hold is done with (step 6c, services/postRelease).
    if (updates.status === 'live') { updates.release_state = null; updates.release_at = null; }
    // Evoni changing an AI draft's words is remembered (Task #3070): on approval it teaches the voice.
    if (post.ai_generated && updates.content_text !== undefined && String(updates.content_text).trim() !== String(post.content_text || '').trim()) {
      updates.edited_at = new Date();
    }
    // Releasing Lala's post, or one about her, is Review's: an admin's (Task #3047).
    if (updates.status === 'live' && post.status !== 'live') {
      const held = await releaseHold(req, { ...post.get(), ...updates });
      if (held.length) {
        return res.status(403).json({ error: 'Lala\'s posts and posts about her go live through Review.', code: 'REVIEW_REQUIRED', review_reasons: held });
      }
    }

    const released = post.status !== 'live' && updates.status === 'live';
    const learn = released && post.ai_generated && Boolean(updates.edited_at || post.edited_at);
    const newPhoto = updates.image_url !== undefined && (updates.image_url || null) !== (post.image_url || null);
    await post.update(updates);
    // A new photo: its teasers are cut again from it before the answer (Task #3052).
    if (newPhoto) await require('../services/pulseTeasers').recutFor(require('../models'), require('../services/pulseTeasers').postReveals(post.id));
    // An approved draft Evoni edited becomes an example of the poster's voice (Task #3070).
    if (learn) await require('../services/pulseVoices').learnFromEdit(require('../models'), { socialProfileId: post.social_profile_id, text: post.content_text, postId: post.id, by: req.user?.email || null });
    res.json({ data: post });
    // A draft going live has its numbers proposed after the response, never failing the release (Task #2953).
    if (released) require('../services/pulseNumbers').proposeLater(post);
    if (released) require('../services/pulseCloseness').proposeLater(post.id);
    return undefined;
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── A DRAFT'S PHOTOS (Task #3089) ────────────────────────────────────────────
// POST /api/v1/feed-posts/:postId/photos   multipart: photos (1–4 files, in
// order), alts (a JSON list of their alt texts, same order)
// Evoni, 2026-10-13: up to four photos, one by default; upload, reorder,
// remove and alt text; no AI generation. The draft's photos are replaced by
// these, stored as Pulse images (services/pulseImageService.js, no AI);
// image_url and image_description become the first one, and its teaser is
// cut again when it changes. A live post is locked (409), as for edits.
const MAX_PHOTOS = 4;
const MAX_PHOTO_ALT = 300;
const photoUpload = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: MAX_PHOTOS } }).array('photos', MAX_PHOTOS);
const postPhotos = (req, res, next) => photoUpload(req, res, (err) => {
  if (!err) return next();
  console.error('[FeedPosts] photo upload rejected:', err.message);
  const tooMany = err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE';
  return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Each photo is 15 MB at most.' : tooMany ? `Up to ${MAX_PHOTOS} photos.` : err.message });
});

router.post('/:postId/photos', requireAuth, postPhotos, async (req, res) => {
  const { storePulseImage, PulseImageError } = require('../services/pulseImageService');
  try {
    const { FeedPost } = require('../models');
    const post = await FeedPost.findByPk(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (isLive(post)) return res.status(409).json({ error: LOCKED_MESSAGE, status: post.status });
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ error: 'Choose at least one photo.' });
    let alts = [];
    if (req.body?.alts !== undefined) {
      try { alts = JSON.parse(req.body.alts); } catch (err) {
        console.error('[FeedPosts] photo alt texts unreadable:', err.message);
        return res.status(400).json({ error: 'alts must be a JSON list of texts.' });
      }
      if (!Array.isArray(alts)) return res.status(400).json({ error: 'alts must be a JSON list of texts.' });
    }
    const photos = [];
    for (const [i, file] of files.entries()) {
      const stored = await storePulseImage(file, { keyPrefix: `shows/pulse-posts/${post.show_id}`, maxSide: 2000, minSide: 200, label: `Photo ${i + 1}` });
      photos.push({ url: stored.url, alt: String(alts[i] ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_PHOTO_ALT) });
    }
    const newPhoto = (photos[0].url || null) !== (post.image_url || null);
    await post.update({ photos, image_url: photos[0].url, image_description: photos[0].alt || null });
    // A new first photo: its teasers are cut again from it before the answer (Task #3052).
    if (newPhoto) await require('../services/pulseTeasers').recutFor(require('../models'), require('../services/pulseTeasers').postReveals(post.id));
    return res.json({ data: post });
  } catch (err) {
    console.error('[FeedPosts] POST photos error:', err);
    if (err instanceof PulseImageError) return res.status(err.status).json({ error: err.message, code: err.code });
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

// ── DELETED POSTS (Lala's Feed → Deleted, Evoni, 2026-10-05) ────────────────
// GET /api/v1/feed-posts/deleted?show_id=&limit= — the show's soft-deleted
// posts, newest deletion first; DELETE above only sets deleted_at.
router.get('/deleted', requireAuth, async (req, res) => {
  try {
    const { FeedPost } = require('../models');
    const { Op } = require('sequelize');
    const { show_id, limit } = req.query;
    if (!show_id) return res.status(400).json({ error: 'show_id is required' });
    const posts = await FeedPost.findAll({
      where: { show_id, deleted_at: { [Op.ne]: null } },
      paranoid: false,
      order: [['deleted_at', 'DESC']],
      limit: Math.min(parseInt(limit, 10) || 50, 200),
    });
    return res.json({ data: posts, count: posts.length });
  } catch (err) {
    console.error('[FeedPosts] Deleted list error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/feed-posts/:postId/restore — bring a deleted post back as it was (draft or live).
router.post('/:postId/restore', requireAuth, async (req, res) => {
  try {
    const { FeedPost } = require('../models');
    const post = await FeedPost.findByPk(req.params.postId, { paranoid: false });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (!post.deleted_at) return res.status(409).json({ error: 'This post is not deleted' });
    await post.restore();
    return res.json({ data: post });
  } catch (err) {
    console.error('[FeedPosts] Restore error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/feed-posts/:postId/tags { tags } (Evoni, 2026-10-17): her own
// labels on a post (utils/postTags). Live posts too: tags are behind the
// curtain, not the post's words, so the 2009 lock does not apply.
router.put('/:postId/tags', requireAuth, async (req, res) => {
  try {
    const tagged = cleanTags(req.body?.tags);
    if (tagged.error) return res.status(400).json({ error: tagged.error });
    const post = await require('../models').FeedPost.findByPk(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    await post.update({ tags: tagged.tags });
    return res.json({ data: post });
  } catch (err) {
    console.error('[FeedPosts] tags error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/feed-posts/release-plan?show_id=&tz_offset= (Evoni, 2026-10-17,
// "schedule all"): every draft of the show with no release time, each at the
// time the story suggests and inside its story-order guards. Nothing saved.
router.get('/release-plan', requireAuth, async (req, res) => {
  try {
    const { planReleases, ReleaseError } = require('../services/postRelease');
    try {
      return res.json(await planReleases(require('../models'), { showId: req.query.show_id || null, tzOffset: Number(req.query.tz_offset) || 0 }));
    } catch (err) {
      if (err instanceof ReleaseError) return res.status(err.status).json({ error: err.message });
      throw err;
    }
  } catch (err) {
    console.error('[FeedPosts] release-plan error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/feed-posts/release-plan { items: [{ post_id, at }], tz_offset?, anyway? }:
// schedules the plan as she adjusted it. A time that breaks the story order
// is skipped with its problems unless `anyway`.
router.post('/release-plan', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { scheduleAll, ReleaseError } = require('../services/postRelease');
    try {
      return res.json(await scheduleAll(require('../models'), req.body?.items, { tzOffset: Number(req.body?.tz_offset) || 0, anyway: req.body?.anyway === true }));
    } catch (err) {
      if (err instanceof ReleaseError) return res.status(err.status).json({ error: err.message });
      throw err;
    }
  } catch (err) {
    console.error('[FeedPosts] release-plan apply error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/feed-posts/:postId/release-time { mode: 'schedule'|'hold'|'clear', at?, anyway?, tz_offset? }
// (Character Consistency Engine step 6c, the two clocks; services/postRelease):
// a draft's release time. Schedule: it goes live at `at` (the release timer);
// hold: it waits until released; clear: an ordinary draft again. Its story
// time does not change. Publishing now stays PUT /:postId { status: 'live' }.
// A schedule that breaks the story order (services/postRelease guardsFor) is
// a 409 with its problems until she sends anyway: true.
router.put('/:postId/release-time', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { setReleaseTime, checkReleaseTime, ReleaseError } = require('../services/postRelease');
    const models = require('../models');
    const post = await models.FeedPost.findByPk(req.params.postId);
    try {
      // A time that breaks the story order waits for her "Schedule anyway".
      if (req.body?.mode === 'schedule' && req.body?.at && !req.body?.anyway && post && post.status === 'draft' && !post.deleted_at) {
        const problems = await checkReleaseTime(models, post, req.body.at, { tzOffset: Number(req.body?.tz_offset) || 0 });
        if (problems.length) return res.status(409).json({ error: 'This time breaks the story order.', problems });
      }
      await setReleaseTime(post, { mode: req.body?.mode, at: req.body?.at ?? null });
    } catch (err) {
      if (err instanceof ReleaseError) return res.status(err.status).json({ error: err.message });
      throw err;
    }
    return res.json({ data: post });
  } catch (err) {
    console.error('[FeedPosts] release-time error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/feed-posts/:postId/release-time/suggest?tz_offset= (Evoni,
// 2026-10-17): a release time the story suggests, from the post's story time
// and its episode's air date, in her own hours (tz_offset: the browser's
// getTimezoneOffset). Nothing is saved; she schedules it, or changes it.
router.get('/:postId/release-time/suggest', requireAuth, async (req, res) => {
  try {
    const { suggestReleaseTime, ReleaseError } = require('../services/postRelease');
    const models = require('../models');
    const post = await models.FeedPost.findByPk(req.params.postId);
    try {
      return res.json(await suggestReleaseTime(models, post, { tzOffset: Number(req.query.tz_offset) || 0 }));
    } catch (err) {
      if (err instanceof ReleaseError) return res.status(err.status).json({ error: err.message });
      throw err;
    }
  } catch (err) {
    console.error('[FeedPosts] release-time suggest error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/feed-posts/:postId/redraft { note? } — rewrite a draft in its
// poster's voice (services/feedPostRedrafter.js); returns the old text for undo.
router.post('/:postId/redraft', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { redraftPost } = require('../services/feedPostRedrafter');
    const { post, previous_text, voice } = await redraftPost(require('../models'), req.params.postId, { note: req.body?.note ?? null });
    return res.json({ data: post, previous_text, voice });
  } catch (err) {
    if (err instanceof DraftError) return res.status(err.status).json({ error: err.message });
    if (err instanceof require('../services/pulseRequests').RequestCapError) {
      console.error('[FeedPosts] Redraft refused:', err.message);
      return res.status(429).json({ error: err.message, code: err.code });
    }
    console.error('[FeedPosts] Redraft error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

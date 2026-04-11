'use strict';

/**
 * Feed Engagement Service
 *
 * Closes the feedback loop between feed post engagement and future events.
 *
 * Core flows:
 * 1. Analyze post engagement → detect viral/trending patterns
 * 2. Calculate engagement velocity → identify momentum shifts
 * 3. Generate ripple effects → posts that spawn other posts (threads, quote tweets)
 * 4. Feed engagement back into opportunity/event pipeline
 * 5. Compute audience sentiment across an event's posts
 *
 * This transforms the feed from a passive display into an active narrative engine
 * where what happens in the feed drives what happens in the story.
 */

// ── VIRAL DETECTION THRESHOLDS ──────────────────────────────────────────────

const VIRAL_THRESHOLDS = {
  nano:  { likes: 500,   velocity: 50,  label: 'Micro-viral' },
  mid:   { likes: 2000,  velocity: 200, label: 'Going viral' },
  mega:  { likes: 10000, velocity: 800, label: 'Viral moment' },
  ultra: { likes: 50000, velocity: 3000, label: 'Cultural moment' },
};

const SENTIMENT_RULES = {
  // narrative_function → likely audience sentiment
  support:      'supportive',
  flex:         'curious',
  shade:        'divided',
  gossip:       'divided',
  comparison:   'divided',
  reaction:     'supportive',
  bts:          'supportive',
  brand_content: 'curious',
  callback:     'curious',
};

// ── ENGAGEMENT VELOCITY ─────────────────────────────────────────────────────

/**
 * Calculate engagement velocity for a post.
 * Velocity = (likes + comments * 3 + shares * 5) / hours_since_posted
 * Comments and shares weighted higher because they indicate deeper engagement.
 */
function calculateVelocity(post) {
  const hoursLive = Math.max(1, (Date.now() - new Date(post.posted_at).getTime()) / 3600000);
  const weighted = (post.likes || 0) + (post.comments_count || 0) * 3 + (post.shares || 0) * 5;
  return Math.round((weighted / hoursLive) * 100) / 100;
}

/**
 * Determine viral tier from engagement metrics.
 */
function detectViralTier(likes, velocity) {
  if (likes >= VIRAL_THRESHOLDS.ultra.likes || velocity >= VIRAL_THRESHOLDS.ultra.velocity) return 'ultra';
  if (likes >= VIRAL_THRESHOLDS.mega.likes || velocity >= VIRAL_THRESHOLDS.mega.velocity) return 'mega';
  if (likes >= VIRAL_THRESHOLDS.mid.likes || velocity >= VIRAL_THRESHOLDS.mid.velocity) return 'mid';
  if (likes >= VIRAL_THRESHOLDS.nano.likes || velocity >= VIRAL_THRESHOLDS.nano.velocity) return 'nano';
  return null;
}

// ── ANALYZE EVENT ENGAGEMENT ────────────────────────────────────────────────

/**
 * Analyze all feed posts for an event and compute engagement signals.
 * Returns trending topics, viral posts, audience sentiment, and momentum score.
 */
async function analyzeEventEngagement(eventId, models) {
  const { FeedPost, sequelize } = models;

  const posts = await FeedPost.findAll({
    where: { event_id: eventId, deleted_at: null },
    order: [['posted_at', 'ASC']],
  });

  if (posts.length === 0) return { posts: [], viral: [], trending: [], sentiment: 'indifferent', momentum: 0 };

  const results = [];
  const viralPosts = [];
  const trendingTopics = {};
  const sentimentCounts = {};
  let totalEngagement = 0;

  for (const post of posts) {
    const velocity = calculateVelocity(post);
    const viralTier = detectViralTier(post.likes || 0, velocity);
    const sentiment = SENTIMENT_RULES[post.narrative_function] || 'curious';

    sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1;
    totalEngagement += (post.likes || 0) + (post.comments_count || 0) + (post.shares || 0);

    // Extract trending topics from hashtags in content
    const hashtags = (post.content_text || '').match(/#[\w]+/g) || [];
    for (const tag of hashtags) {
      const key = tag.toLowerCase();
      trendingTopics[key] = (trendingTopics[key] || 0) + 1;
    }

    const analysis = {
      post_id: post.id,
      poster_handle: post.poster_handle,
      velocity,
      viral_tier: viralTier,
      sentiment,
      total_engagement: (post.likes || 0) + (post.comments_count || 0) + (post.shares || 0),
    };

    results.push(analysis);

    // Update post with computed fields
    const updates = { engagement_velocity: velocity, audience_sentiment: sentiment };
    if (viralTier) {
      updates.is_viral = true;
      updates.viral_reach = Math.floor((post.likes || 0) * (viralTier === 'ultra' ? 20 : viralTier === 'mega' ? 10 : viralTier === 'mid' ? 5 : 2));
      viralPosts.push({ ...analysis, handle: post.poster_handle, content_preview: (post.content_text || '').slice(0, 100) });
    }

    try {
      await post.update(updates);
    } catch { /* non-critical — continue analysis */ }
  }

  // Overall event sentiment
  const topSentiment = Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0];
  const eventSentiment = topSentiment ? topSentiment[0] : 'indifferent';

  // Trending topics (mentioned in 2+ posts)
  const trending = Object.entries(trendingTopics)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, post_count: count }));

  // Momentum score — normalized engagement that feeds into event pipeline
  const momentum = Math.round((totalEngagement / Math.max(1, posts.length)) * (viralPosts.length + 1) / 100);

  return {
    posts: results,
    viral: viralPosts,
    trending,
    sentiment: eventSentiment,
    momentum,
    total_engagement: totalEngagement,
    post_count: posts.length,
  };
}

// ── GENERATE RIPPLE EFFECTS ─────────────────────────────────────────────────

/**
 * When a post goes viral or generates strong engagement, it spawns ripple effects:
 * - Reply threads from other characters
 * - Quote-tweet style reactions
 * - Relationship shifts between characters
 * - Opportunity triggers (brands notice viral content)
 */
async function generateRippleEffects(postId, models) {
  const { FeedPost, SocialProfile, sequelize } = models;

  const post = await FeedPost.findByPk(postId);
  if (!post) throw new Error('Post not found');

  const velocity = calculateVelocity(post);
  const viralTier = detectViralTier(post.likes || 0, velocity);
  if (!viralTier) return { ripples: [], message: 'Post has not reached viral threshold' };

  // Get other profiles who might react
  const reactors = await SocialProfile.findAll({
    where: { status: ['generated', 'finalized', 'crossed'] },
    attributes: ['id', 'handle', 'display_name', 'platform', 'archetype', 'follow_emotion', 'career_pressure'],
    order: sequelize.random(),
    limit: 8,
  });

  const ripples = [];
  const threadId = post.thread_id || post.id; // Use existing thread or start new one

  for (const reactor of reactors) {
    // Determine reaction type based on archetype + career pressure
    let reactionType = 'supportive_reply';
    let narrativeFunction = 'support';
    let emotionalImpact = 'validation';

    if (reactor.career_pressure === 'ahead' || reactor.archetype === 'polished_curator') {
      reactionType = 'subtle_shade';
      narrativeFunction = 'shade';
      emotionalImpact = 'anxiety';
    } else if (reactor.archetype === 'chaos_creator') {
      reactionType = 'amplify_drama';
      narrativeFunction = 'gossip';
      emotionalImpact = 'anxiety';
    } else if (reactor.archetype === 'the_peer' || reactor.follow_emotion === 'admiration') {
      reactionType = 'genuine_support';
      narrativeFunction = 'support';
      emotionalImpact = 'confidence_boost';
    } else if (reactor.archetype === 'overnight_rise') {
      reactionType = 'comparison_post';
      narrativeFunction = 'comparison';
      emotionalImpact = 'jealousy';
    }

    // Only some reactors actually post (50% chance)
    if (Math.random() > 0.5) continue;

    const replyTemplates = {
      supportive_reply: `@${post.poster_handle} went OFF. This is everything.`,
      subtle_shade: `Interesting approach... not for everyone but she commits to it.`,
      amplify_drama: `WAIT. Did everyone see @${post.poster_handle}'s post?? The comments are WILD.`,
      genuine_support: `I love seeing @${post.poster_handle} win. Deserve everything coming her way.`,
      comparison_post: `Since everyone's talking about last night... here's my take.`,
    };

    try {
      const replyPost = await FeedPost.create({
        show_id: post.show_id,
        episode_id: post.episode_id,
        event_id: post.event_id,
        social_profile_id: reactor.id,
        poster_handle: reactor.handle,
        poster_display_name: reactor.display_name,
        poster_platform: reactor.platform || 'twitter',
        post_type: reactionType === 'comparison_post' ? 'post' : 'tweet',
        content_text: replyTemplates[reactionType],
        likes: Math.floor(Math.random() * (post.likes || 100) * 0.3),
        comments_count: Math.floor(Math.random() * 20),
        shares: Math.floor(Math.random() * 10),
        sample_comments: [],
        posted_at: new Date(),
        timeline_position: post.timeline_position || 'after_episode',
        narrative_function: narrativeFunction,
        emotional_impact: emotionalImpact,
        ai_generated: true,
        generation_model: 'ripple_engine',
        thread_id: threadId,
        parent_post_id: post.id,
        audience_sentiment: SENTIMENT_RULES[narrativeFunction] || 'curious',
        sort_order: (post.sort_order || 0) + ripples.length + 1,
      });
      ripples.push({ id: replyPost.id, handle: reactor.handle, type: reactionType, function: narrativeFunction });
    } catch (err) {
      console.warn(`[Ripple] Failed to create reply from ${reactor.handle}:`, err.message);
    }
  }

  // Update original post with ripple metadata
  try {
    await post.update({
      thread_id: threadId,
      ripple_effect: {
        spawned_posts: ripples.length,
        reaction_types: [...new Set(ripples.map(r => r.type))],
        relationship_shifts: ripples.filter(r => r.type === 'subtle_shade' || r.type === 'amplify_drama').map(r => ({
          handle: r.handle, shift: r.type === 'subtle_shade' ? 'tension_increase' : 'drama_escalation',
        })),
        opportunity_triggers: viralTier === 'mega' || viralTier === 'ultra' ? [{
          type: 'brand_notice', reason: `Post reached ${VIRAL_THRESHOLDS[viralTier].label} status`,
        }] : [],
      },
    });
  } catch { /* non-critical */ }

  return { ripples, thread_id: threadId, viral_tier: viralTier };
}

// ── FEED MOMENTUM → EVENT PIPELINE ──────────────────────────────────────────

/**
 * Compute a show's overall feed momentum and identify events worth chaining.
 * High-momentum events should spawn follow-up events automatically.
 *
 * Returns events sorted by momentum with recommendations for chaining.
 */
async function computeFeedMomentum(showId, models) {
  const { sequelize } = models;

  // Get events with their feed engagement
  const [events] = await sequelize.query(`
    SELECT we.id, we.name, we.event_type, we.prestige, we.status, we.seeds_future_events,
           we.parent_event_id, we.chain_position, we.momentum_score,
           COUNT(fp.id) as post_count,
           COALESCE(SUM(fp.likes), 0) as total_likes,
           COALESCE(SUM(fp.comments_count), 0) as total_comments,
           COALESCE(SUM(fp.shares), 0) as total_shares,
           COUNT(fp.id) FILTER (WHERE fp.is_viral = true) as viral_posts
    FROM world_events we
    LEFT JOIN feed_posts fp ON fp.event_id = we.id AND fp.deleted_at IS NULL
    WHERE we.show_id = :showId AND we.deleted_at IS NULL
    GROUP BY we.id
    ORDER BY (COALESCE(SUM(fp.likes), 0) + COALESCE(SUM(fp.comments_count), 0) * 3 + COALESCE(SUM(fp.shares), 0) * 5) DESC
  `, { replacements: { showId } });

  const results = [];

  for (const event of events) {
    const totalEngagement = parseInt(event.total_likes) + parseInt(event.total_comments) + parseInt(event.total_shares);
    const momentum = Math.round(totalEngagement * (parseInt(event.viral_posts) + 1) / Math.max(1, parseInt(event.post_count)) / 100);
    const shouldChain = momentum > 10 && event.status === 'used' && !event.parent_event_id;

    // Update momentum score on the event
    try {
      await sequelize.query(
        'UPDATE world_events SET momentum_score = :momentum, updated_at = NOW() WHERE id = :id',
        { replacements: { momentum, id: event.id } }
      );
    } catch { /* non-critical */ }

    const chainRecommendations = [];
    if (shouldChain) {
      // Recommend sequel events based on event type and engagement pattern
      if (parseInt(event.viral_posts) >= 2) {
        chainRecommendations.push({
          type: 'brand_deal',
          reason: `Viral content from "${event.name}" attracted brand attention`,
          suggested_prestige: Math.min(10, event.prestige + 1),
        });
      }
      if (parseInt(event.total_comments) > parseInt(event.total_likes) * 0.1) {
        chainRecommendations.push({
          type: 'interview',
          reason: `High comment ratio on "${event.name}" posts — audience wants to hear more`,
          suggested_prestige: event.prestige,
        });
      }
      if (parseInt(event.viral_posts) >= 1 && event.prestige >= 7) {
        chainRecommendations.push({
          type: 'award_show',
          reason: `Prestige + viral momentum from "${event.name}" opens doors`,
          suggested_prestige: Math.min(10, event.prestige + 2),
        });
      }
    }

    results.push({
      event_id: event.id,
      name: event.name,
      event_type: event.event_type,
      prestige: event.prestige,
      status: event.status,
      post_count: parseInt(event.post_count),
      total_likes: parseInt(event.total_likes),
      total_comments: parseInt(event.total_comments),
      viral_posts: parseInt(event.viral_posts),
      momentum,
      should_chain: shouldChain,
      chain_recommendations: chainRecommendations,
    });
  }

  return {
    events: results,
    total_momentum: results.reduce((sum, e) => sum + e.momentum, 0),
    viral_event_count: results.filter(e => e.viral_posts > 0).length,
    chain_candidates: results.filter(e => e.should_chain).length,
  };
}

// ── TRENDING TOPICS ACROSS SHOW ─────────────────────────────────────────────

/**
 * Aggregate trending hashtags/topics across all feed posts for a show.
 */
async function getTrendingTopics(showId, models) {
  const { FeedPost } = models;

  const posts = await FeedPost.findAll({
    where: { show_id: showId, deleted_at: null },
    attributes: ['content_text', 'trending_topic', 'likes', 'comments_count', 'shares', 'event_id', 'narrative_function'],
    order: [['posted_at', 'DESC']],
    limit: 200,
  });

  const topics = {};

  for (const post of posts) {
    // From explicit trending_topic field
    if (post.trending_topic) {
      const key = post.trending_topic.toLowerCase();
      if (!topics[key]) topics[key] = { topic: post.trending_topic, post_count: 0, total_engagement: 0, events: new Set(), functions: new Set() };
      topics[key].post_count++;
      topics[key].total_engagement += (post.likes || 0) + (post.comments_count || 0) + (post.shares || 0);
      if (post.event_id) topics[key].events.add(post.event_id);
      if (post.narrative_function) topics[key].functions.add(post.narrative_function);
    }

    // From hashtags in content
    const hashtags = (post.content_text || '').match(/#[\w]+/g) || [];
    for (const tag of hashtags) {
      const key = tag.toLowerCase();
      if (!topics[key]) topics[key] = { topic: tag, post_count: 0, total_engagement: 0, events: new Set(), functions: new Set() };
      topics[key].post_count++;
      topics[key].total_engagement += (post.likes || 0) + (post.comments_count || 0) + (post.shares || 0);
      if (post.event_id) topics[key].events.add(post.event_id);
      if (post.narrative_function) topics[key].functions.add(post.narrative_function);
    }
  }

  return Object.values(topics)
    .map(t => ({ ...t, events: [...t.events], functions: [...t.functions] }))
    .sort((a, b) => b.total_engagement - a.total_engagement)
    .slice(0, 20);
}

module.exports = {
  VIRAL_THRESHOLDS,
  calculateVelocity,
  detectViralTier,
  analyzeEventEngagement,
  generateRippleEffects,
  computeFeedMomentum,
  getTrendingTopics,
};

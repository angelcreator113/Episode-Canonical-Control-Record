'use strict';

/**
 * Feed Post Generator Service
 *
 * After an episode completes, generates feed posts from characters who:
 * - Attended the event
 * - Are in Lala's social circle
 * - Have opinions about what happened
 *
 * Creates realistic social media posts (Instagram, TikTok, Twitter)
 * with engagement metrics, comments, and Lala's internal reactions.
 */

const Anthropic = require('@anthropic-ai/sdk');

const { calculateVelocity, detectViralTier, VIRAL_THRESHOLDS } = require('./feedEngagementService');

const CLAUDE_MODEL = 'claude-sonnet-4-6';
let client = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Generate feed posts after an episode completes.
 * Returns array of FeedPost records.
 */
async function generateEpisodeFeedPosts(episodeId, showId, models) {
  const { Episode, WorldEvent, SocialProfile, FeedPost, EpisodeScript, sequelize } = models;

  // Load episode + event
  const episode = await Episode.findByPk(episodeId);
  if (!episode) throw new Error('Episode not found');

  let event = null;
  try {
    event = await WorldEvent.findOne({ where: { used_in_episode_id: episodeId } });
  } catch { /* skip */ }

  // Load the latest script
  let script = null;
  if (EpisodeScript) {
    try {
      script = await EpisodeScript.findOne({
        where: { episode_id: episodeId, deleted_at: null },
        order: [['version', 'DESC']],
        attributes: ['script_text', 'script_json', 'financial_context', 'wardrobe_locked'],
      });
    } catch { /* skip */ }
  }

  // Load relevant social profiles (event attendees + Lala's circle)
  let profiles = [];
  try {
    // Get profiles with high relevance to Lala
    profiles = await SocialProfile.findAll({
      where: {
        series_id: null, // Filter will be by show context
        status: ['generated', 'finalized', 'crossed'],
      },
      attributes: ['id', 'handle', 'display_name', 'platform', 'vibe_sentence',
                   'archetype', 'posting_voice', 'follow_motivation', 'follow_emotion',
                   'lala_relevance_score', 'celebrity_tier', 'content_category',
                   'follower_tier', 'aesthetic_dna', 'career_pressure'],
      order: [['lala_relevance_score', 'DESC']],
      limit: 20,
    });
  } catch { /* skip */ }

  // Load event guest list if available
  let guestList = [];
  if (event) {
    try {
      const [rows] = await sequelize.query(
        `SELECT guest_list FROM world_events WHERE id = :eventId`,
        { replacements: { eventId: event.id } }
      );
      guestList = rows?.[0]?.guest_list || [];
    } catch { /* skip */ }
  }

  // Build prompt
  const profileContext = profiles.slice(0, 12).map(p => {
    const d = p.toJSON();
    return `@${d.handle} (${d.display_name || d.handle})
  Platform: ${d.platform} | Archetype: ${d.archetype} | Tier: ${d.follower_tier}
  Voice: ${d.posting_voice || d.vibe_sentence}
  Lala's follow motivation: ${d.follow_motivation || 'none'}
  Emotional response: ${d.follow_emotion || 'neutral'}
  Career pressure vs Lala: ${d.career_pressure || 'level'}`;
  }).join('\n\n');

  const eventContext = event
    ? `EVENT: ${event.name}\nType: ${event.event_type}\nPrestige: ${event.prestige}/10\nDress code: ${event.dress_code || 'N/A'}\nHost: ${event.host || 'Unknown'}`
    : 'No specific event';

  const financialContext = script?.financial_context
    ? `Financial: ${script.financial_context.pressure_level} ($${script.financial_context.balance} balance)`
    : '';

  const wardrobeContext = script?.wardrobe_locked?.length > 0
    ? `Outfit: ${script.wardrobe_locked.map(w => w.name).join(', ')}`
    : '';

  const scriptSummary = script?.script_text
    ? script.script_text.slice(0, 800)
    : episode.description || '';

  // Load arc context — what phase we're in affects feed tone
  let arcContext = '';
  try {
    const { getArcContext } = require('./arcProgressionService');
    const arc = await getArcContext(showId, { sequelize: models.sequelize });
    if (arc) {
      arcContext = `\nSEASON CONTEXT:
Phase: ${arc.current_phase.title} — "${arc.current_phase.tagline}"
Emotional Temperature: ${arc.emotional_temperature}
Feed Tone: ${arc.feed_behavior?.feed_tone || 'neutral'}
Follow Bias: ${arc.feed_behavior?.follow_bias || 'balanced'}`;
      if (arc.narrative_debt?.length > 0) {
        arcContext += `\nNarrative Debt (emotional weight Lala carries): ${arc.narrative_debt.map(d => d.weight).join(' ')}`;
      }
    }
  } catch { /* arc system not available — continue without */ }

  const prompt = `You are generating social media feed posts that appear AFTER an episode of "Styling Adventures with Lala."

EPISODE: ${episode.title || `Episode ${episode.episode_number}`}
${eventContext}
${financialContext}
${wardrobeContext}${arcContext}

WHAT HAPPENED (script excerpt):
${scriptSummary}

CHARACTERS WHO MIGHT POST:
${profileContext}

${guestList.length > 0 ? `EVENT GUEST LIST: ${JSON.stringify(guestList)}` : ''}

Generate 6-10 feed posts that appear in the timeline after this episode. Mix of:
1. **Reaction posts** — characters who attended react to the event
2. **BTS/Flex posts** — Lala or others share behind-the-scenes moments
3. **Shade/Gossip** — subtle (or not subtle) commentary
4. **Support** — friends hyping Lala up
5. **Comparison** — other creators posting their own version
6. **Brand content** — if there was a brand involved, they might post about it
7. **Thread starters** — posts designed to spark reply chains and drama threads
8. **Viral contenders** — at least one post with breakout potential (high engagement, shareable hook)

For each post, return JSON array:
[{
  "poster_handle": "@handle",
  "poster_display_name": "Display Name",
  "poster_platform": "instagram",
  "post_type": "post",
  "content_text": "caption text with hashtags (include 1-3 relevant hashtags)",
  "image_description": "what the photo/video shows",
  "likes": 1234,
  "comments_count": 56,
  "shares": 12,
  "sample_comments": [
    { "handle": "@someone", "text": "comment text in their actual voice", "likes": 10, "is_lala": false }
  ],
  "timeline_position": "after_episode",
  "narrative_function": "reaction",
  "lala_reaction": "what Lala says when she sees this",
  "lala_internal_thought": "what Lala really thinks",
  "emotional_impact": "confidence_boost",
  "trending_topic": "#EventName or null if not trending",
  "audience_sentiment": "supportive | divided | hostile | curious | indifferent",
  "viral_potential": "none | low | medium | high",
  "spawns_thread": false
}]

RULES:
- Each post must sound like the character's ACTUAL voice — match their posting_voice
- Include at least one post where Lala herself posts
- Include at least one subtle shade post
- Include at least one post with high viral_potential (sharp take, relatable moment, or drama)
- Include 2-4 sample_comments per post — each comment should sound like a distinct person
- Engagement numbers should be realistic for each character's follower_tier
- Lala's internal thoughts should reveal what she REALLY feels vs. what she shows
- Timeline positions should vary: after_episode, next_day, week_later
- Posts with spawns_thread=true should be provocative enough that other characters would reply
- audience_sentiment reflects how THE AUDIENCE (not Lala) reacts

Return ONLY the JSON array.`;

  console.log(`[FeedPosts] Generating for episode ${episodeId} with ${profiles.length} profiles`);

  const response = await getClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = response.content[0]?.text || '';

  // Parse JSON
  let postsData = [];
  try {
    const match = rawText.match(/\[[\s\S]*\]/);
    if (match) postsData = JSON.parse(match[0]);
  } catch (err) {
    console.warn('[FeedPosts] JSON parse failed:', err.message);
    return [];
  }

  // Save to database
  const savedPosts = [];
  for (let i = 0; i < postsData.length; i++) {
    const post = postsData[i];

    // Find matching social profile
    let profileId = null;
    if (post.poster_handle) {
      const handle = post.poster_handle.replace('@', '');
      const match = profiles.find(p => p.handle === handle);
      if (match) profileId = match.id;
    }

    try {
      // Compute engagement velocity and viral status from AI-assigned metrics
      const postLikes = post.likes || 0;
      const postComments = post.comments_count || 0;
      const postShares = post.shares || 0;
      const simulatedVelocity = (postLikes + postComments * 3 + postShares * 5) / 6; // assume 6h window
      const viralTier = detectViralTier(postLikes, simulatedVelocity);
      const isViral = viralTier !== null || post.viral_potential === 'high';

      const feedPost = await FeedPost.create({
        show_id: showId,
        episode_id: episodeId,
        event_id: event?.id || null,
        social_profile_id: profileId,
        poster_handle: (post.poster_handle || 'unknown').replace('@', ''),
        poster_display_name: post.poster_display_name || null,
        poster_platform: post.poster_platform || 'instagram',
        post_type: post.post_type || 'post',
        content_text: post.content_text || '',
        image_description: post.image_description || null,
        likes: postLikes,
        comments_count: postComments,
        shares: postShares,
        sample_comments: post.sample_comments || [],
        posted_at: new Date(),
        timeline_position: post.timeline_position || 'after_episode',
        narrative_function: post.narrative_function || 'reaction',
        lala_reaction: post.lala_reaction || null,
        lala_internal_thought: post.lala_internal_thought || null,
        emotional_impact: post.emotional_impact || null,
        ai_generated: true,
        generation_model: CLAUDE_MODEL,
        sort_order: i,
        // New enhanced fields
        is_viral: isViral,
        viral_reach: isViral ? Math.floor(postLikes * (viralTier === 'mega' ? 10 : viralTier === 'mid' ? 5 : 2)) : 0,
        engagement_velocity: Math.round(simulatedVelocity * 100) / 100,
        trending_topic: post.trending_topic || null,
        thread_id: post.spawns_thread ? null : null, // thread_id assigned when replies arrive
        audience_sentiment: post.audience_sentiment || null,
      });
      savedPosts.push(feedPost);
    } catch (err) {
      console.warn(`[FeedPosts] Failed to save post ${i}:`, err.message);
    }
  }

  console.log(`[FeedPosts] Generated ${savedPosts.length} posts for episode ${episodeId}`);
  return savedPosts;
}

/**
 * Persist feed moments to database after generation.
 * Bridges feedMomentsService (generates) → FeedMoment model (persists).
 */
async function persistFeedMoments(episodeId, showId, eventId, moments, models) {
  const { FeedMoment } = models;
  if (!FeedMoment) {
    console.warn('[FeedPosts] FeedMoment model not available — skipping persistence');
    return [];
  }

  const saved = [];
  const beatNumbers = Object.keys(moments).map(Number).sort((a, b) => a - b);

  for (let idx = 0; idx < beatNumbers.length; idx++) {
    const beatNum = beatNumbers[idx];
    const m = moments[beatNum];
    if (!m) continue;

    try {
      const record = await FeedMoment.create({
        show_id: showId,
        episode_id: episodeId,
        event_id: eventId || null,
        beat_number: beatNum,
        beat_context: m.beat_context || null,
        trigger_handle: m.trigger_profile || null,
        trigger_action: m.trigger_action || null,
        phone_screen_type: m.on_screen?.type || null,
        screen_content: m.on_screen?.content || null,
        screen_image_desc: m.on_screen?.image_desc || null,
        asset_type: m.on_screen?.asset_type || null,
        asset_role: m.on_screen?.asset_role || null,
        justawoman_line: m.script_lines?.justawoman_line || null,
        justawoman_action: m.script_lines?.justawoman_action || null,
        lala_line: m.script_lines?.lala_line || null,
        lala_internal: m.script_lines?.lala_internal || null,
        direction: m.script_lines?.direction || null,
        financial_context: m.financial || null,
        behavior_change: m.script_lines?.direction || null,
        sort_order: idx,
      });
      saved.push(record);
    } catch (err) {
      console.warn(`[FeedPosts] Failed to persist moment for beat ${beatNum}:`, err.message);
    }
  }

  console.log(`[FeedPosts] Persisted ${saved.length} feed moments for episode ${episodeId}`);
  return saved;
}

module.exports = { generateEpisodeFeedPosts, persistFeedMoments };

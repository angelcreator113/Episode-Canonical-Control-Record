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

  const prompt = `You are generating social media feed posts that appear AFTER an episode of "Styling Adventures with Lala."

EPISODE: ${episode.title || `Episode ${episode.episode_number}`}
${eventContext}
${financialContext}
${wardrobeContext}

WHAT HAPPENED (script excerpt):
${scriptSummary}

CHARACTERS WHO MIGHT POST:
${profileContext}

${guestList.length > 0 ? `EVENT GUEST LIST: ${JSON.stringify(guestList)}` : ''}

Generate 5-8 feed posts that appear in the timeline after this episode. Mix of:
1. **Reaction posts** — characters who attended react to the event
2. **BTS/Flex posts** — Lala or others share behind-the-scenes moments
3. **Shade/Gossip** — subtle (or not subtle) commentary
4. **Support** — friends hyping Lala up
5. **Comparison** — other creators posting their own version
6. **Brand content** — if there was a brand involved, they might post about it

For each post, return JSON array:
[{
  "poster_handle": "@handle",
  "poster_display_name": "Display Name",
  "poster_platform": "instagram",
  "post_type": "post",
  "content_text": "caption text with hashtags",
  "image_description": "what the photo/video shows",
  "likes": 1234,
  "comments_count": 56,
  "shares": 12,
  "sample_comments": [
    { "handle": "@someone", "text": "comment text", "likes": 10, "is_lala": false }
  ],
  "timeline_position": "after_episode",
  "narrative_function": "reaction",
  "lala_reaction": "what Lala says when she sees this",
  "lala_internal_thought": "what Lala really thinks",
  "emotional_impact": "confidence_boost"
}]

RULES:
- Each post must sound like the character's ACTUAL voice — match their posting_voice
- Include at least one post where Lala herself posts
- Include at least one subtle shade post
- Engagement numbers should be realistic for each character's follower_tier
- Lala's internal thoughts should reveal what she REALLY feels vs. what she shows
- Timeline positions should vary: after_episode, next_day, week_later

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
        likes: post.likes || 0,
        comments_count: post.comments_count || 0,
        shares: post.shares || 0,
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
      });
      savedPosts.push(feedPost);
    } catch (err) {
      console.warn(`[FeedPosts] Failed to save post ${i}:`, err.message);
    }
  }

  console.log(`[FeedPosts] Generated ${savedPosts.length} posts for episode ${episodeId}`);
  return savedPosts;
}

module.exports = { generateEpisodeFeedPosts };

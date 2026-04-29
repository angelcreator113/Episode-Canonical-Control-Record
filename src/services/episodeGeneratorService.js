'use strict';

/**
 * Episode Generator Service
 *
 * Generates complete episode blueprints from world events:
 * - Episode brief with archetype and intent
 * - Scene plan with 14 beats mapped to locations
 * - Wardrobe todo list with outfit requirements
 * - Social media task list with content requirements
 * - Financial summary (income vs expenses)
 *
 * Flow: WorldEvent → Episode + Brief + ScenePlan + TodoList
 */

const { v4: uuidv4 } = require('uuid');

// ─── SOCIAL MEDIA TASK TEMPLATES ─────────────────────────────────────────────
// Tasks vary by event type and timing (before/during/after)

const SOCIAL_TASK_TEMPLATES = {
  invite: {
    before: [
      { slot: 'grwm', label: 'Get Ready With Me', description: 'Film getting ready process — outfit, hair, makeup', platform: 'tiktok', timing: 'before', required: true },
      { slot: 'outfit_reveal', label: 'Outfit Reveal', description: 'Post outfit details to stories, tag brands', platform: 'instagram', timing: 'before', required: true },
    ],
    during: [
      { slot: 'arrival', label: 'Arrival Content', description: 'Film arrival — venue, outfit, energy', platform: 'instagram', timing: 'during', required: true },
      { slot: 'host_photo', label: 'Photo with Host', description: 'Post with the host — relationship visibility', platform: 'instagram', timing: 'during', required: true },
      { slot: 'go_live', label: 'Go Live', description: 'Live stream from the event — engagement opportunity', platform: 'tiktok', timing: 'during', required: false },
      { slot: 'bts_stories', label: 'Behind the Scenes', description: 'Stories showing exclusivity — who is here, vibes, food', platform: 'instagram', timing: 'during', required: true },
    ],
    after: [
      { slot: 'recap', label: 'Event Recap', description: 'Carousel or reel summarizing the night', platform: 'instagram', timing: 'after', required: true },
      { slot: 'thank_host', label: 'Thank the Host', description: 'Public appreciation post — relationship maintenance', platform: 'instagram', timing: 'after', required: false },
      { slot: 'engage', label: 'Engage with Attendees', description: 'Comment on other attendees posts — network building', platform: 'instagram', timing: 'after', required: false },
    ],
  },
  brand_deal: {
    before: [
      { slot: 'teaser', label: 'Brand Teaser', description: 'Hint at upcoming collab without revealing', platform: 'instagram', timing: 'before', required: false },
    ],
    during: [
      { slot: 'brand_post_1', label: 'Sponsored Post 1', description: 'Primary brand content — must follow brief', platform: 'instagram', timing: 'during', required: true },
      { slot: 'brand_post_2', label: 'Sponsored Post 2', description: 'Secondary brand content — different angle', platform: 'tiktok', timing: 'during', required: true },
      { slot: 'brand_stories', label: 'Brand Stories', description: 'Stories showing product in use — authentic feel', platform: 'instagram', timing: 'during', required: true },
    ],
    after: [
      { slot: 'engagement_check', label: 'Check Engagement', description: 'Monitor metrics — brand will check', platform: 'instagram', timing: 'after', required: true },
    ],
  },
  guest: {
    before: [
      { slot: 'grwm', label: 'Get Ready', description: 'Getting ready content — casual vibe', platform: 'tiktok', timing: 'before', required: false },
    ],
    during: [
      { slot: 'presence', label: 'Show Presence', description: 'Post that you are here — be seen', platform: 'instagram', timing: 'during', required: true },
      { slot: 'network', label: 'Network Content', description: 'Photos with other attendees — expand reach', platform: 'instagram', timing: 'during', required: true },
    ],
    after: [
      { slot: 'recap', label: 'Recap', description: 'Quick recap of the experience', platform: 'tiktok', timing: 'after', required: false },
    ],
  },
  upgrade: {
    before: [
      { slot: 'grwm', label: 'Elevated GRWM', description: 'Make this one special — higher production value', platform: 'tiktok', timing: 'before', required: true },
    ],
    during: [
      { slot: 'arrival', label: 'Grand Arrival', description: 'Film the full arrival — venue reveal moment', platform: 'instagram', timing: 'during', required: true },
      { slot: 'experience', label: 'VIP Experience', description: 'Show the exclusive access — what others dont see', platform: 'instagram', timing: 'during', required: true },
    ],
    after: [
      { slot: 'recap', label: 'Experience Recap', description: 'Cinematic recap — this is portfolio content', platform: 'instagram', timing: 'after', required: true },
    ],
  },
};

// Default for unknown types
SOCIAL_TASK_TEMPLATES.default = SOCIAL_TASK_TEMPLATES.invite;

// ─── PLATFORM-SPECIFIC TASKS ────────────────────────────────────────────────
// Extra tasks based on the host profile's primary platform

const PLATFORM_TASKS = {
  tiktok: [
    { slot: 'tiktok_trend', label: 'TikTok Trend', description: 'Film a trending sound/format at the event', platform: 'tiktok', timing: 'during', required: false },
    { slot: 'tiktok_duet', label: 'Duet Bait', description: 'Post something attendees will duet or stitch', platform: 'tiktok', timing: 'after', required: false },
  ],
  instagram: [
    { slot: 'ig_carousel', label: 'Photo Carousel', description: 'Polished multi-image post — the grid matters', platform: 'instagram', timing: 'after', required: false },
    { slot: 'ig_collab', label: 'Collab Post', description: 'Joint post with host or key attendee — shared audiences', platform: 'instagram', timing: 'after', required: false },
  ],
  youtube: [
    { slot: 'yt_vlog', label: 'Vlog the Event', description: 'Film everything — this becomes a full video', platform: 'youtube', timing: 'during', required: true },
    { slot: 'yt_broll', label: 'Capture B-Roll', description: 'Get cinematic shots for the edit — venue, crowd, details', platform: 'youtube', timing: 'during', required: true },
    { slot: 'yt_thumbnail', label: 'Thumbnail Moment', description: 'Stage a thumbnail-worthy reaction shot', platform: 'youtube', timing: 'during', required: false },
  ],
  twitter: [
    { slot: 'twitter_thread', label: 'Live Thread', description: 'Tweet play-by-play from the event — build narrative', platform: 'twitter', timing: 'during', required: true },
    { slot: 'twitter_take', label: 'Hot Take', description: 'Post a spicy opinion about the event — drive engagement', platform: 'twitter', timing: 'after', required: false },
  ],
  onlyfans: [
    { slot: 'of_exclusive', label: 'Exclusive BTS', description: 'Behind-the-scenes content only subscribers see', platform: 'onlyfans', timing: 'after', required: true },
    { slot: 'of_tease', label: 'Free Tease', description: 'Post a teaser on main socials that drives to subscriber content', platform: 'onlyfans', timing: 'after', required: false },
  ],
  twitch: [
    { slot: 'twitch_irl', label: 'IRL Stream', description: 'Live stream the event to your community', platform: 'twitch', timing: 'during', required: true },
    { slot: 'twitch_react', label: 'Reaction Stream', description: 'React to the event content with your chat after', platform: 'twitch', timing: 'after', required: false },
  ],
  substack: [
    { slot: 'substack_essay', label: 'Post-Event Essay', description: 'Long-form reflection on the event — the thoughtful angle', platform: 'substack', timing: 'after', required: true },
  ],
  multi: [], // multi-platform profiles use the event-type defaults + category bonuses
};

// ─── CONTENT CATEGORY BONUS TASKS ───────────────────────────────────────────
// Extra tasks based on the host/attendee's content niche

const CATEGORY_TASKS = {
  fashion: [
    { slot: 'outfit_breakdown', label: 'Outfit Breakdown', description: 'Detail every piece — brand, price, where to get it', platform: 'instagram', timing: 'after', required: false },
    { slot: 'style_comparison', label: 'Style Comparison', description: 'Compare your look to other attendees — who wore it best?', platform: 'tiktok', timing: 'after', required: false },
  ],
  beauty: [
    { slot: 'makeup_closeup', label: 'Makeup Close-Up', description: 'Film the makeup look in detail — products used', platform: 'tiktok', timing: 'before', required: false },
    { slot: 'beauty_review', label: 'Event Glam Review', description: 'How did the look hold up? Honest review of products used', platform: 'instagram', timing: 'after', required: false },
  ],
  lifestyle: [
    { slot: 'day_in_life', label: 'Day in the Life', description: 'Frame the event as part of a full day — morning to night', platform: 'tiktok', timing: 'before', required: false },
    { slot: 'aesthetic_reel', label: 'Aesthetic Reel', description: 'Curated visuals — food, decor, vibes, no talking', platform: 'instagram', timing: 'during', required: false },
  ],
  fitness: [
    { slot: 'pre_event_routine', label: 'Pre-Event Routine', description: 'Show the workout or prep that got you event-ready', platform: 'tiktok', timing: 'before', required: false },
  ],
  food: [
    { slot: 'food_review', label: 'Food & Drink Review', description: 'Review everything served — the real content', platform: 'tiktok', timing: 'during', required: false },
  ],
  music: [
    { slot: 'music_moment', label: 'Music Moment', description: 'Capture the DJ set, live performance, or playlist vibe', platform: 'tiktok', timing: 'during', required: false },
  ],
  creator_economy: [
    { slot: 'collab_pitch', label: 'Collab Pitch', description: 'Use this event to set up a future collab — film the ask', platform: 'instagram', timing: 'during', required: false },
    { slot: 'metrics_flex', label: 'Engagement Flex', description: 'Share the numbers this event content generated', platform: 'twitter', timing: 'after', required: false },
  ],
  drama: [
    { slot: 'drama_recap', label: 'Drama Recap', description: 'Spill what really happened — the version people want', platform: 'tiktok', timing: 'after', required: false },
  ],
};

// ─── BUILD SOCIAL TASKS (event type + platform + category) ──────────────────

function buildSocialTasks(eventType, hostProfile = null, outfitPieces = [], context = {}) {
  const hostName = context.host_name || hostProfile?.display_name || hostProfile?.name || null;
  const hostHandle = context.host_handle || hostProfile?.handle || null;
  const hostBrand = context.host_brand || hostProfile?.host_brand || null;
  const venueName = context.venue_name || null;
  const eventName = context.event_name || null;
  const dressCode = context.dress_code || null;
  const guestNames = Array.isArray(context.guest_names)
    ? context.guest_names.filter(Boolean).slice(0, 3)
    : [];
  const hostRef = hostHandle ? `@${String(hostHandle).replace(/^@/, '')}` : hostName;

  // 1. Start with event-type base tasks
  const base = SOCIAL_TASK_TEMPLATES[eventType] || SOCIAL_TASK_TEMPLATES.default;
  const tasks = [
    ...base.before.map(t => ({ ...t, completed: false })),
    ...base.during.map(t => ({ ...t, completed: false })),
    ...base.after.map(t => ({ ...t, completed: false })),
  ];

  // 1b. Make tasks outfit-aware — reference actual pieces in descriptions
  if (outfitPieces.length > 0) {
    const mainPiece = outfitPieces.find(p => ['dress', 'top'].includes(p.category || p.clothing_category)) || outfitPieces[0];
    const brands = [...new Set(outfitPieces.map(p => p.brand).filter(Boolean))];
    const brandTag = brands.length > 0 ? brands.map(b => `@${b.toLowerCase().replace(/\s+/g, '')}`).join(' ') : '';

    for (const task of tasks) {
      if (task.slot === 'grwm' && mainPiece) {
        task.description = `Film getting ready — feature the ${mainPiece.name}${mainPiece.brand ? ` by ${mainPiece.brand}` : ''}`;
      } else if (task.slot === 'outfit_reveal' && mainPiece) {
        task.description = `Post outfit details: ${outfitPieces.map(p => p.name).join(', ')}${brandTag ? ` — tag ${brandTag}` : ''}`;
      } else if (task.slot === 'arrival') {
        task.description = `Film arrival in the ${mainPiece?.name || 'outfit'} — full look reveal at the venue`;
      } else if (task.slot === 'recap') {
        task.description = `Carousel: outfit flat lay + event moments + ${outfitPieces.length} pieces styled`;
      }
    }
  }

  // 1c. Make tasks host/invite aware so prompts make narrative sense.
  for (const task of tasks) {
    if (task.slot === 'arrival' && venueName) {
      task.description = `Capture arrival at ${venueName}${hostRef ? ` for ${hostRef}'s invite` : ''} — establish place + status immediately`;
    } else if (task.slot === 'host_photo' && hostRef) {
      task.description = `Create a post with ${hostRef}${hostBrand ? ` (${hostBrand})` : ''} — signal relationship, not just attendance`;
    } else if (task.slot === 'thank_host' && hostRef) {
      task.description = `Public thank-you to ${hostRef}${eventName ? ` for ${eventName}` : ''} — maintain social capital`;
    } else if (task.slot === 'bts_stories') {
      const guestLine = guestNames.length > 0 ? `, plus guests like ${guestNames.join(', ')}` : '';
      task.description = `Stories: show access signals (room, energy${guestLine}) without leaking everything`;
    } else if (task.slot === 'presence') {
      task.description = `${eventName ? `Post from ${eventName}` : 'Post from the invite'} so your attendance is visible to the right audience`;
    } else if (task.slot === 'network') {
      task.description = `Capture at least 2 networking moments${guestNames.length > 0 ? ` (aim for ${guestNames.slice(0, 2).join(' + ')})` : ''} to extend reach`;
    } else if (task.slot === 'teaser' && (hostBrand || hostRef)) {
      task.description = `Tease the ${hostBrand || hostRef} collaboration without disclosing deliverables`;
    }
  }

  if (dressCode) {
    for (const task of tasks) {
      if (task.slot === 'grwm' || task.slot === 'outfit_reveal') {
        task.description = `${task.description} (dress code: ${dressCode})`;
      }
    }
  }

  if (!hostProfile) return tasks;

  const usedSlots = new Set(tasks.map(t => t.slot));

  // 2. Add platform-specific tasks
  const platform = hostProfile.platform || 'multi';
  const platformTasks = PLATFORM_TASKS[platform] || [];
  for (const pt of platformTasks) {
    if (!usedSlots.has(pt.slot)) {
      tasks.push({ ...pt, completed: false, source: 'platform' });
      usedSlots.add(pt.slot);
    }
  }

  // 3. Add content-category bonus tasks
  const category = (hostProfile.content_category || '').toLowerCase().replace(/\s+/g, '_');
  const categoryTasks = CATEGORY_TASKS[category] || [];
  for (const ct of categoryTasks) {
    if (!usedSlots.has(ct.slot)) {
      tasks.push({ ...ct, completed: false, source: 'category' });
      usedSlots.add(ct.slot);
    }
  }

  // 4. Sort by timing phase: before → during → after
  const order = { before: 0, during: 1, after: 2 };
  tasks.sort((a, b) => (order[a.timing] || 1) - (order[b.timing] || 1));

  return tasks;
}

// ─── EPISODE BEAT TEMPLATES ──────────────────────────────────────────────────
// Maps event timeline to 14 episode beats

const BEAT_TEMPLATES = [
  { beat: 1, label: 'The Notification', phase: 'before', emotional_intent: 'anticipation', description: 'Lala sees the invitation/opportunity on her feed' },
  { beat: 2, label: 'The Decision', phase: 'before', emotional_intent: 'tension', description: 'Should she go? What does this mean for her?' },
  { beat: 3, label: 'The Closet', phase: 'before', emotional_intent: 'creative_energy', description: 'Outfit selection — what does she wear to THIS event?' },
  { beat: 4, label: 'Getting Ready', phase: 'before', emotional_intent: 'transformation', description: 'Hair, makeup, inner monologue. She becomes Lala-for-the-event.' },
  { beat: 5, label: 'The Post', phase: 'before', emotional_intent: 'vulnerability', description: 'She posts her GRWM/outfit — first public commitment' },
  { beat: 6, label: 'The Arrival', phase: 'during', emotional_intent: 'awe_or_intimidation', description: 'She arrives. First impression of the venue, the crowd, the energy.' },
  { beat: 7, label: 'The Room Read', phase: 'during', emotional_intent: 'strategy', description: 'She reads the room — who is here, who is watching, where to position' },
  { beat: 8, label: 'The Encounter', phase: 'during', emotional_intent: 'connection_or_conflict', description: 'She meets the host or key person — the relationship moment' },
  { beat: 9, label: 'The Main Event', phase: 'during', emotional_intent: 'peak_experience', description: 'The core of the event — the thing everyone came for' },
  { beat: 10, label: 'The Complication', phase: 'during', emotional_intent: 'surprise_or_tension', description: 'Something unexpected — drama, opportunity, or revelation' },
  { beat: 11, label: 'The Content Moment', phase: 'during', emotional_intent: 'performance', description: 'She creates the key content — go live, film the moment, post' },
  { beat: 12, label: 'The Exit', phase: 'during', emotional_intent: 'reflection', description: 'She leaves — what does she carry with her?' },
  { beat: 13, label: 'The Aftermath', phase: 'after', emotional_intent: 'processing', description: 'Back home. Phone blowing up. She processes what happened.' },
  { beat: 14, label: 'The Recap', phase: 'after', emotional_intent: 'narrative_control', description: 'She posts her version of the story — controls the narrative' },
];

// ─── ARCHETYPE MAPPING ───────────────────────────────────────────────────────

function inferArchetype(event) {
  const prestige = event.prestige || 5;
  const type = event.event_type || 'invite';

  if (type === 'brand_deal') return 'Showcase';
  if (type === 'fail_test') return 'Trial';
  if (prestige >= 8) return 'Trial';
  if (prestige >= 6) return 'Temptation';
  if (prestige <= 3) return 'Redemption';
  return 'Showcase';
}

function inferIntent(event) {
  const prestige = event.prestige || 5;
  if (prestige >= 8) return 'slay';
  if (prestige >= 5) return 'pass';
  if (prestige <= 3) return 'fail';
  return 'safe';
}

// ─── FINANCIAL CALCULATOR ────────────────────────────────────────────────────

function calculateFinancials(event, wardrobeItems = []) {
  const eventIncome = parseFloat(event.payment_amount) || 0;
  const eventExpense = parseFloat(event.cost_coins) || 0;
  const outfitCost = wardrobeItems.reduce((sum, item) => {
    if (item.acquisition_type === 'gifted' || item.acquisition_type === 'borrowed') return sum;
    return sum + (parseFloat(item.coin_cost) || parseFloat(item.price) || 0);
  }, 0);

  // Estimate content revenue from social tasks
  const contentRevenue = event.event_type === 'brand_deal'
    ? eventIncome * 0.1 // 10% bonus for content delivery
    : 0;

  return {
    event_income: eventIncome,
    event_expense: eventExpense,
    outfit_cost: outfitCost,
    content_revenue: contentRevenue,
    total_income: eventIncome + contentRevenue,
    total_expenses: eventExpense + outfitCost,
    net_profit: (eventIncome + contentRevenue) - (eventExpense + outfitCost),
  };
}

// ─── MAIN: GENERATE EPISODE FROM EVENT ───────────────────────────────────────

/**
 * Generate a complete episode blueprint from a world event.
 *
 * @param {object} event — WorldEvent instance or plain object
 * @param {object} models — Sequelize models
 * @param {object} options — { showId, wardrobeItems: [] }
 * @returns {object} { episode, brief, scenePlan, todoList, financials }
 */
async function generateEpisodeFromEvent(event, models, options = {}) {
  const { Episode, EpisodeBrief, ScenePlan } = models;
  const showId = options.showId || event.show_id;

  if (!showId) throw new Error('show_id is required');
  if (!Episode) throw new Error('Episode model not loaded');

  // Check if event is already used — prevent double generation
  const eventId = typeof event.id === 'string' ? event.id : String(event.id);
  try {
    const [usedCheck] = await models.sequelize.query(
      `SELECT id, title FROM episodes WHERE id IN (
        SELECT used_in_episode_id FROM world_events WHERE id = :eventId AND used_in_episode_id IS NOT NULL
      ) AND deleted_at IS NULL LIMIT 1`,
      { replacements: { eventId } }
    );
    if (usedCheck?.length > 0) {
      throw new Error(`Episode already exists for this event: "${usedCheck[0].title}". Delete it first to regenerate.`);
    }
  } catch (checkErr) {
    if (checkErr.message.includes('already exists')) throw checkErr;
    // Column may not exist, skip check
  }

  // Get next episode number from active episodes only. Soft-deleted
  // regenerate history should not inflate visible episode numbering.
  let nextNumber = 1;
  try {
    const [rows] = await models.sequelize.query(
      `SELECT COALESCE(MAX(episode_number), 0) + 1 as next_num
       FROM episodes
       WHERE show_id = :showId AND deleted_at IS NULL`,
      { replacements: { showId } }
    );
    nextNumber = parseInt(rows?.[0]?.next_num) || 1;
  } catch {
    const lastEpisode = await Episode.findOne({
      where: { show_id: showId },
      order: [['episode_number', 'DESC']],
      attributes: ['episode_number'],
    });
    nextNumber = (lastEpisode?.episode_number || 0) + 1;
  }

  // ── 1. Generate Social-Media-Ready Title + Description ──
  const eventData = typeof event.toJSON === 'function' ? event.toJSON() : event;
    // \u2500\u2500 0b. Affordability guard \u2500\u2500
    let affordabilityWarning = null;
    try {
      const [charState] = await models.sequelize.query(
        `SELECT coins FROM character_state WHERE show_id = :showId AND character_key = 'justawoman' LIMIT 1`,
        { replacements: { showId }, type: models.sequelize.QueryTypes.SELECT }
      ).catch(() => []);
      const currentCoins = parseInt(charState?.coins) || 0;
      const eventCost = parseFloat(event.cost_coins) || 0;
      if (eventCost > 0 && currentCoins < eventCost) {
        affordabilityWarning = {
          coins_needed: eventCost,
          coins_available: currentCoins,
          shortfall: eventCost - currentCoins,
        };
        console.warn(`[EpisodeGenerator] Affordability warning: event costs ${eventCost} coins but character has ${currentCoins}`);
      }
    } catch { /* non-blocking */ }

  const outfitPieces = typeof eventData.outfit_pieces === 'string' ? JSON.parse(eventData.outfit_pieces || '[]') : (eventData.outfit_pieces || []);
  const outfitScore = typeof eventData.outfit_score === 'string' ? JSON.parse(eventData.outfit_score || 'null') : (eventData.outfit_score || null);
  const autoData = (typeof eventData.canon_consequences === 'string'
    ? JSON.parse(eventData.canon_consequences) : (eventData.canon_consequences || {}))?.automation || {};

  let episodeTitle = eventData.name || `Episode ${nextNumber}`;
  let episodeDescription = eventData.description || `Based on: ${eventData.name}`;
  let episodeTags = [];
  let aiBeatOutline = [];

  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const prestige = eventData.prestige || 5;
      const brands = outfitPieces.length > 0 ? [...new Set(outfitPieces.map(p => p.brand).filter(Boolean))] : [];
      const totalOutfitCost = outfitPieces.reduce((s, p) => s + (parseFloat(p.price) || 0), 0);
      const outfitContext = outfitPieces.length > 0
        ? `Outfit (${outfitPieces.length} pieces, $${totalOutfitCost} total): ${outfitPieces.map(p => `${p.name}${p.brand ? ` by ${p.brand}` : ''} (${p.tier || 'basic'}, $${p.price || 0})`).join(', ')}${brands.length > 0 ? `\nBrands worn: ${brands.join(', ')}` : ''}`
        : 'No outfit picked yet';
      const moodContext = outfitScore?.narrative_mood || 'neutral';
      // Dress code line — fold in keywords too when the event has them.
      // Both the free-text dress_code and the parsed keywords give Claude
      // more signal for tone (e.g. "chic" + ["sleek","monochrome","gold"]).
      const dressKeywords = Array.isArray(eventData.dress_code_keywords) && eventData.dress_code_keywords.length
        ? ` (keywords: ${eventData.dress_code_keywords.slice(0, 8).join(', ')})`
        : '';
      const dressCode = eventData.dress_code ? `Dress code: ${eventData.dress_code}${dressKeywords}` : '';
      // Brand context — when the event is a brand deal / hosted by a
      // brand, surfaces it for AI-generated titles ("...for Maison Belle").
      const brandLine = eventData.host_brand ? `Host brand: ${eventData.host_brand}` : '';
      const financialContext = [
        autoData.payment_amount ? `Paid event: $${autoData.payment_amount}` : `Costs ${eventData.cost_coins || 0} coins`,
        dressCode,
        brandLine,
      ].filter(Boolean).join('\n');

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        // Bumped from 400 to 1500 — the beat outline adds ~6-8 short
        // beats which would otherwise truncate. Title+desc+tags together
        // are still well under half this budget.
        max_tokens: 1500,
        messages: [{ role: 'user', content: `Generate a social-media-ready episode for "Styling Adventures with Lala" — title, description, tags, AND a draft beat outline so the creator has structure to work from before any script exists.

EVENT: ${eventData.name}
Type: ${eventData.event_type} | Prestige: ${prestige}/10
Host: ${eventData.host || 'Unknown'}
${outfitContext}
Outfit mood: ${moodContext}
${financialContext}
Stakes: ${eventData.narrative_stakes || 'None specified'}

Return JSON:
{
  "title": "Clickable title (YouTube/TikTok style — curiosity gap, emotional hook, 60 chars max). Examples: 'I Wore a $200 Dress to a $10,000 Event', 'She Invited Me and THIS Happened', 'GRWM for the Most Important Night'",
  "description": "2-3 sentence YouTube description with keywords. Mention the event, outfit, stakes. Make it searchable.",
  "tags": ["5-8 hashtags without #, lowercase, searchable terms like 'fashion', 'grwm', 'luxury event', 'outfit challenge'"],
  "beats": [
    { "beat_number": 1, "summary": "GRWM — Lala picks the outfit", "dramatic_function": "setup" },
    { "beat_number": 2, "summary": "...", "dramatic_function": "rising_action" }
  ]
}

Beat outline rules:
- 5 to 8 beats total (one per major story moment)
- summary is one short sentence describing what happens
- dramatic_function: setup | rising_action | turn | climax | resolution | tag
- Beats should arc from arrival/setup → tension/turn → climax → outcome.

Return ONLY JSON.` }],
      });

      const text = response.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        episodeTitle = parsed.title || episodeTitle;
        episodeDescription = parsed.description || episodeDescription;
        episodeTags = parsed.tags || [];
        // Beat outline: normalize each entry so the brief's JSONB always
        // holds the same shape regardless of small Claude formatting
        // variations.
        if (Array.isArray(parsed.beats)) {
          aiBeatOutline = parsed.beats.map((b, i) => ({
            beat_number: Number.isFinite(b.beat_number) ? b.beat_number : i + 1,
            summary: String(b.summary || '').trim(),
            dramatic_function: b.dramatic_function || null,
          })).filter(b => b.summary);
        }
      }
    }
  } catch (titleErr) {
    console.warn('[EpisodeGenerator] AI title generation failed (using event name):', titleErr.message);
  }

  // ── 1b. Create Episode ──
  const episode = await Episode.create({
    show_id: showId,
    title: episodeTitle,
    description: episodeDescription,
    episode_number: nextNumber,
    status: 'draft',
    categories: episodeTags,
    total_income: 0,
    total_expenses: 0,
  });

  // ── 2. Create Episode Brief ──
  let brief = null;
  if (EpisodeBrief) {
    // Snapshot every load-bearing field from the event onto the brief at
    // generate time. Closes the long list of silent data drops surfaced by
    // the field-level audit. Snapshot semantics (not read-through) for
    // story-progression metadata so re-edits to the event don't retroactively
    // change what an already-generated episode "remembers."
    brief = await EpisodeBrief.create({
      episode_id: episode.id,
      show_id: showId,
      event_id: event.id,
      // Capture the OutfitSet that drove this episode (when the event
      // had one picked). Pieces still get exploded into EpisodeWardrobe
      // rows; this preserves the "which set" audit trail those rows
      // alone would lose.
      outfit_set_id: event.outfit_set_id || null,
      // Direct invite asset reference so the episode doesn't have to
      // join through assets.metadata to find its invite.
      invitation_asset_id: event.invitation_asset_id || null,
      // Story scaffolding — season + arc the event belongs to.
      season_id: event.season_id || null,
      arc_id: event.arc_id || null,
      // Cross-episode narrative chain. Everything related to "this event
      // came from / leads to" lives here so the brief alone tells you
      // where in the chain this episode sits.
      narrative_chain: {
        parent_event_id: event.parent_event_id || null,
        chain_position: event.chain_position ?? null,
        chain_reason: event.chain_reason || null,
        seeds_future_events: event.seeds_future_events || [],
      },
      // Full canon_consequences (previously only the automation key was
      // read; the rest was dropped).
      canon_consequences: event.canon_consequences || {},
      // Career-progression context the player runtime gates on.
      career_context: {
        career_tier: event.career_tier ?? null,
        career_milestone: event.career_milestone || null,
        fail_consequence: event.fail_consequence || null,
        success_unlock: event.success_unlock || null,
      },
      // Difficulty knobs — strictness + deadline_*. event_difficulty is
      // an existing column, finally getting populated.
      event_difficulty: {
        strictness: event.strictness ?? null,
        deadline_type: event.deadline_type || null,
        deadline_minutes: event.deadline_minutes ?? null,
      },
      // Catch-all for the rest of the event metadata that influences
      // gameplay/visuals but isn't story-critical.
      event_metadata: {
        rewards: event.rewards || null,
        requirements: event.requirements || null,
        affordability_warning: affordabilityWarning,
        browse_pool_bias: event.browse_pool_bias || null,
        browse_pool_size: event.browse_pool_size ?? null,
        overlay_template: event.overlay_template || null,
        required_ui_overlays: event.required_ui_overlays || [],
        host_brand: event.host_brand || null,
        dress_code_keywords: event.dress_code_keywords || [],
        location_hint: event.location_hint || null,
      },
      // AI-drafted beat outline from the same Claude call that generated
      // the title — gives creators something to anchor edits against and
      // feeds Suggest-Scenes before any script exists.
      beat_outline: aiBeatOutline,
      episode_archetype: inferArchetype(event),
      designed_intent: inferIntent(event),
      narrative_purpose: `${event.name} — ${event.description || 'Event-driven episode'}`,
      status: 'draft',
    });
  }

  // ── 3. Create Scene Plan (14 beats) ──
  const scenePlanRows = [];
  // Use a container object instead of bare identifiers so downstream
  // access is resilient even if a scope mutation slips in later edits.
  const sceneSetIds = { home: null, venue: null };
  if (ScenePlan) {
    // Try to find scene sets for home and venue

    try {
      const [homeSets] = await models.sequelize.query(
        `SELECT id FROM scene_sets WHERE scene_type = 'HOME_BASE' AND deleted_at IS NULL LIMIT 1`
      );
      sceneSetIds.home = homeSets?.[0]?.id || null;

      if (event.scene_set_id) {
        sceneSetIds.venue = event.scene_set_id;
      }
    } catch { /* scene_sets query failed — no scene sets linked */ }

    for (const beat of BEAT_TEMPLATES) {
      const sceneSetId = beat.phase === 'before' || beat.phase === 'after'
        ? sceneSetIds.home
        : sceneSetIds.venue;

      try {
        const beatId = require('uuid').v4();
        await models.sequelize.query(
          `INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, emotional_intent, scene_set_id, scene_context, sort_order, locked, ai_suggested, created_at, updated_at)
           VALUES (:id, :episode_id, :beat_number, :beat_name, :emotional_intent, :scene_set_id, :scene_context, :sort_order, false, true, NOW(), NOW())`,
          { replacements: {
            id: beatId, episode_id: episode.id, beat_number: beat.beat, beat_name: beat.label,
            emotional_intent: beat.emotional_intent, scene_set_id: sceneSetId || null,
            scene_context: beat.description, sort_order: beat.beat,
          } }
        );
        scenePlanRows.push({ id: beatId, episode_id: episode.id, beat_number: beat.beat, beat_name: beat.label, emotional_intent: beat.emotional_intent, scene_set_id: sceneSetId });
      } catch (beatErr) {
        console.warn(`[EpisodeGenerator] Beat ${beat.beat} creation failed:`, beatErr.message);
      }
    }
  }

  // ── Link the chosen scene set(s) to the episode via SceneSetEpisode ──
  // Critical fix: scene_set_id was reaching scene_plans rows but never
  // creating the episode↔scene_set junction record that the episode page's
  // /scene-sets endpoint queries. Without this, creators saw "no scene
  // sets" on the episode even though they explicitly picked one on the
  // event. findOrCreate is idempotent so a re-run (regenerate flow)
  // doesn't pile up duplicates.
  if (models.SceneSetEpisode) {
    const orderedSetIds = [sceneSetIds.venue, sceneSetIds.home].filter(Boolean);
    const uniqueOrderedSetIds = orderedSetIds.filter((setId, idx) => orderedSetIds.indexOf(setId) === idx);
    for (let i = 0; i < uniqueOrderedSetIds.length; i += 1) {
      const setId = uniqueOrderedSetIds[i];
      try {
        const [link, created] = await models.SceneSetEpisode.findOrCreate({
          where: { episode_id: episode.id, scene_set_id: setId },
          defaults: { sort_order: i },
        });
        if (!created && link.sort_order !== i) {
          await link.update({ sort_order: i });
        }
      } catch (linkErr) {
        // Junction insert failure shouldn't fail the whole episode
        // generation. Log and move on; creator can manually link later.
        console.warn(`[EpisodeGenerator] SceneSetEpisode link failed for set ${setId}:`, linkErr.message);
      }
    }
  }

  // ── Parse automation data from event (used by feed moments + social tasks) ──
  const automation = (typeof event.canon_consequences === 'string'
    ? JSON.parse(event.canon_consequences)
    : event.canon_consequences)?.automation || {};

  // ── 3b. Generate Feed Moments for each beat ──
  let feedMoments = {};
  try {
    const { generateFeedMoments } = require('./feedMomentsService');
    const guestProfiles = automation.guest_profiles || [];
    feedMoments = await generateFeedMoments(event, BEAT_TEMPLATES, guestProfiles, models, { showType: 'styling_adventures' });

    // Attach feed moments to scene plan rows
    for (const row of scenePlanRows) {
      const beatNum = row.beat_number || row.dataValues?.beat_number;
      if (feedMoments[beatNum]) {
        try {
          const moment = feedMoments[beatNum];
          const updates = { feed_moment: moment };
          if (moment.script_lines) updates.script_lines = moment.script_lines;
          await row.update(updates);
        } catch { /* feed_moment column may not exist yet */ }
      }
    }
  } catch (fmErr) {
    console.warn('[EpisodeGenerator] Feed moments generation failed (non-blocking):', fmErr.message);
  }

  // ── 4. Create Todo List (wardrobe + social tasks) ──
  const eventType = event.event_type || 'invite';

  // Use event's saved social tasks if available, otherwise generate fresh
  let socialTasks = automation.social_tasks;
  if (!Array.isArray(socialTasks) || socialTasks.length === 0) {
    let hostProfile = null;
    try {
      const hostProfileId = automation.host_profile_id;
      if (hostProfileId) {
        const [rows] = await models.sequelize.query(
          'SELECT platform, content_category, archetype, follower_tier, handle, display_name FROM social_profiles WHERE id = :id LIMIT 1',
          { replacements: { id: hostProfileId } }
        );
        hostProfile = rows?.[0] || null;
      }
    } catch { /* non-blocking */ }
    socialTasks = buildSocialTasks(eventType, hostProfile, outfitPieces, {
      event_name: event.name,
      host_name: event.host || automation.host_display_name,
      host_handle: automation.host_handle,
      host_brand: event.host_brand || automation.host_brand,
      venue_name: event.venue_name || automation.venue_name,
      dress_code: event.dress_code,
      guest_names: Array.isArray(automation.guest_profiles)
        ? automation.guest_profiles.map(g => g.display_name || g.handle).filter(Boolean)
        : [],
    });
  }

  // Wardrobe tasks (the standard 7 slots)
  const wardrobeTasks = [
    { slot: 'dress', label: `Outfit for ${event.name}`, description: event.dress_code ? `Dress code: ${event.dress_code}` : 'Choose an outfit that matches the event', required: true, completed: false },
    { slot: 'shoes', label: 'Shoes', description: 'Matching footwear', required: true, completed: false },
    { slot: 'accessories', label: 'Accessories', description: 'Bag, belt, or statement piece', required: false, completed: false },
    { slot: 'jewelry', label: 'Jewelry', description: 'Earrings, necklace, rings', required: false, completed: false },
    { slot: 'perfume', label: 'Fragrance', description: 'Signature scent for the event', required: false, completed: false },
  ];

  // Financial summary
  const financials = calculateFinancials(event, options.wardrobeItems || []);

  let todoList = null;
  try {
    const [created] = await models.sequelize.query(
      `INSERT INTO episode_todo_lists (id, episode_id, show_id, event_id, tasks, social_tasks, financial_summary, status, created_at, updated_at)
       VALUES (:id, :episode_id, :show_id, :event_id, :tasks, :social_tasks, :financial_summary, 'generated', NOW(), NOW())
       ON CONFLICT (episode_id) DO UPDATE SET
         tasks = EXCLUDED.tasks, social_tasks = EXCLUDED.social_tasks, financial_summary = EXCLUDED.financial_summary, event_id = EXCLUDED.event_id, updated_at = NOW()
       RETURNING *`,
      {
        replacements: {
          id: uuidv4(),
          episode_id: episode.id,
          show_id: showId,
          event_id: event.id,
          tasks: JSON.stringify(wardrobeTasks),
          social_tasks: JSON.stringify(socialTasks),
          financial_summary: JSON.stringify(financials),
        },
      }
    );
    todoList = created?.[0] || null;
  } catch (err) {
    console.warn('[EpisodeGenerator] Todo list creation failed:', err.message);
  }

  // Update episode financials
  try {
    await episode.update({
      total_income: financials.total_income,
      total_expenses: financials.total_expenses,
      financial_score: financials.net_profit >= 0 ? 7 : 4,
    });
  } catch (finErr) {
    console.warn('[EpisodeGenerator] Financial update failed:', finErr.message);
  }

  // Link outfit pieces from event to episode (if outfit was picked before generating)
  try {
    const outfitPieces = typeof event.outfit_pieces === 'string' ? JSON.parse(event.outfit_pieces) : (event.outfit_pieces || []);
    if (outfitPieces.length > 0 && models.EpisodeWardrobe) {
      for (const piece of outfitPieces) {
        await models.EpisodeWardrobe.findOrCreate({
          where: { episode_id: episode.id, wardrobe_id: piece.id },
          defaults: { episode_id: episode.id, wardrobe_id: piece.id, approval_status: 'approved', worn_at: new Date() },
        });
      }
      console.log(`[EpisodeGenerator] ${outfitPieces.length} outfit pieces linked from event`);
    }
  } catch (outfitErr) {
    console.warn('[EpisodeGenerator] Outfit linking failed (non-blocking):', outfitErr.message);
  }

  // Auto-link all event assets (invitation, checklist, notification) to this episode
  try {
    const { Asset } = models;
    if (Asset) {
      const eventId = typeof event.id === 'string' ? event.id : String(event.id);
      // Find all assets referencing this event via metadata.event_id
      const eventAssets = await Asset.findAll({
        where: {
          [models.Sequelize.Op.or]: [
            { '$metadata.event_id$': eventId },
            models.sequelize.literal(`metadata->>'event_id' = '${eventId.replace(/'/g, "''")}'`),
          ],
        },
      }).catch(() => []);

      // Fallback: raw SQL if JSONB query fails
      let assets = eventAssets;
      if (!assets || assets.length === 0) {
        try {
          const [rows] = await models.sequelize.query(
            `SELECT id FROM assets WHERE metadata->>'event_id' = :eventId AND deleted_at IS NULL`,
            { replacements: { eventId } }
          );
          assets = rows || [];
        } catch { /* skip */ }
      }

      let linked = 0;
      for (const a of assets) {
        const assetId = a.id;
        try {
          await models.sequelize.query(
            `UPDATE assets SET episode_id = :episodeId WHERE id = :assetId`,
            { replacements: { episodeId: episode.id, assetId } }
          );
          linked++;
        } catch { /* skip individual failures */ }
      }
      if (linked > 0) console.log(`[EpisodeGenerator] ${linked} event assets linked to episode`);
    }
  } catch (assetErr) {
    console.warn('[EpisodeGenerator] Asset linking failed (non-blocking):', assetErr.message);
  }

  // Mark event as used
  try {
    if (models.WorldEvent) {
      await models.WorldEvent.update(
        { status: 'used', used_in_episode_id: episode.id },
        { where: { id: event.id } }
      );
    } else {
      await models.sequelize.query(
        `UPDATE world_events SET status = 'used', used_in_episode_id = :episodeId, times_used = COALESCE(times_used, 0) + 1, updated_at = NOW() WHERE id = :eventId`,
        { replacements: { episodeId: episode.id, eventId: event.id } }
      );
    }
  } catch { /* non-blocking */ }

  // Sync character profiles (host + guests)
  try {
    const characterSync = require('./characterSyncService');
    const syncResult = await characterSync.syncAfterEvent(event, episode, models);
    console.log(`[EpisodeGenerator] Character sync: ${syncResult.updated} profiles updated`);
    // Auto-generate opportunities from event performance
    try {
      const newOpps = await characterSync.generatePostEventOpportunities(event, episode, models);
      if (newOpps.length > 0) console.log(`[EpisodeGenerator] ${newOpps.length} opportunities generated from event`);
    } catch (oppErr) {
      console.warn('[EpisodeGenerator] Opportunity generation failed (non-blocking):', oppErr.message);
    }
  } catch (syncErr) {
    console.warn('[EpisodeGenerator] Character sync failed (non-blocking):', syncErr.message);
  }

  // Generate post-event feed activity
  let feedPosts = [];
  try {
    const feedActivity = require('./feedActivityService');
    feedPosts = await feedActivity.generatePostEventActivity(event, models);
    console.log(`[EpisodeGenerator] Feed activity: ${feedPosts.length} posts generated`);
  } catch (feedErr) {
    console.warn('[EpisodeGenerator] Feed activity failed (non-blocking):', feedErr.message);
  }

  return {
    episode: episode.toJSON(),
    brief: brief?.toJSON() || null,
    scenePlan: scenePlanRows.map(r => r.toJSON ? r.toJSON() : r),
    todoList,
    financials,
    socialTasks,
    beats: BEAT_TEMPLATES,
    feedPosts,
    feedMoments,
  };
}

module.exports = {
  generateEpisodeFromEvent,
  buildSocialTasks,
  calculateFinancials,
  inferArchetype,
  inferIntent,
  SOCIAL_TASK_TEMPLATES,
  PLATFORM_TASKS,
  CATEGORY_TASKS,
  BEAT_TEMPLATES,
};

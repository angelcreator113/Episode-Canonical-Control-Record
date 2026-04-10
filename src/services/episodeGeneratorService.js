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

function buildSocialTasks(eventType, hostProfile = null) {
  // 1. Start with event-type base tasks
  const base = SOCIAL_TASK_TEMPLATES[eventType] || SOCIAL_TASK_TEMPLATES.default;
  const tasks = [
    ...base.before.map(t => ({ ...t, completed: false })),
    ...base.during.map(t => ({ ...t, completed: false })),
    ...base.after.map(t => ({ ...t, completed: false })),
  ];

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

  // Get next episode number
  const lastEpisode = await Episode.findOne({
    where: { show_id: showId },
    order: [['episode_number', 'DESC']],
    attributes: ['episode_number'],
  });
  const nextNumber = (lastEpisode?.episode_number || 0) + 1;

  // ── 1. Create Episode ──
  const episode = await Episode.create({
    show_id: showId,
    title: event.name || `Episode ${nextNumber}`,
    description: event.description || `Based on: ${event.name}`,
    episode_number: nextNumber,
    status: 'draft',
    total_income: 0,
    total_expenses: 0,
  });

  // ── 2. Create Episode Brief ──
  let brief = null;
  if (EpisodeBrief) {
    brief = await EpisodeBrief.create({
      episode_id: episode.id,
      show_id: showId,
      event_id: event.id,
      episode_archetype: inferArchetype(event),
      designed_intent: inferIntent(event),
      narrative_purpose: `${event.name} — ${event.description || 'Event-driven episode'}`,
      status: 'draft',
    });
  }

  // ── 3. Create Scene Plan (14 beats) ──
  const scenePlanRows = [];
  if (ScenePlan) {
    // Try to find scene sets for home and venue
    let homeSceneSetId = null;
    let venueSceneSetId = null;

    if (models.SceneSet) {
      const homeSet = await models.SceneSet.findOne({
        where: { scene_type: 'HOME_BASE' },
        attributes: ['id'],
      });
      homeSceneSetId = homeSet?.id || null;

      if (event.scene_set_id) {
        venueSceneSetId = event.scene_set_id;
      }
    }

    for (const beat of BEAT_TEMPLATES) {
      const sceneSetId = beat.phase === 'before' || beat.phase === 'after'
        ? homeSceneSetId
        : venueSceneSetId;

      const row = await ScenePlan.create({
        episode_id: episode.id,
        beat_number: beat.beat,
        beat_name: beat.label,
        emotional_intent: beat.emotional_intent,
        scene_set_id: sceneSetId,
        scene_context: beat.description,
        sort_order: beat.beat,
        locked: false,
        ai_suggested: true,
      });
      scenePlanRows.push(row);
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
          'SELECT platform, content_category, archetype, follower_tier FROM social_profiles WHERE id = :id LIMIT 1',
          { replacements: { id: hostProfileId } }
        );
        hostProfile = rows?.[0] || null;
      }
    } catch { /* non-blocking */ }
    socialTasks = buildSocialTasks(eventType, hostProfile);
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

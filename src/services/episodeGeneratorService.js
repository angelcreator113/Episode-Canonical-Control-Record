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
        beat_label: beat.label,
        emotional_intent: beat.emotional_intent,
        scene_set_id: sceneSetId,
        description: beat.description,
        locked: false,
        ai_suggested: true,
      });
      scenePlanRows.push(row);
    }
  }

  // ── 4. Create Todo List (wardrobe + social tasks) ──
  const eventType = event.event_type || 'invite';
  const taskTemplates = SOCIAL_TASK_TEMPLATES[eventType] || SOCIAL_TASK_TEMPLATES.default;
  const socialTasks = [
    ...taskTemplates.before.map(t => ({ ...t, completed: false })),
    ...taskTemplates.during.map(t => ({ ...t, completed: false })),
    ...taskTemplates.after.map(t => ({ ...t, completed: false })),
  ];

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
       ON CONFLICT (episode_id) WHERE deleted_at IS NULL DO UPDATE SET
         tasks = :tasks, social_tasks = :social_tasks, financial_summary = :financial_summary, event_id = :event_id, updated_at = NOW()
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
  await episode.update({
    total_income: financials.total_income,
    total_expenses: financials.total_expenses,
    financial_score: financials.net_profit >= 0 ? 7 : 4,
  });

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
  } catch (syncErr) {
    console.warn('[EpisodeGenerator] Character sync failed (non-blocking):', syncErr.message);
  }

  return {
    episode: episode.toJSON(),
    brief: brief?.toJSON() || null,
    scenePlan: scenePlanRows.map(r => r.toJSON ? r.toJSON() : r),
    todoList,
    financials,
    socialTasks,
    beats: BEAT_TEMPLATES,
  };
}

module.exports = {
  generateEpisodeFromEvent,
  calculateFinancials,
  inferArchetype,
  inferIntent,
  SOCIAL_TASK_TEMPLATES,
  BEAT_TEMPLATES,
};

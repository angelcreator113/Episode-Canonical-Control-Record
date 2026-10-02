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
const { CANONICAL_BEATS } = require('../constants/canonicalBeats');
const { findLiveLinkedEpisode, eventEpisodeConflictError } = require('../utils/eventEpisodeLink');
const { findMissingPrices, dealPriceRequiredError } = require('./dealPricingService');
const { eventCreatorOrganizer } = require('../utils/eventOrganizer');
const { listEventDeliverables, stampDeliverablesEpisode, buildTermsSnapshot } = require('./eventTermsService');
const { saveBeatFeedMoment, recordFeedMomentSave } = require('./feedMomentSaveService');
const { withDeliverableTasks, withMissingRequiredDeliverables } = require('../utils/socialTaskSource');
const { readEpisodeSocialTasks } = require('./episodeTaskCopyService');
const { goalTaskScale, goalFields, composeGoalTasks, capCombinedGoals } = require('../utils/goalTasks');
const { relationshipGoalTasks } = require('./dealTermsDraftService');
const { normalizeTeaser, TEASER_INSTRUCTION, SYNOPSIS_INSTRUCTION } = require('../utils/episodeTeaser');

// ─── LALA'S GOAL TASKS (T9) ──────────────────────────────────────────────────
// T9 (docs/EVENT_EPISODE_FLOW.md §8(cc); Task #2395), Evoni's ruling: "Lala's
// goal tasks scale with the event: 2–3 for small or low-key events, 4–6 for
// major ones; no fixed template lists."
//
// Until T9 this list came from fixed templates: SOCIAL_TASK_TEMPLATES (per
// event type, 4–9 tasks), PLATFORM_TASKS (per host platform, up to 3 more)
// and CATEGORY_TASKS (per host niche, up to 2 more), copied whatever the
// event. They are removed. The goals are now written from the event's own
// fields (src/utils/goalTasks.js), their count bounded by the event's
// prestige: 2–3 small, 3–4 between, 4–6 major.
//
// T9 follow-ups (Evoni, 2026-09-30): the limit is for Lala's combined goal
// list, and "Start Episode writes the lower goal count (2 for small or
// low-key events, 4 for major ones), leaving room for the Career Checklist
// up to the maximum." So this list is the event's minimum; the Career
// Checklist (generateCareerList) fills the rest.
//
// No goal is required (T1, §8(bb); Task #2292): each is task_source 'goal'.
// Only an accepted deliverable (an event_deliverables row, passed as
// context.deliverables) makes a task required; see
// src/utils/socialTaskSource.js. Deliverable tasks are outside the bounds.
//
// context: event_name, host_name, host_handle, host_brand, venue_name,
// dress_code, guest_names (as before), plus `event` (the world_events row,
// for prestige, description, format, theme, stakes) or `prestige` alone
// where no row exists yet.

function buildSocialTasks(eventType, hostProfile = null, outfitPieces = [], context = {}) {
  const event = context.event || {};
  const bounds = goalTaskScale(context.prestige !== undefined ? { prestige: context.prestige } : event);
  const fields = goalFields(event, context, hostProfile, outfitPieces);
  // D13 answer 6 (2026-09-30): the event's relationship goals (at most 2)
  // are Lala's goals and count toward T9's limit, so the composed goals
  // fill only the room they leave (Start Episode writes the minimum).
  const relationship = relationshipGoalTasks(event);
  const room = {
    ...bounds,
    min: Math.max(0, bounds.min - relationship.length),
    max: Math.max(0, bounds.max - relationship.length),
  };
  const composed = room.max > 0
    ? composeGoalTasks(fields, room, { upTo: room.min, where: 'SocialTasks', excludeSlots: relationship.map((g) => g.slot) })
    : [];
  return withDeliverableTasks([...composed, ...relationship], context.deliverables);
}

// ─── EPISODE BEAT TEMPLATES ──────────────────────────────────────────────────
// Canonical SAL 14-beat structure — single source of truth in
// src/constants/canonicalBeats.js (Task #1609-#1612, docs/EVENT_EPISODE_FLOW.md
// §8). Field names (beat, label, phase, emotional_intent, description) kept
// for compatibility with the scene_plans insert, generateFeedMoments, and the
// brief response below, all of which read this shape. Replaces the old
// narrative beat list (The Notification, The Decision, The Closet, ...) —
// see docs/EVENT_EPISODE_FLOW.md §8(a)/(d) for why the two disagreed and how
// phase/emotional_intent were re-mapped by content, not position.
const BEAT_TEMPLATES = CANONICAL_BEATS.map(b => ({
  beat: b.number,
  label: b.name,
  phase: b.phase,
  emotional_intent: b.emotional_intent,
  description: b.description,
}));

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

/**
 * The affordability warning Start Episode stores on the brief
 * (event_metadata.affordability_warning); Save and relock after a reopen
 * (Task #2378) rebuilds it with this same function.
 *
 * Episode Money Phase B, MB4 (Evoni, 2026-10-01; §8(gg), Q6): it reads
 * Lala's ledger balance and the event's whole plan (episodeMoneyService.
 * eventMoneyPreview: itemised terms costs, the entry cost, spending), not
 * cost_coins against the cached coins. Null when nothing warns, else
 *   { coins_needed, coins_available, shortfall, warnings }
 * with coins_needed the open costs and shortfall the largest warning's. It
 * never blocks; a failed read logs and stores no warning.
 */
async function computeAffordabilityWarning(sequelize, showId, event, { transaction, episodeId = null } = {}) {
  let preview;
  try {
    const { eventMoneyPreview } = require('./episodeMoneyService');
    preview = await eventMoneyPreview(sequelize, { showId, event, episodeId, transaction });
  } catch (affordErr) {
    console.error('[EpisodeGenerator] The money preview for the affordability check failed:', affordErr.message);
    return null;
  }
  if (!preview.warnings.length) return null;
  const costs = preview.lines
    .filter((l) => l.kind === 'expense' && !l.covered && !l.conditional)
    .reduce((s, l) => s + l.amount, 0);
  const warning = {
    coins_needed: costs,
    coins_available: preview.balance,
    shortfall: Math.max(...preview.warnings.map((w) => w.shortfall)),
    warnings: preview.warnings,
  };
  console.warn(`[EpisodeGenerator] Affordability warning: ${preview.warnings.map((w) => w.message).join(' ')}`);
  return warning;
}

/**
 * The wardrobe rows calculateFinancials prices the outfit from, as the
 * generate routes load them. A failed read logs and returns [].
 */
async function loadFinancialWardrobeItems(sequelize, showId, { transaction } = {}) {
  try {
    const [rows] = await sequelize.query(
      `SELECT id, name, coin_cost, price, acquisition_type FROM wardrobe WHERE show_id = :showId AND deleted_at IS NULL`,
      { replacements: { showId }, transaction }
    );
    return rows || [];
  } catch (wardrobeErr) {
    console.error('[EpisodeGenerator] Wardrobe read for financials failed (outfit cost 0):', wardrobeErr.message);
    return [];
  }
}

function calculateFinancials(event, wardrobeItems = []) {
  const eventIncome = parseFloat(event.payment_amount) || 0;
  const eventExpense = parseFloat(event.cost_coins) || 0;
  const outfitCost = wardrobeItems.reduce((sum, item) => {
    if (item.acquisition_type === 'gifted' || item.acquisition_type === 'borrowed') return sum;
    return sum + (parseFloat(item.coin_cost) || parseFloat(item.price) || 0);
  }, 0);

  // Estimate content revenue from social tasks
  const contentRevenue = event.event_type === 'brand_deal'
    ? eventIncome * 0.1 // 10% brand-deal content fee (paid on any paid brand_deal; no delivery is checked — Task #1808)
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

/**
 * Create the 14 scene_plans rows for an episode, one per BEAT_TEMPLATES
 * entry, and resolve the home/venue scene_set_id pair those rows (and the
 * SceneSetEpisode junction step right after this call) use.
 *
 * Guards against duplicate scene_plans rows: this is a plain INSERT loop
 * with no upsert semantics, unlike scenePlannerService.generateScenePlan
 * (which destroys-then-recreates its own rows). Destroying here would risk
 * erasing scene set assignments already made on existing rows, so on a
 * repeat call for an episode that already has scene_plans rows, the insert
 * is skipped entirely — existing rows are left untouched, and none are
 * added — rather than duplicated or clobbered. See docs/SCRIPT_PIPELINE.md
 * §2. The home/venue scene set lookup always runs, insert or not, because
 * the SceneSetEpisode linking step after this call is itself idempotent
 * and expected to run on every call, including regenerate.
 *
 * Cleanup of scene_plans rows a prior, unguarded run may already have
 * duplicated, or that episode regeneration already orphaned, is a data
 * question this guard does not answer — see docs/SCRIPT_PIPELINE.md §2.
 *
 * @param {object} episode — the just-created Episode instance
 * @param {object} event — WorldEvent instance or plain object
 * @param {object} models — Sequelize models
 * @returns {Promise<{ scenePlanRows: object[], sceneSetIds: { home: string|null, venue: string|null } }>}
 */
async function createScenePlanRows(episode, event, models) {
  const { ScenePlan } = models;
  const scenePlanRows = [];
  const sceneSetIds = { home: null, venue: null };
  if (!ScenePlan) {
    return { scenePlanRows, sceneSetIds };
  }

  try {
    // B1 (Evoni, 2026-10-02): this show's HOME_BASE sets only, oldest first,
    // until L3's saved home default replaces it. It took any show's, in no
    // order.
    const [homeSets] = await models.sequelize.query(
      `SELECT id FROM scene_sets
        WHERE scene_type = 'HOME_BASE' AND show_id = :showId AND deleted_at IS NULL
        ORDER BY created_at ASC, id ASC LIMIT 1`,
      { replacements: { showId: event.show_id || episode.show_id } }
    );
    sceneSetIds.home = homeSets?.[0]?.id || null;

    if (event.scene_set_id) {
      sceneSetIds.venue = event.scene_set_id;
    }
  } catch { /* scene_sets query failed — no scene sets linked */ }

  let existingCount = 0;
  try {
    const [existingRows] = await models.sequelize.query(
      `SELECT COUNT(*)::int AS count FROM scene_plans WHERE episode_id = :episode_id`,
      { replacements: { episode_id: episode.id } }
    );
    existingCount = existingRows?.[0]?.count || 0;
  } catch (existingErr) {
    console.warn('[EpisodeGenerator] Scene plan existence check failed, proceeding with insert:', existingErr.message);
  }

  if (existingCount > 0) {
    console.log(`[EpisodeGenerator] Skipped scene plan insert for episode ${episode.id}: ${existingCount} row(s) already exist.`);
    return { scenePlanRows, sceneSetIds };
  }

  for (const beat of BEAT_TEMPLATES) {
    const sceneSetId = beat.phase === 'before' || beat.phase === 'after'
      ? sceneSetIds.home
      : sceneSetIds.venue;

    try {
      const beatId = uuidv4();
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

  return { scenePlanRows, sceneSetIds };
}

// ─── MAIN: GENERATE EPISODE FROM EVENT ───────────────────────────────────────

/**
 * Stamp the source event with the episode it started (Task #1906):
 * used_in_episode_id, status 'used' and times_used + 1, inside the
 * caller's transaction. Throws when the UPDATE fails or matches no row, so
 * Start Episode never commits an episode whose event does not point back
 * at it.
 */
async function stampEventUsed(sequelize, eventId, episodeId, { transaction } = {}) {
  const [rows] = await sequelize.query(
    `UPDATE world_events SET status = 'used', used_in_episode_id = :episodeId, times_used = COALESCE(times_used, 0) + 1, updated_at = NOW() WHERE id = :eventId RETURNING id`,
    { replacements: { episodeId, eventId }, transaction }
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Event ${eventId} could not be linked to episode ${episodeId}: no world_events row was updated`);
  }
}

/**
 * Generate a complete episode blueprint from a world event.
 *
 * @param {object} event — WorldEvent instance or plain object
 * @param {object} models — Sequelize models
 * @param {object} options — { showId, wardrobeItems: [] }
 * @returns {object} { episode, brief, scenePlan, todoList, financials }
 */
async function generateEpisodeFromEvent(event, models, options = {}) {
  const { Episode, EpisodeBrief } = models;
  const showId = options.showId || event.show_id;

  if (!showId) throw new Error('show_id is required');
  if (!Episode) throw new Error('Episode model not loaded');

  // One event starts at most one episode (Task #1751). This is the shared
  // guard for every route that starts an episode through this function
  // (generate-episode, generate-episode-from-many, regenerate-episode).
  // A link to a soft- or hard-deleted episode does not block.
  // regenerate-episode passes replacingEpisodeId: the event's own live
  // episode then passes the guard and is superseded inside the transaction
  // below, only once its replacement exists (§8(w) P3, Task #2210).
  const replacingEpisodeId = options.replacingEpisodeId || null;
  const eventId = typeof event.id === 'string' ? event.id : String(event.id);
  let liveEpisode = null;
  try {
    liveEpisode = await findLiveLinkedEpisode(models.sequelize, eventId);
  } catch (checkErr) {
    // Column may not exist, skip check
    console.warn('[EpisodeGenerator] used-event check skipped:', checkErr.message);
  }
  if (liveEpisode && !(replacingEpisodeId && liveEpisode.id === replacingEpisodeId)) {
    throw eventEpisodeConflictError(liveEpisode);
  }

  // Start Episode locks the terms, so a deal's price must be complete first
  // (Evoni's Deal PR 3 ruling, point 6, §8(cc): "Missing is missing"; Task
  // #2341). Every priced component and paid deliverable needs a number;
  // "Other" is never priced automatically. A regenerate replaces an episode
  // whose terms are already locked, so it is not refused here.
  if (!replacingEpisodeId) {
    const missing = await findMissingPrices(models.sequelize, eventId);
    if (missing.length) throw dealPriceRequiredError(missing);
  }

  // Get next episode number from active episodes only. Soft-deleted
  // regenerate history should not inflate visible episode numbering.
  let nextNumber = 1;
  try {
    const [rows] = await models.sequelize.query(
      `SELECT COALESCE(MAX(episode_number), 0) + 1 as next_num
       FROM episodes
       WHERE show_id = :showId AND deleted_at IS NULL${replacingEpisodeId ? ' AND id <> :replacingEpisodeId' : ''}`,
      { replacements: { showId, replacingEpisodeId } }
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

  // ── 1. Generate Title + Internal Synopsis + Viewer Teaser (P12, P13) ──
  const eventData = typeof event.toJSON === 'function' ? event.toJSON() : event;
  // ── 0b. Affordability guard ── (computeAffordabilityWarning)
  const affordabilityWarning = await computeAffordabilityWarning(models.sequelize, showId, event);

  const outfitPieces = typeof eventData.outfit_pieces === 'string' ? JSON.parse(eventData.outfit_pieces || '[]') : (eventData.outfit_pieces || []);
  const outfitScore = typeof eventData.outfit_score === 'string' ? JSON.parse(eventData.outfit_score || 'null') : (eventData.outfit_score || null);
  const autoData = (typeof eventData.canon_consequences === 'string'
    ? JSON.parse(eventData.canon_consequences) : (eventData.canon_consequences || {}))?.automation || {};

  let episodeTitle = eventData.name || `Episode ${nextNumber}`;
  // episodes.description is the internal synopsis of what happens (P13,
  // Task #2386). Without an AI draft it falls back to the event's
  // description, as before.
  let episodeDescription = eventData.description || `Based on: ${eventData.name}`;
  // The viewer teaser (P12, Task #2386), drafted in the same Claude call from
  // the event's concept (canon_consequences.automation.concept) and its
  // description. With no AI draft it stays null: it is never copied from the
  // event description, which is guest copy for attendees (rule 12).
  let episodeTeaser = null;
  let episodeTags = [];
  let aiBeatOutline = [];
  // AI-drafted forward hook — the one-line tease that pulls viewers into
  // the next episode. Filled from the same Claude call as the title/beats
  // so creators land on Overview with the brief's "Forward Hook" field
  // pre-populated instead of staring at a blank textarea.
  let aiForwardHook = null;

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
        messages: [{ role: 'user', content: `Generate a social-media-ready episode for "Styling Adventures with Lala" — title, internal synopsis, viewer teaser, tags, AND a draft beat outline so the creator has structure to work from before any script exists.

EVENT: ${eventData.name}
EVENT CONCEPT: ${typeof autoData.concept === 'string' && autoData.concept.trim() ? autoData.concept.trim() : 'None specified'}
EVENT DESCRIPTION (guest copy for attendees): ${eventData.description || 'None specified'}
Type: ${eventData.event_type} | Prestige: ${prestige}/10
Host: ${eventData.host || 'Unknown'}
${outfitContext}
Outfit mood: ${moodContext}
${financialContext}
Stakes: ${eventData.narrative_stakes || 'None specified'}

Return JSON:
{
  "title": "Clickable title (YouTube/TikTok style — curiosity gap, emotional hook, 60 chars max). Examples: 'I Wore a $200 Dress to a $10,000 Event', 'She Invited Me and THIS Happened', 'GRWM for the Most Important Night'",
  "description": "${SYNOPSIS_INSTRUCTION}",
  "teaser": "${TEASER_INSTRUCTION}",
  "tags": ["5-8 hashtags without #, lowercase, searchable terms like 'fashion', 'grwm', 'luxury event', 'outfit challenge'"],
  "beats": [
    { "beat_number": 1, "summary": "GRWM — Lala picks the outfit", "dramatic_function": "setup" },
    { "beat_number": 2, "summary": "...", "dramatic_function": "rising_action" }
  ],
  "forward_hook": "One sentence (max 140 chars) that teases the NEXT episode — what unresolved beat or stakes will pull the viewer back. Should reference a thread this episode opens but doesn't close (a relationship beat, a decision made, a brand opportunity dangled, a reputation shift). Examples: 'After tonight's chaos, the brand's calling — but is it the offer Lala thinks it is?', 'She left her number. Now what?'"
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
        episodeTeaser = normalizeTeaser(parsed.teaser, { eventDescription: eventData.description });
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
        // Trim the hook so legacy briefs that read it into chyrons or
        // metadata don't choke on a runaway paragraph if the model goes
        // long. 280 is generous; the prompt asks for ~140.
        if (typeof parsed.forward_hook === 'string' && parsed.forward_hook.trim()) {
          aiForwardHook = parsed.forward_hook.trim().slice(0, 280);
        }
      }
    }
  } catch (titleErr) {
    console.warn('[EpisodeGenerator] AI title generation failed (using event name):', titleErr.message);
  }

  // ── 1b. Snapshot the accepted terms (Task #1814) ──
  // Start Episode snapshots the four kinds of term the Event Package owns
  // (docs/EVENT_EPISODE_FLOW.md §8(t) item 2) onto the brief, so the
  // episode never reaches back to the event or a live opportunity to find
  // what is owed. A failed deliverables read is logged and the snapshot
  // carries none; it never fails generation.
  let eventDeliverables = [];
  try {
    eventDeliverables = await listEventDeliverables(models.sequelize, eventId);
  } catch (delivErr) {
    console.error('[EpisodeGenerator] Deliverables read failed (terms snapshot has none):', delivErr.message);
  }
  const termsSnapshot = buildTermsSnapshot(event, eventDeliverables);

  // ── 2. Create the Episode, its Brief and the event link — one transaction ──
  // Task #1906: the Episode, the Brief (which records the source event in
  // event_id) and the event's used_in_episode_id / status / times_used
  // stamp commit together or not at all. A stamp failure fails the Start
  // and leaves no episode and no brief behind. Everything after this block
  // is non-blocking by design, runs after the commit, and logs its own
  // failures.
  const { episode, brief } = await models.sequelize.transaction(async (transaction) => {
    const episode = await Episode.create({
      show_id: showId,
      title: episodeTitle,
      description: episodeDescription,
      teaser: episodeTeaser,
      // Saved copy of the draft: the teaser reads Auto-drafted while it
      // still equals this (doctrine rule 14).
      teaser_drafted: episodeTeaser,
      episode_number: nextNumber,
      status: 'draft',
      categories: episodeTags,
      total_income: 0,
      total_expenses: 0,
    }, { transaction });

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
          // The accepted terms at Start Episode (Task #1814): access
          // requirements, deliverables, restrictions, compensation. A
          // snapshot; completion readers still read the event, not this.
          terms: termsSnapshot,
        },
        // AI-drafted beat outline from the same Claude call that generated
        // the title — gives creators something to anchor edits against and
        // feeds Suggest-Scenes before any script exists.
        beat_outline: aiBeatOutline,
        episode_archetype: inferArchetype(event),
        designed_intent: inferIntent(event),
        narrative_purpose: `${event.name} — ${event.description || 'Event-driven episode'}`,
        forward_hook: aiForwardHook,
        status: 'draft',
      }, { transaction });
    }

    if (replacingEpisodeId) {
      await models.sequelize.query(
        'UPDATE episodes SET deleted_at = NOW() WHERE id = :episodeId AND deleted_at IS NULL',
        { replacements: { episodeId: replacingEpisodeId }, transaction }
      );
      // The superseded episode's ledger rows stop counting (§8(aa) M6):
      // sync Lala's coins in this transaction (Task #2284).
      const { syncCoinsAfterEpisodeChange } = require('./coinLedgerSync');
      await syncCoinsAfterEpisodeChange(models.sequelize, showId, { transaction });
    }

    // Event spending (the event cost split ruling, 2026-09-30): the
    // episode's Money tab lines, drafted once, in this transaction. The
    // event's extras cost rows are carried here, else a replaced episode's
    // lines are copied, else the event's extras are drafted as suggestions.
    const { draftEpisodeSpending } = require('./episodeSpendingService');
    await draftEpisodeSpending(models.sequelize, { event, episodeId: episode.id, replacingEpisodeId, transaction });

    await stampEventUsed(models.sequelize, eventId, episode.id, { transaction });
    return { episode, brief };
  });

  // Season Arc (§8(ff) Q5, A7): the episode takes the slot its event is
  // pencilled into, else the earliest open slot, and the slot locks. Logged,
  // never fatal: an episode left in no slot is listed on the roadmap to place.
  try {
    const { assignOnStart } = require('./seasonSlotService');
    await assignOnStart(models.sequelize, { showId, eventId, episodeId: episode.id, replacingEpisodeId });
  } catch (slotErr) {
    console.error('[EpisodeGenerator] Season slot assignment failed (non-blocking):', slotErr.message);
  }

  // Stamp the episode on the event's deliverables (Task #1814). Logged,
  // never fatal: the snapshot above already holds them.
  if (eventDeliverables.length > 0) {
    try {
      await stampDeliverablesEpisode(models.sequelize, eventId, episode.id);
    } catch (stampErr) {
      console.error('[EpisodeGenerator] Deliverable episode stamp failed (non-blocking):', stampErr.message);
    }
  }

  // Episode Money Phase B, MB6 (§8(gg), Q7): save the money plan as it
  // stands at Start Episode, for the reconciliation after Complete. Logged,
  // never fatal: an episode with no plan is compared with its current lines.
  try {
    const { snapshotMoneyPlan } = require('./episodeMoneyService');
    await snapshotMoneyPlan(models.sequelize, { showId, episodeId: episode.id });
  } catch (planErr) {
    console.error('[EpisodeGenerator] Money plan snapshot failed (non-blocking):', planErr.message);
  }

  // ── 2b. Auto-place required UI overlays on the timeline ──
  // The event's required_ui_overlays array (default
  // ['MailPanel', 'InviteLetterOverlay', 'WardrobeList', 'CareerList'])
  // names the overlays the show expects to render on this episode. Match
  // each name against ui_overlay_types and place the best available asset
  // on the timeline so creators land on Overview with the Timeline
  // Placements card pre-populated. Silent skip when no asset has been
  // generated yet — re-running this is safe (placement helper is
  // idempotent on (episode_id, asset_id)).
  //
  // P10 (Task #2386): an invitation approved before Start is tagged as this
  // episode's invitation overlay first, so the required-overlay pass
  // prefers it (episode-specific) over any show-wide invite overlay. It is
  // placed on the invitation beat after the scene plan exists (step 3b).
  try {
    const { syncEpisodeInvitationOverlay } = require('./episodeInvitationOverlayService');
    await syncEpisodeInvitationOverlay(models, { eventId, episodeId: episode.id, place: false });
  } catch (tagErr) {
    console.warn('[EpisodeGenerator] Invitation overlay tag failed (non-blocking):', tagErr.message);
  }
  try {
    const { autoPlaceRequiredOverlays } = require('./timelinePlacementService');
    const placed = await autoPlaceRequiredOverlays(models, {
      showId,
      episodeId: episode.id,
      requiredKeys: Array.isArray(event.required_ui_overlays) ? event.required_ui_overlays : [],
    });
    if (placed.length > 0) {
      console.log(`[EpisodeGenerator] Auto-placed ${placed.length} required overlay(s):`,
        placed.map(p => `${p.name} (${p.category})`).join(', '));
    }
  } catch (placeErr) {
    // Auto-placement is a nice-to-have; never block episode creation on it.
    console.warn('[EpisodeGenerator] Auto-place required overlays failed:', placeErr.message);
  }

  // ── 3. Create Scene Plan (14 beats) ──
  // Use a container object instead of bare identifiers so downstream
  // access is resilient even if a scope mutation slips in later edits.
  const { scenePlanRows, sceneSetIds } = await createScenePlanRows(episode, event, models);

  // ── 3b. The approved invitation is this episode's invitation overlay ──
  // P10 (Evoni, 2026-09-30; Task #2386): approved before Start, it is
  // tagged and placed on the invitation beat (beat 5, Reveal) here —
  // the same placement approve-invitation makes after Start. No-op when
  // the event has no approved invitation. Never blocks Start Episode.
  try {
    const { syncEpisodeInvitationOverlay } = require('./episodeInvitationOverlayService');
    const inv = await syncEpisodeInvitationOverlay(models, { eventId, episodeId: episode.id });
    if (inv.tagged) {
      console.log(`[EpisodeGenerator] Invitation ${inv.assetId} is the episode's invitation overlay (placed: ${inv.anchor || 'no'})`);
    }
  } catch (invErr) {
    console.warn('[EpisodeGenerator] Invitation overlay placement failed (non-blocking):', invErr.message);
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
  // Each beat's moment is written onto its scene_plans row by id; every
  // failure is recorded in feedMomentSave and returned, never silent
  // (§8(w) P5, Task #2213). scenePlanRows are plain objects, not instances.
  let feedMoments = {};
  const feedMomentSave = { attempted: 0, saved: 0, failed: [] };
  try {
    const { generateFeedMoments } = require('./feedMomentsService');
    const guestProfiles = automation.guest_profiles || [];
    feedMoments = await generateFeedMoments(event, BEAT_TEMPLATES, guestProfiles, models, { showType: 'styling_adventures' });

    // Attach feed moments to scene plan rows
    for (const row of scenePlanRows) {
      const beatNum = row.beat_number || row.dataValues?.beat_number;
      if (feedMoments[beatNum]) {
        feedMomentSave.attempted++;
        try {
          const moment = feedMoments[beatNum];
          await saveBeatFeedMoment(models.sequelize, row.id, moment);
          row.feed_moment = moment;
          if (moment.script_lines) row.script_lines = moment.script_lines;
          feedMomentSave.saved++;
        } catch (momentErr) {
          console.error(`[EpisodeGenerator] Feed moment save failed for beat ${beatNum}:`, momentErr.message);
          feedMomentSave.failed.push({ beat_number: beatNum, error: momentErr.message });
        }
      }
    }
    if (feedMomentSave.failed.length > 0) {
      console.error(`[EpisodeGenerator] ${feedMomentSave.failed.length} of ${feedMomentSave.attempted} feed moment(s) were not saved for episode ${episode.id}`);
    }
  } catch (fmErr) {
    console.warn('[EpisodeGenerator] Feed moments generation failed (non-blocking):', fmErr.message);
  }

  // Record the outcome on the brief (event_metadata.feed_moment_save; no new
  // column) so the episode's Scenes tab can name the beats whose moment was
  // not saved. Moments are rolled per beat, so an empty scene_plans.feed_moment
  // alone cannot say whether one was meant to be there (Task #2216).
  if (brief?.id) {
    try {
      await recordFeedMomentSave(models.sequelize, brief.id, { ...feedMomentSave, recorded_at: new Date().toISOString() });
    } catch (recordErr) {
      console.error(`[EpisodeGenerator] Could not record the feed moment save outcome on brief ${brief.id}:`, recordErr.message);
    }
  }

  // ── 4. Create Todo List (wardrobe + social tasks) ──
  const eventType = event.event_type || 'invite';

  // Use event's saved social tasks if available, otherwise generate fresh
  let socialTasks = automation.social_tasks;
  if (Array.isArray(socialTasks) && socialTasks.length > 0) {
    // D13 answer 6: the relationship goals join a saved list too, within
    // T9's combined limit.
    const have = new Set(socialTasks.map((t) => t?.slot).filter(Boolean));
    const added = relationshipGoalTasks(event).filter((g) => !have.has(g.slot));
    if (added.length) socialTasks = capCombinedGoals([...socialTasks, ...added], goalTaskScale(event), 'SocialTasks');
  }
  if (!Array.isArray(socialTasks) || socialTasks.length === 0) {
    let hostProfile = null;
    const creator = eventCreatorOrganizer(event);
    try {
      const hostProfileId = creator?.profileId;
      if (hostProfileId) {
        const [rows] = await models.sequelize.query(
          'SELECT platform, content_category, archetype, follower_tier, handle, display_name FROM social_profiles WHERE id = :id LIMIT 1',
          { replacements: { id: hostProfileId } }
        );
        hostProfile = rows?.[0] || null;
      }
    } catch (hostErr) {
      console.warn('[EpisodeGenerator] Host profile read for social tasks failed (non-blocking):', hostErr.message);
    }
    socialTasks = buildSocialTasks(eventType, hostProfile, outfitPieces, {
      event, // T9: prestige sets the goal count; description, format, theme, stakes
      event_name: event.name,
      host_name: event.host || creator?.displayName,
      host_handle: creator?.handle,
      host_brand: event.host_brand || automation.host_brand,
      venue_name: event.venue_name || automation.venue_name,
      dress_code: event.dress_code,
      guest_names: Array.isArray(automation.guest_profiles)
        ? automation.guest_profiles.map(g => g.display_name || g.handle).filter(Boolean)
        : [],
    });
  }
  // T1 (§8(bb); Task #2292): the saved list may predate T1 and carry
  // required: true on generated tasks. Required comes only from the event's
  // deliverables (read above for the terms snapshot): generated tasks become
  // goals or optional ideas, and each deliverable row becomes one task.
  socialTasks = withDeliverableTasks(socialTasks, eventDeliverables);

  // T6 (§8(bb); Task #2306, Evoni's ruling): "Regenerate starts from the
  // replaced episode's task list as it stands, keeping its edits and
  // completion flags, and adds any required deliverable task the event's
  // accepted terms include that the list lacks. It does not restore
  // deleted goals or ideas or generate new ones; fresh ideas come from the
  // Career Checklist's Regenerate." With no saved list on the replaced
  // episode, the list built above is used.
  if (replacingEpisodeId) {
    try {
      const kept = await readEpisodeSocialTasks(models.sequelize, replacingEpisodeId);
      if (kept !== null) socialTasks = withMissingRequiredDeliverables(kept, eventDeliverables);
    } catch (keepErr) {
      console.error('[EpisodeGenerator] Replaced episode\'s task list read failed (list rebuilt from the event):', keepErr.message);
    }
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
      // Task #1924: the copy is the episode's approved look. Until the
      // approval columns existed every one of these writes failed here.
      // linkEpisodeWardrobe also restores a pair whose link was removed
      // (EpisodeWardrobe is paranoid; findOrCreate would hit the unique pair).
      const { linkEpisodeWardrobe } = require('./episodeWardrobeLinks');
      for (const piece of outfitPieces) {
        await linkEpisodeWardrobe(
          models.EpisodeWardrobe,
          { episode_id: episode.id, wardrobe_id: piece.id },
          { approval_status: 'approved', approved_at: new Date(), worn_at: new Date() }
        );
      }
      console.log(`[EpisodeGenerator] ${outfitPieces.length} outfit pieces linked from event`);
    }
  } catch (outfitErr) {
    console.error('[EpisodeGenerator] Outfit linking failed (non-blocking):', outfitErr.message);
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
      }).catch((findErr) => {
        console.warn('[EpisodeGenerator] Event asset lookup failed, trying raw SQL (non-blocking):', findErr.message);
        return [];
      });

      // Fallback: raw SQL if JSONB query fails
      let assets = eventAssets;
      if (!assets || assets.length === 0) {
        try {
          const [rows] = await models.sequelize.query(
            `SELECT id FROM assets WHERE metadata->>'event_id' = :eventId AND deleted_at IS NULL`,
            { replacements: { eventId } }
          );
          assets = rows || [];
        } catch (rawErr) {
          console.warn('[EpisodeGenerator] Event asset raw lookup failed (non-blocking):', rawErr.message);
        }
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
        } catch (oneErr) {
          console.warn(`[EpisodeGenerator] Asset ${assetId} link failed (non-blocking):`, oneErr.message);
        }
      }
      if (linked > 0) console.log(`[EpisodeGenerator] ${linked} event assets linked to episode`);
    }
  } catch (assetErr) {
    console.warn('[EpisodeGenerator] Asset linking failed (non-blocking):', assetErr.message);
  }

  // Record the event in host + guest history (Task #1818). History only:
  // no episode is evaluated yet, so the relevance boost, the tier-based
  // state change and the post-event opportunities run at completion
  // (episodeCompletionService.completeEpisode, applyEventOutcome +
  // generatePostEventOpportunities). A regeneration adds no second entry.
  try {
    const characterSync = require('./characterSyncService');
    const historyResult = await characterSync.recordEventHistory(event, episode, models);
    console.log(`[EpisodeGenerator] Event history: ${historyResult.updated} profiles updated, ${historyResult.skipped} already recorded`);
  } catch (syncErr) {
    console.warn('[EpisodeGenerator] Event history failed (non-blocking):', syncErr.message);
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
    feedMomentSave,
  };
}

module.exports = {
  generateEpisodeFromEvent,
  stampEventUsed,
  createScenePlanRows,
  buildSocialTasks,
  calculateFinancials,
  computeAffordabilityWarning,
  loadFinancialWardrobeItems,
  inferArchetype,
  inferIntent,
  BEAT_TEMPLATES,
};

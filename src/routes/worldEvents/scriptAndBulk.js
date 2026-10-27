/**
 * World Events routes — script skeleton, bulk seed, AI fix
 *
 * POST   /api/v1/world/:showId/events/:eventId/generate-script
 * POST   /api/v1/world/:showId/events/bulk-seed
 * POST   /api/v1/world/:showId/events/ai-fix
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/aiRateLimiter');
const { scriptOverwriteBlocked, scriptOverwriteRefusalBody } = require('../../utils/scriptOverwriteGuard');
const { withAutoScheduledDate } = require('../../utils/eventDateDefault');
const { syncDraftedDealType } = require('../../services/dealTypeDraftService');
const { loadScopedEvent } = require('../../utils/eventScope');
const { getModels } = require('./helpers');

// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events/:eventId/generate-script
// Generate a full episode script skeleton from an event
// ═══════════════════════════════════════════

let scriptSkeletonGenerator;
try { scriptSkeletonGenerator = require('../../utils/scriptSkeletonGenerator'); } catch (e) { scriptSkeletonGenerator = null; }

router.post('/world/:showId/events/:eventId/generate-script', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const {
      episode_id,
      intent = null,
      include_narration = true,
      include_animations = true,
    } = req.body;

    if (!scriptSkeletonGenerator) {
      return res.status(500).json({ success: false, error: 'Script skeleton generator not loaded' });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Get event
    const event = await loadScopedEvent(models.sequelize, { showId, eventId });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // If episode_id is provided, this call will save to it below — refuse
    // before spending the generation work if it would silently replace an
    // existing script. The episode must be this show's (audit Medium,
    // 2026-10-23): another show's episode is a 404, never written.
    let episodeForGuard = null;
    if (episode_id) {
      episodeForGuard = await models.Episode.findByPk(episode_id);
      if (!episodeForGuard || String(episodeForGuard.show_id) !== String(showId)) {
        return res.status(404).json({ success: false, error: 'Episode not found in this show' });
      }
      if (scriptOverwriteBlocked(episodeForGuard?.script_content, req.body)) {
        console.warn(`[ScriptSkeleton] Refused overwrite for episode ${episode_id}: existing script_content present, no confirmOverwrite flag.`);
        return res.status(409).json(scriptOverwriteRefusalBody());
      }
    }

    // Get character state for context-aware generation
    let characterState = {};
    try {
      const [states] = await models.sequelize.query(
        `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1`,
        { replacements: { showId } }
      );
      if (states && states.length > 0) {
        characterState = {
          coins: states[0].coins,
          reputation: states[0].reputation,
          brand_trust: states[0].brand_trust,
          influence: states[0].influence,
          stress: states[0].stress,
        };
      }
    } catch (e) {
      // No state yet: the skeleton is generated without it.
      console.error('[ScriptSkeleton] character state lookup failed:', e.message);
    }

    // Generate skeleton
    const script = scriptSkeletonGenerator.generateScriptSkeleton(event, {
      characterState,
      intent,
      includeNarration: include_narration,
      includeAnimations: include_animations,
    });

    // If episode_id provided, save to episode, through
    // services/scriptSave.js (A1c R1): the row locked, the overwrite guard
    // checked again under the lock, locked beats kept, the replaced script
    // kept as a version (a failure fails the save). The response's script is
    // the one saved (D10).
    let saved = null;
    if (episodeForGuard) {
      const { saveEpisodeScript, sendScriptSaveError } = require('../../services/scriptSave');
      const { scriptKeepingLocks } = require('../../utils/scriptBeatLocks');
      try {
        saved = await saveEpisodeScript(models, episode_id, {
          writer: 'W7',
          source: 'generate',
          guard: req.body,
          userId: req.user?.id,
          compose: (row) => ({ script: scriptKeepingLocks(row, script).script }),
        });
      } catch (err) {
        if (sendScriptSaveError(res, err)) return undefined;
        throw err;
      }
    }
    const text = saved ? saved.script_content : script;

    return res.json({
      success: true,
      script: text,
      ...(saved ? { script_revision: saved.script_revision } : {}),
      event_name: event.name,
      character_state_used: characterState,
      intent,
      line_count: text.split('\n').length,
      beat_count: (text.match(/## BEAT:/g) || []).length,
    });
  } catch (error) {
    console.error('Generate script error:', error);
    return res.status(500).json({ success: false, error: 'Script generation failed', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events/bulk-seed
// Seed multiple events at once (for initial setup)
// ═══════════════════════════════════════════

router.post('/world/:showId/events/bulk-seed', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { events } = req.body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ success: false, error: 'events array is required' });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const created = [];
    for (const ev of events) {
      const id = uuidv4();
      // Task #1755: a seeded event with no date is auto-scheduled 45 days
      // out (src/utils/eventDateDefault.js); a supplied date is kept.
      const dated = withAutoScheduledDate(ev.event_date, {});
      await models.sequelize.query(
        `INSERT INTO world_events 
         (id, show_id, name, event_type, host, host_brand, description,
          prestige, cost_coins, strictness, deadline_type,
          dress_code, location_hint, narrative_stakes,
          browse_pool_bias, browse_pool_size,
          is_paid, payment_amount, requirements, career_tier,
          career_milestone, fail_consequence, success_unlock,
          event_date, canon_consequences,
          status, created_at, updated_at)
         VALUES
         (:id, :showId, :name, :event_type, :host, :host_brand, :description,
          :prestige, :cost_coins, :strictness, :deadline_type,
          :dress_code, :location_hint, :narrative_stakes,
          :browse_pool_bias, :browse_pool_size,
          :is_paid, :payment_amount, :requirements, :career_tier,
          :career_milestone, :fail_consequence, :success_unlock,
          :event_date, :canon_consequences,
          'ready', NOW(), NOW())`,
        {
          replacements: {
            id, showId,
            event_date: dated.event_date,
            canon_consequences: JSON.stringify(dated.canon_consequences),
            name: ev.name,
            event_type: ev.event_type || 'invite',
            host: ev.host || null,
            host_brand: ev.host_brand || null,
            description: ev.description || null,
            prestige: ev.prestige || 5,
            cost_coins: ev.cost_coins || 0,
            strictness: ev.strictness || 5,
            deadline_type: ev.deadline_type || 'medium',
            dress_code: ev.dress_code || null,
            location_hint: ev.location_hint || null,
            narrative_stakes: ev.narrative_stakes || null,
            browse_pool_bias: ev.browse_pool_bias || 'balanced',
            browse_pool_size: ev.browse_pool_size || 8,
            is_paid: ev.is_paid || false,
            payment_amount: ev.payment_amount || 0,
            requirements: JSON.stringify(ev.requirements || {}),
            career_tier: ev.career_tier || 1,
            career_milestone: ev.career_milestone || null,
            fail_consequence: ev.fail_consequence || null,
            success_unlock: ev.success_unlock || null,
          },
        }
      );
      // The deal type's first draft (Task #2330; dealTypeDraftService).
      await syncDraftedDealType(models.sequelize, id, { initial: true });
      created.push({ id, name: ev.name });
    }

    return res.status(201).json({ success: true, created_count: created.length, events: created });
  } catch (error) {
    console.error('Bulk seed error:', error);
    return res.status(500).json({ success: false, error: 'Bulk seed failed', message: error.message });
  }
});

// AI event diversification suggestions. AI route: rate-limited, MODELS with
// two tries each, budget/unreachable answered by utils/aiFailure (show side
// check, 2026-10-20, P4).
const AI_FIX_MODELS = ['claude-sonnet-4-6'];
router.post('/world/:showId/events/ai-fix', express.json({ limit: '2mb' }), requireAuth, aiRateLimiter, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'Invalid request body',
        message: 'Request body must be valid JSON with warnings/events arrays',
        code: 'INVALID_JSON_BODY',
      });
    }

    const { warnings, events, episodes = [] } = req.body;
    if (!Array.isArray(warnings) || !Array.isArray(events)) {
      return res.status(400).json({
        error: 'warnings and events are required',
        message: 'warnings and events must both be arrays',
        code: 'INVALID_PAYLOAD',
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        error: 'AI service unavailable',
        message: 'ANTHROPIC_API_KEY not configured',
        code: 'ANTHROPIC_API_KEY_MISSING',
      });
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const limitedEvents = events.slice(0, 30);

    const eventList = limitedEvents.map(ev => {
      const ep = episodes?.find(e => e.id === ev.used_in_episode_id);
      return `- id:${ev.id} "${ev.name}" (type: ${ev.event_type}, prestige: ${ev.prestige}, cost: ${ev.cost_coins ?? '?'}, dress: ${ev.dress_code || 'none'})${ep ? ` -> Ep ${ep.episode_number}: ${ep.title}` : ' -> unlinked'}`;
    }).join('\n');

    // Episodes without an event — Claude needs to know these exist to
    // suggest reassign targets for the gap warnings.
    const linkedEpIds = new Set(limitedEvents.map(ev => ev.used_in_episode_id).filter(Boolean));
    const openEpisodes = (episodes || [])
      .filter(ep => !linkedEpIds.has(ep.id))
      .slice(0, 20)
      .map(ep => `- id:${ep.id} Ep ${ep.episode_number}: "${ep.title}"`)
      .join('\n');

    const warningList = (warnings || []).slice(0, 10).map(w => `- ${w.msg || w}`).join('\n');

    const aiFixRequest = (model) => client.messages.create({
      model,
      max_tokens: 2000,
      system: `You are a TV show producer for "Styling Adventures with Lala", a narrative-driven luxury fashion life simulator set in the LalaVerse.

SHOW CONTEXT:
- Lala is a luxury fashion creator and social media influencer building her career
- She navigates industry events, brand collaborations, fashion shows, and creator culture
- The show is about building a social media fashion career — NOT family drama
- Lala does NOT have a sister. She is a solo creator
- Event types: industry galas, press days, brand collaborations, fashion shows, cocktail evenings, editorial shoots, awards ceremonies, charity galas, launch events
- 4 event categories: industry (primary), dating, family, social_drama
- Industry events should dominate (at least 50% of all events)
- Family/dating events should create tension WITH her career, not replace it

Return ONLY valid JSON - an array of suggestion objects.`,
      messages: [{
        role: 'user',
        content: `Here are the current story logic warnings for my events:

${warningList}

Here are all my events and their episode assignments:
${eventList}

${openEpisodes ? `Episodes that have no event yet (use these as targets for "reassign"):\n${openEpisodes}\n` : ''}
For each warning, suggest a specific fix. Return a JSON array:
\`\`\`json
[
  {
    "warning": "the warning text",
    "suggestion": "what to change",
    "action": "swap_type" | "rename" | "change_prestige" | "change_dress_code" | "change_cost" | "reassign",
    "event_id": "the id: prefix from the event list above — REQUIRED for stable matching",
    "event_name": "the event's current name (informational)",
    "new_value": "for reassign: the target episode id from the open-episodes list. for change_dress_code: a new dress code string. for change_cost: a new cost_coins integer. for swap_type/rename/change_prestige: the new value."
  }
]
\`\`\`

Guidelines:
- Always include event_id so the apply step can match exactly even after renames
- For "Same dress code N in a row": use change_dress_code with a different style
- For "costs X coins at Tier Y" warnings: use change_cost with a lower number
- For unlinked episodes (gap warnings): use reassign with new_value set to the open episode's id
- For back-to-back same types: suggest changing one to a different event_type
- For duplicates: suggest renaming to be distinct or merging them
- For high prestige too early: suggest lowering prestige or swapping with a later episode
- Make events feel varied: mix intimate vs grand, casual vs formal, professional vs social
- Each suggestion should be specific and actionable`,
      }],
    });

    let response;
    for (const model of AI_FIX_MODELS) {
      for (let attempt = 1; attempt <= 2 && !response; attempt += 1) {
        try {
          response = await aiFixRequest(model);
        } catch (callErr) {
          console.warn(`[WorldEvents] ai-fix with ${model}, try ${attempt}, failed:`, callErr.message);
          if (callErr?.code === 'AI_BUDGET_EXCEEDED' || (attempt === 2 && model === AI_FIX_MODELS[AI_FIX_MODELS.length - 1])) throw callErr;
        }
      }
      if (response) break;
    }

    const text = response.content?.[0]?.text || '';
    let suggestions;
    try {
      const match = text.match(/\[[\s\S]*\]/);
      suggestions = match ? JSON.parse(match[0]) : [];
    } catch (parseErr) {
      console.error('[WorldEvents] ai-fix came back unreadable:', parseErr.message);
      suggestions = [{ warning: 'Parse error', suggestion: text.slice(0, 500), action: 'manual', event_name: '', new_value: '' }];
    }

    return res.json({ success: true, data: suggestions });
  } catch (err) {
    if (require('../../utils/aiFailure').aiFailure(res, err)) return undefined;
    console.error('[WorldEvents] AI fix error:', err);
    const message = err?.error?.message || err?.message || 'Unknown AI service error';
    let status = 500;
    let code = 'AI_FIX_ERROR';

    if (/credit balance is too low/i.test(message)) {
      status = 402;
      code = 'ANTHROPIC_CREDITS_EXHAUSTED';
    } else if (/invalid api key|authentication/i.test(message)) {
      status = 503;
      code = 'ANTHROPIC_AUTH_FAILED';
    } else if (err?.status === 429 || /rate limit/i.test(message)) {
      status = 429;
      code = 'ANTHROPIC_RATE_LIMIT';
    } else if (err?.status && Number.isInteger(err.status)) {
      status = err.status;
      code = 'ANTHROPIC_REQUEST_FAILED';
    }

    return res.status(status).json({
      error: 'AI fix failed',
      message,
      code,
    });
  }
});

module.exports = router;

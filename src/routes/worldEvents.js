/**
 * World Events Routes — Event Library CRUD + Inject into Episode
 * 
 * GET    /api/v1/world/:showId/events          — List events
 * POST   /api/v1/world/:showId/events          — Create event
 * PUT    /api/v1/world/:showId/events/:eventId  — Update event
 * DELETE /api/v1/world/:showId/events/:eventId  — Delete event
 * POST   /api/v1/world/:showId/events/:eventId/inject — Inject event into episode script
 * POST   /api/v1/world/:showId/events/:eventId/generate-script — Generate full script skeleton
 * POST   /api/v1/world/:showId/events/:eventId/generate-invitation — Generate invitation card image
 * GET    /api/v1/world/:showId/events/:eventId/invitation — Check if invitation exists
 * POST   /api/v1/world/:showId/events/ai-fix — AI suggestions to diversify event plan
 * 
 * Location: src/routes/worldEvents.js
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

async function getModels() {
  try { return require('../models'); } catch (e) { return null; }
}


// ═══════════════════════════════════════════
// GET /api/v1/world/:showId/events
// ═══════════════════════════════════════════

router.get('/world/:showId/events', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { status, event_type, sort = 'created_at', order = 'DESC' } = req.query;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    let query = `SELECT e.*, a.s3_url_processed as invitation_url
      FROM world_events e
      LEFT JOIN assets a ON a.id = e.invitation_asset_id AND a.deleted_at IS NULL
      WHERE e.show_id = :showId`;
    const replacements = { showId };

    if (status) {
      query += ` AND e.status = :status`;
      replacements.status = status;
    }
    if (event_type) {
      query += ` AND e.event_type = :event_type`;
      replacements.event_type = event_type;
    }

    const validSorts = ['created_at', 'name', 'prestige', 'cost_coins', 'status'];
    const sortCol = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY e.${sortCol} ${sortOrder}`;

    const [events] = await models.sequelize.query(query, { replacements });

    return res.json({ success: true, events });
  } catch (error) {
    console.error('List events error:', error);
    return res.status(500).json({ error: 'Failed to load events', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events
// ═══════════════════════════════════════════

router.post('/world/:showId/events', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const {
      name, event_type = 'invite', host, host_brand, description,
      prestige = 5, cost_coins = 100, strictness = 5,
      deadline_type = 'medium', deadline_minutes,
      dress_code, dress_code_keywords = [],
      location_hint, narrative_stakes, canon_consequences = {},
      seeds_future_events = [],
      overlay_template = 'luxury_invite',
      required_ui_overlays = ['MailPanel', 'InviteLetterOverlay', 'ToDoList'],
      browse_pool_bias = 'balanced', browse_pool_size = 8,
      rewards = {},
      season_id, arc_id,
      is_paid = false, payment_amount = 0,
      requirements = {}, career_tier = 1,
      career_milestone, fail_consequence, success_unlock,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Event name is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    const id = uuidv4();
    await models.sequelize.query(
      `INSERT INTO world_events 
        (id, show_id, season_id, arc_id, name, event_type, host, host_brand, description,
        prestige, cost_coins, strictness, deadline_type, deadline_minutes,
        dress_code, dress_code_keywords, location_hint, narrative_stakes,
        canon_consequences, seeds_future_events,
        overlay_template, required_ui_overlays, browse_pool_bias, browse_pool_size,
        rewards, is_paid, payment_amount, requirements, career_tier,
        career_milestone, fail_consequence, success_unlock,
        status, created_at, updated_at)
       VALUES
      (:id, :showId, :season_id, :arc_id, :name, :event_type, :host, :host_brand, :description,
        :prestige, :cost_coins, :strictness, :deadline_type, :deadline_minutes,
        :dress_code, :dress_code_keywords, :location_hint, :narrative_stakes,
        :canon_consequences, :seeds_future_events,
        :overlay_template, :required_ui_overlays, :browse_pool_bias, :browse_pool_size,
        :rewards, :is_paid, :payment_amount, :requirements, :career_tier,
        :career_milestone, :fail_consequence, :success_unlock,
        'draft', NOW(), NOW())`,
      {
        replacements: {
          id, showId,
          season_id: season_id || null,
          arc_id: arc_id || null,
          name, event_type,
          host: host || null,
          host_brand: host_brand || null,
          description: description || null,
          prestige, cost_coins, strictness,
          deadline_type, deadline_minutes: deadline_minutes || null,
          dress_code: dress_code || null,
          dress_code_keywords: JSON.stringify(dress_code_keywords),
          location_hint: location_hint || null,
          narrative_stakes: narrative_stakes || null,
          canon_consequences: JSON.stringify(canon_consequences),
          seeds_future_events: JSON.stringify(seeds_future_events),
          overlay_template, 
          required_ui_overlays: JSON.stringify(required_ui_overlays),
          browse_pool_bias, browse_pool_size,
          rewards: JSON.stringify(rewards),
          is_paid: is_paid,
          payment_amount: payment_amount,
          requirements: JSON.stringify(requirements),
          career_tier: career_tier,
          career_milestone: career_milestone || null,
          fail_consequence: fail_consequence || null,
          success_unlock: success_unlock || null,
        },
      }
    );

    const [created] = await models.sequelize.query(
      `SELECT * FROM world_events WHERE id = :id`, { replacements: { id } }
    );

    return res.status(201).json({ success: true, event: created[0] });
  } catch (error) {
    console.error('Create event error:', error);
    return res.status(500).json({ error: 'Failed to create event', message: error.message });
  }
});


// ═══════════════════════════════════════════
// PUT /api/v1/world/:showId/events/:eventId
// ═══════════════════════════════════════════

router.put('/world/:showId/events/:eventId', express.json({ limit: '2mb' }), optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'Invalid request body',
        message: 'Request body must be valid JSON',
        code: 'INVALID_JSON_BODY',
      });
    }

    const updates = req.body;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Build dynamic SET clause
    const allowedFields = [
      'name', 'event_type', 'host', 'host_brand', 'description',
      'prestige', 'cost_coins', 'strictness',
      'deadline_type', 'deadline_minutes',
      'dress_code', 'dress_code_keywords',
      'location_hint', 'narrative_stakes', 'canon_consequences',
      'seeds_future_events', 'overlay_template', 'required_ui_overlays',
      'browse_pool_bias', 'browse_pool_size', 'rewards', 'status',
      'season_id', 'arc_id',
      'is_paid', 'payment_amount', 'requirements', 'career_tier',
      'career_milestone', 'fail_consequence', 'success_unlock',
      'scene_set_id',
      'theme', 'color_palette', 'mood', 'floral_style', 'border_style',
    ];
    const requiredStringFields = new Set(['name', 'event_type', 'status']);

    const setClauses = [];
    const replacements = { showId, eventId };
    const integerFields = new Set([
      'prestige', 'cost_coins', 'strictness', 'deadline_minutes',
      'browse_pool_size', 'payment_amount', 'career_tier',
    ]);
    const jsonFields = new Set([
      'dress_code_keywords', 'canon_consequences', 'seeds_future_events',
      'required_ui_overlays', 'rewards', 'requirements', 'color_palette',
    ]);

    const normalizeNullLike = (value) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
      }
      return value;
    };

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        let val = normalizeNullLike(updates[field]);

        if (field === 'career_tier' && typeof val === 'string') {
          const tierMap = { emerging: 1, rising: 2, established: 3, elite: 4, icon: 5 };
          if (tierMap[val.toLowerCase()] !== undefined) {
            val = tierMap[val.toLowerCase()];
          }
        }

        if (val !== null && integerFields.has(field)) {
          const numeric = Number(val);
          if (!Number.isFinite(numeric)) {
            return res.status(400).json({
              error: `Invalid value for ${field}`,
              message: `${field} must be a number or null`,
            });
          }
          val = Math.trunc(numeric);
        }

        if (jsonFields.has(field)) {
          val = val === null ? null : JSON.stringify(val);
        }

        setClauses.push(`${field} = :${field}`);
        replacements[field] = val;
      }
    }

    if (setClauses.length === 0) {
      console.warn('[WorldEvents] PUT 400 — no valid fields. Received keys:', Object.keys(updates).join(', '));
      return res.status(400).json({ error: 'No valid fields to update', received: Object.keys(updates) });
    }

    setClauses.push('updated_at = NOW()');

    await models.sequelize.query(
      `UPDATE world_events SET ${setClauses.join(', ')} WHERE id = :eventId AND show_id = :showId`,
      { replacements }
    );

    const [updated] = await models.sequelize.query(
      `SELECT * FROM world_events WHERE id = :eventId`, { replacements: { eventId } }
    );

    return res.json({ success: true, event: updated[0] });
  } catch (error) {
    console.error('Update event error:', error);
    if (String(error.message || '').includes('does not exist')) {
      return res.status(400).json({ error: 'Invalid update field', message: error.message });
    }
    return res.status(500).json({ error: 'Failed to update event', message: error.message });
  }
});


// ═══════════════════════════════════════════
// DELETE /api/v1/world/:showId/events/:eventId
// ═══════════════════════════════════════════

router.delete('/world/:showId/events/:eventId', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    await models.sequelize.query(
      `DELETE FROM world_events WHERE id = :eventId AND show_id = :showId`,
      { replacements: { showId, eventId } }
    );

    return res.json({ success: true, deleted: eventId });
  } catch (error) {
    console.error('Delete event error:', error);
    return res.status(500).json({ error: 'Failed to delete event', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events/:eventId/inject
// Inject an event into an episode's script as [EVENT:] tag
// ═══════════════════════════════════════════

router.post('/world/:showId/events/:eventId/inject', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { episode_id } = req.body;

    if (!episode_id) return res.status(400).json({ error: 'episode_id is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Get event
    const [events] = await models.sequelize.query(
      `SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId`,
      { replacements: { eventId, showId } }
    );

    if (!events || events.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = events[0];

    // Get episode
    const episode = await models.Episode.findByPk(episode_id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    // Build [EVENT:] tag
    const parts = [`name="${event.name}"`];
    if (event.prestige) parts.push(`prestige=${event.prestige}`);
    if (event.cost_coins) parts.push(`cost=${event.cost_coins}`);
    if (event.strictness) parts.push(`strictness=${event.strictness}`);
    if (event.deadline_type) parts.push(`deadline="${event.deadline_type}"`);
    if (event.dress_code) parts.push(`dress_code="${event.dress_code}"`);
    const eventTag = `[EVENT: ${parts.join(' ')}]`;

    // Build location hint if present
    const locationTag = event.location_hint ? `[LOCATION_HINT: "${event.location_hint}"]` : '';

    // Insert into script
    let script = episode.script_content || '';

    // Remove existing [EVENT:] tag if present
    script = script.replace(/\[EVENT:[^\]]*\]/gi, '');
    script = script.replace(/\[LOCATION_HINT:[^\]]*\]/gi, '');

    // Find best insertion point (after STAKES_INTENTION beat or after first REVEAL)
    const stakesIdx = script.indexOf('## BEAT: STAKES');
    const revealIdx = script.indexOf('## BEAT: REVEAL');
    const interruptIdx = script.indexOf('## BEAT: INTERRUPTION');

    let insertIdx;
    if (stakesIdx >= 0) {
      insertIdx = script.indexOf('\n', stakesIdx) + 1;
    } else if (revealIdx >= 0) {
      insertIdx = script.indexOf('\n', revealIdx) + 1;
    } else if (interruptIdx >= 0) {
      insertIdx = script.indexOf('\n', interruptIdx) + 1;
    } else {
      // Insert at top
      insertIdx = 0;
    }

    const injection = eventTag + '\n' + (locationTag ? locationTag + '\n' : '');
    script = script.substring(0, insertIdx) + injection + script.substring(insertIdx);

    // Save
    await episode.update({ script_content: script.trim() });

    // Mark event as used
    await models.sequelize.query(
      `UPDATE world_events SET used_in_episode_id = :episodeId, times_used = times_used + 1, status = 'used', updated_at = NOW() WHERE id = :eventId`,
      { replacements: { episodeId: episode_id, eventId } }
    );

    return res.json({
      success: true,
      event_tag: eventTag,
      location_tag: locationTag || null,
      episode_id,
      message: `Event "${event.name}" injected into episode script.`,
    });
  } catch (error) {
    console.error('Inject event error:', error);
    return res.status(500).json({ error: 'Failed to inject event', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events/:eventId/generate-script
// Generate a full episode script skeleton from an event
// ═══════════════════════════════════════════

let scriptSkeletonGenerator;
try { scriptSkeletonGenerator = require('../utils/scriptSkeletonGenerator'); } catch (e) { scriptSkeletonGenerator = null; }

router.post('/world/:showId/events/:eventId/generate-script', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const {
      episode_id,
      intent = null,
      include_narration = true,
      include_animations = true,
    } = req.body;

    if (!scriptSkeletonGenerator) {
      return res.status(500).json({ error: 'Script skeleton generator not loaded' });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Get event
    const [events] = await models.sequelize.query(
      `SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId`,
      { replacements: { eventId, showId } }
    );
    if (!events || events.length === 0) return res.status(404).json({ error: 'Event not found' });
    const event = events[0];

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
    } catch (e) { /* no state yet */ }

    // Generate skeleton
    const script = scriptSkeletonGenerator.generateScriptSkeleton(event, {
      characterState,
      intent,
      includeNarration: include_narration,
      includeAnimations: include_animations,
    });

    // If episode_id provided, save to episode
    if (episode_id) {
      const episode = await models.Episode.findByPk(episode_id);
      if (episode) {
        await episode.update({ script_content: script });
      }
    }

    return res.json({
      success: true,
      script,
      event_name: event.name,
      character_state_used: characterState,
      intent,
      line_count: script.split('\n').length,
      beat_count: (script.match(/## BEAT:/g) || []).length,
    });
  } catch (error) {
    console.error('Generate script error:', error);
    return res.status(500).json({ error: 'Script generation failed', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events/bulk-seed
// Seed multiple events at once (for initial setup)
// ═══════════════════════════════════════════

router.post('/world/:showId/events/bulk-seed', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { events } = req.body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    const created = [];
    for (const ev of events) {
      const id = uuidv4();
      await models.sequelize.query(
        `INSERT INTO world_events 
         (id, show_id, name, event_type, host, host_brand, description,
          prestige, cost_coins, strictness, deadline_type,
          dress_code, location_hint, narrative_stakes,
          browse_pool_bias, browse_pool_size,
          is_paid, payment_amount, requirements, career_tier,
          career_milestone, fail_consequence, success_unlock,
          status, created_at, updated_at)
         VALUES
         (:id, :showId, :name, :event_type, :host, :host_brand, :description,
          :prestige, :cost_coins, :strictness, :deadline_type,
          :dress_code, :location_hint, :narrative_stakes,
          :browse_pool_bias, :browse_pool_size,
          :is_paid, :payment_amount, :requirements, :career_tier,
          :career_milestone, :fail_consequence, :success_unlock,
          'ready', NOW(), NOW())`,
        {
          replacements: {
            id, showId,
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
      created.push({ id, name: ev.name });
    }

    return res.status(201).json({ success: true, created_count: created.length, events: created });
  } catch (error) {
    console.error('Bulk seed error:', error);
    return res.status(500).json({ error: 'Bulk seed failed', message: error.message });
  }
});

// AI event diversification suggestions
router.post('/world/:showId/events/ai-fix', express.json({ limit: '2mb' }), optionalAuth, async (req, res) => {
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
      return `- "${ev.name}" (type: ${ev.event_type}, prestige: ${ev.prestige}, dress: ${ev.dress_code || 'none'})${ep ? ` -> Ep ${ep.episode_number}: ${ep.title}` : ' -> unlinked'}`;
    }).join('\n');

    const warningList = (warnings || []).slice(0, 10).map(w => `- ${w.msg || w}`).join('\n');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: `You are a TV show producer for "Before Lala", a memoir-style fashion reality show. You help diversify events across episodes to create compelling variety and narrative tension.

Return ONLY valid JSON - an array of suggestion objects.`,
      messages: [{
        role: 'user',
        content: `Here are the current story logic warnings for my events:

${warningList}

Here are all my events and their episode assignments:
${eventList}

For each warning, suggest a specific fix. Return a JSON array:
\`\`\`json
[
  {
    "warning": "the warning text",
    "suggestion": "what to change",
    "action": "swap_type" | "rename" | "change_prestige" | "reassign" | "merge_duplicates",
    "event_name": "which event to change",
    "new_value": "the suggested new value (new type, new name, new prestige number, etc.)"
  }
]
\`\`\`

Guidelines:
- For back-to-back same types: suggest changing one to a different event_type
- For duplicates: suggest renaming to be distinct or merging them
- For high prestige too early: suggest lowering prestige or swapping with a later episode
- Make events feel varied: mix intimate vs grand, casual vs formal, professional vs social
- Each suggestion should be specific and actionable`,
      }],
    });

    const text = response.content?.[0]?.text || '';
    let suggestions;
    try {
      const match = text.match(/\[[\s\S]*\]/);
      suggestions = match ? JSON.parse(match[0]) : [];
    } catch {
      suggestions = [{ warning: 'Parse error', suggestion: text.slice(0, 500), action: 'manual', event_name: '', new_value: '' }];
    }

    return res.json({ success: true, data: suggestions });
  } catch (err) {
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


// ═══════════════════════════════════════════════════════════════════════════════
// INVITATION GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/world/:showId/events/:eventId/generate-invitation', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: 'OPENAI_API_KEY not configured. Add it to your .env file.',
      });
    }

    console.log(`[InviteGen] Request for event: ${eventId}, show: ${showId}`);

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    const { generateInvitation } = require('../services/invitationGeneratorService');
    const result = await generateInvitation(eventId, models, showId);

    return res.json({
      success: true,
      message: `Invitation generated for "${result.eventName}"`,
      data: {
        assetId: result.asset.id,
        imageUrl: result.imageUrl,
        theme: result.theme,
        eventName: result.eventName,
      },
    });
  } catch (err) {
    console.error('[InviteGen] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/world/:showId/events/:eventId/invitation', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    const [event] = await models.sequelize.query(
      `SELECT e.id, e.name, e.invitation_asset_id,
              a.s3_url_processed as invitation_url, a.id as asset_id
       FROM world_events e
       LEFT JOIN assets a ON a.id = e.invitation_asset_id AND a.deleted_at IS NULL
       WHERE e.id = :eventId LIMIT 1`,
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );

    if (!event) return res.status(404).json({ error: 'Event not found' });

    return res.json({
      data: {
        hasInvitation: !!event.invitation_asset_id,
        assetId: event.asset_id,
        imageUrl: event.invitation_url,
        eventName: event.name,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── APPROVE INVITATION ─────────────────────────────────────────────────────

router.post('/world/:showId/events/:eventId/approve-invitation', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { assetId } = req.body;
    if (!assetId) return res.status(400).json({ error: 'assetId is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Mark asset as approved
    await models.sequelize.query(
      'UPDATE assets SET approval_status = :status, updated_at = NOW() WHERE id = :assetId',
      { replacements: { status: 'approved', assetId } }
    );

    // Link to event
    await models.sequelize.query(
      'UPDATE world_events SET invitation_asset_id = :assetId, updated_at = NOW() WHERE id = :eventId',
      { replacements: { assetId, eventId } }
    );

    return res.json({ success: true, message: 'Invitation approved and linked to event' });
  } catch (err) {
    console.error('[InviteGen] Approve error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── REJECT INVITATION ──────────────────────────────────────────────────────

router.post('/world/:showId/events/:eventId/reject-invitation', optionalAuth, async (req, res) => {
  try {
    const { assetId } = req.body;
    if (!assetId) return res.status(400).json({ error: 'assetId is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Soft-delete the rejected asset
    await models.sequelize.query(
      'UPDATE assets SET approval_status = :status, deleted_at = NOW(), updated_at = NOW() WHERE id = :assetId',
      { replacements: { status: 'rejected', assetId } }
    );

    return res.json({ success: true, message: 'Invitation rejected' });
  } catch (err) {
    console.error('[InviteGen] Reject error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── INVITATION VERSION HISTORY ───────────────────────────────────────────────

router.get('/world/:showId/events/:eventId/invitation-history', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    const versions = await models.sequelize.query(
      `SELECT id, name, s3_url_processed as image_url, approval_status,
              metadata->>'version' as version,
              metadata->>'theme' as theme,
              metadata->>'theme_source' as theme_source,
              metadata->>'composited' as composited,
              created_at
       FROM assets
       WHERE metadata->>'event_id' = :eventId
         AND asset_type = 'INVITATION_LETTER'
         AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );

    return res.json({ data: versions, count: versions.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── BATCH GENERATE INVITATIONS ───────────────────────────────────────────────

router.post('/world/:showId/events/batch-generate-invitations', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { eventIds } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OPENAI_API_KEY not configured' });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // If no specific IDs, get all events without invitations
    let targetIds = eventIds;
    if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
      const events = await models.sequelize.query(
        `SELECT id FROM world_events WHERE show_id = :showId AND invitation_asset_id IS NULL`,
        { replacements: { showId }, type: models.sequelize.QueryTypes.SELECT }
      );
      targetIds = events.map(e => e.id);
    }

    if (targetIds.length === 0) {
      return res.json({ success: true, message: 'No events need invitations', results: [] });
    }

    // Cap at 10 per batch to avoid runaway costs
    const capped = targetIds.slice(0, 10);

    console.log(`[InviteGen] Batch generating ${capped.length} invitations for show ${showId}`);

    // Generate sequentially (DALL-E rate limits)
    const { generateInvitation } = require('../services/invitationGeneratorService');
    const results = [];

    for (const id of capped) {
      try {
        const result = await generateInvitation(id, models, showId);
        results.push({ eventId: id, success: true, assetId: result.asset.id, imageUrl: result.imageUrl, version: result.version });
      } catch (err) {
        console.error(`[InviteGen] Batch failed for ${id}:`, err.message);
        results.push({ eventId: id, success: false, error: err.message });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    return res.json({
      success: true,
      message: `Generated ${succeeded}/${capped.length} invitations`,
      results,
      skipped: targetIds.length - capped.length,
    });
  } catch (err) {
    console.error('[InviteGen] Batch error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── PDF EXPORT ───────────────────────────────────────────────────────────────

router.get('/world/:showId/events/:eventId/invitation-pdf', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    const { exportInvitationPDF } = require('../services/invitationGeneratorService');
    const pdfBuffer = await exportInvitationPDF(eventId, models);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="invitation-${eventId}.png"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[InviteGen] PDF export error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── ANIMATED INVITATION (Runway image_to_video) ─────────────────────────────

router.post('/world/:showId/events/:eventId/animate-invitation', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!process.env.RUNWAY_ML_API_KEY) {
      return res.status(503).json({ error: 'RUNWAY_ML_API_KEY not configured' });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Get the approved invitation image
    const [event] = await models.sequelize.query(
      'SELECT invitation_asset_id FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!event?.invitation_asset_id) {
      return res.status(400).json({ error: 'No approved invitation to animate. Generate and approve one first.' });
    }

    const [asset] = await models.sequelize.query(
      'SELECT s3_url_processed FROM assets WHERE id = :id AND deleted_at IS NULL LIMIT 1',
      { replacements: { id: event.invitation_asset_id }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!asset?.s3_url_processed) {
      return res.status(404).json({ error: 'Invitation asset not found' });
    }

    // Use Runway image_to_video (same pattern as sceneGenerationService)
    const axios = require('axios');
    const RUNWAY_API_BASE = 'https://api.dev.runwayml.com/v1';

    const videoResponse = await axios.post(
      `${RUNWAY_API_BASE}/image_to_video`,
      {
        model: 'gen3a_turbo',
        promptText: 'The invitation card materializes with a soft golden shimmer. Subtle light particles drift upward. The card gently floats and settles. Warm ambient glow. No camera movement.',
        promptImage: asset.s3_url_processed,
        duration: 5,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.RUNWAY_ML_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Runway-Version': '2024-11-06',
        },
        timeout: 30000,
      }
    );

    const jobId = videoResponse.data.id;

    return res.json({
      success: true,
      message: 'Animation job queued — poll for completion',
      jobId,
      pollUrl: `/api/v1/world/${req.params.showId}/events/${eventId}/animate-invitation/${jobId}`,
    });
  } catch (err) {
    console.error('[InviteGen] Animation error:', err.response?.data || err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── POLL ANIMATION JOB ──────────────────────────────────────────────────────

router.get('/world/:showId/events/:eventId/animate-invitation/:jobId', optionalAuth, async (req, res) => {
  try {
    const { jobId } = req.params;

    const axios = require('axios');
    const response = await axios.get(
      `https://api.dev.runwayml.com/v1/tasks/${jobId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.RUNWAY_ML_API_KEY}`,
          'X-Runway-Version': '2024-11-06',
        },
        timeout: 15000,
      }
    );

    const task = response.data;

    if (task.status === 'SUCCEEDED') {
      const outputs = Array.isArray(task.output) ? task.output : [task.output];
      return res.json({ status: 'complete', videoUrl: outputs[0] });
    }
    if (task.status === 'FAILED') {
      return res.json({ status: 'failed', error: task.failure || 'Unknown failure' });
    }
    return res.json({ status: task.status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;


/**
 * World Events Routes — Event Library CRUD + Inject into Episode
 * 
 * GET    /api/v1/world/:showId/events          — List events
 * POST   /api/v1/world/:showId/events          — Create event
 * PUT    /api/v1/world/:showId/events/:eventId  — Update event
 * DELETE /api/v1/world/:showId/events/:eventId  — Delete event
 * POST   /api/v1/world/:showId/events/:eventId/inject — Inject event into episode script
 * POST   /api/v1/world/:showId/events/:eventId/generate-script — Generate full script skeleton
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

    let query = `SELECT * FROM world_events WHERE show_id = :showId`;
    const replacements = { showId };

    if (status) {
      query += ` AND status = :status`;
      replacements.status = status;
    }
    if (event_type) {
      query += ` AND event_type = :event_type`;
      replacements.event_type = event_type;
    }

    const validSorts = ['created_at', 'name', 'prestige', 'cost_coins', 'status'];
    const sortCol = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortCol} ${sortOrder}`;

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
      name, event_type = 'invite', host_brand, description,
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
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Event name is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    const id = uuidv4();
    await models.sequelize.query(
      `INSERT INTO world_events 
       (id, show_id, season_id, arc_id, name, event_type, host_brand, description,
        prestige, cost_coins, strictness, deadline_type, deadline_minutes,
        dress_code, dress_code_keywords, location_hint, narrative_stakes,
        canon_consequences, seeds_future_events,
        overlay_template, required_ui_overlays, browse_pool_bias, browse_pool_size,
        rewards, status, created_at, updated_at)
       VALUES
       (:id, :showId, :season_id, :arc_id, :name, :event_type, :host_brand, :description,
        :prestige, :cost_coins, :strictness, :deadline_type, :deadline_minutes,
        :dress_code, :dress_code_keywords, :location_hint, :narrative_stakes,
        :canon_consequences, :seeds_future_events,
        :overlay_template, :required_ui_overlays, :browse_pool_bias, :browse_pool_size,
        :rewards, 'draft', NOW(), NOW())`,
      {
        replacements: {
          id, showId,
          season_id: season_id || null,
          arc_id: arc_id || null,
          name, event_type,
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

router.put('/world/:showId/events/:eventId', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const updates = req.body;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Build dynamic SET clause
    const allowedFields = [
      'name', 'event_type', 'host_brand', 'description',
      'prestige', 'cost_coins', 'strictness',
      'deadline_type', 'deadline_minutes',
      'dress_code', 'dress_code_keywords',
      'location_hint', 'narrative_stakes', 'canon_consequences',
      'seeds_future_events', 'overlay_template', 'required_ui_overlays',
      'browse_pool_bias', 'browse_pool_size', 'rewards', 'status',
      'season_id', 'arc_id',
    ];

    const setClauses = [];
    const replacements = { showId, eventId };

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        const val = typeof updates[field] === 'object' ? JSON.stringify(updates[field]) : updates[field];
        setClauses.push(`${field} = :${field}`);
        replacements[field] = val;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
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


module.exports = router;

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

    // Use WorldEvent model if available, fall back to raw SQL
    if (models.WorldEvent) {
      const where = { show_id: showId };
      if (status) where.status = status;
      if (event_type) where.event_type = event_type;

      const validSorts = ['created_at', 'name', 'prestige', 'cost_coins', 'status'];
      const sortCol = validSorts.includes(sort) ? sort : 'created_at';
      const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const include = [];
      // Include invitation asset URL
      if (models.Asset) {
        include.push({
          model: models.Asset,
          as: 'invitationAsset',
          attributes: ['id', 's3_url_processed', 's3_url_raw'],
          required: false,
        });
      }
      // Include venue location
      if (models.WorldLocation) {
        include.push({
          model: models.WorldLocation,
          as: 'venue',
          attributes: ['id', 'name', 'street_address', 'city', 'district', 'venue_type', 'venue_details', 'location_type'],
          required: false,
        });
      }
      // Include scene set basic info
      if (models.SceneSet) {
        include.push({
          model: models.SceneSet,
          as: 'sceneSet',
          attributes: ['id', 'name', 'base_still_url', 'scene_type'],
          required: false,
        });
      }
      // Include source calendar event
      if (models.StoryCalendarEvent) {
        include.push({
          model: models.StoryCalendarEvent,
          as: 'sourceCalendarEvent',
          attributes: ['id', 'title', 'event_type', 'cultural_category', 'start_datetime'],
          required: false,
        });
      }

      const events = await models.WorldEvent.findAll({
        where,
        include,
        order: [[sortCol, sortOrder]],
      });

      // Map invitation_url for backward compatibility
      const mapped = events.map(e => {
        const json = e.toJSON();
        json.invitation_url = json.invitationAsset?.s3_url_processed || null;
        return json;
      });

      return res.json({ success: true, events: mapped });
    }

    // Fallback: raw SQL (original behavior)
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
    if (error.message?.includes('does not exist')) {
      return res.json({ success: true, events: [], note: 'Table not yet created. Run migrations.' });
    }
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
      // New venue fields (stored in event even pre-migration)
      venue_location_id, venue_name, venue_address, event_date, event_time,
      guest_list, invitation_details, scene_set_id,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Event name is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // If venue_location_id provided, auto-populate venue details from WorldLocation
    let resolvedVenueName = venue_name || null;
    let resolvedVenueAddress = venue_address || null;
    let resolvedSceneSetId = scene_set_id || null;
    if (venue_location_id && models.WorldLocation) {
      try {
        const venue = await models.WorldLocation.findByPk(venue_location_id);
        if (venue) {
          if (!resolvedVenueName) resolvedVenueName = venue.name;
          if (!resolvedVenueAddress) {
            const parts = [venue.street_address, venue.district, venue.city].filter(Boolean);
            resolvedVenueAddress = parts.length > 0 ? parts.join(', ') : null;
          }
          // Auto-link scene set from venue if not specified
          if (!resolvedSceneSetId && models.SceneSet) {
            const venueSceneSet = await models.SceneSet.findOne({
              where: { world_location_id: venue_location_id },
              attributes: ['id'],
            });
            if (venueSceneSet) resolvedSceneSetId = venueSceneSet.id;
          }
        }
      } catch { /* non-blocking */ }
    }

    if (models.WorldEvent) {
      const event = await models.WorldEvent.create({
        show_id: showId,
        season_id: season_id || null,
        arc_id: arc_id || null,
        name, event_type,
        host: host || null,
        host_brand: host_brand || null,
        description: description || null,
        prestige, cost_coins, strictness,
        deadline_type, deadline_minutes: deadline_minutes || null,
        dress_code: dress_code || null,
        dress_code_keywords,
        location_hint: location_hint || resolvedVenueAddress || null,
        narrative_stakes: narrative_stakes || null,
        canon_consequences, seeds_future_events,
        overlay_template, required_ui_overlays,
        browse_pool_bias, browse_pool_size,
        rewards,
        is_paid, payment_amount,
        requirements, career_tier,
        career_milestone: career_milestone || null,
        fail_consequence: fail_consequence || null,
        success_unlock: success_unlock || null,
        scene_set_id: resolvedSceneSetId,
        status: 'draft',
      });

      return res.status(201).json({ success: true, event: event.toJSON() });
    }

    // Fallback: raw SQL
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
        scene_set_id, status, created_at, updated_at)
       VALUES
      (:id, :showId, :season_id, :arc_id, :name, :event_type, :host, :host_brand, :description,
        :prestige, :cost_coins, :strictness, :deadline_type, :deadline_minutes,
        :dress_code, :dress_code_keywords, :location_hint, :narrative_stakes,
        :canon_consequences, :seeds_future_events,
        :overlay_template, :required_ui_overlays, :browse_pool_bias, :browse_pool_size,
        :rewards, :is_paid, :payment_amount, :requirements, :career_tier,
        :career_milestone, :fail_consequence, :success_unlock,
        :scene_set_id, 'draft', NOW(), NOW())`,
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
          location_hint: location_hint || resolvedVenueAddress || null,
          narrative_stakes: narrative_stakes || null,
          canon_consequences: JSON.stringify(canon_consequences),
          seeds_future_events: JSON.stringify(seeds_future_events),
          overlay_template,
          required_ui_overlays: JSON.stringify(required_ui_overlays),
          browse_pool_bias, browse_pool_size,
          rewards: JSON.stringify(rewards),
          is_paid, payment_amount,
          requirements: JSON.stringify(requirements),
          career_tier,
          career_milestone: career_milestone || null,
          fail_consequence: fail_consequence || null,
          success_unlock: success_unlock || null,
          scene_set_id: resolvedSceneSetId,
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
      'scene_set_id', 'source_calendar_event_id',
      'venue_location_id', 'venue_name', 'venue_address', 'event_date', 'event_time',
      'guest_list', 'invitation_details',
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

        if (field === 'scene_set_id' && val !== null) {
          if (typeof val !== 'string') {
            return res.status(400).json({
              error: 'Invalid value for scene_set_id',
              message: 'scene_set_id must be a UUID string or null',
            });
          }

          if (!models.SceneSet) {
            return res.status(500).json({
              error: 'SceneSet model not loaded',
              message: 'Unable to validate scene_set_id',
            });
          }

          const sceneSet = await models.SceneSet.findByPk(val, {
            attributes: ['id', 'show_id'],
          });

          if (!sceneSet) {
            return res.status(400).json({
              error: 'Invalid scene_set_id',
              message: 'Selected scene set does not exist. Please re-select a valid scene set.',
              code: 'INVALID_SCENE_SET_ID',
            });
          }

          if (sceneSet.show_id && sceneSet.show_id !== showId) {
            return res.status(400).json({
              error: 'Invalid scene_set_id for this show',
              message: 'Selected scene set belongs to a different show.',
              code: 'SCENE_SET_SHOW_MISMATCH',
            });
          }
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
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        error: 'Invalid scene_set_id',
        message: 'Selected scene set is not valid for this event.',
        code: 'INVALID_SCENE_SET_ID',
      });
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

    // If this event has an approved invitation, stamp the episode_id on the asset
    if (event.invitation_asset_id) {
      await models.sequelize.query(
        `UPDATE assets SET episode_id = :episodeId, asset_scope = 'EPISODE', updated_at = NOW()
         WHERE id = :assetId AND deleted_at IS NULL`,
        { replacements: { episodeId: episode_id, assetId: event.invitation_asset_id } }
      );
    }

    // Auto-link episode to event's scene set if the event has one
    let sceneSetLinked = false;
    if (event.scene_set_id) {
      try {
        // Link the scene set to this episode via scene_set_episodes junction table
        await models.sequelize.query(
          `INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, created_at, updated_at)
           VALUES (gen_random_uuid(), :sceneSetId, :episodeId, NOW(), NOW())
           ON CONFLICT (scene_set_id, episode_id) WHERE deleted_at IS NULL DO NOTHING`,
          { replacements: { sceneSetId: event.scene_set_id, episodeId: episode_id } }
        );
        sceneSetLinked = true;
      } catch (ssErr) {
        console.warn('Failed to auto-link scene set to episode:', ssErr.message);
      }
    }

    // Auto-match scene set from location_hint via world_locations if no scene_set_id
    if (!event.scene_set_id && event.location_hint) {
      try {
        const [matchingSets] = await models.sequelize.query(
          `SELECT ss.id FROM scene_sets ss
           JOIN world_locations wl ON wl.id = ss.world_location_id
           WHERE wl.name ILIKE :hint AND wl.deleted_at IS NULL AND ss.deleted_at IS NULL
           LIMIT 1`,
          { replacements: { hint: `%${event.location_hint.split(',')[0].trim()}%` } }
        );
        if (matchingSets.length > 0) {
          await models.sequelize.query(
            `UPDATE world_events SET scene_set_id = :ssId, updated_at = NOW() WHERE id = :eventId`,
            { replacements: { ssId: matchingSets[0].id, eventId } }
          );
          await models.sequelize.query(
            `INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, created_at, updated_at)
             VALUES (gen_random_uuid(), :sceneSetId, :episodeId, NOW(), NOW())
             ON CONFLICT (scene_set_id, episode_id) WHERE deleted_at IS NULL DO NOTHING`,
            { replacements: { sceneSetId: matchingSets[0].id, episodeId: episode_id } }
          );
          sceneSetLinked = true;
        }
      } catch (locErr) {
        console.warn('Failed to auto-match scene set from location:', locErr.message);
      }
    }

    return res.json({
      success: true,
      event_tag: eventTag,
      location_tag: locationTag || null,
      scene_set_linked: sceneSetLinked,
      episode_id,
      message: `Event "${event.name}" injected into episode script.${sceneSetLinked ? ' Scene set auto-linked.' : ''}`,
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

    // Look up which episode this event is linked to
    const [event] = await models.sequelize.query(
      'SELECT used_in_episode_id FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );
    const episodeId = event?.used_in_episode_id || null;

    // Mark asset as approved and stamp episode_id so it appears in the episode's Assets tab
    await models.sequelize.query(
      `UPDATE assets SET approval_status = :status, episode_id = :episodeId,
       asset_scope = CASE WHEN :episodeId IS NOT NULL THEN 'EPISODE' ELSE asset_scope END,
       updated_at = NOW() WHERE id = :assetId`,
      { replacements: { status: 'approved', assetId, episodeId } }
    );

    // Link to event
    await models.sequelize.query(
      'UPDATE world_events SET invitation_asset_id = :assetId, updated_at = NOW() WHERE id = :eventId',
      { replacements: { assetId, eventId } }
    );

    // Clear episode_id from all previous invitation assets for this event
    await models.sequelize.query(
      `UPDATE assets SET episode_id = NULL
       WHERE metadata->>'event_id' = :eventId
         AND id != :assetId
         AND deleted_at IS NULL`,
      { replacements: { eventId, assetId } }
    );

    return res.json({ success: true, message: 'Invitation approved and linked to event', episodeId });
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

// ── EDIT INVITATION TEXT (re-render without DALL-E) ──────────────────────────

router.post('/world/:showId/events/:eventId/edit-invitation-text', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { assetId, opening, body, closing } = req.body;

    if (!assetId) return res.status(400).json({ error: 'assetId is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    const [asset] = await models.sequelize.query(
      'SELECT * FROM assets WHERE id = :assetId AND deleted_at IS NULL LIMIT 1',
      { replacements: { assetId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const [event] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Download existing background
    const axios = require('axios');
    const bgResponse = await axios.get(asset.s3_url_raw || asset.s3_url_processed, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    const bgBuffer = Buffer.from(bgResponse.data);

    // Build custom content (skips Claude call)
    const customContent = {
      eventName:    event.name.split(' — ')[0].trim(),
      eventSubtitle: event.name.includes(' — ') ? event.name.split(' — ')[1].trim() : null,
      opening:  opening || '',
      body:     body    || '',
      closing:  closing || 'We look forward to your presence.',
      hostName:  event.host       || 'The Host',
      hostBrand: event.host_brand || '',
      prestige:  event.prestige   || 5,
    };

    // Re-composite with custom text
    const { compositeInvitation } = require('../services/invitationCompositingService');
    const finalBuffer = await compositeInvitation(bgBuffer, event, customContent);
    if (!finalBuffer) return res.status(500).json({ error: 'Compositing failed — fonts not available' });

    // Upload new version to S3
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const { v4: uuidv4 } = require('uuid');
    const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
    const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
    const s3 = new S3Client({ region: AWS_REGION });
    const s3Key = `invitations/${eventId}/${uuidv4()}-edited.png`;

    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: finalBuffer,
      ContentType: 'image/png',
      CacheControl: 'max-age=31536000',
    }));

    const newUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

    // Update asset record
    const metadata = typeof asset.metadata === 'string'
      ? JSON.parse(asset.metadata)
      : (asset.metadata || {});

    await models.sequelize.query(
      `UPDATE assets SET s3_url_processed = :url, metadata = :metadata, updated_at = NOW() WHERE id = :assetId`,
      {
        replacements: {
          url: newUrl,
          metadata: JSON.stringify({
            ...metadata,
            edited: true,
            edited_at: new Date().toISOString(),
            custom_text: { opening, body, closing },
          }),
          assetId,
        },
      }
    );

    return res.json({ success: true, imageUrl: newUrl, message: 'Invitation text updated and re-rendered.' });
  } catch (err) {
    console.error('[InviteEdit] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── UNLINK INVITATION FROM EPISODE ───────────────────────────────────────────

router.post('/world/:showId/events/:eventId/unlink-invitation', optionalAuth, async (req, res) => {
  try {
    const { assetId } = req.body;
    if (!assetId) return res.status(400).json({ error: 'assetId is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    await models.sequelize.query(
      'UPDATE assets SET episode_id = NULL, updated_at = NOW() WHERE id = :assetId',
      { replacements: { assetId } }
    );

    return res.json({ success: true, message: 'Invitation unlinked from episode. Asset remains in show library.' });
  } catch (err) {
    console.error('[InviteUnlink] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE INVITATION ASSET ──────────────────────────────────────────────────

router.delete('/world/:showId/events/:eventId/invitation/:assetId', optionalAuth, async (req, res) => {
  try {
    const { eventId, assetId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    const [asset] = await models.sequelize.query(
      'SELECT s3_url_processed, s3_url_raw FROM assets WHERE id = :assetId AND deleted_at IS NULL LIMIT 1',
      { replacements: { assetId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    // Delete from S3 (best effort)
    const s3Url = asset.s3_url_processed || asset.s3_url_raw;
    if (s3Url) {
      try {
        const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
        const s3Key = s3Url.split('.amazonaws.com/')[1];
        if (s3Key) {
          const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
          await s3.send(new DeleteObjectCommand({
            Bucket: process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET,
            Key: decodeURIComponent(s3Key),
          }));
        }
      } catch (s3Err) {
        console.warn('[InviteDelete] S3 cleanup failed (non-blocking):', s3Err.message);
      }
    }

    // Soft-delete the asset
    await models.sequelize.query(
      'UPDATE assets SET deleted_at = NOW(), episode_id = NULL WHERE id = :assetId',
      { replacements: { assetId } }
    );

    // Clear invitation_asset_id on event if this was the current one
    const [event] = await models.sequelize.query(
      'SELECT invitation_asset_id FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (event?.invitation_asset_id === assetId) {
      await models.sequelize.query(
        'UPDATE world_events SET invitation_asset_id = NULL, updated_at = NOW() WHERE id = :eventId',
        { replacements: { eventId } }
      );
    }

    return res.json({ success: true, message: 'Invitation deleted from system.' });
  } catch (err) {
    console.error('[InviteDelete] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;


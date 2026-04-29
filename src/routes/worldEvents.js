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
let requireAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
  requireAuth = authModule.requireAuth || authModule.authenticateToken || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
  requireAuth = (req, res, next) => next();
}
let aiRateLimiter;
try {
  aiRateLimiter = require('../middleware/aiRateLimiter').aiRateLimiter;
} catch {
  aiRateLimiter = (req, res, next) => next();
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
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Use WorldEvent model if available, fall back to raw SQL
    if (models.WorldEvent) {
      try {
        const where = { show_id: showId };
        if (status) where.status = status;
        if (event_type) where.event_type = event_type;

        const validSorts = ['created_at', 'name', 'prestige', 'cost_coins', 'status'];
        const sortCol = validSorts.includes(sort) ? sort : 'created_at';
        const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Try with includes, then without, then without paranoid
        let events;
        try {
          const include = [];
          if (models.Asset) include.push({ model: models.Asset, as: 'invitationAsset', attributes: ['id', 's3_url_processed', 's3_url_raw'], required: false });
          if (models.SceneSet) include.push({ model: models.SceneSet, as: 'sceneSet', attributes: ['id', 'name', 'base_still_url', 'scene_type'], required: false });
          events = await models.WorldEvent.findAll({ where, include, order: [[sortCol, sortOrder]] });
        } catch (includeErr) {
          console.warn('[WorldEvents] Includes failed, trying without:', includeErr.message);
          try {
            events = await models.WorldEvent.findAll({ where, order: [[sortCol, sortOrder]] });
          } catch (basicErr) {
            console.warn('[WorldEvents] Model query failed (paranoid/deleted_at?):', basicErr.message);
            events = null; // fall through to raw SQL
          }
        }

        if (events) {
          const mapped = events.map(e => {
            const json = e.toJSON();
            json.invitation_url = json.invitationAsset?.s3_url_processed || null;
            return json;
          });
          return res.json({ success: true, events: mapped });
        }
      } catch (modelErr) {
        console.warn('[WorldEvents] Model query failed, falling back to raw SQL:', modelErr.message);
      }
    }

    // Fallback: raw SQL
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
    return res.status(500).json({ success: false, error: 'Failed to load events', message: error.message });
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
      venue_location_id, venue_name, venue_address, event_date: _event_date, event_time: _event_time,
      guest_list: _guest_list, invitation_details: _invitation_details, scene_set_id,
    } = req.body;

    if (!name) return res.status(400).json({ success: false, error: 'Event name is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

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
    return res.status(500).json({ success: false, error: 'Failed to create event', message: error.message });
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
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

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
      // Episode linking — set/clear from the episode's event picker so
      // creators can link events to an episode without going through
      // the inject flow. Null clears the link.
      'used_in_episode_id',
      // Wardrobe — outfit picked at event creation flows through to any
      // episode the event is linked to.
      'outfit_set_id', 'outfit_pieces',
    ];
    const _requiredStringFields = new Set(['name', 'event_type', 'status']);

    const setClauses = [];
    const replacements = { showId, eventId };
    const integerFields = new Set([
      'prestige', 'cost_coins', 'strictness', 'deadline_minutes',
      'browse_pool_size', 'payment_amount', 'career_tier',
    ]);
    const uuidFields = new Set([
      'season_id', 'arc_id', 'scene_set_id', 'source_calendar_event_id',
      'venue_location_id', 'used_in_episode_id', 'outfit_set_id',
    ]);
    const scalarStringFields = new Set([
      'name', 'event_type', 'host', 'host_brand', 'description',
      'deadline_type', 'dress_code', 'location_hint', 'narrative_stakes',
      'overlay_template', 'browse_pool_bias', 'status',
      'career_milestone', 'fail_consequence', 'success_unlock',
      'venue_name', 'venue_address', 'event_date', 'event_time',
      'theme', 'mood', 'floral_style', 'border_style',
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

    const unwrapScalar = (value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (value.value !== undefined) return value.value;
        if (value.id !== undefined) return value.id;
      }
      return value;
    };

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        let val = normalizeNullLike(unwrapScalar(updates[field]));

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

        if (val !== null && (uuidFields.has(field) || scalarStringFields.has(field))) {
          if (typeof val !== 'string') {
            return res.status(400).json({
              error: `Invalid value for ${field}`,
              message: `${field} must be a string, UUID, or null`,
            });
          }
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
      return res.status(400).json({ success: false, error: 'No valid fields to update', received: Object.keys(updates) });
    }

    setClauses.push('updated_at = NOW()');

    // Try full update, if columns don't exist, retry without them
    try {
      await models.sequelize.query(
        `UPDATE world_events SET ${setClauses.join(', ')} WHERE id = :eventId AND show_id = :showId`,
        { replacements }
      );
    } catch (updateErr) {
      const errMsg = String(updateErr.message || '');
      if (errMsg.includes('does not exist') || errMsg.includes('column')) {
        // Extract which column is missing from error message
        const missingCol = errMsg.match(/column "([^"]+)"/)?.[1];
        console.warn(`[WorldEvents] Column missing: ${missingCol || 'unknown'} — retrying without it`);

        // Core fields that definitely exist on world_events (original table)
        const coreFields = new Set([
          'name', 'event_type', 'host', 'host_brand', 'description',
          'prestige', 'cost_coins', 'strictness', 'deadline_type',
          'dress_code', 'dress_code_keywords', 'location_hint',
          'narrative_stakes', 'canon_consequences', 'status',
          'browse_pool_bias', 'browse_pool_size', 'scene_set_id',
          'is_paid', 'payment_amount', 'career_tier',
          'career_milestone', 'fail_consequence', 'success_unlock',
          'updated_at',
        ]);

        // Stash venue/event fields into canon_consequences.automation if columns don't exist
        const venueFields = ['venue_name', 'venue_address', 'event_date', 'event_time', 'venue_location_id'];
        const stashedData = {};
        for (const vf of venueFields) {
          if (replacements[vf] !== undefined && replacements[vf] !== null) {
            stashedData[vf] = replacements[vf];
          }
        }

        if (Object.keys(stashedData).length > 0) {
          // Save venue data into canon_consequences.automation
          try {
            const [rows] = await models.sequelize.query(
              'SELECT canon_consequences FROM world_events WHERE id = :eventId LIMIT 1',
              { replacements: { eventId } }
            );
            const cc = typeof rows[0]?.canon_consequences === 'string'
              ? JSON.parse(rows[0].canon_consequences) : (rows[0]?.canon_consequences || {});
            cc.automation = { ...(cc.automation || {}), ...stashedData };

            await models.sequelize.query(
              `UPDATE world_events SET canon_consequences = :cc, updated_at = NOW() WHERE id = :eventId AND show_id = :showId`,
              { replacements: { cc: JSON.stringify(cc), eventId, showId } }
            );
            console.log(`[WorldEvents] Stashed ${Object.keys(stashedData).join(', ')} into canon_consequences.automation`);
          } catch (stashErr) {
            console.warn('[WorldEvents] Failed to stash venue data:', stashErr.message);
          }
        }

        // Retry with only core fields
        const coreClauses = setClauses.filter(c => {
          const field = c.split(' = ')[0].trim();
          return coreFields.has(field);
        });
        if (coreClauses.length > 1) {
          try {
            await models.sequelize.query(
              `UPDATE world_events SET ${coreClauses.join(', ')} WHERE id = :eventId AND show_id = :showId`,
              { replacements }
            );
          } catch (retryErr) {
            console.warn('[WorldEvents] Core-only retry also failed:', retryErr.message);
          }
        }
      } else {
        throw updateErr;
      }
    }

    const [updated] = await models.sequelize.query(
      `SELECT * FROM world_events WHERE id = :eventId`, { replacements: { eventId } }
    );

    return res.json({ success: true, event: updated[0] });
  } catch (error) {
    console.error('Update event error:', error);
    if (String(error.message || '').includes('does not exist')) {
      return res.status(400).json({ success: false, error: 'Invalid update field', message: error.message });
    }
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        error: 'Invalid scene_set_id',
        message: 'Selected scene set is not valid for this event.',
        code: 'INVALID_SCENE_SET_ID',
      });
    }
    return res.status(500).json({ success: false, error: 'Failed to update event', message: error.message });
  }
});


// ═══════════════════════════════════════════
// DELETE /api/v1/world/:showId/events/:eventId
// ═══════════════════════════════════════════

router.delete('/world/:showId/events/:eventId', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Soft-delete (paranoid mode) — try UPDATE first, hard delete as fallback
    try {
      await models.sequelize.query(
        `UPDATE world_events SET deleted_at = NOW() WHERE id = :eventId AND show_id = :showId`,
        { replacements: { showId, eventId } }
      );
    } catch {
      await models.sequelize.query(
        `DELETE FROM world_events WHERE id = :eventId AND show_id = :showId`,
        { replacements: { showId, eventId } }
      );
    }

    return res.json({ success: true, deleted: eventId });
  } catch (error) {
    console.error('Delete event error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete event', message: error.message });
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

    if (!episode_id) return res.status(400).json({ success: false, error: 'episode_id is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Get event
    const [events] = await models.sequelize.query(
      `SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId`,
      { replacements: { eventId, showId } }
    );

    if (!events || events.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const event = events[0];

    // Get episode
    const episode = await models.Episode.findByPk(episode_id);
    if (!episode) return res.status(404).json({ success: false, error: 'Episode not found' });

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

    // Mark event as used — try with times_used, fall back without
    try {
      await models.sequelize.query(
        `UPDATE world_events SET used_in_episode_id = :episodeId, times_used = COALESCE(times_used, 0) + 1, status = 'used', updated_at = NOW() WHERE id = :eventId`,
        { replacements: { episodeId: episode_id, eventId } }
      );
    } catch {
      await models.sequelize.query(
        `UPDATE world_events SET used_in_episode_id = :episodeId, status = 'used', updated_at = NOW() WHERE id = :eventId`,
        { replacements: { episodeId: episode_id, eventId } }
      );
    }

    // If this event has an approved invitation, stamp the episode_id on the asset
    if (event.invitation_asset_id) {
      try {
        await models.sequelize.query(
          `UPDATE assets SET episode_id = :episodeId, updated_at = NOW()
           WHERE id = :assetId AND deleted_at IS NULL`,
          { replacements: { episodeId: episode_id, assetId: event.invitation_asset_id } }
        );
      } catch { /* asset_scope/episode_id columns may not exist */ }
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
    return res.status(500).json({ success: false, error: 'Failed to inject event', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events/:eventId/generate-script
// Generate a full episode script skeleton from an event
// ═══════════════════════════════════════════

let scriptSkeletonGenerator;
try { scriptSkeletonGenerator = require('../utils/scriptSkeletonGenerator'); } catch (e) { scriptSkeletonGenerator = null; }

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
    const [events] = await models.sequelize.query(
      `SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId`,
      { replacements: { eventId, showId } }
    );
    if (!events || events.length === 0) return res.status(404).json({ success: false, error: 'Event not found' });
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
    return res.status(500).json({ success: false, error: 'Script generation failed', message: error.message });
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
      return res.status(400).json({ success: false, error: 'events array is required' });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

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
    return res.status(500).json({ success: false, error: 'Bulk seed failed', message: error.message });
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

    if (!process.env.FAL_KEY) {
      return res.status(503).json({
        error: 'FAL_KEY not configured. Add it to your .env file.',
      });
    }

    console.log(`[InviteGen] Request for event: ${eventId}, show: ${showId}`);

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

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
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/events/:eventId/invitation-text — Get editable invitation text
router.get('/world/:showId/events/:eventId/invitation-text', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const models = await getModels();
    const [event] = await models.sequelize.query(
      'SELECT canon_consequences FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    const cc = typeof event.canon_consequences === 'string' ? JSON.parse(event.canon_consequences) : event.canon_consequences;
    return res.json({ success: true, invitation_text: cc?.invitation_text || null });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/re-render-invitation — Re-render with edited text
router.post('/world/:showId/events/:eventId/re-render-invitation', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { invitation_text } = req.body;
    if (!invitation_text) return res.status(400).json({ success: false, error: 'invitation_text is required' });

    const models = await getModels();

    // Load event
    const [event] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Find the latest invitation asset to get the background
    const [asset] = await models.sequelize.query(
      `SELECT s3_url_raw FROM assets WHERE metadata->>'event_id' = :eventId AND asset_type = 'INVITATION_LETTER' ORDER BY created_at DESC LIMIT 1`,
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );

    if (!asset?.s3_url_raw) return res.status(400).json({ success: false, error: 'No existing invitation to re-render. Generate one first.' });

    // Download the background
    const axios = require('axios');
    const bgResponse = await axios.get(asset.s3_url_raw, { responseType: 'arraybuffer', timeout: 30000 });
    const bgBuffer = Buffer.from(bgResponse.data);

    // Re-composite with edited text
    const { compositeInvitation } = require('../services/invitationCompositingService');
    const composited = await compositeInvitation(bgBuffer, event, invitation_text);
    if (!composited) return res.status(500).json({ success: false, error: 'Re-render failed — fonts may not be available' });

    // Upload new version
    const { uploadToS3 } = require('../services/invitationGeneratorService');
    const s3Url = await uploadToS3(composited, eventId, 'edited');

    // Create new asset
    const { Asset } = models;
    let newAsset = null;
    if (Asset) {
      try {
        newAsset = await Asset.create({
          id: uuidv4(),
          name: `${event.name} — Invitation (edited)`,
          asset_type: 'INVITATION_LETTER',
          s3_url_raw: asset.s3_url_raw,
          s3_url_processed: s3Url,
          show_id: showId,
          metadata: { source: 'invitation-text-edit', event_id: eventId, edited_at: new Date().toISOString() },
        });
      } catch { /* non-blocking */ }
    }

    // Save edited text to event
    try {
      await models.sequelize.query(
        `UPDATE world_events SET canon_consequences = jsonb_set(
          COALESCE(canon_consequences, '{}'), '{invitation_text}', :textJson::jsonb
        ), updated_at = NOW() WHERE id = :eventId`,
        { replacements: { textJson: JSON.stringify(invitation_text), eventId } }
      );
    } catch { /* non-blocking */ }

    return res.json({ success: true, imageUrl: s3Url, assetId: newAsset?.id });
  } catch (err) {
    console.error('[InviteGen] Re-render error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/world/:showId/events/:eventId/invitation', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const [event] = await models.sequelize.query(
      `SELECT e.id, e.name, e.invitation_asset_id,
              a.s3_url_processed as invitation_url, a.id as asset_id
       FROM world_events e
       LEFT JOIN assets a ON a.id = e.invitation_asset_id AND a.deleted_at IS NULL
       WHERE e.id = :eventId LIMIT 1`,
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );

    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    return res.json({
      data: {
        hasInvitation: !!event.invitation_asset_id,
        assetId: event.asset_id,
        imageUrl: event.invitation_url,
        eventName: event.name,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── APPROVE INVITATION ─────────────────────────────────────────────────────

router.post('/world/:showId/events/:eventId/approve-invitation', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { assetId } = req.body;
    if (!assetId) return res.status(400).json({ success: false, error: 'assetId is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Look up which episode this event is linked to
    const [event] = await models.sequelize.query(
      'SELECT used_in_episode_id FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );
    const episodeId = event?.used_in_episode_id || null;

    // Mark asset as approved — try with optional columns, fall back to minimal
    try {
      await models.sequelize.query(
        `UPDATE assets SET approval_status = 'approved', episode_id = :episodeId, updated_at = NOW() WHERE id = :assetId`,
        { replacements: { assetId, episodeId } }
      );
    } catch {
      // approval_status/episode_id columns may not exist
      try {
        await models.sequelize.query(
          `UPDATE assets SET updated_at = NOW() WHERE id = :assetId`,
          { replacements: { assetId } }
        );
      } catch { /* non-blocking */ }
    }

    // Link to event
    await models.sequelize.query(
      'UPDATE world_events SET invitation_asset_id = :assetId, updated_at = NOW() WHERE id = :eventId',
      { replacements: { assetId, eventId } }
    );

    // Auto-create a TimelinePlacement so the invite is queued for the
    // video composer to render. Default: scene-start of the first
    // scene, 5s duration, overlay z-index. Idempotent — re-approving
    // the same invite won't pile up duplicate placements. Non-blocking
    // so a failure here doesn't fail the approval response.
    let placement = null;
    if (episodeId) {
      try {
        const { placeOverlayOnFirstScene } = require('../services/timelinePlacementService');
        placement = await placeOverlayOnFirstScene(models, {
          episodeId,
          assetId,
          defaults: {
            duration: 5,
            zIndex: 20,
            properties: { kind: 'invitation', source: 'approve-invitation' },
          },
        });
      } catch (placeErr) {
        console.warn('[approve-invitation] Placement skipped:', placeErr.message);
      }
    }

    return res.json({
      success: true,
      message: 'Invitation approved and linked to event',
      episodeId,
      placement_id: placement?.id || null,
    });
  } catch (err) {
    console.error('[InviteGen] Approve error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── REJECT INVITATION ──────────────────────────────────────────────────────

router.post('/world/:showId/events/:eventId/reject-invitation', optionalAuth, async (req, res) => {
  try {
    const { assetId } = req.body;
    if (!assetId) return res.status(400).json({ success: false, error: 'assetId is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Soft-delete the rejected asset — try with approval_status, fall back
    try {
      await models.sequelize.query(
        'UPDATE assets SET approval_status = :status, deleted_at = NOW(), updated_at = NOW() WHERE id = :assetId',
        { replacements: { status: 'rejected', assetId } }
      );
    } catch {
      await models.sequelize.query(
        'UPDATE assets SET deleted_at = NOW(), updated_at = NOW() WHERE id = :assetId',
        { replacements: { assetId } }
      );
    }

    return res.json({ success: true, message: 'Invitation rejected' });
  } catch (err) {
    console.error('[InviteGen] Reject error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── INVITATION VERSION HISTORY ───────────────────────────────────────────────

router.get('/world/:showId/events/:eventId/invitation-history', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

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
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── BATCH GENERATE INVITATIONS ───────────────────────────────────────────────

router.post('/world/:showId/events/batch-generate-invitations', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { eventIds } = req.body;

    if (!process.env.FAL_KEY) {
      return res.status(503).json({ success: false, error: 'FAL_KEY not configured. Add it to your .env file.' });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

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

    // Cap at 3 per batch to control image API costs
    const MAX_BATCH = parseInt(process.env.IMAGE_CALLS_PER_OPERATION) || 3;
    const capped = targetIds.slice(0, MAX_BATCH);

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
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── PDF EXPORT ───────────────────────────────────────────────────────────────

router.get('/world/:showId/events/:eventId/invitation-pdf', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const { exportInvitationPDF } = require('../services/invitationGeneratorService');
    const pdfBuffer = await exportInvitationPDF(eventId, models);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="invitation-${eventId}.png"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[InviteGen] PDF export error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── ANIMATED INVITATION (Runway image_to_video) ─────────────────────────────

router.post('/world/:showId/events/:eventId/animate-invitation', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!process.env.RUNWAY_ML_API_KEY) {
      return res.status(503).json({ success: false, error: 'RUNWAY_ML_API_KEY not configured' });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Get the approved invitation image
    const [event] = await models.sequelize.query(
      'SELECT invitation_asset_id FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!event?.invitation_asset_id) {
      return res.status(400).json({ success: false, error: 'No approved invitation to animate. Generate and approve one first.' });
    }

    const [asset] = await models.sequelize.query(
      'SELECT s3_url_processed FROM assets WHERE id = :id AND deleted_at IS NULL LIMIT 1',
      { replacements: { id: event.invitation_asset_id }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!asset?.s3_url_processed) {
      return res.status(404).json({ success: false, error: 'Invitation asset not found' });
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
    return res.status(500).json({ success: false, error: err.message });
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
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── EDIT INVITATION TEXT (re-render without DALL-E) ──────────────────────────

router.post('/world/:showId/events/:eventId/edit-invitation-text', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { assetId, opening, body, closing } = req.body;

    if (!assetId) return res.status(400).json({ success: false, error: 'assetId is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const [asset] = await models.sequelize.query(
      'SELECT * FROM assets WHERE id = :assetId AND deleted_at IS NULL LIMIT 1',
      { replacements: { assetId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

    const [event] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

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
    if (!finalBuffer) return res.status(500).json({ success: false, error: 'Compositing failed — fonts not available' });

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
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── UNLINK INVITATION FROM EPISODE ───────────────────────────────────────────

router.post('/world/:showId/events/:eventId/unlink-invitation', optionalAuth, async (req, res) => {
  try {
    const { assetId } = req.body;
    if (!assetId) return res.status(400).json({ success: false, error: 'assetId is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    await models.sequelize.query(
      'UPDATE assets SET episode_id = NULL, updated_at = NOW() WHERE id = :assetId',
      { replacements: { assetId } }
    );

    return res.json({ success: true, message: 'Invitation unlinked from episode. Asset remains in show library.' });
  } catch (err) {
    console.error('[InviteUnlink] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE INVITATION ASSET ──────────────────────────────────────────────────

router.delete('/world/:showId/events/:eventId/invitation/:assetId', optionalAuth, async (req, res) => {
  try {
    const { eventId, assetId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const [asset] = await models.sequelize.query(
      'SELECT s3_url_processed, s3_url_raw FROM assets WHERE id = :assetId AND deleted_at IS NULL LIMIT 1',
      { replacements: { assetId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

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
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /world/:showId/events/:eventId/generate-episode
// Auto-generate a complete episode from an event
// ═══════════════════════════════════════════════════════════════════════

router.post('/world/:showId/events/:eventId/generate-episode', optionalAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    // Optional: when draft_script is true, also kick the script skeleton
    // generator so the new episode has a starting script. Otherwise the
    // creator gets the title + beat outline only and writes the script
    // themselves later.
    const draftScript = !!(req.body && req.body.draft_script);
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Load event — use raw SQL to avoid model column mismatch with unmigrated DB
    let event;
    try {
      const [rows] = await models.sequelize.query(
        'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
        { replacements: { eventId, showId } }
      );
      event = rows?.[0];
    } catch {
      // Fallback to model if raw SQL fails
      if (models.WorldEvent) {
        event = await models.WorldEvent.findByPk(eventId);
        if (event) event = event.toJSON();
      }
    }
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Pull existing wardrobe items for financial calculation
    let wardrobeItems = [];
    try {
      const [rows] = await models.sequelize.query(
        `SELECT id, name, coin_cost, price, acquisition_type FROM wardrobe WHERE show_id = :showId AND deleted_at IS NULL`,
        { replacements: { showId } }
      );
      wardrobeItems = rows || [];
    } catch { /* wardrobe table may not exist yet */ }

    const episodeGenerator = require('../services/episodeGeneratorService');
    const result = await episodeGenerator.generateEpisodeFromEvent(event, models, {
      showId,
      wardrobeItems,
    });

    // Optional: drop in a script skeleton right after the episode lands.
    // Reuses the same skeleton generator as POST /generate-script, just
    // inlined so the creator doesn't need a second click. Failures are
    // non-fatal — the episode is already saved.
    let scriptDrafted = false;
    if (draftScript && result?.episode?.id) {
      try {
        const scriptSkeletonGenerator = require('../utils/scriptSkeletonGenerator');
        if (scriptSkeletonGenerator) {
          const skeleton = scriptSkeletonGenerator.generateScriptSkeleton(event, {
            includeNarration: true,
            includeAnimations: true,
          });
          if (skeleton && models.Episode) {
            await models.Episode.update(
              { script_content: skeleton },
              { where: { id: result.episode.id } }
            );
            scriptDrafted = true;
          }
        }
      } catch (scriptErr) {
        console.warn('[generate-episode] Script draft failed (non-fatal):', scriptErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      data: result,
      script_drafted: scriptDrafted,
      message: `Episode "${result.episode.title}" created with ${result.scenePlan.length} beats, ${result.socialTasks.length} social tasks${scriptDrafted ? ' + draft script' : ''}`,
    });
  } catch (error) {
    console.error('Generate episode error:', error.message, error.stack?.slice(0, 500));
    return res.status(500).json({ success: false, error: error.message, stack: error.stack?.slice(0, 500) });
  }
});

// POST /world/:showId/events/generate-episode-from-many
//
// Generate a single episode from multiple events. The first event in the
// list is the "anchor" — it drives title generation, outfit, and brief
// fields the way the single-event generator does. The remaining events
// are linked to the same episode via used_in_episode_id, so their
// locations, dress codes, narrative stakes, and outfits all show on the
// episode page through the existing read-through patterns.
//
// Body: { event_ids: [uuid, ...], draft_script?: bool }
router.post('/world/:showId/events/generate-episode-from-many', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId } = req.params;
    const { event_ids: eventIds = [], draft_script: draftScript = false } = req.body || {};
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ success: false, error: 'event_ids array required' });
    }
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Load every requested event in one query so we can validate up front.
    const [rows] = await models.sequelize.query(
      `SELECT * FROM world_events WHERE show_id = :showId AND id IN (:eventIds)`,
      { replacements: { showId, eventIds } }
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No matching events found' });
    }
    const eventsById = new Map(rows.map(r => [r.id, r]));
    // Order the events list to match the input order so the first ID is
    // the anchor regardless of DB return order.
    const ordered = eventIds.map(id => eventsById.get(id)).filter(Boolean);
    const anchor = ordered[0];
    const extras = ordered.slice(1);

    // Anchor must not already have an episode — same guard as the
    // single-event generator. Extras that are already linked to other
    // episodes are skipped with a warning.
    if (anchor.used_in_episode_id) {
      return res.status(409).json({
        success: false,
        error: 'The anchor event already has an episode. Regenerate it first to combine.',
      });
    }

    let wardrobeItems = [];
    try {
      const [w] = await models.sequelize.query(
        `SELECT id, name, coin_cost, price, acquisition_type FROM wardrobe WHERE show_id = :showId AND deleted_at IS NULL`,
        { replacements: { showId } }
      );
      wardrobeItems = w || [];
    } catch { /* wardrobe may not exist yet */ }

    const episodeGenerator = require('../services/episodeGeneratorService');
    const result = await episodeGenerator.generateEpisodeFromEvent(anchor, models, { showId, wardrobeItems });
    const newEpisodeId = result?.episode?.id;

    // Link the extra events to the same episode. Skip ones that already
    // link somewhere (they'd violate the partial unique index anyway).
    const linkedExtras = [];
    const skippedExtras = [];
    for (const ev of extras) {
      if (ev.used_in_episode_id) {
        skippedExtras.push({ id: ev.id, name: ev.name, reason: 'already linked elsewhere' });
        continue;
      }
      try {
        await models.sequelize.query(
          `UPDATE world_events SET used_in_episode_id = :episodeId, status = 'used', updated_at = NOW() WHERE id = :evId`,
          { replacements: { episodeId: newEpisodeId, evId: ev.id } }
        );
        linkedExtras.push({ id: ev.id, name: ev.name });
      } catch (linkErr) {
        skippedExtras.push({ id: ev.id, name: ev.name, reason: linkErr.message });
      }
    }

    let scriptDrafted = false;
    if (draftScript && newEpisodeId) {
      try {
        const scriptSkeletonGenerator = require('../utils/scriptSkeletonGenerator');
        if (scriptSkeletonGenerator) {
          const skeleton = scriptSkeletonGenerator.generateScriptSkeleton(anchor, {
            includeNarration: true,
            includeAnimations: true,
          });
          if (skeleton && models.Episode) {
            await models.Episode.update({ script_content: skeleton }, { where: { id: newEpisodeId } });
            scriptDrafted = true;
          }
        }
      } catch (scriptErr) {
        console.warn('[generate-from-many] Script draft failed (non-fatal):', scriptErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      data: result,
      anchor_event_id: anchor.id,
      linked_extras: linkedExtras,
      skipped_extras: skippedExtras,
      script_drafted: scriptDrafted,
      message: `Episode "${result.episode.title}" created from ${1 + linkedExtras.length} event${linkedExtras.length === 0 ? '' : 's'}${skippedExtras.length ? ` (${skippedExtras.length} skipped)` : ''}`,
    });
  } catch (error) {
    console.error('Multi-event generate error:', error.message, error.stack?.slice(0, 500));
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /world/:showId/events/:eventId/regenerate-episode
//
// Tear down the existing episode generated from this event and create a
// fresh one. Same generator service, but unblocks the "already used"
// guard by clearing used_in_episode_id + soft-deleting the previous
// episode first. Useful when the event has been edited (new outfit,
// stakes, etc.) and the creator wants the episode to reflect those
// changes without losing their place.
router.post('/world/:showId/events/:eventId/regenerate-episode', optionalAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Look up the previously-generated episode_id, if any.
    const [evRows] = await models.sequelize.query(
      'SELECT id, used_in_episode_id FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId } }
    );
    const event = evRows?.[0];
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    const oldEpisodeId = event.used_in_episode_id || null;
    if (oldEpisodeId) {
      // Soft-delete the previous episode (paranoid mode handles this) and
      // unhook the event so the generator's duplicate-guard passes. We
      // intentionally don't cascade-delete briefs / wardrobe / scene-plan
      // because Sequelize paranoid will mask them via the same deleted_at
      // and they'll be hidden from queries.
      await models.sequelize.query('UPDATE world_events SET used_in_episode_id = NULL WHERE id = :eventId', { replacements: { eventId } });
      await models.sequelize.query('UPDATE episodes SET deleted_at = NOW() WHERE id = :episodeId AND deleted_at IS NULL', { replacements: { episodeId: oldEpisodeId } });
    }

    // Re-fetch the event row in full so the generator gets every column.
    const [fullRows] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId } }
    );
    const fullEvent = fullRows?.[0];

    let wardrobeItems = [];
    try {
      const [rows] = await models.sequelize.query(
        `SELECT id, name, coin_cost, price, acquisition_type FROM wardrobe WHERE show_id = :showId AND deleted_at IS NULL`,
        { replacements: { showId } }
      );
      wardrobeItems = rows || [];
    } catch { /* wardrobe may not exist yet */ }

    const episodeGenerator = require('../services/episodeGeneratorService');
    const result = await episodeGenerator.generateEpisodeFromEvent(fullEvent, models, { showId, wardrobeItems });

    return res.status(201).json({
      success: true,
      data: result,
      replaced_episode_id: oldEpisodeId,
      message: `Episode regenerated. Previous episode${oldEpisodeId ? ' soft-deleted' : ' did not exist'}.`,
    });
  } catch (error) {
    console.error('Regenerate episode error:', error.message, error.stack?.slice(0, 500));
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /world/:showId/events/bulk-delete — Delete multiple events at once
router.post('/world/:showId/events/bulk-delete', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { ids, delete_all_drafts, delete_all } = req.body;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    let deleted = 0;
    if (delete_all) {
      // Delete ALL events for this show
      const [result] = await models.sequelize.query(
        'DELETE FROM world_events WHERE show_id = :showId',
        { replacements: { showId } }
      );
      deleted = result?.rowCount || 0;
    } else if (delete_all_drafts) {
      // Delete all draft events
      const [result] = await models.sequelize.query(
        "DELETE FROM world_events WHERE show_id = :showId AND status = 'draft'",
        { replacements: { showId } }
      );
      deleted = result?.rowCount || 0;
    } else if (ids && Array.isArray(ids)) {
      // Delete specific IDs
      for (const id of ids) {
        try {
          await models.sequelize.query(
            'DELETE FROM world_events WHERE id = :id AND show_id = :showId',
            { replacements: { id, showId } }
          );
          deleted++;
        } catch { /* skip */ }
      }
    }

    return res.json({ success: true, deleted });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/from-profile — Create event from a feed profile
router.post('/world/:showId/events/from-profile', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { profile_id, event_template } = req.body;
    const models = await getModels();
    if (!models?.SocialProfile) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const profile = await models.SocialProfile.findByPk(profile_id, {
      attributes: ['id', 'handle', 'display_name', 'content_category', 'archetype', 'follower_tier', 'brand_partnerships', 'registry_character_id', 'lala_relevance_score', 'aesthetic_dna'],
    });
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    const p = profile.toJSON();
    const prestige = p.follower_tier === 'mega' ? 8 : p.follower_tier === 'macro' ? 6 : p.follower_tier === 'mid' ? 4 : 3;

    // Find venue
    const eventAutomation = require('../services/eventAutomationService');
    const fakeCalEvent = { cultural_category: p.content_category || 'creator_economy' };
    let venue = await eventAutomation.findVenue(fakeCalEvent, models);

    // Auto-create venue in WorldLocations if none exists
    if (!venue) {
      try {
        venue = await eventAutomation.ensureVenueLocation(
          `${p.display_name || p.handle}'s Venue`,
          null,
          p.content_category,
          models
        );
      } catch { /* non-blocking */ }
    }
    const venueAddress = venue ? [venue.street_address, venue.district, venue.city].filter(Boolean).join(', ') : null;

    // Assemble guest list
    let guestList = [];
    try {
      guestList = await eventAutomation.assembleGuestList(profile, fakeCalEvent, models, 6);
    } catch { /* non-blocking */ }

    // Derive fields from prestige/profile
    const costCoins = prestige >= 8 ? 500 : prestige >= 6 ? 300 : prestige >= 4 ? 150 : 50;
    const strictness = Math.min(10, prestige + Math.floor(Math.random() * 2));
    const deadlineType = prestige >= 8 ? 'urgent' : prestige >= 5 ? 'medium' : 'low';
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 7 + Math.floor(Math.random() * 14));
    const hostBrand = p.brand_partnerships?.[0]?.brand || null;

    // Category-aware dress code defaults
    const CATEGORY_DRESS_CODES = {
      fashion: 'runway-ready', beauty: 'glam chic', lifestyle: 'smart casual',
      fitness: 'athleisure luxe', food: 'cocktail', music: 'streetwear elevated',
      creator_economy: 'influencer chic', drama: 'camera-ready',
    };
    const dressCode = CATEGORY_DRESS_CODES[(p.content_category || '').toLowerCase()] || 'chic';
    const eventDateStr = eventDate.toISOString().split('T')[0];
    const eventTimeStr = prestige >= 7 ? '20:00' : prestige >= 4 ? '19:00' : '18:00';

    // Invitation style derived from archetype + category + aesthetic_dna
    const ARCHETYPE_STYLES = {
      polished_curator:  { theme: 'refined editorial', mood: 'curated, intentional, elevated', color_palette: ['ivory', 'charcoal', 'gold leaf'], floral_style: 'single stem arrangement', border_style: 'embossed letterpress' },
      messy_transparent: { theme: 'raw authentic', mood: 'unfiltered, confessional, real', color_palette: ['kraft brown', 'black ink', 'off-white'], floral_style: 'wildflowers, imperfect', border_style: 'torn edge, handwritten' },
      soft_life:         { theme: 'dreamy luxury', mood: 'serene, aspirational, soft', color_palette: ['lavender', 'champagne', 'cloud white'], floral_style: 'cascading peonies', border_style: 'watercolor wash' },
      explicitly_paid:   { theme: 'brand flex', mood: 'unapologetic, bold, sponsored', color_palette: ['hot pink', 'gold', 'white'], floral_style: 'none — logo placement', border_style: 'metallic foil' },
      overnight_rise:    { theme: 'viral moment', mood: 'electric, urgent, now', color_palette: ['neon green', 'black', 'chrome'], floral_style: 'none', border_style: 'glitch effect' },
      cautionary:        { theme: 'faded glamour', mood: 'nostalgic, bittersweet, warning', color_palette: ['dusty rose', 'faded gold', 'grey'], floral_style: 'dried flowers', border_style: 'vintage distressed' },
      the_peer:          { theme: 'inclusive warmth', mood: 'welcoming, relatable, cozy', color_palette: ['warm terracotta', 'cream', 'sage'], floral_style: 'garden flowers', border_style: 'rounded, friendly' },
      the_watcher:       { theme: 'mysterious observer', mood: 'understated, knowing, quiet power', color_palette: ['slate', 'navy', 'silver'], floral_style: 'single dark bloom', border_style: 'thin precise line' },
      chaos_creator:     { theme: 'controlled chaos', mood: 'unpredictable, provocative, memorable', color_palette: ['electric red', 'acid yellow', 'black'], floral_style: 'none — graffiti texture', border_style: 'ripped, asymmetric' },
      community_builder: { theme: 'gathering place', mood: 'collective, warm, purposeful', color_palette: ['sunset orange', 'deep teal', 'cream'], floral_style: 'abundant mixed arrangements', border_style: 'woven pattern' },
    };
    const CATEGORY_STYLE_TWEAKS = {
      fashion:   { mood_add: 'fashion-forward', floral_tweak: 'fashion show florals' },
      beauty:    { mood_add: 'luminous', floral_tweak: 'rose and peony' },
      lifestyle: { mood_add: 'aspirational living', floral_tweak: 'eucalyptus accent' },
      music:     { mood_add: 'rhythmic energy', color_swap: ['deep purple'] },
      food:      { mood_add: 'indulgent', floral_tweak: 'herbs and citrus' },
      drama:     { mood_add: 'tension-filled', color_swap: ['crimson'] },
    };

    const archStyle = ARCHETYPE_STYLES[p.archetype] || ARCHETYPE_STYLES.polished_curator;
    const catTweak = CATEGORY_STYLE_TWEAKS[(p.content_category || '').toLowerCase()] || {};
    const aestheticDna = p.aesthetic_dna || {};

    // Merge: archetype base + category tweaks + profile aesthetic DNA
    const invStyle = {
      theme: aestheticDna.visual_style || archStyle.theme,
      mood: [archStyle.mood, catTweak.mood_add].filter(Boolean).join(', '),
      color_palette: aestheticDna.color_palette?.length > 0
        ? aestheticDna.color_palette
        : (catTweak.color_swap ? [...archStyle.color_palette.slice(0, -1), ...catTweak.color_swap] : archStyle.color_palette),
      floral_style: catTweak.floral_tweak || archStyle.floral_style,
      border_style: archStyle.border_style,
    };
    const descriptionText = `${p.display_name || p.handle} is hosting an exclusive ${p.content_category || 'creator'} event${venue ? ` at ${venue.name}` : ''}. ${guestList.length > 0 ? `${guestList.length} guests on the list.` : ''}`;
    const narrativeText = `This event could ${prestige >= 6 ? 'elevate' : 'establish'} Lala's position in the ${p.content_category || 'creator'} scene. ${hostBrand ? `Brand opportunity with ${hostBrand}.` : ''}`;

    const eventData = {
      show_id: showId,
      name: event_template ? `${p.display_name || p.handle}'s ${event_template}` : `${p.display_name || p.handle} Hosts`,
      event_type: 'invite',
      host: p.display_name || p.handle,
      host_brand: hostBrand,
      source_profile_id: p.id,
      prestige,
      cost_coins: costCoins,
      strictness,
      deadline_type: deadlineType,
      dress_code: dressCode,
      location_hint: venueAddress || null,
      // Top-level FK to the WorldLocation. Without this, the venue only
      // lives nested in canon_consequences.automation and Overview's
      // Locations card (which reads venue_location_id directly off the
      // event row) shows nothing for feed-profile-spawned events.
      venue_location_id: venue?.id || null,
      venue_name: venue?.name || null,
      venue_address: venueAddress || null,
      event_date: eventDateStr,
      event_time: eventTimeStr,
      description: descriptionText,
      narrative_stakes: narrativeText,
      theme: invStyle.theme,
      mood: invStyle.mood,
      color_palette: invStyle.color_palette,
      floral_style: invStyle.floral_style,
      border_style: invStyle.border_style,
      dress_code_keywords: dressCode.split(/[,\s]+/).filter(Boolean),
      canon_consequences: {
        automation: {
          host_profile_id: p.id,
          host_handle: p.handle,
          host_display_name: p.display_name,
          host_registry_character_id: p.registry_character_id,
          host_brand: hostBrand,
          venue_location_id: venue?.id,
          venue_name: venue?.name,
          venue_address: venueAddress,
          guest_profiles: guestList,
          event_date: eventDateStr,
          event_time: eventTimeStr,
          cost_coins: costCoins,
          strictness,
          deadline_type: deadlineType,
          dress_code: dressCode,
          description: descriptionText,
          narrative_stakes: narrativeText,
          theme: invStyle.theme,
          mood: invStyle.mood,
          color_palette: invStyle.color_palette,
          floral_style: invStyle.floral_style,
          border_style: invStyle.border_style,
          dress_code_keywords: dressCode.split(/[,\s]+/).filter(Boolean),
          // Follow psychology — drives Lala's emotional arc in episodes
          follow_motivation: p.follow_motivation || null,
          follow_emotion: p.follow_emotion || null,
          follow_trigger: p.follow_trigger || null,
          event_excitement: p.event_excitement || 5,
          lifestyle_claim: p.lifestyle_claim || null,
          lifestyle_reality: p.lifestyle_reality || null,
          lifestyle_gap: p.lifestyle_gap || null,
          beauty_factor: p.beauty_factor || 0,
          beauty_description: p.beauty_description || null,
          aesthetic_power: p.aesthetic_power || null,
          content_category: p.content_category || null,
          // Auto-generated social tasks
          social_tasks: (() => {
            try {
              const { buildSocialTasks } = require('../services/episodeGeneratorService');
              return buildSocialTasks('invite', { platform: 'instagram', content_category: p.content_category || 'creator_economy' });
            } catch { return []; }
          })(),
        },
      },
      status: 'draft',
    };

    let event;
    try {
      if (models.WorldEvent) {
        event = await models.WorldEvent.create(eventData);
      }
    } catch (createErr) {
      console.warn('WorldEvent.create failed, using raw SQL:', createErr.message);
      event = null;
    }

    if (!event) {
      const { v4: uuidv4 } = require('uuid');
      eventData.id = uuidv4();
      // Try full insert first, then minimal fallback
      try {
        await models.sequelize.query(
          `INSERT INTO world_events (id, show_id, name, event_type, host, host_brand, prestige, cost_coins,
           strictness, deadline_type, dress_code, description, narrative_stakes, location_hint, venue_name,
           venue_address, event_date, event_time, canon_consequences, status, created_at, updated_at)
           VALUES (:id, :show_id, :name, :event_type, :host, :host_brand, :prestige, :cost_coins,
           :strictness, :deadline_type, :dress_code, :description, :narrative_stakes, :location_hint, :venue_name,
           :venue_address, :event_date, :event_time, :canon_consequences, 'draft', NOW(), NOW())`,
          { replacements: { ...eventData, canon_consequences: JSON.stringify(eventData.canon_consequences) } }
        );
      } catch (sqlErr) {
        console.warn('Full SQL insert failed, trying minimal:', sqlErr.message);
        // Minimal fallback — only guaranteed columns
        try {
          await models.sequelize.query(
            `INSERT INTO world_events (id, show_id, name, event_type, host, description, prestige, location_hint, canon_consequences, status, created_at, updated_at)
             VALUES (:id, :show_id, :name, :event_type, :host, :description, :prestige, :location_hint, :canon_consequences, 'draft', NOW(), NOW())`,
            { replacements: {
              id: eventData.id, show_id: showId, name: eventData.name,
              event_type: eventData.event_type, host: eventData.host,
              description: eventData.description, prestige: eventData.prestige,
              location_hint: eventData.location_hint,
              canon_consequences: JSON.stringify(eventData.canon_consequences),
            } }
          );
        } catch (minErr) {
          return res.status(500).json({ success: false, error: `Event creation failed: ${minErr.message}` });
        }
      }
      event = eventData;
    }

    res.status(201).json({ success: true, event: event.toJSON ? event.toJSON() : event });
  } catch (err) {
    console.error('POST /world/:showId/events/from-profile error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── FINANCIAL PRESSURE ENDPOINTS ────────────────────────────────────────────

// GET /world/:showId/events/:eventId/affordability — Can Lala afford this event?
router.get('/world/:showId/events/:eventId/affordability', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();

    // Load event
    const [event] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Get Lala's current balance
    let balance = 500; // default
    try {
      const [state] = await models.sequelize.query(
        `SELECT state_json FROM character_state_history WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1`,
        { replacements: { showId }, type: models.sequelize.QueryTypes.SELECT }
      );
      const stateJson = typeof state?.state_json === 'string' ? JSON.parse(state.state_json) : state?.state_json;
      balance = stateJson?.coins ?? 500;
    } catch { /* use default */ }

    const { checkAffordability } = require('../services/financialPressureService');
    const result = checkAffordability(event, balance);

    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/decline — Decline event and track as missed opportunity
router.post('/world/:showId/events/:eventId/decline', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { reason } = req.body;
    const models = await getModels();

    const [event] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    if (typeof event.canon_consequences === 'string') {
      try { event.canon_consequences = JSON.parse(event.canon_consequences); } catch { event.canon_consequences = {}; }
    }

    const { recordDeclinedInvite } = require('../services/financialPressureService');
    const declined = await recordDeclinedInvite(event, reason || 'not specified', models);

    return res.json({ success: true, declined, message: `"${event.name}" declined — tracked for future callbacks` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/financial-pressure — Get financial pressure context for script writing
router.get('/world/:showId/financial-pressure', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const models = await getModels();

    // Get Lala's balance
    let balance = 500;
    try {
      const [state] = await models.sequelize.query(
        `SELECT state_json FROM character_state_history WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1`,
        { replacements: { showId }, type: models.sequelize.QueryTypes.SELECT }
      );
      const stateJson = typeof state?.state_json === 'string' ? JSON.parse(state.state_json) : state?.state_json;
      balance = stateJson?.coins ?? 500;
    } catch { /* use default */ }

    // Get declined invites
    let declinedInvites = [];
    try {
      const [rows] = await models.sequelize.query(
        `SELECT name, canon_consequences FROM world_events WHERE show_id = :showId AND status = 'declined' AND deleted_at IS NULL`,
        { replacements: { showId } }
      );
      declinedInvites = rows.map(r => {
        const cc = typeof r.canon_consequences === 'string' ? JSON.parse(r.canon_consequences) : r.canon_consequences;
        return cc?.declined || { event_name: r.name };
      });
    } catch { /* table may not have status=declined */ }

    // Get pending opportunities
    let pendingOpps = [];
    try {
      const [rows] = await models.sequelize.query(
        `SELECT name, status, payment_amount FROM opportunities WHERE show_id = :showId AND deleted_at IS NULL AND status IN ('booked','preparing','active','completed')`,
        { replacements: { showId } }
      );
      pendingOpps = rows;
    } catch { /* table may not exist */ }

    // Get recent transactions (from episode financials)
    let transactions = [];
    try {
      const [rows] = await models.sequelize.query(
        `SELECT total_income, total_expenses, title FROM episodes WHERE show_id = :showId AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`,
        { replacements: { showId } }
      );
      transactions = rows.flatMap(r => [
        ...(parseFloat(r.total_income) > 0 ? [{ type: 'income', amount: parseFloat(r.total_income), source: r.title }] : []),
        ...(parseFloat(r.total_expenses) > 0 ? [{ type: 'expense', amount: parseFloat(r.total_expenses), source: r.title }] : []),
      ]);
    } catch { /* columns may not exist */ }

    const { buildFinancialPressureContext } = require('../services/financialPressureService');
    const context = buildFinancialPressureContext(balance, transactions, declinedInvites, pendingOpps);

    return res.json({ success: true, ...context });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/events/:eventId/financial-forecast
// Real-coin forecast for the event's financial impact. Replaces the static
// tier-table estimate that previously lived inline in WorldAdmin's Financial
// Preview card. Sources are honest about where each number came from:
//
//   income   = event_payment  + social_task_rewards + content_revenue_est
//   expenses = event_cost     + outfit_retail (owned) + outfit_rentals
//                             + drinks_est + valet_est + photo_booth_est
//
// If no outfit is picked, outfit_retail falls back to a prestige-tiered
// estimate so the UI isn't blank on a fresh event. The Show's live balance
// + goal ladder are included so the frontend can render a single combined
// "can she afford this, and does this push her toward her next goal" view.
router.get('/world/:showId/events/:eventId/financial-forecast', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Event row — raw SQL to tolerate unmigrated columns on older envs.
    let event = null;
    try {
      const [eventRows] = await models.sequelize.query(
        `SELECT id, name, prestige, event_type, cost_coins, is_paid, is_free, payment_amount,
                outfit_pieces, canon_consequences, dress_code
         FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1`,
        { replacements: { eventId, showId } }
      );
      event = eventRows?.[0] || null;
    } catch (err) {
      if (err?.original?.code !== '42703' && !String(err?.message || '').includes('is_free')) throw err;
      const [fallbackRows] = await models.sequelize.query(
        `SELECT id, name, prestige, event_type, cost_coins, is_paid, payment_amount,
                outfit_pieces, canon_consequences, dress_code
         FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1`,
        { replacements: { eventId, showId } }
      );
      event = fallbackRows?.[0] ? {
        ...fallbackRows[0],
        is_free: fallbackRows[0].is_paid === 'free',
      } : null;
    }
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    const prestige = Number(event.prestige) || 5;
    const outfitPieces = (() => {
      if (!event.outfit_pieces) return [];
      if (Array.isArray(event.outfit_pieces)) return event.outfit_pieces;
      try { return JSON.parse(event.outfit_pieces); } catch { return []; }
    })();
    const automation = (() => {
      if (!event.canon_consequences) return {};
      if (typeof event.canon_consequences === 'object') return event.canon_consequences.automation || {};
      try { return JSON.parse(event.canon_consequences)?.automation || {}; } catch { return {}; }
    })();

    const {
      USD_TO_COINS, EVENT_EXTRAS, RENTAL_RATE,
    } = require('../utils/financialRates');
    const {
      getCurrentBalance, getFinancialGoals, calculateSocialTaskRewards,
    } = require('../services/financialTransactionService');

    // ── Outfit costs ────────────────────────────────────────────────
    // Real data when an outfit has been picked; otherwise a prestige-tier
    // fallback so a fresh event still shows a plausible number. Rentals +
    // borrowed items cost a fraction of retail (RENTAL_RATE).
    let outfitRetail = 0;
    let outfitRentals = 0;
    let outfitSource = 'none';
    if (outfitPieces.length > 0) {
      outfitSource = 'actual';
      for (const p of outfitPieces) {
        const price = (parseFloat(p.price) || 0) * USD_TO_COINS;
        if (p.acquisition_type === 'rented' || p.acquisition_type === 'borrowed') {
          outfitRentals += Math.round(price * RENTAL_RATE);
        } else {
          outfitRetail += Math.round(price);
        }
      }
    } else {
      outfitSource = 'estimate';
      outfitRetail = prestige >= 8 ? 8000 : prestige >= 6 ? 3500 : prestige >= 4 ? 1200 : 400;
    }

    // ── Event extras (drinks / valet / photo booth) ──────────────────
    const drinks = EVENT_EXTRAS.drinks(prestige);
    const valet = EVENT_EXTRAS.valet(prestige);
    // Photo booth only fires on events where it makes narrative sense —
    // galas, premieres, launch parties. Detected from event_type or the
    // dress code mentioning "red carpet".
    const photoBoothPrompt = (event.dress_code || '').toLowerCase();
    const wantsPhotoBooth = ['gala', 'premiere', 'launch', 'brand_deal'].includes(event.event_type)
      || photoBoothPrompt.includes('red carpet') || photoBoothPrompt.includes('photo');
    const photoBooth = wantsPhotoBooth ? EVENT_EXTRAS.photo_booth(prestige) : 0;

    const truthy = new Set([true, 1, '1', 'true', 'yes', 'y']);
    const isPaid = truthy.has(event.is_paid);
    const isFree = truthy.has(event.is_free);
    const eventCost = isFree ? 0 : (isPaid ? 0 : (Number(event.cost_coins) || 0));

    // ── Income side ─────────────────────────────────────────────────
    const eventPayment = isPaid ? (parseFloat(event.payment_amount) || 0) : 0;
    const socialTasks = Array.isArray(automation.social_tasks) ? automation.social_tasks : [];
    const taskRewards = calculateSocialTaskRewards(socialTasks);
    const socialTaskRewards = taskRewards.reduce((s, t) => s + (t.reward || 0), 0);
    // Content bonus uses the same rule as finalize-financials: brand deals
    // get a 10% post-delivery bonus on top of event payment.
    const contentRevenueEst = (event.event_type === 'brand_deal' && eventPayment > 0)
      ? Math.round(eventPayment * 0.1)
      : 0;

    const income = {
      event_payment: eventPayment,
      social_task_rewards: socialTaskRewards,
      content_revenue_est: contentRevenueEst,
      total: eventPayment + socialTaskRewards + contentRevenueEst,
    };
    const expenses = {
      event_cost: eventCost,
      outfit_retail: outfitRetail,
      outfit_rentals: outfitRentals,
      drinks_est: drinks,
      valet_est: valet,
      photo_booth_est: photoBooth,
      total: eventCost + outfitRetail + outfitRentals + drinks + valet + photoBooth,
    };
    const net = income.total - expenses.total;

    // ── Balance + milestones ────────────────────────────────────────
    const [balance, goals] = await Promise.all([
      getCurrentBalance(models.sequelize, showId),
      getFinancialGoals(models.sequelize, showId),
    ]);
    const balanceAfter = balance + net;
    const sortedGoals = [...goals].sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
    const nextGoal = sortedGoals.find(g => !g.triggered_at) || null;
    // Pressure tiers drive feed tone + Lala mood downstream. "high" = event
    // would drop her below 25% of the next-goal threshold; "medium" = below
    // 50%; "low" = above. Falls back to flat "ok" when no goal ladder is set.
    const affordability = {
      can_afford: balanceAfter >= 0,
      balance_before: balance,
      balance_after: balanceAfter,
      pressure: !nextGoal ? 'ok'
        : balanceAfter < nextGoal.threshold * 0.25 ? 'high'
        : balanceAfter < nextGoal.threshold * 0.5  ? 'medium'
        : 'low',
    };

    return res.json({
      success: true,
      currency: 'coins',
      event: { id: event.id, name: event.name, prestige, event_type: event.event_type },
      income,
      expenses,
      net,
      affordability,
      next_goal: nextGoal,
      outfit_source: outfitSource,
      outfit_piece_count: outfitPieces.length,
    });
  } catch (err) {
    console.error('[financial-forecast] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/generate-venue — Generate venue exterior + interior images
// Body: { force?: boolean } — when `force` is true the endpoint regenerates
// even if the event already has a scene_set_id attached. Otherwise it skips
// and returns the existing scene set so the "Mark Ready" flow doesn't clobber
// a venue the user deliberately picked.
router.post('/world/:showId/events/:eventId/generate-venue', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const force = req.body?.force === true;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Load event via raw SQL
    const [rows] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId } }
    );
    const event = rows?.[0];
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Skip-and-return when a scene set is already attached. Hydrate a minimal
    // result payload so the caller gets consistent shape (scene_set_id +
    // images) whether we generated or skipped. This is what prevents the
    // "Mark Ready" button from regenerating venue images every time the
    // creator revisits an event that already has one.
    if (event.scene_set_id && !force) {
      let existing = null;
      if (models.SceneSet) {
        try {
          existing = await models.SceneSet.findByPk(event.scene_set_id, {
            attributes: ['id', 'name', 'base_still_url', 'canonical_description'],
          });
        } catch { /* non-blocking */ }
      }
      return res.json({
        success: true,
        skipped: true,
        data: {
          scene_set_id: event.scene_set_id,
          venue_image_url: existing?.base_still_url || null,
          venue_name: existing?.name || null,
          reason: 'scene_set already attached — pass { force: true } to regenerate',
        },
        message: `Venue already attached to "${event.name}" — skipped regeneration`,
      });
    }

    if (typeof event.canon_consequences === 'string') {
      try { event.canon_consequences = JSON.parse(event.canon_consequences); } catch { event.canon_consequences = {}; }
    }
    if (!process.env.FAL_KEY) {
      return res.status(503).json({ success: false, error: 'FAL_KEY not configured. Add it to your .env file.' });
    }

    event.show_id = showId;

    const { generateVenueImages } = require('../services/venueGenerationService');
    const result = await generateVenueImages(event, models);

    return res.json({
      success: true,
      data: result,
      message: `Venue images generated for "${event.name}" — scene set created`,
    });
  } catch (err) {
    console.error('[VenueGen] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/generate-social-checklist
router.post('/world/:showId/events/:eventId/generate-social-checklist', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const force = req.body?.force === true;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Load event — raw SQL first (model may have unmigrated columns)
    let event;
    try {
      const [rows] = await models.sequelize.query(
        'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
        { replacements: { eventId, showId } }
      );
      event = rows?.[0];
    } catch {
      if (models.WorldEvent) {
        try {
          event = await models.WorldEvent.findByPk(eventId);
          if (event) event = event.toJSON();
        } catch { /* model query failed too */ }
      }
    }
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Parse canon_consequences if string
    if (typeof event.canon_consequences === 'string') {
      try { event.canon_consequences = JSON.parse(event.canon_consequences); } catch { event.canon_consequences = {}; }
    }

    const socialChecklistService = require('../services/socialChecklistService');
    const result = await socialChecklistService.generateSocialChecklist(event, models, { forceRebuild: force });

    return res.json({
      success: true,
      data: result,
      message: `${force ? 'Social tasks regenerated' : 'Social checklist generated'} with ${result.tasks.length} tasks`,
    });
  } catch (error) {
    console.error('Generate social checklist error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// OUTFIT PICKER — select wardrobe pieces for event + score the outfit
// ═══════════════════════════════════════════════════════════════════════

// GET /world/:showId/events/:eventId/outfit — get current outfit + score
router.get('/world/:showId/events/:eventId/outfit', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();

    const [rows] = await models.sequelize.query(
      'SELECT outfit_pieces, outfit_score, name, prestige, event_type, host_brand, dress_code FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId } }
    );
    const event = rows?.[0];
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    const pieces = typeof event.outfit_pieces === 'string' ? JSON.parse(event.outfit_pieces) : (event.outfit_pieces || []);
    const score = typeof event.outfit_score === 'string' ? JSON.parse(event.outfit_score) : (event.outfit_score || null);

    return res.json({ success: true, pieces, score, event: { name: event.name, prestige: event.prestige, dress_code: event.dress_code } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /world/:showId/events/:eventId/outfit — save selected outfit pieces + auto-score
router.put('/world/:showId/events/:eventId/outfit', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { wardrobe_ids } = req.body;
    const models = await getModels();

    if (!wardrobe_ids || !Array.isArray(wardrobe_ids)) {
      return res.status(400).json({ success: false, error: 'wardrobe_ids array required' });
    }

    // Load event
    const [eventRows] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId } }
    );
    const event = eventRows?.[0];
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Load wardrobe items
    const [items] = await models.sequelize.query(
      `SELECT id, name, clothing_category, brand, tier, price, color, is_owned,
              acquisition_type, aesthetic_tags, event_types, occasion, season, era_alignment,
              s3_url, s3_url_processed, times_worn, last_worn_date
       FROM wardrobe WHERE id IN (:ids) AND deleted_at IS NULL`,
      { replacements: { ids: wardrobe_ids.length > 0 ? wardrobe_ids : ['00000000-0000-0000-0000-000000000000'] } }
    );

    // Build outfit pieces snapshot
    const outfitPieces = items.map(i => ({
      id: i.id, name: i.name, category: i.clothing_category, brand: i.brand,
      tier: i.tier, price: parseFloat(i.price) || 0, color: i.color,
      is_owned: i.is_owned, acquisition_type: i.acquisition_type,
      image_url: i.s3_url_processed || i.s3_url,
    }));

    // Score the outfit. Pull show-level `required_slots` off the Show's
    // metadata JSON so events on shows that demand a full 5-slot outfit
    // (fragrance + jewelry + accessories) light up the missing-required
    // treatment in the per-slot breakdown. Falls back to the scorer's
    // default (outfit + shoes required) when the show doesn't set it.
    const { scoreOutfitForEvent, detectRepeats, getBrandRelationships, generateOutfitReactionTriggers } = require('../services/wardrobeIntelligenceService');
    let scoringEvent = event;
    try {
      if (models.Show) {
        const show = await models.Show.findByPk(showId, { attributes: ['metadata'] });
        const required = show?.metadata?.required_slots;
        if (Array.isArray(required) && required.length > 0) {
          scoringEvent = { ...event, required_slots: required };
        }
      }
    } catch (e) {
      console.warn('[Outfit] Could not read show required_slots:', e.message);
    }
    const outfitScore = scoreOutfitForEvent(items, scoringEvent);
    const repeats = await detectRepeats(items, showId, models, { currentEventId: eventId });
    const brandRels = await getBrandRelationships(showId, models);
    const feedTriggers = generateOutfitReactionTriggers(outfitScore, repeats, brandRels);

    const fullScore = {
      ...outfitScore,
      repeats: repeats.map(r => ({ name: r.name, times_worn: r.times_worn, narrative: r.narrative })),
      feed_triggers: feedTriggers,
      brand_loyalty: brandRels.filter(b => outfitPieces.some(p => p.brand === b.brand)),
    };

    // Save to event
    await models.sequelize.query(
      `UPDATE world_events SET outfit_pieces = :pieces, outfit_score = :score, updated_at = NOW() WHERE id = :eventId`,
      { replacements: { pieces: JSON.stringify(outfitPieces), score: JSON.stringify(fullScore), eventId } }
    );

    return res.json({ success: true, pieces: outfitPieces, score: fullScore });
  } catch (err) {
    console.error('[Outfit] Save error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/events/:eventId/wardrobe-options — all closet pieces with match info
router.get('/world/:showId/events/:eventId/wardrobe-options', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();

    // Load event
    const [eventRows] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId } }
    );
    const event = eventRows?.[0];
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Load all wardrobe items for this show
    const [items] = await models.sequelize.query(
      `SELECT id, name, clothing_category, brand, tier, price, color, is_owned,
              acquisition_type, aesthetic_tags, event_types, occasion, season,
              s3_url, s3_url_processed, times_worn, last_worn_date, coin_cost
       FROM wardrobe WHERE (show_id = :showId OR show_id IS NULL) AND deleted_at IS NULL
       ORDER BY tier DESC, name ASC`,
      { replacements: { showId } }
    );

    // Keep recommendation scoring context aligned with outfit-save scoring.
    let scoringEvent = event;
    try {
      if (models.Show) {
        const show = await models.Show.findByPk(showId, { attributes: ['metadata'] });
        const required = show?.metadata?.required_slots;
        if (Array.isArray(required) && required.length > 0) {
          scoringEvent = { ...event, required_slots: required };
        }
      }
    } catch (e) {
      console.warn('[Outfit] Could not read show required_slots for options:', e.message);
    }

    // Score each item individually against the event
    const { scorePieceForEvent } = require('../services/wardrobeIntelligenceService');
    const scored = items.map(item => {
      const singleScore = scorePieceForEvent(item, scoringEvent);
      return {
        ...item,
        image_url: item.s3_url_processed || item.s3_url,
        event_match: singleScore?.match_score || 50,
        event_signals: singleScore?.signals || [],
        narrative_mood: singleScore?.narrative_mood || 'neutral',
      };
    });

    // Sort by match score descending
    scored.sort((a, b) => b.event_match - a.event_match);

    return res.json({ success: true, items: scored, total: scored.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/events/:eventId/feed-activity — get post-event feed posts
router.get('/world/:showId/events/:eventId/feed-activity', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const models = await getModels();

    let event;
    if (models.WorldEvent) {
      event = await models.WorldEvent.findByPk(eventId, { attributes: ['id', 'name', 'canon_consequences'] });
    }
    if (!event) {
      const [rows] = await models.sequelize.query('SELECT id, name, canon_consequences FROM world_events WHERE id = :id', { replacements: { id: eventId } });
      event = rows?.[0];
    }
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    const cc = typeof event.canon_consequences === 'string' ? JSON.parse(event.canon_consequences) : (event.canon_consequences || {});
    const posts = cc.feed_activity || [];

    // If no posts yet, generate them
    if (posts.length === 0 && cc.automation) {
      try {
        const feedActivity = require('../services/feedActivityService');
        const generated = await feedActivity.generatePostEventActivity(
          { ...event, canon_consequences: cc },
          models
        );
        return res.json({ success: true, posts: generated, generated: true });
      } catch { /* fall through */ }
    }

    return res.json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// OVERLAY APPROVAL WORKFLOW — generate → preview → edit → approve/reject
// Supports: wardrobe (UI.OVERLAY.WARDROBE_LIST), social (UI.OVERLAY.SOCIAL_TASKS)
// ═══════════════════════════════════════════════════════════════════════

// POST /world/:showId/events/:eventId/generate-overlay/:overlayType
router.post('/world/:showId/events/:eventId/generate-overlay/:overlayType', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId, overlayType } = req.params;
    const models = req.app?.get?.('models') || require('../models');
    const { sequelize } = models;

    // Load event (include outfit_pieces for wardrobe list)
    const [event] = await sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId }, type: sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    if (typeof event.canon_consequences === 'string') {
      try { event.canon_consequences = JSON.parse(event.canon_consequences); } catch { event.canon_consequences = {}; }
    }

    // Parse outfit_pieces if stored
    let outfitPieces = event.outfit_pieces;
    if (typeof outfitPieces === 'string') {
      try { outfitPieces = JSON.parse(outfitPieces); } catch { outfitPieces = []; }
    }
    if (!Array.isArray(outfitPieces)) outfitPieces = [];

    const { v4: uuidv4 } = require('uuid');
    let tasks, buffer, assetUrl, assetRole, assetName, listType;

    if (overlayType === 'wardrobe') {
      const { renderTodoAsset } = require('../services/todoListService');

      if (outfitPieces.length > 0) {
        // Build tasks from actual selected wardrobe items
        tasks = outfitPieces.map((piece, i) => ({
          slot: piece.category || piece.clothing_category || 'item',
          label: piece.name || `${piece.category || 'Outfit piece'}`,
          description: [piece.brand, piece.tier ? `${piece.tier} tier` : null, piece.color].filter(Boolean).join(' · ') || 'Selected for this event',
          required: ['dress', 'shoes', 'top', 'bottom'].includes(piece.category || piece.clothing_category),
          completed: !!piece.is_owned,
          order: i + 1,
          wardrobe_id: piece.id,
          image_url: piece.image_url || piece.s3_url_processed || piece.s3_url,
          price: piece.price || 0,
        }));
      } else {
        // No outfit selected — generate AI tasks from event context
        const { generateTasks } = require('../services/todoListService');
        tasks = await generateTasks(event);
      }

      buffer = renderTodoAsset(tasks, event, { listType: 'wardrobe' });
      assetRole = 'UI.OVERLAY.WARDROBE_LIST';
      assetName = `${event.name} — Wardrobe List`;
      listType = 'wardrobe';
    } else if (overlayType === 'social') {
      const socialChecklistService = require('../services/socialChecklistService');
      // Get tasks from existing or generate new
      let socialTasks = event.canon_consequences?.automation?.social_tasks || [];
      if (!Array.isArray(socialTasks) || socialTasks.length === 0) {
        try {
          const { buildSocialTasks } = require('../services/episodeGeneratorService');
          const auto = event.canon_consequences?.automation || {};
          let hostProfile = null;
          if (auto.host_profile_id) {
            const [rows] = await sequelize.query(
              'SELECT platform, content_category, archetype FROM social_profiles WHERE id = :id LIMIT 1',
              { replacements: { id: auto.host_profile_id } }
            );
            hostProfile = rows?.[0] || null;
          }
          socialTasks = buildSocialTasks(event.event_type || 'invite', hostProfile, outfitPieces);
        } catch { socialTasks = []; }
      }
      tasks = socialTasks;
      buffer = socialChecklistService.renderSocialChecklist(tasks, event);
      assetRole = 'UI.OVERLAY.SOCIAL_TASKS';
      assetName = `${event.name} — Social Tasks`;
      listType = 'social';
    } else {
      return res.status(400).json({ success: false, error: 'Invalid overlay type. Use "wardrobe" or "social".' });
    }

    // Upload to S3
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
    const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
    const s3 = new S3Client({ region: AWS_REGION });
    const s3Key = `overlays/${eventId}/${overlayType}-${uuidv4()}.png`;

    if (S3_BUCKET && buffer) {
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET, Key: s3Key, Body: buffer,
        ContentType: 'image/png', CacheControl: 'max-age=31536000',
      }));
      assetUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
    }

    // Count existing versions
    let version = 1;
    try {
      const [versionRows] = await sequelize.query(
        `SELECT COUNT(*) as cnt FROM assets WHERE metadata->>'event_id' = :eventId AND asset_role = :assetRole AND deleted_at IS NULL`,
        { replacements: { eventId, assetRole } }
      );
      version = (parseInt(versionRows?.[0]?.cnt) || 0) + 1;
    } catch (vErr) { console.warn('[OverlayGen] Version count error:', vErr.message); }

    // Create Asset — raw SQL to avoid missing column errors
    const assetId = uuidv4();
    const metadataObj = {
      source: `${listType}-overlay-generator`,
      list_type: listType,
      event_id: eventId,
      event_name: event.name,
      task_count: tasks.length,
      version,
      tasks: JSON.stringify(tasks),
      has_outfit_pieces: outfitPieces.length > 0,
      generated_at: new Date().toISOString(),
    };

    try {
      // Try with approval_status first
      await sequelize.query(
        `INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, purpose, category, entity_type,
         s3_url_raw, s3_url_processed, show_id, episode_id, approval_status, metadata, created_at, updated_at)
         VALUES (:id, :name, :assetType, :assetRole, 'EPISODE', 'SHOW', 'MAIN', 'overlay', 'prop',
         :url, :url, :showId, :episodeId, 'pending_review', :metadata, NOW(), NOW())`,
        { replacements: {
          id: assetId, name: assetName, assetType: overlayType === 'wardrobe' ? 'TODO_LIST' : 'SOCIAL_CHECKLIST',
          assetRole, url: assetUrl, showId, episodeId: event.used_in_episode_id || null,
          metadata: JSON.stringify(metadataObj),
        }}
      );
    } catch (assetErr) {
      // Fallback: insert without approval_status column
      console.warn('[OverlayGen] Asset insert with approval_status failed, retrying without:', assetErr.message);
      await sequelize.query(
        `INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, purpose, category, entity_type,
         s3_url_raw, s3_url_processed, show_id, episode_id, metadata, created_at, updated_at)
         VALUES (:id, :name, :assetType, :assetRole, 'EPISODE', 'SHOW', 'MAIN', 'overlay', 'prop',
         :url, :url, :showId, :episodeId, :metadata, NOW(), NOW())`,
        { replacements: {
          id: assetId, name: assetName, assetType: overlayType === 'wardrobe' ? 'TODO_LIST' : 'SOCIAL_CHECKLIST',
          assetRole, url: assetUrl, showId, episodeId: event.used_in_episode_id || null,
          metadata: JSON.stringify(metadataObj),
        }}
      );
    }

    return res.json({
      success: true,
      data: { assetId, imageUrl: assetUrl, tasks, version, hasOutfitPieces: outfitPieces.length > 0 },
      message: outfitPieces.length > 0
        ? `Wardrobe list generated from ${outfitPieces.length} selected pieces — pending approval`
        : `${overlayType} overlay generated — pending approval`,
    });
  } catch (err) {
    console.error(`[OverlayGen] ${req.params.overlayType} error:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/approve-overlay
router.post('/world/:showId/events/:eventId/approve-overlay', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { assetId } = req.body;
    if (!assetId) return res.status(400).json({ success: false, error: 'assetId required' });

    const models = req.app?.get?.('models') || require('../models');
    const { sequelize } = models;

    // Load event to get episode link
    const [event] = await sequelize.query(
      'SELECT id, used_in_episode_id, canon_consequences FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId }, type: sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Load asset
    const [asset] = await sequelize.query(
      'SELECT id, asset_role, s3_url_processed, metadata FROM assets WHERE id = :assetId AND deleted_at IS NULL LIMIT 1',
      { replacements: { assetId }, type: sequelize.QueryTypes.SELECT }
    );
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

    const meta = typeof asset.metadata === 'string' ? JSON.parse(asset.metadata) : (asset.metadata || {});

    // Update asset: approved + link to episode (handle missing approval_status column)
    try {
      await sequelize.query(
        `UPDATE assets SET approval_status = 'approved', asset_scope = 'EPISODE',
         episode_id = :episodeId, updated_at = NOW() WHERE id = :assetId`,
        { replacements: { assetId, episodeId: event.used_in_episode_id || null } }
      );
    } catch {
      await sequelize.query(
        `UPDATE assets SET asset_scope = 'EPISODE', episode_id = :episodeId, updated_at = NOW() WHERE id = :assetId`,
        { replacements: { assetId, episodeId: event.used_in_episode_id || null } }
      );
    }

    // Store reference on event canon_consequences
    if (typeof event.canon_consequences === 'string') {
      try { event.canon_consequences = JSON.parse(event.canon_consequences); } catch { event.canon_consequences = {}; }
    }
    const auto = event.canon_consequences?.automation || {};
    if (asset.asset_role === 'UI.OVERLAY.WARDROBE_LIST') {
      auto.wardrobe_overlay_asset_id = assetId;
      auto.wardrobe_overlay_url = asset.s3_url_processed;
      if (meta.tasks) auto.wardrobe_tasks = typeof meta.tasks === 'string' ? JSON.parse(meta.tasks) : meta.tasks;
    } else if (asset.asset_role === 'UI.OVERLAY.SOCIAL_TASKS') {
      auto.social_checklist_asset_id = assetId;
      auto.social_checklist_url = asset.s3_url_processed;
      if (meta.tasks) auto.social_tasks = typeof meta.tasks === 'string' ? JSON.parse(meta.tasks) : meta.tasks;
    }

    await sequelize.query(
      'UPDATE world_events SET canon_consequences = :cc, updated_at = NOW() WHERE id = :id',
      { replacements: { cc: JSON.stringify({ ...event.canon_consequences, automation: auto }), id: eventId } }
    );

    // If linked to episode, upsert episode_todo_lists for wardrobe
    if (event.used_in_episode_id && asset.asset_role === 'UI.OVERLAY.WARDROBE_LIST') {
      try {
        const tasks = meta.tasks ? (typeof meta.tasks === 'string' ? JSON.parse(meta.tasks) : meta.tasks) : [];
        const [existing] = await sequelize.query(
          'SELECT id FROM episode_todo_lists WHERE episode_id = :episodeId LIMIT 1',
          { replacements: { episodeId: event.used_in_episode_id }, type: sequelize.QueryTypes.SELECT }
        );
        if (existing) {
          await sequelize.query(
            `UPDATE episode_todo_lists SET tasks = :tasks, asset_id = :assetId, asset_url = :assetUrl, event_id = :eventId, status = 'generated', updated_at = NOW() WHERE episode_id = :episodeId`,
            { replacements: { tasks: JSON.stringify(tasks), assetId, assetUrl: asset.s3_url_processed, eventId, episodeId: event.used_in_episode_id } }
          );
        } else {
          const { v4: uuidv4 } = require('uuid');
          await sequelize.query(
            `INSERT INTO episode_todo_lists (id, episode_id, show_id, event_id, tasks, asset_id, asset_url, status, generated_by, created_at, updated_at)
             VALUES (:id, :episodeId, :showId, :eventId, :tasks, :assetId, :assetUrl, 'generated', 'ai', NOW(), NOW())`,
            { replacements: { id: uuidv4(), episodeId: event.used_in_episode_id, showId, eventId, tasks: JSON.stringify(tasks), assetId, assetUrl: asset.s3_url_processed } }
          );
        }
      } catch (err) { console.warn('[OverlayApprove] episode_todo_lists upsert error:', err.message); }
    }

    return res.json({ success: true, message: 'Overlay approved', episodeId: event.used_in_episode_id });
  } catch (err) {
    console.error('[OverlayApprove] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/reject-overlay
router.post('/world/:showId/events/:eventId/reject-overlay', optionalAuth, async (req, res) => {
  try {
    const { assetId } = req.body;
    if (!assetId) return res.status(400).json({ success: false, error: 'assetId required' });

    const models = req.app?.get?.('models') || require('../models');
    try {
      await models.sequelize.query(
        `UPDATE assets SET approval_status = 'rejected', deleted_at = NOW(), updated_at = NOW() WHERE id = :assetId`,
        { replacements: { assetId } }
      );
    } catch {
      await models.sequelize.query(
        `UPDATE assets SET deleted_at = NOW(), updated_at = NOW() WHERE id = :assetId`,
        { replacements: { assetId } }
      );
    }

    return res.json({ success: true, message: 'Overlay rejected' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/re-render-overlay
router.post('/world/:showId/events/:eventId/re-render-overlay', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { tasks, overlayType } = req.body;
    if (!tasks || !Array.isArray(tasks)) return res.status(400).json({ success: false, error: 'tasks array required' });
    if (!overlayType) return res.status(400).json({ success: false, error: 'overlayType required' });

    const models = req.app?.get?.('models') || require('../models');
    const { sequelize } = models;

    // Load event for context
    const [event] = await sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId }, type: sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Re-render with edited tasks
    let buffer;
    if (overlayType === 'wardrobe') {
      const { renderTodoAsset } = require('../services/todoListService');
      buffer = renderTodoAsset(tasks, event, { listType: 'wardrobe' });
    } else if (overlayType === 'social') {
      const { renderSocialChecklist } = require('../services/socialChecklistService');
      buffer = renderSocialChecklist(tasks, event);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid overlayType' });
    }

    // Upload re-rendered PNG
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const { v4: uuidv4 } = require('uuid');
    const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
    const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
    const s3 = new S3Client({ region: AWS_REGION });
    const s3Key = `overlays/${eventId}/${overlayType}-rerender-${uuidv4()}.png`;

    let imageUrl = null;
    if (S3_BUCKET && buffer) {
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET, Key: s3Key, Body: buffer,
        ContentType: 'image/png', CacheControl: 'max-age=31536000',
      }));
      imageUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
    }

    // Persist re-rendered asset to DB so it appears in history and survives refresh
    const assetId = uuidv4();
    const assetRole = overlayType === 'wardrobe' ? 'UI.OVERLAY.WARDROBE_LIST' : 'UI.OVERLAY.SOCIAL_TASKS';
    try {
      await sequelize.query(
        `INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, purpose, category, entity_type,
         s3_url_raw, s3_url_processed, show_id, episode_id, metadata, created_at, updated_at)
         VALUES (:id, :name, :assetType, :assetRole, 'EPISODE', 'SHOW', 'MAIN', 'overlay', 'prop',
         :url, :url, :showId, :episodeId, :metadata, NOW(), NOW())`,
        { replacements: {
          id: assetId,
          name: `${event.name} — ${overlayType === 'wardrobe' ? 'Wardrobe List' : 'Social Tasks'} (edited)`,
          assetType: overlayType === 'wardrobe' ? 'TODO_LIST' : 'SOCIAL_CHECKLIST',
          assetRole, url: imageUrl, showId, episodeId: event.used_in_episode_id || null,
          metadata: JSON.stringify({
            source: `${overlayType}-overlay-rerender`,
            list_type: overlayType === 'wardrobe' ? 'wardrobe' : 'social',
            event_id: eventId, event_name: event.name,
            task_count: tasks.length, tasks: JSON.stringify(tasks),
            rerendered: true, generated_at: new Date().toISOString(),
          }),
        }}
      );
    } catch (err) { console.warn('[OverlayRerender] Asset persist failed (non-blocking):', err.message); }

    return res.json({ success: true, imageUrl, assetId, message: 'Overlay re-rendered with edited tasks' });
  } catch (err) {
    console.error('[OverlayRerender] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/events/:eventId/overlay-tasks/:overlayType
router.get('/world/:showId/events/:eventId/overlay-tasks/:overlayType', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId, overlayType } = req.params;
    const models = req.app?.get?.('models') || require('../models');
    const { sequelize } = models;

    const assetRole = overlayType === 'wardrobe' ? 'UI.OVERLAY.WARDROBE_LIST' : 'UI.OVERLAY.SOCIAL_TASKS';

    // Find most recent asset for this overlay type
    const [asset] = await sequelize.query(
      `SELECT metadata FROM assets WHERE metadata->>'event_id' = :eventId AND asset_role = :assetRole AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      { replacements: { eventId, assetRole }, type: sequelize.QueryTypes.SELECT }
    );

    if (asset) {
      const meta = typeof asset.metadata === 'string' ? JSON.parse(asset.metadata) : (asset.metadata || {});
      let tasks = meta.tasks;
      if (typeof tasks === 'string') tasks = JSON.parse(tasks);
      if (tasks) return res.json({ success: true, tasks });
    }

    // Fallback: load from event canon_consequences
    const [event] = await sequelize.query(
      'SELECT canon_consequences FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId }, type: sequelize.QueryTypes.SELECT }
    );
    if (event) {
      let cc = event.canon_consequences;
      if (typeof cc === 'string') try { cc = JSON.parse(cc); } catch { cc = {}; }
      const auto = cc?.automation || {};
      const fallbackTasks = overlayType === 'wardrobe' ? auto.wardrobe_tasks : auto.social_tasks;
      if (fallbackTasks?.length > 0) return res.json({ success: true, tasks: fallbackTasks });
    }

    return res.json({ success: true, tasks: null });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/events/:eventId/overlay-history/:overlayType
router.get('/world/:showId/events/:eventId/overlay-history/:overlayType', optionalAuth, async (req, res) => {
  try {
    const { eventId, overlayType } = req.params;
    const models = req.app?.get?.('models') || require('../models');
    const { sequelize } = models;

    const assetRole = overlayType === 'wardrobe' ? 'UI.OVERLAY.WARDROBE_LIST' : 'UI.OVERLAY.SOCIAL_TASKS';

    const [rows] = await sequelize.query(
      `SELECT id, s3_url_processed as image_url, approval_status, metadata, created_at
       FROM assets WHERE metadata->>'event_id' = :eventId AND asset_role = :assetRole AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      { replacements: { eventId, assetRole } }
    );

    const data = (rows || []).map((r, i) => {
      const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {});
      return {
        id: r.id,
        image_url: r.image_url,
        approval_status: r.approval_status,
        version: meta.version || (rows.length - i),
        task_count: meta.task_count,
        created_at: r.created_at,
      };
    });

    return res.json({ success: true, data, count: data.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// EPISODE TITLE OVERLAY — generates title card with actual episode title
// ═══════════════════════════════════════════════════════════════════════

// POST /world/:showId/episodes/:episodeId/generate-title-overlay
router.post('/world/:showId/episodes/:episodeId/generate-title-overlay', optionalAuth, async (req, res) => {
  try {
    const { showId, episodeId } = req.params;
    const models = req.app?.get?.('models') || require('../models');
    const { sequelize } = models;

    // Load episode
    const [episode] = await sequelize.query(
      `SELECT id, title, episode_number FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );
    if (!episode) return res.status(404).json({ success: false, error: 'Episode not found' });

    // Load event for context
    const [event] = await sequelize.query(
      `SELECT name, prestige, host_brand FROM world_events WHERE used_in_episode_id = :episodeId LIMIT 1`,
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    ).catch(() => []);

    const { getStylePrefix } = require('../services/uiOverlayService');
    const { generateImageUrl } = require('../services/imageGenerationService');

    const stylePrefix = await getStylePrefix(episode.show_id, models);
    const title = episode.title || `Episode ${episode.episode_number}`;
    const prompt = `${stylePrefix}A luxury episode title card overlay. Elegant dark background (#1A1A1A) with thin gold (#B8962E) border frame. Center text reading "${title}" in refined gold serif typography. Below: "Episode ${episode.episode_number}" in smaller gold text. Subtle gold sparkle particles around text. The text MUST be clearly readable — this is a title card. Luxury fashion show episode intro. Isolated on dark background.`;

    const imageUrl = await generateImageUrl(prompt, { size: 'landscape', quality: 'hd', useCase: 'invitation' });

    // Upload to S3 and create asset
    const { v4: uuidv4 } = require('uuid');
    const axios = require('axios');
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
    const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

    let s3Url = imageUrl;
    if (S3_BUCKET && imageUrl) {
      const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const s3 = new S3Client({ region: AWS_REGION });
      const s3Key = `overlays/episode-title/${episodeId}/${uuidv4()}.png`;
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET, Key: s3Key, Body: imgRes.data,
        ContentType: 'image/png', CacheControl: 'max-age=31536000',
      }));
      s3Url = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
    }

    // Create asset record
    const assetId = uuidv4();
    try {
      await sequelize.query(
        `INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, purpose, category, entity_type,
         s3_url_raw, s3_url_processed, show_id, episode_id, metadata, created_at, updated_at)
         VALUES (:id, :name, 'UI_OVERLAY', 'UI.OVERLAY.EPISODE_TITLE', 'EPISODE', 'EPISODE', 'MAIN', 'overlay', 'prop',
         :url, :url, :showId, :episodeId, :metadata, NOW(), NOW())`,
        { replacements: {
          id: assetId, name: `${title} — Title Card`, url: s3Url, showId, episodeId,
          metadata: JSON.stringify({ source: 'episode-title-generator', episode_title: title, episode_number: episode.episode_number }),
        }}
      );
    } catch { /* non-blocking */ }

    return res.json({
      success: true,
      data: { assetId, imageUrl: s3Url, title },
      message: `Episode title overlay generated: "${title}"`,
    });
  } catch (err) {
    console.error('[EpisodeTitleOverlay] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// OVERLAY SELECTION — show-level vs episode-level, auto-suggestions
// ═══════════════════════════════════════════════════════════════════════

// GET /world/:showId/events/:eventId/overlay-suggestions
router.get('/world/:showId/events/:eventId/overlay-suggestions', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = req.app?.get?.('models') || require('../models');

    const [event] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    if (typeof event.canon_consequences === 'string') {
      try { event.canon_consequences = JSON.parse(event.canon_consequences); } catch { event.canon_consequences = {}; }
    }
    if (typeof event.outfit_pieces === 'string') {
      try { event.outfit_pieces = JSON.parse(event.outfit_pieces); } catch { event.outfit_pieces = []; }
    }

    const { getAllOverlayTypes, suggestOverlaysForEvent } = require('../services/uiOverlayService');
    const suggestions = suggestOverlaysForEvent(event);

    // Get current selections from required_ui_overlays
    let currentSelections = event.required_ui_overlays;
    if (typeof currentSelections === 'string') try { currentSelections = JSON.parse(currentSelections); } catch { currentSelections = null; }

    // Get all overlay types from DB for this show
    const allTypes = await getAllOverlayTypes(event.show_id, models);
    const showOverlays = allTypes.filter(o => o.lifecycle === 'permanent');
    const episodeOverlays = allTypes.filter(o => o.lifecycle === 'per_episode' || o.lifecycle === 'variant');

    return res.json({
      success: true,
      data: {
        show_overlays: showOverlays.map(o => ({ id: o.id, name: o.name, category: o.category })),
        episode_overlays: episodeOverlays.map(o => {
          const suggestion = suggestions.find(s => s.id === o.id);
          const selected = currentSelections ? currentSelections.includes(o.id) : !!suggestion;
          return { id: o.id, name: o.name, category: o.category, selected, suggested: !!suggestion, reason: suggestion?.reason || null };
        }),
        current_selections: currentSelections,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /world/:showId/events/:eventId/overlay-selections — save selected overlays
router.put('/world/:showId/events/:eventId/overlay-selections', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { selected_overlays } = req.body;
    const models = req.app?.get?.('models') || require('../models');

    await models.sequelize.query(
      `UPDATE world_events SET required_ui_overlays = :overlays, updated_at = NOW() WHERE id = :eventId AND show_id = :showId`,
      { replacements: { overlays: JSON.stringify(selected_overlays), eventId, showId } }
    );

    return res.json({ success: true, message: `${selected_overlays.length} overlays selected` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// STORIES — auto-generate prose stories from episodes
// ═══════════════════════════════════════════════════════════════════════

// POST /world/:showId/episodes/:episodeId/generate-story
router.post('/world/:showId/episodes/:episodeId/generate-story', optionalAuth, async (req, res) => {
  try {
    const { showId, episodeId } = req.params;
    const { format = 'short_story', povCharacter = 'lala' } = req.body;
    const models = req.app?.get?.('models') || require('../models');
    const { generateEpisodeStory } = require('../services/storyGenerationService');

    const result = await generateEpisodeStory(episodeId, showId, models.sequelize, { format, povCharacter });

    return res.json({
      success: true,
      message: `${result.format} generated — ${result.wordCount} words`,
      data: result,
    });
  } catch (err) {
    console.error('[StoryGen] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/stories — list all stories for a show
router.get('/world/:showId/stories', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { episode_id, format, status, limit = 50 } = req.query;
    const models = req.app?.get?.('models') || require('../models');
    const { getStories } = require('../services/storyGenerationService');

    const stories = await getStories(models.sequelize, {
      showId, episodeId: episode_id || null, format, status, limit: parseInt(limit),
    });

    return res.json({ success: true, data: stories, count: stories.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/stories/:storyId — get a single story with full content
router.get('/world/:showId/stories/:storyId', optionalAuth, async (req, res) => {
  try {
    const { storyId } = req.params;
    const models = req.app?.get?.('models') || require('../models');

    const [story] = await models.sequelize.query(
      'SELECT * FROM stories WHERE id = :storyId AND deleted_at IS NULL LIMIT 1',
      { replacements: { storyId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!story) return res.status(404).json({ success: false, error: 'Story not found' });

    return res.json({ success: true, data: story });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /world/:showId/stories/:storyId — update story content (editing)
router.put('/world/:showId/stories/:storyId', optionalAuth, async (req, res) => {
  try {
    const { storyId } = req.params;
    const { content, title, status } = req.body;
    const models = req.app?.get?.('models') || require('../models');

    const sets = [];
    const replacements = { storyId };
    if (content !== undefined) { sets.push('content = :content'); replacements.content = content; sets.push('word_count = :wc'); replacements.wc = content.split(/\s+/).filter(Boolean).length; }
    if (title !== undefined) { sets.push('title = :title'); replacements.title = title; }
    if (status !== undefined) { sets.push('status = :status'); replacements.status = status; }
    sets.push('updated_at = NOW()');

    await models.sequelize.query(`UPDATE stories SET ${sets.join(', ')} WHERE id = :storyId`, { replacements });

    return res.json({ success: true, message: 'Story updated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// DISTRIBUTION — platform-specific descriptions, hashtags, scheduling
// ═══════════════════════════════════════════════════════════════════════

// POST /world/:showId/episodes/:episodeId/generate-distribution
router.post('/world/:showId/episodes/:episodeId/generate-distribution', optionalAuth, async (req, res) => {
  try {
    const { showId, episodeId } = req.params;
    const { platforms } = req.body; // optional: ['youtube', 'tiktok', 'instagram', 'facebook']
    const models = req.app?.get?.('models') || require('../models');
    const { generateDistribution } = require('../services/distributionService');

    const result = await generateDistribution(episodeId, showId, models.sequelize, { platforms });

    return res.json({
      success: true,
      message: `Distribution generated for ${Object.keys(result.platforms).length} platforms`,
      data: result,
    });
  } catch (err) {
    console.error('[Distribution] Generate error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/episodes/:episodeId/distribution
router.get('/world/:showId/episodes/:episodeId/distribution', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const models = req.app?.get?.('models') || require('../models');

    const [episode] = await models.sequelize.query(
      `SELECT distribution_metadata FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { episodeId }, type: models.sequelize.QueryTypes.SELECT }
    );

    let metadata = episode?.distribution_metadata;
    if (typeof metadata === 'string') try { metadata = JSON.parse(metadata); } catch { metadata = {}; }

    return res.json({ success: true, data: metadata || {} });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /world/:showId/episodes/:episodeId/distribution
router.put('/world/:showId/episodes/:episodeId/distribution', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { distribution_metadata } = req.body;
    const models = req.app?.get?.('models') || require('../models');

    await models.sequelize.query(
      `UPDATE episodes SET distribution_metadata = :metadata, updated_at = NOW() WHERE id = :episodeId`,
      { replacements: { metadata: JSON.stringify(distribution_metadata), episodeId } }
    );

    return res.json({ success: true, message: 'Distribution metadata saved' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /world/:showId/distribution-defaults — save show-level platform config
router.put('/world/:showId/distribution-defaults', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { distribution_defaults } = req.body;
    const models = req.app?.get?.('models') || require('../models');
    const { saveShowDefaults } = require('../services/distributionService');

    const saved = await saveShowDefaults(showId, distribution_defaults, models.sequelize);
    return res.json({ success: true, data: saved, message: 'Show distribution defaults saved' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/distribution-defaults
router.get('/world/:showId/distribution-defaults', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const models = req.app?.get?.('models') || require('../models');

    const [show] = await models.sequelize.query(
      `SELECT distribution_defaults FROM shows WHERE id = :showId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { showId }, type: models.sequelize.QueryTypes.SELECT }
    );

    let defaults = show?.distribution_defaults;
    if (typeof defaults === 'string') try { defaults = JSON.parse(defaults); } catch { defaults = {}; }

    return res.json({ success: true, data: defaults || {} });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// UNIFIED EPISODE COMPLETION — evaluate + financials + social + wardrobe in one
// ═══════════════════════════════════════════════════════════════════════

// POST /world/:showId/episodes/:episodeId/complete
router.post('/world/:showId/episodes/:episodeId/complete', optionalAuth, async (req, res) => {
  try {
    const { showId, episodeId } = req.params;
    const models = req.app?.get?.('models') || require('../models');
    const { completeEpisode } = require('../services/episodeCompletionService');

    const result = await completeEpisode(episodeId, showId, models.sequelize);

    return res.json({
      success: true,
      message: result.already_completed
        ? 'Episode already completed'
        : `${result.evaluation.tier.toUpperCase()} (${result.evaluation.score}/100) — ${result.transactions} transactions, ${result.social_tasks?.completed || 0} social tasks`,
      data: result,
    });
  } catch (err) {
    console.error('[CompleteEpisode] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// FINANCIAL TRANSACTION PIPELINE — execute, query, and display finances
// ═══════════════════════════════════════════════════════════════════════

// POST /world/:showId/episodes/:episodeId/finalize-financials
router.post('/world/:showId/episodes/:episodeId/finalize-financials', optionalAuth, async (req, res) => {
  try {
    const { showId, episodeId } = req.params;
    const models = req.app?.get?.('models') || require('../models');
    const { finalizeEpisodeFinancials } = require('../services/financialTransactionService');

    const result = await finalizeEpisodeFinancials(episodeId, showId, models.sequelize);

    return res.json({
      success: true,
      message: result.already_finalized
        ? 'Episode already finalized'
        : `${result.transactions.length} transactions executed — balance: ${result.balance_after}`,
      data: result,
    });
  } catch (err) {
    console.error('[Financials] Finalize error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/financial-ledger — running ledger across all episodes
router.get('/world/:showId/financial-ledger', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { episode_id, limit = 100 } = req.query;
    const models = req.app?.get?.('models') || require('../models');
    const { getFinancialLedger } = require('../services/financialTransactionService');

    const result = await getFinancialLedger(showId, models.sequelize, {
      episodeId: episode_id || null,
      limit: parseInt(limit),
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Financials] Ledger error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/balance — current coin balance
router.get('/world/:showId/balance', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const models = req.app?.get?.('models') || require('../models');
    const { getCurrentBalance } = require('../services/financialTransactionService');
    const { checkAffordability } = require('../services/financialPressureService');

    const balance = await getCurrentBalance(models.sequelize, showId);

    // Get pending event (next ready event) for affordability check
    let affordability = null;
    try {
      const [nextEvent] = await models.sequelize.query(
        `SELECT * FROM world_events WHERE show_id = :showId AND status = 'ready' ORDER BY created_at LIMIT 1`,
        { replacements: { showId }, type: models.sequelize.QueryTypes.SELECT }
      );
      if (nextEvent) affordability = checkAffordability(nextEvent, balance);
    } catch { /* non-blocking */ }

    return res.json({ success: true, balance, affordability });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/generate-lists — generate wardrobe + career lists from event
router.post('/world/:showId/events/:eventId/generate-lists', optionalAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { listType = 'both' } = req.body; // 'wardrobe', 'career', or 'both'
    const models = req.app?.get?.('models') || require('../models');
    const { sequelize } = models;

    // Find the episode linked to this event
    const [event] = await sequelize.query(
      'SELECT id, name, used_in_episode_id FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1',
      { replacements: { eventId, showId }, type: sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!event.used_in_episode_id) return res.status(400).json({ error: 'Event not injected into an episode yet. Inject the event first.' });

    const episodeId = event.used_in_episode_id;
    const results = {};

    // Generate wardrobe shopping list
    if (listType === 'wardrobe' || listType === 'both') {
      try {
        const { generateEpisodeTodoList } = require('../services/todoListService');
        const wardrobeResult = await generateEpisodeTodoList(episodeId, showId, models);
        results.wardrobe = { success: true, tasks: wardrobeResult.tasks.length, assetUrl: wardrobeResult.assetUrl };
      } catch (err) {
        results.wardrobe = { success: false, error: err.message };
      }
    }

    // Generate career checklist
    if (listType === 'career' || listType === 'both') {
      try {
        const { generateCareerList } = require('../services/todoListService');
        const careerResult = await generateCareerList(episodeId, showId, models);
        results.career = { success: true, tasks: careerResult.tasks.length, assetUrl: careerResult.assetUrl };
      } catch (err) {
        results.career = { success: false, error: err.message };
      }
    }

    return res.json({
      success: true,
      event_name: event.name,
      episode_id: episodeId,
      lists: results,
    });
  } catch (err) {
    console.error('[WorldEvents] Generate lists error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── NEXT-EVENT SUGGESTIONS ────────────────────────────────────────────────────
//
// State-aware recommendations for what episode to make next. Reads the live
// character_state (coins, reputation, stress, brand_trust, influence), looks
// at the previous episode's brief for chain seeds + brand continuity, and
// scores every unused event with a deterministic rubric. No AI in the loop —
// the rubric is the algorithm, every score has bullet-point justifications,
// and the creator still has to pick.
//
// Trigger surface: the "end of show" overlay on EpisodeDetail when the
// episode is evaluated. See NextEventSuggestionsOverlay.jsx for the consumer.
//
// The thresholds 250 (pressure) and 100 (critical) are deliberate product
// constants set with the showrunner; tweak in one place here if those move.
const COINS_PRESSURE = 250;
const COINS_CRITICAL = 100;

router.get('/world/:showId/events/next-suggestions', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { from_episode_id: fromEpisodeId } = req.query;
    const models = require('../models');
    const { sequelize, WorldEvent, EpisodeBrief, Episode } = models;

    // ── 1. Live character state ──
    // character_key is 'justawoman' (matches episodeCompletionService:176).
    // Note: careerPipelineService.getAccessibleCareerTier queries 'lala' as
    // of writing, which is a pre-existing bug — don't reuse that helper here.
    const [stateRows] = await sequelize.query(
      `SELECT coins, reputation, brand_trust, influence, stress
       FROM character_state
       WHERE show_id = :showId AND character_key = 'justawoman'
       LIMIT 1`,
      { replacements: { showId } }
    );
    const state = stateRows?.[0] || { coins: 500, reputation: 1, brand_trust: 1, influence: 1, stress: 0 };

    // Reputation → career tier gate. Tier 1: rep 0-2, Tier 2: rep 3-4, etc.
    const careerTier = Math.min(5, Math.floor((state.reputation || 0) / 2) + 1);

    // ── 2. Previous episode context for chain + brand continuity ──
    let prevBrief = null;
    let prevEvent = null;
    if (fromEpisodeId) {
      prevBrief = await EpisodeBrief.findOne({ where: { episode_id: fromEpisodeId } });
      // The event the previous episode came from — needed for brand-continuity
      // bonus and direct chain matching (parent_event_id pointing here).
      const [prevEventRows] = await sequelize.query(
        `SELECT id, host_brand, source_profile_id FROM world_events
         WHERE used_in_episode_id = :episodeId AND deleted_at IS NULL LIMIT 1`,
        { replacements: { episodeId: fromEpisodeId } }
      );
      prevEvent = prevEventRows?.[0] || null;
    }
    const prevSeeds = Array.isArray(prevBrief?.narrative_chain?.seeds_future_events)
      ? prevBrief.narrative_chain.seeds_future_events
      : [];
    const prevHostBrand = prevEvent?.host_brand || null;
    const prevEventId = prevEvent?.id || null;

    // ── 3. Candidate events ──
    // Only events that are draft/ready and haven't been used in another
    // episode yet. We don't filter by career_tier here — we score it instead,
    // so creators can see "this is locked, you'd need higher rep."
    const candidates = await WorldEvent.findAll({
      where: {
        show_id: showId,
        status: ['draft', 'ready'],
        used_in_episode_id: null,
        deleted_at: null,
      },
      limit: 50,
    });

    // ── 4. Score each candidate ──
    const scored = candidates.map(ev => {
      const e = ev.toJSON();
      let score = 0;
      const reasons = [];

      // Affordability check first — it's the most common dealbreaker.
      const affordable = (e.cost_coins || 0) <= (state.coins || 0);
      if (!affordable) {
        score -= 50;
        reasons.push({ kind: 'block', text: `Can't afford (cost ${e.cost_coins}, have ${state.coins})` });
      }

      // Financial pressure — paid events get a graduated bonus when Lala's
      // running low. The two thresholds are set above as product constants.
      const payment = parseInt(e.payment_amount, 10) || 0;
      const isPaid = !!e.is_paid && payment > 0;
      if (isPaid) {
        if (state.coins < COINS_CRITICAL) {
          score += 30;
          reasons.push({ kind: 'boost', text: `Lala is broke — paid event (+${payment} coins)` });
        } else if (state.coins < COINS_PRESSURE) {
          // Linear ramp from +25 at coins=100 down to +5 at coins=250
          const ramp = Math.round(25 - ((state.coins - COINS_CRITICAL) / (COINS_PRESSURE - COINS_CRITICAL)) * 20);
          score += ramp;
          reasons.push({ kind: 'boost', text: `Lala needs coins (+${payment})` });
        } else {
          score += 5;
        }
      }

      // Stress relief: high stress → bias toward easier (low-strictness) events.
      if ((state.stress || 0) >= 6 && (e.strictness || 5) <= 4) {
        score += 10;
        reasons.push({ kind: 'boost', text: 'Low-pressure recovery (Lala is stressed)' });
      }

      // Direct chain continuation — strongest signal.
      if (prevEventId && e.parent_event_id === prevEventId) {
        score += 30;
        reasons.push({ kind: 'boost', text: 'Direct chain continuation' });
      } else if (prevSeeds.length > 0) {
        // Soft seed match: if any seed string mentions this event's name or
        // type, count it as planted by the previous episode.
        const evHaystack = `${e.name || ''} ${e.event_type || ''} ${e.career_milestone || ''}`.toLowerCase();
        const seedHit = prevSeeds.some(seed => {
          const s = (typeof seed === 'string' ? seed : JSON.stringify(seed)).toLowerCase();
          return s.length > 4 && evHaystack.includes(s.slice(0, 20));
        });
        if (seedHit) {
          score += 18;
          reasons.push({ kind: 'boost', text: 'Seeded by last episode' });
        }
      }

      // Reputation alignment — closer prestige to current rep is better.
      const prestigeDelta = Math.abs((e.prestige || 5) - (state.reputation || 0));
      score += Math.max(0, 10 - prestigeDelta);

      // Brand continuity — same host brand as the prior episode.
      if (prevHostBrand && e.host_brand === prevHostBrand) {
        score += 8;
        reasons.push({ kind: 'boost', text: `Brand continuity (${e.host_brand})` });
      }

      // Career tier gate — penalise if locked, but still surface it so the
      // creator sees what's coming.
      if (e.career_tier && e.career_tier > careerTier) {
        score -= 20;
        reasons.push({ kind: 'block', text: `Career tier locked (need tier ${e.career_tier}, currently ${careerTier})` });
      }

      return {
        event: {
          id: e.id,
          name: e.name,
          event_type: e.event_type,
          host: e.host,
          host_brand: e.host_brand,
          prestige: e.prestige,
          cost_coins: e.cost_coins,
          payment_amount: e.payment_amount,
          is_paid: e.is_paid,
          strictness: e.strictness,
          career_tier: e.career_tier,
          career_milestone: e.career_milestone,
          source_profile_id: e.source_profile_id,
        },
        score,
        affordable,
        reasons,
      };
    });

    // ── 5. Top 5 by score ──
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 5);

    return res.json({
      data: {
        state: {
          coins: state.coins,
          reputation: state.reputation,
          brand_trust: state.brand_trust,
          influence: state.influence,
          stress: state.stress,
          career_tier: careerTier,
        },
        thresholds: {
          coins_pressure: COINS_PRESSURE,
          coins_critical: COINS_CRITICAL,
        },
        suggestions: top,
        candidate_count: candidates.length,
      },
    });
  } catch (err) {
    console.error('[WorldEvents] Next suggestions error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;


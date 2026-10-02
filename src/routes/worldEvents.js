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
 * POST   /api/v1/world/:showId/events/:eventId/suggest-names — Three AI-written name options, writes nothing
 * POST   /api/v1/world/:showId/events/ai-fix — AI suggestions to diversify event plan
 * 
 * Location: src/routes/worldEvents.js
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');
const { isBudgetError } = require('../services/imageCostService');
const { scriptOverwriteBlocked, scriptOverwriteRefusalBody } = require('../utils/scriptOverwriteGuard');
const { mergeCanonConsequences } = require('../utils/canonConsequencesMerge');
const { parseExpectedVersion, versionMatches, staleSaveBody } = require('../utils/eventVersion');
const { eventEpisodeConflictBody, EVENT_EPISODE_CONFLICT_CODE } = require('../utils/eventEpisodeLink');
const { withAutoScheduledDate, autoScheduledEventDate, AUTO_DATE_KEY } = require('../utils/eventDateDefault');
const { eventCreatorOrganizer } = require('../utils/eventOrganizer');
const { buildSuggestNamesFraming } = require('../utils/suggestNamesFraming');
const { cleanEventName } = require('../utils/cleanEventName');
const { draftEventConcept } = require('../services/eventConceptDraftService');
const { normalizeRestrictions, listEventDeliverables } = require('../services/eventTermsService');
const { withDeliverableTasks } = require('../utils/socialTaskSource');
const { careerTierFromLabel, careerTierFromReputation } = require('../utils/careerTiers');
const { startedEpisodeFor, readEpisodeSocialTasks, writeEpisodeSocialTasks } = require('../services/episodeTaskCopyService');
const {
  findTermsLockEpisode, changedLockedFields, termsLockedBody, episodeLabel, LOCKED_EVENT_FIELDS,
  readTermsReopen, STAYS_LOCKED_WHILE_REOPENED, withoutServerOwnedKeys, TermsReopenedError, termsReopenedBody,
} = require('../utils/eventTermsLock');
const { syncDraftedDealType } = require('../services/dealTypeDraftService');
const { findMissingPrices, dealPriceRequiredError, dealPriceRequiredBody, DEAL_PRICE_REQUIRED_CODE } = require('../services/dealPricingService');
const { DEAL_TYPES } = require('../models/WorldEvent');

// A deal_type body value as the PUT loop reads it: '', 'null' and
// 'undefined' are null (normalizeNullLike), anything else as sent.
function normalizeDealTypeValue(value) {
  if (value == null) return null;
  if (typeof value === 'string' && ['', 'null', 'undefined'].includes(value.trim().toLowerCase())) return null;
  return value;
}

async function getModels() {
  try { return require('../models'); } catch (e) { console.error('Failed to load models:', e.message); return null; }
}


// ═══════════════════════════════════════════
// GET /api/v1/world/:showId/events
// ═══════════════════════════════════════════

router.get('/world/:showId/events', requireAuth, async (req, res) => {
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
          events = await models.WorldEvent.findAll({ where, include, order: [[sortCol, sortOrder]], attributes: models.WorldEvent.CURRENT_ATTRIBUTES });
        } catch (includeErr) {
          console.warn('[WorldEvents] Includes failed, trying without:', includeErr.message);
          try {
            events = await models.WorldEvent.findAll({ where, order: [[sortCol, sortOrder]], attributes: models.WorldEvent.CURRENT_ATTRIBUTES });
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
// GET /api/v1/world/:showId/events/:eventId
// Single event, full row — added for the Event Package page (Task #1642).
// The list route above scopes `attributes` to WorldEvent.CURRENT_ATTRIBUTES
// (WorldEvent.js:331-355), which deliberately excludes venue_name/
// venue_address/event_date/event_time/category/format so it stays safe on
// an un-migrated DB. The Event Package page's Basics and Place sections
// need exactly those columns, so this route reads the row directly with
// raw SQL (the same tolerate-whatever-columns-exist pattern already used
// by /affordability, /decline, and /financial-forecast in this file)
// instead of going through the model.
// ═══════════════════════════════════════════

router.get('/world/:showId/events/:eventId', requireAuth, async (req, res, next) => {
  // Registered before /events/next-suggestions, which it would otherwise
  // swallow as an event id (Task #2273).
  if (req.params.eventId === 'next-suggestions') return next();
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const [rows] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1',
      { replacements: { eventId, showId } }
    );
    const event = rows[0];
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    if (typeof event.canon_consequences === 'string') {
      try { event.canon_consequences = JSON.parse(event.canon_consequences); } catch { event.canon_consequences = {}; }
    }
    if (typeof event.outfit_pieces === 'string') {
      try { event.outfit_pieces = JSON.parse(event.outfit_pieces); } catch { event.outfit_pieces = []; }
    }
    if (typeof event.requirements === 'string') {
      try { event.requirements = JSON.parse(event.requirements); } catch { event.requirements = {}; }
    }
    if (typeof event.restrictions === 'string') {
      try { event.restrictions = JSON.parse(event.restrictions); } catch (e) { console.error('[WorldEvents] restrictions parse failed:', e.message); event.restrictions = []; }
    }

    // People — host, from the durable FK (WorldEvent.js:97), shown as the
    // linked creator. Null source_profile_id means "not linked" — the page
    // falls back to the legacy `host` text field in that case.
    let sourceProfile = null;
    if (event.source_profile_id && models.SocialProfile) {
      sourceProfile = await models.SocialProfile.findByPk(event.source_profile_id, {
        attributes: ['id', 'handle', 'display_name', 'platform'],
      }).catch(() => null);
    }

    // The creator this event was started from on the Feed (Task #1790):
    // automation.started_from_profile_id. Not the organizer — the Event
    // Package offers them as a suggestion only. Read-only.
    let startedFromProfile = null;
    const startedFromId = event.canon_consequences?.automation?.started_from_profile_id;
    if (startedFromId && models.SocialProfile) {
      startedFromProfile = await models.SocialProfile.findByPk(startedFromId, {
        attributes: ['id', 'handle', 'display_name', 'platform', 'registry_character_id'],
      }).catch((e) => { console.error('[WorldEvents] started-from profile lookup failed:', e.message); return null; });
    }

    // Place — the linked scene set's name
    let sceneSet = null;
    if (event.scene_set_id && models.SceneSet) {
      sceneSet = await models.SceneSet.findByPk(event.scene_set_id, {
        attributes: ['id', 'name'],
      }).catch(() => null);
    }

    // Place — the linked World Location's type and its own dress code, read
    // only as inputs to the Event Package's dress-code suggestion (Task
    // #1755). Nothing here is written.
    let venueLocation = null;
    if (event.venue_location_id && models.WorldLocation) {
      const loc = await models.WorldLocation.findByPk(event.venue_location_id, {
        attributes: ['id', 'name', 'venue_type', 'venue_details'],
      }).catch((e) => { console.error('[WorldEvents] venue location lookup failed:', e.message); return null; });
      if (loc) {
        const details = loc.venue_details && typeof loc.venue_details === 'object' ? loc.venue_details : {};
        venueLocation = {
          id: loc.id,
          name: loc.name,
          venue_type: loc.venue_type || null,
          dress_code: typeof details.dress_code === 'string' && details.dress_code.trim() ? details.dress_code.trim() : null,
        };
      }
    }

    // Invitation — status + preview
    let invitationAsset = null;
    if (event.invitation_asset_id && models.Asset) {
      invitationAsset = await models.Asset.findByPk(event.invitation_asset_id, {
        attributes: ['id', 's3_url_processed', 's3_url_raw', 'approval_status'],
      }).catch(() => null);
    }

    // Used events — hide Change Host / Edit details / Start Episode once set
    let usedInEpisode = null;
    if (event.used_in_episode_id && models.Episode) {
      usedInEpisode = await models.Episode.findByPk(event.used_in_episode_id, {
        // evaluation_status: the venue look locks when it is accepted (Q9).
        attributes: ['id', 'episode_number', 'title', 'evaluation_status'],
      }).catch(() => null);
    }

    // The episode whose Start Episode locked these terms (Task #2356), found
    // the way the lock itself finds it (findTermsLockEpisode): the live brief
    // that names this event first (§8(w) P2), else the used_in_episode_id
    // stamp. The Event Package reads as read-only while this is set, so it
    // never offers an edit the server would refuse.
    let termsLockedBy = null;
    try {
      const lockEpisode = await findTermsLockEpisode(models.sequelize, event.id);
      if (lockEpisode) {
        termsLockedBy = {
          id: lockEpisode.id,
          episode_number: lockEpisode.episode_number ?? null,
          title: lockEpisode.title ?? null,
        };
      }
    } catch (lockErr) {
      console.error('[WorldEvents] terms lock lookup failed:', lockErr.message);
    }
    // Reopened terms (Task #2378): who reopened them and when, or null.
    let termsReopen = null;
    if (termsLockedBy) {
      try {
        const marker = await readTermsReopen(models.sequelize, event.id);
        if (marker) termsReopen = { at: marker.at ?? null, by: marker.by ?? null, episode_id: marker.episode_id ?? null };
      } catch (reopenErr) {
        console.error('[WorldEvents] terms reopen lookup failed:', reopenErr.message);
      }
    }

    return res.json({
      success: true,
      event,
      sourceProfile: sourceProfile ? sourceProfile.toJSON() : null,
      startedFromProfile: startedFromProfile ? startedFromProfile.toJSON() : null,
      sceneSet: sceneSet ? sceneSet.toJSON() : null,
      venueLocation,
      invitationAsset: invitationAsset ? invitationAsset.toJSON() : null,
      usedInEpisode: usedInEpisode ? usedInEpisode.toJSON() : null,
      termsLockedBy,
      termsReopen,
    });
  } catch (error) {
    console.error('Get single event error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load event', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events/:eventId/suggest-names
//
// Three AI-written name options for an existing event, built from the
// event's own facts. Writes nothing — Evoni picks one (or types her own)
// through the existing PUT /world/:showId/events/:eventId route, whose
// allowedFields already includes 'name' (:389 below), so no new write
// path is added here. Task #1670.
// ═══════════════════════════════════════════

router.post('/world/:showId/events/:eventId/suggest-names', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId, eventId } = req.params;

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ success: false, error: 'ANTHROPIC_API_KEY not configured' });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const [rows] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1',
      { replacements: { eventId, showId } }
    );
    const event = rows[0];
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Host — prefer the linked SocialProfile (durable source_profile_id,
    // same field the single-event GET above reads, :158) for its name AND
    // archetype; fall back to the event's own legacy `host` text field
    // when there's no linked profile.
    // content_category is the organizer's niche for the framing sentence
    // (§8(u) R9, Task #2120).
    let hostLine = event.host ? `Host: ${event.host}` : null;
    let organizer = null;
    if (event.source_profile_id && models.SocialProfile) {
      const profile = await models.SocialProfile.findByPk(event.source_profile_id, {
        attributes: ['display_name', 'handle', 'archetype', 'content_category'],
      }).catch(() => null);
      if (profile) {
        organizer = profile;
        const hostName = profile.display_name || profile.handle;
        hostLine = profile.archetype
          ? `Host: ${hostName} (${String(profile.archetype).replace(/_/g, ' ')})`
          : `Host: ${hostName}`;
      }
    }

    // No show name (Task #2086): doctrine rule 11 says an event name never
    // uses the show name, so the show is not a fact the model sees.

    // Every fact line is conditional — most events have almost none of
    // these set today (no venue, no category, no format), so the prompt
    // below tells the model explicitly not to invent what's missing
    // rather than silently degrading to a generic prompt.
    const facts = [
      hostLine,
      event.category ? `Category: ${String(event.category).replace(/_/g, ' ')}` : null,
      event.format ? `Format: ${String(event.format).replace(/_/g, ' ')}` : null,
      event.venue_name ? `Venue: ${event.venue_name}` : null,
      event.event_date ? `Date: ${event.event_date}` : null,
      event.event_time ? `Time: ${event.event_time}` : null,
      event.dress_code ? `Dress code: ${event.dress_code}` : null,
      typeof event.prestige === 'number' ? `Prestige: ${event.prestige}/10` : null,
    ].filter(Boolean);

    const factsBlock = facts.length > 0
      ? facts.join('\n')
      : 'No details recorded for this event yet beyond it existing — do not invent any.';

    // Framed by the organizer's niche and the event's format and drafted
    // concept, or its description when it has no concept (§8(u) R9,
    // Task #2135, src/utils/suggestNamesFraming.js).
    const framing = buildSuggestNamesFraming(event, organizer);

    const prompt = `${framing} Suggest three short, creative names for it.

${factsBlock}

Rules:
- Each name is under 40 characters.
- No quotation marks in the name itself.
- Do not invent facts (a venue, a guest, a theme, a location) the details above don't give you — when details are sparse, lean on tone and whatever you do have (host, category, format) instead of making something up.
- Return three genuinely different options, not three variations on one phrase.

Return ONLY this JSON, no other text:
{"names": ["...", "...", "..."]}`;

    // Model choice: cheapest tier that writes well for a short, low-stakes
    // task (claude-haiku-4-5-20251001 — same model episodeGeneratorService.js
    // already uses for AI episode titles, :520, one tier below the
    // claude-sonnet-4-6 heavier generation routes like eventGeneratorRoute.js
    // use). Retry pattern matches the existing two-attempt-per-model loop
    // (e.g. src/routes/memories/interview.js:100-130): up to 2 attempts per
    // model with a 2s backoff on 529/503, falling through to the next model
    // (only one here) on repeated overload or a 404.
    const MODELS = ['claude-haiku-4-5-20251001'];
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await client.messages.create({
            model,
            max_tokens: 300,
            messages: [{ role: 'user', content: prompt }],
          });
          succeeded = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          if (status === 529 || status === 503 || status === 404) break;
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      return res.status(503).json({ success: false, error: 'The AI service is temporarily overloaded. Please try again.' });
    }

    const text = response.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ success: false, error: 'Claude returned no JSON', raw: text });

    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return res.status(500).json({ success: false, error: 'Claude returned invalid JSON', raw: text });
    }

    // Clean any quote marks the model included anyway, the same way the
    // creation draft does (cleanEventName, Task #2139: double quotes
    // anywhere, single quotes only when they wrap the name, apostrophes
    // kept), and enforce the length rule defensively rather than trusting
    // the prompt alone.
    const names = Array.isArray(parsed.names)
      ? parsed.names
          .map((n) => cleanEventName(String(n || '')).slice(0, 40))
          .filter(Boolean)
          .slice(0, 3)
      : [];

    if (names.length === 0) {
      return res.status(500).json({ success: false, error: 'No usable names returned', raw: text });
    }

    return res.json({ success: true, names });
  } catch (err) {
    console.error('[SuggestEventNames] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events
// ═══════════════════════════════════════════

router.post('/world/:showId/events', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const {
      name, event_type = 'invite', category = null, format = null, host, host_brand, description,
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
      // Task #2158: the creator link (WorldAdmin's form sends it).
      source_profile_id,
      guest_list: _guest_list, invitation_details: _invitation_details, scene_set_id,
      // Narrative chain — see PUT allowlist for details. Optional on create.
      parent_event_id = null, chain_position = null, chain_reason = null,
    } = req.body;

    if (!name) return res.status(400).json({ success: false, error: 'Event name is required' });

    // Date and time (Task #1755). A date or time the creator typed is kept
    // (this route used to discard both). With no date, the event is
    // auto-scheduled 45 days out and flagged in automation.event_date_auto
    // so the Event Package can label it (src/utils/eventDateDefault.js).
    const dated = withAutoScheduledDate(event_date, canon_consequences);
    const createEventTime = typeof event_time === 'string' && event_time.trim() ? event_time.trim() : null;

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // If venue_location_id provided, auto-populate venue details from WorldLocation
    let resolvedVenueName = venue_name || null;
    let resolvedVenueAddress = venue_address || null;
    const resolvedSceneSetId = scene_set_id || null;
    // Task #2158: the venue link is saved when it names an existing
    // WorldLocation (the lookup below), and left unsaved otherwise.
    let savedVenueLocationId = null;
    if (venue_location_id && models.WorldLocation) {
      try {
        const venue = await models.WorldLocation.findByPk(venue_location_id);
        if (venue) {
          savedVenueLocationId = venue_location_id;
          if (!resolvedVenueName) resolvedVenueName = venue.name;
          if (!resolvedVenueAddress) {
            const parts = [venue.street_address, venue.district, venue.city].filter(Boolean);
            resolvedVenueAddress = parts.length > 0 ? parts.join(', ') : null;
          }
          // No scene set is linked from the venue by itself (S3, S7): the
          // first set found at the location was linked here, with no order.
          // The Event Package's Place section is where the set is chosen.
        }
      } catch { /* non-blocking */ }
    }

    // Task #2158: the creator link is saved when it names an existing
    // SocialProfile, looked up the same way as the venue; an unknown or
    // failed lookup is ignored and the event saves without it. Once saved,
    // Suggest names frames names with this creator's niche, and the Event
    // Package shows them as the organizer when no brand is set.
    let savedSourceProfileId = null;
    if (source_profile_id && models.SocialProfile) {
      try {
        const profile = await models.SocialProfile.findByPk(source_profile_id, { attributes: ['id'] });
        if (profile) savedSourceProfileId = profile.id;
        else console.warn(`[CreateEvent] source_profile_id ${JSON.stringify(source_profile_id)} names no SocialProfile; saving the event without it`);
      } catch (err) {
        console.warn('[CreateEvent] source_profile_id lookup failed; saving the event without it:', err.message);
      }
    }
    // Only the links that validated, so a request with neither saves as before.
    const savedLinks = {
      ...(savedVenueLocationId ? { venue_location_id: savedVenueLocationId } : {}),
      ...(savedSourceProfileId ? { source_profile_id: savedSourceProfileId } : {}),
    };

    if (models.WorldEvent) {
      const event = await models.WorldEvent.create({
        show_id: showId,
        season_id: season_id || null,
        arc_id: arc_id || null,
        name, event_type,
        category, format,
        host: host || null,
        host_brand: host_brand || null,
        description: description || null,
        prestige, cost_coins, strictness,
        deadline_type, deadline_minutes: deadline_minutes || null,
        dress_code: dress_code || null,
        dress_code_keywords,
        location_hint: location_hint || resolvedVenueAddress || null,
        narrative_stakes: narrative_stakes || null,
        event_date: dated.event_date || null,
        event_time: createEventTime,
        canon_consequences: dated.canon_consequences, seeds_future_events,
        overlay_template, required_ui_overlays,
        browse_pool_bias, browse_pool_size,
        rewards,
        is_paid, payment_amount,
        requirements, career_tier,
        career_milestone: career_milestone || null,
        fail_consequence: fail_consequence || null,
        success_unlock: success_unlock || null,
        scene_set_id: resolvedSceneSetId,
        parent_event_id: parent_event_id || null,
        chain_position: chain_position || null,
        chain_reason: chain_reason || null,
        status: 'draft',
        ...savedLinks,
      });
      // The deal type's first draft (Task #2330; dealTypeDraftService).
      const dealDraft = await syncDraftedDealType(models.sequelize, event.id, { initial: true });
      if (dealDraft.deal_type) {
        event.set('deal_type', dealDraft.deal_type);
        event.set('deal_components', dealDraft.deal_components);
      }

      return res.status(201).json({ success: true, event: event.toJSON() });
    }

    // Fallback: raw SQL. The saved links (Task #2158) are appended only
    // when present, so the statement is otherwise as before.
    const linkColumns = Object.keys(savedLinks);
    const linkCols = linkColumns.map((c) => `, ${c}`).join('');
    const linkVals = linkColumns.map((c) => `, :${c}`).join('');
    const id = uuidv4();
    await models.sequelize.query(
      `INSERT INTO world_events
        (id, show_id, season_id, arc_id, name, event_type, category, format, host, host_brand, description,
        prestige, cost_coins, strictness, deadline_type, deadline_minutes,
        dress_code, dress_code_keywords, location_hint, narrative_stakes,
        event_date, event_time,
        canon_consequences, seeds_future_events,
        overlay_template, required_ui_overlays, browse_pool_bias, browse_pool_size,
        rewards, is_paid, payment_amount, requirements, career_tier,
        career_milestone, fail_consequence, success_unlock,
        scene_set_id, parent_event_id, chain_position, chain_reason${linkCols},
        status, created_at, updated_at)
       VALUES
      (:id, :showId, :season_id, :arc_id, :name, :event_type, :category, :format, :host, :host_brand, :description,
        :prestige, :cost_coins, :strictness, :deadline_type, :deadline_minutes,
        :dress_code, :dress_code_keywords, :location_hint, :narrative_stakes,
        :event_date, :event_time,
        :canon_consequences, :seeds_future_events,
        :overlay_template, :required_ui_overlays, :browse_pool_bias, :browse_pool_size,
        :rewards, :is_paid, :payment_amount, :requirements, :career_tier,
        :career_milestone, :fail_consequence, :success_unlock,
        :scene_set_id, :parent_event_id, :chain_position, :chain_reason${linkVals},
        'draft', NOW(), NOW())`,
      {
        replacements: {
          id, showId,
          season_id: season_id || null,
          arc_id: arc_id || null,
          name, event_type,
          category: category || null, format: format || null,
          host: host || null,
          host_brand: host_brand || null,
          description: description || null,
          prestige, cost_coins, strictness,
          deadline_type, deadline_minutes: deadline_minutes || null,
          dress_code: dress_code || null,
          dress_code_keywords: JSON.stringify(dress_code_keywords),
          location_hint: location_hint || resolvedVenueAddress || null,
          narrative_stakes: narrative_stakes || null,
          event_date: dated.event_date || null,
          event_time: createEventTime,
          canon_consequences: JSON.stringify(dated.canon_consequences),
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
          parent_event_id: parent_event_id || null,
          chain_position: chain_position || null,
          chain_reason: chain_reason || null,
          ...savedLinks,
        },
      }
    );

    // The deal type's first draft (Task #2330; dealTypeDraftService).
    await syncDraftedDealType(models.sequelize, id, { initial: true });

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

router.put('/world/:showId/events/:eventId', express.json({ limit: '2mb' }), requireAuth, async (req, res) => {
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

    // Stale-save check (Task #1788, src/utils/eventVersion.js). A client
    // that composed this save from an earlier read sends the row's
    // updated_at as it read it; the write is refused with 409 when the
    // stored row is newer. Optional: without it, last write wins, as before.
    const expected = parseExpectedVersion(updates);
    if (expected.error) {
      return res.status(400).json({ success: false, error: expected.error, code: 'INVALID_EXPECTED_UPDATED_AT' });
    }
    if (!expected.present) {
      console.warn('[WorldEvents] PUT without expected_updated_at (last write wins) — keys:', Object.keys(updates).join(', '));
    }
    const refuseStale = async () => {
      const [current] = await models.sequelize.query(
        'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId', { replacements: { eventId, showId } }
      );
      if (!current[0]) return res.status(404).json({ success: false, error: 'Event not found' });
      return res.status(409).json(staleSaveBody(expected, current[0]));
    };

    // Deal components (ruling D14, 2026-09-30; docs/DEAL_COMPONENTS_DESIGN.md
    // §3): deal_components is the source of truth and deal_type (with
    // appearance_required) its derived copy for one release. A body with
    // deal_components writes the derived copy; a body with only deal_type or
    // appearance_required (the pre-D14 form) writes the components through
    // the one-to-one map, so the two never disagree.
    // D13: the components before this save, to draft the Terms when they change.
    let componentsBefore;
    {
      const { readComponents, componentsFromDealType, dealTypeFromComponents, componentsOf } = require('../utils/dealComponents');
      if (updates.deal_components !== undefined || updates.deal_type !== undefined || updates.appearance_required !== undefined) {
        const [beforeRows] = await models.sequelize.query(
          'SELECT deal_type, deal_components, appearance_required FROM world_events WHERE id = :eventId AND show_id = :showId',
          { replacements: { eventId, showId } }
        );
        componentsBefore = beforeRows?.[0] ? componentsOf(beforeRows[0]) : undefined;
      }
      if (updates.deal_components !== undefined) {
        const read = readComponents(updates.deal_components === '' ? null : updates.deal_components);
        if (read.error) {
          return res.status(400).json({ success: false, error: 'Invalid value for deal_components', message: read.error });
        }
        const derived = dealTypeFromComponents(read.value);
        updates.deal_components = read.value;
        updates.deal_type = derived.deal_type;
        updates.appearance_required = derived.appearance_required;
      } else if (updates.deal_type !== undefined || updates.appearance_required !== undefined) {
        const [storedDeal] = await models.sequelize.query(
          'SELECT deal_type, appearance_required FROM world_events WHERE id = :eventId AND show_id = :showId',
          { replacements: { eventId, showId } }
        );
        const stored = storedDeal?.[0];
        if (stored) {
          const dealType = updates.deal_type !== undefined ? normalizeDealTypeValue(updates.deal_type) : stored.deal_type;
          const appearance = updates.appearance_required !== undefined ? updates.appearance_required : stored.appearance_required;
          if (dealType == null || DEAL_TYPES.includes(dealType)) {
            updates.deal_components = dealType == null ? null : componentsFromDealType(dealType, appearance === true);
          }
        }
      }
    }

    // Terms lock (§8(x) D4, §8(w) P9; Task #2230). Once the event has
    // started a live episode, its access requirements, compensation,
    // restrictions and episode link cannot change here. A locked field sent
    // with its stored value is not a change, so full-form saves still work.
    if (Object.keys(LOCKED_EVENT_FIELDS).some((f) => updates[f] !== undefined)) {
      const [storedRows] = await models.sequelize.query(
        `SELECT requirements, is_paid, payment_amount, restrictions, used_in_episode_id,
                deal_type, deal_components, appearance_fee, bonus_terms, gifted_value,
                partnership_base_fee, performance_fee, appearance_required
           FROM world_events WHERE id = :eventId AND show_id = :showId`,
        { replacements: { eventId, showId } }
      );
      if (storedRows?.[0]) {
        // D14: a row written with only a deal_type (before its components)
        // is compared as the components that type maps to, so re-sending
        // the same terms is not a change.
        if (storedRows[0].deal_components == null && storedRows[0].deal_type != null) {
          const { componentsOf } = require('../utils/dealComponents');
          storedRows[0].deal_components = componentsOf({ deal_type: storedRows[0].deal_type, appearance_required: storedRows[0].appearance_required });
        }
        const lockEpisode = await findTermsLockEpisode(models.sequelize, eventId);
        if (lockEpisode) {
          // Reopened terms (Reopen ruling, §8(cc); Task #2378): every locked
          // field but the episode link is editable until Save and relock.
          const reopened = await readTermsReopen(models.sequelize, eventId);
          const changed = changedLockedFields(storedRows[0], updates, lockEpisode)
            .filter((f) => !reopened || STAYS_LOCKED_WHILE_REOPENED.has(f));
          if (changed.length > 0) return res.status(409).json(termsLockedBody(lockEpisode, changed));
        }
      }
    }

    // Build dynamic SET clause
    const allowedFields = [
      'name', 'event_type', 'category', 'format', 'host', 'host_brand', 'description',
      'prestige', 'cost_coins', 'strictness',
      'deadline_type', 'deadline_minutes',
      'dress_code', 'dress_code_keywords',
      'location_hint', 'narrative_stakes', 'canon_consequences',
      'seeds_future_events', 'overlay_template', 'required_ui_overlays',
      'browse_pool_bias', 'browse_pool_size', 'rewards', 'status',
      'season_id', 'arc_id',
      'is_paid', 'payment_amount', 'requirements', 'career_tier',
      'career_milestone', 'fail_consequence', 'success_unlock',
      // Restrictions (Task #1814) — what Lala agrees not to do. Its own
      // column, never folded into requirements (access requirements):
      // docs/EVENT_EPISODE_FLOW.md §8(t) item 1.
      'restrictions',
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
      // Narrative chain — parent_event_id sequences this after another,
      // chain_position numbers the spot in the chain, chain_reason
      // explains why this follows. Read by the next-event suggester
      // (chain_continuation +30, seed match +18) and snapshotted into
      // the brief. Settable from the WorldAdmin event form's Narrative
      // Chain section.
      'parent_event_id', 'chain_position', 'chain_reason',
      // Host (Event Package page, Change Host — Task #1642). Durable FK to
      // social_profiles, integer PK (not a UUID) — see WorldEvent.js:97.
      'source_profile_id',
      // Deal type (deal build PR 2, Task #2330): the Event Package's Terms
      // area. One of WorldEvent.DEAL_TYPES, or null; locked with the terms.
      'deal_type',
      // D14 (2026-09-30): the ticked components, a JSON array of keys
      // (src/utils/dealComponents.js), or null; locked with the terms.
      'deal_components',
      // Deal components (deal build PR 3, Task #2341; Evoni's Deal PR 3
      // ruling, §8(cc)): Propose terms drafts the fees from the rate card;
      // Evoni edits them here until the terms lock. appearance_required says a
      // brand partnership also requires an appearance; gifted_value records a
      // gifted deal's non-cash value.
      'appearance_fee', 'partnership_base_fee', 'performance_fee',
      'appearance_required', 'gifted_value',
      // A contractual performance bonus, only when the accepted deal
      // contains one (Q12; deal build PR 5): { slay?, pass?, safe? } coins
      // by evaluation tier, paid at Complete (dealPayoutService). Locks with
      // the terms.
      'bonus_terms',
    ];
    const _requiredStringFields = new Set(['name', 'event_type', 'status']);

    const setClauses = [];
    const replacements = { showId, eventId };
    const integerFields = new Set([
      'prestige', 'cost_coins', 'strictness', 'deadline_minutes',
      'browse_pool_size', 'payment_amount', 'career_tier', 'source_profile_id',
      'appearance_fee', 'partnership_base_fee', 'performance_fee', 'gifted_value',
    ]);
    const DEAL_FEE_FIELDS = new Set(['appearance_fee', 'partnership_base_fee', 'performance_fee', 'gifted_value']);
    const uuidFields = new Set([
      'season_id', 'arc_id', 'scene_set_id', 'source_calendar_event_id',
      'venue_location_id', 'used_in_episode_id', 'outfit_set_id',
    ]);
    const scalarStringFields = new Set([
      'name', 'event_type', 'category', 'format', 'host', 'host_brand', 'description',
      'deadline_type', 'dress_code', 'location_hint', 'narrative_stakes',
      'overlay_template', 'browse_pool_bias', 'status',
      'career_milestone', 'fail_consequence', 'success_unlock',
      'venue_name', 'venue_address', 'event_date', 'event_time',
      'theme', 'mood', 'floral_style', 'border_style',
      'deal_type',
    ]);
    const jsonFields = new Set([
      'dress_code_keywords', 'canon_consequences', 'seeds_future_events',
      'required_ui_overlays', 'rewards', 'requirements', 'color_palette',
      'restrictions', 'bonus_terms', 'deal_components',
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

    // canon_consequences as sent (after null-normalising), kept unstringified
    // so it can be merged with the stored value. undefined = not merging.
    let ccIncoming;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        let val = normalizeNullLike(unwrapScalar(updates[field]));

        // The five canonical tiers, by label (Task #2317). This map used to
        // put Elite at 4 and an unknown "icon" at 5.
        if (field === 'career_tier' && typeof val === 'string') {
          const tier = careerTierFromLabel(val);
          if (tier !== null) val = tier;
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

        if (field === 'canon_consequences' && val !== null) {
          // Merged with the stored value just before the UPDATE (Task #1747).
          // The terms reopen marker and history are server-owned (Task #2378).
          ccIncoming = withoutServerOwnedKeys(val);
        }

        if (DEAL_FEE_FIELDS.has(field) && val !== null && Number(val) < 0) {
          return res.status(400).json({ success: false, error: `Invalid value for ${field}`, message: `${field} must be 0 or more, or null` });
        }

        if (field === 'appearance_required' && typeof val !== 'boolean') {
          return res.status(400).json({ success: false, error: 'Invalid value for appearance_required', message: 'appearance_required must be true or false' });
        }

        if (field === 'deal_type' && val !== null && !DEAL_TYPES.includes(val)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid value for deal_type',
            message: `deal_type must be one of: ${DEAL_TYPES.join(', ')}, or null`,
          });
        }

        if (field === 'bonus_terms') {
          const { normalizeBonusTerms } = require('../services/dealPayoutService');
          const normalized = normalizeBonusTerms(val);
          if (normalized.error) {
            return res.status(400).json({ success: false, error: 'Invalid value for bonus_terms', message: normalized.error });
          }
          val = normalized.value;
        }

        if (field === 'restrictions' && val !== null) {
          const normalized = normalizeRestrictions(val);
          if (normalized.error) {
            return res.status(400).json({ success: false, error: 'Invalid value for restrictions', message: normalized.error });
          }
          val = normalized.value;
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
      const updateSql = `UPDATE world_events SET ${setClauses.join(', ')} WHERE id = :eventId AND show_id = :showId`;
      if (ccIncoming !== undefined || expected.present) {
        // Merge canon_consequences with the stored value instead of
        // replacing it (Task #1747; depth and null-removal rules in
        // mergeCanonConsequences). The row is locked from the read to the
        // write so a concurrent writer can't land in between. The merged
        // string stays in `replacements`, so the core-only retry below
        // writes the merged value too.
        //
        // A versioned save (Task #1788) takes the same lock, and compares
        // the stored updated_at with the one the client read before
        // writing anything — the check and the write are one transaction,
        // so no other writer can land between them.
        await models.sequelize.transaction(async (transaction) => {
          const [rows] = await models.sequelize.query(
            `SELECT canon_consequences${expected.present ? ', updated_at' : ''} FROM world_events WHERE id = :eventId AND show_id = :showId FOR UPDATE`,
            { replacements: { eventId, showId }, transaction }
          );
          if (expected.present && (!rows[0] || !versionMatches(rows[0].updated_at, expected.ms))) {
            const stale = new Error('Stale event save refused');
            stale.staleSave = true;
            throw stale;
          }
          if (ccIncoming !== undefined) {
            replacements.canon_consequences = JSON.stringify(
              mergeCanonConsequences(rows[0]?.canon_consequences, ccIncoming)
            );
          }
          await models.sequelize.query(updateSql, { replacements, transaction });
        });
      } else {
        await models.sequelize.query(updateSql, { replacements });
      }
    } catch (updateErr) {
      if (updateErr.staleSave) return refuseStale();
      const errMsg = String(updateErr.message || '');
      if (errMsg.includes('does not exist') || errMsg.includes('column')) {
        // The retry below runs outside the transaction above, so a
        // versioned save re-checks its version first (best effort: this
        // path only runs when a column is missing).
        if (expected.present) {
          const [cur] = await models.sequelize.query(
            'SELECT updated_at FROM world_events WHERE id = :eventId AND show_id = :showId', { replacements: { eventId, showId } }
          );
          if (!cur[0] || !versionMatches(cur[0].updated_at, expected.ms)) return refuseStale();
        }
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
          'source_profile_id', 'updated_at',
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

    // Deal type (Task #2330): an Auto-drafted deal type follows the rule's
    // inputs, so a changed event type or brand re-drafts it. An Edited one,
    // or one on a locked event, is left alone (dealTypeDraftService).
    if (updates.event_type !== undefined || updates.host_brand !== undefined) {
      await syncDraftedDealType(models.sequelize, eventId);
    }

    // D13 (2026-09-30): changed components draft the whole Terms section,
    // touching only what is still Auto-drafted (dealTermsDraftService). The
    // terms lock refused a change above, so this runs only before it.
    if (updates.deal_components !== undefined && updates.deal_components !== null
      && JSON.stringify(updates.deal_components) !== JSON.stringify(componentsBefore ?? null)) {
      const { syncDraftedTerms } = require('../services/dealTermsDraftService');
      await syncDraftedTerms(models.sequelize, eventId);
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

router.delete('/world/:showId/events/:eventId', requireAuth, async (req, res) => {
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

router.post('/world/:showId/events/:eventId/inject', requireAuth, async (req, res) => {
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

    // Terms lock (§8(x) D4; Task #2230): an event that started a live
    // episode is never moved to another one. Injecting into the same
    // episode again is allowed.
    const lockEpisode = await findTermsLockEpisode(models.sequelize, eventId);
    if (lockEpisode && String(lockEpisode.id) !== String(episode_id)) {
      return res.status(409).json(termsLockedBody(lockEpisode, ['used_in_episode_id'],
        `This event started ${episodeLabel(lockEpisode)}, so it can't be moved to another episode. Its terms and episode link are locked.`));
    }

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

    // F2 (Evoni, 2026-10-01): the required links (the script's tag, the
    // event's episode, its invitation's episode) commit together or not at
    // all. The scene-set link runs in a savepoint: if it can't be made, the
    // event is still attached and the response says the scene set needs
    // reconnecting, with POST .../scene-set-link to retry.
    const { linkEventSceneSet, STATUS } = require('../services/eventSceneSetLinkService');
    const sceneSet = await models.sequelize.transaction(async (t) => {
      await episode.update({ script_content: script.trim() }, { transaction: t });
      await models.sequelize.query(
        `UPDATE world_events SET used_in_episode_id = :episodeId, times_used = COALESCE(times_used, 0) + 1, status = 'used', updated_at = NOW() WHERE id = :eventId`,
        { replacements: { episodeId: episode_id, eventId }, transaction: t }
      );
      // If this event has an approved invitation, stamp the episode_id on the asset
      if (event.invitation_asset_id) {
        await models.sequelize.query(
          `UPDATE assets SET episode_id = :episodeId, updated_at = NOW()
           WHERE id = :assetId AND deleted_at IS NULL`,
          { replacements: { episodeId: episode_id, assetId: event.invitation_asset_id }, transaction: t }
        );
      }
      return linkEventSceneSet(models.sequelize, { event, episodeId: episode_id, transaction: t });
    });
    const sceneSetLinked = sceneSet.status === STATUS.LINKED;

    return res.json({
      success: true,
      attached: true,
      event_tag: eventTag,
      location_tag: locationTag || null,
      scene_set: sceneSet,
      scene_set_linked: sceneSetLinked,
      episode_id,
      message: `Event "${event.name}" injected into episode script.${sceneSetLinked ? ' Scene set auto-linked.' : ''}${sceneSet.status === STATUS.NEEDS_RECONNECTING ? ' Scene set needs reconnecting.' : ''}${sceneSet.status === STATUS.CHOOSE ? ' Choose its scene set.' : ''}`,
    });
  } catch (error) {
    console.error('Inject event error:', error);
    return res.status(500).json({ success: false, error: 'Failed to inject event', message: error.message });
  }
});

// POST /api/v1/world/:showId/events/:eventId/scene-set-link — Retry linking
// an attached event's scene set to its episode (F2), or link the one Evoni
// chose (F3): body { scene_set_id? }. 409 when the event is not attached to
// an episode. The response's scene_set says what happened.
router.post('/world/:showId/events/:eventId/scene-set-link', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const [[event]] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL',
      { replacements: { eventId, showId } }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    if (!event.used_in_episode_id) {
      return res.status(409).json({ success: false, code: 'EVENT_NOT_ATTACHED', error: 'This event is not attached to an episode.' });
    }
    const { linkEventSceneSet } = require('../services/eventSceneSetLinkService');
    const chosenSceneSetId = req.body?.scene_set_id || null;
    if (chosenSceneSetId && typeof chosenSceneSetId !== 'string') {
      return res.status(400).json({ success: false, error: 'scene_set_id must be a string' });
    }
    const sceneSet = await models.sequelize.transaction((t) => linkEventSceneSet(models.sequelize, {
      event, episodeId: event.used_in_episode_id, transaction: t, chosenSceneSetId,
    }));
    return res.json({ success: true, episode_id: event.used_in_episode_id, scene_set: sceneSet });
  } catch (error) {
    console.error('Scene set link error:', error);
    return res.status(500).json({ success: false, error: 'Failed to link the scene set', message: error.message });
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

    // If episode_id is provided, this call will save to it below — refuse
    // before spending the generation work if it would silently replace an
    // existing script.
    let episodeForGuard = null;
    if (episode_id) {
      episodeForGuard = await models.Episode.findByPk(episode_id);
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
      const episode = episodeForGuard || await models.Episode.findByPk(episode_id);
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

// AI event diversification suggestions
router.post('/world/:showId/events/ai-fix', express.json({ limit: '2mb' }), requireAuth, async (req, res) => {
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

router.post('/world/:showId/events/:eventId/generate-invitation', requireAuth, async (req, res) => {
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
    return res.status(isBudgetError(err) ? 429 : 500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/events/:eventId/invitation-text — Get editable invitation text
router.get('/world/:showId/events/:eventId/invitation-text', requireAuth, async (req, res) => {
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
router.post('/world/:showId/events/:eventId/re-render-invitation', requireAuth, async (req, res) => {
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

router.get('/world/:showId/events/:eventId/invitation', requireAuth, async (req, res) => {
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

router.post('/world/:showId/events/:eventId/approve-invitation', requireAuth, async (req, res) => {
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

    // P10 (Evoni, 2026-09-30; Task #2386): the approved invitation is the
    // episode's invitation overlay — tagged, listed in that episode's
    // overlays and placed on the invitation beat. Approving a new version
    // replaces the old one (untagged, its placement removed). Before Start
    // Episode there is no episode yet; Start Episode tags and places it.
    // Idempotent; non-blocking so a failure here doesn't fail the approval.
    let placement = null;
    let invitationOverlay = null;
    if (episodeId) {
      try {
        const { syncEpisodeInvitationOverlay } = require('../services/episodeInvitationOverlayService');
        invitationOverlay = await syncEpisodeInvitationOverlay(models, { eventId, episodeId });
        placement = invitationOverlay.placement;
      } catch (placeErr) {
        console.warn('[approve-invitation] Episode invitation overlay skipped:', placeErr.message);
      }
    }

    return res.json({
      success: true,
      message: 'Invitation approved and linked to event',
      episodeId,
      placement_id: placement?.id || null,
      placement_anchor: invitationOverlay?.anchor || null,
    });
  } catch (err) {
    console.error('[InviteGen] Approve error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── REJECT INVITATION ──────────────────────────────────────────────────────

router.post('/world/:showId/events/:eventId/reject-invitation', requireAuth, async (req, res) => {
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

router.get('/world/:showId/events/:eventId/invitation-history', requireAuth, async (req, res) => {
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

router.post('/world/:showId/events/batch-generate-invitations', requireAuth, async (req, res) => {
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

router.get('/world/:showId/events/:eventId/invitation-pdf', requireAuth, async (req, res) => {
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

router.post('/world/:showId/events/:eventId/animate-invitation', requireAuth, async (req, res) => {
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

router.get('/world/:showId/events/:eventId/animate-invitation/:jobId', requireAuth, async (req, res) => {
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

router.post('/world/:showId/events/:eventId/edit-invitation-text', requireAuth, async (req, res) => {
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

router.post('/world/:showId/events/:eventId/unlink-invitation', requireAuth, async (req, res) => {
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

router.delete('/world/:showId/events/:eventId/invitation/:assetId', requireAuth, async (req, res) => {
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

router.post('/world/:showId/events/:eventId/generate-episode', requireAuth, aiRateLimiter, async (req, res) => {
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
        event = await models.WorldEvent.findByPk(eventId, { attributes: models.WorldEvent.CURRENT_ATTRIBUTES });
        if (event) event = event.toJSON();
      }
    }
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Pull existing wardrobe items for financial calculation
    const episodeGenerator = require('../services/episodeGeneratorService');
    const wardrobeItems = await episodeGenerator.loadFinancialWardrobeItems(models.sequelize, showId);
    const result = await episodeGenerator.generateEpisodeFromEvent(event, models, {
      showId,
      wardrobeItems,
      // L3 (Evoni, 2026-10-02): the locations confirmed in the Episode
      // Locations step; absent, the show's defaults and the event's set.
      locations: req.body?.locations,
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
            const freshEpisode = await models.Episode.findByPk(result.episode.id);
            if (scriptOverwriteBlocked(freshEpisode?.script_content, req.body)) {
              console.warn(`[GenerateEpisode] Skipped script draft for episode ${result.episode.id}: existing script_content present, no confirmOverwrite flag.`);
            } else {
              await models.Episode.update(
                { script_content: skeleton },
                { where: { id: result.episode.id } }
              );
              scriptDrafted = true;
            }
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
    if (error.code === EVENT_EPISODE_CONFLICT_CODE) {
      console.warn('Generate episode refused:', error.message);
      return res.status(409).json(eventEpisodeConflictBody(error.episode));
    }
    if (error.code === DEAL_PRICE_REQUIRED_CODE) {
      console.warn('Generate episode refused:', error.message);
      return res.status(409).json(dealPriceRequiredBody(error));
    }
    if (error instanceof require('../services/episodeLocationsService').EpisodeLocationsError) {
      console.warn('Generate episode refused:', error.message);
      return res.status(error.status).json({ success: false, code: error.code, error: error.message });
    }
    console.error('Generate episode error:', error.message, error.stack?.slice(0, 500));
    return res.status(500).json({ success: false, error: error.message, stack: error.stack?.slice(0, 500) });
  }
});

// GET /world/:showId/events/:eventId/episode-locations — the Episode
// Locations step's starting point (L3, Q12; Evoni, 2026-10-02): home and
// closet from the show's defaults, the event's set, and the roles still to
// choose. Read-only.
router.get('/world/:showId/events/:eventId/episode-locations', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const [[event]] = await models.sequelize.query(
      'SELECT id, show_id, scene_set_id, venue_look FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL',
      { replacements: { eventId, showId } });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    const { proposeLocations } = require('../services/episodeLocationsService');
    const { readVenueLook } = require('../services/venueLookService');
    const { locationAngleGaps } = require('../services/planLocationsService');
    const data = await proposeLocations(models.sequelize, { showId, event });
    // The event's look, shown read-only in the step (Q10), and the angles
    // the planner will ask for that the sets lack (L4, Q19).
    const angleGaps = await locationAngleGaps(models.sequelize, data.locations);
    return res.json({ success: true, data: { ...data, event_look: readVenueLook(event.venue_look), angle_gaps: angleGaps } });
  } catch (error) {
    console.error('Episode locations proposal error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// The Event Venue Look (L1; Evoni, 2026-10-02, answers Q1-Q10,
// docs/EVENT_EPISODE_FLOW.md §8(hh)): how the venue is dressed for this
// occasion. Editable while the event's episode is a draft; locked once it
// is accepted (409 VENUE_LOOK_LOCKED).
//   GET  .../venue-look         { venue_look, editable }
//   PUT  .../venue-look         body { venue_look } — Evoni's edit
//   POST .../venue-look/draft   "Draft from event details" (Haiku); keeps
//                               every part she edited (Q8)
const sendVenueLookError = (res, err, label) => {
  const { VenueLookError } = require('../services/venueLookService');
  if (err instanceof VenueLookError) return res.status(err.status).json({ success: false, code: err.code, error: err.message });
  console.error(`${label} error:`, err);
  return res.status(500).json({ success: false, error: err.message });
};

router.get('/world/:showId/events/:eventId/venue-look', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { getVenueLook } = require('../services/venueLookService');
    const data = await getVenueLook(models.sequelize, { showId: req.params.showId, eventId: req.params.eventId });
    return res.json({ success: true, data });
  } catch (err) {
    return sendVenueLookError(res, err, 'Venue look read');
  }
});

router.put('/world/:showId/events/:eventId/venue-look', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { saveVenueLook } = require('../services/venueLookService');
    const data = await saveVenueLook(models.sequelize, {
      showId: req.params.showId, eventId: req.params.eventId, input: req.body?.venue_look,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendVenueLookError(res, err, 'Venue look save');
  }
});

router.post('/world/:showId/events/:eventId/venue-look/draft', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { draftVenueLook } = require('../services/venueLookService');
    const data = await draftVenueLook(models.sequelize, { showId: req.params.showId, eventId: req.params.eventId });
    return res.json({ success: true, data });
  } catch (err) {
    return sendVenueLookError(res, err, 'Venue look draft');
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

    // Anchor must not already have a live episode. generateEpisodeFromEvent
    // enforces that (Task #1751) and the catch below maps its refusal to
    // 409; a link to a deleted episode does not block. Extras that are
    // already linked to other episodes are skipped with a warning.

    // The extras' terms lock with the episode too, so each deal's price must
    // be complete first (Deal PR 3 ruling, point 6; Task #2341). The anchor
    // is checked inside generateEpisodeFromEvent.
    const extrasMissing = [];
    for (const ev of extras) {
      if (ev.used_in_episode_id) continue;
      const missing = await findMissingPrices(models.sequelize, ev.id);
      extrasMissing.push(...missing.map((m) => ({ ...m, event_id: ev.id, label: `${ev.name}: ${m.label}` })));
    }
    if (extrasMissing.length) {
      const refusal = dealPriceRequiredError(extrasMissing);
      console.warn('Multi-event generate refused:', refusal.message);
      return res.status(409).json(dealPriceRequiredBody(refusal));
    }

    const episodeGenerator = require('../services/episodeGeneratorService');
    const wardrobeItems = await episodeGenerator.loadFinancialWardrobeItems(models.sequelize, showId);
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
            const freshEpisode = await models.Episode.findByPk(newEpisodeId);
            if (scriptOverwriteBlocked(freshEpisode?.script_content, req.body)) {
              console.warn(`[generate-from-many] Skipped script draft for episode ${newEpisodeId}: existing script_content present, no confirmOverwrite flag.`);
            } else {
              await models.Episode.update({ script_content: skeleton }, { where: { id: newEpisodeId } });
              scriptDrafted = true;
            }
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
    if (error.code === EVENT_EPISODE_CONFLICT_CODE) {
      console.warn('Multi-event generate refused:', error.message);
      return res.status(409).json(eventEpisodeConflictBody(error.episode));
    }
    if (error.code === DEAL_PRICE_REQUIRED_CODE) {
      console.warn('Multi-event generate refused:', error.message);
      return res.status(409).json(dealPriceRequiredBody(error));
    }
    console.error('Multi-event generate error:', error.message, error.stack?.slice(0, 500));
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /world/:showId/events/:eventId/regenerate-episode
//
// Replace the existing episode generated from this event with a fresh one.
// Same generator service, told which episode it is replacing: the new
// episode is created first, and the old one is soft-deleted and the event
// relinked in the same transaction (§8(w) P3). Useful when the event has been edited (new outfit,
// stakes, etc.) and the creator wants the episode to reflect those
// changes without losing their place.
router.post('/world/:showId/events/:eventId/regenerate-episode', requireAuth, aiRateLimiter, async (req, res) => {
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

    // The previous episode stays live and linked until its replacement
    // exists: the generator supersedes it (soft-delete) and relinks the event
    // in the same transaction that creates the new episode, so a failure
    // leaves both as they were (§8(w) P3, Task #2210). Its briefs, wardrobe
    // and scene plan are not cascade-deleted, as before.
    const oldEpisodeId = event.used_in_episode_id || null;

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
    const result = await episodeGenerator.generateEpisodeFromEvent(fullEvent, models, { showId, wardrobeItems, replacingEpisodeId: oldEpisodeId });

    return res.status(201).json({
      success: true,
      data: result,
      replaced_episode_id: oldEpisodeId,
      message: `Episode regenerated. Previous episode${oldEpisodeId ? ' soft-deleted' : ' did not exist'}.`,
    });
  } catch (error) {
    if (error.code === EVENT_EPISODE_CONFLICT_CODE) {
      console.warn('Regenerate episode refused:', error.message);
      return res.status(409).json(eventEpisodeConflictBody(error.episode));
    }
    console.error('Regenerate episode error:', error.message, error.stack?.slice(0, 500));
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /world/:showId/events/bulk-delete — Delete multiple events at once
router.post('/world/:showId/events/bulk-delete', requireAuth, async (req, res) => {
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
router.post('/world/:showId/events/from-profile', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { profile_id, event_template } = req.body;
    const models = await getModels();
    if (!models?.SocialProfile) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const profile = await models.SocialProfile.findByPk(profile_id, {
      attributes: ['id', 'handle', 'display_name', 'content_category', 'archetype', 'follower_tier', 'brand_partnerships', 'registry_character_id', 'lala_relevance_score', 'aesthetic_dna', 'city', 'frequent_venues'],
    });
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    const p = profile.toJSON();
    const prestige = p.follower_tier === 'mega' ? 8 : p.follower_tier === 'macro' ? 6 : p.follower_tier === 'mid' ? 4 : 3;

    // Find venue
    const eventAutomation = require('../services/eventAutomationService');
    const fakeCalEvent = { cultural_category: p.content_category || 'creator_economy' };
    let venue = await eventAutomation.findVenue(fakeCalEvent, models, profile);

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
    // Task #1765: a creator's brand partnership is their sponsor, not the
    // event's organizer. This route used to write the first partnership's
    // brand to host_brand and automation.host_brand, and
    // resolveEventOrganizer (frontend eventReadiness.js) lets any brand
    // there win over the creator, so the Event Package read "Organized by
    // <sponsor>". host_brand is null in both homes (the keys are kept, so a
    // profile with no partnerships creates the same event as before) and
    // left for Evoni to set in the Event Package.
    // Task #1790: the creator is not the organizer either. Starting an event
    // from a Feed creator no longer decides their role (docs/
    // EVENT_EPISODE_FLOW.md §8(r): organizer, host/face, sponsor, featured
    // attendees). This route writes no organizer field — not `host`, not
    // source_profile_id (§8(p) ruling 6's interim creator-organizer home),
    // not the automation.host_* copy — and records the creator only as
    // automation.started_from_profile_id, which means "started from" and
    // nothing more. The Event Package offers them as the organizer and as a
    // featured attendee; nothing is saved until Evoni accepts.
    // The partnerships are kept as automation.brand_partnerships (read by
    // characterSyncService.generatePostEventOpportunities as brand sources)
    // and in the narrative sentence below; the profile row still holds them.
    const partnerships = Array.isArray(p.brand_partnerships)
      ? p.brand_partnerships.filter(b => b && typeof b === 'object' && b.brand)
      : [];
    // Same value the narrative sentence always used (first partnership).
    const sponsorBrand = p.brand_partnerships?.[0]?.brand || null;

    // Task #1757: no time and no dress code. This route used to derive the
    // time from prestige (20:00/19:00/18:00) and the dress code (and its
    // keywords) from the profile's content_category (falling back to
    // 'chic'), and saved both to the columns and to the automation copy —
    // so the Event Package showed "Set" for values nobody chose. A profile
    // supplies neither, so the event is created with neither; the Event
    // Package offers suggestions (src/utils/eventBasics.js on the frontend).
    // Task #1755: the system default date (45 days out), replacing the
    // random 7-20 days this route used to pick; flagged below as
    // automation.event_date_auto so the Event Package labels it.
    const eventDateStr = autoScheduledEventDate();

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
    // Task #1790: neither the name nor the description says the creator
    // hosts or organizes the event. Task #2141 (doctrine rule 12): the
    // description is attendee copy, so it no longer states a guest count;
    // the guest list itself is unchanged (automation.guest_profiles).
    const creatorName = p.display_name || p.handle;
    const templateDescription = `An exclusive ${p.content_category || 'creator'} event with ${creatorName}${venue ? ` at ${venue.name}` : ''}.`;

    // Task #2122 (§8(u) R1, R8; §8(v)): one Haiku 4.5 call drafts a concept,
    // an activity and the public description. It never blocks creation:
    // draftEventConcept returns null on any failure, its own rate limit or a
    // budget refusal, and the event keeps the template description with no
    // draft keys. auto_drafted records what was drafted, for step 4's
    // "Auto-drafted · <source>" label.
    const draft = await draftEventConcept(p, { venueName: venue?.name || null, userId: req.user?.id });
    const descriptionText = draft ? draft.description : templateDescription;
    // Task #2124 (§8(u) R7): the same draft may carry styling. With it,
    // dress_code and dress_code_keywords go to their columns and the brief
    // to automation.styling_brief; without it, all three are as before.
    const styling = draft?.styling || null;
    // Task #2126 (§8(u) R3): the draft's category, format and start time,
    // each present only when valid. A field not drafted is saved as before
    // (null) and the Event Package still suggests it.
    const draftedTaxonomy = {};
    for (const field of ['category', 'format', 'event_time']) {
      if (draft?.[field]) draftedTaxonomy[field] = draft[field];
    }
    // Task #2135 (§8(u) R1, R3, R9): the draft's name, present only when
    // valid (under 40 characters, not the fallback). Without one the event
    // keeps "Event with <creator>" as before.
    const draftedName = draft?.name || null;
    const draftAutomation = draft
      ? {
        concept: draft.concept,
        activity: draft.activity,
        ...(styling ? { styling_brief: styling.styling_brief } : {}),
        auto_drafted: {
          description: 'ai_draft',
          concept: 'ai_draft',
          activity: 'ai_draft',
          ...(styling ? { dress_code: 'ai_draft', dress_code_keywords: 'ai_draft', styling_brief: 'ai_draft' } : {}),
          ...Object.fromEntries(Object.keys(draftedTaxonomy).map((field) => [field, 'ai_draft'])),
          ...(draftedName ? { name: 'ai_draft' } : {}),
        },
        // Task #2128 (rule 14): a copy of each drafted column value. The
        // Event Package shows a field Auto-drafted while its column equals
        // this copy and Edited once it differs (the date's event_date_auto
        // pattern). Only fields actually drafted get a copy.
        drafted_values: {
          description: draft.description,
          ...(styling ? { dress_code: styling.dress_code, dress_code_keywords: styling.dress_code_keywords } : {}),
          ...draftedTaxonomy,
          ...(draftedName ? { name: draftedName } : {}),
        },
      }
      : {};
    const narrativeText = `This event could ${prestige >= 6 ? 'elevate' : 'establish'} Lala's position in the ${p.content_category || 'creator'} scene. ${sponsorBrand ? `Brand opportunity with ${sponsorBrand}.` : ''}`;

    const eventData = {
      show_id: showId,
      name: draftedName || `${event_template || 'Event'} with ${creatorName}`,
      event_type: 'invite',
      host: null,
      host_brand: null,
      source_profile_id: null,
      prestige,
      cost_coins: costCoins,
      strictness,
      deadline_type: deadlineType,
      dress_code: styling ? styling.dress_code : null,
      ...(styling ? { dress_code_keywords: styling.dress_code_keywords } : {}),
      location_hint: venueAddress || null,
      // Top-level FK to the WorldLocation. Without this, the venue only
      // lives nested in canon_consequences.automation and Overview's
      // Locations card (which reads venue_location_id directly off the
      // event row) shows nothing for feed-profile-spawned events.
      venue_location_id: venue?.id || null,
      venue_name: venue?.name || null,
      venue_address: venueAddress || null,
      event_date: eventDateStr,
      event_time: draftedTaxonomy.event_time || null,
      ...(draftedTaxonomy.category ? { category: draftedTaxonomy.category } : {}),
      ...(draftedTaxonomy.format ? { format: draftedTaxonomy.format } : {}),
      description: descriptionText,
      narrative_stakes: narrativeText,
      theme: invStyle.theme,
      mood: invStyle.mood,
      color_palette: invStyle.color_palette,
      floral_style: invStyle.floral_style,
      border_style: invStyle.border_style,
      canon_consequences: {
        automation: {
          started_from_profile_id: p.id,
          host_brand: null,
          ...(partnerships.length > 0 ? { brand_partnerships: partnerships } : {}),
          venue_location_id: venue?.id,
          venue_name: venue?.name,
          venue_address: venueAddress,
          guest_profiles: guestList,
          event_date: eventDateStr,
          [AUTO_DATE_KEY]: eventDateStr,
          cost_coins: costCoins,
          strictness,
          deadline_type: deadlineType,
          description: descriptionText,
          ...draftAutomation,
          narrative_stakes: narrativeText,
          theme: invStyle.theme,
          mood: invStyle.mood,
          color_palette: invStyle.color_palette,
          floral_style: invStyle.floral_style,
          border_style: invStyle.border_style,
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
              // T9 (§8(cc); Task #2395): goals written from this event's
              // fields, their count set by its prestige.
              return buildSocialTasks('invite', { platform: 'instagram', content_category: p.content_category || 'creator_economy' }, [], {
                prestige,
                event_name: draftedName || `${event_template || 'Event'} with ${creatorName}`,
                venue_name: venue?.name || null,
                dress_code: styling ? styling.dress_code : null,
                description: descriptionText,
                guest_names: (guestList || []).map((g) => g?.display_name || g?.handle).filter(Boolean),
              });
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
           strictness, deadline_type, dress_code, dress_code_keywords, description, narrative_stakes, location_hint, venue_name,
           venue_address, event_date, event_time, category, format, canon_consequences, status, created_at, updated_at)
           VALUES (:id, :show_id, :name, :event_type, :host, :host_brand, :prestige, :cost_coins,
           :strictness, :deadline_type, :dress_code, :dress_code_keywords::jsonb, :description, :narrative_stakes, :location_hint, :venue_name,
           :venue_address, :event_date, :event_time, :category, :format, :canon_consequences, 'draft', NOW(), NOW())`,
          { replacements: {
            ...eventData,
            // Task #2126: null when not drafted, as the columns are today.
            category: eventData.category || null,
            format: eventData.format || null,
            // Task #2124: the column's default is []; a drafted list replaces it.
            dress_code_keywords: JSON.stringify(eventData.dress_code_keywords || []),
            canon_consequences: JSON.stringify(eventData.canon_consequences),
          } }
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

    // The deal type's first draft (Task #2330; dealTypeDraftService).
    const dealDraft = await syncDraftedDealType(models.sequelize, event.id || eventData.id, { initial: true });
    if (dealDraft.deal_type) {
      if (typeof event.set === 'function') {
        event.set('deal_type', dealDraft.deal_type);
        event.set('deal_components', dealDraft.deal_components);
      } else {
        event.deal_type = dealDraft.deal_type;
        event.deal_components = dealDraft.deal_components;
      }
    }

    res.status(201).json({ success: true, event: event.toJSON ? event.toJSON() : event });
  } catch (err) {
    console.error('POST /world/:showId/events/from-profile error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── FINANCIAL PRESSURE ENDPOINTS ────────────────────────────────────────────

// GET /world/:showId/events/:eventId/affordability — Can Lala afford this event?
router.get('/world/:showId/events/:eventId/affordability', requireAuth, async (req, res) => {
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
    // The ledger balance, as GET /world/:showId/balance reads it (F-Stats-1
    // v1.63 §66.3-F). getCurrentBalance has its own fallbacks; anything it
    // throws reaches the outer catch, which logs.
    const { getCurrentBalance } = require('../services/financialTransactionService');
    const balance = await getCurrentBalance(models.sequelize, showId);

    const { checkAffordability } = require('../services/financialPressureService');
    const result = checkAffordability(event, balance);

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[affordability] failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/decline — Decline event and track as missed opportunity
router.post('/world/:showId/events/:eventId/decline', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
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
router.get('/world/:showId/financial-pressure', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const models = await getModels();

    // Get Lala's balance
    // The ledger balance, as GET /world/:showId/balance reads it (F-Stats-1
    // v1.63 §66.3-F). getCurrentBalance has its own fallbacks; anything it
    // throws reaches the outer catch, which logs.
    const { getCurrentBalance } = require('../services/financialTransactionService');
    const balance = await getCurrentBalance(models.sequelize, showId);

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
    } catch (err) {
      // A fallback: every column here exists in canon (capture 2026-09-17), so this fires only on a real error.
      console.error('[financial-pressure] declined invites query failed:', err.message);
    }

    // Get pending opportunities
    let pendingOpps = [];
    try {
      const [rows] = await models.sequelize.query(
        `SELECT name, status, payment_amount FROM opportunities WHERE show_id = :showId AND deleted_at IS NULL AND status IN ('booked','preparing','active','completed')`,
        { replacements: { showId } }
      );
      pendingOpps = rows;
    } catch (err) {
      // A fallback: the table and its columns exist in canon (capture 2026-09-17).
      console.error('[financial-pressure] opportunities query failed:', err.message);
    }

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
    } catch (err) {
      // A fallback: every column here exists in canon (capture 2026-09-17).
      console.error('[financial-pressure] episode financials query failed:', err.message);
    }

    const { buildFinancialPressureContext } = require('../services/financialPressureService');
    const context = buildFinancialPressureContext(balance, transactions, declinedInvites, pendingOpps);

    return res.json({ success: true, ...context });
  } catch (err) {
    console.error('[financial-pressure] failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/events/:eventId/financial-forecast
// Real-coin forecast for the event's financial impact. Replaces the static
// tier-table estimate that previously lived inline in WorldAdmin's Financial
// Preview card. Sources are honest about where each number came from:
//
//   income   = event_payment  + content_revenue_est (ticked tasks pay no
//              coins: §8(bb) T3, Task #2263)
//   expenses = event_cost     + outfit_retail (owned) + outfit_rentals
//                             + drinks_est + valet_est + photo_booth_est
//
// If no outfit is picked, outfit_retail falls back to a prestige-tiered
// estimate so the UI isn't blank on a fresh event. The Show's live balance
// + goal ladder are included so the frontend can render a single combined
// "can she afford this, and does this push her toward her next goal" view.
router.get('/world/:showId/events/:eventId/financial-forecast', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Event row — raw SQL to tolerate unmigrated columns on older envs.
    let event = null;
    try {
      const [eventRows] = await models.sequelize.query(
        `SELECT id, name, prestige, event_type, cost_coins, is_paid, is_free, payment_amount,
                outfit_pieces, canon_consequences, dress_code, format, rewards, deal_type, deal_components,
                host, host_brand, appearance_fee, partnership_base_fee, performance_fee,
                appearance_required, bonus_terms
         FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1`,
        { replacements: { eventId, showId } }
      );
      event = eventRows?.[0] || null;
    } catch (err) {
      if (err?.original?.code !== '42703' && !String(err?.message || '').includes('is_free')) throw err;
      const [fallbackRows] = await models.sequelize.query(
        `SELECT id, name, prestige, event_type, cost_coins, is_paid, payment_amount,
                outfit_pieces, canon_consequences, dress_code, format, rewards, deal_type, deal_components,
                host, host_brand, appearance_fee, partnership_base_fee, performance_fee,
                appearance_required, bonus_terms
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

    const {
      USD_TO_COINS, RENTAL_RATE,
    } = require('../utils/financialRates');
    const {
      getCurrentBalance, getFinancialGoals,
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
    // A deal event (deal build PR 4, Task #2365) has no cost_coins entry
    // charge: its terms costs are its itemised event_costs rows, as Finalize
    // charges them. A legacy event keeps the entry cost.
    // The extras are event spending since the event cost split (2026-09-30):
    // Start Episode drafts them as Money tab lines and Complete charges
    // them, for every event, so they are estimated here for every event,
    // except a deal event that still has extras cost rows (drafted before
    // the split; Start Episode carries them into spending): those rows are
    // the estimate.
    const { normalizePaidFreeFlags } = require('../utils/paidFreeFlags');
    const { isDeal, eventCost } = normalizePaidFreeFlags(event);
    let drinks = 0;
    let valet = 0;
    let photoBooth = 0;
    let itemised = null;
    if (isDeal) {
      const { listEventCosts, costTotals } = require('../services/eventCostsService');
      const costs = await listEventCosts(models.sequelize, event.id);
      const totals = costTotals(costs);
      itemised = {
        costs: costs.map((c) => ({ id: c.id, kind: c.kind, label: c.label, amount: c.amount, paid_by: c.paid_by })),
        lala_total: totals.lala,
        comped_total: totals.comped,
      };
    }
    if (!isDeal || !itemised.costs.some((c) => c.kind === 'extras')) {
      // The same extras Start Episode drafts (financialRates.eventExtrasFor:
      // the photo booth only on galas, premieres, launches, brand deals or a
      // red-carpet or photo dress code).
      const { eventExtrasFor } = require('../utils/financialRates');
      ({ drinks, valet, photo_booth: photoBooth } = eventExtrasFor(event));
    }

    // ── Income side ─────────────────────────────────────────────────
    // A legacy event: payment_amount when paid, plus the 10% brand-deal
    // content fee finalize-financials books (no delivery is checked, Task
    // #1808). A deal event (deal build PR 5; dealPayoutService): its
    // components, paid at Complete, and its deliverables' content fees,
    // paid on approval; normalizePaidFreeFlags gives it no payment_amount.
    const { eventPayment } = normalizePaidFreeFlags(event);
    const contentRevenueEst = (event.event_type === 'brand_deal' && eventPayment > 0)
      ? Math.round(eventPayment * 0.1)
      : 0;
    let dealComponentsTotal = 0;
    let contentFeesTotal = 0;
    if (isDeal) {
      const { completionPayouts, contentFeeFor } = require('../services/dealPayoutService');
      const { listEventDeliverables } = require('../services/eventTermsService');
      dealComponentsTotal = completionPayouts(event, null).reduce((sum, p) => sum + p.amount, 0);
      const deliverables = await listEventDeliverables(models.sequelize, event.id);
      contentFeesTotal = deliverables.reduce((sum, d) => sum + contentFeeFor(event, d), 0);
    }

    const income = {
      event_payment: eventPayment,
      content_revenue_est: contentRevenueEst,
      deal_components: dealComponentsTotal,
      content_fees: contentFeesTotal,
      total: eventPayment + contentRevenueEst + dealComponentsTotal + contentFeesTotal,
    };

    // ── Tier-dependent bonuses (forecast only) ──────────────────────────
    // Only a deal's contractual bonus (bonus_terms, by evaluation tier) now
    // depends on the tier. The generic tier reward, the paid bonus and the
    // event reward are retired for every completion (Q12 and Evoni's
    // follow-ups, EVENT_EPISODE_FLOW.md §8(cc); deal build PR 5), so a legacy
    // event's tiers all add 0.
    const { normalizeBonusTerms } = require('../services/dealPayoutService');
    const bonusTerms = (isDeal && normalizeBonusTerms(event.bonus_terms).value) || {};
    const tierBonuses = Object.fromEntries(['slay', 'pass', 'safe', 'fail'].map((tier) => {
      const dealBonus = tier === 'fail' ? 0 : (bonusTerms[tier] || 0);
      return [tier, { deal_bonus: dealBonus, total: dealBonus }];
    }));
    const itemisedLala = itemised ? itemised.lala_total : 0;
    const expenses = {
      event_cost: eventCost,
      outfit_retail: outfitRetail,
      outfit_rentals: outfitRentals,
      drinks_est: drinks,
      valet_est: valet,
      photo_booth_est: photoBooth,
      // A deal event's itemised costs (Task #2365): Lala's rows count here;
      // comped rows are listed, never counted.
      itemised,
      total: eventCost + outfitRetail + outfitRentals + drinks + valet + photoBooth + itemisedLala,
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

    // Optimistic / realistic balance projections — adds the tier-bonus
    // total on top of the always-pays net so the preview shows what
    // SLAY or PASS would actually deposit. Frontend renders SLAY as the
    // optimistic ceiling, PASS as the realistic.
    const balanceAfterIfSlay = balanceAfter + tierBonuses.slay.total;
    const balanceAfterIfPass = balanceAfter + tierBonuses.pass.total;

    return res.json({
      success: true,
      currency: 'coins',
      event: { id: event.id, name: event.name, prestige, event_type: event.event_type },
      income,
      expenses,
      net,
      tier_bonuses: tierBonuses,
      projected_balance: {
        baseline: balanceAfter,                 // always-pays only (current behavior)
        if_pass: balanceAfterIfPass,            // realistic: PASS lands all bonuses
        if_slay: balanceAfterIfSlay,            // optimistic: SLAY ceiling
      },
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

// POST /world/:showId/events/:eventId/venue-brief — the Scene Briefs a venue
// generation would send (S2, S5), read-only: the interior (the set's base)
// and the exterior, for this event at its venue World Location, with the
// estimate for the two images. Body: { overrides? }.
router.post('/world/:showId/events/:eventId/venue-brief', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { readBriefOverrides, briefToPrompt } = require('../services/sceneBriefService');
    const briefOverrides = readBriefOverrides(req.body?.overrides);
    if (briefOverrides.error) return res.status(400).json({ success: false, error: briefOverrides.error });
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const [rows] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1',
      { replacements: { eventId, showId } }
    );
    const event = rows?.[0];
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    const { prepareVenueBriefs, loadAttachedSet, attachedSetBaseBrief } = require('../services/venueGenerationService');
    // A scene set already attached: its image is already available, or its
    // missing base is what a generation makes, from this brief and estimate.
    // A set that no longer exists reads as none: a new venue is made.
    const attached = await loadAttachedSet(models, event);
    if (attached) {
      const target = { event_id: event.id, scene_set_id: attached.id, scene_set_name: attached.name, world_location_id: attached.world_location_id || null };
      if (attached.base_still_url) {
        return res.json({
          success: true,
          data: { target: { kind: 'already_available', ...target, venue_image_url: attached.base_still_url }, brief: null, prompt: null, exterior_brief: null, exterior_prompt: null, estimate: null },
        });
      }
      const { brief, estimate: baseEstimate } = await attachedSetBaseBrief(models.sequelize, attached, event.id, { overrides: briefOverrides.value || {} });
      return res.json({
        success: true,
        data: { target: { kind: 'base', ...target }, brief, prompt: briefToPrompt(brief), exterior_brief: null, exterior_prompt: null, estimate: baseEstimate },
      });
    }
    const { draft, interior, exterior, estimate } = await prepareVenueBriefs(models.sequelize, event, { overrides: briefOverrides.value || {} });
    return res.json({
      success: true,
      data: {
        target: { kind: 'venue', event_id: event.id, scene_set_name: draft.name, world_location_id: draft.world_location_id },
        brief: interior,
        prompt: briefToPrompt(interior),
        exterior_brief: exterior,
        exterior_prompt: briefToPrompt(exterior),
        estimate,
      },
    });
  } catch (err) {
    console.error('[VenueGen] venue-brief error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/generate-venue — Generate venue exterior + interior images
// Body: { force?: boolean, overrides? } — when `force` is true the endpoint makes
// a new venue even if the event already has a scene set attached. Otherwise an
// attached set is kept (a venue the user deliberately picked): its image is
// "already available", or its missing base is generated for this event from
// the brief venue-brief showed (S2, S3). A set that no longer exists reads as
// none. overrides: the "Your override" lines confirmed on the brief (S2, S5).
// The response's outcome says what happened: generated, already_available or
// failed.
router.post('/world/:showId/events/:eventId/generate-venue', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const force = req.body?.force === true;
    const { readBriefOverrides } = require('../services/sceneBriefService');
    const briefOverrides = readBriefOverrides(req.body?.overrides);
    if (briefOverrides.error) return res.status(400).json({ success: false, error: briefOverrides.error });
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Load event via raw SQL
    const [rows] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1',
      { replacements: { eventId, showId } }
    );
    const event = rows?.[0];
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // A scene set already attached is kept. Its image is already available,
    // or its missing base is generated now; a set that no longer exists reads
    // as none, and a new venue is generated and linked below.
    const { loadAttachedSet } = require('../services/venueGenerationService');
    const attached = !force ? await loadAttachedSet(models, event) : null;
    if (attached?.base_still_url) {
      return res.json({
        success: true,
        skipped: true,
        outcome: 'already_available',
        data: { kind: 'base', scene_set_id: attached.id, venue_image_url: attached.base_still_url, venue_name: attached.name },
        message: `Venue images already available for "${event.name}": nothing generated`,
      });
    }
    if (attached) {
      const sceneGenService = require('../services/sceneGenerationService');
      await sceneGenService.generateBaseScene(attached, models, { overrides: briefOverrides.value || {}, eventId: event.id });
      await attached.reload();
      if (!attached.base_still_url) throw new Error(`No base image was stored for "${attached.name}"`);
      return res.json({
        success: true,
        outcome: 'generated',
        data: { kind: 'base', scene_set_id: attached.id, venue_image_url: attached.base_still_url, venue_name: attached.name },
        message: `Venue image generated for "${attached.name}"`,
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
    const result = await generateVenueImages(event, models, { overrides: briefOverrides.value || {} });

    return res.json({
      success: true,
      outcome: 'generated',
      data: { kind: 'venue', ...result },
      message: `Venue images generated for "${event.name}" — scene set created`,
    });
  } catch (err) {
    console.error('[VenueGen] Error:', err);
    return res.status(isBudgetError(err) ? 429 : 500).json({ success: false, outcome: 'failed', error: err.message });
  }
});

// POST /world/:showId/events/:eventId/generate-social-checklist
router.post('/world/:showId/events/:eventId/generate-social-checklist', requireAuth, async (req, res) => {
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
          event = await models.WorldEvent.findByPk(eventId, { attributes: models.WorldEvent.CURRENT_ATTRIBUTES });
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
    // T5 (§8(bb); Task #2304): after Start Episode, the episode's copy.
    const episode = await startedEpisodeFor(models.sequelize, eventId);
    const result = await socialChecklistService.generateSocialChecklist(event, models, { forceRebuild: force, episode });

    const where = episode ? " on the episode's task list" : '';
    return res.json({
      success: true,
      data: result,
      message: `${force ? 'Social tasks regenerated' : 'Social checklist generated'} with ${result.tasks.length} tasks${where}`,
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
router.get('/world/:showId/events/:eventId/outfit', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
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
router.put('/world/:showId/events/:eventId/outfit', requireAuth, async (req, res) => {
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
      `SELECT id, name, clothing_category, brand, tier, price, coin_cost, color, is_owned,
              acquisition_type, aesthetic_tags, event_types, occasion, season, era_alignment,
              s3_url, s3_url_processed, times_worn, last_worn_date
       FROM wardrobe WHERE id IN (:ids) AND deleted_at IS NULL`,
      { replacements: { ids: wardrobe_ids.length > 0 ? wardrobe_ids : ['00000000-0000-0000-0000-000000000000'] } }
    );

    // Build outfit pieces snapshot. coin_cost is the story price Finalize
    // charges, as select, purchase and lock do (Task #2346); price is the
    // real-world price, kept for display.
    const outfitPieces = items.map(i => ({
      id: i.id, name: i.name, category: i.clothing_category, brand: i.brand,
      tier: i.tier, price: parseFloat(i.price) || 0, coin_cost: Number(i.coin_cost) || 0, color: i.color,
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
router.get('/world/:showId/events/:eventId/wardrobe-options', requireAuth, async (req, res) => {
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
router.get('/world/:showId/events/:eventId/feed-activity', requireAuth, async (req, res) => {
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
router.post('/world/:showId/events/:eventId/generate-overlay/:overlayType', requireAuth, async (req, res) => {
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
          let hostProfile = null;
          const creator = eventCreatorOrganizer(event);
          if (creator) {
            const [rows] = await sequelize.query(
              'SELECT platform, content_category, archetype FROM social_profiles WHERE id = :id LIMIT 1',
              { replacements: { id: creator.profileId } }
            );
            hostProfile = rows?.[0] || null;
          }
          // T9 (§8(cc); Task #2395): the event row sets the goal count and text.
          socialTasks = buildSocialTasks(event.event_type || 'invite', hostProfile, outfitPieces, { event });
        } catch { socialTasks = []; }
      }
      // T1 (§8(bb); Task #2292): required only from the event's deliverables.
      let deliverables = [];
      try {
        deliverables = await listEventDeliverables(sequelize, event.id);
      } catch (delivErr) {
        console.error('[overlay-generate] Deliverables read failed (no social task is required):', delivErr.message);
      }
      tasks = withDeliverableTasks(socialTasks, deliverables);
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
router.post('/world/:showId/events/:eventId/approve-overlay', requireAuth, async (req, res) => {
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
    const startedEpisode = await startedEpisodeFor(sequelize, eventId);

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
      // T5 (§8(bb); Task #2304): after Start Episode the edited tasks go to
      // the episode's copy (below), not the event's.
      if (meta.tasks && !startedEpisode) auto.social_tasks = typeof meta.tasks === 'string' ? JSON.parse(meta.tasks) : meta.tasks;
    }

    await sequelize.query(
      'UPDATE world_events SET canon_consequences = :cc, updated_at = NOW() WHERE id = :id',
      { replacements: { cc: JSON.stringify({ ...event.canon_consequences, automation: auto }), id: eventId } }
    );

    // T5: an approved social-task edit after Start Episode is saved to the
    // episode's copy, keeping completion for tasks that carry over.
    let savedTo = 'event';
    if (startedEpisode && asset.asset_role === 'UI.OVERLAY.SOCIAL_TASKS' && meta.tasks) {
      const edited = typeof meta.tasks === 'string' ? JSON.parse(meta.tasks) : meta.tasks;
      await writeEpisodeSocialTasks(sequelize, { episodeId: startedEpisode.id, showId, eventId }, edited);
      savedTo = 'episode';
    }

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

    return res.json({ success: true, message: 'Overlay approved', episodeId: event.used_in_episode_id, savedTo });
  } catch (err) {
    console.error('[OverlayApprove] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/reject-overlay
router.post('/world/:showId/events/:eventId/reject-overlay', requireAuth, async (req, res) => {
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
router.post('/world/:showId/events/:eventId/re-render-overlay', requireAuth, async (req, res) => {
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
router.get('/world/:showId/events/:eventId/overlay-tasks/:overlayType', requireAuth, async (req, res) => {
  try {
    const { showId, eventId, overlayType } = req.params;
    const models = req.app?.get?.('models') || require('../models');
    const { sequelize } = models;

    const assetRole = overlayType === 'wardrobe' ? 'UI.OVERLAY.WARDROBE_LIST' : 'UI.OVERLAY.SOCIAL_TASKS';

    // T5 (§8(bb); Task #2304): after Start Episode, social tasks are edited
    // from the episode's copy.
    if (overlayType !== 'wardrobe') {
      const episode = await startedEpisodeFor(sequelize, eventId);
      const onEpisode = episode ? await readEpisodeSocialTasks(sequelize, episode.id) : null;
      if (onEpisode && onEpisode.length > 0) return res.json({ success: true, tasks: onEpisode, source: 'episode', episodeId: episode.id });
    }

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
router.get('/world/:showId/events/:eventId/overlay-history/:overlayType', requireAuth, async (req, res) => {
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
// Producer Mode's "Generate Episode Title" button. Since Task #2386 (P11) it
// goes through the same service as the episode page: the title must be
// approved (409 TITLE_NOT_APPROVED otherwise), the card uses the show's style
// and the source event's visual direction, and a redesign replaces the
// episode's previous card.
router.post('/world/:showId/episodes/:episodeId/generate-title-overlay', requireAuth, aiRateLimiter, async (req, res) => {
  const { showId, episodeId } = req.params;
  const models = req.app?.get?.('models') || require('../models');
  try {
    const { designTitleCard } = require('../services/episodeTitleCardService');
    const result = await designTitleCard(models, episodeId, { showId });
    return res.json({
      success: true,
      data: { assetId: result.assetId, imageUrl: result.imageUrl, title: result.title, replaced: result.replaced },
      message: `Episode title card designed: "${result.title}"`,
    });
  } catch (err) {
    console.error('[EpisodeTitleOverlay] Error:', err.message);
    if (err.code === 'EPISODE_NOT_FOUND') {
      // Stale link: an event has used_in_episode_id pointing to an episode
      // that's been soft- or hard-deleted. Clear the FK so the next page
      // refresh stops showing the orphan button. Best-effort — never let
      // the cleanup throw mask the underlying 404.
      try {
        await models.sequelize.query(
          `UPDATE world_events SET used_in_episode_id = NULL
           WHERE used_in_episode_id = :episodeId AND deleted_at IS NULL`,
          { replacements: { episodeId } }
        );
      } catch (cleanupErr) {
        console.error('[EpisodeTitleOverlay] stale link cleanup failed:', cleanupErr.message);
      }
      return res.status(404).json({
        success: false,
        error: 'Episode not found — it may have been deleted. Stale link cleared; refresh to update the panel.',
        stale_link_cleared: true,
      });
    }
    const status = isBudgetError(err) ? 429 : (err.status && err.status < 600 ? err.status : 500);
    return res.status(status).json({ success: false, error: err.message, code: err.code || null });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// OVERLAY SELECTION — show-level vs episode-level, auto-suggestions
// ═══════════════════════════════════════════════════════════════════════

// GET /world/:showId/events/:eventId/overlay-suggestions
router.get('/world/:showId/events/:eventId/overlay-suggestions', requireAuth, async (req, res) => {
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
router.put('/world/:showId/events/:eventId/overlay-selections', requireAuth, async (req, res) => {
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
router.post('/world/:showId/episodes/:episodeId/generate-story', requireAuth, async (req, res) => {
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
router.get('/world/:showId/stories', requireAuth, async (req, res) => {
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
router.get('/world/:showId/stories/:storyId', requireAuth, async (req, res) => {
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
router.put('/world/:showId/stories/:storyId', requireAuth, async (req, res) => {
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
router.post('/world/:showId/episodes/:episodeId/generate-distribution', requireAuth, async (req, res) => {
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
router.get('/world/:showId/episodes/:episodeId/distribution', requireAuth, async (req, res) => {
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
router.put('/world/:showId/episodes/:episodeId/distribution', requireAuth, async (req, res) => {
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
router.put('/world/:showId/distribution-defaults', requireAuth, async (req, res) => {
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
router.get('/world/:showId/distribution-defaults', requireAuth, async (req, res) => {
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
router.post('/world/:showId/episodes/:episodeId/complete', requireAuth, async (req, res) => {
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
    // Task #2378: nothing books while the event's terms are reopened.
    if (err instanceof TermsReopenedError) return res.status(err.status).json(termsReopenedBody(err));
    // Task #1933: completion refuses a result that would take coins below zero.
    const { InsufficientCoinsError, insufficientCoinsBody } = require('../services/coinBalanceGuard');
    if (err instanceof InsufficientCoinsError) {
      return res.status(err.status).json(insufficientCoinsBody(err));
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// FINANCIAL TRANSACTION PIPELINE — execute, query, and display finances
// ═══════════════════════════════════════════════════════════════════════

// POST /world/:showId/episodes/:episodeId/finalize-financials
router.post('/world/:showId/episodes/:episodeId/finalize-financials', requireAuth, async (req, res) => {
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
    // §8(y) Q6 (Task #2247): a finalize that would take Lala below zero is
    // refused with the same 400 as Complete, and writes nothing.
    // Task #2378: nothing books while the event's terms are reopened.
    if (err instanceof TermsReopenedError) {
      console.error('[Financials] Finalize refused, terms reopened:', err.message);
      return res.status(err.status).json(termsReopenedBody(err));
    }
    const { InsufficientCoinsError, insufficientCoinsBody } = require('../services/coinBalanceGuard');
    if (err instanceof InsufficientCoinsError) {
      return res.status(err.status).json(insufficientCoinsBody(err));
    }
    console.error('[Financials] Finalize error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/financial-ledger — running ledger across all episodes
router.get('/world/:showId/financial-ledger', requireAuth, async (req, res) => {
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

// GET /world/:showId/episodes/:episodeId/money — Episode Money, Phase A
// (§8(aa) M1–M5; Task #2278): the balance, the episode's posted ledger rows
// and net, and the source event's terms as expected lines. Read-only.
router.get('/world/:showId/episodes/:episodeId/money', requireAuth, async (req, res) => {
  try {
    const { showId, episodeId } = req.params;
    const models = req.app?.get?.('models') || require('../models');
    const { getEpisodeMoney } = require('../services/episodeMoneyService');
    const money = await getEpisodeMoney(models.sequelize, { showId, episodeId });
    if (!money) return res.status(404).json({ success: false, error: 'Episode not found' });
    return res.json({ success: true, data: money });
  } catch (err) {
    console.error('[Financials] Episode money error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/events/:eventId/money-preview — Episode Money Phase B,
// MB4 (§8(gg)): before Start Episode, the event's plan as money lines, the
// projection and the early warnings against Lala's ledger balance.
// Read-only; it never blocks Start Episode.
router.get('/world/:showId/events/:eventId/money-preview', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = req.app?.get?.('models') || require('../models');
    const [event] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1',
      { replacements: { eventId, showId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    const { eventMoneyPreview } = require('../services/episodeMoneyService');
    const preview = await eventMoneyPreview(models.sequelize, {
      showId, event, episodeId: event.used_in_episode_id || null,
    });
    return res.json({ success: true, data: preview });
  } catch (err) {
    console.error('[Financials] Event money preview error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/balance — current coin balance
router.get('/world/:showId/balance', requireAuth, async (req, res) => {
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
router.post('/world/:showId/events/:eventId/generate-lists', requireAuth, async (req, res) => {
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

router.get('/world/:showId/events/next-suggestions', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { from_episode_id: fromEpisodeId } = req.query;
    const models = require('../models');
    const { sequelize, WorldEvent, EpisodeBrief } = models;

    // ── 1. Live character state ──
    // Canonical character_key is 'lala' (F-Sec-3 decision; Task #1816).
    const [stateRows] = await sequelize.query(
      `SELECT coins, reputation, brand_trust, influence, stress
       FROM character_state
       WHERE show_id = :showId AND character_key = 'lala'
       LIMIT 1`,
      { replacements: { showId } }
    );
    const state = stateRows?.[0] || { coins: 500, reputation: 1, brand_trust: 1, influence: 1, stress: 0 };
    // Coins are the ledger balance, not the cached copy (Task #2273).
    const { getCurrentBalance } = require('../services/financialTransactionService');
    state.coins = await getCurrentBalance(sequelize, showId);

    // Reputation → career tier gate. Tier 1: rep 0-2, Tier 2: rep 3-4, etc.
    const careerTier = careerTierFromReputation(state.reputation); // canonical bands (Task #2317)

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
      // Scoped to exactly what the scoring/response logic below reads —
      // see the `event: {...}` mapping further down for the full list.
      attributes: [
        'id', 'name', 'event_type', 'host', 'host_brand', 'prestige',
        'cost_coins', 'payment_amount', 'is_paid', 'strictness',
        'career_tier', 'career_milestone', 'parent_event_id', 'source_profile_id',
        'venue_location_id', 'venue_name',
      ],
    });
    // format is read on its own (Task #1640 keeps it out of the scoped
    // attributes above), for the Q8 repeat check; a database without the
    // column just has no format repeats.
    const formatById = {};
    if (candidates.length) {
      try {
        const [fmtRows] = await sequelize.query(
          'SELECT id, format FROM world_events WHERE id IN (:ids)',
          { replacements: { ids: candidates.map(c => c.id) } }
        );
        for (const row of fmtRows) formatById[row.id] = row.format;
      } catch (fmtErr) {
        console.error('[WorldEvents] next-suggestions format read failed (no format repeats):', fmtErr.message);
      }
    }

    // ── 3b. The season (§8(ff) A4, Q8): the next slot's intention, goals,
    // narrative debt, and the last three episodes' events for repeats.
    const { loadSeasonInputs, scoreForSeason } = require('../services/seasonSuggestionService');
    const seasonInputs = await loadSeasonInputs(sequelize, showId);

    // ── 4. Score each candidate ──
    const scored = candidates.map(ev => {
      const e = { ...ev.toJSON(), format: formatById[ev.id] || null };
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

      // The season: fit to the next slot's intention and Lala's goals, and
      // Q8 repeats, which warn and lower the score but never block.
      const season = scoreForSeason(e, state, seasonInputs);
      score += season.score;
      reasons.push(...season.reasons);

      return {
        estimated_pressure: season.estimated_pressure,
        repeats: season.repeats,
        event: {
          id: e.id,
          name: e.name,
          event_type: e.event_type,
          format: e.format,
          venue_name: e.venue_name,
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
        season: {
          next_slot: seasonInputs.slot,
          narrative_debt: seasonInputs.debt.map(d => d.narrative_weight || d.goal_title).filter(Boolean),
        },
      },
    });
  } catch (err) {
    console.error('[WorldEvents] Next suggestions error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;


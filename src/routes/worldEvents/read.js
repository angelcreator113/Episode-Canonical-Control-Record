/**
 * World Events routes — reading events
 *
 * GET    /api/v1/world/:showId/events
 * GET    /api/v1/world/:showId/events/:eventId
 * GET    /api/v1/world/:showId/events/:eventId/start-readiness
 * GET    /api/v1/world/:showId/events/:eventId/package
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { withRegistryLinks } = require('../../utils/registryLink');
const { findTermsLockEpisode, readTermsReopen } = require('../../utils/eventTermsLock');
const { loadScopedEvent } = require('../../utils/eventScope');
const { getModels, loadMoneyPreview } = require('./helpers');

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

/**
 * The single-event GET's payload (everything but `success`), or null when
 * the event is not live in this show: { event, episodeLook, placeLocked,
 * sourceProfile, startedFromProfile, sceneSet, venueLocation,
 * invitationAsset, usedInEpisode, termsLockedBy, termsReopen }. Shared with
 * the Event Package's combined GET (/events/:eventId/package). `row`: the
 * event row, when the caller has already read it.
 */
async function loadEventPayload(models, { showId, eventId, row = null }) {
  const found = row || await loadScopedEvent(models.sequelize, { showId, eventId });
  if (!found) return null;
  // A copy: the JSON columns are parsed in place below.
  const event = { ...found };

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

  // The lookups below are independent of one another, so they run
  // together (audit Low, 2026-10-23); each keeps its own fallback.
  const logLookup = (what) => (e) => { console.error(`[WorldEvents] ${what} lookup failed:`, e.message); return null; };

  // People — host, from the durable FK (WorldEvent.js:97), shown as the
  // linked creator. Null source_profile_id means "not linked" — the page
  // falls back to the legacy `host` text field in that case.
  const sourceProfileP = (event.source_profile_id && models.SocialProfile)
    ? models.SocialProfile.findByPk(event.source_profile_id, {
      attributes: ['id', 'handle', 'display_name', 'platform'],
    }).catch(logLookup('source profile'))
    : Promise.resolve(null);

  // The creator this event was started from on the Feed (Task #1790):
  // automation.started_from_profile_id. Not the organizer — the Event
  // Package offers them as a suggestion only. Read-only.
  const startedFromId = event.canon_consequences?.automation?.started_from_profile_id;
  const startedFromP = (async () => {
    if (!startedFromId || !models.SocialProfile) return null;
    const profile = await models.SocialProfile.findByPk(startedFromId, {
      attributes: ['id', 'handle', 'display_name', 'platform'],
    }).catch(logLookup('started-from profile'));
    if (!profile) return null;
    // Its registry_character_id, read from the registry entry (ruling C3),
    // for the Event Package's organizer choice.
    const [linked] = await withRegistryLinks(models, [profile])
      .catch((e) => { console.error('[WorldEvents] started-from registry link lookup failed:', e.message); return [profile.toJSON()]; });
    return linked;
  })();

  // Place — the linked scene set's name
  const sceneSetP = (event.scene_set_id && models.SceneSet)
    ? models.SceneSet.findByPk(event.scene_set_id, { attributes: ['id', 'name'] }).catch(logLookup('scene set'))
    : Promise.resolve(null);

  // Place — the linked World Location's type and its own dress code, read
  // only as inputs to the Event Package's dress-code suggestion (Task
  // #1755). Nothing here is written.
  // The id lives top-level or, for calendar-spawned events, only in the
  // automation copy (the frontend's resolveEventVenueAndDate rule).
  const venueLocationId = event.venue_location_id || event.canon_consequences?.automation?.venue_location_id || null;
  const venueLocationP = (async () => {
    if (!venueLocationId || !models.WorldLocation) return null;
    const loc = await models.WorldLocation.findByPk(venueLocationId, {
      attributes: ['id', 'name', 'venue_type', 'venue_details'],
    }).catch(logLookup('venue location'));
    if (!loc) return null;
    const details = loc.venue_details && typeof loc.venue_details === 'object' ? loc.venue_details : {};
    return {
      id: loc.id,
      name: loc.name,
      venue_type: loc.venue_type || null,
      dress_code: typeof details.dress_code === 'string' && details.dress_code.trim() ? details.dress_code.trim() : null,
    };
  })();

  // Invitation — status + preview
  const invitationAssetP = (event.invitation_asset_id && models.Asset)
    ? models.Asset.findByPk(event.invitation_asset_id, {
      attributes: ['id', 's3_url_processed', 's3_url_raw', 'approval_status'],
    }).catch(logLookup('invitation asset'))
    : Promise.resolve(null);

  // Used events — hide Change Host / Edit details / Start Episode once set
  const usedInEpisodeP = (event.used_in_episode_id && models.Episode)
    ? models.Episode.findByPk(event.used_in_episode_id, {
      // evaluation_status: the venue look locks when it is accepted (Q9).
      attributes: ['id', 'episode_number', 'title', 'evaluation_status'],
    }).catch(logLookup('used-in episode'))
    : Promise.resolve(null);

  // The episode whose Start Episode locked these terms (Task #2356), found
  // the way the lock itself finds it (findTermsLockEpisode): the live brief
  // that names this event first (§8(w) P2), else the used_in_episode_id
  // stamp. The Event Package reads as read-only while this is set, so it
  // never offers an edit the server would refuse.
  const termsLockedByP = (async () => {
    try {
      const lockEpisode = await findTermsLockEpisode(models.sequelize, event.id);
      if (!lockEpisode) return null;
      return {
        id: lockEpisode.id,
        episode_number: lockEpisode.episode_number ?? null,
        title: lockEpisode.title ?? null,
      };
    } catch (lockErr) {
      console.error('[WorldEvents] terms lock lookup failed:', lockErr.message);
      return null;
    }
  })();

  // L13 (§8(hh)): the Place stays editable until the episode is accepted.
  const placeLockedP = (async () => {
    try {
      return await require('../../utils/placeLock').isPlaceLocked(models.sequelize, event.id);
    } catch (placeErr) {
      console.error('[WorldEvents] place lock lookup failed:', placeErr.message);
      return false;
    }
  })();

  const [sourceProfile, startedFromProfile, sceneSet, venueLocation, invitationAsset, usedInEpisode, termsLockedBy, placeLocked] =
    await Promise.all([sourceProfileP, startedFromP, sceneSetP, venueLocationP, invitationAssetP, usedInEpisodeP, termsLockedByP, placeLockedP]);

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

  // Lala's look once the event has started an episode: it is chosen in
  // the episode's styling game, not on the event (episodeLookCharges
  // episodeLook, the rule Finalize charges by). null before Start Episode.
  let episodeLook = null;
  const lookEpisodeId = termsLockedBy?.id || event.used_in_episode_id || null;
  if (lookEpisodeId) {
    try {
      episodeLook = await require('../../services/episodeLookCharges').episodeLook(models.sequelize, { episodeId: lookEpisodeId, event, showId: event.show_id || showId });
    } catch (lookErr) {
      console.error('[WorldEvents] episode look lookup failed:', lookErr.message);
    }
  }

  return {
    event,
    episodeLook,
    placeLocked,
    sourceProfile: sourceProfile ? sourceProfile.toJSON() : null,
    startedFromProfile: startedFromProfile || null,
    sceneSet: sceneSet ? sceneSet.toJSON() : null,
    venueLocation,
    invitationAsset: invitationAsset ? invitationAsset.toJSON() : null,
    usedInEpisode: usedInEpisode ? usedInEpisode.toJSON() : null,
    termsLockedBy,
    termsReopen,
  };
}

router.get('/world/:showId/events/:eventId', requireAuth, async (req, res, next) => {
  // Registered before /events/next-suggestions, which it would otherwise
  // swallow as an event id (Task #2273).
  if (req.params.eventId === 'next-suggestions') return next();
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const payload = await loadEventPayload(models, { showId, eventId });
    if (!payload) return res.status(404).json({ success: false, error: 'Event not found' });
    return res.json({ success: true, ...payload });
  } catch (error) {
    console.error('Get single event error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load event', message: error.message });
  }
});


// ═══════════════════════════════════════════
// GET /api/v1/world/:showId/events/:eventId/start-readiness
//
// What would stop Start Episode, asked of the same function Start Episode
// refuses with (startReadiness / findStartBlockers, services/
// startReadinessService.js), so the two never disagree. Read-only.
//
// 200 { success: true, data: {
//   ready: boolean,                       // true exactly when Start Episode would not refuse
//   blockers: [{ key, label, detail?, ... }],
//     // key 'episode_exists' (+ episode: { id, title, episode_number, show_id })
//     //     → Start Episode answers 409 EVENT_ALREADY_HAS_EPISODE
//     // key 'prices_missing' (+ missing: [{ key, label, ... }])
//     //     → Start Episode answers 409 DEAL_PRICE_REQUIRED
//   warnings: [{ key, label, detail? }],  // not refused by the server:
//     // 'place_venue', 'look_outfit', 'document_shopping_list', 'document_offer_letter'
// } }
// 404 when the event is not live in this show.
// ═══════════════════════════════════════════

router.get('/world/:showId/events/:eventId/start-readiness', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const event = await loadScopedEvent(models.sequelize, { showId, eventId });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    const { startReadiness } = require('../../services/startReadinessService');
    const data = await startReadiness(models.sequelize, event);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Start readiness error:', error);
    return res.status(500).json({ success: false, error: 'Failed to check Start Episode readiness', message: error.message });
  }
});


// ═══════════════════════════════════════════
// GET /api/v1/world/:showId/events/:eventId/package
//
// Everything the Event Package page loads, in one request, for the page
// split (not yet used by the frontend). Same auth as the single-event GET.
// The event row is read once (404 when it is not live in this show); then
// every part loads in parallel through the same loader its own route uses,
// and fails on its own: a failed part is null and its message is under
// errors.<part>; the others still answer.
//
// 200 {
//   success: true,
//   eventPayload: { event, episodeLook, placeLocked, sourceProfile,      // GET /events/:eventId,
//                   startedFromProfile, sceneSet, venueLocation,         // minus `success`
//                   invitationAsset, usedInEpisode, termsLockedBy,
//                   termsReopen } | null,
//   moneyPreview: <GET /events/:eventId/money-preview data> | null,
//   seasonContext: <GET /season/event/:eventId context> | null,
//   deliverables: { deliverables: [...], locked: boolean } | null,      // GET .../deliverables, minus success
//   costs: { costs: [...], drafted: {...}, deal: boolean, locked: boolean } | null,  // GET .../costs, minus success
//   documents: <GET .../documents data> | null,
//   termsLock: { locked: boolean,              // the write lock (findTermsWriteLock; false while reopened)
//                episode: { id, episode_number, title } | null,       // the episode that locks the terms
//                reopen: { at, by, episode_id } | null } | null,
//   readiness: <GET .../start-readiness data> | null,
//   errors: { <part>: message }               // present only when a part failed
// }
// ═══════════════════════════════════════════

const EVENT_PACKAGE_PARTS = Object.freeze([
  'eventPayload', 'moneyPreview', 'seasonContext', 'deliverables', 'costs', 'documents', 'termsLock', 'readiness',
]);

// The terms lock as the page shows it, or null when the event is gone.
async function loadTermsLock(sequelize, eventId) {
  const lockEpisode = await findTermsLockEpisode(sequelize, eventId);
  if (!lockEpisode) return { locked: false, episode: null, reopen: null };
  const marker = await readTermsReopen(sequelize, eventId);
  return {
    locked: !marker,
    episode: { id: lockEpisode.id, episode_number: lockEpisode.episode_number ?? null, title: lockEpisode.title ?? null },
    reopen: marker ? { at: marker.at ?? null, by: marker.by ?? null, episode_id: marker.episode_id ?? null } : null,
  };
}

/**
 * The combined GET's parts for an event row already read in this show.
 * `loaders` replaces part loaders (tests). Returns { <part>: value | null,
 * errors? }.
 */
async function loadEventPackage(models, { showId, eventId, row, loaders = {} }) {
  const { sequelize } = models;
  const defaults = {
    eventPayload: () => loadEventPayload(models, { showId, eventId, row }),
    moneyPreview: () => loadMoneyPreview(sequelize, { showId, eventId, event: row }),
    seasonContext: () => require('../../services/seasonSlotService').eventSeasonContext(sequelize, showId, eventId),
    deliverables: () => require('../eventDeliverables').loadDeliverables(sequelize, { showId, eventId }),
    costs: () => require('../eventCosts').loadCosts(sequelize, { showId, eventId }),
    documents: () => require('../../services/eventDocumentsService').getDocuments(models, { showId, eventId }),
    termsLock: () => loadTermsLock(sequelize, eventId),
    readiness: () => require('../../services/startReadinessService').startReadiness(sequelize, row),
  };
  const settled = await Promise.all(EVENT_PACKAGE_PARTS.map(async (part) => {
    try {
      const value = await (loaders[part] || defaults[part])();
      return [part, value ?? null, null];
    } catch (err) {
      console.error(`[EventPackage] ${part} failed:`, err.message);
      return [part, null, err.message || 'Failed to load'];
    }
  }));
  const out = {};
  const errors = {};
  for (const [part, value, error] of settled) {
    out[part] = value;
    if (error) errors[part] = error;
  }
  if (Object.keys(errors).length) out.errors = errors;
  return out;
}

router.get('/world/:showId/events/:eventId/package', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const row = await loadScopedEvent(models.sequelize, { showId, eventId });
    if (!row) return res.status(404).json({ success: false, error: 'Event not found' });
    const parts = await loadEventPackage(models, { showId, eventId, row });
    return res.json({ success: true, ...parts });
  } catch (error) {
    console.error('Event package error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load the Event Package', message: error.message });
  }
});

module.exports = router;
module.exports.loadEventPackage = loadEventPackage;
module.exports.EVENT_PACKAGE_PARTS = EVENT_PACKAGE_PARTS;

'use strict';

/**
 * Start Episode readiness — one function for both questions:
 *   - "may this event start an episode?" (generateEpisodeFromEvent's
 *     refusals, episodeGeneratorService.js), and
 *   - "what would stop it?" (GET /world/:showId/events/:eventId/start-readiness).
 * The two can therefore never disagree.
 *
 * Blockers are exactly the server's Start Episode refusals, in the order
 * Start Episode checks them, each with the error code Start Episode
 * answers it with:
 *   episode_exists  — the event is linked to a live episode (one event, one
 *                     episode; Task #1751) → 409 EVENT_ALREADY_HAS_EPISODE.
 *                     A Regenerate's own episode does not block.
 *   prices_missing  — a deal price Start Episode needs is missing (Deal PR 3
 *                     ruling, point 6; findMissingPrices) → 409
 *                     DEAL_PRICE_REQUIRED. Not asked on a Regenerate.
 *
 * Warnings are things the server does NOT refuse Start Episode for, listed
 * so the page can say so (no new rule is added here):
 *   place_venue     — no World Location linked as the venue (top-level or
 *                     the automation copy; the page's own venue gate).
 *   look_outfit     — no outfit chosen (outfit_set_id or outfit_pieces);
 *                     Beat 8 needs one later.
 *   document_<type> — the shopping list / career plan is not approved, so
 *                     Start Episode will not put it on the episode's lists
 *                     (eventDocumentsService.approvedDocument).
 */

const {
  findLiveLinkedEpisode, eventEpisodeConflictError, eventEpisodeConflictMessage,
} = require('../utils/eventEpisodeLink');
const { findMissingPrices, dealPriceRequiredError } = require('./dealPricingService');

const BLOCKER_KEYS = Object.freeze({ EPISODE_EXISTS: 'episode_exists', PRICES_MISSING: 'prices_missing' });

/**
 * The blockers for what has been read: `liveEpisode` (findLiveLinkedEpisode,
 * or null), `missing` (findMissingPrices, or undefined when not asked).
 * Pure.
 */
function startBlockersFrom({ liveEpisode = null, missing, replacingEpisodeId = null } = {}) {
  const blockers = [];
  if (liveEpisode && !(replacingEpisodeId && liveEpisode.id === replacingEpisodeId)) {
    blockers.push({
      key: BLOCKER_KEYS.EPISODE_EXISTS,
      label: 'This event already started an episode',
      detail: eventEpisodeConflictMessage(liveEpisode),
      episode: liveEpisode,
    });
  }
  if (Array.isArray(missing) && missing.length) {
    blockers.push({
      key: BLOCKER_KEYS.PRICES_MISSING,
      label: 'Price required',
      detail: dealPriceRequiredError(missing).message,
      missing,
    });
  }
  return blockers;
}

/**
 * Reads and returns the Start Episode blockers for an event.
 * `stopAtFirst`: Start Episode's path — it stops reading once one blocker
 * is found, as its checks always have. A failed live-episode lookup is
 * logged and skipped, as Start Episode's pre-check always did.
 */
async function findStartBlockers(sequelize, eventId, { replacingEpisodeId = null, stopAtFirst = false, transaction } = {}) {
  const tx = transaction ? { transaction } : {};
  let liveEpisode = null;
  try {
    liveEpisode = await findLiveLinkedEpisode(sequelize, eventId, tx);
  } catch (checkErr) {
    // Column may not exist, skip check
    console.warn('[EpisodeGenerator] used-event check skipped:', checkErr.message);
  }
  const first = startBlockersFrom({ liveEpisode, replacingEpisodeId });
  if (first.length && stopAtFirst) return first;
  // A regenerate replaces an episode whose terms are already locked, so its
  // prices are not asked again.
  if (replacingEpisodeId) return first;
  const missing = await findMissingPrices(sequelize, eventId, tx);
  return startBlockersFrom({ liveEpisode, missing, replacingEpisodeId });
}

/** The error Start Episode throws for a blocker; routes map it to 409. */
function startRefusalError(blocker) {
  if (blocker.key === BLOCKER_KEYS.EPISODE_EXISTS) return eventEpisodeConflictError(blocker.episode);
  if (blocker.key === BLOCKER_KEYS.PRICES_MISSING) return dealPriceRequiredError(blocker.missing);
  return new Error(blocker.detail || blocker.label);
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[StartReadiness] unreadable JSON on the event:', err.message);
    return fallback;
  }
}

/** The warnings for an event row (see the header). Pure. */
function startWarnings(event) {
  const warnings = [];
  const cc = parseJson(event?.canon_consequences, {}) || {};
  const automation = cc.automation && typeof cc.automation === 'object' ? cc.automation : {};

  const venueLocationId = event?.venue_location_id || automation.venue_location_id || null;
  if (!venueLocationId) {
    const venueName = event?.venue_name || automation.venue_name || null;
    warnings.push({
      key: 'place_venue',
      label: 'No venue linked',
      ...(venueName ? { detail: `Needs a World Location link (saved name: ${venueName})` } : {}),
    });
  }

  const pieces = parseJson(event?.outfit_pieces, []);
  if (!event?.outfit_set_id && !(Array.isArray(pieces) && pieces.length > 0)) {
    warnings.push({ key: 'look_outfit', label: 'No outfit chosen', detail: 'Beat 8 needs an outfit; it will have to be chosen before then.' });
  }

  const { approvedDocument, DOC_TYPES } = require('./eventDocumentsService');
  const { isOfferEvent } = require('./offerLetterService');
  for (const [type, { label }] of Object.entries(DOC_TYPES || {})) {
    // An offer letter is for deal events only (Evoni, 2026-10-24).
    if (type === 'offer_letter' && !isOfferEvent(event)) continue;
    if (!approvedDocument(event, type)) {
      warnings.push({
        key: `document_${type}`,
        label: `${label} not approved`,
        detail: type === 'offer_letter'
          ? 'Start Episode places only an approved offer letter on the episode (beat 6, after the invitation).'
          : `Start Episode puts only an approved ${label.toLowerCase()} on the episode's lists.`,
      });
    }
  }
  return warnings;
}

/**
 * The readiness answer for an event row: { ready, blockers, warnings }.
 * `ready` is true exactly when Start Episode would not refuse.
 */
async function startReadiness(sequelize, event) {
  const blockers = await findStartBlockers(sequelize, event.id);
  return { ready: blockers.length === 0, blockers, warnings: startWarnings(event) };
}

module.exports = {
  BLOCKER_KEYS,
  startBlockersFrom,
  findStartBlockers,
  startRefusalError,
  startWarnings,
  startReadiness,
};

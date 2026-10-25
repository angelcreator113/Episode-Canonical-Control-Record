/**
 * World Events routes — saving and deleting an event
 *
 * PUT    /api/v1/world/:showId/events/:eventId
 * DELETE /api/v1/world/:showId/events/:eventId
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { mergeCanonConsequences } = require('../../utils/canonConsequencesMerge');
const { parseExpectedVersion, versionMatches, staleSaveBody } = require('../../utils/eventVersion');
const { normalizeRestrictions } = require('../../services/eventTermsService');
const { careerTierFromLabel } = require('../../utils/careerTiers');
const { findTermsLockEpisode, changedLockedFields, termsLockedBody, LOCKED_EVENT_FIELDS, readTermsReopen, STAYS_LOCKED_WHILE_REOPENED, withoutServerOwnedKeys } = require('../../utils/eventTermsLock');
const { syncDraftedDealType } = require('../../services/dealTypeDraftService');
const { DEAL_TYPES, CATEGORY_VALUES, FORMAT_VALUES } = require('../../models/WorldEvent');
const { loadScopedEvent } = require('../../utils/eventScope');
const { getModels } = require('./helpers');

// Every status an event row carries: draft | ready | used | archived
// (WorldEvent.js) plus the values the server's own writers set — filmed
// (episodeCompletionService) and declined (financialPressureService). The
// event PUT accepts these and nothing else (audit Medium, 2026-10-23).
const EVENT_STATUSES = Object.freeze(['draft', 'ready', 'used', 'archived', 'filmed', 'declined']);

// The event PUT's value lists and numeric ranges (audit Medium, 2026-10-23).
const ENUM_FIELDS = Object.freeze({ category: CATEGORY_VALUES, format: FORMAT_VALUES, status: EVENT_STATUSES });
const NUMERIC_RANGES = Object.freeze({
  prestige: { min: 1, max: 10 },
  strictness: { min: 1, max: 10 },
  cost_coins: { min: 0 },
  payment_amount: { min: 0 },
  deadline_minutes: { min: 0 },
});

// A refusal raised inside the event PUT's write transaction, answered with
// its own status and body once the transaction has rolled back.
class EventPutRefusal extends Error {
  constructor(status, body) {
    super(body?.error || 'Event save refused');
    this.status = status;
    this.body = body;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The event PUT's reference fields, checked only when the save changes them
// (a stored value re-sent is not checked): each must name a live row, in
// this show where the table has show_id. world_locations and social_profiles
// are universe-wide (no show_id), so only their existence is checked.
// season_id has no table to check against and is not checked. Returns a 400
// body, or null.
const EVENT_REFERENCES = [
  { field: 'used_in_episode_id', table: 'episodes', scoped: true, uuid: true, label: 'episode' },
  { field: 'parent_event_id', table: 'world_events', scoped: true, uuid: true, label: 'event' },
  { field: 'arc_id', table: 'show_arcs', scoped: true, uuid: true, label: 'arc' },
  { field: 'venue_location_id', table: 'world_locations', scoped: false, uuid: true, label: 'location' },
  { field: 'source_profile_id', table: 'social_profiles', scoped: false, uuid: false, label: 'profile' },
];

async function refuseEventReferences(sequelize, { showId, eventId, values, stored, transaction }) {
  const bad = (field, message) => ({ success: false, error: `Invalid value for ${field}`, message, code: 'INVALID_EVENT_REFERENCE', field });
  for (const ref of EVENT_REFERENCES) {
    const value = values[ref.field];
    if (value === undefined || value === null) continue;
    if (stored && String(stored[ref.field] ?? '') === String(value)) continue;
    if (ref.uuid && (typeof value !== 'string' || !UUID_RE.test(value))) {
      return bad(ref.field, `${ref.field} must be a UUID or null`);
    }
    if (ref.field === 'parent_event_id' && String(value) === String(eventId)) {
      return bad(ref.field, 'An event cannot follow itself.');
    }
    const [rows] = await sequelize.query(
      `SELECT id FROM ${ref.table} WHERE id = :id${ref.scoped ? ' AND show_id = :showId' : ''} AND deleted_at IS NULL LIMIT 1`,
      { replacements: { id: value, showId }, transaction }
    );
    if (!rows?.[0]) {
      return bad(ref.field, ref.scoped ? `That ${ref.label} does not exist in this show.` : `That ${ref.label} does not exist.`);
    }
  }
  // 'used' is the status of an event linked to an episode (Start Episode or
  // inject set both). A save may keep a stored 'used', but may not set it on
  // an event that has no episode link after the save.
  if (values.status === 'used' && stored && stored.status !== 'used') {
    const link = values.used_in_episode_id !== undefined ? values.used_in_episode_id : stored.used_in_episode_id;
    if (!link) {
      return bad('status', "status 'used' needs an episode link: start an episode from the event, or link it to one.");
    }
  }
  return null;
}

// A deal_type body value as the PUT loop reads it: '', 'null' and
// 'undefined' are null (normalizeNullLike), anything else as sent.
function normalizeDealTypeValue(value) {
  if (value == null) return null;
  if (typeof value === 'string' && ['', 'null', 'undefined'].includes(value.trim().toLowerCase())) return null;
  return value;
}

// ═══════════════════════════════════════════
// PUT /api/v1/world/:showId/events/:eventId
// ═══════════════════════════════════════════

router.put('/world/:showId/events/:eventId', express.json({ limit: '2mb' }), requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    // An empty body counts as none (app.js turns a missing body into {}).
    if (!req.body || typeof req.body !== 'object' || !Object.keys(req.body).length) {
      return res.status(400).json({
        success: false,
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
      const current = await loadScopedEvent(models.sequelize, { showId, eventId });
      if (!current) return res.status(404).json({ success: false, error: 'Event not found' });
      return res.status(409).json(staleSaveBody(expected, current));
    };

    // Deal components (ruling D14, 2026-09-30; docs/DEAL_COMPONENTS_DESIGN.md
    // §3): deal_components is the source of truth and deal_type (with
    // appearance_required) its derived copy for one release. A body with
    // deal_components writes the derived copy; a body with only deal_type or
    // appearance_required (the pre-D14 form) writes the components through
    // the one-to-one map, so the two never disagree.
    // D13: the components before this save, to draft the Terms when they
    // change — read from the locked row in the write transaction below.
    let componentsBefore;
    {
      const { readComponents, componentsFromDealType, dealTypeFromComponents } = require('../../utils/dealComponents');
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

    // The terms lock (§8(x) D4, §8(w) P9; Task #2230) and the Place lock
    // (L13, §8(hh)) are checked inside the write transaction below, against
    // the locked row (audit Medium, 2026-10-23), so no other writer can land
    // between the check and the write.
    //
    // The event's set as read before validation, only so the version check
    // in refuseEventSet below knows which set is this event's own.
    let storedSceneSetId = null;
    if (updates.scene_set_id !== undefined) {
      const stored = await loadScopedEvent(models.sequelize, { showId, eventId, columns: 'scene_set_id' });
      storedSceneSetId = stored?.scene_set_id || null;
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
              success: false,
              error: `Invalid value for ${field}`,
              message: `${field} must be a number or null`,
            });
          }
          val = Math.trunc(numeric);
          // Ranges (audit Medium, 2026-10-23): WorldEvent.js documents
          // prestige and strictness as 1-10; amounts and minutes are never
          // negative.
          const range = NUMERIC_RANGES[field];
          if (range && (val < range.min || (range.max != null && val > range.max))) {
            return res.status(400).json({
              success: false,
              error: `Invalid value for ${field}`,
              message: range.max != null ? `${field} must be from ${range.min} to ${range.max}` : `${field} must be ${range.min} or more`,
            });
          }
        }

        if (field === 'chain_position' && val !== null) {
          const numeric = Number(val);
          if (typeof val === 'boolean' || !Number.isInteger(numeric) || numeric < 0) {
            return res.status(400).json({
              success: false,
              error: 'Invalid value for chain_position',
              message: 'chain_position must be a whole number, 0 or more, or null',
            });
          }
          val = numeric;
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
          const { normalizeBonusTerms } = require('../../services/dealPayoutService');
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
              success: false,
              error: `Invalid value for ${field}`,
              message: `${field} must be a string, UUID, or null`,
            });
          }
        }

        // The model's own value lists (WorldEvent.js CATEGORY_VALUES,
        // FORMAT_VALUES; status per EVENT_STATUSES) — the raw UPDATE skips
        // Sequelize's isIn (audit Medium, 2026-10-23).
        // A blank category or format (Quick Episode Creator's Custom Event
        // sends format '') clears it rather than being refused.
        if ((field === 'category' || field === 'format') && typeof val === 'string' && !val.trim()) val = null;
        const allowedValues = ENUM_FIELDS[field];
        if (allowedValues && (val === null ? field === 'status' : !allowedValues.includes(val))) {
          return res.status(400).json({
            success: false,
            error: `Invalid value for ${field}`,
            message: `${field} must be one of: ${allowedValues.join(', ')}${field === 'status' ? '' : ', or null'}`,
            allowed: allowedValues,
          });
        }

        if (field === 'scene_set_id' && val !== null) {
          if (typeof val !== 'string') {
            return res.status(400).json({
              success: false,
              error: 'Invalid value for scene_set_id',
              message: 'scene_set_id must be a UUID string or null',
            });
          }

          if (!models.SceneSet) {
            return res.status(500).json({
              success: false,
              error: 'SceneSet model not loaded',
              message: 'Unable to validate scene_set_id',
            });
          }

          const sceneSet = await models.SceneSet.findByPk(val, {
            attributes: ['id', 'show_id'],
          });

          if (!sceneSet) {
            return res.status(400).json({
              success: false,
              error: 'Invalid scene_set_id',
              message: 'Selected scene set does not exist. Please re-select a valid scene set.',
              code: 'INVALID_SCENE_SET_ID',
            });
          }

          if (sceneSet.show_id && sceneSet.show_id !== showId) {
            return res.status(400).json({
              success: false,
              error: 'Invalid scene_set_id for this show',
              message: 'Selected scene set belongs to a different show.',
              code: 'SCENE_SET_SHOW_MISMATCH',
            });
          }
          // Another event's version is that event's photos (eighth audit).
          const versionRefusal = await require('../../services/eventPlaceSync').refuseEventSet(
            models.sequelize, { event: { id: eventId, scene_set_id: storedSceneSetId, show_id: showId }, setId: val, showId });
          if (versionRefusal) return res.status(versionRefusal.status).json({ success: false, error: versionRefusal.error, message: versionRefusal.error, code: versionRefusal.code });
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

    // Everything that depends on the stored row runs in one transaction with
    // that row locked (audit Medium, 2026-10-23): the event is found in this
    // show (404 otherwise), the version is compared (Task #1788), the terms
    // lock (§8(x) D4; Task #2230) and the Place lock (L13) are checked, the
    // references are checked, canon_consequences is merged with the stored
    // value (Task #1747), and the row is written — no other writer can land
    // between the checks and the write. A refusal throws EventPutRefusal,
    // which rolls the transaction back.
    const lockAndCheck = async (transaction) => {
      const stored = await loadScopedEvent(models.sequelize, { showId, eventId, transaction, lock: true });
      if (!stored) throw new EventPutRefusal(404, { success: false, error: 'Event not found' });
      if (expected.present && !versionMatches(stored.updated_at, expected.ms)) {
        const stale = new Error('Stale event save refused');
        stale.staleSave = true;
        throw stale;
      }

      // Terms lock: once the event has started a live episode, its access
      // requirements, compensation, restrictions and episode link cannot
      // change here. A locked field sent with its stored value is not a
      // change, so full-form saves still work.
      if (Object.keys(LOCKED_EVENT_FIELDS).some((f) => updates[f] !== undefined)) {
        const compared = { ...stored };
        // D14: a row written with only a deal_type (before its components)
        // is compared as the components that type maps to, so re-sending
        // the same terms is not a change.
        if (compared.deal_components == null && compared.deal_type != null) {
          const { componentsOf } = require('../../utils/dealComponents');
          compared.deal_components = componentsOf({ deal_type: compared.deal_type, appearance_required: compared.appearance_required });
        }
        const lockEpisode = await findTermsLockEpisode(models.sequelize, eventId, { transaction });
        if (lockEpisode) {
          // Reopened terms (Reopen ruling, §8(cc); Task #2378): every locked
          // field but the episode link is editable until Save and relock.
          const reopened = await readTermsReopen(models.sequelize, eventId, { transaction });
          const changed = changedLockedFields(compared, updates, lockEpisode)
            .filter((f) => !reopened || STAYS_LOCKED_WHILE_REOPENED.has(f));
          if (changed.length > 0) throw new EventPutRefusal(409, termsLockedBody(lockEpisode, changed));
        }
      }

      // L13 (§8(hh)): the scene set is part of the Place, editable after
      // Start Episode while the episode is a draft, locked once it is
      // accepted. The stored value re-sent is not a change.
      if (replacements.scene_set_id !== undefined && String(stored.scene_set_id || '') !== String(replacements.scene_set_id || '')) {
        const { isPlaceLocked, PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE } = require('../../utils/placeLock');
        if (await isPlaceLocked(models.sequelize, eventId, { transaction })) {
          throw new EventPutRefusal(409, { success: false, error: PLACE_LOCKED_MESSAGE, code: PLACE_LOCKED_CODE });
        }
      }

      // References that changed must name a live row (in this show, where
      // the table has show_id); 'used' is the status of an event linked to
      // an episode (audit Medium, 2026-10-23).
      const referenceRefusal = await refuseEventReferences(models.sequelize, { showId, eventId, values: replacements, stored, transaction });
      if (referenceRefusal) throw new EventPutRefusal(400, referenceRefusal);
      return stored;
    };

    // Changes that follow the save but did not complete; the save stands
    // and the response says what did not follow (audit Medium, 2026-10-23).
    const warnings = [];
    let storedBefore = null;
    // A new place for the event: its draft episode's Event location and
    // beats follow (eighth audit), in the same transaction as the save.
    const followSceneSet = async (stored, transaction) => {
      const toSetId = replacements.scene_set_id;
      if (toSetId && String(stored.scene_set_id || '') !== String(toSetId)) {
        await require('../../services/eventPlaceSync').syncEpisodeEventLocation(models.sequelize,
          { eventId, fromSetId: stored.scene_set_id || null, toSetId, transaction });
      }
    };

    try {
      const updateSql = `UPDATE world_events SET ${setClauses.join(', ')} WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL`;
      await models.sequelize.transaction(async (transaction) => {
        const stored = await lockAndCheck(transaction);
        if (ccIncoming !== undefined) {
          // Merged with the stored value instead of replacing it (Task
          // #1747; depth and null-removal rules in mergeCanonConsequences).
          replacements.canon_consequences = JSON.stringify(
            mergeCanonConsequences(stored.canon_consequences, ccIncoming)
          );
        }
        await models.sequelize.query(updateSql, { replacements, transaction });
        await followSceneSet(stored, transaction);
        storedBefore = stored;
      });
    } catch (updateErr) {
      if (updateErr instanceof EventPutRefusal) return res.status(updateErr.status).json(updateErr.body);
      if (updateErr.staleSave) return refuseStale();
      const errMsg = String(updateErr.message || '');
      if (!(errMsg.includes('does not exist') || errMsg.includes('column'))) throw updateErr;

      // A column is missing: retry with the core fields only, in its own
      // transaction with the same checks (the first one rolled back).
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
      // Venue/event fields are stashed into canon_consequences.automation
      // when their columns don't exist.
      const venueFields = ['venue_name', 'venue_address', 'event_date', 'event_time', 'venue_location_id'];
      const stashedData = {};
      for (const vf of venueFields) {
        if (replacements[vf] !== undefined && replacements[vf] !== null) stashedData[vf] = replacements[vf];
      }
      const fieldOf = (c) => c.split(' = ')[0].trim();
      const coreClauses = setClauses.filter((c) => coreFields.has(fieldOf(c)));
      const dropped = setClauses.map(fieldOf).filter((f) => !coreFields.has(f) && !(f in stashedData));
      const hasStash = Object.keys(stashedData).length > 0;
      if (hasStash && !coreClauses.some((c) => fieldOf(c) === 'canon_consequences')) {
        coreClauses.unshift('canon_consequences = :canon_consequences');
      }
      if (coreClauses.length <= 1) {
        console.error('[WorldEvents] PUT could not save: no field in this save has a column —', setClauses.map(fieldOf).join(', '));
        return res.status(500).json({ success: false, error: 'The event could not be saved: the database is missing the columns for these fields.', fields: dropped });
      }
      try {
        await models.sequelize.transaction(async (transaction) => {
          const stored = await lockAndCheck(transaction);
          if (ccIncoming !== undefined || hasStash) {
            let cc;
            if (ccIncoming !== undefined) cc = mergeCanonConsequences(stored.canon_consequences, ccIncoming);
            else if (replacements.canon_consequences === null) cc = {};
            else cc = typeof stored.canon_consequences === 'string' ? JSON.parse(stored.canon_consequences) : (stored.canon_consequences || {});
            if (hasStash) {
              cc = { ...cc, automation: { ...(cc.automation || {}), ...stashedData } };
              console.log(`[WorldEvents] Stashing ${Object.keys(stashedData).join(', ')} into canon_consequences.automation`);
            }
            replacements.canon_consequences = JSON.stringify(cc);
          }
          await models.sequelize.query(
            `UPDATE world_events SET ${coreClauses.join(', ')} WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL`,
            { replacements, transaction }
          );
          await followSceneSet(stored, transaction);
          storedBefore = stored;
        });
      } catch (retryErr) {
        if (retryErr instanceof EventPutRefusal) return res.status(retryErr.status).json(retryErr.body);
        if (retryErr.staleSave) return refuseStale();
        // A failed retry is a failed save (audit Medium, 2026-10-23).
        console.error('[WorldEvents] Core-only retry also failed:', retryErr.message);
        return res.status(500).json({ success: false, error: 'The event could not be saved. Please try again.' });
      }
      if (dropped.length > 0) {
        warnings.push(`Not saved — the database has no column for: ${dropped.join(', ')}`);
      }
    }

    // Deal type (Task #2330): an Auto-drafted deal type follows the rule's
    // inputs, so a changed event type or brand re-drafts it. An Edited one,
    // or one on a locked event, is left alone (dealTypeDraftService). It runs
    // after the commit in its own transaction; a failure is reported, not
    // hidden.
    if (updates.event_type !== undefined || updates.host_brand !== undefined) {
      const drafted = await syncDraftedDealType(models.sequelize, eventId)
        .catch((e) => { console.error('[WorldEvents] deal type re-draft failed:', e.message); return { skipped: 'error' }; });
      if (drafted?.skipped === 'error') warnings.push('The deal type was not re-drafted for this change. Reload and check the Terms.');
    }

    // D13 (2026-09-30): changed components draft the whole Terms section,
    // touching only what is still Auto-drafted (dealTermsDraftService). The
    // terms lock refused a change above, so this runs only before it.
    if (storedBefore && (updates.deal_components !== undefined || updates.deal_type !== undefined || updates.appearance_required !== undefined)) {
      const { componentsOf } = require('../../utils/dealComponents');
      componentsBefore = componentsOf(storedBefore);
    }
    if (updates.deal_components !== undefined && updates.deal_components !== null
      && JSON.stringify(updates.deal_components) !== JSON.stringify(componentsBefore ?? null)) {
      const { syncDraftedTerms } = require('../../services/dealTermsDraftService');
      const drafted = await syncDraftedTerms(models.sequelize, eventId)
        .catch((e) => { console.error('[WorldEvents] terms re-draft failed:', e.message); return { skipped: 'error' }; });
      if (drafted?.skipped === 'error') warnings.push('The Terms were not re-drafted for the new deal components. Reload and check the Terms.');
    }

    const updated = await loadScopedEvent(models.sequelize, { showId, eventId });
    if (!updated) return res.status(404).json({ success: false, error: 'Event not found' });

    return res.json({ success: true, event: updated, ...(warnings.length > 0 ? { warnings } : {}) });
  } catch (error) {
    console.error('Update event error:', error);
    if (String(error.message || '').includes('does not exist')) {
      return res.status(400).json({ success: false, error: 'Invalid update field' });
    }
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid scene_set_id',
        message: 'Selected scene set is not valid for this event.',
        code: 'INVALID_SCENE_SET_ID',
      });
    }
    return res.status(500).json({ success: false, error: 'Failed to update event' });
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

    // Soft delete only (paranoid mode). A failure is a 500; the row is never
    // hard-deleted as a fallback (audit Low, 2026-10-23).
    await models.sequelize.query(
      `UPDATE world_events SET deleted_at = NOW() WHERE id = :eventId AND show_id = :showId`,
      { replacements: { showId, eventId } }
    );

    return res.json({ success: true, deleted: eventId });
  } catch (error) {
    console.error('Delete event error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete event' });
  }
});

module.exports = router;

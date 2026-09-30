'use strict';

/**
 * The terms lock, enforced server-side (docs/EVENT_EPISODE_FLOW.md §8(x) D4
 * and §8(w) P9; Task #2230).
 *
 * Once an event has started an episode, its accepted terms and its episode
 * link cannot change through ordinary edit routes. "Started", keyed on the
 * episode link per §8(w) P2:
 *   1. a live episode whose live brief names this event (episode_briefs.
 *      event_id, the canonical Episode → Source Event link); otherwise
 *   2. world_events.used_in_episode_id pointing at a live episode (the
 *      derived link older episodes carry; findLiveLinkedEpisode).
 * A link to a missing or soft-deleted episode does not lock.
 *
 * Deliverables have their own lock in routes/eventDeliverables.js. Itemised
 * costs (routes/eventCosts.js, Task #2365) lock through findTermsLockEpisode.
 *
 * Reopen (Evoni's Reopen terms ruling, docs/EVENT_EPISODE_FLOW.md §8(cc),
 * 2026-09-30; Task #2378): Evoni can reopen a locked event's terms while its
 * episode is still a draft (services/termsReopenService.js). While reopened,
 * the event's canon_consequences carries a terms_reopen marker and
 * findTermsWriteLock — the one check every term-writing route asks — reports
 * no lock, so the ordinary editors work again. The episode link stays locked
 * (STAYS_LOCKED_WHILE_REOPENED). Saving relocks and clears the marker.
 *
 * No history table exists for events, so the reopen and relock are recorded
 * in canon_consequences.terms_history, an array of
 *   { action: 'terms_reopened' | 'terms_relocked', at, by: { id, name },
 *     episode_id, fields? }
 * oldest first. Both keys are server-owned: the event PUT never writes them
 * (withoutServerOwnedKeys).
 */

const { findLiveLinkedEpisode } = require('./eventEpisodeLink');
const { normalizeRestrictions } = require('../services/eventTermsService');

const EVENT_TERMS_LOCKED_CODE = 'EVENT_TERMS_LOCKED';

// world_events columns the lock covers, and how each is named to a person.
const LOCKED_EVENT_FIELDS = {
  requirements: 'access requirements',
  is_paid: 'compensation',
  payment_amount: 'compensation',
  // Deal terms (deal build PR 2, Task #2330; §8(cc) QUESTION 14): they lock
  // with the rest of the compensation. The deliverable routes hold their own
  // lock for each deliverable's fee.
  deal_type: 'compensation',
  appearance_fee: 'compensation',
  bonus_terms: 'compensation',
  gifted_value: 'compensation',
  // Deal components (deal build PR 3, Task #2341; Evoni's Deal PR 3 ruling).
  partnership_base_fee: 'compensation',
  performance_fee: 'compensation',
  appearance_required: 'compensation',
  restrictions: 'restrictions',
  used_in_episode_id: 'its episode link',
};

// canon_consequences keys only the reopen service writes.
const TERMS_REOPEN_KEY = 'terms_reopen';
const TERMS_HISTORY_KEY = 'terms_history';
const SERVER_OWNED_CC_KEYS = [TERMS_REOPEN_KEY, TERMS_HISTORY_KEY];

// The episode link is not a term Evoni reopens: the event stays with its
// episode while its terms are open.
const STAYS_LOCKED_WHILE_REOPENED = new Set(['used_in_episode_id']);

const EVENT_TERMS_REOPENED_CODE = 'EVENT_TERMS_REOPENED';

/** The live episode that locks this event's terms, or null. */
async function findTermsLockEpisode(sequelize, eventId, { transaction } = {}) {
  const [briefRows] = await sequelize.query(
    `SELECT e.id, e.title, e.episode_number, e.show_id
       FROM episode_briefs b
       JOIN episodes e ON e.id = b.episode_id
      WHERE b.event_id = :eventId AND b.deleted_at IS NULL AND e.deleted_at IS NULL
      ORDER BY b.created_at DESC
      LIMIT 1`,
    { replacements: { eventId }, transaction }
  );
  if (briefRows?.[0]) return briefRows[0];
  return findLiveLinkedEpisode(sequelize, eventId, { transaction });
}

/** The terms_reopen marker in a canon_consequences value, or null. */
function reopenMarkerOf(canonConsequences) {
  const cc = parseJson(canonConsequences);
  const marker = cc && typeof cc === 'object' && !Array.isArray(cc) ? cc[TERMS_REOPEN_KEY] : null;
  return marker && typeof marker === 'object' && !Array.isArray(marker) ? marker : null;
}

/** The event's open reopen marker, or null when its terms are not reopened. */
async function readTermsReopen(sequelize, eventId, { transaction } = {}) {
  const [rows] = await sequelize.query(
    'SELECT canon_consequences FROM world_events WHERE id = :eventId AND deleted_at IS NULL LIMIT 1',
    { replacements: { eventId }, transaction }
  );
  return reopenMarkerOf(rows?.[0]?.canon_consequences);
}

/**
 * The lock a term write must respect: the locking episode, or null when the
 * event has none or Evoni has reopened its terms. Every route that edits
 * terms asks this, so a reopen lifts the lock everywhere at once.
 */
async function findTermsWriteLock(sequelize, eventId, { transaction } = {}) {
  const lockEpisode = await findTermsLockEpisode(sequelize, eventId, { transaction });
  if (!lockEpisode) return null;
  if (await readTermsReopen(sequelize, eventId, { transaction })) return null;
  return lockEpisode;
}

/** A canon_consequences value sent by an editor, minus the server-owned keys. */
function withoutServerOwnedKeys(canonConsequences) {
  if (!canonConsequences || typeof canonConsequences !== 'object' || Array.isArray(canonConsequences)) return canonConsequences;
  const out = { ...canonConsequences };
  for (const key of SERVER_OWNED_CC_KEYS) delete out[key];
  return out;
}

/**
 * Finalize and Complete book money from the terms; while an event's terms
 * are reopened they are refused (409), so nothing books on terms that are
 * still changing.
 */
class TermsReopenedError extends Error {
  constructor(event) {
    super(`The terms of "${event?.name || 'this event'}" are reopened. Save and relock them on the Event Package first.`);
    this.name = 'TermsReopenedError';
    this.status = 409;
    this.code = EVENT_TERMS_REOPENED_CODE;
    this.event = event ? { id: event.id, name: event.name ?? null } : null;
  }
}

function termsReopenedBody(err) {
  return { success: false, error: err.message, code: EVENT_TERMS_REOPENED_CODE, event: err.event };
}

/** Throws TermsReopenedError when an event of this episode has its terms reopened. */
async function assertEpisodeTermsNotReopened(sequelize, episodeId, { transaction } = {}) {
  const [rows] = await sequelize.query(
    `SELECT w.id, w.name FROM world_events w
      WHERE w.deleted_at IS NULL
        AND jsonb_typeof(w.canon_consequences -> '${TERMS_REOPEN_KEY}') = 'object'
        AND (w.used_in_episode_id = :episodeId
             OR w.id IN (SELECT b.event_id FROM episode_briefs b
                          WHERE b.episode_id = :episodeId AND b.deleted_at IS NULL AND b.event_id IS NOT NULL))
      LIMIT 1`,
    { replacements: { episodeId }, transaction }
  );
  if (rows?.[0]) throw new TermsReopenedError(rows[0]);
}

// Stable JSON for comparison: object keys sorted, so key order never reads
// as a change.
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function parseJson(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

const TRUE_LIKE = new Set([true, 'true', 1, '1', 'yes']);

function wholeNumber(v) {
  if (v == null || v === '') return 'null';
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.trunc(n)) : `invalid:${String(v)}`;
}

// Each locked field reduced to a comparable form. Empty requirements ({} or
// null) and empty restrictions ([] or null) compare equal.
const comparable = {
  requirements: (v) => {
    const parsed = parseJson(v);
    if (parsed == null || (typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0)) return '{}';
    return stable(parsed);
  },
  is_paid: (v) => (TRUE_LIKE.has(v) ? 'true' : 'false'),
  payment_amount: (v) => wholeNumber(v),
  deal_type: (v) => (v == null || v === '' ? 'null' : String(v)),
  appearance_fee: (v) => wholeNumber(v),
  bonus_terms: (v) => {
    const parsed = parseJson(v);
    return parsed == null ? 'null' : stable(parsed);
  },
  gifted_value: (v) => wholeNumber(v),
  partnership_base_fee: (v) => wholeNumber(v),
  performance_fee: (v) => wholeNumber(v),
  appearance_required: (v) => (TRUE_LIKE.has(v) ? 'true' : 'false'),
  restrictions: (v) => {
    const parsed = parseJson(v);
    if (parsed == null || (Array.isArray(parsed) && parsed.length === 0)) return '[]';
    const normalized = normalizeRestrictions(parsed);
    return normalized.error ? `invalid:${stable(parsed)}` : stable(normalized.value);
  },
  used_in_episode_id: (v) => (v == null || v === '' ? 'null' : String(v)),
};

/**
 * The locked fields `updates` would actually change on `stored` (the row as
 * it is now). A value sent unchanged is not a change. Restoring the episode
 * link to the locking episode itself is allowed.
 */
function changedLockedFields(stored, updates, lockEpisode) {
  return Object.keys(LOCKED_EVENT_FIELDS).filter((field) => {
    if (updates[field] === undefined) return false;
    const next = comparable[field](updates[field]);
    if (next === comparable[field](stored?.[field])) return false;
    if (field === 'used_in_episode_id' && lockEpisode && next === String(lockEpisode.id)) return false;
    return true;
  });
}

function episodeLabel(episode) {
  const number = episode?.episode_number != null ? `Episode ${episode.episode_number}` : 'an episode';
  return episode?.title ? `${number} "${episode.title}"` : number;
}

function listWords(words) {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** The 409 JSON body, in the worldEvents routes' { success, error } shape. */
function termsLockedBody(episode, fields, message) {
  const labels = [...new Set(fields.map((f) => LOCKED_EVENT_FIELDS[f] || f))];
  return {
    success: false,
    error: message || `This event started ${episodeLabel(episode)}, so its terms are locked: ${listWords(labels)} can't change now.`,
    code: EVENT_TERMS_LOCKED_CODE,
    fields,
    episode: {
      id: episode?.id ?? null,
      title: episode?.title ?? null,
      episode_number: episode?.episode_number ?? null,
    },
  };
}

module.exports = {
  EVENT_TERMS_LOCKED_CODE,
  EVENT_TERMS_REOPENED_CODE,
  TERMS_REOPEN_KEY,
  TERMS_HISTORY_KEY,
  STAYS_LOCKED_WHILE_REOPENED,
  reopenMarkerOf,
  readTermsReopen,
  findTermsWriteLock,
  withoutServerOwnedKeys,
  TermsReopenedError,
  termsReopenedBody,
  assertEpisodeTermsNotReopened,
  stable,
  LOCKED_EVENT_FIELDS,
  findTermsLockEpisode,
  changedLockedFields,
  termsLockedBody,
  episodeLabel,
};

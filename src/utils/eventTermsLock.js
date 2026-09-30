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
 * Deliverables have their own lock in routes/eventDeliverables.js.
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
  LOCKED_EVENT_FIELDS,
  findTermsLockEpisode,
  changedLockedFields,
  termsLockedBody,
  episodeLabel,
};

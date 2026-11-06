'use strict';

/**
 * The Start snapshot freeze (A1.2a; A1.2-SPEC-v5, Evoni's rulings of
 * 2026-11-06).
 *
 * An episode is frozen once episode_raw_clips holds ANY row for it, deleted
 * or not (Q-2): filming has begun, so the season context it was started
 * under (episodes.season_context) is history and no automatic writer may
 * change it (A1-a, D-13). The freeze is permanent (A1-d): there is no
 * switch to turn it off. frozen_at is the earliest such row's created_at.
 *
 * Why the definition holds: raw clips are only soft-deleted
 * (rawClipsService.removeClip), nothing hard-deletes them, updateClip cannot
 * change episode_id, and episode_raw_clips.episode_id has no foreign key, so
 * nothing cascades into it. tests/unit/guards/snapshotFreezeStatic.test.js
 * keeps those true.
 *
 * snapshotFrozen() needs the caller's transaction and the episode already
 * held FOR UPDATE by it (A1.1 lockEpisodes): a raw clip attaches under a
 * FOR SHARE lock on its episode, so a clip and a snapshot write take turns
 * and the answer cannot change before the caller's write commits. It never
 * opens a transaction or takes a lock itself.
 *
 * Refusals carry an HTTP status and a code, and are never retryable:
 *   EPISODE_SNAPSHOT_FROZEN     a writer would change a frozen snapshot
 *   START_RECORD_FROZEN         an edit would change a Start-record field (§6)
 *   INTENT_EDIT_PENDING_AUDIT   an edit would change frozen intent (B-1 = b, §7)
 *   LATE_CONTEXT_NOT_AVAILABLE  a frozen episode with no context (D-23, §8a)
 */

const { requireTransaction, holdsEpisode } = require('./episodeLocks');

/** A refusal that protects filmed history: HTTP 409, never retried. */
class SnapshotFreezeError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SnapshotFreezeError';
    this.status = 409;
    this.statusCode = 409;
    this.code = code;
    this.details = details;
  }

  /** The JSON a route sends. */
  toJSON() {
    return { success: false, error: this.message, code: this.code, ...this.details };
  }
}

const isFreezeError = (err) => err instanceof SnapshotFreezeError;

/** ISO text for a timestamp from the database (a Date or a string). */
function iso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

/** "2026-10-23", for messages. */
const day = (value) => (iso(value) || '').slice(0, 10);

/**
 * { frozen, frozen_at } for one episode. Requires the caller's transaction
 * and that it holds the episode FOR UPDATE (else a programming error).
 */
async function snapshotFrozen(sequelize, episodeId, { transaction } = {}) {
  requireTransaction(transaction, 'snapshotFrozen');
  if (!holdsEpisode(transaction, episodeId)) {
    const err = new Error(`snapshotFrozen: episode ${episodeId} is not locked FOR UPDATE by this transaction (SNAPSHOT_GUARD_WITHOUT_LOCK)`);
    err.code = 'SNAPSHOT_GUARD_WITHOUT_LOCK';
    throw err;
  }
  // No deleted_at filter: a removed clip still means filming began (Q-2).
  const [[row]] = await sequelize.query(
    'SELECT MIN(created_at) AS frozen_at FROM episode_raw_clips WHERE episode_id = :episodeId',
    { replacements: { episodeId }, transaction });
  const frozenAt = row && row.frozen_at ? iso(row.frozen_at) : null;
  return { frozen: Boolean(frozenAt), frozen_at: frozenAt };
}

/**
 * A read-only pre-check without a lock, for refusing before a paid model call
 * (regenerate, W4). Advisory only: the authoritative check is snapshotFrozen
 * under the episode lock in the writing transaction.
 */
async function peekFrozen(sequelize, episodeId, { transaction } = {}) {
  if (!episodeId) return { frozen: false, frozen_at: null };
  const [[row]] = await sequelize.query(
    'SELECT MIN(created_at) AS frozen_at FROM episode_raw_clips WHERE episode_id = :episodeId',
    { replacements: { episodeId }, transaction });
  const frozenAt = row && row.frozen_at ? iso(row.frozen_at) : null;
  return { frozen: Boolean(frozenAt), frozen_at: frozenAt };
}

/** The refusal for a writer that would change a frozen episode's snapshot. */
function frozenError(episodeId, frozenAt, message) {
  return new SnapshotFreezeError(
    message || `This episode's Start snapshot is frozen: filming began on ${day(frozenAt)}. Nothing was changed.`,
    'EPISODE_SNAPSHOT_FROZEN',
    { episode_id: episodeId, frozen_at: iso(frozenAt) });
}

/** Throws EPISODE_SNAPSHOT_FROZEN when the episode is frozen; else returns the freeze state. */
async function assertNotFrozen(sequelize, episodeId, { transaction, message } = {}) {
  const state = await snapshotFrozen(sequelize, episodeId, { transaction });
  if (state.frozen) throw frozenError(episodeId, state.frozen_at, message);
  return state;
}

/**
 * What a writer that skips a frozen episode returns instead of a new
 * context: the episode's context as it stands, unchanged.
 */
function frozenSkip(episodeId, frozenAt, context) {
  return { frozen: true, episode_id: episodeId, frozen_at: iso(frozenAt), context: context || null };
}

const isFrozenSkip = (value) => Boolean(value && value.frozen === true && 'episode_id' in value && 'context' in value);

/** One entry of a response's snapshot_skipped list. */
function skipEntry(episodeId, frozenAt, label = null) {
  return { episode_id: episodeId, label: label || null, frozen_at: iso(frozenAt), reason: 'snapshot_frozen' };
}

/** A writer's result as a context (the unchanged one when it skipped). */
const contextOf = (result) => (isFrozenSkip(result) ? result.context : result);

// ── The interim Start-record guard (spec v5 §6; B-2, B-3; V-1 confirmed) ──

/** Historical Start-record fields, frozen once filming begins (exactly these; V-1). */
const START_RECORD_FIELDS = Object.freeze({
  episodes: Object.freeze(['season_number']),
  episode_briefs: Object.freeze(['event_difficulty', 'arc_number', 'position_in_arc']),
});

/** Intent fields refused on a frozen episode until A1.2b's audited editor is deployed (B-1 = b). */
const FROZEN_INTENT_FIELDS = Object.freeze(['designed_intent', 'allowed_outcomes']);

/** A stable text for comparing values: objects by sorted keys; arrays keep their order. */
function stable(value) {
  if (value === undefined || value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** A stored JSON text is compared as its value. */
function asValue(value) {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  if (!t || !'[{'.includes(t[0])) return value;
  try { return JSON.parse(t); } catch { return value; }
}

/**
 * Numbers sent as text ("2") are the same value as 2; empty text, an empty
 * list and an empty object are the same as null (a form shows a stored null
 * as empty and sends it back so).
 */
function normalise(value) {
  const v = asValue(value);
  if (v === '' || v === undefined) return null;
  if (Array.isArray(v) && !v.length) return null;
  if (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) return null;
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return v;
}

/** True when the two values are the same once normalised. */
const sameValue = (a, b) => stable(normalise(a)) === stable(normalise(b));

/** The fields of `fields` the patch sends with a value different from `current`. */
function changedFields(current, patch, fields) {
  return fields.filter((f) => patch && Object.prototype.hasOwnProperty.call(patch, f) && !sameValue(current ? current[f] : null, patch[f]));
}

/** START_RECORD_FROZEN naming the fields. */
function startRecordError(episodeId, frozenAt, fields) {
  return new SnapshotFreezeError(
    `${fields.join(', ')} ${fields.length === 1 ? 'is' : 'are'} part of this episode's Start record, frozen since filming began on ${day(frozenAt)}. Nothing was changed. A correction goes through the owner's correction procedure.`,
    'START_RECORD_FROZEN',
    { episode_id: episodeId, frozen_at: iso(frozenAt), fields });
}

/** INTENT_EDIT_PENDING_AUDIT naming the fields (B-1 = b). */
function intentPendingAuditError(episodeId, frozenAt, fields) {
  return new SnapshotFreezeError(
    'Intent on a filmed episode can be changed once the audited editor is available. Nothing was changed.',
    'INTENT_EDIT_PENDING_AUDIT',
    { episode_id: episodeId, frozen_at: iso(frozenAt), fields });
}

/** LATE_CONTEXT_NOT_AVAILABLE (D-23 coexistence, spec §8a: the one-time late fill is A1.3). */
function lateContextError(episodeId, frozenAt) {
  return new SnapshotFreezeError(
    `This episode has no season context and filming began on ${day(frozenAt)}. Recording late season context is not available yet, and it is never written as a Start snapshot. Nothing was changed.`,
    'LATE_CONTEXT_NOT_AVAILABLE',
    { episode_id: episodeId, frozen_at: iso(frozenAt) });
}

module.exports = {
  SnapshotFreezeError,
  isFreezeError,
  snapshotFrozen,
  peekFrozen,
  assertNotFrozen,
  frozenError,
  frozenSkip,
  isFrozenSkip,
  contextOf,
  skipEntry,
  START_RECORD_FIELDS,
  FROZEN_INTENT_FIELDS,
  sameValue,
  changedFields,
  startRecordError,
  intentPendingAuditError,
  lateContextError,
};

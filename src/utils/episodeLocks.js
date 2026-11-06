'use strict';

/**
 * Episode-first locking (A1.1, Start snapshot integrity; Evoni, 2026-11-06).
 *
 * One order for every transaction that writes an episode's Start snapshot
 * (episodes.season_context) or attaches a raw clip: the episode rows first,
 * in id order, then slots, specials, two-parters, world events and the show.
 * Completion, finalize and a terms reopen already lock the episode first, so
 * a season write can no longer wait on them in the opposite order.
 *
 *   - lockEpisodes needs the caller's transaction and never opens one: the
 *     app does not use CLS, so a nested sequelize.transaction() would be a
 *     second connection that can wait on its own parent.
 *   - SET LOCAL lock_timeout: a wait for an episode lock ends after
 *     LOCK_TIMEOUT instead of the 30 s statement timeout. SET LOCAL lasts
 *     until the transaction commits or rolls back, never beyond it.
 *   - A transaction remembers the episodes it locked (a WeakMap on the
 *     transaction object), so locking one again is free, and a caller can
 *     check that the episodes its own locked reads found are among them.
 *
 * Writers lock FOR UPDATE; a raw clip's attachment locks FOR SHARE, so two
 * uploads to one episode never wait on each other, while an upload and a
 * snapshot write always take turns.
 */

const LOCK_TIMEOUT = '10s';
const MODES = Object.freeze({ update: 'FOR UPDATE', share: 'FOR SHARE' });

// The episodes each transaction holds: a WeakMap for real transactions
// (dropped with them); a test's stand-in handle (a string) gets a Map entry.
const held = new WeakMap();
const heldByHandle = new Map();
const isObject = (v) => (typeof v === 'object' && v !== null) || typeof v === 'function';
const heldBy = (transaction) => (isObject(transaction) ? held.get(transaction) : heldByHandle.get(transaction));
const keep = (transaction, mine) => (isObject(transaction) ? held.set(transaction, mine) : heldByHandle.set(transaction, mine));

/** A transaction lost a race (a deadlock, a lock wait timed out, or what it read changed): nothing was written. */
class RetryableConflictError extends Error {
  constructor(message = 'Someone else changed this at the same moment. Nothing was saved: try again.', code = 'RETRY') {
    super(message);
    this.name = 'RetryableConflictError';
    this.status = 409;
    this.statusCode = 409;
    this.code = code;
  }
}

function requireTransaction(transaction, what) {
  if (!transaction) throw new Error(`${what} needs the caller's transaction (episode-first locking, A1.1)`);
}

function uniqueIds(ids) {
  return [...new Set((ids || []).filter(Boolean).map(String))];
}

/**
 * Locks the episodes (FOR UPDATE, or FOR SHARE with mode 'share') in id
 * order, inside the caller's transaction. Episodes this transaction already
 * holds in the same or a stronger mode are not locked again. Resolves the
 * ids that exist (a missing or soft-deleted episode is simply not there).
 */
async function lockEpisodes(sequelize, ids, { transaction, mode = 'update' } = {}) {
  requireTransaction(transaction, 'lockEpisodes');
  if (!MODES[mode]) throw new Error(`lockEpisodes: unknown mode "${mode}"`);
  const mine = heldBy(transaction) || new Map();
  const wanted = uniqueIds(ids).filter((id) => {
    const have = mine.get(id);
    return !have || (have === 'share' && mode === 'update');
  });
  if (!wanted.length) return uniqueIds(ids).filter((id) => mine.has(id));
  await sequelize.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`, { transaction });
  const [rows] = await sequelize.query(
    `SELECT id FROM episodes WHERE id IN (:ids) ORDER BY id ${MODES[mode]}`,
    { replacements: { ids: wanted }, transaction });
  for (const r of rows) mine.set(String(r.id), mode === 'update' || mine.get(String(r.id)) === 'update' ? 'update' : 'share');
  keep(transaction, mine);
  return uniqueIds(ids).filter((id) => mine.has(id));
}

/** True when this transaction holds the episode lock (FOR UPDATE, or either mode with { mode: 'any' }). */
function holdsEpisode(transaction, id, { mode = 'update' } = {}) {
  const have = transaction && heldBy(transaction)?.get(String(id));
  return mode === 'any' ? Boolean(have) : have === 'update';
}

/**
 * The episodes a transaction found under its own locks must be ones it
 * locked first; otherwise someone moved them since its first read, and it
 * stops before writing (409 SEASON_CHANGED_RETRY).
 */
function assertEpisodesLocked(transaction, ids) {
  for (const id of uniqueIds(ids)) {
    if (!holdsEpisode(transaction, id)) {
      throw new RetryableConflictError('The season changed while this was being saved. Nothing was saved: try again.', 'SEASON_CHANGED_RETRY');
    }
  }
}

/** Postgres's deadlock (40P01) and lock-wait timeout (55P03): the transaction rolled back. */
function isLockConflict(err) {
  const code = err?.original?.code || err?.parent?.code || err?.code;
  return code === '40P01' || code === '55P03';
}

/** A route's error as a retry when it is a lock conflict; else the error itself. */
function asRetryable(err) {
  if (err instanceof RetryableConflictError) return err;
  if (isLockConflict(err)) return new RetryableConflictError();
  return err;
}

/** Runs work in the caller's transaction, or in a new top-level one when there is none (never nested). */
function inTransaction(sequelize, transaction, work) {
  return transaction ? work(transaction) : sequelize.transaction(work);
}

module.exports = {
  LOCK_TIMEOUT,
  RetryableConflictError,
  lockEpisodes,
  holdsEpisode,
  assertEpisodesLocked,
  isLockConflict,
  asRetryable,
  inTransaction,
  requireTransaction,
};

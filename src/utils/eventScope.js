'use strict';

/**
 * Event scope helpers shared by the Event Package routes (worldEvents.js,
 * eventDeliverables.js, eventCosts.js).
 *
 * loadScopedEvent — the live world_events row in this show, or null. One
 *   read, so every route asks the same question: the row's id, its show,
 *   and deleted_at IS NULL. `lock: true` (inside a transaction) reads it
 *   FOR UPDATE, so two writes to one event queue.
 *
 * assertTermsWritable — the terms write lock (findTermsWriteLock,
 *   utils/eventTermsLock.js: the live episode the event started, lifted
 *   while Evoni has reopened the terms), answered as one refusal shape:
 *   null when the terms may be written, else { status: 409, body,
 *   lockEpisode }. The body is termsLockedBody(lockEpisode, fields) unless
 *   the caller passes its own `body(lockEpisode)` (the deliverables routes
 *   keep their own 409 body, so their responses do not change).
 */

const { findTermsWriteLock, termsLockedBody } = require('./eventTermsLock');

// Column lists are fixed strings written in the callers, never request input.
const COLUMN_LIST_RE = /^(\*|[a-z_][a-z0-9_]*(\s*,\s*[a-z_][a-z0-9_]*)*)$/i;

/**
 * The live event in this show, or null.
 *
 * @param {object} sequelize
 * @param {object} opts
 * @param {string} opts.showId
 * @param {string} opts.eventId
 * @param {object} [opts.transaction]
 * @param {boolean} [opts.lock]     FOR UPDATE (needs a transaction)
 * @param {string} [opts.columns]   column list, '*' by default
 */
async function loadScopedEvent(sequelize, { showId, eventId, transaction, lock = false, columns = '*' } = {}) {
  if (!COLUMN_LIST_RE.test(String(columns).trim())) {
    throw new Error(`loadScopedEvent: invalid column list "${columns}"`);
  }
  if (lock && !transaction) {
    throw new Error('loadScopedEvent: lock needs a transaction');
  }
  const sql = `SELECT ${String(columns).trim()} FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL${lock ? ' FOR UPDATE' : ' LIMIT 1'}`;
  const [rows] = await sequelize.query(sql, {
    replacements: { eventId, showId },
    ...(transaction ? { transaction } : {}),
  });
  return rows?.[0] || null;
}

/**
 * null when the event's terms may be written; else the 409 refusal
 * { status: 409, body, lockEpisode }.
 *
 * @param {object} sequelize
 * @param {string} eventId
 * @param {object} [opts]
 * @param {object} [opts.transaction]
 * @param {string[]} [opts.fields]   the fields named in termsLockedBody
 * @param {function} [opts.body]     (lockEpisode) => the 409 body, instead of termsLockedBody
 */
async function assertTermsWritable(sequelize, eventId, { transaction, fields = [], body } = {}) {
  const lockEpisode = await findTermsWriteLock(sequelize, eventId, { transaction });
  if (!lockEpisode) return null;
  return {
    status: 409,
    lockEpisode,
    body: typeof body === 'function' ? body(lockEpisode) : termsLockedBody(lockEpisode, fields),
  };
}

module.exports = { loadScopedEvent, assertTermsWritable };

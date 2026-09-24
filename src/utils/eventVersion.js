'use strict';

/**
 * eventVersion — refuse a stale event save (Task #1788).
 *
 * A client that composed a save from an earlier read of an event sends the
 * row's updated_at as it read it, under EXPECTED_VERSION_KEY. The event
 * PUT (src/routes/worldEvents.js) compares it with the stored row inside
 * the same transaction as the write, with the row locked (SELECT … FOR
 * UPDATE), and refuses with 409 when the stored row is newer.
 *
 * Precision: Postgres stores timestamptz to the microsecond; node-postgres
 * (postgres-date) and V8 both truncate to the millisecond when they parse
 * it, and JSON carries milliseconds. So both sides are compared as whole
 * milliseconds since the epoch — "…15:00:00.123456" stored and
 * "…15:00:00.123Z" sent are the same version.
 *
 * Optional: a save without the key keeps last-write-wins (see the Task
 * #1788 PR for why it is not required).
 *
 * Pure; no I/O.
 */

const EXPECTED_VERSION_KEY = 'expected_updated_at';
const STALE_SAVE_CODE = 'EVENT_CHANGED';
const STALE_SAVE_MESSAGE =
  'This event was changed somewhere else after you opened it, so this save was not applied. '
  + 'Reload the event to see the latest version, then make your change again.';

/** Milliseconds since the epoch, or null for anything that is not a date. */
function toVersionMs(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  const ms = d.getTime();
  return Number.isFinite(ms) ? Math.trunc(ms) : null;
}

/**
 * Reads the expected version from a PUT body.
 * Returns { present: false } when the key is absent or null,
 * { present: true, ms, iso } when it parses, or
 * { present: true, error } when it is sent but is not a date.
 */
function parseExpectedVersion(body) {
  const raw = body ? body[EXPECTED_VERSION_KEY] : undefined;
  if (raw === undefined || raw === null) return { present: false };
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return { present: true, error: `${EXPECTED_VERSION_KEY} must be the event's updated_at as a string` };
  }
  const ms = toVersionMs(raw);
  if (ms === null) return { present: true, error: `${EXPECTED_VERSION_KEY} is not a valid date` };
  return { present: true, ms, iso: new Date(ms).toISOString() };
}

/** True when the stored updated_at is the version the client read. */
function versionMatches(storedUpdatedAt, expectedMs) {
  const storedMs = toVersionMs(storedUpdatedAt);
  return storedMs !== null && storedMs === expectedMs;
}

/** The 409 body: enough for a client to explain the refusal and recover. */
function staleSaveBody(expected, currentRow) {
  const currentMs = toVersionMs(currentRow?.updated_at);
  return {
    success: false,
    code: STALE_SAVE_CODE,
    error: STALE_SAVE_MESSAGE,
    expected_updated_at: expected.iso,
    current_updated_at: currentMs === null ? null : new Date(currentMs).toISOString(),
    event: currentRow || null,
  };
}

module.exports = {
  EXPECTED_VERSION_KEY,
  STALE_SAVE_CODE,
  STALE_SAVE_MESSAGE,
  toVersionMs,
  parseExpectedVersion,
  versionMatches,
  staleSaveBody,
};

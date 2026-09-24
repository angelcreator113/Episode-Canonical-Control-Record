'use strict';

/**
 * eventDateDefault — the system default for a new event's date (Task #1755,
 * Evoni's ruling 2026-09-23): a new event is scheduled 45 days after it is
 * created, and the Event Package labels that date "auto-scheduled" until
 * she changes it. Pure; no I/O.
 *
 * How the label is known without a new column: the create path writes the
 * default into both event_date and canon_consequences.automation.
 * event_date_auto. The Event Package shows "auto-scheduled" only while the
 * two are equal (eventBasics.js, resolveEventBasics). Changing the date
 * anywhere — the Package, the old editor's date input, an API call — makes
 * them differ, so the label goes away even if the flag is left behind. The
 * Package's own date save also removes the flag (sends it as null, which
 * mergeCanonConsequences deletes).
 *
 * A date the creator supplied is never overwritten: a non-empty event_date,
 * or (for callers that only keep the automation copy) a non-empty
 * canon_consequences.automation.event_date, is left exactly as it is.
 */

const AUTO_SCHEDULE_DAYS = 45;
const AUTO_DATE_KEY = 'event_date_auto';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const hasText = (v) => typeof v === 'string' && v.trim() !== '';

// 'YYYY-MM-DD', 45 calendar days after `now`, in UTC (the server's clock is
// the creation clock; event_date is a character varying(50) column).
function autoScheduledEventDate(now = new Date()) {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() + AUTO_SCHEDULE_DAYS);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns { event_date, canon_consequences, autoScheduled } for a create.
 * - supplied event_date (a non-empty string) → kept, trimmed;
 *   canon_consequences untouched.
 * - no event_date but an automation.event_date copy → that copy is kept
 *   and the column is left null (it is not auto-scheduled over),
 *   canon_consequences untouched.
 * - neither → the 45-day default, and canon_consequences gains
 *   automation.event_date_auto with the same value.
 * canonConsequences must be an object (or null/undefined); callers that
 * JSON.stringify it do so after this call.
 */
function withAutoScheduledDate(eventDate, canonConsequences, now = new Date()) {
  const cc = isPlainObject(canonConsequences) ? canonConsequences : {};
  const auto = isPlainObject(cc.automation) ? cc.automation : null;

  if (hasText(eventDate)) {
    return { event_date: eventDate.trim(), canon_consequences: canonConsequences, autoScheduled: false };
  }
  if (auto && hasText(auto.event_date)) {
    return { event_date: null, canon_consequences: canonConsequences, autoScheduled: false };
  }

  const date = autoScheduledEventDate(now);
  return {
    event_date: date,
    canon_consequences: { ...cc, automation: { ...(auto || {}), [AUTO_DATE_KEY]: date } },
    autoScheduled: true,
  };
}

module.exports = { AUTO_SCHEDULE_DAYS, AUTO_DATE_KEY, autoScheduledEventDate, withAutoScheduledDate };

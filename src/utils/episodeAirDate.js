/**
 * An episode's air date as the episode update (PUT /episodes/:id) takes it.
 *
 * A calendar day 'YYYY-MM-DD' is stored as that day at 00:00 UTC, the way
 * the release board stores a hand-set date (services/releaseSchedule.js
 * setEpisodeDate), so the day read back is the day sent. A full ISO-8601
 * timestamp ('2026-11-01T00:00:00.000Z') is kept as that instant. null or
 * '' clears it (back to the release schedule). Anything else is refused:
 * before this, a value the server could not read was dropped or stored as
 * an invalid date (Evoni's ruling: "Fix field mapping, add validation and
 * regression tests").
 */
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})$/;

const AIR_DATE_ERROR = 'air_date: a date as YYYY-MM-DD, or empty to clear it.';

/** A real calendar day ('2026-02-30' is not one). */
function isCalendarDay(v) {
  const m = typeof v === 'string' ? DAY.exec(v) : null;
  if (!m) return false;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(ms).toISOString().slice(0, 10) === v;
}

/**
 * Read an air date from a request body.
 * @returns {{ value: Date|null } | { error: string }}
 */
function parseAirDate(raw) {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw !== 'string') return { error: AIR_DATE_ERROR };
  const v = raw.trim();
  if (!v) return { value: null };
  if (isCalendarDay(v)) return { value: new Date(`${v}T00:00:00.000Z`) };
  if (TIMESTAMP.test(v) && isCalendarDay(v.slice(0, 10))) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return { value: d };
  }
  return { error: AIR_DATE_ERROR };
}

module.exports = { parseAirDate, isCalendarDay, AIR_DATE_ERROR };

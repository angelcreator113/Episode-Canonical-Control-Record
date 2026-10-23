/**
 * One formatter for an event's dates (the Event Package hero, the in-world
 * documents' byline, the Events cards and the deliverables' timeline).
 *
 * event_date is a free-text column (character varying(50)): the create paths
 * write "YYYY-MM-DD", but older rows and typed values can hold anything
 * ("Friday, March 15th"). So:
 *   - "YYYY-MM-DD" is read as that calendar day, never shifted by the
 *     viewer's time zone ("2026-03-15" is Mar 15 in Paris and in LA);
 *   - a timestamp ("2026-09-24T12:00:00Z", a status's completed_at) is a
 *     moment and is shown in the viewer's own zone;
 *   - anything else is shown as stored (or null with `fallback: false`).
 *
 * Pure; no I/O.
 */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MOMENT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

export const EVENT_DATE_STYLES = {
  // "Thu, Nov 12"
  short: { weekday: 'short', month: 'short', day: 'numeric' },
  // "Nov 12"
  monthDay: { month: 'short', day: 'numeric' },
  // "12 Nov 2026"
  full: { day: 'numeric', month: 'short', year: 'numeric' },
};

/**
 * formatEventDate(value, { style, locale, fallback }) → string | null.
 * style: a key of EVENT_DATE_STYLES or an Intl options object (default
 * 'short'). locale: null for the viewer's own. fallback (default true): return the stored text when it is not
 * a date; false returns null instead.
 */
export function formatEventDate(value, { style = 'short', locale = 'en-US', fallback = true } = {}) {
  if (value == null || value === '') return null;
  const loc = locale || undefined;
  const opts = typeof style === 'string' ? (EVENT_DATE_STYLES[style] || EVENT_DATE_STYLES.short) : style;
  const raw = value instanceof Date ? value : String(value).trim();
  if (raw === '') return null;

  if (typeof raw === 'string') {
    const day = ISO_DAY.exec(raw);
    if (day) {
      const d = new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3])));
      // "2026-02-30" rolls over to March: not a real day, shown as stored.
      if (Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(day[3])) return fallback ? raw : null;
      return d.toLocaleDateString(loc, { ...opts, timeZone: 'UTC' });
    }
    if (!ISO_MOMENT.test(raw)) return fallback ? raw : null;
  }

  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return fallback && typeof raw === 'string' ? raw : null;
  return d.toLocaleDateString(loc, opts);
}

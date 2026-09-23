/**
 * Event Package Basics — date, time, description, dress code (Task #1755).
 *
 * Evoni's ruling, 2026-09-23:
 *   - A new event's date is set to 45 days after creation and labelled
 *     auto-scheduled. It counts as a real date until she changes it.
 *   - Time and dress code are never saved from a derivation. With no saved
 *     value the field shows "Not set" plus, when its inputs exist, a
 *     suggestion she can accept in one action. Accepting saves it; only then
 *     is it canonical.
 *   - Each field is in exactly one of three states: set, suggested, missing.
 *
 * Everything here is pure and deterministic: no AI call, no I/O, no clock.
 * A suggestion is display-only. Nothing in this file is read by
 * eventReadiness.js, and the Event Package never writes a suggestion to a
 * column or to canon_consequences unless Evoni accepts it — so an
 * unaccepted suggestion cannot satisfy readiness, now or if a Basics field
 * is added to the readiness gate later.
 */
import { resolveEventVenueAndDate } from './eventReadiness';

// Key written by the create paths next to the 45-day default
// (src/utils/eventDateDefault.js, AUTO_DATE_KEY). Kept in step by hand;
// eventBasics.test.js pins the name.
export const AUTO_DATE_KEY = 'event_date_auto';

// Start time per format — the eight values in Evoni's taxonomy ruling
// (WorldEvent.format's isIn list). A proposed table, not a ruling: evening
// formats land in the evening, daytime formats in the day.
export const FORMAT_START_TIMES = {
  cocktail_party: '19:00',
  garden_soiree: '16:00',
  gallery_opening: '18:30',
  gala: '20:00',
  brunch: '11:00',
  concert: '21:00',
  brand_launch: '19:00',
  premiere: '19:30',
};

// Dress code per format. The seven preset strings are QuickEpisodeCreator's
// EVENT_PRESETS, verbatim, so both surfaces say the same thing; premiere has
// no preset and gets its own.
export const FORMAT_DRESS_CODES = {
  cocktail_party: 'cocktail elegant',
  garden_soiree: 'romantic garden casual',
  gallery_opening: 'avant-garde artistic',
  gala: 'black tie formal',
  brunch: 'casual chic',
  concert: 'edgy nightlife',
  brand_launch: 'luxury brand aligned',
  premiere: 'red carpet glam',
};

// Prestige at or above this makes a dress-code suggestion "elevated",
// unless it is already formal.
export const ELEVATED_PRESTIGE = 8;
const ALREADY_FORMAL = /black tie|formal|elevated|red carpet/i;

const text = (v) => (typeof v === 'string' ? v.trim() : '');

function fmtFormat(format) {
  return String(format).replace(/_/g, ' ');
}

/**
 * Time suggestion from the event's format.
 * Input: event.format. Falls back to: nothing — no format (or a format
 * outside the table) returns null, and the field shows as missing.
 */
export function suggestEventTime(event) {
  const format = event?.format;
  const value = format ? FORMAT_START_TIMES[format] : undefined;
  if (!value) return null;
  return { value, basis: `From format: ${fmtFormat(format)}` };
}

/**
 * Dress-code suggestion from format, venue and prestige.
 *   1. The format's dress code (FORMAT_DRESS_CODES).
 *   2. Without a format, the linked venue's own dress code
 *      (world_locations.venue_details.dress_code, passed in as
 *      venueLocation.dress_code).
 *   3. Prestige only refines a base from 1 or 2 — at ELEVATED_PRESTIGE or
 *      above it appends ", elevated" unless the base is already formal.
 *      Prestige alone never produces a suggestion: every event has one
 *      (NOT NULL, default 5), so it is not evidence of anything.
 * Falls back to: null when there is no format and no venue dress code —
 * the field shows as missing.
 */
export function suggestDressCode(event, venueLocation) {
  const ev = event || {};
  const fromFormat = ev.format ? FORMAT_DRESS_CODES[ev.format] : undefined;
  const fromVenue = text(venueLocation?.dress_code);

  let value;
  const basis = [];
  if (fromFormat) {
    value = fromFormat;
    basis.push(`format: ${fmtFormat(ev.format)}`);
  } else if (fromVenue) {
    value = fromVenue;
    basis.push(`venue: ${venueLocation.name || 'linked location'}`);
  } else {
    return null;
  }

  const prestige = Number(ev.prestige);
  if (Number.isFinite(prestige) && prestige >= ELEVATED_PRESTIGE && !ALREADY_FORMAL.test(value)) {
    value = `${value}, elevated`;
    basis.push(`prestige ${prestige}`);
  }

  return { value, basis: `From ${basis.join(' · ')}` };
}

/**
 * True when event_date is the system default the create path wrote and
 * nobody has changed it since. The flag alone is not enough: the old
 * editor can change the date without clearing it, and its 💾 Save can
 * re-send a stale copy of it — so the label shows only while the column
 * still equals the flagged value.
 */
export function isAutoScheduledDate(event) {
  const ev = event || {};
  const flagged = text(ev.canon_consequences?.automation?.[AUTO_DATE_KEY]);
  const date = text(ev.event_date);
  return !!flagged && flagged === date;
}

function field(value, suggestion, extra = {}) {
  if (value) return { state: 'set', value, suggestion: null, ...extra };
  if (suggestion) return { state: 'suggested', value: null, suggestion, ...extra };
  return { state: 'missing', value: null, suggestion: null, ...extra };
}

/**
 * The four Basics fields, each { state: 'set'|'suggested'|'missing',
 * value, suggestion, ... }.
 *   - date: column, else the automation copy (shown "saved copy", as
 *     before — resolveEventVenueAndDate). Never suggested.
 *     autoScheduled per isAutoScheduledDate.
 *   - time: column, else the automation copy; else a format suggestion.
 *   - description: column only. Never suggested.
 *   - dressCode: column only (what the Package has always shown); else a
 *     format/venue/prestige suggestion.
 * Pass { suggest: false } for a used (read-only) event: nothing can be
 * accepted there, so an unset field reads as missing.
 */
export function resolveEventBasics(event, venueLocation, { suggest = true } = {}) {
  const ev = event || {};
  const vd = resolveEventVenueAndDate(ev);

  return {
    date: field(text(vd.eventDate) || null, null, {
      fromSavedCopy: vd.eventDateFromSavedCopy,
      autoScheduled: isAutoScheduledDate(ev),
    }),
    time: field(text(vd.eventTime) || null, suggest ? suggestEventTime(ev) : null, {
      fromSavedCopy: vd.eventTimeFromSavedCopy,
    }),
    description: field(text(ev.description) || null, null),
    dressCode: field(text(ev.dress_code) || null, suggest ? suggestDressCode(ev, venueLocation) : null),
  };
}

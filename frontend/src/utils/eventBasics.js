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
 * Category and format (Task #1888) are suggested the same way, from small
 * explicit tables below, never from a guess. An accepted format is what
 * the time and dress-code suggestions read, so accepting one makes those
 * two appear (the page reloads the event after every save). A suggested
 * but unaccepted format feeds nothing: suggestEventTime and
 * suggestDressCode read the saved event.format only.
 *
 * Everything here is pure and deterministic: no AI call, no I/O, no clock.
 * A suggestion is display-only. Readiness (eventReadinessSections.js,
 * Task #1775) reads resolveEventBasics but counts a field only in the
 * 'set' state, and the Event Package never writes a suggestion to a
 * column or to canon_consequences unless Evoni accepts it — so an
 * unaccepted suggestion cannot satisfy readiness, now or if a Basics field
 * is added to the readiness gate later.
 */
import { resolveEventVenueAndDate } from './eventReadiness';
import { EVENT_CATEGORIES, EVENT_FORMATS, resolveTaxonomyField } from './eventTaxonomy';

// Key written by the create paths next to the 45-day default
// (src/utils/eventDateDefault.js, AUTO_DATE_KEY). Kept in step by hand;
// eventBasics.test.js pins the name.
export const AUTO_DATE_KEY = 'event_date_auto';

// Task #2128 (doctrine rule 14; §8(u) R1-R2): the creation draft records
// which columns it drafted (automation.auto_drafted, field → source) and a
// copy of each drafted value (automation.drafted_values, written by
// from-profile). A field is 'auto_drafted' while its column still equals the
// copy and 'edited' once it differs; the date uses AUTO_DATE_KEY the same
// way, with source 'schedule'. Both count toward Event Ready.
export const AUTO_DRAFTED_KEY = 'auto_drafted';
export const DRAFTED_VALUES_KEY = 'drafted_values';
export const DATE_DRAFT_SOURCE = 'schedule';

// The states that hold a value the event actually has.
export const VALUE_STATES = Object.freeze(['set', 'auto_drafted', 'edited']);
export const hasValueState = (state) => VALUE_STATES.includes(state);

// Start time per format (WorldEvent.format's isIn list). The first eight
// were a proposed table, not a ruling: evening formats land in the evening,
// daytime formats in the day. The fifteen from workout_class on are Evoni's
// approved defaults (docs/EVENT_EPISODE_FLOW.md §8(u) R10, Task #2116).
export const FORMAT_START_TIMES = {
  cocktail_party: '19:00',
  garden_soiree: '16:00',
  gallery_opening: '18:30',
  gala: '20:00',
  brunch: '11:00',
  concert: '21:00',
  brand_launch: '19:00',
  premiere: '19:30',
  workout_class: '08:00',
  masterclass: '11:00',
  workshop: '11:00',
  dinner: '19:30',
  showcase: '18:00',
  preview: '18:00',
  pop_up: '12:00',
  retreat: '10:00',
  meetup: '18:30',
  run_club: '07:00',
  performance: '20:00',
  photoshoot: '10:00',
  tasting: '18:00',
  panel: '14:00',
  competition: '10:00',
};

// Dress code per format. The seven preset strings are QuickEpisodeCreator's
// EVENT_PRESETS, verbatim, so both surfaces say the same thing; premiere has
// no preset and gets its own. The fifteen from workout_class on are Evoni's
// approved defaults (§8(u) R10, Task #2116).
export const FORMAT_DRESS_CODES = {
  cocktail_party: 'cocktail elegant',
  garden_soiree: 'romantic garden casual',
  gallery_opening: 'avant-garde artistic',
  gala: 'black tie formal',
  brunch: 'casual chic',
  concert: 'edgy nightlife',
  brand_launch: 'luxury brand aligned',
  premiere: 'red carpet glam',
  workout_class: 'performance activewear',
  masterclass: 'smart casual',
  workshop: 'casual, hands-on',
  dinner: 'smart elegant',
  showcase: 'cocktail',
  preview: 'fashion-forward smart',
  pop_up: 'casual chic',
  retreat: 'relaxed resort wear',
  meetup: 'casual chic',
  run_club: 'running gear',
  performance: 'evening chic',
  photoshoot: 'camera-ready, per shoot brief',
  tasting: 'smart casual',
  panel: 'business chic',
  competition: 'sporty chic',
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

// ─── Category and format suggestions (Task #1888) ─────────────────────────
//
// What an event carries when it reaches the Event Package (measured at
// 51e64f3ff; the per-path report is in the Task #1888 PR body):
//   - from-profile: automation.content_category (the Feed creator's); a
//     name "Event with <creator>" (no signal); usually a linked venue whose
//     venue_type was itself picked from that content category.
//   - calendar spawn: a name built from the calendar category's template
//     (e.g. "… Beauty Pop-Up", "… Gallery Night"). The calendar's
//     cultural_category is not saved, and the venue_location_id column is
//     not set, so the Package sees no linked venue.
//   - opportunity pipeline: automation.opportunity_type and the
//     opportunity's own name; no linked venue.
// event_type is never read: it is the mechanic, an axis separate from
// category and format (docs/EVENT_EPISODE_FLOW.md §8(k)). Prestige is never
// read: every event has one. The event's name is never read either: the name
// describes the finished concept and is never used to infer category or
// format (§8(u) R3; the name-word tables were retired by Task #2134).
//
// Each table maps one fact to one taxonomy value; a fact not listed (e.g.
// content category "drama") suggests nothing. Sources are tried in a
// fixed order and the first that yields a value wins.

// Content category (SocialProfile.content_category, free text) → category.
// Whole value only, trimmed and lower-cased. fitness and lifestyle follow
// docs/EVENT_EPISODE_FLOW.md §8(u) R6.
export const CONTENT_CATEGORY_TO_CATEGORY = {
  fashion: 'fashion',
  style: 'fashion',
  modeling: 'fashion',
  beauty: 'beauty_wellness',
  skincare: 'beauty_wellness',
  makeup: 'beauty_wellness',
  wellness: 'beauty_wellness',
  fitness: 'fitness',
  food: 'brunch_dining',
  culinary: 'brunch_dining',
  music: 'arts_entertainment',
  art: 'arts_entertainment',
  film: 'arts_entertainment',
  entertainment: 'arts_entertainment',
  photography: 'arts_entertainment',
  luxury: 'luxury_prestige',
  travel: 'travel_destination',
  community: 'community_local',
  philanthropy: 'community_local',
  activism: 'community_local',
  lifestyle: 'community_local',
  creator_economy: 'creator_brand',
};

// Opportunity type (automation.opportunity_type) → category / format. Only
// the types whose world or shape is plain.
export const OPPORTUNITY_TYPE_TO_CATEGORY = {
  runway: 'fashion',
  casting_call: 'fashion',
  editorial: 'fashion',
  modeling: 'fashion',
  award_show: 'arts_entertainment',
};
export const OPPORTUNITY_TYPE_TO_FORMAT = {
  award_show: 'gala',
};

// No venue_type table (Evoni, Task #1888): on automated events the venue was
// itself chosen from the creator's content category, so a venue-based
// suggestion would echo that choice rather than add a fact. If a mapping is
// not deliberately defined, no suggestion beats one from a table nobody chose.
const lower = (v) => text(v).toLowerCase();

const automationOf = (event) => {
  const auto = event?.canon_consequences?.automation;
  return auto && typeof auto === 'object' && !Array.isArray(auto) ? auto : {};
};

// Only a value the taxonomy allows is ever suggested.
const allowed = (value, list) => (value && list.includes(value) ? value : null);

/**
 * Category suggestion. Sources, first match wins:
 *   1. the organizer's content_category (organizer: the linked creator
 *      profile; a brand organizer carries none);
 *   2. the Feed creator the event was started from
 *      (automation.content_category, written by from-profile);
 *   3. automation.opportunity_type (opportunity pipeline).
 * The event's name is not a source (§8(u) R3); nor is the linked venue (see
 * the "No venue_type table" note).
 * Returns { value, basis } or null when none of them says.
 */
export function suggestEventCategory(event, organizer) {
  const ev = event || {};
  const auto = automationOf(ev);

  const orgCat = lower(organizer?.content_category);
  const fromOrg = allowed(CONTENT_CATEGORY_TO_CATEGORY[orgCat], EVENT_CATEGORIES);
  if (fromOrg) return { value: fromOrg, basis: `From organizer: ${fmtFormat(orgCat)} creator` };

  const feedCat = lower(auto.content_category);
  const fromFeed = allowed(CONTENT_CATEGORY_TO_CATEGORY[feedCat], EVENT_CATEGORIES);
  if (fromFeed) return { value: fromFeed, basis: `From Feed creator: ${fmtFormat(feedCat)} creator` };

  const oppType = lower(auto.opportunity_type);
  const fromOpp = allowed(OPPORTUNITY_TYPE_TO_CATEGORY[oppType], EVENT_CATEGORIES);
  if (fromOpp) return { value: fromOpp, basis: `From opportunity: ${fmtFormat(oppType)}` };

  return null;
}

/**
 * Format suggestion. One source: automation.opportunity_type (opportunity
 * pipeline). The event's name is not a source (§8(u) R3); nor is the linked
 * venue (see the "No venue_type table" note).
 * `organizer` is taken for symmetry with suggestEventCategory, but no
 * organizer fact names a format: a creator's content category says what
 * world they are in, not what shape their event takes.
 * Returns { value, basis } or null when none of them says.
 */
export function suggestEventFormat(event, organizer) {
  const ev = event || {};
  const auto = automationOf(ev);

  const oppType = lower(auto.opportunity_type);
  const fromOpp = allowed(OPPORTUNITY_TYPE_TO_FORMAT[oppType], EVENT_FORMATS);
  if (fromOpp) return { value: fromOpp, basis: `From opportunity: ${fmtFormat(oppType)}` };

  return null;
}

// A category or format field: a stored value is set, with inList false
// when the model would not allow it (Task #1780's flag); otherwise the
// suggestion, else missing.
function taxonomyField(stored, allowedValues, suggestion, draft = null) {
  const base = resolveTaxonomyField(stored, allowedValues);
  if (base.state === 'set' && draft) return { ...base, state: draft.state, source: draft.source, suggestion: null };
  if (base.state === 'set') return { ...base, suggestion: null };
  if (suggestion) return { state: 'suggested', value: null, suggestion, inList: true };
  return { ...base, suggestion: null };
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

const sameDraftValue = (a, b) => {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return text(a) === text(b);
};

/**
 * The draft state of one column with a value: { state, source } when the
 * creation draft wrote it ('auto_drafted' while the column equals the saved
 * copy, 'edited' once it differs), or null when it was never drafted. A
 * column that is now empty is not reported here: an empty field falls back
 * to suggested/missing, since it has nothing to count toward readiness.
 */
export function draftStateOf(event, column, current) {
  const auto = event?.canon_consequences?.automation || {};
  const source = auto[AUTO_DRAFTED_KEY]?.[column];
  const values = auto[DRAFTED_VALUES_KEY] || {};
  if (!source || !Object.prototype.hasOwnProperty.call(values, column)) return null;
  return { state: sameDraftValue(current, values[column]) ? 'auto_drafted' : 'edited', source };
}

// The date's draft state: the create path's 45-day default (AUTO_DATE_KEY)
// is Auto-drafted · schedule while the event_date column still equals it,
// Edited once it differs (Evoni's (b), Task #2128). Null when the event has
// no flag, or no date in the column (a date read from the automation copy
// stays 'set', as isAutoScheduledDate always treated it).
export function dateDraftStateOf(event) {
  const flagged = text(event?.canon_consequences?.automation?.[AUTO_DATE_KEY]);
  const column = text(event?.event_date);
  if (!flagged || !column) return null;
  return { state: flagged === column ? 'auto_drafted' : 'edited', source: DATE_DRAFT_SOURCE };
}

function field(value, suggestion, extra = {}, draft = null) {
  if (value && draft) return { state: draft.state, source: draft.source, value, suggestion: null, ...extra };
  if (value) return { state: 'set', value, suggestion: null, ...extra };
  if (suggestion) return { state: 'suggested', value: null, suggestion, ...extra };
  return { state: 'missing', value: null, suggestion: null, ...extra };
}

/**
 * The Basics fields, each { state: 'set'|'auto_drafted'|'edited'|
 * 'suggested'|'missing', value, suggestion, source?, ... }. A field with a
 * value is 'auto_drafted' or 'edited' when the creation draft wrote it
 * (draftStateOf / dateDraftStateOf, with its source), else 'set'.
 *   - date: column, else the automation copy (shown "saved copy", as
 *     before — resolveEventVenueAndDate). Never suggested.
 *     autoScheduled per isAutoScheduledDate (kept for callers; the
 *     Package now shows the date's draft state instead).
 *   - time: column, else the automation copy; else a format suggestion.
 *   - description: column only. Never suggested.
 *   - dressCode: column only (what the Package has always shown); else a
 *     format/venue/prestige suggestion.
 *   - category, format (Task #1888): column only; else a suggestion
 *     (suggestEventCategory / suggestEventFormat). Each also carries
 *     inList, false for a stored value outside the taxonomy (Task #1780).
 * Pass { suggest: false } for a used (read-only) event: nothing can be
 * accepted there, so an unset field reads as missing. `organizer` is the
 * linked creator profile, when the caller has one.
 */
export function resolveEventBasics(event, venueLocation, { suggest = true, organizer = null } = {}) {
  const ev = event || {};
  const vd = resolveEventVenueAndDate(ev);
  const date = text(vd.eventDate) || null;
  const time = text(vd.eventTime) || null;

  return {
    date: field(date, null, {
      fromSavedCopy: vd.eventDateFromSavedCopy,
      autoScheduled: isAutoScheduledDate(ev),
    }, dateDraftStateOf(ev)),
    time: field(time, suggest ? suggestEventTime(ev) : null, {
      fromSavedCopy: vd.eventTimeFromSavedCopy,
    }, draftStateOf(ev, 'event_time', time)),
    description: field(text(ev.description) || null, null, {},
      draftStateOf(ev, 'description', ev.description)),
    dressCode: field(text(ev.dress_code) || null, suggest ? suggestDressCode(ev, venueLocation) : null, {},
      draftStateOf(ev, 'dress_code', ev.dress_code)),
    category: taxonomyField(ev.category, EVENT_CATEGORIES,
      suggest ? suggestEventCategory(ev, organizer) : null, draftStateOf(ev, 'category', ev.category)),
    format: taxonomyField(ev.format, EVENT_FORMATS,
      suggest ? suggestEventFormat(ev, organizer) : null, draftStateOf(ev, 'format', ev.format)),
  };
}

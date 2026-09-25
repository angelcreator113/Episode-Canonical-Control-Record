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
// read: every event has one.
//
// Each table maps one fact to one taxonomy value; a fact not listed (e.g.
// content category "lifestyle") suggests nothing. Sources are tried in a
// fixed order and the first that yields a value wins. A name whose words
// point at two different values is ambiguous and suggests nothing.

// Content category (SocialProfile.content_category, free text) → category.
// Whole value only, trimmed and lower-cased.
export const CONTENT_CATEGORY_TO_CATEGORY = {
  fashion: 'fashion',
  style: 'fashion',
  modeling: 'fashion',
  beauty: 'beauty_wellness',
  skincare: 'beauty_wellness',
  makeup: 'beauty_wellness',
  wellness: 'beauty_wellness',
  fitness: 'beauty_wellness',
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

// Linked venue's venue_type (WorldLocation) → category / format.
export const VENUE_TYPE_TO_CATEGORY = {
  gallery: 'arts_entertainment',
  museum: 'arts_entertainment',
  theater: 'arts_entertainment',
  cinema: 'arts_entertainment',
  salon: 'beauty_wellness',
  spa: 'beauty_wellness',
  restaurant: 'brunch_dining',
  cafe: 'brunch_dining',
};
export const VENUE_TYPE_TO_FORMAT = {
  gallery: 'gallery_opening',
  museum: 'gallery_opening',
  cinema: 'premiere',
  cafe: 'brunch',
};

// Words in the event's name → category / format. Whole words only.
export const NAME_WORDS_TO_CATEGORY = [
  { pattern: /\b(fashion|runway|couture|collection preview)\b/i, value: 'fashion' },
  { pattern: /\b(beauty|skincare|wellness|spa)\b/i, value: 'beauty_wellness' },
  { pattern: /\b(brunch|dinner|supper)\b/i, value: 'brunch_dining' },
  { pattern: /\b(gallery|art|concert|premiere|film)\b/i, value: 'arts_entertainment' },
  { pattern: /\bluxury\b/i, value: 'luxury_prestige' },
  { pattern: /\btravel\b/i, value: 'travel_destination' },
  { pattern: /\b(charity|community|fundraiser)\b/i, value: 'community_local' },
];
export const NAME_WORDS_TO_FORMAT = [
  { pattern: /\bcocktails?\b/i, value: 'cocktail_party' },
  { pattern: /\bgarden (party|soiree|soirée)(?![\p{L}])/iu, value: 'garden_soiree' },
  { pattern: /\b(gallery|opening reception)\b/i, value: 'gallery_opening' },
  { pattern: /\bgala\b/i, value: 'gala' },
  { pattern: /\bbrunch\b/i, value: 'brunch' },
  { pattern: /\bconcert\b/i, value: 'concert' },
  { pattern: /\blaunch\b/i, value: 'brand_launch' },
  { pattern: /\b(premiere|première)(?![\p{L}])/iu, value: 'premiere' },
];

const lower = (v) => text(v).toLowerCase();

const automationOf = (event) => {
  const auto = event?.canon_consequences?.automation;
  return auto && typeof auto === 'object' && !Array.isArray(auto) ? auto : {};
};

// Only a value the taxonomy allows is ever suggested.
const allowed = (value, list) => (value && list.includes(value) ? value : null);

// One { value, word } from the name, or null when no word matches or the
// words point at two different values.
function fromName(name, table, list) {
  const n = text(name);
  if (!n) return null;
  const hits = [];
  for (const { pattern, value } of table) {
    const m = n.match(pattern);
    if (m && allowed(value, list) && !hits.some((h) => h.value === value)) {
      hits.push({ value, word: m[0].toLowerCase() });
    }
  }
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Category suggestion. Sources, first match wins:
 *   1. the organizer's content_category (organizer: the linked creator
 *      profile; a brand organizer carries none);
 *   2. the Feed creator the event was started from
 *      (automation.content_category, written by from-profile);
 *   3. automation.opportunity_type (opportunity pipeline);
 *   4. a word in the event's name;
 *   5. the linked venue's venue_type.
 * Returns { value, basis } or null when none of them says.
 */
export function suggestEventCategory(event, organizer, venueLocation) {
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

  const byName = fromName(ev.name, NAME_WORDS_TO_CATEGORY, EVENT_CATEGORIES);
  if (byName) return { value: byName.value, basis: `From name: "${byName.word}"` };

  const venueType = lower(venueLocation?.venue_type);
  const fromVenue = allowed(VENUE_TYPE_TO_CATEGORY[venueType], EVENT_CATEGORIES);
  if (fromVenue) return { value: fromVenue, basis: `From venue: ${fmtFormat(venueType)}` };

  return null;
}

/**
 * Format suggestion. Sources, first match wins:
 *   1. a word in the event's name (it names the gathering directly);
 *   2. automation.opportunity_type (opportunity pipeline);
 *   3. the linked venue's venue_type.
 * `organizer` is taken for symmetry with suggestEventCategory, but no
 * organizer fact names a format: a creator's content category says what
 * world they are in, not what shape their event takes.
 * Returns { value, basis } or null when none of them says.
 */
export function suggestEventFormat(event, organizer, venueLocation) {
  const ev = event || {};
  const auto = automationOf(ev);

  const byName = fromName(ev.name, NAME_WORDS_TO_FORMAT, EVENT_FORMATS);
  if (byName) return { value: byName.value, basis: `From name: "${byName.word}"` };

  const oppType = lower(auto.opportunity_type);
  const fromOpp = allowed(OPPORTUNITY_TYPE_TO_FORMAT[oppType], EVENT_FORMATS);
  if (fromOpp) return { value: fromOpp, basis: `From opportunity: ${fmtFormat(oppType)}` };

  const venueType = lower(venueLocation?.venue_type);
  const fromVenue = allowed(VENUE_TYPE_TO_FORMAT[venueType], EVENT_FORMATS);
  if (fromVenue) return { value: fromVenue, basis: `From venue: ${fmtFormat(venueType)}` };

  return null;
}

// A category or format field: a stored value is set, with inList false
// when the model would not allow it (Task #1780's flag); otherwise the
// suggestion, else missing.
function taxonomyField(stored, allowedValues, suggestion) {
  const base = resolveTaxonomyField(stored, allowedValues);
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

function field(value, suggestion, extra = {}) {
  if (value) return { state: 'set', value, suggestion: null, ...extra };
  if (suggestion) return { state: 'suggested', value: null, suggestion, ...extra };
  return { state: 'missing', value: null, suggestion: null, ...extra };
}

/**
 * The Basics fields, each { state: 'set'|'suggested'|'missing',
 * value, suggestion, ... }.
 *   - date: column, else the automation copy (shown "saved copy", as
 *     before — resolveEventVenueAndDate). Never suggested.
 *     autoScheduled per isAutoScheduledDate.
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
    category: taxonomyField(ev.category, EVENT_CATEGORIES,
      suggest ? suggestEventCategory(ev, organizer, venueLocation) : null),
    format: taxonomyField(ev.format, EVENT_FORMATS,
      suggest ? suggestEventFormat(ev, organizer, venueLocation) : null),
  };
}

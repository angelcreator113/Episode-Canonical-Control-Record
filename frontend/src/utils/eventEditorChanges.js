/**
 * Old event editor — what a save may send (Task #1786).
 *
 * The WorldAdmin Edit details modal fills blanks at render: a date two
 * weeks out, a time and cost/strictness/deadline from prestige, a dress
 * code from the host's content category (else 'chic'), and copies of the
 * canon_consequences.automation fields. Before this, its saves sent that
 * whole hydrated copy, and 💾 Save also sent the whole canon_consequences,
 * so a save could overwrite Event Package work and store invented values
 * (docs/EVENT_EDITOR_REMOVAL_READ.md §5).
 *
 * The rule now: a save sends only the fields whose value differs from what
 * the editor opened with. "Opened with" is the stored row run through the
 * same hydration the modal renders (hydrateEventForModal), so a field left
 * as shown — invented or not — is never sent. Focusing a field and leaving
 * it unchanged sends nothing.
 *
 * Pure; no I/O.
 */

// Dress code the modal falls back to, by the host's content category.
export const CATEGORY_DRESS_CODES = {
  fashion: 'runway-ready', beauty: 'glam chic', lifestyle: 'smart casual',
  fitness: 'athleisure luxe', food: 'cocktail', music: 'streetwear elevated',
  creator_economy: 'influencer chic', drama: 'camera-ready',
};

// Organizer fields: AI Enhance and Bulk Enhance never write these
// (docs/EVENT_EPISODE_FLOW.md §8(p) — the organizer is chosen in the
// Event Package, never invented).
export const ORGANIZER_KEYS = ['host', 'host_brand', 'source_profile_id'];

const isBlank = (v) => v === null || v === undefined || v === ''
  || (Array.isArray(v) && v.length === 0);

/**
 * Two editor values are the same when both are blank (null, undefined,
 * '' or []), or when they serialize the same. Numbers and numeric strings
 * compare by value ("5" and 5 are the same) because the modal's inputs
 * hand back strings and parseInt'd numbers interchangeably.
 */
export function sameEditorValue(a, b) {
  if (isBlank(a) && isBlank(b)) return true;
  if (typeof a === 'number' || typeof b === 'number') {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  }
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return String(a) === String(b);
}

/** The subset of `current` whose keys (from `keys`) differ from `baseline`. */
export function changedFields(baseline, current, keys) {
  const out = {};
  const base = baseline || {};
  const cur = current || {};
  for (const key of keys) {
    if (!(key in cur)) continue;
    if (!sameEditorValue(base[key], cur[key])) out[key] = cur[key];
  }
  return out;
}

/** A copy of `obj` without the organizer keys. */
export function withoutOrganizerKeys(obj) {
  const out = { ...(obj || {}) };
  for (const key of ORGANIZER_KEYS) delete out[key];
  return out;
}

function derivedDateFrom(now) {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + 14);
  return d.toISOString().split('T')[0];
}

/**
 * The modal's render-time hydration, unchanged in what it shows, now also
 * saying where each value came from: 'column' (the event's own field),
 * 'saved_copy' (canon_consequences.automation), 'derived' (invented at
 * render) or 'empty'.
 *
 * Returns { values, sources }. `values` is the event with the hydrated
 * fields laid over it — exactly what the modal renders as `md`.
 */
export function hydrateEventForModal(event, now = new Date()) {
  const ev = event || {};
  const auto = ev.canon_consequences?.automation || {};
  const prestige = ev.prestige || 5;
  const derivedDressCode = CATEGORY_DRESS_CODES[(auto.content_category || '').toLowerCase()] || 'chic';

  const sources = {};
  // First non-blank of: column, saved copy, derived; '' when none.
  const pick = (key, column, copy, derived, { nullish = false, empty = '' } = {}) => {
    const has = (v) => (nullish ? v !== null && v !== undefined : !isBlank(v));
    if (has(column)) { sources[key] = 'column'; return column; }
    if (has(copy)) { sources[key] = 'saved_copy'; return copy; }
    if (derived !== undefined) { sources[key] = 'derived'; return derived; }
    sources[key] = 'empty';
    return empty;
  };

  const values = {
    ...ev,
    host: pick('host', ev.host, auto.host_display_name || auto.host_handle),
    host_brand: pick('host_brand', ev.host_brand, auto.host_brand),
    venue_name: pick('venue_name', ev.venue_name, auto.venue_name),
    venue_address: pick('venue_address', ev.venue_address, auto.venue_address),
    event_date: pick('event_date', ev.event_date, auto.event_date, derivedDateFrom(now)),
    event_time: pick('event_time', ev.event_time, auto.event_time, prestige >= 7 ? '20:00' : prestige >= 4 ? '19:00' : '18:00'),
    dress_code: pick('dress_code', ev.dress_code, auto.dress_code, derivedDressCode),
    description: pick('description', ev.description, auto.description),
    narrative_stakes: pick('narrative_stakes', ev.narrative_stakes, auto.narrative_stakes),
    cost_coins: pick('cost_coins', ev.cost_coins, auto.cost_coins, prestige >= 8 ? 500 : prestige >= 6 ? 300 : prestige >= 4 ? 150 : 50, { nullish: true }),
    strictness: pick('strictness', ev.strictness, auto.strictness, Math.min(10, prestige + 1), { nullish: true }),
    deadline_type: pick('deadline_type', ev.deadline_type, auto.deadline_type, prestige >= 8 ? 'urgent' : prestige >= 5 ? 'medium' : 'low'),
    theme: pick('theme', ev.theme, auto.theme),
    mood: pick('mood', ev.mood, auto.mood),
    color_palette: pick('color_palette', ev.color_palette, auto.color_palette, undefined, { empty: [] }),
    floral_style: pick('floral_style', ev.floral_style, auto.floral_style),
    border_style: pick('border_style', ev.border_style, auto.border_style),
    dress_code_keywords: pick('dress_code_keywords', ev.dress_code_keywords, auto.dress_code_keywords, undefined, { empty: [] }),
  };
  return { values, sources };
}

// Mark Ready's required fields, in the order it reports them.
export const MARK_READY_REQUIRED = [
  ['host', 'Host'],
  ['venue_name', 'Venue Name'],
  ['event_date', 'Event Date'],
  ['dress_code', 'Dress Code'],
  ['description', 'Description'],
];

/**
 * Mark Ready's required-field check, read from what is stored: the row's
 * own field or its saved automation copy. A value that exists only because
 * the modal invented it at render counts as missing.
 */
export function missingForMarkReady(storedEvent, now = new Date()) {
  const { sources } = hydrateEventForModal(storedEvent, now);
  return MARK_READY_REQUIRED
    .filter(([key]) => sources[key] !== 'column' && sources[key] !== 'saved_copy')
    .map(([, label]) => label);
}

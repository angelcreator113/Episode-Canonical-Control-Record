/**
 * The Event Package's shared field specs, labels and formatters (moved out
 * of EventPackagePage.jsx when the page was split into sections, Task #54):
 * the Basics fields, the readiness icons, the fold rules, and the scene-set
 * ordering and search the Place pickers use.
 */
import {
  Pencil, CheckCircle2, Sparkles, Lightbulb, CircleDashed, CalendarClock, Building2, Hourglass,
  MapPin, TrendingUp, Tag, Users, Mail, Shirt,
} from 'lucide-react';
import { DATE_DRAFT_SOURCE } from '../utils/eventBasics';
import { EVENT_CATEGORIES, EVENT_FORMATS, taxonomyLabel } from '../utils/eventTaxonomy';

export function fmtLabel(value) {
  if (value === null || value === undefined || value === '') return 'Not set';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Featured attendees (Task #1689) — a story role is optional, chosen from
// this fixed set; no role is forced onto a featured guest.
export const STORY_ROLES = ['friend', 'tension', 'opportunity', 'wildcard', 'romantic', 'mentor', 'rival'];
export const MAX_FEATURED_GUESTS = 5;
// The "On this page" dots' states, read out (they are colour only on screen).
export const TOC_STATE_TEXT = { blocking: 'needed to start', warning: 'has a warning', complete: 'complete' };
// The Full Guest List shows ten at a time; the rest fold behind Show more (2026-10-05).
export const GUESTS_SHOWN = 10;
// The description clamps to two lines past this length, as in Evoni's mock (Show more / Show less).
export const DESCRIPTION_CLAMP_AT = 160;

// Basics fields (Task #1755): the dialog title, the PUT column each one
// saves to, and the input it edits with. maxLength follows the column
// (event_date/event_time character varying(50), dress_code (200)).
export const BASICS_FIELDS = {
  date: { label: 'Date', title: 'Event date', column: 'event_date', input: 'date', maxLength: 50 },
  time: { label: 'Time', title: 'Start time', column: 'event_time', input: 'time', maxLength: 50 },
  description: { label: 'Description', title: 'Description', column: 'description', input: 'textarea' },
  dressCode: { label: 'Dress code', title: 'Dress code', column: 'dress_code', input: 'text', maxLength: 200 },
  // Category and format (Task #1780): chosen from the model's allowed
  // values (utils/eventTaxonomy.js); suggested per Task #1888.
  category: { label: 'Category', title: 'Category', column: 'category', input: 'select', options: EVENT_CATEGORIES },
  format: { label: 'Format', title: 'Format', column: 'format', input: 'select', options: EVENT_FORMATS },
};
export const BASICS_ORDER = ['date', 'time', 'description', 'dressCode'];
// The Event's fields in page order. One with nothing to show (missing, or
// waiting on another field) is listed once under "Still to fill" instead of
// as its own empty row (Evoni's review, item 5).
export const BASICS_PAGE_ORDER = [...BASICS_ORDER, 'category', 'format'];
export const isToFill = (f) => f?.state === 'missing' || f?.state === 'waiting';
// Readiness items Continue → opens in the Basics dialog (BASICS_FIELDS key).
export const CONTINUE_BASICS = {
  'identity.category': 'category',
  'identity.format': 'format',
  'identity.date': 'date',
  'identity.time': 'time',
  'look.dress_code': 'dressCode',
};
export const coins = (n) => Number(n || 0).toLocaleString();
export const signedCoins = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${coins(Math.abs(n))}`;
// The sections that fold to one line once their readiness items are all
// complete (Evoni, 2026-10-23). Deal & Money and the documents carry no
// readiness item of their own, so they always stay open.
export const FOLDABLE = new Set(['identity', 'people', 'place', 'look', 'stakes']);
// How long the toast keeps its Undo (the page's own one-tap changes).
export const UNDO_MS = 8000;
export const TOAST_MS = 4000;
export const BASICS_STATE_LABEL = { set: 'Set', edited: 'Edited', suggested: 'Suggested', missing: 'Missing' };
// Task #2128 (doctrine rule 14): a drafted field reads "Auto-drafted ·
// <source>" until Evoni changes it, then "Edited".
// Task #2148 (rule 14): an empty field whose suggestion needs another
// field first reads "Waiting for <dependency>".
export const basicsStateLabel = (f) => {
  if (f.state === 'auto_drafted') return `Auto-drafted · ${f.source === DATE_DRAFT_SOURCE ? 'schedule' : 'AI draft'}`;
  if (f.state === 'waiting') return `Waiting for ${f.waitingFor}`;
  return BASICS_STATE_LABEL[f.state];
};
export const basicsStateIcon = (f) => {
  if (f.state === 'auto_drafted') return f.source === DATE_DRAFT_SOURCE ? CalendarClock : Sparkles;
  if (f.state === 'edited') return Pencil;
  if (f.state === 'set') return CheckCircle2;
  if (f.state === 'waiting') return Hourglass;
  return f.state === 'suggested' ? Lightbulb : CircleDashed;
};
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Review (Task #1775): one icon per readiness section. A section key not
// listed here (a later one, e.g. deliverables) falls back to PackagePlus.
export const READINESS_ICONS = {
  organizer: Building2, identity: Tag, people: Users, place: MapPin,
  invitation: Mail, look: Shirt, stakes: TrendingUp,
};
export const HH_MM = /^\d{2}:\d{2}$/;

// Display only: "2026-11-07" → "Sat, Nov 7, 2026"; "20:00" → "8:00 PM".
// Anything else (older free-text values) is shown as stored.
export function fmtBasicsValue(key, value) {
  if (!value) return value;
  if (key === 'category' || key === 'format') return taxonomyLabel(value);
  if (key === 'date' && ISO_DATE.test(value)) {
    const d = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    }
  }
  if (key === 'time' && HH_MM.test(value)) {
    const [h, m] = value.split(':').map(Number);
    if (h < 24 && m < 60) return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }
  return value;
}


/**
 * The scene sets offered for an event (S7, Evoni 2026-10-01): the venue's
 * own sets first (its World Location's; event locations before others),
 * then the show's other sets, each by name. GET /scene-sets returns every
 * show's sets, so another show's set is left out unless it is the venue's.
 */
export function orderSceneSetsForEvent(sets, venueLocationId, showId = null) {
  const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''));
  const atThisVenue = (x) => Boolean(venueLocationId) && x.world_location_id === venueLocationId;
  const list = (sets || []).filter((x) => x && x.id && (!showId || x.show_id === showId || atThisVenue(x)));
  const atVenue = list.filter(atThisVenue);
  const others = list.filter((x) => !atVenue.includes(x)).sort(byName);
  atVenue.sort((a, b) => {
    const ea = a.scene_type === 'EVENT_LOCATION' ? 0 : 1;
    const eb = b.scene_type === 'EVENT_LOCATION' ? 0 : 1;
    return ea - eb || byName(a, b);
  });
  return { atVenue, others };
}

/**
 * The picker's search (L2; Evoni's answer Q11, 2026-10-02, §8(hh)): "search
 * covers name, venue and type". venueNames: { <world_location_id>: name }.
 */
export function searchSceneSets(groups, query, venueNames = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return groups;
  const hit = (x) => [x.name, venueNames[x.world_location_id], fmtLabel(x.scene_type), x.scene_type]
    .some((v) => v && String(v).toLowerCase().includes(q));
  return { atVenue: groups.atVenue.filter(hit), others: groups.others.filter(hit) };
}

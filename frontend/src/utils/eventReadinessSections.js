/**
 * Event Package readiness, by section (Task #1775).
 *
 * Replaces the flat four-chip list computeEventReadiness used to return
 * (outfit / venue / scene / invite) with one entry per Event Package
 * section, each saying what is missing in the Package's own terms.
 * Also home to the Producer Mode → Events queue states
 * (EVENT_QUEUE_STATES / computeEventState), moved here from
 * eventReadiness.js so the queue and the Start Episode button read the
 * same gate declaration.
 *
 * Why a separate file: the Basics section reads resolveEventBasics
 * (eventBasics.js), which itself imports resolveEventVenueAndDate from
 * eventReadiness.js. Putting this in eventReadiness.js would make the two
 * files import each other.
 *
 * Rules:
 *   - A suggestion never satisfies readiness, for any field. Only a
 *     stored value does. For the Basics fields this means only
 *     resolveEventBasics's 'set' state counts; 'suggested' reads as
 *     missing, with a note that a suggestion is waiting.
 *   - The auto-scheduled date (canon_consequences.automation.
 *     event_date_auto, Task #1756) is a stored date, so it counts as set.
 *   - Nothing here fetches, saves or derives a value. Pure.
 *
 * GATES: SECTION_GATES below is the one place that says which sections
 * block Start Episode. Everything not gated is a warning. Evoni has not
 * ruled on a split yet (Task #1775 step 3), so it holds today's gates
 * exactly: outfit, venue + scene set, invitation. The organizer is not a
 * Start Episode gate today; the queue's Needs Organizer state checks it on
 * its own, as it did before.
 */
import { resolveEventVenueAndDate, resolveEventOrganizer } from './eventReadiness';
import { resolveEventBasics } from './eventBasics';
import { resolveEventStakes } from './eventStakes';

// ── The gate declaration ──────────────────────────────────────────────
// true = the section must be complete before Start Episode is enabled and
// before the queue says Ready. false = shown as a warning only.
// Today's gates, unchanged (awaiting Evoni's decision, Task #1775).
export const SECTION_GATES = {
  organizer: false,
  identity: false,
  people: false,
  place: true,
  invitation: true,
  look: true,
  stakes: false,
};

const text = (v) => (typeof v === 'string' ? v.trim() : '');

const BASICS_NOTE = { suggested: 'Suggestion not accepted' };

function item(key, label, satisfied, extra = {}) {
  return { key, label, satisfied: !!satisfied, state: satisfied ? 'set' : 'missing', note: null, ...extra };
}

// A Basics field is satisfied only in the 'set' state. A 'suggested'
// field is reported as missing, keeping its state so the page can say a
// suggestion is waiting.
function basicsItem(key, label, field) {
  const satisfied = field?.state === 'set';
  return item(key, label, satisfied, {
    state: field?.state || 'missing',
    note: satisfied
      ? (field.autoScheduled ? 'Auto-scheduled' : null)
      : (BASICS_NOTE[field?.state] || null),
  });
}

/**
 * The Event Package's sections, in page order. Each entry:
 *   { key, label, items(ctx) → [{ key, label, satisfied, state, note }] }
 * ctx = { event, basics, venueDate, organizer, stakes }.
 * Adding a section (Lala's deliverables, once they have a home — Task
 * #1773) is one more entry here plus one key in SECTION_GATES; nothing
 * else changes. An entry without a SECTION_GATES key is a warning.
 */
export const EVENT_PACKAGE_SECTIONS = [
  {
    key: 'organizer',
    label: 'Organizer',
    items: ({ organizer }) => [
      item('organizer', 'Organizer', organizer.hasOrganizer),
    ],
  },
  {
    key: 'identity',
    label: 'Event identity',
    items: ({ event, basics }) => [
      item('name', 'Name', text(event.name)),
      item('category', 'Category', text(event.category)),
      item('format', 'Format', text(event.format)),
      basicsItem('date', 'Date', basics.date),
      basicsItem('time', 'Time', basics.time),
    ],
  },
  {
    // Featured attendees are the guests marked `featured` in
    // canon_consequences.automation.guest_profiles (the Package's Make
    // Featured / Add from Feed, Task #1689). An invited guest who is not
    // featured does not count; the note says how many are invited.
    key: 'people',
    label: 'People',
    items: ({ event }) => {
      const guests = event.canon_consequences?.automation?.guest_profiles;
      const list = Array.isArray(guests) ? guests : [];
      const featured = list.filter((g) => g && g.featured).length;
      return [
        item('featured', 'Featured attendees', featured > 0, {
          note: featured > 0
            ? `${featured} featured`
            : (list.length ? `${list.length} invited, none featured` : null),
        }),
      ];
    },
  },
  {
    key: 'place',
    label: 'Place',
    items: ({ event, venueDate }) => [
      item('venue', 'Venue', venueDate.hasVenue),
      item('scene_set', 'Scene set', event.scene_set_id),
    ],
  },
  {
    key: 'invitation',
    label: 'Invitation',
    items: ({ event }) => [
      item('invitation', 'Invitation', event.invitation_asset_id),
    ],
  },
  {
    key: 'look',
    label: "Lala's look",
    items: ({ event }) => [
      item('outfit', 'Outfit', event.outfit_set_id || (Array.isArray(event.outfit_pieces) && event.outfit_pieces.length > 0)),
    ],
  },
  {
    // Only the story stakes count: narrative_stakes or fail_consequence,
    // nullable text with no column default. Prestige, strictness, cost,
    // deadline type and career tier never count — every row stores them
    // (NOT NULL defaults or creation-path derivations, eventStakes.js), so
    // their presence says nothing about whether anyone chose them.
    key: 'stakes',
    label: 'Stakes',
    items: ({ stakes }) => [
      item('story_stakes', 'Story stakes', !stakes.relationship.missing, {
        state: stakes.relationship.missing ? 'missing' : 'stored',
      }),
    ],
  },
];

/**
 * Readiness by section.
 * Returns {
 *   sections: [{ key, label, gate, complete, items, missing }],
 *   gatesMet,   // every gated section complete: Start Episode may run
 *   blocking,   // gated sections still incomplete
 *   warnings,   // ungated sections still incomplete
 *   allComplete,
 * }
 * `missing` is the section's unsatisfied items. `options.sections` and
 * `options.gates` exist for tests and for adding a section; callers
 * normally pass neither. `options.suggest: false` (a used event) drops the
 * "suggestion not accepted" note; it cannot change what is satisfied.
 */
export function computeEventPackageReadiness(event, options = {}) {
  const ev = event || {};
  const defs = options.sections || EVENT_PACKAGE_SECTIONS;
  const gates = options.gates || SECTION_GATES;
  const ctx = {
    event: ev,
    // Suggestions are resolved (unless options.suggest is false, for a
    // used event) so an item can say one is waiting; they still never
    // count, which is what the tests pin.
    basics: resolveEventBasics(ev, null, { suggest: options.suggest !== false }),
    venueDate: resolveEventVenueAndDate(ev),
    organizer: resolveEventOrganizer(ev),
    stakes: resolveEventStakes(ev),
  };

  const sections = defs.map((def) => {
    const items = def.items(ctx);
    const missing = items.filter((i) => !i.satisfied);
    return {
      key: def.key,
      label: def.label,
      gate: gates[def.key] === true,
      complete: missing.length === 0,
      items,
      missing,
    };
  });

  const blocking = sections.filter((s) => s.gate && !s.complete);
  const warnings = sections.filter((s) => !s.gate && !s.complete);
  return {
    sections,
    gatesMet: blocking.length === 0,
    blocking,
    warnings,
    allComplete: blocking.length === 0 && warnings.length === 0,
  };
}

/** "Place: scene set" style labels for a list of incomplete sections. */
export function describeMissing(sections) {
  return (sections || []).map((s) => {
    const labels = s.missing.map((m) => m.label);
    if (labels.length === 1 && labels[0] === s.label) return s.label;
    return `${s.label}: ${labels.join(', ').toLowerCase()}`;
  });
}

// Producer Mode → Events queue states (docs/EVENT_EPISODE_FLOW.md §8(m),
// Evoni's ruling, Task #1648; needs_host renamed to needs_organizer per
// §8(p)'s organizer ruling, Task #1676/#1681 — a brand-hosted event with
// no person attached is complete, not incomplete, so the old "Needs Host"
// name and check were wrong for it). Computed client-side, no persisted
// value — world_events.status stays exactly as §4 already documents it (a
// free string, written inconsistently across five call sites). This is a
// separate, read-only view over the same fields, not a new source of truth.
export const EVENT_QUEUE_STATES = {
  needs_organizer: { label: 'Needs Organizer', icon: '👤', color: '#dc2626', bg: '#fef2f2', primaryAction: 'Choose Organizer' },
  needs_setup:      { label: 'Needs Setup',     icon: '🛠️', color: '#b45309', bg: '#fef3c7', primaryAction: 'Continue Setup' },
  ready:            { label: 'Ready',           icon: '✓',  color: '#16a34a', bg: '#f0fdf4', primaryAction: 'Start Episode' },
  used:             { label: 'Used',            icon: '◉',  color: '#6366f1', bg: '#eef2ff', primaryAction: 'Open Episode' },
  archived:         { label: 'Archived',        icon: '□',  color: '#94a3b8', bg: '#f1f5f9', primaryAction: 'View' },
};

// Terminal states (archived, used) are checked before organizer/readiness —
// an already-used or declined event stays Used/Archived regardless of
// whether it happens to lack an organizer or a readiness item, since
// neither is actionable once the event is done. Then: no organizer →
// Needs Organizer; any gated section incomplete → Needs Setup; else Ready.
// Warning sections never move an event out of Ready.
export function computeEventState(event, readiness) {
  const ev = event || {};

  if (ev.status === 'declined' || ev.status === 'archived') return 'archived';
  if (ev.used_in_episode_id || ev.status === 'used' || ev.status === 'filmed') return 'used';

  const { hasOrganizer } = resolveEventOrganizer(ev);
  if (!hasOrganizer) return 'needs_organizer';

  const { gatesMet } = readiness || computeEventPackageReadiness(ev);
  return gatesMet ? 'ready' : 'needs_setup';
}

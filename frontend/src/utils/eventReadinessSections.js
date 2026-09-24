/**
 * Event Package readiness, by section and item (Task #1775).
 *
 * Replaces the flat four-chip list computeEventReadiness used to return
 * (outfit / venue / scene / invite) with one entry per Event Package
 * section, each saying what is missing in the Package's own terms.
 * Also home to the Producer Mode → Events queue states
 * (EVENT_QUEUE_STATES / computeEventState), moved here from
 * eventReadiness.js so the queue and the Start Episode button read the
 * same gate declaration.
 *
 * Why a separate file: the sections read resolveEventBasics
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
 * GATES — Evoni's ruling, 2026-09-24 (Task #1775). Start Episode asks
 * whether there is enough canonical story truth to know what episode this
 * is. BLOCK: event identity (name, category, format; date, where the
 * auto-scheduled date counts as set), organizer, place (World Location
 * only), invitation. WARN: scene set, Lala's look, featured attendees,
 * stakes, time, dress code, money. A World Location establishes where it
 * happens; a scene set is how it will be drawn, a production requirement.
 * An episode can be created before the outfit is chosen (Beat 8 needs it,
 * creation doesn't). The invitation stays a gate on purpose: Beats 4 and 5
 * are the opportunity arriving, so an episode without one starts without
 * its trigger. Warnings state their consequence and Start Anyway is
 * offered. The gate set is READINESS_ITEMS below, one line per item.
 *
 * Recorded for later, not built (Evoni's ruling, 2026-09-24): readiness is
 * not one thing. Event Ready, Script Ready, Production Ready, Evaluation
 * Ready and Acceptance Ready are separate gates; Lala's look and scene set
 * belong to the later ones. This module is Event Ready only.
 */
import { resolveEventVenueAndDate, resolveEventOrganizer } from './eventReadiness';
import { resolveEventBasics } from './eventBasics';
import { resolveEventStakes, COLUMN_DEFAULTS } from './eventStakes';

// ── The gate declaration ──────────────────────────────────────────────
// One entry per item, keyed "section.item". gate: true = the item must be
// satisfied before Start Episode is enabled and before the queue says
// Ready. gate: false = a warning: Start Episode asks first (Start Anyway)
// and the consequence line says what skipping it means. Every item carries
// a consequence so a gate can be turned into a warning by flipping one
// boolean. An item with no entry here is a warning with no consequence.
export const READINESS_ITEMS = {
  'organizer.organizer': { gate: true, consequence: 'The event has no owner, so the episode would not know whose event it is.' },
  'identity.name': { gate: true, consequence: 'The episode would have no event name.' },
  'identity.category': { gate: true, consequence: 'The episode would not know what kind of event this is.' },
  'identity.format': { gate: true, consequence: 'The episode would not know what shape the event takes.' },
  'identity.date': { gate: true, consequence: 'The episode would not know when the event happens.' },
  'identity.time': { gate: false, consequence: 'The episode has no set time.' },
  'people.featured': { gate: false, consequence: 'The script will draw on the full guest list.' },
  'place.venue': { gate: true, consequence: 'The episode would not know where the event happens.' },
  'place.scene_set': { gate: false, consequence: 'Production will need a scene set before this event can be drawn.' },
  'invitation.invitation': { gate: true, consequence: 'Beats 4 and 5 are the invitation arriving; without one the episode starts without its trigger.' },
  'look.outfit': { gate: false, consequence: 'Beat 8 needs an outfit; it will have to be chosen before then.' },
  'look.dress_code': { gate: false, consequence: 'Lala will dress without a stated dress code, so the look cannot be judged against one.' },
  'stakes.story_stakes': { gate: false, consequence: 'The script will have no stated story stakes to build tension from.' },
  'stakes.money': { gate: false, consequence: 'Finalizing the episode charges the stored cost, which may only be the column default.' },
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
 * Money (Task #1775, from describeEventMoney / resolveEventStakes).
 * cost_coins is NOT NULL DEFAULT 100 and a stored 100 cannot be told from
 * a chosen 100 (#1774), so money is almost never honestly "missing". The
 * least misleading rule: satisfied when the event is a paid appearance,
 * free (cost 0), or has a cost other than the column default; a warning
 * when the cost equals the default (may never have been chosen) or, on a
 * row that somehow has none, when there is no cost at all. Its state is
 * 'stored', never 'set'.
 */
export function moneyItem(stakes, event) {
  const kind = stakes.money.kind;
  const cost = Number(event.cost_coins);
  const isDefault = kind === 'cost' && cost === COLUMN_DEFAULTS.cost_coins;
  const satisfied = kind === 'paid' || kind === 'free' || (kind === 'cost' && !isDefault);
  return item('money', 'Money', satisfied, {
    state: kind === 'missing' ? 'missing' : 'stored',
    note: kind === 'missing'
      ? 'No cost stored'
      : (isDefault ? 'Cost matches the column default (100 coins)' : null),
  });
}

/**
 * The Event Package's sections, in page order. Each entry:
 *   { key, label, items(ctx) → [{ key, label, satisfied, state, note }] }
 * ctx = { event, basics, venueDate, organizer, stakes }.
 * Adding a section (Lala's deliverables, once they have a home — Task
 * #1773) is one more entry here plus one READINESS_ITEMS line per item;
 * nothing else changes.
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
    // Dress code is Basics' dressCode field (the stored dress_code column);
    // only its 'set' state counts, never a format/venue suggestion.
    key: 'look',
    label: "Lala's look",
    items: ({ event, basics }) => [
      item('outfit', 'Outfit', event.outfit_set_id || (Array.isArray(event.outfit_pieces) && event.outfit_pieces.length > 0)),
      basicsItem('dress_code', 'Dress code', basics.dressCode),
    ],
  },
  {
    // Story stakes: narrative_stakes or fail_consequence, nullable text
    // with no column default. Prestige, strictness, deadline type and
    // career tier never count — every row stores them (NOT NULL defaults
    // or creation-path derivations, eventStakes.js). Money: moneyItem.
    key: 'stakes',
    label: 'Stakes',
    items: ({ event, stakes }) => [
      item('story_stakes', 'Story stakes', !stakes.relationship.missing, {
        state: stakes.relationship.missing ? 'missing' : 'stored',
      }),
      moneyItem(stakes, event),
    ],
  },
];

/**
 * Readiness by section and item.
 * Returns {
 *   sections: [{ key, label, complete, kind: 'complete'|'blocking'|'warning',
 *                items, missing, blockingMissing, warningMissing }],
 *     each item also gets { gate, consequence } from READINESS_ITEMS;
 *   gatesMet,       // no gate item missing: Start Episode may run
 *   blocking,       // sections with a gate item missing
 *   warnings,       // sections with a warning item missing
 *   blockingItems,  // [{ section, sectionLabel, ...item }] gate items missing
 *   warningItems,   // same, for warning items (the Start Anyway list)
 *   allComplete,
 * }
 * `options.sections` and `options.items` (a READINESS_ITEMS stand-in) are
 * for tests and for adding a section; callers normally pass neither.
 * `options.suggest: false` (a used event) drops the "suggestion not
 * accepted" note; it cannot change what is satisfied.
 */
export function computeEventPackageReadiness(event, options = {}) {
  const ev = event || {};
  const defs = options.sections || EVENT_PACKAGE_SECTIONS;
  const rules = options.items || READINESS_ITEMS;
  const ctx = {
    event: ev,
    basics: resolveEventBasics(ev, null, { suggest: options.suggest !== false }),
    venueDate: resolveEventVenueAndDate(ev),
    organizer: resolveEventOrganizer(ev),
    stakes: resolveEventStakes(ev),
  };

  const sections = defs.map((def) => {
    const items = def.items(ctx).map((it) => {
      const rule = rules[`${def.key}.${it.key}`] || {};
      return { ...it, gate: rule.gate === true, consequence: rule.consequence || null };
    });
    const missing = items.filter((i) => !i.satisfied);
    const blockingMissing = missing.filter((i) => i.gate);
    const warningMissing = missing.filter((i) => !i.gate);
    return {
      key: def.key,
      label: def.label,
      complete: missing.length === 0,
      kind: blockingMissing.length ? 'blocking' : (warningMissing.length ? 'warning' : 'complete'),
      items,
      missing,
      blockingMissing,
      warningMissing,
    };
  });

  const flat = (list) => sections.flatMap((s) => s[list].map((i) => ({ section: s.key, sectionLabel: s.label, ...i })));
  const blockingItems = flat('blockingMissing');
  const warningItems = flat('warningMissing');
  return {
    sections,
    gatesMet: blockingItems.length === 0,
    blocking: sections.filter((s) => s.blockingMissing.length),
    warnings: sections.filter((s) => s.warningMissing.length),
    blockingItems,
    warningItems,
    allComplete: blockingItems.length === 0 && warningItems.length === 0,
  };
}

/**
 * "Place: venue" style labels, one per section. which = 'blocking' lists
 * only gate items, 'warning' only warning items, 'all' both.
 */
export function describeMissing(sections, which = 'blocking') {
  const key = which === 'warning' ? 'warningMissing' : which === 'all' ? 'missing' : 'blockingMissing';
  return (sections || []).filter((s) => s[key].length).map((s) => {
    const labels = s[key].map((m) => m.label);
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
// Needs Organizer (the organizer is a gate, but it keeps its own state);
// any other gate item missing → Needs Setup; else Ready. Warning items
// (scene set, outfit, time, dress code, featured attendees, stakes, money)
// never move an event out of Ready.
export function computeEventState(event, readiness) {
  const ev = event || {};

  if (ev.status === 'declined' || ev.status === 'archived') return 'archived';
  if (ev.used_in_episode_id || ev.status === 'used' || ev.status === 'filmed') return 'used';

  const { hasOrganizer } = resolveEventOrganizer(ev);
  if (!hasOrganizer) return 'needs_organizer';

  const { gatesMet } = readiness || computeEventPackageReadiness(ev);
  return gatesMet ? 'ready' : 'needs_setup';
}

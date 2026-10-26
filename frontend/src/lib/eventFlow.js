/**
 * How the Event Package page shows where an event is and how to move
 * through it (Evoni, 2026-10-25: "What else can we improve on the event page
 * and how it flows?" … "I want them all and show me first"). Pure helpers
 * over what the page already has (its readiness, the event, the season
 * context) and the season's roadmap and release schedule; nothing here
 * fetches or saves.
 *
 *   eventStages(...)       Idea → Set up → Invited → Ready → In an episode → Done
 *   setupSections(...)     the "N to set up" list (the Season page card's count)
 *   blockedReasons(...)    why Start Episode, the invitation or Propose terms can't run yet
 *   parseFrom / fromParam / returnLink / packageHref   "back to where you came from"
 *   slotNeighbours(...)    the events before and after in slot order
 *   goalGainText / releaseLine                         the season panel's lines
 */
import { describeMissing } from '../utils/eventReadinessSections';
import { seasonPageHref, allSlots } from './seasonPage';
import { EVENT_SHOWS } from './eventLibrary';

// ── Stages ────────────────────────────────────────────────────────────

export const EVENT_STAGES = [
  { key: 'idea', label: 'Idea' },
  { key: 'setup', label: 'Set up' },
  { key: 'invited', label: 'Invited' },
  { key: 'ready', label: 'Ready' },
  { key: 'episode', label: 'In an episode' },
  { key: 'done', label: 'Done' },
];

// The gate items that make an event "set up": who it is for, what and when
// it is, and where (the invitation and the deal's prices come after).
const SETUP_ITEMS = ['organizer.organizer', 'identity.name', 'identity.category', 'identity.format', 'identity.date', 'place.venue'];

// Each gate item as the clause "… once <clause>" reads.
const ITEM_CLAUSE = {
  'organizer.organizer': 'the organizer is chosen',
  'identity.name': 'it has a name',
  'identity.category': 'a category is picked',
  'identity.format': 'a format is picked',
  'identity.date': 'the date is set',
  'place.venue': 'the venue is chosen',
  'invitation.invitation': 'the invitation is made',
  'stakes.prices': 'deal prices are set',
};
const clauseOf = (it) => ITEM_CLAUSE[`${it.section}.${it.key}`] || `${it.label.toLowerCase()} is set`;

/** "a, b and c". */
export function andList(parts) {
  const list = parts.filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/**
 * The event's stages, each { key, label, state: 'done'|'current'|'todo',
 * hint }, and `current` (the stage's key). A stage is reached when every
 * stage before it is: an invitation made before the venue is chosen does not
 * make the event Invited. `hint` says what moves the event on to that
 * stage, from what is still missing ("Ready once the invitation is made and
 * deal prices are set"); a reached stage says what it took.
 *   readiness      computeEventPackageReadiness (the page's own)
 *   used           the event has started an episode (or its terms are locked by one)
 *   episode        the episode it started ({ evaluation_status }), when loaded
 */
export function eventStages({ event, readiness, used = false, episode = null }) {
  const gates = readiness?.blockingItems || [];
  const missing = (keys) => gates.filter((it) => keys.includes(`${it.section}.${it.key}`));
  const setupMissing = missing(SETUP_ITEMS);
  const hasInvitation = Boolean(event?.invitation_asset_id);
  const accepted = episode?.evaluation_status === 'accepted';

  const reached = {
    idea: true,
    setup: used || setupMissing.length === 0,
    invited: used || (setupMissing.length === 0 && hasInvitation),
    ready: used || (readiness?.gatesMet ?? false),
    episode: used,
    done: used && accepted,
  };
  const hints = {
    idea: 'The event exists',
    setup: setupMissing.length
      ? `Set up once ${andList(setupMissing.map(clauseOf))}`
      : 'Organizer, basics and venue are set',
    invited: hasInvitation || used ? 'The invitation is made' : 'Invited once the invitation is made',
    ready: gates.length && !used ? `Ready once ${andList(gates.map(clauseOf))}` : 'Everything Start Episode needs is set',
    episode: used ? 'Start Episode made its episode' : 'In an episode once you press Start Episode',
    done: accepted ? 'Its episode is accepted' : 'Done once its episode is accepted',
  };
  let current = 'idea';
  for (const s of EVENT_STAGES) {
    if (!reached[s.key]) break;
    current = s.key;
  }
  const at = EVENT_STAGES.findIndex((s) => s.key === current);
  const stages = EVENT_STAGES.map((s, i) => ({
    ...s,
    state: i < at ? 'done' : i === at ? 'current' : 'todo',
    hint: hints[s.key],
  }));
  const next = stages[at + 1] || null;
  return { current, stages, next };
}

// ── The setup list ────────────────────────────────────────────────────

// Where each readiness section is set on the page. The deal's prices are
// in Deal & Money, though their gate is counted under Stakes.
const SECTION_ANCHOR = { organizer: 'people', identity: 'identity', place: 'place', invitation: 'invitation', look: 'look', people: 'people', stakes: 'deal' };
export const anchorOfSection = (key) => SECTION_ANCHOR[key] || key;

/**
 * The "N to set up" list: the same entries the Season page's event card
 * counts (describeMissing over the sections with a gate item missing), one
 * per section, in page order. `seen` is { [sectionKey]: label } of the
 * entries shown earlier this visit: one filled in since stays, ticked, under
 * the words it had. Returns [{ key, anchor, label, done, first }] where
 * first is the section's first missing gate item (what a jump opens).
 */
export function setupSections(readiness, seen = {}) {
  const sections = readiness?.sections || [];
  return sections.flatMap((sec) => {
    if (sec.blockingMissing?.length) {
      return [{
        key: sec.key, anchor: anchorOfSection(sec.key), label: describeMissing([sec])[0], done: false,
        first: { section: sec.key, sectionLabel: sec.label, ...sec.blockingMissing[0] },
      }];
    }
    if (seen[sec.key]) return [{ key: sec.key, anchor: anchorOfSection(sec.key), label: seen[sec.key], done: true, first: null }];
    return [];
  });
}

// ── Why something can't run yet ───────────────────────────────────────

/**
 * Where a control is unavailable today because something else is missing,
 * the reason and what to do: { start, invitation, propose }, each null or
 * { text, action: { label, target } } (target: a readiness item to open,
 * or a string the caller knows).
 *   start       Start Episode, until every gate item is set (or while Lala's money is checked)
 *   invitation  making the invitation, until there is an organizer (it names them)
 *   propose     Propose terms, until the deal has a paid part (none ticked: no deal type yet)
 */
export function blockedReasons({ readiness, used = false, hasOrganizer = true, hasInvitation = false, moneyPending = false, plan = null, termsLocked = false }) {
  const gates = readiness?.blockingItems || [];
  let start = null;
  if (!used && gates.length) {
    const names = gates.map((it) => it.label.toLowerCase());
    start = {
      text: `Start Episode needs ${gates.length === 1 ? 'one thing' : `${gates.length} things`} first: ${andList(names)}`,
      action: { label: actionLabel(gates[0]), target: gates[0] },
    };
  } else if (!used && moneyPending) {
    start = { text: 'Start Episode waits while Lala’s money is checked', action: null };
  }
  const invitation = !used && !hasOrganizer && !hasInvitation
    ? { text: 'The invitation needs an organizer first: it names them', action: { label: 'Pick one', target: 'organizer' } }
    : null;
  let propose = null;
  if (plan && !termsLocked && !plan.cash) {
    propose = plan.known
      ? { text: 'Proposing terms needs a paid part in the deal', action: { label: 'Change the deal', target: 'deal' } }
      : { text: 'Deal prices need a deal type first', action: { label: 'Pick one', target: 'deal' } };
  }
  return { start, invitation, propose };
}
// What the button beside a reason says, for the first missing item.
const ITEM_ACTION = {
  'organizer.organizer': 'Choose the organizer',
  'identity.name': 'Name it',
  'identity.category': 'Pick a category',
  'identity.format': 'Pick a format',
  'identity.date': 'Set the date',
  'place.venue': 'Choose the venue',
  'invitation.invitation': 'Make the invitation',
  'stakes.prices': 'Set deal prices',
};
export const actionLabel = (it) => ITEM_ACTION[`${it.section}.${it.key}`] || `Set ${it.label.toLowerCase()}`;

// ── Where she came from ───────────────────────────────────────────────

/**
 * The page's `?from=`: where the Event Package was opened from, so "back"
 * returns there with its filter. roadmap:<slot>, events:<show filter>,
 * events (the Events tab, no filter), producer (Producer Mode). Anything
 * else is no origin.
 */
export function parseFrom(value) {
  const v = String(value || '');
  let m = /^roadmap:(\d{1,3})$/.exec(v);
  if (m) return { kind: 'roadmap', slot: Number(m[1]) };
  if (v === 'roadmap') return { kind: 'roadmap', slot: null };
  m = /^events(?::([a-z-]+))?$/.exec(v);
  if (m) return { kind: 'events', show: EVENT_SHOWS.some((s) => s.key === m[1]) ? m[1] : null };
  if (v === 'producer') return { kind: 'producer' };
  return null;
}

/** The `?from=` value for an origin (the inverse of parseFrom), or null. */
export function fromParam(origin) {
  if (!origin) return null;
  if (origin.kind === 'roadmap') return origin.slot ? `roadmap:${origin.slot}` : 'roadmap';
  if (origin.kind === 'events') return origin.show ? `events:${origin.show}` : 'events';
  if (origin.kind === 'producer') return 'producer';
  return null;
}

/** The Event Package's address, carrying where it was opened from. */
export function packageHref(showId, eventId, from = null) {
  const base = `/shows/${encodeURIComponent(showId)}/events/${encodeURIComponent(eventId)}`;
  // Only a value parseFrom reads (roadmap:5, events:unplaced, producer), so it needs no escaping.
  const value = fromParam(typeof from === 'string' ? parseFrom(from) : from);
  return value ? `${base}?from=${value}` : base;
}

/**
 * The header's way back: { href, label, done }. To the Roadmap with that
 * slot open, the Events tab under the filter it had, or Producer Mode; with
 * no origin, the Events tab (as before). `done` (nothing left to set up)
 * reads "Done · back to …".
 */
export function returnLink(origin, { showId, done = false } = {}) {
  let href = seasonPageHref(showId, 'events');
  let where = 'Events';
  if (origin?.kind === 'roadmap') {
    href = seasonPageHref(showId, 'roadmap', origin.slot ? { slot: origin.slot } : null);
    where = origin.slot ? `E${origin.slot} on the Roadmap` : 'the Roadmap';
  } else if (origin?.kind === 'events') {
    href = seasonPageHref(showId, 'events', origin.show ? { show: origin.show } : null);
    const label = EVENT_SHOWS.find((s) => s.key === origin.show)?.label;
    where = origin.show === 'all' ? 'All events' : label || 'Events';
  } else if (origin?.kind === 'producer') {
    href = `/shows/${encodeURIComponent(showId)}/world?tab=overview`;
    where = 'Producer Mode';
  }
  const back = origin ? `back to ${where}` : where;
  return { href, label: done ? `Done · ${back}` : (origin ? `Back to ${where}` : where), done };
}

// ── Before and after in the season ────────────────────────────────────

/**
 * The events before and after this slot in the season's slot order: the
 * nearest slot each way that holds an event (or an episode with none
 * named), skipping open slots. Each is { slot_number, code, name, eventId,
 * episodeId } or null; both null when the event is in no slot.
 */
export function slotNeighbours(roadmap, slotNumber) {
  if (slotNumber == null) return { prev: null, next: null };
  const slots = allSlots(roadmap);
  const filled = slots.filter((s) => s.event?.id || s.episode?.id);
  const ref = (s) => (s ? {
    slot_number: s.slot_number,
    code: `E${s.slot_number}`,
    name: s.event?.name || s.episode?.title || null,
    eventId: s.event?.id || null,
    episodeId: s.event?.id ? null : (s.episode?.id || null),
  } : null);
  const before = filled.filter((s) => s.slot_number < slotNumber);
  const after = filled.filter((s) => s.slot_number > slotNumber);
  return { prev: ref(before[before.length - 1]), next: ref(after[0]) };
}

/** A neighbour's address: its Event Package (keeping where she came from), else its episode. */
export function neighbourHref(showId, n, from = null) {
  if (!n) return null;
  if (n.eventId) return packageHref(showId, n.eventId, from);
  return n.episodeId ? `/episodes/${encodeURIComponent(n.episodeId)}` : null;
}

/** The roadmap slot this event's season context names, or null. */
export const slotOf = (roadmap, slotNumber) => (slotNumber == null ? null : allSlots(roadmap).find((s) => Number(s.slot_number) === Number(slotNumber)) || null);

// ── The season panel's lines ──────────────────────────────────────────

const n = (v) => Number(v || 0).toLocaleString('en-US');

/**
 * What this event adds to each goal it moves, by goal id: "+600 coins"
 * from the coverage's movers (the expected reward of an event placed in a
 * slot). A goal it moves with no counted reward (a pin, prestige) is
 * absent. coverage: GET .../season/goal-coverage?event_id=.
 */
export function goalGains(coverage, eventId) {
  const out = {};
  for (const g of coverage?.goals || []) {
    const m = (g.movers || []).find((x) => String(x.event_id) === String(eventId));
    if (m && m.gain > 0) out[g.id] = { text: `+${n(m.gain)} ${String(g.metric_label || g.target_metric || '').toLowerCase()}`.trim(), done: Boolean(m.done) };
  }
  return out;
}

/** The goals line in words: "+600 coins toward Earn 3,000 Prime Coins; moves Break Into Luxury". */
export function goalGainText(coverage, eventId) {
  const moves = coverage?.event?.moves || [];
  if (!moves.length) return null;
  const gains = goalGains(coverage, eventId);
  return moves.map((g) => (gains[g.goal_id] ? `${gains[g.goal_id].text} toward ${g.title}` : `moves ${g.title}`)).join('; ');
}

/**
 * The release line from lib/releaseSchedule's slotWhen ({ text, source }):
 * "Releases Sun, Nov 29", "Would release Sun, Nov 29 once releasing starts",
 * or null.
 */
export function releaseLine(when) {
  if (!when?.text) return null;
  if (when.source === 'preview') return `Would release ${when.text.replace(/^Would be /, '')} once releasing starts`;
  return `Releases ${when.text}`;
}

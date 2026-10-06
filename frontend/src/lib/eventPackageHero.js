/**
 * The Event Package's header, readiness strip and "On this page" menu, in
 * the Producer Mode style (Evoni's mock, 2026-10-05). Pure helpers over what
 * the page already resolves: the event, its date and venue
 * (resolveEventVenueAndDate), its organizer (describeEventOrganizer), its
 * challenge projection (resolveEventStakes().difficulty), its deal
 * (dealLabelFor, describeCompensation) and its readiness
 * (computeEventPackageReadiness).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^(\d{2}):(\d{2})/;

/** "2026-11-12" → "Thu, Nov 12"; anything else as stored. */
export function shortDate(value) {
  if (!value) return null;
  if (!ISO_DATE.test(value)) return String(value);
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** "18:30" → "6:30 PM"; anything else as stored. */
export function shortTime(value) {
  if (!value) return null;
  const m = HH_MM.exec(String(value));
  if (!m) return String(value);
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * The five tiles under the event's name: [{ key, label, value, sub }].
 * A tile with nothing set says so instead of hiding.
 */
export function heroTiles({ event, venueDate, organizer, projection, dealLabel, compensation }) {
  const ev = event || {};
  const date = shortDate(venueDate?.eventDate || ev.event_date);
  const time = shortTime(ev.event_time);
  const venue = venueDate?.venueName || ev.venue_name || null;
  const district = ev.lalaverse_district || ev.canon_consequences?.automation?.lalaverse_district || null;
  const pays = compensation?.amount > 0 ? `${compensation.isPaid ? 'Earns' : 'Agreed'} ${compensation.amount.toLocaleString()} coins` : (dealLabel ? 'Unpaid' : null);
  return [
    { key: 'when', label: 'When', value: date || 'No date', sub: time || (date ? 'No time set' : null), empty: !date },
    { key: 'where', label: 'Where', value: venue || 'No venue', sub: district, empty: !venue },
    { key: 'organizer', label: 'Organizer', value: organizer?.name || 'No organizer', sub: organizer?.handle ? `@${String(organizer.handle).replace(/^@/, '')}` : (organizer?.kind === 'brand' ? 'Brand' : null), empty: !organizer?.name },
    { key: 'deal', label: 'Deal', value: dealLabel || 'No deal set', sub: pays, empty: !dealLabel },
    { key: 'challenge', label: 'Challenge', value: projection?.complete ? projection.label.text : 'Not projected', sub: projection?.complete ? 'projected' : null, empty: !projection?.complete },
  ];
}

/** "S1 · E1 · Season 1 · Phase 1: Foundation", or the season when the event is in no slot. */
export function seasonLine(context) {
  if (!context) return null;
  if (!context.in_slot) return `Season ${context.season_number} · not on the roadmap yet`;
  return [context.label, `Season ${context.season_number}`, context.phase?.title ? `Phase ${context.phase.number}: ${context.phase.title}` : null]
    .filter(Boolean).join(' · ');
}

/** A readiness section's tile: its state ('complete' | 'warning' | 'blocking') and one line on it. */
export function readinessTile(section) {
  if (section.complete) return { key: section.key, label: section.label, kind: 'complete', text: 'Complete' };
  const first = section.missing?.[0];
  const text = first ? first.label : (section.kind === 'blocking' ? 'Needed to start' : 'To review');
  return { key: section.key, label: section.label, kind: section.kind, text: section.missing?.length > 1 ? `${text} +${section.missing.length - 1}` : text };
}

/** The strip's headline: "Ready · 2 warnings to review", "Ready", or "3 items needed to start". */
export function readinessHeadline(readiness, extraWarnings = 0) {
  if (!readiness.gatesMet) {
    const n = readiness.blockingItems.length;
    return `${n} item${n === 1 ? '' : 's'} needed to start`;
  }
  const w = readiness.warningItems.length + extraWarnings;
  return w ? `Ready · ${w} warning${w === 1 ? '' : 's'} to review` : 'Ready';
}

/** The page's sections, in order, as the "On this page" menu lists them; which readiness sections each covers. */
export const PAGE_SECTIONS = [
  // The invitation sits beside The Event's fields (the redesign's part 2).
  { anchor: 'identity', label: 'The Event', covers: ['identity', 'invitation'] },
  { anchor: 'people', label: 'People', covers: ['organizer', 'people'] },
  { anchor: 'place', label: 'Place', covers: ['place'] },
  { anchor: 'look', label: "Lala's Look", covers: ['look'] },
  // Part 3: the terms and the money, the story stakes, the planning notes.
  { anchor: 'deal', label: 'Deal & Money', covers: [] },
  { anchor: 'stakes', label: 'Story Stakes', covers: ['stakes'] },
  // The in-world documents beside the invitation (Evoni, 2026-10-06).
  { anchor: 'documents', label: 'In-world documents', covers: [] },
  { anchor: 'concept', label: 'Behind the Scenes', covers: [], optional: true },
];

const RANK = { complete: 0, warning: 1, blocking: 2 };

/** The menu's entries with the worst state of the readiness sections each covers ('none' when it covers none); an optional section only when the page has it. */
export function pageNav(readiness, { has = {} } = {}) {
  const byKey = new Map((readiness?.sections || []).map((s) => [s.key, s.complete ? 'complete' : s.kind]));
  return PAGE_SECTIONS.filter((s) => !s.optional || has[s.anchor]).map((s) => {
    const states = s.covers.map((k) => byKey.get(k)).filter(Boolean);
    const state = states.length ? states.reduce((a, b) => (RANK[b] > RANK[a] ? b : a)) : 'none';
    return { ...s, state };
  });
}

/**
 * Deal & Money's three tiles from the money preview (GET money-preview):
 * what Lala earns (the planned income), what she pays (the planned costs not
 * covered) and the performance bonus (the conditional payouts). Null without
 * a preview (a used event has none).
 */
export function dealTiles(preview) {
  if (!preview) return null;
  const counted = (preview.lines || []).filter((l) => !l.covered && !l.conditional);
  const earns = counted.filter((l) => l.signed > 0).reduce((n, l) => n + l.signed, 0);
  const pays = counted.filter((l) => l.signed < 0).reduce((n, l) => n - l.signed, 0);
  const covered = (preview.lines || []).filter((l) => l.covered).length;
  const bonus = (preview.projection?.conditional || []).reduce((n, b) => n + (Number(b.amount) || 0), 0);
  return [
    { key: 'earns', label: 'Lala earns', value: `${earns.toLocaleString()} coins`, sub: earns ? 'planned income' : 'no planned income' },
    { key: 'pays', label: 'Lala pays', value: `${pays.toLocaleString()} coins`, sub: covered ? `${covered} cost${covered === 1 ? '' : 's'} covered` : (pays ? 'planned costs' : 'no planned costs') },
    { key: 'bonus', label: 'Performance bonus', value: bonus ? `up to ${bonus.toLocaleString()} coins` : 'None', sub: bonus ? 'if she earns it' : 'a strong result pays nothing extra' },
  ];
}

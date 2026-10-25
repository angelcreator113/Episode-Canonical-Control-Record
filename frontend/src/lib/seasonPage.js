/**
 * The Season page (pages/SeasonPage.jsx, Evoni's mockup, 2026-10-25): pure
 * helpers over what the Season Plan already loads (GET .../arc, .../goals,
 * .../season/roadmap, .../season/insights, .../season/reveals, the show's
 * episodes and events). Nothing here is invented: a number the data does
 * not hold is null, and the page says so.
 */
import { slotTitle } from './seasonArc';

/** The page's tabs, in order; `?tab=` holds the key. */
export const SEASON_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'roadmap', label: 'Episode Roadmap' },
  { key: 'events', label: 'Events' },
  { key: 'story', label: 'Story Development' },
  { key: 'production', label: 'Production Plan' },
  { key: 'results', label: 'Results & Analytics' },
];
export const tabFrom = (value) => (SEASON_TABS.some((t) => t.key === value) ? value : 'overview');

/** A slot's state in the mockup's words (seasonSlotService.slotState). */
export const SLOT_STATUS = {
  done: 'Done',
  in_production: 'In Production',
  event_ready: 'Event Pending',
  needs_event: 'Open',
};
export const SLOT_STATUS_ORDER = ['in_production', 'event_ready', 'needs_event', 'done'];

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** "Jan 5, 2026" from YYYY-MM-DD (read as a calendar day, never shifted by a time zone); null when absent. */
export function dayLabel(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** "Jan 5, 2026 – Mar 29, 2026", one side alone, or null. */
export function dateRange(startsOn, endsOn) {
  const a = dayLabel(startsOn);
  const b = dayLabel(endsOn);
  if (a && b) return `${a} – ${b}`;
  if (a) return `From ${a}`;
  if (b) return `Until ${b}`;
  return null;
}

/** Every slot of the roadmap, in slot order. */
export const allSlots = (roadmap) => (roadmap?.phases || []).flatMap((p) => p.slots || []).sort((a, b) => a.slot_number - b.slot_number);

/**
 * The four stat cards. Budget: Lala's balance from the ledger and this
 * season's spend, income and net (Planning Insights' money, which reads the
 * ledger only); null when the insights did not load, and `has_ledger` false
 * when there is no ledger row yet.
 */
export function seasonStats({ roadmap, goals = [], insights = null }) {
  const slots = allSlots(roadmap);
  const total = roadmap?.slot_count ?? slots.length;
  const counts = roadmap?.counts || {};
  const done = counts.done || 0;
  const scheduled = slots.filter((s) => s.state !== 'needs_event').length;
  const live = goals.filter((g) => g.status !== 'failed' && g.status !== 'archived');
  const goalsDone = live.filter((g) => g.status === 'completed').length;
  const money = insights?.money || null;
  return {
    slots: { total, done, remaining: Math.max(0, total - done) },
    goals: { total: live.length, done: goalsDone, remaining: live.length - goalsDone },
    events: { scheduled, remaining: Math.max(0, total - scheduled) },
    budget: money ? {
      balance: money.balance,
      spend: money.season?.spend || 0,
      income: money.season?.income || 0,
      net: money.season?.net || 0,
      trend: money.trend || [],
      has_ledger: (money.trend || []).length > 0,
    } : null,
  };
}

/** The part a slot is in, from the arc's phases (where its picture lives). */
export const arcPart = (arc, phase) => (arc?.phases || []).find((p) => Number(p.phase) === Number(phase)) || null;

/**
 * A slot card's picture: the episode's thumbnail, else its event's cover
 * (the invitation), else its part's picture, else null (the card draws a
 * gradient in its part's colour).
 */
export function slotPicture(slot, { episodes = [], events = [], arc = null } = {}) {
  const ep = slot?.episode ? episodes.find((e) => e.id === slot.episode.id) : null;
  if (ep?.thumbnail_url) return ep.thumbnail_url;
  const ev = slot?.event ? events.find((e) => e.id === slot.event.id) : null;
  if (ev?.invitation_url) return ev.invitation_url;
  return arcPart(arc, slot?.phase)?.picture_url || null;
}

/** A slot card's title: the episode, else the event, else the purpose, else "Open slot". */
export const slotCardTitle = (slot) => slotTitle(slot) || 'Open slot';

/** The slots the roadmap filters keep: one part or all, one state or all. */
export function filterSlots(slots, { part = 'all', status = 'all' } = {}) {
  return (slots || []).filter((s) => (part === 'all' || Number(s.phase) === Number(part)) && (status === 'all' || s.state === status));
}

/** A part's progress: done of its slots. */
export function partProgress(phase) {
  const slots = phase?.slots || [];
  return { done: slots.filter((s) => s.state === 'done').length, total: slots.length };
}

/**
 * The secrets matrix (Secrets & Reveals card): per secret in the plan, the
 * slots that hint at it and the one that reveals it, in slot order.
 */
export function revealMatrix(plan) {
  const reveals = plan?.reveals || [];
  return (plan?.secrets || [])
    .map((secret) => {
      const mine = reveals.filter((r) => r.secret_id === secret.id).sort((a, b) => a.slot_number - b.slot_number);
      return {
        id: secret.id,
        name: secret.text,
        who: secret.character_name || null,
        hints: mine.filter((r) => r.intent === 'hint').map((r) => r.slot_number),
        reveal: mine.find((r) => r.intent === 'reveal')?.slot_number ?? null,
      };
    })
    .filter((row) => row.hints.length || row.reveal != null);
}

/** The events in the season's slots, in slot order, with the event row when the show's list has it. */
export function slotEvents(roadmap, events = []) {
  return allSlots(roadmap)
    .filter((s) => s.event)
    .map((s) => ({ slot: s, event: events.find((e) => e.id === s.event.id) || s.event }));
}

/** "In Production" chip text plus a count line for the Episode Slots card. */
export const slotsLine = (stats) => `${stats.slots.done} completed · ${stats.slots.remaining} remaining`;
export const goalsLine = (stats) => `${stats.goals.done} complete · ${stats.goals.remaining} remaining`;
export const eventsLine = (stats) => `${stats.events.scheduled} scheduled · ${stats.events.remaining} remaining`;

/** The hero's chips: "24 Episodes", "3 Parts", the dates when set. */
export function heroChips({ roadmap, arc }) {
  const chips = [plural(roadmap?.slot_count ?? 24, 'Episode', 'Episodes'), plural((arc?.phases || []).length || 3, 'Part', 'Parts')];
  const dates = dateRange(arc?.starts_on, arc?.ends_on);
  if (dates) chips.push(dates);
  return chips;
}


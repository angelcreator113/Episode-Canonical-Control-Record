/**
 * The Season calendar (the Roadmap's Calendar view; Evoni, 2026-10-25:
 * "What else can we improve on the Season page?" … "I want them all";
 * 2026-10-26, round 3). One month at a time, three kinds of date:
 *
 *   release   each slot's release day from the weekly release schedule
 *             (lib/releaseSchedule slotRow, the same row the slot cards and
 *             ReleaseBoard's calendar read; "Would be" while the schedule
 *             is a preview)
 *   event     the in-world date of each event in the season's slots (an
 *             event_date written as YYYY-MM-DD; a date in words, "the night
 *             of the gala", has no day to put it on and is counted instead)
 *             A bonus episode or special has its own release day (tone
 *             'special'), and a two-parter's slots read "E12 · Part 1/2"
 *   deadline  a brand deal's answer-by, shoot and goes-public dates (open
 *             deals only, the daily update's rule), and the season's own
 *             start and end dates
 *
 * Every day is a calendar day (YYYY-MM-DD), never moved by a time zone.
 * Pure: SeasonCalendar renders it. On a phone the month reads as a list by
 * week.
 */
import { allSlots } from './seasonPage';
import { slotRow, episodeNumberOf, formatDay } from './releaseSchedule';

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const KIND_LABEL = { release: 'Release', event: 'In-world event', deadline: 'Deadline' };
// A deal that is over has no deadline left (services/dailyUpdate comingUp).
const CLOSED_DEALS = new Set(['declined', 'expired', 'cancelled', 'archived', 'completed', 'paid']);

const dayOf = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};
const utcDate = (iso) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))));
const isoOf = (d) => d.toISOString().slice(0, 10);

/**
 * Every dated item of the season, in day order: { key, date, kind, title,
 * detail, tone, slot_number }. `undated` counts the season's events whose
 * date is in words.
 */
export function calendarItems({ release = null, roadmap = null, events = [], opps = [], arc = null } = {}) {
  const items = [];
  const seasonNumber = roadmap?.season_number ?? arc?.season_number ?? null;
  const byId = new Map((events || []).map((e) => [e.id, e]));
  let undated = 0;

  for (const slot of allSlots(roadmap)) {
    const row = slotRow(release, slot, seasonNumber);
    const date = dayOf(row?.date);
    if (date) {
      const n = (slot.episode && episodeNumberOf(row)) || slot.slot_number;
      const preview = row.source === 'preview';
      const name = slot.episode?.title || slot.event?.name || null;
      items.push({
        key: `release-${slot.id}`, date, kind: 'release', slot_number: slot.slot_number,
        title: `${preview ? 'Would release' : 'Releases'} ${slot.two_part ? slot.two_part.label : `E${n}`}`,
        detail: name || (slot.episode ? null : 'Open slot'),
        tone: row.due === 'overdue' ? 'overdue' : row.due === 'soon' ? 'soon' : preview ? 'preview' : 'calm',
      });
    }
    if (slot.event) {
      const ev = byId.get(slot.event.id) || slot.event;
      const at = dayOf(ev.event_date);
      if (at) {
        items.push({ key: `event-${slot.event.id}`, date: at, kind: 'event', slot_number: slot.slot_number, title: ev.name || 'Event', detail: `In-world · E${slot.slot_number}`, tone: 'calm' });
      } else if (ev.event_date) {
        undated += 1;
      }
    }
  }

  // Bonus episodes and specials (seasonSpecials): their own release day, marked
  // as specials, and a bonus's event on its in-world day.
  for (const sp of roadmap?.specials || []) {
    const row = (release?.specials || []).find((r) => r.special_id === sp.id) || null;
    const date = dayOf(row?.date || sp.release?.date);
    if (date) {
      items.push({
        key: `special-${sp.id}`, date, kind: 'release', special: true, slot_number: null,
        title: `Special: ${sp.title || sp.label}`, detail: `${sp.label} · its own day`,
        tone: row?.due === 'overdue' ? 'overdue' : row?.due === 'soon' ? 'soon' : 'special',
      });
    }
    if (sp.event) {
      const ev = byId.get(sp.event.id) || sp.event;
      const at = dayOf(ev.event_date);
      if (at) items.push({ key: `event-special-${sp.id}`, date: at, kind: 'event', slot_number: null, title: ev.name || 'Event', detail: `In-world · ${sp.label}`, tone: 'calm' });
      else if (ev.event_date) undated += 1;
    }
  }

  for (const o of opps || []) {
    if (!o || CLOSED_DEALS.has(o.status)) continue;
    const name = o.name || o.brand_or_company || 'A deal';
    for (const [field, what] of [['response_deadline', 'Answer by'], ['shoot_date', 'Shoot'], ['publish_date', 'Goes public']]) {
      const date = dayOf(o[field]);
      if (date) items.push({ key: `deal-${o.id}-${field}`, date, kind: 'deadline', title: `${what}: ${name}`, detail: o.brand_or_company && o.brand_or_company !== name ? o.brand_or_company : null, tone: 'calm' });
    }
  }
  const start = dayOf(arc?.starts_on);
  const end = dayOf(arc?.ends_on);
  if (start) items.push({ key: 'season-start', date: start, kind: 'deadline', title: `Season ${seasonNumber || 1} starts`, detail: null, tone: 'calm' });
  if (end) items.push({ key: 'season-end', date: end, kind: 'deadline', title: `Season ${seasonNumber || 1} ends`, detail: null, tone: 'calm' });

  const order = { release: 0, event: 1, deadline: 2 };
  items.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind] || a.title.localeCompare(b.title));
  return { items, undated };
}

/** { year, month } (month 0-11) of a YYYY-MM-DD day. */
export const monthOf = (iso) => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) - 1 });
/** The month after (step 1) or before (step -1). */
export function stepMonth({ year, month }, step) {
  const m = month + step;
  return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
}
export const monthLabel = ({ year, month }) => `${MONTH_NAMES[month]} ${year}`;

/** The month to open on: the next item's (today's when it falls this month), else the last item's, else today's. */
export function openingMonth(items, today) {
  const next = (items || []).find((i) => i.date >= today);
  if (next) return monthOf(next.date);
  if ((items || []).length) return monthOf(items[items.length - 1].date);
  return monthOf(today);
}

/**
 * The month as weeks of seven days, Sunday first: [[{ date, day, inMonth,
 * items, today }]]. Days of the weeks around it are there (inMonth false),
 * with their own items, so a release on the 1st of the next month still shows.
 */
export function monthGrid({ year, month }, items = [], today = null) {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const last = new Date(Date.UTC(year, month + 1, 0));
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + (6 - last.getUTCDay()));
  const byDay = new Map();
  for (const i of items) byDay.set(i.date, [...(byDay.get(i.date) || []), i]);
  const weeks = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === 0) weeks.push([]);
    const date = isoOf(d);
    weeks[weeks.length - 1].push({ date, day: d.getUTCDate(), inMonth: d.getUTCMonth() === month, items: byDay.get(date) || [], today: date === today });
  }
  return weeks;
}

/**
 * The phone's list: the month's items by week, Sunday first: [{ start,
 * label: "Week of Sun, Nov 1", items }], only the weeks with something in them.
 */
export function weekList({ year, month }, items = []) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const weeks = new Map();
  for (const i of items.filter((x) => x.date.startsWith(prefix))) {
    const d = utcDate(i.date);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    const start = isoOf(d);
    if (!weeks.has(start)) weeks.set(start, { start, label: `Week of ${formatDay(start)}`, items: [] });
    weeks.get(start).items.push(i);
  }
  return [...weeks.values()].sort((a, b) => a.start.localeCompare(b.start));
}

/** "3 releases · 1 in-world event · 2 deadlines" for the month. */
export function monthSummary({ year, month }, items = []) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const mine = items.filter((i) => i.date.startsWith(prefix));
  const n = (kind) => mine.filter((i) => i.kind === kind).length;
  const plural = (c, one, many) => `${c} ${c === 1 ? one : many}`;
  const parts = [
    n('release') && plural(n('release'), 'release', 'releases'),
    n('event') && plural(n('event'), 'in-world event', 'in-world events'),
    n('deadline') && plural(n('deadline'), 'deadline', 'deadlines'),
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Nothing dated this month';
}

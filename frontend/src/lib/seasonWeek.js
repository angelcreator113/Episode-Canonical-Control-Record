/**
 * The Roadmap's This week view (Evoni, 2026-10-25): the next two or three
 * releases, each slot with its date, where it stands and what it still
 * needs. Pure helpers over the roadmap, the release schedule's view
 * (lib/releaseSchedule: its computed dates, and hand-set air_dates) and the
 * page's episodes. Without a date anywhere, the next slots in order stand in.
 */
import { allSlots } from './seasonPage';
import { formatDay, formatRelease, seasonOf } from './releaseSchedule';

export const WEEK_LIMIT = 3;

/** Today as YYYY-MM-DD in the viewer's own time (dates are her wall-clock days). */
export function todayIso(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

const done = (slot, ep) => slot.state === 'done' || ep?.status === 'published' || ep?.status === 'archived';

/**
 * The slots ahead: { mode: 'dated' | 'order', items: [{ slot, episode, row, date, source }] }.
 * 'dated': the slots with a release date from today on (or overdue), soonest
 * first; 'order': no slot has a date, so the next slots by number.
 */
export function weekAhead({ roadmap, view = null, episodes = [], today = todayIso(), limit = WEEK_LIMIT }) {
  const byId = new Map((episodes || []).map((e) => [e.id, e]));
  // An empty slot's date is its own season's (numbers restart each season).
  const slotDates = (roadmap?.season_number != null && seasonOf(view, roadmap.season_number)?.slots) || view?.slots;
  const items = allSlots(roadmap).map((slot) => {
    const episode = slot.episode ? { ...slot.episode, ...(byId.get(slot.episode.id) || {}) } : null;
    if (done(slot, episode)) return null;
    const row = !view ? null : episode
      ? (view.episodes || []).find((r) => r.episode_id === episode.id) || null
      : slotDates?.[slot.slot_number] || null;
    let date = row?.date ? String(row.date).slice(0, 10) : null;
    let source = date ? row.source : null;
    // An episode's own air_date counts even when the schedule has not loaded or has no row for it.
    if (!date && episode?.air_date) { date = String(episode.air_date).slice(0, 10); source = 'hand'; }
    return { slot, episode, row, date, source };
  }).filter(Boolean);
  const dated = items
    .filter((it) => it.date && (it.date >= today || it.row?.due === 'overdue'))
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot.slot_number - b.slot.slot_number);
  if (dated.length) return { mode: 'dated', items: dated.slice(0, limit) };
  return { mode: 'order', items: items.slice(0, limit) };
}

/** "Sun, Nov 1 · 10:00 AM", "Would be Sun, Nov 1", "Sun, Nov 8 (set by hand)" or "No date yet". */
export function weekWhen(item) {
  if (!item?.date) return 'No date yet';
  const at = item.row?.date ? formatRelease(item.row) : formatDay(item.date);
  if (item.source === 'preview') return `Would be ${at}`;
  if (item.source === 'hand') return `${at} (set by hand)`;
  return at;
}

const STAGE = {
  draft: 'Draft', scripted: 'Scripted', in_build: 'In the edit', in_review: 'In review', published: 'Released', archived: 'Archived',
};
/** The episode's production stage in words, or null without an episode. */
export const stageText = (episode) => (episode ? STAGE[episode.status] || 'Draft' : null);

/** The labels of the readiness items (lib/releaseBoard readiness) not ready yet. */
export const stillNeeds = (ready = []) => ready.filter((r) => r.state !== 'ready').map((r) => r.label);

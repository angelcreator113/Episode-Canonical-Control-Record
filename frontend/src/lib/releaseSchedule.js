/**
 * The show's release schedule on the page (Evoni, 2026-10-25: "the show
 * releases weekly, Sundays at 10:00 AM"; "I still want to be able to change
 * and edit when I actually start releasing"). The server computes every
 * date (services/releaseSchedule, GET /world/:showId/release-schedule); this
 * file words them and loads them.
 *
 * A row is { episode_id, episode_number, season_number, number, date, time, source, due, days_until }
 * (number: the episode's number in its season, which restarts each season):
 *   source 'hand'      the episode's own air_date, set by hand; it never moves
 *          'schedule'  from the schedule; moves when the schedule changes
 *          'preview'   not releasing yet: what the schedule would give
 *   due    'soon' (within 3 days) | 'overdue' | 'released' | 'later' | null
 * A special's row (services/seasonSpecials) has `special` { label, kind } and
 * no number, source 'special' (its own date and time, set by hand); a
 * two-parter's part has `two_part` { part, of }. view.specials lists every
 * bonus and special, dated or not, with its `suggested` date.
 * Dates and times are Evoni's own wall-clock time, shown as stored.
 */
import { useCallback, useEffect, useState } from 'react';

export const DAY_OPTIONS = [
  { key: 'sun', label: 'Sunday' }, { key: 'mon', label: 'Monday' }, { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' }, { key: 'thu', label: 'Thursday' }, { key: 'fri', label: 'Friday' }, { key: 'sat', label: 'Saturday' },
];
const DAY_NAME = Object.fromEntries(DAY_OPTIONS.map((d) => [d.key, d.label]));
// The platforms a schedule can time; it times YouTube alone unless set (Evoni,
// 2026-10-25: "we only want the YouTube the main show on that schedule at the
// moment"). The episode's release date is the scheduled platforms' release;
// every other platform keeps its own time.
export const PLATFORM_OPTIONS = [
  { key: 'youtube', label: 'YouTube' }, { key: 'tiktok', label: 'TikTok' },
  { key: 'instagram', label: 'Instagram' }, { key: 'facebook', label: 'Facebook' },
];
const PLATFORM_NAME = Object.fromEntries(PLATFORM_OPTIONS.map((p) => [p.key, p.label]));
export const DEFAULT_SCHEDULE = { day: 'sun', time: '10:00', cadence: 'weekly', first_release: null, paused: false, platforms: ['youtube'] };
const platformsOf = (schedule) => (schedule?.platforms?.length ? schedule.platforms : DEFAULT_SCHEDULE.platforms);
/** "YouTube", "YouTube and TikTok". */
export const platformNames = (schedule) => {
  const names = platformsOf(schedule).map((k) => PLATFORM_NAME[k] || k);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
};
/** Whether the schedule times this platform (only those get its day and time as their suggestion). */
export const onSchedule = (schedule, platform) => Boolean(schedule) && platformsOf(schedule).includes(platform);

const parts = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
};

/** "Sun, Nov 1" (a calendar day, never shifted by a time zone); null when absent. */
export function formatDay(iso) {
  const d = parts(iso);
  return d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : null;
}

/** "10:00 AM" from "10:00". */
export function formatTime(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return null;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Sun, Nov 1 · 10:00 AM", or the day alone when there is no time. */
export function formatRelease(row) {
  const day = formatDay(row?.date);
  if (!day) return null;
  const time = formatTime(row?.time);
  return time ? `${day} · ${time}` : day;
}

/** "Releases on YouTube every Sunday at 10:00 AM". */
export function scheduleSentence(schedule) {
  if (!schedule) return null;
  return `Releases on ${platformNames(schedule)} every ${DAY_NAME[schedule.day] || schedule.day} at ${formatTime(schedule.time) || schedule.time}`;
}

/** The schedule's state in words: started, not yet, or paused. */
export function startLine(view) {
  if (!view?.schedule) return null;
  if (view.state === 'paused') return 'Paused: no schedule dates until you resume it';
  if (view.state === 'preview') return 'Not releasing yet: the dates below are previews';
  return `Starts releasing ${formatDay(view.schedule.first_release)}`;
}

/** An episode's date with where it came from. */
export function whenText(row) {
  const when = formatRelease(row);
  if (!when) return null;
  if (row.source === 'preview') return `Would be ${when}`;
  if (row.source === 'schedule') return `${when} (from the weekly schedule)`;
  if (row.source === 'special') return `${when} (its own day, set by hand)`;
  return `${when} (set by hand)`;
}

const inDays = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

/**
 * The deadline warning for an episode's row and its readiness list
 * (lib/releaseBoard readiness): { tone: 'soon'|'overdue', text } or null.
 * Only an active schedule's dates and hand-set dates under one warn.
 */
export function deadlineWarning(row, ready = []) {
  if (!row || (row.due !== 'soon' && row.due !== 'overdue')) return null;
  // ready null: the checklist is not loaded here, so the line leaves it out.
  const missing = ready ? ready.filter((r) => r.state !== 'ready' && r.key !== 'schedule').map((r) => r.label.toLowerCase()) : null;
  const needs = !missing ? null : missing.length ? `still needs: ${missing.join(', ')}` : 'has everything it needs';
  const who = releaseLabel(row);
  if (row.due === 'overdue') {
    return { tone: 'overdue', text: `${who} was due ${formatRelease(row)} and is not released yet.${needs ? ` It ${needs}.` : ''}` };
  }
  return { tone: 'soon', text: `${who} releases ${inDays(row.days_until)}${needs ? ` and ${needs}` : ''}.` };
}

/** The episode's number in its season (the server's `number`), else its stored number. */
export const episodeNumberOf = (row) => row?.number ?? row?.episode_number ?? null;

/**
 * How a release row is named: a special's label ("Special · after E7",
 * "Holiday special"; services/seasonSpecials), a two-parter's part
 * ("E12 · Part 1/2"), else "Episode 7".
 */
export function releaseLabel(row) {
  if (row?.special?.label) return row.special.label;
  if (row?.two_part && row.number != null) return `E${row.number} · Part ${row.two_part.part}/${row.two_part.of || 2}`;
  return `Episode ${episodeNumberOf(row) ?? '?'}`;
}

/** The rows of one season (every row when the view has no seasons, or no season is named). */
export function seasonRows(view, seasonNumber = null) {
  const rows = view?.episodes || [];
  if (seasonNumber == null || !(view?.seasons || []).length) return rows;
  return rows.filter((r) => Number(r.season_number) === Number(seasonNumber));
}

/** One season's entry in the view ({ season_number, state, first_release, own_start, slots }), or null. */
export const seasonOf = (view, seasonNumber) => (view?.seasons || []).find((x) => Number(x.season_number) === Number(seasonNumber)) || null;

/** The first episode with a deadline warning (soon or overdue), in number order, or null; seasonNumber keeps it to that season. */
export const firstDue = (view, seasonNumber = null) => seasonRows(view, seasonNumber).find((r) => r.due === 'soon' || r.due === 'overdue') || null;

/** Every episode with a deadline warning (soon or overdue) in the season, in number order. */
export const dueRows = (view, seasonNumber = null) => seasonRows(view, seasonNumber).filter((r) => r.due === 'soon' || r.due === 'overdue');

/** Today as YYYY-MM-DD in the viewer's own calendar. */
export function todayIso(now = new Date()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The season's next release for the stat card: { state: 'next', row, text,
 * code } with the earliest not-yet-released dated row (overdue ones first:
 * they are still to go out), or { state: 'none', text } when the season is
 * not releasing yet (no schedule start, paused, nothing dated) or every
 * episode of it is out, or null
 * while the schedule has not loaded.
 */
export function nextReleaseOf(view, seasonNumber = null, today = todayIso()) {
  if (!view) return null;
  const mine = seasonRows(view, seasonNumber);
  const live = mine.filter((r) => r.date && r.source !== 'preview' && r.status !== 'published' && r.due !== 'released');
  // An overdue one is still the next out the door; a past hand-set date with no warning (no schedule) is not.
  const ahead = live.filter((r) => r.due === 'overdue' || String(r.date) >= today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const row = ahead[0] || null;
  if (!row) {
    // A finished season: every episode is out.
    const done = mine.length > 0 && mine.every((r) => r.status === 'published' || r.due === 'released');
    return { state: 'none', text: view.state === 'paused' ? 'Paused' : done ? 'Every episode is out' : 'Not releasing yet' };
  }
  const n = row.special ? null : episodeNumberOf(row);
  return { state: 'next', row, text: formatDay(row.date), code: row.special?.label || (n != null ? `E${n}` : null), overdue: row.due === 'overdue' };
}

/**
 * A roadmap slot's release row: its episode's row, else the slot number's
 * date in its season ({ date, time, source }); null when there is none.
 * slotWhen words it; the Season calendar (lib/seasonCalendar, 2026-10-26)
 * places it on its day.
 */
export function slotRow(view, slot, seasonNumber = null) {
  if (!view || !slot) return null;
  const slots = (seasonNumber != null && seasonOf(view, seasonNumber)?.slots) || view.slots;
  return (slot.episode ? (view.episodes || []).find((r) => r.episode_id === slot.episode.id) : slots?.[slot.slot_number]) || null;
}

/** A roadmap slot's release day (slotRow): "Sun, Nov 1" or "Would be Sun, Nov 1". */
export function slotWhen(view, slot, seasonNumber = null) {
  const row = slotRow(view, slot, seasonNumber);
  const day = formatDay(row?.date);
  if (!day) return null;
  return { text: row.source === 'preview' ? `Would be ${day}` : day, source: row.source };
}

/** "2026-11-01T10:00" for a datetime-local field: a platform's suggested release time. */
export function datetimeLocal(row) {
  if (!row?.date || !row?.time) return null;
  return `${String(row.date).slice(0, 10)}T${row.time}`;
}

/** Her time zone at save, as the server reads it (like the posting schedule's tz_offset). */
export function browserZone() {
  let tz = null;
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (err) { console.error('[releaseSchedule] no time zone name:', err); }
  return { tz_offset: new Date().getTimezoneOffset(), tz };
}

/** A move from the preview in words: "E3 moves from Sun, Nov 15 to Sat, Nov 14". */
export function moveText(m) {
  const who = `E${episodeNumberOf(m) ?? '?'}`;
  if (m.from && m.to) return `${who} moves from ${formatRelease(m.from)} to ${formatRelease(m.to)}`;
  if (m.to) return `${who} gets ${formatRelease(m.to)}`;
  return `${who} loses its schedule date (${formatRelease(m.from)})`;
}

export const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong.';

/**
 * The show's schedule and every episode's date: { view, rowsById, error,
 * reload, save, preview, setEpisodeDate }. api is the page's client.
 */
export function useReleaseSchedule({ api, showId, reloadKey = null }) {
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    if (!api || !showId) return;
    try {
      const res = await api.get(`/api/v1/world/${showId}/release-schedule`);
      setView(res.data?.data || null);
      setError(null);
    } catch (err) {
      console.error('[releaseSchedule] load failed:', err);
      setError(errorText(err));
    }
  }, [api, showId]);
  useEffect(() => { reload(); }, [reload, reloadKey]);

  const save = useCallback(async (schedule) => {
    const res = await api.put(`/api/v1/world/${showId}/release-schedule`, { release_schedule: { ...schedule, ...browserZone() } });
    setView(res.data?.data || null);
    return res.data?.data;
  }, [api, showId]);
  const preview = useCallback(async (schedule) => {
    const res = await api.post(`/api/v1/world/${showId}/release-schedule/preview`, { release_schedule: { ...schedule, ...browserZone() } });
    return res.data?.data || null;
  }, [api, showId]);
  const setEpisodeDate = useCallback(async (episodeId, day) => {
    const res = await api.put(`/api/v1/world/${showId}/episodes/${episodeId}/release-date`, { air_date: day || null });
    setView(res.data?.data || null);
    return res.data?.data;
  }, [api, showId]);

  const rowsById = Object.fromEntries((view?.episodes || []).map((r) => [r.episode_id, r]));
  return { view, rowsById, error, reload, save, preview, setEpisodeDate };
}

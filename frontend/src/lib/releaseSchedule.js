/**
 * The show's release schedule on the page (Evoni, 2026-10-25: "the show
 * releases weekly, Sundays at 10:00 AM"; "I still want to be able to change
 * and edit when I actually start releasing"). The server computes every
 * date (services/releaseSchedule, GET /world/:showId/release-schedule); this
 * file words them and loads them.
 *
 * A row is { episode_id, episode_number, date, time, source, due, days_until }:
 *   source 'hand'      the episode's own air_date, set by hand; it never moves
 *          'schedule'  from the schedule; moves when the schedule changes
 *          'preview'   not releasing yet: what the schedule would give
 *   due    'soon' (within 3 days) | 'overdue' | 'released' | 'later' | null
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
  const who = `Episode ${row.episode_number ?? '?'}`;
  if (row.due === 'overdue') {
    return { tone: 'overdue', text: `${who} was due ${formatRelease(row)} and is not released yet.${needs ? ` It ${needs}.` : ''}` };
  }
  return { tone: 'soon', text: `${who} releases ${inDays(row.days_until)}${needs ? ` and ${needs}` : ''}.` };
}

/** The first episode with a deadline warning (soon or overdue), in number order, or null. */
export const firstDue = (view) => (view?.episodes || []).find((r) => r.due === 'soon' || r.due === 'overdue') || null;

/** A roadmap slot's release day: its episode's row, else the slot number's date; "Sun, Nov 1" or "Would be Sun, Nov 1". */
export function slotWhen(view, slot) {
  if (!view || !slot) return null;
  const row = slot.episode ? (view.episodes || []).find((r) => r.episode_id === slot.episode.id) : view.slots?.[slot.slot_number];
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
  const who = `E${m.episode_number ?? '?'}`;
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

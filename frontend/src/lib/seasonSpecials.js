/**
 * Special episodes on the Season page (Evoni, 2026-10-26: "Seems like
 * sometimes we will have special episodes to keep up with our events what's
 * do you think?" — "All three and on YouTube, show me first"). The server
 * (services/seasonSpecials) keeps them; the roadmap carries them:
 *
 *   roadmap.specials      bonus episodes ("Special · after E7", their own date
 *                         and time) and stand-alone specials ("Holiday
 *                         special", with a title), each { id, kind, label,
 *                         title, after_slot_number, phase, state, event,
 *                         episode, release: { date, time } }
 *   roadmap.two_parters   one event over two weekly slots, Part 2 the next
 *                         Sunday: { id, event, part_one, part_two,
 *                         can_start_part_two, can_undo }; each slot also has
 *                         slot.two_part { part, of, other_slot_number, label }
 *   roadmap.specials_ready  false until the specials' migration has run
 *
 * The weekly Sunday episodes stay the backbone: nothing here renumbers or
 * re-dates them. The suggestion is plain logic (no AI): an event with high
 * stakes whose in-world date has no weekly release near it may deserve a
 * bonus episode; Evoni decides (Make it / Not now).
 */
import { useCallback, useState } from 'react';
import { allSlots } from './seasonPage';
import { formatDay, formatTime, errorText } from './releaseSchedule';

export const SPECIAL_KINDS = [
  { key: 'bonus', label: 'Bonus episode', hint: 'An event between two Sundays: its own episode and its own release day.' },
  { key: 'special', label: 'Stand-alone special', hint: 'A holiday, recap or reunion: outside the story parts and the goals.' },
];
export const SPECIAL_TYPES = [
  { key: 'holiday', label: 'Holiday special' },
  { key: 'recap', label: 'Recap special' },
  { key: 'reunion', label: 'Reunion special' },
  { key: 'other', label: 'Special' },
];
export const MIGRATION_CODE = 'SEASON_SPECIALS_MIGRATION_PENDING';
export const NEEDS_MIGRATION_TEXT = 'Special episodes need their migration first. Once it has run through the Deploy workflow, they can be added here.';

/**
 * An episode's special tag from its season snapshot (Results, the wrap-up):
 * "Special · after E7", "Holiday special", "Part 1/2"; null for a weekly one.
 */
export function specialTagOf(ep) {
  let sc = ep?.season_context;
  if (typeof sc === 'string') {
    try { sc = JSON.parse(sc); } catch (err) { console.error('[seasonSpecials] season_context could not be read:', err); sc = null; }
  }
  if (sc?.special?.label) return sc.special.label;
  if (sc?.two_part?.part) return `Part ${sc.two_part.part}/${sc.two_part.of || 2}`;
  return null;
}

/** A slot's code: "E12", or "E12 · Part 1/2" in a two-parter. */
export const slotCode = (slot) => (slot?.two_part?.label || (slot ? `E${slot.slot_number}` : ''));

/** The season's bonus episodes and specials (none before the migration). */
export const specialsOf = (roadmap) => roadmap?.specials || [];
/** Those that follow weekly episode n (0: before E1). */
export const specialsAfter = (roadmap, n) => specialsOf(roadmap).filter((s) => Number(s.after_slot_number) === Number(n));
/** The bonus episodes alone (they count in the parts and the goals; a stand-alone special does not). */
export const bonusesOf = (roadmap) => specialsOf(roadmap).filter((s) => s.kind === 'bonus');
export const twoPartersOf = (roadmap) => roadmap?.two_parters || [];

/** The special's release row in the release schedule (its own date and time), or null. */
export const specialRow = (release, special) => (release?.specials || []).find((r) => r.special_id === special?.id) || null;

/** "Wed, Dec 16 · 6:00 PM", or "No date yet". */
export function specialWhen(release, special) {
  const row = specialRow(release, special);
  const date = row?.date || special?.release?.date || null;
  const time = row?.time || special?.release?.time || null;
  if (!date) return { text: 'No date yet', set: false };
  return { text: `${formatDay(date)}${time ? ` · ${formatTime(time)}` : ''}`, set: true };
}

/** "Wed, Dec 16 · 10:00 AM" for its suggested date, or null. */
export function suggestionText(row) {
  const s = row?.suggested;
  if (!s?.date) return null;
  return `${formatDay(s.date)}${s.time ? ` · ${formatTime(s.time)}` : ''}`;
}

/** The "after which episode" choices: before E1, then after each weekly episode. */
export function afterOptions(roadmap) {
  const slots = allSlots(roadmap);
  return [{ value: 0, label: 'Before E1' }, ...slots.map((s) => ({ value: s.slot_number, label: `After ${slotCode(s)}` }))];
}

/** Where a new special goes by default: after the last episode that has started, else after E1. */
export function defaultAfter(roadmap) {
  const started = allSlots(roadmap).filter((s) => s.episode);
  return started.length ? started[started.length - 1].slot_number : 1;
}

/**
 * Whether "Make it a two-parter" is offered on a slot: it has an event, it
 * is not done or already in a two-parter, and the next weekly slot is open
 * (no episode; nothing pencilled, or the same event).
 */
export function canMakeTwoParter(roadmap, slot) {
  if (!roadmap?.specials_ready || !slot?.event || slot.two_part || slot.state === 'done') return false;
  const next = allSlots(roadmap).find((s) => s.slot_number === slot.slot_number + 1);
  if (!next || next.two_part || next.episode || next.locked) return false;
  return !next.event || next.event.id === slot.event.id;
}

// ── The bonus suggestion (plain logic) ─────────────────────────────────────
const NEAR_DAYS = 2;
const HIGH_PRESTIGE = 8;
const dayOf = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};
const ms = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / 86400000);

/** The Wednesday nearest a day (YYYY-MM-DD): a bonus episode's default release day. */
export function nearestWednesday(iso) {
  const d = new Date(ms(iso));
  const shift = ((3 - d.getUTCDay() + 10) % 7) - 3;
  d.setUTCDate(d.getUTCDate() + shift);
  return d.toISOString().slice(0, 10);
}

/**
 * Events that may deserve a bonus episode: high stakes (prestige 8 or more,
 * or its slot asks for High or Peak pressure) and an in-world date with no
 * weekly release within two days of it, inside the season's release run.
 * Each { event, slot (its weekly slot, or null), after (the weekly episode
 * whose release is just before the date), reason }. Events already in a
 * special or a two-parter, started or done, are left out; so are those
 * dismissed (Not now). Nothing without release dates or a migration.
 */
export function bonusSuggestions({ roadmap = null, events = [], release = null, dismissed = [] } = {}) {
  if (!roadmap?.specials_ready) return [];
  const slots = allSlots(roadmap);
  const seasonNumber = roadmap.season_number ?? null;
  const season = (release?.seasons || []).find((x) => Number(x.season_number) === Number(seasonNumber));
  const dates = season?.slots || release?.slots || {};
  const releases = Object.entries(dates).map(([n, r]) => ({ n: Number(n), date: dayOf(r?.date) })).filter((r) => r.date).sort((a, b) => a.n - b.n);
  if (releases.length < 2) return [];
  const first = releases[0].date;
  const last = releases[releases.length - 1].date;
  const taken = new Set([
    ...specialsOf(roadmap).map((s) => s.event?.id),
    ...twoPartersOf(roadmap).map((t) => t.event?.id),
  ].filter(Boolean));
  const skip = new Set(dismissed || []);
  const slotOf = new Map(slots.filter((s) => s.event).map((s) => [s.event.id, s]));
  const pencillable = new Set((roadmap.available_events || []).map((e) => e.id));
  const out = [];
  for (const ev of events || []) {
    if (!ev?.id || taken.has(ev.id) || skip.has(ev.id)) continue;
    const slot = slotOf.get(ev.id) || null;
    if (slot ? (slot.episode || slot.locked || slot.two_part) : !pencillable.has(ev.id)) continue;
    const date = dayOf(ev.event_date);
    if (!date || date < first || date > last) continue;
    const pressure = slot?.intention?.desired_pressure;
    const high = Number(ev.prestige) >= HIGH_PRESTIGE || pressure === 'High' || pressure === 'Peak';
    if (!high) continue;
    const nearest = Math.min(...releases.map((r) => Math.abs(daysBetween(r.date, date))));
    if (nearest <= NEAR_DAYS) continue;
    const before = [...releases].reverse().find((r) => r.date < date) || releases[0];
    const stakes = Number(ev.prestige) >= HIGH_PRESTIGE ? `prestige ${ev.prestige}` : `${pressure} pressure`;
    out.push({
      event: ev,
      slot,
      after: before.n,
      date: nearestWednesday(date),
      reason: `"${ev.name}" is on ${formatDay(date)}: no weekly release is near it (the nearest is ${nearest} days away), and its stakes are high (${stakes}).`,
    });
  }
  return out.sort((a, b) => String(a.event.event_date).localeCompare(String(b.event.event_date)));
}

// "Not now", remembered per browser (storage can be blocked: then only for this visit).
export const DISMISS_STORAGE_KEY = 'szn-bonus-not-now';
export function readDismissed() {
  try { return JSON.parse(window.localStorage.getItem(DISMISS_STORAGE_KEY) || '[]') || []; } catch (err) {
    console.warn('[seasonSpecials] Not now list not read:', err?.message);
    return [];
  }
}
export function saveDismissed(ids) {
  try { window.localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(ids.slice(-200))); } catch (err) {
    console.warn('[seasonSpecials] Not now list not saved:', err?.message);
  }
}

/**
 * The specials' actions: { busy, error, add, update, remove, makeTwoParter,
 * undoTwoParter, startPartTwo, clearError }. Each reloads the roadmap
 * (onChanged) and says what it did (setToast). A refusal is shown as error.
 */
export function useSeasonSpecials({ api, showId, onChanged = null, setToast = null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const base = `/api/v1/world/${showId}/season`;
  const act = useCallback(async (fn, done) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (onChanged) await onChanged();
      if (setToast && done) setToast(typeof done === 'function' ? done(res?.data?.data) : done);
      return res?.data?.data || true;
    } catch (err) {
      console.error('[seasonSpecials] action failed:', err);
      setError(err?.response?.data?.code === MIGRATION_CODE ? NEEDS_MIGRATION_TEXT : errorText(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, [onChanged, setToast]);
  return {
    busy,
    error,
    clearError: () => setError(null),
    add: (body) => act(() => api.post(`${base}/specials`, body), (d) => `${d?.label || 'Special'} added${d?.moved_from ? ` (the event left E${d.moved_from})` : ''}.`),
    update: (id, body) => act(() => api.patch(`${base}/specials/${id}`, body), 'Saved.'),
    remove: (id) => act(() => api.delete(`${base}/specials/${id}`), 'Special removed; its event is back in the library.'),
    makeTwoParter: (slotId) => act(() => api.post(`${base}/two-parters`, { slot_id: slotId }), (d) => `Two-parter: ${d?.part_one || 'Part 1'} and ${d?.part_two || 'Part 2'}.`),
    undoTwoParter: (id) => act(() => api.delete(`${base}/two-parters/${id}`), 'Two-parter undone; Part 2\'s slot is open again.'),
    startPartTwo: (id) => act(() => api.post(`${base}/two-parters/${id}/part-two`), (d) => `${d?.label || 'Part 2'} started: "${d?.episode?.title || ''}".`),
  };
}

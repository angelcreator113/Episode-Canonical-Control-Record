/**
 * A full season's new events become specials (Evoni, 2026-10-26: "So I want
 * to be sure that if I start creating any events that is over the 24
 * episodes, they will be known as the special episodes automatically?" …
 * "Yes placed events should be seen as full, they should have both options,
 * no limit"). The server decides (services/seasonFullSpecials): full is
 * every weekly slot with an event placed or an episode started; where a
 * special goes is story order (after the weekly episode whose event's date
 * is just before it), dated midweek by the specials' own suggestion. This
 * file only reads its answer and sends Evoni's choice:
 *
 *   GET  /season/full/events/:eventId              the choice (fullChoice)
 *   POST …/special | …/swap { slot_id } | …/next-season
 *   POST /season/specials/:id/story-position       Move to its story position
 *   PATCH / DELETE /season/specials/:id            Move it (after E_n) / Remove the special
 */
import { useCallback, useEffect, useState } from 'react';
import { formatDay, formatTime, errorText } from './releaseSchedule';
import { MIGRATION_CODE, NEEDS_MIGRATION_TEXT } from './seasonSpecials';

/** An in-world date the specials can place by ('YYYY-MM-DD…'; event_date is free text). */
export const hasStoryDate = (v) => /^\d{4}-\d{2}-\d{2}/.test(String(v || '').trim());

/** Make it a special from a list (the Events tab): the server places it in story order. */
export async function makeSpecialFor(api, showId, eventId) {
  const res = await api.post(`/api/v1/world/${showId}/season/full/events/${eventId}/special`);
  return res?.data?.data || null;
}

/** The roadmap says the season is full: a new event will be a special. */
export const seasonIsFull = (roadmap) => Boolean(roadmap?.season_full);

/** "Wed, Nov 25 · 10:00 AM", or null with no date to suggest. */
export function releaseText(release) {
  if (!release?.date) return null;
  return `${formatDay(release.date)}${release.time ? ` · ${formatTime(release.time)}` : ''}`;
}

/** Where it goes, in words: "between E4 and E5", "after E24", "before E1". */
export function gapText(after, slotCount = 24) {
  const n = Number(after) || 0;
  if (n <= 0) return 'before E1';
  if (n >= slotCount) return `after E${n}, the last weekly episode`;
  return `between E${n} and E${n + 1}`;
}

/** Why it goes there: its date, or no date yet; and a released week passed. */
export function placeReason(place, part = null) {
  if (!place) return '';
  const head = place.by === 'no_date'
    ? `No date yet: place it when you know. For now it follows E${place.after}, the last episode of ${part?.title ? `Part ${part.number}: ${part.title}` : 'the part in progress'}.`
    : `In story order: its date comes just after E${place.after}'s event.`;
  const skipped = place.skipped_released > 0 ? ` The weeks before it are already released, so it takes the first gap still to come.` : '';
  return `${head}${skipped}`;
}

/** The swap's choices, the suggested one first: "E5 · Week 5 event (Sun, Mar 29)". */
export function swapChoices(choice) {
  const options = choice?.swap?.options || [];
  const label = (o) => `E${o.slot_number}${o.event?.name ? ` · ${o.event.name}` : ''}${o.can_swap ? '' : ' (can’t swap)'}`;
  return options.map((o) => ({ ...o, label: label(o), suggested: o.slot_id === choice?.swap?.suggested_slot_id }));
}

/** What a swap into this slot does to the event that is there now. */
export function swapOutcome(option) {
  if (!option) return '';
  if (!option.can_swap) return option.reason || 'This episode can’t take a swap.';
  if (!option.event) return `E${option.slot_number} has no event: it simply takes this one.`;
  return `“${option.event.name}” becomes ${option.becomes?.label || 'a special'}${option.becomes?.release?.date ? `, ${releaseText(option.becomes.release)}` : ''}.`;
}

/** The choice and its actions for one event. */
export function useFullSeasonChoice({ api, showId, eventId, enabled = true, reloadKey = null, onChanged = null, setToast = null }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const base = `/api/v1/world/${showId}/season`;

  const load = useCallback(async () => {
    if (!enabled || !api || !showId || !eventId) return;
    try {
      const res = await api.get(`${base}/full/events/${eventId}`);
      setData(res?.data?.data || null);
      setLoadError(null);
    } catch (err) {
      console.error('[seasonFull] the choice could not be read:', err);
      setLoadError(errorText(err));
    }
  }, [api, base, showId, eventId, enabled]);
  useEffect(() => { load(); }, [load, reloadKey]);

  const act = useCallback(async (fn, done, undo = null) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      const out = res?.data?.data || true;
      if (onChanged) await onChanged();
      await load();
      if (setToast && done) setToast(typeof done === 'function' ? done(out) : done, undo ? { undo: () => undo(out) } : undefined);
      return out;
    } catch (err) {
      // Saying no to a confirmation is not a failure: nothing was sent.
      if (err?.cancelled) return null;
      console.error('[seasonFull] action failed:', err);
      setError(err?.response?.data?.code === MIGRATION_CODE ? NEEDS_MIGRATION_TEXT : errorText(err));
      // The pencil is not as it was shown: read the choice as it is now.
      if (err?.response?.data?.code === 'SEASON_SLOT_CHANGED') await load();
      return null;
    } finally {
      setBusy(false);
    }
  }, [load, onChanged, setToast]);

  // A swap replaces the pencilled event in the slot (Evoni, 2026-11-10; the
  // same rule as Place). The server lists the pencil it would replace
  // (409 SEASON_PLACE_NEEDS_CONFIRMATION); it is shown, and only a yes sends
  // it back by name. A pencil that changed since (409 SEASON_SLOT_CHANGED) is
  // said in the panel, the choice is read again, and nothing is sent again.
  const swapRequest = async (ofEventId, slotId, pencils = null) => {
    const url = `${base}/full/events/${ofEventId}/swap`;
    if (pencils) return api.post(url, { slot_id: slotId, confirm_pencils: pencils });
    try {
      return await api.post(url, { slot_id: slotId });
    } catch (err) {
      const asked = err?.response?.data;
      const affected = asked?.code === 'SEASON_PLACE_NEEDS_CONFIRMATION' && Array.isArray(asked.affected_pencils) ? asked.affected_pencils : [];
      if (!affected.length) throw err;
      const lines = affected.map((p) => `E${p.slot_number}: “${p.event?.name || 'its event'}” is replaced by “${asked.incoming_event?.name || 'this event'}”, and becomes a special.`);
      if (!window.confirm(`Swapping into E${asked.slot_number} changes a pencilled event:\n\n${lines.join('\n')}\n\nMake this change?`)) {
        throw Object.assign(new Error('cancelled'), { cancelled: true });
      }
      return api.post(url, { slot_id: slotId, confirm_pencils: affected.map((p) => ({ slot_id: p.slot_id, event_id: p.event?.id })) });
    }
  };
  const swap = (slotId) => act(
    () => swapRequest(eventId, slotId),
    (d) => `Swapped into E${d?.slot_number}.${d?.replaced ? ` “${d.replaced.name}” is now ${d.replaced.special?.label || 'a special'}.` : ''}`,
    // Swap back: the replaced event into the same slot (this event becomes a
    // special again). It names the pencil this swap just put there; if that
    // has changed since, the server refuses and nothing is overwritten.
    (d) => (d?.replaced ? act(() => swapRequest(d.replaced.id, d.slot_id, [{ slot_id: d.slot_id, event_id: d.event?.id }]), 'Swapped back.') : null),
  );
  return {
    data,
    loadError,
    busy,
    error,
    reload: load,
    clearError: () => setError(null),
    makeSpecial: () => act(() => api.post(`${base}/full/events/${eventId}/special`), (d) => `Made it ${d?.label || 'a special'}.`),
    swap,
    toStory: (specialId) => act(() => api.post(`${base}/specials/${specialId}/story-position`), (d) => `Moved to its story position: ${d?.label || 'a special'}.`),
    moveAfter: (specialId, after) => act(() => api.patch(`${base}/specials/${specialId}`, { after_slot_number: Number(after) }), `Moved: ${Number(after) > 0 ? `Special · after E${after}` : 'Special · before E1'}.`),
    nextSeason: () => act(() => api.post(`${base}/full/events/${eventId}/next-season`), (d) => `Moved to ${d?.label || 'the next season'}.`),
    remove: (specialId) => act(() => api.delete(`${base}/specials/${specialId}`), 'The special is removed; the event is unplaced again.'),
  };
}

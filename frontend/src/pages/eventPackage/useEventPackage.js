/**
 * The Event Package's data: what the page loads, how it saves the event, and
 * its toast (moved out of EventPackagePage.jsx, Task #54).
 *
 * One request (Task #54): the page loads through the combined GET
 * /world/:showId/events/:eventId/package, which answers the event payload,
 * the money preview, the season context, the deal's deliverables and costs
 * and the in-world documents, each failing on its own (a failed part is null
 * with its message under errors.<part>). The parts the sections used to read
 * themselves are handed to them as `seeds`: { data } or { error }, so a part
 * that failed shows that section's own "Failed to load …" while the rest
 * render. A reload after a save reads the package again; the sections still
 * read their own endpoint after their own edits.
 *
 * If the combined GET fails as a whole, or answers without its parts, the
 * page reads the parts one by one as it did before (the event, the season
 * context, the money preview; each section its own), and keeps doing so for
 * the rest of the visit.
 *
 * loading: the first load only (the page shows its spinner). A reload after
 * a save keeps the page on screen (audit, 2026-10-23: every save used to
 * swap the whole page for the spinner, losing the scroll and every open
 * fold); reloadTick remounts the sections that read their own data.
 * refreshError: a reload that failed, the page still showing what it had.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { createEventSaveQueue, isStaleSaveError } from '../../utils/eventSaveVersion';
import { UNDO_MS, TOAST_MS } from '../../lib/eventPackageFields';

// The sections' parts the combined GET answers for them.
const SEEDED_PARTS = ['deliverables', 'costs', 'documents'];

/** The combined GET's parts as the sections' seeds: { data } or { error }. */
export function packageSeeds(body) {
  const errors = body?.errors || {};
  return Object.fromEntries(SEEDED_PARTS.map((part) => [part, errors[part] ? { error: errors[part] } : { data: body?.[part] ?? null }]));
}

export default function useEventPackage({ showId, eventId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [refreshError, setRefreshError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const loadSeqRef = useRef(0);
  // How the page loads: null until the first answer, then 'package' (the
  // combined GET) or 'separate' (the parts one by one).
  const [mode, setMode] = useState(null);
  const modeRef = useRef(null);
  // The sections' parts from the combined GET (undefined: they read their own).
  const [seeds, setSeeds] = useState(undefined);
  const [seasonContext, setSeasonContext] = useState(null);
  // Episode Money Phase B, MB4 (§8(gg)): the money warnings Start Episode
  // shows early, from Lala's ledger balance and the event's whole plan.
  const [moneyPreview, setMoneyPreview] = useState(null);
  // 'loading' until the money preview answers, then 'ready' or 'failed':
  // Start Episode waits for it, so its warnings can't be skipped by a quick
  // tap, and a failed check is itself a warning (audit, 2026-10-23).
  const [moneyStatus, setMoneyStatus] = useState('loading');

  // The toast: each message is new, so the same text twice still restarts
  // its timer (audit, 2026-10-23); setToast(text) as before.
  // A toast may carry an Undo (Evoni, 2026-10-23): { undo } restores what
  // the page's own one-tap change replaced; it then stays for UNDO_MS.
  const [toastState, setToastState] = useState(null);
  const toastSeqRef = useRef(0);
  const setToast = useCallback((text, opts = {}) => {
    setToastState(text ? { text, n: ++toastSeqRef.current, undo: opts.undo || null } : null);
  }, []);

  // Versioned saves (Task #1788): every save sends the updated_at this page
  // last loaded, runs one at a time, and a save refused because the event
  // changed elsewhere reloads the page (utils/eventSaveVersion.js).
  const loadedEventRef = useRef(null);
  const saveQueueRef = useRef(null);
  if (!saveQueueRef.current) {
    saveQueueRef.current = createEventSaveQueue((url, body) => api.put(url, body), { getBase: () => loadedEventRef.current });
  }

  const eventUrl = `/api/v1/world/${showId}/events/${eventId}`;

  const load = useCallback(async () => {
    // Only the newest load may land: an older one finishing last would put
    // stale data (and a stale save version) on the page.
    const seq = ++loadSeqRef.current;
    const first = !loadedEventRef.current;
    if (first) setLoading(true);
    setLoadError(null);
    setRefreshError(null);
    const landEvent = (payload) => {
      loadedEventRef.current = payload?.event || null;
      saveQueueRef.current.setVersion(payload?.event?.updated_at);
      setData(payload);
    };
    try {
      if (modeRef.current !== 'separate') {
        let body = null;
        try {
          const res = await api.get(`${eventUrl}/package`);
          body = res?.data;
          if (!body || typeof body !== 'object' || !('eventPayload' in body)) throw new Error('The Event Package answered without its parts');
        } catch (err) {
          if (seq !== loadSeqRef.current) return;
          // Once the package has answered, a failed reload is a failed reload.
          if (modeRef.current === 'package') throw err;
          console.error('[EventPackage] combined load failed; reading the parts one by one:', err);
          modeRef.current = 'separate';
          setMode('separate');
          body = null;
        }
        if (body) {
          if (seq !== loadSeqRef.current) return;
          modeRef.current = 'package';
          setMode('package');
          const errors = body.errors || {};
          for (const [part, message] of Object.entries(errors)) console.error(`[EventPackage] ${part} load failed:`, message);
          const payload = body.eventPayload;
          if (!payload?.event) throw new Error(errors.eventPayload ? 'Failed to load event' : 'Event not found');
          landEvent(payload);
          // The event's place in the season (§8(ff) A4); never blocks the page.
          setSeasonContext(body.seasonContext || null);
          // MB4: none once the event has started an episode; a failed check
          // keeps the last preview and is itself a warning.
          if (payload.event.used_in_episode_id) { setMoneyPreview(null); setMoneyStatus('ready'); }
          else if (errors.moneyPreview) setMoneyStatus('failed');
          else { setMoneyPreview(body.moneyPreview || null); setMoneyStatus('ready'); }
          setSeeds(packageSeeds(body));
          if (!first) setReloadTick((n) => n + 1);
          return;
        }
      }
      const res = await api.get(eventUrl);
      if (seq !== loadSeqRef.current) return;
      landEvent(res.data);
      if (!first) setReloadTick((n) => n + 1);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      console.error('[EventPackage] event load failed:', err);
      const message = err.response?.data?.error || err.message || 'Failed to load event';
      if (first) setLoadError(message);
      else setRefreshError(message);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [eventUrl]);

  useEffect(() => { load(); }, [load]);

  // Read one by one (the combined GET failed): the season context once.
  useEffect(() => {
    if (mode !== 'separate') return undefined;
    let cancelled = false;
    api.get(`/api/v1/world/${showId}/season/event/${eventId}`)
      .then((res) => { if (!cancelled) setSeasonContext(res.data?.context || null); })
      .catch((err) => { console.error('[EventPackage] season context load failed:', err); });
    return () => { cancelled = true; };
  }, [showId, eventId, mode]);

  // Read one by one: the money preview, reloaded with the event (its costs
  // and terms can change here). Never blocks the page.
  useEffect(() => {
    const ev = data?.event;
    if (mode !== 'separate' || !ev) return undefined;
    if (ev.used_in_episode_id) { setMoneyPreview(null); setMoneyStatus('ready'); return undefined; }
    let cancelled = false;
    setMoneyStatus((st) => (st === 'ready' ? st : 'loading'));
    api.get(`/api/v1/world/${showId}/events/${eventId}/money-preview`)
      .then((res) => { if (!cancelled) { setMoneyPreview(res.data?.data || null); setMoneyStatus('ready'); } })
      .catch((err) => {
        console.error('[EventPackage] money preview load failed:', err);
        if (!cancelled) setMoneyStatus('failed');
      });
    return () => { cancelled = true; };
  }, [showId, eventId, data, mode]);

  useEffect(() => {
    if (toastState) { const t = setTimeout(() => setToastState(null), toastState.undo ? UNDO_MS : TOAST_MS); return () => clearTimeout(t); }
    return undefined;
  }, [toastState]);

  // Every event save on this page goes through here. A refusal (409,
  // EVENT_CHANGED) reloads the page so the person sees what changed; the
  // caller's own catch shows the route's message.
  const putEvent = async (body) => {
    try {
      return await saveQueueRef.current.save(eventUrl, body);
    } catch (err) {
      // The caller's catch logs and shows the message.
      if (isStaleSaveError(err)) load();
      throw err;
    }
  };

  // Undo on the toast: one save that restores what the change replaced.
  // body may be a function, read when Undo is pressed.
  const undoChange = async (body, doneMessage) => {
    setToastState(null);
    try {
      await putEvent(typeof body === 'function' ? body() : body);
      setToast(doneMessage);
      await load();
    } catch (err) {
      console.error('[EventPackage] undo failed:', err);
      setToast(err.response?.data?.error || err.message || 'Couldn’t undo that change');
    }
  };

  return {
    data, loading, loadError, refreshError, reloadTick, seeds, seasonContext, moneyPreview, moneyStatus,
    load, putEvent, undoChange, loadedEventRef, toastState, setToast,
  };
}

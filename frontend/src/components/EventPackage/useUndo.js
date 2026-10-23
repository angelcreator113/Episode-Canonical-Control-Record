/**
 * useUndo — the Event Package's "Removed ‘Story mentions’ · Undo" (Evoni,
 * 2026-10-23: undo instead of confirm). A destructive one-click (remove a
 * deliverable, a cost, a restriction or a goal; Use this look; Redraft) is
 * done at once, and the component offers its undo for UNDO_MS.
 *
 * The offers live in a small store outside React, keyed by the caller
 * (e.g. `costs:<eventId>`), because the Event Package remounts the
 * sections that read their own data after every save (its reloadTick key):
 * a removal that refreshes the page would otherwise lose its Undo the
 * moment it shows. The remounted section reads the same offer back, with
 * the time it has left.
 *
 * A floating offer (`floating: true`) is for an action that takes its own
 * component away (Use this look: the page shows the recommendations only
 * while no outfit is chosen). It is drawn by FloatingUndoHost
 * (UndoNotice.jsx) at the foot of the screen, mounted once on its own, and
 * does not end when its caller unmounts.
 *
 *   const undo = useUndo(`costs:${eventId}`, { reload: load, onSaved });
 *   undo.offer({ message: "Removed 'Valet'", undo: async (ctx) => { … } });
 *   <UndoNotice undo={undo} />
 *
 * The undo function receives the newest context passed by a mounted
 * caller with that key (its latest props and reloaders), not the one of
 * the instance that made the offer, which may be gone. An offer ends when
 * its time runs out, when it is dismissed or replaced, when Undo succeeds,
 * or when no caller with its key is mounted any more; `onFinal({ undone })`
 * runs then, once. A failed undo keeps the offer, with the error, for
 * another UNDO_MS. The timer pauses while the pointer or focus is on the
 * notice.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';

export const UNDO_MS = 8000;

const entries = new Map(); // key -> offer
const listeners = new Map(); // key -> Set<() => void>
const contexts = new Map(); // key -> { current }
const anyListeners = new Set(); // FloatingUndoHost
let nextId = 1;

function notify(key) {
  (listeners.get(key) || new Set()).forEach((fn) => fn());
  anyListeners.forEach((fn) => fn());
}

/** The floating offers, oldest first: [{ key, entry }]. */
export function floatingUndos() {
  return [...entries].filter(([, e]) => e.floating).map(([key, entry]) => ({ key, entry }));
}

export function subscribeAllUndos(fn) {
  anyListeners.add(fn);
  return () => anyListeners.delete(fn);
}

function startTimer(key, entry, ms) {
  clearTimeout(entry.timer);
  entry.remaining = ms;
  entry.startedAt = Date.now();
  entry.timer = setTimeout(() => finish(key, entry.id, false), ms);
}

function finish(key, id, undone) {
  const entry = entries.get(key);
  if (!entry || (id != null && entry.id !== id)) return;
  clearTimeout(entry.timer);
  entries.delete(key);
  notify(key);
  try {
    entry.onFinal?.({ undone });
  } catch (err) {
    console.error('[useUndo] onFinal failed:', err);
  }
}

/** Offers an undo under `key`, replacing (and ending) any earlier offer there. */
export function offerUndo(key, { message, undo, onFinal = null, meta = null, ms = UNDO_MS, floating = false }) {
  if (entries.has(key)) finish(key, null, false);
  const entry = { id: nextId++, message, undo, onFinal, meta, ms, floating, busy: false, error: null, paused: false, timer: null };
  entries.set(key, entry);
  startTimer(key, entry, ms);
  notify(key);
  return entry.id;
}

export async function runUndo(key) {
  const entry = entries.get(key);
  if (!entry || entry.busy) return false;
  clearTimeout(entry.timer);
  entry.busy = true;
  entry.error = null;
  notify(key);
  try {
    await entry.undo(contexts.get(key)?.current || {});
  } catch (err) {
    console.error('[useUndo] undo failed:', err);
    if (entries.get(key) !== entry) return false;
    entry.busy = false;
    entry.error = err?.response?.data?.error || err?.message || 'Something went wrong';
    startTimer(key, entry, entry.ms);
    notify(key);
    return false;
  }
  finish(key, entry.id, true);
  return true;
}

export function dismissUndo(key) {
  finish(key, null, false);
}

export function pauseUndo(key) {
  const entry = entries.get(key);
  if (!entry || entry.paused || entry.busy) return;
  clearTimeout(entry.timer);
  entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.startedAt));
  entry.paused = true;
}

export function resumeUndo(key) {
  const entry = entries.get(key);
  if (!entry || !entry.paused) return;
  entry.paused = false;
  // At least a moment more after the pointer leaves, so it never vanishes under it.
  startTimer(key, entry, Math.max(entry.remaining, 1500));
}

/** Tests: every offer ended, nothing called. */
export function resetUndoStore() {
  entries.forEach((e) => clearTimeout(e.timer));
  entries.clear();
  listeners.clear();
  contexts.clear();
  anyListeners.forEach((fn) => fn());
}

/** The undo object UndoNotice draws, for one key (FloatingUndoHost's). */
export function undoHandle(key) {
  return {
    notice: entries.get(key) || null,
    undo: () => runUndo(key),
    dismiss: () => dismissUndo(key),
    pause: () => pauseUndo(key),
    resume: () => resumeUndo(key),
  };
}

export function useUndo(key, context = {}) {
  const [, rerender] = useReducer((n) => n + 1, 0);
  const ctxRef = useRef(context);
  ctxRef.current = context;

  useEffect(() => {
    if (!listeners.has(key)) listeners.set(key, new Set());
    const set = listeners.get(key);
    set.add(rerender);
    contexts.set(key, ctxRef);
    // An offer made while this instance mounted (or by the one it replaced) shows now.
    rerender();
    return () => {
      set.delete(rerender);
      if (contexts.get(key) === ctxRef) contexts.delete(key);
      // A remount (the page's reloadTick) subscribes again in the same
      // commit; only when no caller is left does the offer end.
      setTimeout(() => {
        if (!(listeners.get(key)?.size) && !entries.get(key)?.floating) finish(key, null, false);
      }, 0);
    };
  }, [key]);

  const offer = useCallback((opts) => offerUndo(key, opts), [key]);
  const undo = useCallback(() => runUndo(key), [key]);
  const dismiss = useCallback(() => dismissUndo(key), [key]);
  const pause = useCallback(() => pauseUndo(key), [key]);
  const resume = useCallback(() => resumeUndo(key), [key]);

  return { notice: entries.get(key) || null, offer, undo, dismiss, pause, resume };
}

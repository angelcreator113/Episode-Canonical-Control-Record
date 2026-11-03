/**
 * Runs the editor's commands against the episode edit (Timeline Editor
 * redesign P3). Each change is saved when it is made: its requests go one by
 * one, each with the edit_revision the one before returned, then the edit is
 * read again so the page shows what the server stored. One change is one undo
 * step; undo runs the command's exact inverse (lib/editOps), redo runs it
 * again. A change made elsewhere (409 EDIT_CHANGED) reloads the edit and
 * clears both stacks, so nothing is undone over someone else's work.
 *
 * Row identity (2026-11-03): putting a deleted row back, or redoing a place,
 * makes a new row with a new id. The steps further down the stacks still name
 * the old id, so every request is resolved through `ids` (old id -> the row
 * that now stands for it) when it runs. A step the server still refuses is
 * kept, not dropped: the notice says why and offers "Skip this step", which
 * removes it only when the producer chooses to.
 */
import { useCallback, useRef, useState } from 'react';
import { episodeEditApi } from '../../lib/episodeEditApi';
import { writeFailure, resolveRequest } from '../../lib/editOps';

const MAX_STEPS = 100;

/** The newer of two revisions (bigint strings): the page's, or the one the last write returned. */
export function pickRevision(page, last) {
  if (last == null) return page;
  if (page == null) return last;
  try {
    return BigInt(last) > BigInt(page) ? last : page;
  } catch (err) {
    console.error('[EpisodeEditor] unreadable edit revision:', err?.message);
    return page;
  }
}

/**
 * { run, undo, redo, busy, status, canUndo, canRedo, undoLabel, redoLabel, notice, clearNotice }.
 * getRevision() is the edit_revision the page holds; reload() reads the edit again.
 */
export default function useEditOps({ episodeId, getRevision, reload, onSaved, canWrite = true }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const [, bump] = useState(0);
  const refresh = () => bump((n) => n + 1);
  const busyRef = useRef(false);
  // Old row id -> the id of the row that stands for it now (a put back or a redone place).
  const ids = useRef(new Map());
  // The revision the last write returned: the page's copy catches up only on its next render.
  const lastRevision = useRef(null);
  const resolveId = useCallback((id) => {
    let cur = id;
    for (let i = 0; i < 1000 && ids.current.has(cur); i += 1) cur = ids.current.get(cur);
    return cur;
  }, []);

  /** Runs a command's requests in order; resolves { results, revision } or throws { failure, partial }. */
  const execute = useCallback(async (cmd) => {
    let revision = pickRevision(getRevision(), lastRevision.current);
    const results = [];
    for (const req of cmd.requests) {
      try {
        const r = await episodeEditApi.write(episodeId, resolveRequest(req, resolveId), revision);
        results.push(r);
        if (r && r.edit_revision != null) { revision = r.edit_revision; lastRevision.current = r.edit_revision; }
      } catch (err) {
        console.error(`[EpisodeEditor] ${cmd.label} failed:`, err?.response?.data?.code || err?.message);
        const failure = writeFailure(err);
        throw Object.assign(new Error(failure.message), { failure, partial: results.length > 0 });
      }
    }
    if (cmd.replaces && cmd.newId) {
      const now = cmd.newId(results);
      if (now && now !== cmd.replaces) ids.current.set(cmd.replaces, now);
    }
    return { results, revision };
  }, [episodeId, getRevision, resolveId]);

  const settle = useCallback(async () => {
    try {
      await reload();
    } catch (err) {
      console.error('[EpisodeEditor] reload after a change failed:', err?.message);
      setNotice({ kind: 'error', text: 'The change was saved, but the edit could not be read again. Reload the page.' });
    }
  }, [reload]);

  /** Clears both stacks (and the ids they name). */
  const forget = () => {
    undoStack.current = [];
    redoStack.current = [];
    ids.current = new Map();
    lastRevision.current = null;
  };

  const fail = useCallback(async (err, label, stack = null) => {
    const f = err.failure || writeFailure(err);
    if (f.stale || err.partial) {
      forget();
      let reloaded = true;
      try {
        await reload();
      } catch (e) {
        reloaded = false;
        console.error('[EpisodeEditor] reload after a refused change failed:', e?.message);
      }
      const why = err.partial ? `${label}: only part of this change was saved. ${f.message}` : `${label}: ${f.message}`;
      setNotice({ kind: 'error', text: reloaded ? why : `${why.replace(' It has been reloaded, and', '')} The edit could not be read again: reload the page.` });
      return;
    }
    // An undo or redo the server refuses stays where it is; the producer decides to skip it.
    const skip = stack ? {
      label: 'Skip this step',
      run: () => {
        const s = stack === 'undo' ? undoStack : redoStack;
        s.current.pop();
        setNotice({ kind: 'info', text: `Skipped “${label}”. Nothing was changed by skipping it.` });
        refresh();
      },
    } : null;
    setNotice({ kind: 'error', text: `${label}: ${f.message}${stack ? ` This ${stack} step is kept; skip it to reach the ones before it.` : ''}`, action: skip });
  }, [reload]);

  const writeOk = useRef(canWrite);
  writeOk.current = canWrite;
  const readOnly = () => {
    setNotice({ kind: 'info', text: 'Read only: editing needs an admin account. Nothing was changed.' });
    return false;
  };

  const go = useCallback(async (cmd, push, stack = null) => {
    if (busyRef.current) return false;
    if (!writeOk.current) return readOnly();
    if (cmd.barrier) { setNotice({ kind: 'info', text: cmd.why }); return false; }
    busyRef.current = true;
    setBusy(true);
    try {
      const { results } = await execute(cmd);
      const inverse = cmd.undo ? cmd.undo(results) : null;
      push(inverse);
      setLastSaved(new Date());
      setNotice(null);
      await settle();
      onSaved?.(cmd, results);
      return true;
    } catch (err) {
      await fail(err, cmd.label, stack);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
      refresh();
    }
  }, [execute, settle, fail, onSaved]);

  /** A new change: saved now; undo takes it back; redo history is cleared. */
  const run = useCallback((cmd) => go(cmd, (inverse) => {
    redoStack.current = [];
    undoStack.current.push(inverse || { barrier: true, label: cmd.label, why: `${cmd.label} can't be undone.` });
    if (undoStack.current.length > MAX_STEPS) undoStack.current.shift();
  }), [go]);

  const undo = useCallback(async () => {
    const top = undoStack.current[undoStack.current.length - 1];
    if (!top) return false;
    if (top.barrier) { setNotice({ kind: 'info', text: top.why }); return false; }
    const ok = await go(top, (inverse) => {
      undoStack.current.pop();
      if (inverse && !inverse.barrier) redoStack.current.push(inverse);
    }, 'undo');
    return ok;
  }, [go]);

  const redo = useCallback(async () => {
    const top = redoStack.current[redoStack.current.length - 1];
    if (!top) return false;
    return go(top, (inverse) => {
      redoStack.current.pop();
      if (inverse) undoStack.current.push(inverse);
    }, 'redo');
  }, [go]);

  /** A write that is not an edit step (Save Draft): no undo entry. */
  const once = useCallback(async (label, fn) => {
    if (busyRef.current) return null;
    if (!writeOk.current) { readOnly(); return null; }
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await fn();
      setNotice({ kind: 'ok', text: `${label}: saved.` });
      return r;
    } catch (err) {
      console.error(`[EpisodeEditor] ${label} failed:`, err?.response?.data?.code || err?.message);
      await fail(Object.assign(err, { failure: writeFailure(err) }), label);
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [fail]);

  const top = (s) => s.current[s.current.length - 1] || null;
  const u = top(undoStack);
  const r = top(redoStack);
  return {
    run, undo, redo, once, busy, lastSaved,
    canUndo: Boolean(u) && !u.barrier, canRedo: Boolean(r),
    undoLabel: u ? (u.barrier ? `${u.label} can't be undone` : u.label) : null,
    redoLabel: r ? r.label : null,
    notice, clearNotice: () => setNotice(null), say: setNotice,
    resetHistory: () => { forget(); refresh(); },
  };
}

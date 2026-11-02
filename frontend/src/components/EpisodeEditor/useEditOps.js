/**
 * Runs the editor's commands against the episode edit (Timeline Editor
 * redesign P3). Each change is saved when it is made: its requests go one by
 * one, each with the edit_revision the one before returned, then the edit is
 * read again so the page shows what the server stored. One change is one undo
 * step; undo runs the command's exact inverse (lib/editOps), redo runs it
 * again. A change made elsewhere (409 EDIT_CHANGED) reloads the edit and
 * clears both stacks, so nothing is undone over someone else's work.
 */
import { useCallback, useRef, useState } from 'react';
import { episodeEditApi } from '../../lib/episodeEditApi';
import { writeFailure } from '../../lib/editOps';

const MAX_STEPS = 100;

/**
 * { run, undo, redo, busy, status, canUndo, canRedo, undoLabel, redoLabel, notice, clearNotice }.
 * getRevision() is the edit_revision the page holds; reload() reads the edit again.
 */
export default function useEditOps({ episodeId, getRevision, reload, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const [, bump] = useState(0);
  const refresh = () => bump((n) => n + 1);
  const busyRef = useRef(false);

  /** Runs a command's requests in order; resolves { results, revision } or throws { failure, partial }. */
  const execute = useCallback(async (cmd) => {
    let revision = getRevision();
    const results = [];
    for (const req of cmd.requests) {
      try {
        const r = await episodeEditApi.write(episodeId, req, revision);
        results.push(r);
        if (r && r.edit_revision != null) revision = r.edit_revision;
      } catch (err) {
        console.error(`[EpisodeEditor] ${cmd.label} failed:`, err?.response?.data?.code || err?.message);
        const failure = writeFailure(err);
        throw Object.assign(new Error(failure.message), { failure, partial: results.length > 0 });
      }
    }
    return { results, revision };
  }, [episodeId, getRevision]);

  const settle = useCallback(async () => {
    try {
      await reload();
    } catch (err) {
      console.error('[EpisodeEditor] reload after a change failed:', err?.message);
      setNotice({ kind: 'error', text: 'The change was saved, but the edit could not be read again. Reload the page.' });
    }
  }, [reload]);

  const fail = useCallback(async (err, label) => {
    const f = err.failure || writeFailure(err);
    if (f.stale || err.partial) {
      undoStack.current = [];
      redoStack.current = [];
      await settle();
    }
    setNotice({ kind: 'error', text: err.partial ? `${label}: only part of this change was saved, so the edit was reloaded. ${f.message}` : `${label}: ${f.message}` });
  }, [settle]);

  const go = useCallback(async (cmd, push) => {
    if (busyRef.current) return false;
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
      await fail(err, cmd.label);
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
    });
    return ok;
  }, [go]);

  const redo = useCallback(async () => {
    const top = redoStack.current[redoStack.current.length - 1];
    if (!top) return false;
    return go(top, (inverse) => {
      redoStack.current.pop();
      if (inverse) undoStack.current.push(inverse);
    });
  }, [go]);

  /** A write that is not an edit step (Save Draft): no undo entry. */
  const once = useCallback(async (label, fn) => {
    if (busyRef.current) return null;
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
    resetHistory: () => { undoStack.current = []; redoStack.current = []; refresh(); },
  };
}

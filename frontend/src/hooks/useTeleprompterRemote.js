/**
 * The desktop side of the teleprompter's phone remote (Teleprompter batch 3;
 * Evoni, 2026-10-20). While `open`: a session is opened (once), its commands
 * are fetched about every 700ms and handed to onCommand in order, and the
 * reader's `state` is sent whenever it changes, for the phone to show.
 * Closing (open false, or leaving the reader) ends the session.
 *
 * Returns { status: 'off'|'opening'|'live'|'ended'|'unavailable'|'error',
 * session: { id, token, expires_at } | null, message, end, reopen }.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { remoteApi, isNotReady, REMOTE_NOT_READY, REMOTE_GONE } from '../lib/teleprompterRemoteApi';

export const POLL_MS = 700;
const GAP_MS = 40;

export default function useTeleprompterRemote(open, { episodeId = null, onCommand, state = null, pollMs = POLL_MS } = {}) {
  const [status, setStatus] = useState('off');
  const [session, setSession] = useState(null);
  const [message, setMessage] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;
  const seqRef = useRef(0);
  const sessionRef = useRef(null);

  const endNow = useCallback((s) => {
    if (!s?.id) return;
    remoteApi.end(s.id).catch((err) => console.error('[useTeleprompterRemote] session not ended:', err));
  }, []);

  // Open a session while open; end it on close.
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setStatus('opening');
    setMessage(null);
    remoteApi.open(episodeId)
      .then((s) => {
        if (!live) { endNow(s); return; }
        seqRef.current = Number(s?.command_seq) || 0;
        sessionRef.current = s;
        setSession(s);
        setStatus('live');
      })
      .catch((err) => {
        console.error('[useTeleprompterRemote] session not opened:', err);
        if (!live) return;
        if (isNotReady(err)) { setStatus('unavailable'); setMessage(REMOTE_NOT_READY); return; }
        setStatus('error');
        setMessage(err?.response?.data?.error || 'The phone remote could not start. Try again.');
      });
    return () => {
      live = false;
      endNow(sessionRef.current);
      sessionRef.current = null;
      setSession(null);
      setStatus('off');
    };
  }, [open, attempt, episodeId, endNow]);

  // Fetch the phone's commands while live.
  const id = session?.id || null;
  useEffect(() => {
    if (!id || status !== 'live') return undefined;
    let stopped = false;
    let busy = false;
    const tick = async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        const data = await remoteApi.commands(id, seqRef.current);
        if (stopped) return;
        if (data?.ended) { setStatus('ended'); setMessage(REMOTE_GONE); return; }
        // One at a time, with a render between, so each sees the last one's result
        // (two "faster" presses go up two steps).
        for (const c of data?.commands || []) {
          if (stopped) return;
          if (c.seq <= seqRef.current) continue;
          seqRef.current = c.seq;
          try { onCommandRef.current?.(c.command); } catch (err) { console.error('[useTeleprompterRemote] command failed:', c.command, err); }
          await new Promise((r) => { window.setTimeout(r, GAP_MS); });
        }
        if (Number(data?.seq) > seqRef.current) seqRef.current = Number(data.seq);
      } catch (err) {
        console.error('[useTeleprompterRemote] commands not fetched:', err);
        if (!stopped && isNotReady(err)) { setStatus('unavailable'); setMessage(REMOTE_NOT_READY); }
      } finally {
        busy = false;
      }
    };
    const t = window.setInterval(tick, pollMs);
    return () => { stopped = true; window.clearInterval(t); };
  }, [id, status, pollMs]);

  // Send the reader's state when it changes.
  const stateKey = state ? JSON.stringify(state) : '';
  useEffect(() => {
    if (!id || status !== 'live' || !stateKey) return undefined;
    const t = window.setTimeout(() => {
      remoteApi.putState(id, JSON.parse(stateKey)).catch((err) => console.error('[useTeleprompterRemote] state not sent:', err));
    }, 150);
    return () => window.clearTimeout(t);
  }, [id, status, stateKey]);

  const end = useCallback(() => {
    endNow(sessionRef.current);
    sessionRef.current = null;
    setSession(null);
    setStatus('ended');
    setMessage(null);
  }, [endNow]);
  const reopen = useCallback(() => setAttempt((n) => n + 1), []);

  return { status, session, message, end, reopen };
}

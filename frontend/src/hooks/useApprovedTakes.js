/**
 * The Teleprompter's approved takes while Voice Studio is on (B2b; Evoni,
 * 2026-10-28): the playable list, asked afresh
 *   - when the page opens and on every Play (nothing plays until it answers),
 *   - when the tab becomes visible again,
 *   - when a take fails to play (once per take per Play; a fresh list may
 *     carry a fresh link).
 * It fails closed: a list that can't be had plays nothing, and a fresh list
 * that no longer has the take on the reading line stops it. A take that is
 * unchanged keeps its object, so a refresh never restarts it mid-line.
 *
 * useApprovedTakes(episodeId, scriptRevision) → {
 *   mode: null (checking) | 'on' | 'off' | 'unknown',
 *   ready: the list may be played from now (on, answered, not checking),
 *   failed: the last refresh could not get the list (or the status),
 *   lines: studioVoice(list, scriptRevision) → { byLine, notes, stale },
 *   refresh({ hold }), onPlay(gen), onFailed(approvalId, url), verifiedFor(gen): a take
 *   may play in Play number gen only once that Play's own fresh list has answered,
 * }
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { voiceStudioMode, voiceStudioApi } from '../lib/voiceStudioApi';
import { studioVoice } from '../lib/teleprompterVoiceStudio';

const sameTake = (a, b) => !!a && !!b && a.approval_id === b.approval_id && a.revision_id === b.revision_id
  && a.in_ms === b.in_ms && a.out_ms === b.out_ms;

export default function useApprovedTakes(episodeId, scriptRevision) {
  const [mode, setMode] = useState(null);
  const [list, setList] = useState(null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [verified, setVerified] = useState(-1); // the Play (gen) whose fresh list answered
  const seqRef = useRef(0);
  const retriedRef = useRef(new Set());
  const failedUrlRef = useRef(new Set());

  // hold: nothing plays until the answer (a Play, the first load); otherwise
  // what plays carries on until the answer says otherwise.
  const refresh = useCallback(async ({ hold = false, gen = null } = {}) => {
    if (!episodeId) return;
    const seq = ++seqRef.current;
    if (hold) setChecking(true);
    const m = await voiceStudioMode();
    if (seq !== seqRef.current) return;
    setMode(m);
    if (m !== 'on') {
      setList(null);
      setFailed(m === 'unknown');
      setChecking(false);
      return;
    }
    try {
      const next = await voiceStudioApi.playable(episodeId);
      if (seq !== seqRef.current) return;
      setList(next || { script_revision: null, takes: [], held: [] });
      setFailed(false);
      if (gen != null) setVerified(gen);
    } catch (err) {
      console.error('[Teleprompter] approved takes not loaded:', err?.message || err);
      if (seq !== seqRef.current) return;
      setList(null); // fail closed
      setFailed(true);
    } finally {
      if (seq === seqRef.current) setChecking(false);
    }
  }, [episodeId]);

  useEffect(() => {
    retriedRef.current = new Set();
    failedUrlRef.current = new Set();
    setMode(null);
    setList(null);
    setFailed(false);
    if (!episodeId) return undefined;
    refresh({ hold: true });
    return () => { seqRef.current += 1; };
  }, [episodeId, scriptRevision, refresh]);

  // Back to the tab: ask again (Voice Studio may have changed in the meantime).
  useEffect(() => {
    if (!episodeId || typeof document === 'undefined') return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [episodeId, refresh]);

  const onPlay = useCallback((gen) => {
    retriedRef.current = new Set();
    failedUrlRef.current = new Set();
    return refresh({ hold: true, gen });
  }, [refresh]);

  const onFailed = useCallback((approvalId, url) => {
    if (!approvalId || retriedRef.current.has(approvalId)) return;
    retriedRef.current.add(approvalId);
    if (url) failedUrlRef.current.add(url);
    refresh();
  }, [refresh]);

  // Unchanged takes keep their object (and link), so a refresh never restarts one mid-line;
  // a take whose link failed takes the fresh one.
  const prevRef = useRef(new Map());
  const lines = useMemo(() => {
    const v = studioVoice(list, scriptRevision);
    const byLine = new Map();
    for (const [key, take] of v.byLine) {
      const was = prevRef.current.get(key);
      const keep = sameTake(was, take) && !failedUrlRef.current.has(was.url);
      byLine.set(key, keep ? was : take);
    }
    prevRef.current = byLine;
    return { ...v, byLine };
  }, [list, scriptRevision]);

  // verifiedFor(gen): this Play's fresh list has answered (and nothing has failed since).
  const verifiedFor = useCallback((gen) => verified === gen, [verified]);
  return { mode, ready: mode === 'on' && !checking && !!list && !failed, failed, checking, lines, refresh, onPlay, onFailed, verifiedFor };
}

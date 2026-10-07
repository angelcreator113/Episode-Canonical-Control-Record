/**
 * usePhonePlaythrough — client-side binding to the server-side playable phone state.
 *
 * Loads/creates the per-user, per-episode state on mount, exposes `tap(zoneId)`
 * which hits the server (which runs the SAME phoneRuntime evaluator the editor
 * uses). The returned shape matches what PhonePreviewMode expects in its
 * `playthrough` prop so wiring is a one-liner.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

export default function usePhonePlaythrough(episodeId) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Which episode the state was read for: right after Play the effect has not
  // run yet, so `loading` alone would read false before the read starts.
  const [loadedFor, setLoadedFor] = useState(null);

  // Initial load — creates the row server-side if it doesn't exist.
  useEffect(() => {
    // Closed: forget the last session, so a reopen starts from what the
    // server has, not a stale copy.
    if (!episodeId) { setLoading(false); setState(null); setError(null); setLoadedFor(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get(`/api/v1/episodes/${episodeId}/phone-state`)
      .then(res => { if (!cancelled) setState(res.data?.state || null); })
      .catch(err => { if (!cancelled) setError(err.response?.data?.error || err.message); })
      .finally(() => { if (!cancelled) { setLoading(false); setLoadedFor(episodeId); } });
    return () => { cancelled = true; };
  }, [episodeId]);

  // Tap a zone — server validates the condition, applies actions, persists state,
  // and returns { state, effects }. Client re-syncs state and the caller handles
  // effects (navigate / toasts / completion).
  const tap = useCallback(async (zoneId) => {
    if (!episodeId || !zoneId) return null;
    try {
      const res = await api.post(`/api/v1/episodes/${episodeId}/phone-state/tap`, { zone_id: zoneId });
      const nextState = res.data?.state;
      const effects = res.data?.effects || { navigate: null, toasts: [], completeEpisode: false };
      if (nextState) setState(nextState);
      return { effects, state: nextState };
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      return null;
    }
  }, [episodeId]);

  const reset = useCallback(async () => {
    if (!episodeId) return;
    try {
      const res = await api.post(`/api/v1/episodes/${episodeId}/phone-state/reset`);
      if (res.data?.state) setState(res.data.state);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, [episodeId]);

  // Remember the screen the player is on (Back, Home and icon taps change it
  // without /tap), so a reopened play-through resumes there (Evoni,
  // 2026-10-07). A failure is reported, not swallowed.
  const saveScreen = useCallback(async (screenId) => {
    if (!episodeId || !screenId) return;
    try {
      await api.put(`/api/v1/episodes/${episodeId}/phone-state/screen`, { screen_id: screenId });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, [episodeId]);

  const clearError = useCallback(() => setError(null), []);

  return { state, loading: loading || (Boolean(episodeId) && loadedFor !== episodeId), error, tap, reset, saveScreen, clearError };
}

import { useState, useCallback } from 'react';
import api from '../services/api';
import usePhonePlaythrough from './usePhonePlaythrough';
import { isScreen } from '../lib/overlayUtils';

/**
 * usePhonePlayback — encapsulates the "Play on Phone" feature.
 *
 * The episode page mounts a PhonePreviewMode overlay when the creator hits
 * Play. This hook owns all the state that overlay needs (screens, missions,
 * frame settings, persistent playthrough), exposes a single `start()` action
 * that fetches everything lazily on demand, and an `isPlaying` flag the host
 * gates the overlay render on.
 *
 * Lazy by design: nothing fetches on episode page load. We only hit the
 * overlay endpoints once the creator clicks Play, since most episode page
 * views never use playback.
 *
 * Returns:
 *   isPlaying          — boolean, gate the <PhonePreviewMode /> mount on this
 *   start()            — async fn; fetches overlays/missions/frame, then opens
 *   stop()             — closes the overlay (used by the modal's onClose)
 *   overlays           — phone screens to render (already filtered to generated)
 *   missions           — show-wide + episode-scoped missions
 *   skin               — phone device chrome (e.g. 'rosegold')
 *   globalFit          — per-screen image fit cascade defaults
 *   frameUrl           — the show's custom frame image URL, or null
 *   playthrough        — server-backed state object from usePhonePlaythrough
 *                        (null when not playing — keeps the underlying hook
 *                        idle until needed)
 *   error              — why Play did not open, in plain words, or null; it
 *                        used to fail silently (Evoni, 2026-10-07)
 */
export default function usePhonePlayback(episode) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [overlays, setOverlays] = useState([]);
  const [missions, setMissions] = useState([]);
  const [skin, setSkin] = useState('rosegold');
  const [globalFit, setGlobalFit] = useState({});
  const [frameUrl, setFrameUrl] = useState(null);
  const [error, setError] = useState(null);
  // Pass null while idle so usePhonePlaythrough stays dormant — it polls /
  // fetches on episodeId change, and we don't want that running in the
  // background of every episode page view.
  const playthrough = usePhonePlaythrough(isPlaying ? episode?.id : null);

  const start = useCallback(async () => {
    const showId = episode?.show_id || episode?.showId;
    setError(null);
    if (!showId) { setError("This episode isn't in a show, so it has no phone to play."); return; }
    try {
      // Scoped to the episode (Task #1920), so the preview plays the screens
      // the Lala's Phone tab lists: show defaults with this episode's overrides.
      const episodeQuery = episode?.id ? `?episode_id=${encodeURIComponent(episode.id)}` : '';
      const res = await api.get(`/api/v1/ui-overlays/${showId}${episodeQuery}`);
      const all = res.data?.data || [];
      // Icons stay in the list: the phone draws them on screens from it.
      const playable = all.filter(o => o.generated && o.url);
      if (!playable.some(isScreen)) {
        setError("No phone screens have an image yet. Make them in Producer Mode → Lala's Phone.");
        return;
      }
      setOverlays(playable);
      // Frame settings (skin + per-screen fit cascade) so the player sees
      // exactly what creators configured. Fail-open if the route 404s on
      // older environments.
      const frameRes = await api.get(`/api/v1/ui-overlays/${showId}/frame`).catch((err) => {
        console.error('[usePhonePlayback] frame settings not read, using defaults:', err?.message);
        return { data: {} };
      });
      if (frameRes.data?.global_fit) setGlobalFit(frameRes.data.global_fit);
      if (frameRes.data?.phone_skin) setSkin(frameRes.data.phone_skin);
      // The show's custom frame, if one is uploaded (Task #1990), so the
      // Preview draws the same frame Producer Mode does.
      setFrameUrl(frameRes.data?.frame_url || null);
      // Show-wide + episode-scoped observers. Fail-open if phone_missions
      // table isn't deployed yet — skipping the mission UI is fine.
      const missionsRes = await api.get(`/api/v1/ui-overlays/${showId}/missions?episode_id=${encodeURIComponent(episode.id)}`).catch((err) => {
        console.error('[usePhonePlayback] missions not read, playing without them:', err?.message);
        return { data: {} };
      });
      setMissions(missionsRes.data?.missions || []);
      setIsPlaying(true);
    } catch (err) {
      console.error('[usePhonePlayback] Failed to load phone overlays:', err);
      setError(`The phone didn't open: ${err.response?.data?.error || err.message || 'the screens could not be read'}.`);
    }
  }, [episode]);

  const stop = useCallback(() => setIsPlaying(false), []);

  return { isPlaying, start, stop, overlays, missions, skin, globalFit, frameUrl, playthrough, error };
}

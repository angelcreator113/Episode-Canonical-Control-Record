import { useState, useCallback } from 'react';
import api from '../services/api';
import usePhonePlaythrough from './usePhonePlaythrough';

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
 *   playthrough        — server-backed state object from usePhonePlaythrough
 *                        (null when not playing — keeps the underlying hook
 *                        idle until needed)
 */
export default function usePhonePlayback(episode) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [overlays, setOverlays] = useState([]);
  const [missions, setMissions] = useState([]);
  const [skin, setSkin] = useState('rosegold');
  const [globalFit, setGlobalFit] = useState({});
  // Pass null while idle so usePhonePlaythrough stays dormant — it polls /
  // fetches on episodeId change, and we don't want that running in the
  // background of every episode page view.
  const playthrough = usePhonePlaythrough(isPlaying ? episode?.id : null);

  const start = useCallback(async () => {
    const showId = episode?.show_id || episode?.showId;
    if (!showId) return;
    try {
      const res = await api.get(`/api/v1/ui-overlays/${showId}`);
      const all = res.data?.data || [];
      setOverlays(all.filter(o => o.generated && o.url));
      // Frame settings (skin + per-screen fit cascade) so the player sees
      // exactly what creators configured. Fail-open if the route 404s on
      // older environments.
      const frameRes = await api.get(`/api/v1/ui-overlays/${showId}/frame`).catch(() => ({ data: {} }));
      if (frameRes.data?.global_fit) setGlobalFit(frameRes.data.global_fit);
      if (frameRes.data?.phone_skin) setSkin(frameRes.data.phone_skin);
      // Show-wide + episode-scoped observers. Fail-open if phone_missions
      // table isn't deployed yet — skipping the mission UI is fine.
      const missionsRes = await api.get(`/api/v1/ui-overlays/${showId}/missions?episode_id=${encodeURIComponent(episode.id)}`).catch(() => ({ data: {} }));
      setMissions(missionsRes.data?.missions || []);
      setIsPlaying(true);
    } catch (err) {
      console.error('[usePhonePlayback] Failed to load phone overlays:', err);
    }
  }, [episode]);

  const stop = useCallback(() => setIsPlaying(false), []);

  return { isPlaying, start, stop, overlays, missions, skin, globalFit, playthrough };
}

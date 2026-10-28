/**
 * Voice Studio audition (B2): one player for the page, so starting a take
 * stops the one before. play(take) plays the take's trim (in to out) from
 * its source; stop() ends it. { playingId, play, stop, error }.
 * Level and fades are not applied in the browser (they are on export).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useAudition() {
  const audioRef = useRef(null);
  const endRef = useRef(null);
  const [playingId, setPlayingId] = useState(null);
  const [error, setError] = useState(null);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.ontimeupdate = null;
      a.onended = null;
      a.onerror = null;
      try { a.pause(); } catch (err) { console.error('[useAudition] pause failed:', err); }
    }
    endRef.current = null;
    setPlayingId(null);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const play = useCallback((id, url, fromMs = 0, toMs = null) => {
    stop();
    setError(null);
    if (!url) { setError("This take's audio can't be found."); return; }
    let a = audioRef.current;
    if (!a) { a = new window.Audio(); audioRef.current = a; }
    a.src = url;
    endRef.current = toMs;
    a.ontimeupdate = () => { if (endRef.current != null && a.currentTime * 1000 >= endRef.current) stop(); };
    a.onended = () => stop();
    a.onerror = () => { console.error('[useAudition] audio failed to load:', url); setError("This take's audio couldn't be played."); stop(); };
    const start = () => {
      try { a.currentTime = Math.max(0, fromMs / 1000); } catch (err) { console.error('[useAudition] seek failed:', err); }
      const p = a.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => { console.error('[useAudition] play refused:', err); setError("The browser didn't play the take. Press play again."); stop(); });
      }
    };
    if (a.readyState >= 1) start(); else a.onloadedmetadata = () => { a.onloadedmetadata = null; start(); };
    try { a.load?.(); } catch (err) { console.error('[useAudition] load failed:', err); }
    setPlayingId(id);
  }, [stop]);

  return { playingId, play, stop, error };
}

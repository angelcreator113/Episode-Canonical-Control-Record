/**
 * Plays the voice clip of the line on the teleprompter's reading line
 * (Teleprompter batch 3; Evoni, 2026-10-20). `lineKey` names the line (a new
 * key loads its clip afresh); `on` plays it, off pauses it where it is, so
 * Pause and Play carry on mid-clip. `ended` turns true once the clip has
 * played to its end (or, if it cannot play, once its length has passed), for
 * the prompter to move on. A stalled clip lets go a second and a half after
 * its length.
 */
import { useState, useEffect, useRef } from 'react';
import { clipSeconds } from '../lib/voiceClipsApi';

export default function useLineVoice(clip, lineKey, on) {
  const [endedKey, setEndedKey] = useState(null);
  const ref = useRef(null);
  const url = clip?.url || null;
  const seconds = clipSeconds(clip) || 1;

  useEffect(() => {
    if (!url || lineKey == null || typeof window.Audio !== 'function') return undefined;
    let audio;
    try {
      audio = new window.Audio(url);
      audio.preload = 'auto';
    } catch (err) {
      console.error('[useLineVoice] clip not loaded:', err);
      return undefined;
    }
    let fallback = null;
    const end = () => setEndedKey(lineKey);
    // A clip that cannot play holds the line for its length, then lets go.
    const fail = (err) => {
      console.error('[useLineVoice] clip did not play:', err?.message || err);
      if (fallback == null) fallback = window.setTimeout(end, seconds * 1000);
    };
    const onError = () => fail(audio.error || new Error('audio error'));
    audio.addEventListener('ended', end);
    audio.addEventListener('error', onError);
    ref.current = { key: lineKey, audio, fail };
    setEndedKey((k) => (k === lineKey ? null : k));
    return () => {
      audio.removeEventListener('ended', end);
      audio.removeEventListener('error', onError);
      try { audio.pause(); } catch (err) { console.error('[useLineVoice] clip did not pause:', err); }
      if (fallback != null) window.clearTimeout(fallback);
      if (ref.current?.audio === audio) ref.current = null;
    };
  }, [url, lineKey, seconds]);

  useEffect(() => {
    const cur = ref.current;
    if (!cur || cur.key !== lineKey) return undefined;
    if (!on) {
      try { cur.audio.pause(); } catch (err) { console.error('[useLineVoice] clip did not pause:', err); }
      return undefined;
    }
    try {
      const p = cur.audio.play();
      if (p && typeof p.catch === 'function') p.catch(cur.fail);
    } catch (err) { cur.fail(err); }
    // A clip that stalls (a slow network, a lost device) never holds the
    // prompter for good: what is left of it, and a little more, then on.
    const left = Math.max(0.5, seconds - (Number(cur.audio.currentTime) || 0));
    const watchdog = window.setTimeout(() => setEndedKey(lineKey), (left + 1.5) * 1000);
    return () => window.clearTimeout(watchdog);
  }, [on, url, lineKey, seconds]);

  return { ended: lineKey != null && endedKey === lineKey };
}

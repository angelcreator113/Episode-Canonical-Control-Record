/**
 * Plays the voice clip of the line on the teleprompter's reading line
 * (Teleprompter batch 3; Evoni, 2026-10-20). `lineKey` names the line (a new
 * key loads its clip afresh); `on` plays it, off pauses it where it is, so
 * Pause and Play carry on mid-clip. `ended` turns true once the clip has
 * played to its end (or, if it cannot play, once its length has passed), for
 * the prompter to move on. A stalled clip lets go a second and a half after
 * its length. `failed` turns true when the clip could not be played.
 *
 * A Voice Studio take (B2b) carries its approved trim, in_ms and out_ms: it
 * starts at in (once the file's length is known) and stops at out, and its
 * length is out − in. A clip without them plays whole, as before.
 */
import { useState, useEffect, useRef } from 'react';
import { clipSeconds } from '../lib/voiceClipsApi';

export default function useLineVoice(clip, lineKey, on) {
  const [endedKey, setEndedKey] = useState(null);
  const [failedKey, setFailedKey] = useState(null);
  const ref = useRef(null);
  const url = clip?.url || null;
  const seconds = clipSeconds(clip) || 1;
  const fromS = Number.isFinite(clip?.in_ms) ? clip.in_ms / 1000 : null;
  const toS = Number.isFinite(clip?.out_ms) ? clip.out_ms / 1000 : null;

  useEffect(() => {
    if (!url || lineKey == null || typeof window.Audio !== 'function') return undefined;
    let audio;
    try {
      audio = new window.Audio(url);
      audio.preload = 'auto';
    } catch (err) {
      console.error('[useLineVoice] clip not loaded:', err);
      setFailedKey(lineKey);
      return undefined;
    }
    let fallback = null;
    const end = () => setEndedKey(lineKey);
    // A clip that cannot play holds the line for its length, then lets go.
    const fail = (err) => {
      console.error('[useLineVoice] clip did not play:', err?.message || err);
      setFailedKey(lineKey);
      if (fallback == null) fallback = window.setTimeout(end, seconds * 1000);
    };
    const onError = () => fail(audio.error || new Error('audio error'));
    const cur = { key: lineKey, audio, fail, on: false, seeked: !(fromS > 0) };
    const play = () => {
      try {
        const p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(fail);
      } catch (err) { fail(err); }
    };
    // A trimmed take starts at its in point: seek once the length is known, then play.
    cur.start = () => {
      if (cur.seeked) { play(); return; }
      if (!(Number(audio.readyState) >= 1)) return; // onMeta starts it
      try { audio.currentTime = fromS; } catch (err) { fail(err); return; }
      cur.seeked = true;
      play();
    };
    const onMeta = () => { if (!cur.seeked && cur.on) cur.start(); };
    // ...and stops at its out point: a timer from when it plays (timeupdate
    // alone comes every quarter second or so, and would run on past out),
    // with timeupdate as the backstop.
    let outTimer = null;
    const clearOut = () => { if (outTimer != null) window.clearTimeout(outTimer); outTimer = null; };
    const stopAtOut = () => {
      clearOut();
      try { audio.pause(); } catch (err) { console.error('[useLineVoice] clip did not pause:', err); }
      end();
    };
    const onTime = () => { if (toS != null && Number(audio.currentTime) >= toS) stopAtOut(); };
    // The timer goes by the audio's own clock: due, it stops only once the
    // take has reached out (within 10 ms), else waits what is left.
    const checkOut = () => {
      clearOut();
      const left = (toS - (Number(audio.currentTime) || 0)) / (Number(audio.playbackRate) || 1);
      if (left <= 0.01) stopAtOut(); else outTimer = window.setTimeout(checkOut, left * 1000);
    };
    const onPlaying = () => checkOut();
    audio.addEventListener('ended', end);
    audio.addEventListener('error', onError);
    if (fromS != null || toS != null) {
      audio.addEventListener('loadedmetadata', onMeta);
      audio.addEventListener('timeupdate', onTime);
    }
    if (toS != null) {
      audio.addEventListener('playing', onPlaying);
      audio.addEventListener('pause', clearOut);
    }
    ref.current = cur;
    setEndedKey((k) => (k === lineKey ? null : k));
    setFailedKey((k) => (k === lineKey ? null : k));
    return () => {
      audio.removeEventListener('ended', end);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', clearOut);
      clearOut();
      try { audio.pause(); } catch (err) { console.error('[useLineVoice] clip did not pause:', err); }
      if (fallback != null) window.clearTimeout(fallback);
      if (ref.current?.audio === audio) ref.current = null;
    };
  }, [url, lineKey, seconds, fromS, toS]);

  useEffect(() => {
    const cur = ref.current;
    if (!cur || cur.key !== lineKey) return undefined;
    cur.on = !!on;
    if (!on) {
      try { cur.audio.pause(); } catch (err) { console.error('[useLineVoice] clip did not pause:', err); }
      return undefined;
    }
    cur.start();
    // A clip that stalls (a slow network, a lost device) never holds the
    // prompter for good: what is left of it, and a little more, then on.
    const played = Math.max(0, (Number(cur.audio.currentTime) || 0) - (cur.seeked ? fromS || 0 : 0));
    const left = Math.max(0.5, seconds - played);
    const watchdog = window.setTimeout(() => setEndedKey(lineKey), (left + 1.5) * 1000);
    return () => window.clearTimeout(watchdog);
  }, [on, url, lineKey, seconds, fromS]);

  return { ended: lineKey != null && endedKey === lineKey, failed: lineKey != null && failedKey === lineKey };
}

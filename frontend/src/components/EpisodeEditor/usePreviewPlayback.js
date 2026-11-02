/**
 * The working preview's player (Timeline Editor redesign P2). One clock, the
 * edit's: while playing, the playhead is the wall clock since Play, times the
 * rate, snapped to frames (R8.4.5). Every picture and sound follows that
 * clock: each frame it is told where in its source it should be, and is
 * moved there when it drifts. Nothing here decides what plays; that is
 * previewPlan.mixAt / framePlan, from the edit.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { snapToFrame } from '../../lib/previewPlan';

/** How far (s) a sound may drift from the clock before it is moved back. */
export const AUDIO_DRIFT_S = 0.12;

const callPlay = (el, what) => {
  try {
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch((err) => console.warn(`[EpisodeEditor] ${what} could not play:`, err?.message));
  } catch (err) {
    console.warn(`[EpisodeEditor] ${what} could not play:`, err?.message);
  }
};

const safePause = (el) => {
  try { if (!el.paused) el.pause(); } catch (err) { console.warn('[EpisodeEditor] pause failed:', err?.message); }
};

/**
 * { playing, rate, play, pause, toggle, faster, restartAt, failed }.
 * soundsAt(t) gives previewPlan.mixAt's list; masterVolume is 0..1.
 */
export default function usePreviewPlayback({
  duration, playhead, setPlayhead, soundsAt, masterVolume = 1,
  now = () => performance.now(),
  raf = (fn) => window.requestAnimationFrame(fn),
  cancelRaf = (id) => window.cancelAnimationFrame(id),
  makeAudio = () => new Audio(),
}) {
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState({});
  const clock = useRef({ startWall: 0, startT: 0, rate: 1, frame: null, playing: false });
  const audio = useRef(new Map());
  const latest = useRef({ duration, soundsAt, masterVolume, playhead });
  latest.current = { duration, soundsAt, masterVolume, playhead };

  const elementFor = useCallback((s) => {
    let el = audio.current.get(s.key);
    if (!el) {
      el = makeAudio();
      el.preload = 'auto';
      el.addEventListener('error', () => {
        console.error('[EpisodeEditor] a sound could not load:', s.label);
        setFailed((cur) => ({ ...cur, [s.key]: true }));
      });
      audio.current.set(s.key, el);
    }
    if (el.dataset?.src !== s.url) {
      el.src = s.url;
      if (el.dataset) el.dataset.src = s.url;
    }
    return el;
  }, [makeAudio]);

  /** Every sound to where the clock is: playing ones in place and level, the rest paused. */
  const applySounds = useCallback((t, isPlaying) => {
    const list = latest.current.soundsAt ? latest.current.soundsAt(t) : [];
    const seen = new Set();
    for (const s of list) {
      if (!s.url) continue;
      seen.add(s.key);
      const el = elementFor(s);
      if (!isPlaying || !s.active || s.muted) { safePause(el); continue; }
      el.volume = Math.max(0, Math.min(1, s.volume * latest.current.masterVolume));
      el.playbackRate = clock.current.rate;
      const target = s.source_time_ms / 1000;
      if (el.paused) {
        try { el.currentTime = target; } catch (err) { console.warn('[EpisodeEditor] seek failed:', err?.message); }
        callPlay(el, s.label);
      } else if (Math.abs(el.currentTime - target) > AUDIO_DRIFT_S) {
        try { el.currentTime = target; } catch (err) { console.warn('[EpisodeEditor] seek failed:', err?.message); }
      }
    }
    for (const [key, el] of audio.current) if (!seen.has(key)) safePause(el);
  }, [elementFor]);

  const stopLoop = () => {
    if (clock.current.frame != null) cancelRaf(clock.current.frame);
    clock.current.frame = null;
  };

  const tick = useCallback(() => {
    const c = clock.current;
    if (!c.playing) return;
    const t = c.startT + (now() - c.startWall) * c.rate;
    const end = latest.current.duration;
    if (t >= end) {
      c.playing = false;
      setPlaying(false);
      setPlayhead(end);
      applySounds(end, false);
      c.frame = null;
      return;
    }
    const at = snapToFrame(t);
    setPlayhead(at);
    applySounds(at, true);
    c.frame = raf(tick);
  }, [now, raf, setPlayhead, applySounds]);

  const startAt = useCallback((t, r = clock.current.rate) => {
    const c = clock.current;
    stopLoop();
    c.startT = t;
    c.startWall = now();
    c.rate = r;
    c.playing = true;
    setPlaying(true);
    applySounds(t, true);
    c.frame = raf(tick);
  }, [now, raf, tick, applySounds]);

  const play = useCallback(() => {
    if (!(latest.current.duration > 0)) return;
    const from = latest.current.playhead >= latest.current.duration ? 0 : latest.current.playhead;
    startAt(from);
  }, [startAt]);

  const pause = useCallback(() => {
    const c = clock.current;
    c.playing = false;
    stopLoop();
    setPlaying(false);
    applySounds(latest.current.playhead, false);
  }, [applySounds]);

  const toggle = useCallback(() => (clock.current.playing ? pause() : play()), [play, pause]);

  /** L: play, then 2× (and back to 1×). */
  const faster = useCallback(() => {
    const next = clock.current.playing && clock.current.rate === 1 ? 2 : 1;
    setRate(next);
    startAt(clock.current.playing ? snapToFrame(clock.current.startT + (now() - clock.current.startWall) * clock.current.rate) : latest.current.playhead, next);
  }, [startAt, now]);

  /** A seek while playing carries on from the new time. */
  const restartAt = useCallback((t) => { if (clock.current.playing) startAt(t); }, [startAt]);

  // The master volume or a lane mute changes while playing: applied at once.
  useEffect(() => { if (clock.current.playing) applySounds(latest.current.playhead, true); }, [masterVolume, soundsAt, applySounds]);

  useEffect(() => () => {
    clock.current.playing = false;
    stopLoop();
    for (const el of audio.current.values()) {
      safePause(el);
      el.removeAttribute('src');
    }
    audio.current.clear();
  }, []);

  return { playing, rate: playing ? clock.current.rate : rate, play, pause, toggle, faster, restartAt, failed };
}

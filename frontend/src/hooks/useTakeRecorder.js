/**
 * The teleprompter's camera and recorder (Evoni, 2026-10-20: read the
 * script and record at the same time). While `enabled`, the front camera
 * and the microphone are open (getUserMedia, facingMode 'user'); begin()
 * starts a take, stop() ends it and the take ({ blob, url, type, seconds })
 * waits for review until discard(). Switching off, or leaving, stops the
 * recorder and releases every camera and microphone track.
 *
 * "Record whole episode" (Evoni, 2026-10-23): begin({ videoBitsPerSecond })
 * sets the bit rate; pause() and resume() pause the recording itself
 * (MediaRecorder.pause/resume), and takeTime() is the take's time so far
 * with paused time left out (the beat markers use it), as are `elapsed`
 * and the take's `seconds`. `bytes` is what has been recorded so far.
 *
 * Teleprompter audit (Evoni, 2026-10-24: "fix all of them"):
 *  - the recorder's one-second pieces go to IndexedDB as they arrive
 *    (lib/takeStore, under `storeKey`), and the take's Blob is built from
 *    there, so a long take is not held in memory and an unsaved take
 *    survives Back, a reload or a crash; restore() brings one back.
 *    Without IndexedDB (or when a write fails) the pieces stay in memory.
 *    discard() forgets the take there too; leaving without discard() keeps it.
 *    `finishing`: the take has stopped and its file is being put together.
 *  - begin({ maxBytes }): the take stops by itself at that size; `limited`.
 *  - the page hidden (screen locked, another app) pauses the take, and a
 *    camera or mic track that is muted or ends pauses it too: `interrupted`
 *    is 'away' | 'muted' | 'ended' until resume() (an ended track can't
 *    resume: the camera status says so, and the take can only be stopped).
 *  - note(meta): more about the take for the store (the beat markers).
 *
 * Rig mode (Evoni, 2026-10-28): `facingMode` picks the camera ('user', the
 * front one, by default; 'environment', the back one, for the phone behind
 * the glass); changing it opens that camera. `listener` hears the take as it
 * records, for saving while recording (hooks/useLiveUpload): onStart(id,
 * { type, tag }) when a take begins (tag: begin's own `tag`), onChunk(id,
 * seq, blob) for each piece, onStop(id) when it stops (its last piece came
 * just before), onDiscard(id) when a take is thrown away.
 *
 * Returns { camera: { status: 'off'|'starting'|'ready'|'error', message },
 * stream, recording, paused, finishing, interrupted, limited, elapsed, bytes,
 * take, error, begin, stop, pause, resume, takeTime, discard, restore, note,
 * retry }.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { recordingProblem, cameraErrorMessage, pickRecordType } from '../lib/teleprompterLines';
import { takeStore as sharedStore } from '../lib/takeStore';

const stopTracks = (stream) => {
  (stream?.getTracks?.() || []).forEach((t) => {
    try { t.stop(); } catch (err) { console.error('[useTakeRecorder] track did not stop:', err); }
  });
};

export const TRACK_ENDED = 'The camera or microphone stopped (another app may be using it). Stop & review to keep what was recorded, then Try again.';
export const TRACK_MUTED = 'The phone paused the camera or microphone. The take is paused.';

const newId = () => `take-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function useTakeRecorder(enabled, { storeKey = 'text', store = null, facingMode = 'user', listener = null } = {}) {
  const [camera, setCamera] = useState({ status: 'off', message: null });
  const [stream, setStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [interrupted, setInterrupted] = useState(null);
  const [limited, setLimited] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [take, setTake] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const startedRef = useRef(0);
  // Paused time so far, and when the pause now running began (0: none).
  const pausedMsRef = useRef(0);
  const pausedAtRef = useRef(0);
  const bytesRef = useRef(0);
  const takeRef = useRef(null);
  takeRef.current = take;
  const interruptedRef = useRef(null);
  // The take being recorded: its store id, the pieces not (yet) in the
  // store by seq, the store writes still running, whether the store has any.
  const idRef = useRef(null);
  const memRef = useRef(new Map());
  const writesRef = useRef([]);
  const keptRef = useRef(false);
  const seqRef = useRef(0);
  const storeRef = useRef(store);
  storeRef.current = store || sharedStore();
  const keyRef = useRef(storeKey);
  keyRef.current = storeKey;
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  // A listener that throws never stops the take.
  const tell = (what, ...args) => {
    try { listenerRef.current?.[what]?.(...args); } catch (err) { console.error(`[useTakeRecorder] ${what} listener failed:`, err); }
  };

  const forget = (id) => {
    if (!id) return;
    storeRef.current.remove(id).catch((err) => console.error('[useTakeRecorder] take not forgotten:', err));
  };

  const halt = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      try { rec.stop(); } catch (err) { console.error('[useTakeRecorder] recorder did not stop:', err); }
    }
    setRecording(false);
    setPaused(false);
  }, []);

  /** Seconds of take so far, paused time left out. */
  const takeTime = useCallback(() => {
    if (!startedRef.current) return 0;
    const now = Date.now();
    const pausedNow = pausedAtRef.current ? now - pausedAtRef.current : 0;
    return Math.max(0, (now - startedRef.current - pausedMsRef.current - pausedNow) / 1000);
  }, []);

  const revoke = (t) => {
    if (!t?.url) return;
    try { URL.revokeObjectURL(t.url); } catch (err) { console.error('[useTakeRecorder] take URL not revoked:', err); }
  };

  /** Throws the take away: its URL, and its copy in the store. A take still recording stops first. */
  const discard = useCallback(() => {
    if (recRef.current) {
      halt();
      tell('onDiscard', idRef.current);
      forget(idRef.current);
      idRef.current = null;
      memRef.current = new Map();
    }
    revoke(takeRef.current);
    if (takeRef.current?.id) tell('onDiscard', takeRef.current.id);
    forget(takeRef.current?.id);
    takeRef.current = null;
    setTake(null);
    setLimited(false);
    setInterrupted(null);
    interruptedRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halt]);

  useEffect(() => {
    if (!enabled) {
      halt();
      stopTracks(streamRef.current);
      streamRef.current = null;
      setStream(null);
      setCamera({ status: 'off', message: null });
      return undefined;
    }
    const problem = recordingProblem(window);
    if (problem) { setCamera({ status: 'error', message: problem }); return undefined; }
    let live = true;
    setCamera({ status: 'starting', message: null });
    navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true })
      .then((s) => {
        if (!live) { stopTracks(s); return; }
        streamRef.current = s;
        setStream(s);
        setCamera({ status: 'ready', message: null });
      })
      .catch((err) => {
        console.error('[useTakeRecorder] camera did not start:', err);
        if (live) setCamera({ status: 'error', message: cameraErrorMessage(err) });
      });
    return () => {
      live = false;
      // Another camera (front ↔ back): the one open now is let go first.
      if (!recRef.current && streamRef.current) {
        stopTracks(streamRef.current);
        streamRef.current = null;
      }
    };
  }, [enabled, attempt, halt, facingMode]);

  // Leaving: the recorder stops, the tracks are released, the take's URL
  // goes. The take's copy in the store stays: it is offered back next time.
  useEffect(() => () => {
    halt();
    stopTracks(streamRef.current);
    streamRef.current = null;
    revoke(takeRef.current);
  }, [halt]);

  useEffect(() => {
    if (!recording) return undefined;
    const t = setInterval(() => { setElapsed(takeTime()); setBytes(bytesRef.current); }, 250);
    return () => clearInterval(t);
  }, [recording, takeTime]);

  /** Pauses the recording (the take's time stops too); false when it can't. */
  const pause = useCallback(() => {
    const rec = recRef.current;
    if (!rec || rec.state !== 'recording' || typeof rec.pause !== 'function') return false;
    try { rec.pause(); } catch (err) {
      console.error('[useTakeRecorder] recorder did not pause:', err);
      return false;
    }
    pausedAtRef.current = Date.now();
    setElapsed(takeTime());
    setPaused(true);
    return true;
  }, [takeTime]);

  /** Carries the paused recording on; false when it can't (an ended camera can't). */
  const resume = useCallback(() => {
    const rec = recRef.current;
    if (!rec || !pausedAtRef.current || interruptedRef.current === 'ended') return false;
    try { if (rec.state === 'paused' && typeof rec.resume === 'function') rec.resume(); } catch (err) {
      console.error('[useTakeRecorder] recorder did not resume:', err);
      return false;
    }
    pausedMsRef.current += Date.now() - pausedAtRef.current;
    pausedAtRef.current = 0;
    interruptedRef.current = null;
    setInterrupted(null);
    setPaused(false);
    return true;
  }, []);

  const interrupt = useCallback((why) => {
    if (!recRef.current) return;
    if (recRef.current.state === 'recording') pause();
    // An ended track outranks a pause for being away.
    if (interruptedRef.current === 'ended') return;
    interruptedRef.current = why;
    setInterrupted(why);
  }, [pause]);

  // The screen locked or she switched apps: the take pauses (a recorder
  // left running there records black, or stops, depending on the phone).
  useEffect(() => {
    if (!recording) return undefined;
    const onVisibility = () => { if (document.visibilityState === 'hidden') interrupt('away'); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [recording, interrupt]);

  // A camera or mic track muted (a phone call, the OS) or ended (another app
  // took it): the take pauses and she is told, never a silently black preview.
  useEffect(() => {
    const tracks = (stream?.getTracks?.() || []).filter((t) => typeof t.addEventListener === 'function');
    if (!tracks.length) return undefined;
    const onEnded = () => {
      console.error('[useTakeRecorder] a camera or microphone track ended');
      if (recRef.current) {
        if (recRef.current.state === 'recording') pause();
        interruptedRef.current = 'ended';
        setInterrupted('ended');
      }
      setCamera({ status: 'error', message: TRACK_ENDED });
    };
    const onMute = () => {
      console.warn('[useTakeRecorder] a camera or microphone track was muted');
      interrupt('muted');
      setCamera((c) => (c.status === 'ready' ? { status: 'ready', message: TRACK_MUTED } : c));
    };
    const onUnmute = () => setCamera((c) => (c.status === 'ready' && c.message === TRACK_MUTED ? { status: 'ready', message: null } : c));
    tracks.forEach((t) => { t.addEventListener('ended', onEnded); t.addEventListener('mute', onMute); t.addEventListener('unmute', onUnmute); });
    return () => tracks.forEach((t) => { t.removeEventListener('ended', onEnded); t.removeEventListener('mute', onMute); t.removeEventListener('unmute', onUnmute); });
  }, [stream, interrupt, pause]);

  // The take's pieces in order: from the store, and any it could not keep.
  const assemble = async (id, kind) => {
    await Promise.all(writesRef.current);
    writesRef.current = [];
    const kept = id ? await storeRef.current.chunks(id) : [];
    const bySeq = new Map(kept.map((c) => [c.seq, c.data]));
    memRef.current.forEach((data, seq) => bySeq.set(seq, data));
    memRef.current = new Map();
    const parts = [...bySeq.entries()].sort((a, b) => a[0] - b[0]).map(([, d]) => d);
    return new Blob(parts, { type: kind });
  };

  /**
   * Starts a take now; false when it could not start. videoBitsPerSecond:
   * the bit rate, if set; maxBytes: it stops by itself at this size; meta:
   * what the store keeps with it (to review and save it after a reload).
   */
  const begin = useCallback(({ videoBitsPerSecond, maxBytes = 0, meta = {}, tag = null } = {}) => {
    if (!streamRef.current || recRef.current) return false;
    setError(null);
    const type = pickRecordType(window.MediaRecorder);
    const opts = { ...(type ? { mimeType: type } : {}), ...(videoBitsPerSecond ? { videoBitsPerSecond } : {}) };
    let rec;
    try {
      rec = new window.MediaRecorder(streamRef.current, Object.keys(opts).length ? opts : undefined);
    } catch (err) {
      console.error('[useTakeRecorder] recorder did not start:', err);
      setError("This browser couldn't start recording. You can still read.");
      return false;
    }
    const id = newId();
    const startedAt = Date.now(); // when the take began: its file names carry it
    const st = storeRef.current;
    idRef.current = id;
    memRef.current = new Map();
    writesRef.current = [];
    keptRef.current = false;
    seqRef.current = 0;
    bytesRef.current = 0;
    let stopping = false;
    if (st.available) {
      st.begin(id, { key: keyRef.current, type: rec.mimeType || type || 'video/webm', meta })
        .catch((err) => console.error('[useTakeRecorder] take not kept on this device:', err));
    }
    rec.ondataavailable = (e) => {
      if (!e.data || !e.data.size) return;
      const seq = seqRef.current;
      seqRef.current += 1;
      memRef.current.set(seq, e.data);
      bytesRef.current += e.data.size;
      tell('onChunk', id, seq, e.data);
      if (st.available) {
        const w = st.addChunk(id, seq, e.data, Math.round(takeTime() * 10) / 10)
          .then((ok) => { if (ok) { memRef.current.delete(seq); keptRef.current = true; } })
          .catch((err) => console.error('[useTakeRecorder] piece not kept on this device:', err));
        writesRef.current.push(w);
      }
      // The size limit: the take stops here, what was recorded is kept.
      if (maxBytes && bytesRef.current >= maxBytes && !stopping && rec.state !== 'inactive') {
        stopping = true;
        setLimited(true);
        try { rec.stop(); } catch (err) { console.error('[useTakeRecorder] recorder did not stop at the limit:', err); }
      }
    };
    rec.onstop = () => {
      tell('onStop', id);
      const kind = rec.mimeType || type || 'video/webm';
      recRef.current = null;
      const seconds = takeTime();
      startedRef.current = 0;
      pausedAtRef.current = 0;
      setRecording(false);
      setPaused(false);
      const show = (blob) => {
        setFinishing(false);
        if (!blob.size) { forget(id); setError('Nothing was recorded. Try the take again.'); return; }
        const next = { blob, url: URL.createObjectURL(blob), type: kind, seconds, id, startedAt };
        takeRef.current = next;
        setTake(next);
        if (st.available) st.update(id, { finished: true, seconds }).catch((err) => console.error('[useTakeRecorder] take not marked finished:', err));
      };
      // Nothing in the store (none there, or none written yet): at once, from memory.
      if (!st.available || (!keptRef.current && !writesRef.current.length)) {
        const parts = [...memRef.current.entries()].sort((a, b) => a[0] - b[0]).map(([, d]) => d);
        memRef.current = new Map();
        show(new Blob(parts, { type: kind }));
        return;
      }
      setFinishing(true);
      assemble(id, kind).then(show).catch((err) => {
        console.error('[useTakeRecorder] take not put together:', err);
        setFinishing(false);
        setError('The take could not be put together. Try the take again.');
      });
    };
    rec.onerror = (e) => {
      console.error('[useTakeRecorder] recorder error:', e?.error || e);
      setError('Recording stopped with an error. Try the take again.');
    };
    try {
      rec.start(1000);
    } catch (err) {
      console.error('[useTakeRecorder] recorder did not start:', err);
      setError("This browser couldn't start recording. You can still read.");
      forget(id);
      return false;
    }
    recRef.current = rec;
    tell('onStart', id, { type: rec.mimeType || type || 'video/webm', tag });
    startedRef.current = Date.now();
    pausedMsRef.current = 0;
    pausedAtRef.current = 0;
    interruptedRef.current = null;
    setInterrupted(null);
    setLimited(false);
    setElapsed(0);
    setBytes(0);
    setPaused(false);
    setRecording(true);
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeTime]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec || rec.state === 'inactive') return;
    try { rec.stop(); } catch (err) {
      console.error('[useTakeRecorder] recorder did not stop:', err);
      recRef.current = null;
      setRecording(false);
    }
  }, []);

  /** More about the take being recorded, for the store (the beat markers). */
  const note = useCallback((meta) => {
    const id = idRef.current;
    if (!id || !storeRef.current.available) return;
    storeRef.current.update(id, { meta }).catch((err) => console.error('[useTakeRecorder] take notes not kept:', err));
  }, []);

  /**
   * Brings back a take the store kept (lib/takeStore unsaved()): it opens
   * for review as if just recorded. Resolves the take, or null.
   */
  const restore = useCallback(async (saved) => {
    if (!saved?.id) return null;
    try {
      const parts = await storeRef.current.chunks(saved.id);
      if (!parts.length) { forget(saved.id); return null; }
      const kind = saved.type || 'video/webm';
      const blob = new Blob(parts.map((p) => p.data), { type: kind });
      revoke(takeRef.current);
      const seconds = Number(saved.seconds) > 0 ? Number(saved.seconds) : Number(saved.lastT) || parts.length;
      const next = { blob, url: URL.createObjectURL(blob), type: kind, seconds, id: saved.id, restored: true, startedAt: saved.startedAt || null };
      takeRef.current = next;
      setTake(next);
      setError(null);
      return next;
    } catch (err) {
      console.error('[useTakeRecorder] take not brought back:', err);
      setError('That take could not be opened.');
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Try again opens the camera afresh; never while a take is recording on the old one.
  const retry = useCallback(() => { if (!recRef.current) setAttempt((n) => n + 1); }, []);

  return {
    camera, stream, recording, paused, finishing, interrupted, limited, elapsed, bytes, take, error,
    begin, stop, pause, resume, takeTime, discard, restore, note, retry,
  };
}

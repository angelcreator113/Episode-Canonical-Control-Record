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
 * Returns { camera: { status: 'off'|'starting'|'ready'|'error', message },
 * stream, recording, paused, elapsed, bytes, take, error, begin, stop,
 * pause, resume, takeTime, discard, retry }.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { recordingProblem, cameraErrorMessage, pickRecordType } from '../lib/teleprompterLines';

const stopTracks = (stream) => {
  (stream?.getTracks?.() || []).forEach((t) => {
    try { t.stop(); } catch (err) { console.error('[useTakeRecorder] track did not stop:', err); }
  });
};

export default function useTakeRecorder(enabled) {
  const [camera, setCamera] = useState({ status: 'off', message: null });
  const [stream, setStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [take, setTake] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const startedRef = useRef(0);
  // Paused time so far, and when the pause now running began (0: none).
  const pausedMsRef = useRef(0);
  const pausedAtRef = useRef(0);
  const bytesRef = useRef(0);
  const takeRef = useRef(null);
  takeRef.current = take;

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

  const discard = useCallback(() => {
    if (takeRef.current?.url) {
      try { URL.revokeObjectURL(takeRef.current.url); } catch (err) { console.error('[useTakeRecorder] take URL not revoked:', err); }
    }
    takeRef.current = null;
    setTake(null);
  }, []);

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
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true })
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
    return () => { live = false; };
  }, [enabled, attempt, halt]);

  // Leaving: the recorder stops, the tracks are released, the take's URL goes.
  useEffect(() => () => {
    halt();
    stopTracks(streamRef.current);
    streamRef.current = null;
    if (takeRef.current?.url) {
      try { URL.revokeObjectURL(takeRef.current.url); } catch (err) { console.error('[useTakeRecorder] take URL not revoked:', err); }
    }
  }, [halt]);

  useEffect(() => {
    if (!recording) return undefined;
    const t = setInterval(() => { setElapsed(takeTime()); setBytes(bytesRef.current); }, 250);
    return () => clearInterval(t);
  }, [recording, takeTime]);

  /** Starts a take now; false when it could not start. videoBitsPerSecond: the bit rate, if set. */
  const begin = useCallback(({ videoBitsPerSecond } = {}) => {
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
    chunksRef.current = [];
    bytesRef.current = 0;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) { chunksRef.current.push(e.data); bytesRef.current += e.data.size; } };
    rec.onstop = () => {
      const kind = rec.mimeType || type || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: kind });
      chunksRef.current = [];
      recRef.current = null;
      const seconds = takeTime();
      startedRef.current = 0;
      pausedAtRef.current = 0;
      setRecording(false);
      setPaused(false);
      if (!blob.size) { setError('Nothing was recorded. Try the take again.'); return; }
      const next = { blob, url: URL.createObjectURL(blob), type: kind, seconds };
      takeRef.current = next;
      setTake(next);
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
      return false;
    }
    recRef.current = rec;
    startedRef.current = Date.now();
    pausedMsRef.current = 0;
    pausedAtRef.current = 0;
    setElapsed(0);
    setBytes(0);
    setPaused(false);
    setRecording(true);
    return true;
  }, [takeTime]);

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

  /** Carries the paused recording on. */
  const resume = useCallback(() => {
    const rec = recRef.current;
    if (!rec || !pausedAtRef.current) return false;
    try { if (rec.state === 'paused' && typeof rec.resume === 'function') rec.resume(); } catch (err) {
      console.error('[useTakeRecorder] recorder did not resume:', err);
      return false;
    }
    pausedMsRef.current += Date.now() - pausedAtRef.current;
    pausedAtRef.current = 0;
    setPaused(false);
    return true;
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec || rec.state === 'inactive') return;
    try { rec.stop(); } catch (err) {
      console.error('[useTakeRecorder] recorder did not stop:', err);
      recRef.current = null;
      setRecording(false);
    }
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { camera, stream, recording, paused, elapsed, bytes, take, error, begin, stop, pause, resume, takeTime, discard, retry };
}

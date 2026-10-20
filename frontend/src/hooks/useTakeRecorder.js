/**
 * The teleprompter's camera and recorder (Evoni, 2026-10-20: read the
 * script and record at the same time). While `enabled`, the front camera
 * and the microphone are open (getUserMedia, facingMode 'user'); begin()
 * starts a take, stop() ends it and the take ({ blob, url, type, seconds })
 * waits for review until discard(). Switching off, or leaving, stops the
 * recorder and releases every camera and microphone track.
 *
 * Returns { camera: { status: 'off'|'starting'|'ready'|'error', message },
 * stream, recording, elapsed, take, error, begin, stop, discard, retry }.
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
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const startedRef = useRef(0);
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
    const t = setInterval(() => setElapsed((Date.now() - startedRef.current) / 1000), 250);
    return () => clearInterval(t);
  }, [recording]);

  /** Starts a take now; false when it could not start. */
  const begin = useCallback(() => {
    if (!streamRef.current || recRef.current) return false;
    setError(null);
    const type = pickRecordType(window.MediaRecorder);
    let rec;
    try {
      rec = new window.MediaRecorder(streamRef.current, type ? { mimeType: type } : undefined);
    } catch (err) {
      console.error('[useTakeRecorder] recorder did not start:', err);
      setError("This browser couldn't start recording. You can still read.");
      return false;
    }
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const kind = rec.mimeType || type || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: kind });
      chunksRef.current = [];
      recRef.current = null;
      setRecording(false);
      if (!blob.size) { setError('Nothing was recorded. Try the take again.'); return; }
      const next = { blob, url: URL.createObjectURL(blob), type: kind, seconds: (Date.now() - startedRef.current) / 1000 };
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
    setElapsed(0);
    setRecording(true);
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

  return { camera, stream, recording, elapsed, take, error, begin, stop, discard, retry };
}

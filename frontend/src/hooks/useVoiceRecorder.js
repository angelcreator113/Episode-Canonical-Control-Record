/**
 * A voice clip's recorder (Teleprompter batch 3; Evoni, 2026-10-20): the
 * microphone only, opened when start() is pressed and released when the
 * take stops, so nothing stays live between lines.
 *
 * Returns { status: 'idle'|'starting'|'recording'|'review'|'error', error,
 * elapsed, take: { blob, url, type, seconds } | null, start, stop, discard }.
 * The take waits for review until discard(); leaving releases everything.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { pickVoiceType, voiceProblem, micErrorMessage } from '../lib/voiceClipsApi';

const stopTracks = (stream) => {
  (stream?.getTracks?.() || []).forEach((t) => {
    try { t.stop(); } catch (err) { console.error('[useVoiceRecorder] track did not stop:', err); }
  });
};

export default function useVoiceRecorder() {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const startedRef = useRef(0);
  const takeRef = useRef(null);
  const liveRef = useRef(true);

  const revoke = (t) => {
    if (!t?.url) return;
    try { URL.revokeObjectURL(t.url); } catch (err) { console.error('[useVoiceRecorder] take URL not revoked:', err); }
  };

  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
      const rec = recRef.current;
      recRef.current = null;
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null;
        try { rec.stop(); } catch (err) { console.error('[useVoiceRecorder] recorder did not stop:', err); }
      }
      stopTracks(streamRef.current);
      streamRef.current = null;
      revoke(takeRef.current);
    };
  }, []);

  useEffect(() => {
    if (status !== 'recording') return undefined;
    const t = setInterval(() => setElapsed((Date.now() - startedRef.current) / 1000), 200);
    return () => clearInterval(t);
  }, [status]);

  const fail = (message) => {
    stopTracks(streamRef.current);
    streamRef.current = null;
    recRef.current = null;
    setError(message);
    setStatus('error');
  };

  /** Opens the microphone and starts recording. */
  const start = useCallback(async () => {
    if (recRef.current) return false;
    const problem = voiceProblem(window);
    if (problem) { fail(problem); return false; }
    revoke(takeRef.current);
    takeRef.current = null;
    setTake(null);
    setError(null);
    setStatus('starting');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('[useVoiceRecorder] microphone did not start:', err);
      if (liveRef.current) fail(micErrorMessage(err));
      return false;
    }
    if (!liveRef.current) { stopTracks(stream); return false; }
    streamRef.current = stream;
    const type = pickVoiceType(window.MediaRecorder);
    let rec;
    try {
      rec = new window.MediaRecorder(stream, type ? { mimeType: type } : undefined);
    } catch (err) {
      console.error('[useVoiceRecorder] recorder did not start:', err);
      fail("This browser couldn't start recording.");
      return false;
    }
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const kind = rec.mimeType || type || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: kind });
      chunksRef.current = [];
      recRef.current = null;
      stopTracks(streamRef.current);
      streamRef.current = null;
      if (!liveRef.current) return;
      if (!blob.size) { setError('Nothing was recorded. Try again.'); setStatus('error'); return; }
      const next = { blob, url: URL.createObjectURL(blob), type: kind, seconds: Math.max(0.1, (Date.now() - startedRef.current) / 1000) };
      takeRef.current = next;
      setTake(next);
      setStatus('review');
    };
    rec.onerror = (e) => {
      console.error('[useVoiceRecorder] recorder error:', e?.error || e);
      if (liveRef.current) setError('Recording stopped with an error. Try again.');
    };
    try {
      rec.start(250);
    } catch (err) {
      console.error('[useVoiceRecorder] recorder did not start:', err);
      fail("This browser couldn't start recording.");
      return false;
    }
    recRef.current = rec;
    startedRef.current = Date.now();
    setElapsed(0);
    setStatus('recording');
    return true;
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec || rec.state === 'inactive') return;
    try { rec.stop(); } catch (err) {
      console.error('[useVoiceRecorder] recorder did not stop:', err);
      fail('Recording stopped with an error. Try again.');
    }
  }, []);

  const discard = useCallback(() => {
    revoke(takeRef.current);
    takeRef.current = null;
    setTake(null);
    setError(null);
    setStatus('idle');
  }, []);

  return { status, error, elapsed, take, start, stop, discard };
}

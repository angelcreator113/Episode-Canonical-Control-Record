/**
 * Follow my voice (Evoni, 2026-10-20): while `enabled`, the browser's speech
 * recognition (SpeechRecognition / webkitSpeechRecognition; continuous, with
 * interim results, in the browser's language) hands each newly heard word
 * to onHeard(words). It restarts itself when the browser ends a session
 * after a silence, and stops on pause, on close, or on an error that won't
 * clear by itself (blocked microphone). Returns { supported, listening, error }.
 */
import { useState, useEffect, useRef } from 'react';
import { speechRecognition, speechErrorMessage } from '../lib/voiceFollow';

const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported']);

export default function useVoiceFollow(enabled, { onHeard, recording = false } = {}) {
  const supported = !!speechRecognition();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const onHeardRef = useRef(onHeard);
  onHeardRef.current = onHeard;
  const recordingRef = useRef(recording);
  recordingRef.current = recording;

  useEffect(() => {
    const Ctor = speechRecognition();
    if (!enabled || !Ctor) { setListening(false); return undefined; }
    let live = true;
    let fatal = false;
    let rec = null;
    let again = null;
    const start = () => {
      if (!live) return;
      const consumed = [];
      try {
        rec = new Ctor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
        rec.onstart = () => { if (live) setListening(true); };
        rec.onresult = (e) => {
          const heard = [];
          for (let i = e.resultIndex || 0; i < e.results.length; i += 1) {
            const words = String(e.results[i]?.[0]?.transcript || '').trim().split(/\s+/).filter(Boolean);
            const done = consumed[i] || 0;
            if (words.length > done) { heard.push(...words.slice(done)); consumed[i] = words.length; }
          }
          if (heard.length) onHeardRef.current?.(heard);
        };
        rec.onerror = (e) => {
          const message = speechErrorMessage(e?.error, { recording: recordingRef.current });
          if (!message) return;
          console.error('[useVoiceFollow] recognition error:', e?.error);
          if (FATAL.has(e?.error)) fatal = true;
          if (live) setError(message);
        };
        // The browser ends a session after a silence; it starts again while on.
        rec.onend = () => {
          if (!live) return;
          setListening(false);
          if (!fatal) again = window.setTimeout(start, 250);
        };
        rec.start();
      } catch (err) {
        console.error('[useVoiceFollow] recognition did not start:', err);
        if (live) setError('Follow my voice could not start in this browser.');
      }
    };
    setError(null);
    start();
    return () => {
      live = false;
      window.clearTimeout(again);
      if (rec) {
        rec.onend = null;
        try { if (typeof rec.abort === 'function') rec.abort(); else rec.stop(); } catch (err) { console.error('[useVoiceFollow] recognition did not stop:', err); }
      }
      setListening(false);
    };
  }, [enabled]);

  return { supported, listening, error };
}

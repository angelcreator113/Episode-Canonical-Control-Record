/**
 * The microphone's level, 0 to 1, from an AnalyserNode on `stream` (the
 * teleprompter's recording stream, or its own while Follow my voice is on;
 * Evoni, 2026-10-20). 0 without a stream or without Web Audio.
 */
import { useState, useEffect } from 'react';

export default function useMicLevel(stream) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream) { setLevel(0); return undefined; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return undefined;
    let ctx;
    let src;
    let analyser;
    try {
      ctx = new AC();
      src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const resumed = ctx.resume?.();
      if (resumed?.catch) resumed.catch((err) => console.error('[useMicLevel] audio did not resume:', err));
    } catch (err) {
      console.error('[useMicLevel] meter did not start:', err);
      return undefined;
    }
    const buf = new Uint8Array(analyser.fftSize);
    const t = window.setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i += 1) { const x = (buf[i] - 128) / 128; sum += x * x; }
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
    }, 100);
    return () => {
      window.clearInterval(t);
      try { src.disconnect(); } catch (err) { console.error('[useMicLevel] source did not disconnect:', err); }
      try {
        const closed = ctx.close?.();
        if (closed?.catch) closed.catch((err) => console.error('[useMicLevel] audio did not close:', err));
      } catch (err) { console.error('[useMicLevel] audio did not close:', err); }
    };
  }, [stream]);
  return level;
}

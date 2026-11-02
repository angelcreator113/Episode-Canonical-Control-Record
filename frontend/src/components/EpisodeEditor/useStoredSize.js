/**
 * A panel size the person drags with a splitter, kept in this browser
 * (localStorage; a per-viewer convenience, so a failed read or write just
 * falls back to the default). Timeline Editor redesign P1, plan §3.1.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function readStored(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch (err) {
    console.warn(`[EpisodeEditor] could not read ${key}:`, err?.message);
    return fallback;
  }
}

export function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[EpisodeEditor] could not keep ${key}:`, err?.message);
  }
}

/**
 * [size, setSize, startDrag, reset]. startDrag(event, { axis, sign, scale })
 * follows the pointer: axis 'x' or 'y'; sign -1 when dragging toward the
 * start grows the panel (a right-hand panel); scale turns pixels into the
 * size's unit (1 for px, 1/height for a ratio).
 */
export default function useStoredSize(key, initial, { min, max }) {
  const [size, setSizeState] = useState(() => {
    const v = Number(readStored(key, initial));
    return Number.isFinite(v) ? clamp(v, min, max) : initial;
  });
  const sizeRef = useRef(size);
  useEffect(() => { sizeRef.current = size; }, [size]);

  const setSize = useCallback((v) => {
    const next = clamp(v, min, max);
    setSizeState(next);
    writeStored(key, next);
  }, [key, min, max]);

  const startDrag = useCallback((event, { axis = 'x', sign = 1, scale = 1 } = {}) => {
    event.preventDefault();
    const from = axis === 'x' ? event.clientX : event.clientY;
    const start = sizeRef.current;
    const move = (e) => {
      const now = axis === 'x' ? e.clientX : e.clientY;
      setSizeState(clamp(start + (now - from) * sign * scale, min, max));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      writeStored(key, sizeRef.current);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [key, min, max]);

  const reset = useCallback(() => setSize(initial), [setSize, initial]);
  return [size, setSize, startDrag, reset];
}

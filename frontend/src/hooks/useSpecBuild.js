/**
 * Building a scene spec (audit SCENE-04, 2026-10-03). The server does one
 * request to Claude Vision and reports no stages, so the page shows what it
 * knows: that the request is in flight, and for how long. No timers
 * pretend to know which step the model is on, an error stays on screen
 * until the next attempt, and nothing fires after the card is gone.
 */
import { useState, useRef, useEffect, useCallback } from 'react';

export const specBuiltText = (spec, force) =>
  `Scene spec ${force ? 'rebuilt' : 'built'}: ${spec?.objects?.length || 0} objects · ${spec?.zones?.length || 0} zones · ${spec?.camera_contracts?.length || 0} camera contracts`;

/**
 * @param {{ request: (payload: object) => Promise<{ data: object }>, onToast?: Function, onRefresh?: Function }} opts
 * @returns {{ status: 'idle'|'building'|'done'|'error', building: boolean, elapsed: number, error: string|null, build: (payload?: object) => Promise<object> }}
 */
export default function useSpecBuild({ request, onToast, onRefresh }) {
  const [status, setStatus] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const tick = useRef(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; clearInterval(tick.current); tick.current = null; }, []);

  const build = useCallback(async (payload = {}) => {
    if (tick.current) return null; // one build at a time
    setStatus('building'); setError(null); setElapsed(0);
    const started = Date.now();
    tick.current = setInterval(() => { if (alive.current) setElapsed(Math.round((Date.now() - started) / 1000)); }, 1000);
    try {
      const r = await request(payload);
      const d = r?.data || {};
      if (!alive.current) return d;
      if (d.success) {
        setStatus('done');
        onToast?.(specBuiltText(d.data, Boolean(payload.force)));
        if (onRefresh) await onRefresh();
      } else {
        setStatus('error'); setError(d.error || 'Failed');
        onToast?.(d.error || 'Failed', 'error');
      }
      return d;
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Failed';
      if (alive.current) { setStatus('error'); setError(msg); onToast?.(msg, 'error'); }
      return { success: false, error: msg };
    } finally {
      clearInterval(tick.current); tick.current = null;
    }
  }, [request, onToast, onRefresh]);

  return { status, building: status === 'building', elapsed, error, build };
}

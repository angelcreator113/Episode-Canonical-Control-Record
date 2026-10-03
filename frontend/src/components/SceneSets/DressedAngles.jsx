/**
 * S8 (Evoni, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(dd)), answer 2:
 * "Dressed angles move onto the look in the panel." For an event's finished
 * look on a set (L10), each of the set's angles with its dressed version:
 * "Generate dressed" shows the brief and its cost first (S2) and makes one
 * Kontext edit of the look; "Upload" stores an image as the dressed angle.
 * Reads GET /episode-brief/:episodeId/dressed-angles?scene_set_id=.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import SceneBriefConfirm from '../SceneBriefConfirm';
import './DressedAngles.css';

// While an angle is dressing, the list refreshes every pollMs until each one
// is done or failed. The server has no stuck timeout for a dressed angle, so
// after POLL_MAX refreshes it stops and offers Refresh instead.
export const POLL_MS = 4000;
export const POLL_MAX = 150;

const isGenerating = (a) => a.dressed?.status === 'generating';

export default function DressedAngles({ episodeId, setId, onToast, pollMs = POLL_MS }) {
  const [data, setData] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [asking, setAsking] = useState(null); // the angle whose brief is open
  const [busy, setBusy] = useState(null);
  const [pollingStopped, setPollingStopped] = useState(false);
  const base = `/api/v1/episode-brief/${episodeId}/dressed-angles`;
  const last = useRef(null);
  const toastRef = useRef(onToast);
  toastRef.current = onToast;

  // Says when an angle this list saw dressing finishes or fails.
  const announce = (prev, next) => {
    const before = new Map((prev?.angles || []).map((a) => [a.id, a]));
    for (const a of next?.angles || []) {
      if (!isGenerating(before.get(a.id) || {})) continue;
      const name = a.name || a.label;
      if (a.dressed?.status === 'complete') toastRef.current?.(`${name} is dressed`);
      if (a.dressed?.status === 'failed') toastRef.current?.(`${name} could not be dressed${a.dressed.error ? `: ${a.dressed.error}` : ''}`, 'error');
    }
  };

  // A failed refresh keeps what is shown; only a first load that fails says so.
  const load = useCallback(async () => {
    try {
      const res = await api.get(`${base}?scene_set_id=${setId}`);
      const next = res.data?.data || { look: null, angles: [] };
      if (last.current) announce(last.current, next);
      last.current = next;
      setData(next);
      setLoadFailed(false);
      return next;
    } catch (err) {
      console.error('[DressedAngles] load failed:', err);
      if (!last.current) setLoadFailed(true);
      return null;
    }
  }, [base, setId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const generating = Boolean(data?.angles?.some(isGenerating));
  useEffect(() => {
    if (!generating) return undefined;
    setPollingStopped(false);
    let polls = 0;
    const timer = setInterval(async () => {
      polls += 1;
      const next = await load();
      if (next && !next.angles.some(isGenerating)) clearInterval(timer);
      else if (polls >= POLL_MAX) { clearInterval(timer); setPollingStopped(true); }
    }, pollMs);
    return () => clearInterval(timer);
  }, [generating, load, pollMs]);

  const generate = async (overrides) => {
    const angle = asking;
    setAsking(null);
    setBusy(angle.id);
    try {
      await api.post(`${base}/${angle.id}/generate`, { overrides });
      onToast?.(`Dressing ${angle.name || angle.label} from the event's look`);
    } catch (err) {
      console.error('[DressedAngles] generate failed:', err);
      onToast?.(err.response?.data?.error || 'Could not dress the angle', 'error');
    }
    setBusy(null);
    await load();
  };

  const upload = async (angle, file) => {
    setBusy(angle.id);
    try {
      const form = new FormData();
      form.append('images', file);
      await api.post(`${base}/${angle.id}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      onToast?.(`${angle.name || angle.label}: dressed image uploaded`);
    } catch (err) {
      console.error('[DressedAngles] upload failed:', err);
      onToast?.(err.response?.data?.error || 'Upload failed', 'error');
    }
    setBusy(null);
    await load();
  };

  if (loadFailed) {
    return (
      <p className="dressed-angles-note is-error" data-testid="dressed-angles-load-failed">
        Couldn't load the dressed angles.{' '}
        <button type="button" className="dressed-angles-link" onClick={() => load()}>Try again</button>
      </p>
    );
  }
  if (!data) return <p className="dressed-angles-note" data-testid="dressed-angles-loading">Loading dressed angles…</p>;
  if (!data.look) return <p className="dressed-angles-note">Dressed angles are made once this look is ready.</p>;
  return (
    <div className="dressed-angles" data-testid={`dressed-angles-${setId}`}>
      <span className="dressed-angles-label">Dressed angles</span>
      {pollingStopped && generating && (
        <p className="dressed-angles-note" data-testid="dressed-angles-stale">
          Still dressing after several minutes.{' '}
          <button type="button" className="dressed-angles-link" onClick={() => load()}>Refresh</button>
        </p>
      )}
      <ul>
        {data.angles.map((a) => {
          const name = a.name || a.label;
          const status = a.dressed?.status || null;
          const img = status === 'complete' ? a.dressed.image_url : null;
          return (
            <li key={a.id} data-testid={`dressed-angle-${a.id}`} className={status ? `is-${status}` : undefined}>
              {img ? <img src={img} alt="" /> : <span className="dressed-angles-empty" aria-hidden="true" />}
              <span className="dressed-angles-name">{name}</span>
              <span className="dressed-angles-status" data-testid={`dressed-angle-status-${a.id}`}>
                {status === 'generating' && <span className="dressed-angles-spin" aria-hidden="true" />}
                {status === 'generating' ? 'Dressing…'
                  : status === 'complete' ? 'Dressed'
                    : status === 'failed' ? `Failed${a.dressed.error ? `: ${a.dressed.error}` : ''}`
                      : status || 'Not dressed yet'}
              </span>
              <span className="dressed-angles-actions">
                <button type="button" disabled={busy === a.id || status === 'generating'} onClick={() => setAsking(a)}>
                  {status === 'failed' ? 'Try again' : status === 'complete' ? 'Redo dressed' : 'Generate dressed'}
                </button>
                <label className="dressed-angles-upload">
                  Upload
                  <input type="file" accept="image/*" hidden aria-label={`Upload the dressed ${name}`} disabled={busy === a.id}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(a, f); }} />
                </label>
              </span>
            </li>
          );
        })}
      </ul>
      {asking && (
        <SceneBriefConfirm
          setId={setId}
          angleId={asking.id}
          title={`Dress “${asking.name || asking.label}” from the event's look`}
          note="Made from the event's look: the same dressed room, from this angle."
          requestBrief={(body) => api.post(`${base}/${asking.id}/brief`, { overrides: body.overrides })}
          onConfirm={(overrides) => generate(overrides)}
          onCancel={() => setAsking(null)}
        />
      )}
    </div>
  );
}

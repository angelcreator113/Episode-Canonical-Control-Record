/**
 * S8 (Evoni, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(dd)), answer 2:
 * "Dressed angles move onto the look in the panel." For an event's finished
 * look on a set (L10), each of the set's angles with its dressed version:
 * "Generate dressed" shows the brief and its cost first (S2) and makes one
 * Kontext edit of the look; "Upload" stores an image as the dressed angle.
 * Reads GET /episode-brief/:episodeId/dressed-angles?scene_set_id=.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import SceneBriefConfirm from '../SceneBriefConfirm';
import './DressedAngles.css';

const STATUS = { generating: 'Dressing…', failed: 'Failed', complete: 'Dressed' };

export default function DressedAngles({ episodeId, setId, onToast }) {
  const [data, setData] = useState(null);
  const [asking, setAsking] = useState(null); // the angle whose brief is open
  const [busy, setBusy] = useState(null);
  const base = `/api/v1/episode-brief/${episodeId}/dressed-angles`;

  const load = useCallback(async () => {
    try {
      const res = await api.get(`${base}?scene_set_id=${setId}`);
      setData(res.data?.data || { look: null, angles: [] });
    } catch (err) {
      console.error('[DressedAngles] load failed:', err);
      setData({ look: null, angles: [] });
    }
  }, [base, setId]);

  useEffect(() => { load(); }, [load]);

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

  if (!data) return null;
  if (!data.look) return <p className="dressed-angles-note">Dressed angles are made once this look is ready.</p>;
  return (
    <div className="dressed-angles" data-testid={`dressed-angles-${setId}`}>
      <span className="dressed-angles-label">Dressed angles</span>
      <ul>
        {data.angles.map((a) => {
          const name = a.name || a.label;
          const img = a.dressed?.status === 'complete' ? a.dressed.image_url : null;
          return (
            <li key={a.id} data-testid={`dressed-angle-${a.id}`}>
              {img ? <img src={img} alt="" /> : <span className="dressed-angles-empty" aria-hidden="true" />}
              <span className="dressed-angles-name">{name}</span>
              <span className="dressed-angles-status">{a.dressed ? STATUS[a.dressed.status] || a.dressed.status : 'Not dressed yet'}</span>
              <span className="dressed-angles-actions">
                <button type="button" disabled={busy === a.id || a.dressed?.status === 'generating'} onClick={() => setAsking(a)}>Generate dressed</button>
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

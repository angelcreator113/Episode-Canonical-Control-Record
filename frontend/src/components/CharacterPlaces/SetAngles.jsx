/**
 * A place's (or an event's) photos as one set, on the character's Places tab
 * (2026-10-17): its main photo and its angles, and "Add angles", which adds
 * the photos to this same set.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import api from '../../services/api';
import { addAngles } from './setPhotos';

export default function SetAngles({ setId, onNote, label = 'Angles' }) {
  const [set, setSet] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/scene-sets/${setId}`);
      setSet(res.data?.data || null);
    } catch (err) {
      console.error('[SetAngles] set read failed:', err);
      setSet({ error: true });
    }
  }, [setId]);
  useEffect(() => { load(); }, [load]);

  const add = async (files) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const { done, failed } = await addAngles(setId, files, (set?.angles || []).map((a) => a.angle_label));
      if (done) onNote?.({ text: `Added ${done} angle${done === 1 ? '' : 's'} to ${set?.name || 'the set'}` });
      if (failed.length) onNote?.({ error: true, text: `Could not add ${failed.join(', ')}` });
      await load();
    } finally { setBusy(false); }
  };

  if (!set) return <p className="cpl-note">Loading the photos…</p>;
  if (set.error) return <p className="cpl-note is-error">Could not load this set&rsquo;s photos.</p>;
  const angles = (set.angles || []).filter((a) => a.still_image_url);
  return (
    <div className="cpl-angles" data-testid={`set-angles-${setId}`}>
      <span className="cpl-angles-label">{label} · {angles.length}</span>
      {angles.length > 0 && (
        <ul className="cpl-angle-grid">
          {angles.map((a) => (
            <li key={a.id} className="cpl-angle"><img src={a.still_image_url} alt={a.angle_name || a.angle_label} /><span>{a.angle_name || a.angle_label}</span></li>
          ))}
        </ul>
      )}
      <button type="button" className="cpl-btn is-soft is-small" disabled={busy} onClick={() => fileInput.current?.click()} data-testid={`set-angles-add-${setId}`}>
        <ImagePlus size={14} aria-hidden="true" /> {busy ? 'Adding…' : 'Add angles'}
      </button>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-testid={`set-angles-input-${setId}`}
        onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ''; add(files); }} />
    </div>
  );
}

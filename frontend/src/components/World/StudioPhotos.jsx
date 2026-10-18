/**
 * A studio's photos from its card on Universe › Locations (Evoni,
 * 2026-10-18: "start a studio's photos from its card"). Add photos makes one
 * scene set from the photos chosen (the first its main photo, the others its
 * angles) tied to this location, and links it as the resident's place of
 * work, so it shows on their Places tab and scenes can use it. A link to
 * the resident's Places tab is always there.
 */
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { makeSetFromPhotos, removeSet } from '../CharacterPlaces/setPhotos';
import './StudioPhotos.css';

export default function StudioPhotos({ location, showId, onDone }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const resident = (location.residents || []).find((r) => r.character_id) || null;

  const upload = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    setNote(null);
    let made = null;
    try {
      made = await makeSetFromPhotos({ name: location.name, sceneType: 'OTHER', showId, files, worldLocationId: location.id });
      let linked = false;
      if (resident) {
        try {
          await api.post(`/api/v1/shows/${showId}/character-places`, { character_id: resident.character_id, scene_set_id: made.setId, role: 'work' });
          linked = true;
        } catch (linkErr) {
          console.error('[StudioPhotos] linking it as their place of work failed:', linkErr);
        }
      }
      const { done, failed } = made.angles;
      setNote({
        error: failed.length > 0,
        text: `Photos added${done ? ` with ${done} angle${done === 1 ? '' : 's'}` : ''}${linked ? `, as ${resident.display_name || resident.handle}'s place of work` : ''}.${failed.length ? ` Could not add ${failed.join(', ')}.` : ''}`,
      });
      onDone?.();
    } catch (err) {
      console.error('[StudioPhotos] making the photos failed:', err);
      if (made?.setId) await removeSet(made.setId);
      setNote({ error: true, text: err.response?.data?.error || err.message || 'Could not add those photos.' });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="stp" data-testid={`studio-photos-${location.id}`}>
      <span className="stp-actions">
        <button type="button" className="stp-btn" disabled={busy || !showId} onClick={() => input.current?.click()}>
          {busy ? 'Adding…' : 'Add photos'}
        </button>
        {resident && <Link className="stp-link" to={`/character/${resident.character_id}?tab=places`}>{resident.display_name || resident.handle}&rsquo;s Places</Link>}
      </span>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(Array.from(e.target.files || []))}
        data-testid={`studio-photos-input-${location.id}`} aria-label={`Photos of ${location.name}`} />
      {!showId && <span className="stp-note">Choose a show first: photos belong to a show.</span>}
      {note && <span className={`stp-note${note.error ? ' is-error' : ''}`} role={note.error ? 'alert' : 'status'}>{note.text}</span>}
    </div>
  );
}

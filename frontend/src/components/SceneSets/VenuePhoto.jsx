/**
 * The venue's own photo (Evoni, 2026-10-17: "the main photo and the venue
 * photo maybe different ... the venue has its own photo"): the venue as
 * people know it, e.g. the building from the street, kept on the set's World
 * Location apart from the set's main photo. Upload, replace or remove it.
 */
import { useRef, useState } from 'react';
import { Upload, X, Building2 } from 'lucide-react';
import api from '../../services/api';
import './VenuePhoto.css';

export default function VenuePhoto({ set, onToast, onSaved }) {
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(false);
  const url = set.venue_photo_url || null;

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('image', file);
      await api.post(`/api/v1/scene-sets/${set.id}/venue-photo`, form);
      onToast?.('Venue photo saved');
      onSaved?.();
    } catch (err) {
      console.error('[VenuePhoto] upload failed:', err);
      onToast?.(err.response?.data?.error || 'The venue photo did not upload', 'error');
    } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/v1/scene-sets/${set.id}/venue-photo`);
      onToast?.('Venue photo removed');
      onSaved?.();
    } catch (err) {
      console.error('[VenuePhoto] remove failed:', err);
      onToast?.(err.response?.data?.error || 'The venue photo was not removed', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="vp" data-testid={`venue-photo-${set.id}`}>
      <span className="vp-label"><Building2 size={13} aria-hidden="true" /> Venue photo</span>
      {!set.world_location_id ? (
        <p className="vp-hint">Link this set to its World Location (Details &amp; Usage) to add the venue&rsquo;s own photo.</p>
      ) : (
        <div className="vp-body">
          {url ? <img src={url} alt="The venue" className="vp-img" data-testid={`venue-photo-img-${set.id}`} /> : <div className="vp-img is-empty">No venue photo yet</div>}
          <div className="vp-actions">
            <button type="button" className="vp-btn" disabled={busy} onClick={() => fileInput.current?.click()} data-testid={`venue-photo-upload-${set.id}`}>
              <Upload size={12} aria-hidden="true" /> {busy ? 'Saving…' : url ? 'Replace' : 'Upload'}
            </button>
            {url && (
              <button type="button" className="vp-btn is-plain" disabled={busy} onClick={remove} aria-label="Remove the venue photo" data-testid={`venue-photo-remove-${set.id}`}>
                <X size={12} aria-hidden="true" /> Remove
              </button>
            )}
            <span className="vp-hint">The venue as people know it, apart from the main photo the views are made from.</span>
          </div>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden data-testid={`venue-photo-input-${set.id}`}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f); }} />
        </div>
      )}
    </div>
  );
}

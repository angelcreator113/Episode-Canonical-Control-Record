/**
 * Choose from Files, for a season's pictures (the Season page, 2026-10-25):
 * the cover and each part's picture. A season belongs to the show, not to an
 * episode, so the pictures come from the show's files in Assets (the asset
 * library at /assets: this show's and the shared ones), images only. The
 * Style page's "Choose from Files" reads an episode's Files instead; this is
 * the same button and grid for the show. Uploading happens in Assets.
 *
 * Props: showId, label ("Cover", "Part 1 picture"), value (the URL or null),
 * onChange(url | null), disabled.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { assetService } from '../../services/assetService';

/** An asset's picture address and thumbnail, or null for one that is not an image. */
export function assetPicture(asset) {
  const type = String(asset?.media_type || asset?.content_type || '').toLowerCase();
  const url = asset?.s3_url_processed || asset?.s3_url_raw || asset?.url || null;
  if (!url || (type && !type.startsWith('image'))) return null;
  return { id: asset.id, url, thumb: asset.metadata?.thumbnail_url || url, name: asset.name || asset.file_name || 'Picture' };
}

export default function SeasonPicturePicker({ showId, label, value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [pictures, setPictures] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || pictures) return undefined;
    let cancelled = false;
    assetService.getAssets(showId ? { show_id: showId } : {})
      .then((res) => {
        const rows = res?.data?.data || res?.data || [];
        if (!cancelled) setPictures((Array.isArray(rows) ? rows : []).map(assetPicture).filter(Boolean));
      })
      .catch((err) => {
        console.error('[SeasonPicturePicker] Files could not be read:', err);
        if (!cancelled) setError(err?.response?.data?.error || err?.message || 'Your files could not be read.');
      });
    return () => { cancelled = true; };
  }, [open, pictures, showId]);

  return (
    <div className="sst-picture" data-testid={`sst-picture-${label}`}>
      <div className="sst-picture-row">
        {value ? <img className="sst-picture-now" src={value} alt={`${label}: chosen`} /> : <span className="sst-picture-none" aria-hidden="true" />}
        <button type="button" className="sst-btn is-quiet" aria-expanded={open} disabled={disabled}
          onClick={() => setOpen((o) => !o)} data-testid={`sst-picture-open-${label}`}>
          <ImagePlus size={16} aria-hidden="true" /> {value ? 'Change' : 'Choose from Files'}
        </button>
        {value && (
          <button type="button" className="sst-btn is-quiet" disabled={disabled} onClick={() => onChange(null)} aria-label={`Remove the ${label.toLowerCase()}`}>
            <X size={16} aria-hidden="true" /> Remove
          </button>
        )}
      </div>
      {open && (
        <div className="sst-picture-body" data-testid={`sst-picture-list-${label}`}>
          {error && <p className="sst-note is-error" role="alert">{error}</p>}
          {!pictures && !error && <p className="sst-note" role="status"><Loader2 size={14} aria-hidden="true" /> Loading your files…</p>}
          {pictures && pictures.length === 0 && (
            <p className="sst-note">No pictures in Files yet. Upload them in <Link to="/assets">Assets</Link>.</p>
          )}
          {pictures && pictures.length > 0 && (
            <ul className="sst-thumbs">
              {pictures.map((p) => (
                <li key={p.id}>
                  <button type="button" className={`sst-thumb${p.url === value ? ' is-in' : ''}`} disabled={disabled}
                    aria-label={`Use ${p.name} for the ${label.toLowerCase()}`}
                    onClick={() => { onChange(p.url); setOpen(false); }}>
                    <img src={p.thumb} alt="" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

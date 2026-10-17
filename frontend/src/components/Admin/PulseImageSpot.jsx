/**
 * One image spot on Admin › The Pulse › Uploads (Tasks #2920, #2921): an
 * empty spot is a dashed "+ Add <label>" button; a filled one shows the
 * image with Replace and Remove, as buttons under it or, with `overlay`
 * (Evoni's Uploads mock, 2026-10-17), as icon buttons on its corner.
 * UploadsHead is each Uploads card's heading: an icon, the title and its
 * hint, and the card's action on the right.
 * Styles: styles/AdminPanel.css, PulseUploads.css (pu-*).
 */
import React, { useRef } from 'react';
import { ImagePlus, Pencil, RefreshCw, Trash2 } from 'lucide-react';

export function UploadsHead({ Icon, id, title, hint, children }) {
  return (
    <div className="pu-head">
      {Icon && <span className="pu-head-icon" aria-hidden="true"><Icon size={22} /></span>}
      <div className="pu-head-text">
        <h3 id={id}>{title}</h3>
        {hint && <p className="pulse-hint">{hint}</p>}
      </div>
      {children && <div className="pu-head-action">{children}</div>}
    </div>
  );
}

export default function PulseImageSpot({ label, url, alt, busy, onFile, onRemove, round = false, overlay = false, testId }) {
  const fileRef = useRef(null);
  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFile(file);
  };
  const name = label.toLowerCase();
  return (
    <div className={overlay ? 'pulse-city-spot pu-spot' : 'pulse-city-spot'}>
      {!overlay && <span className="pulse-spot-label">{label}</span>}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} data-testid={`${testId}-file`} />
      {url && overlay && (
        <div className={round ? 'pu-spot-frame is-round' : 'pu-spot-frame'}>
          <img className={round ? 'pulse-city-bubble' : 'pulse-city-image'} src={url} alt={alt || ''} />
          <span className="pu-spot-tools">
            <button type="button" className="pu-icon-btn" disabled={busy} aria-label={`Replace ${name}`} title={`Replace ${name}`} onClick={() => fileRef.current?.click()}><Pencil size={16} aria-hidden="true" /></button>
            {!round && <button type="button" className="pu-icon-btn is-danger" disabled={busy} aria-label={`Remove ${name}`} title={`Remove ${name}`} onClick={onRemove}><Trash2 size={16} aria-hidden="true" /></button>}
          </span>
          {round && <button type="button" className="pu-icon-btn is-danger pu-spot-remove" disabled={busy} aria-label={`Remove ${name}`} title={`Remove ${name}`} onClick={onRemove}><Trash2 size={14} aria-hidden="true" /></button>}
        </div>
      )}
      {url && !overlay && (
        <>
          <img className={round ? 'pulse-city-bubble' : 'pulse-city-image'} src={url} alt={alt || ''} />
          <div className="pulse-actions">
            <button type="button" className="pulse-btn" disabled={busy} onClick={() => fileRef.current?.click()}><RefreshCw size={16} aria-hidden="true" /> Replace</button>
            <button type="button" className="pulse-btn danger" disabled={busy} onClick={onRemove}><Trash2 size={16} aria-hidden="true" /> Remove</button>
          </div>
        </>
      )}
      {!url && (
        <button type="button" className={round ? 'pulse-add-spot round' : 'pulse-add-spot'} disabled={busy} onClick={() => fileRef.current?.click()} data-testid={`${testId}-add`}>
          <ImagePlus size={18} aria-hidden="true" /> + Add {name}
        </button>
      )}
    </div>
  );
}

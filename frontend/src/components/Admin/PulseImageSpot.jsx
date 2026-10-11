/**
 * One image spot on Admin › The Pulse › Uploads (Tasks #2920, #2921): an
 * empty spot is a dashed "+ Add <label>" button; a filled one shows the
 * image with Replace and Remove. Styles: styles/AdminPanel.css.
 */
import React, { useRef } from 'react';
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';

export default function PulseImageSpot({ label, url, alt, busy, onFile, onRemove, round = false, testId }) {
  const fileRef = useRef(null);
  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFile(file);
  };
  return (
    <div className="pulse-city-spot">
      <span className="pulse-spot-label">{label}</span>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} data-testid={`${testId}-file`} />
      {url ? (
        <>
          <img className={round ? 'pulse-city-bubble' : 'pulse-city-image'} src={url} alt={alt || ''} />
          <div className="pulse-actions">
            <button type="button" className="pulse-btn" disabled={busy} onClick={() => fileRef.current?.click()}><RefreshCw size={16} aria-hidden="true" /> Replace</button>
            <button type="button" className="pulse-btn danger" disabled={busy} onClick={onRemove}><Trash2 size={16} aria-hidden="true" /> Remove</button>
          </div>
        </>
      ) : (
        <button type="button" className={round ? 'pulse-add-spot round' : 'pulse-add-spot'} disabled={busy} onClick={() => fileRef.current?.click()} data-testid={`${testId}-add`}>
          <ImagePlus size={18} aria-hidden="true" /> + Add {label.toLowerCase()}
        </button>
      )}
    </div>
  );
}

/**
 * The composer's chosen photos (Task 3089): a preview each, its alt text,
 * move earlier or later, and remove. Pure list helpers: lib/composerPhotos.
 * Styles: SocialMediaPage.css (pl-cphoto-*).
 */
import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { MAX_ALT, movePhoto, removePhoto, setAlt } from '../../lib/composerPhotos';

export default function ComposerPhotos({ photos, onChange, disabled = false }) {
  if (!photos.length) return null;
  const n = photos.length;
  return (
    <ol className="pl-cphotos" aria-label="Photos for this post" data-testid="pl-cphotos">
      {photos.map((p, i) => (
        <li key={p.preview} className="pl-cphoto">
          <img src={p.preview} alt="" />
          <label className="pl-cphoto-alt">
            <span className="pl-sr">Alt text for photo {i + 1}</span>
            <input type="text" value={p.alt} maxLength={MAX_ALT} placeholder="Describe the photo" disabled={disabled}
              onChange={(e) => onChange(setAlt(photos, i, e.target.value))} />
          </label>
          <span className="pl-cphoto-tools">
            <button type="button" aria-label={`Move photo ${i + 1} earlier`} disabled={disabled || i === 0}
              onClick={() => onChange(movePhoto(photos, i, -1))}><ChevronLeft size={16} aria-hidden="true" /></button>
            <button type="button" aria-label={`Move photo ${i + 1} later`} disabled={disabled || i === n - 1}
              onClick={() => onChange(movePhoto(photos, i, 1))}><ChevronRight size={16} aria-hidden="true" /></button>
            <button type="button" aria-label={`Remove photo ${i + 1}`} disabled={disabled}
              onClick={() => { URL.revokeObjectURL?.(p.preview); onChange(removePhoto(photos, i)); }}><X size={16} aria-hidden="true" /></button>
          </span>
        </li>
      ))}
    </ol>
  );
}

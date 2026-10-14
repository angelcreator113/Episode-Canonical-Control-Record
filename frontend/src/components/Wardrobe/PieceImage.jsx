/**
 * A wardrobe piece's picture on its Producer Mode backdrop (Task #3151;
 * Evoni, 2026-10-14: "in producer mode wardrobe we have a beautiful color
 * behind each piece but thats not shown throughout").
 *
 * The cut-out sits on its game slot's pastel under a studio glow
 * (styles/wardrobe-backdrop.css; lib/closetGrouping backdropFor), the same
 * as in Producer Mode's closet. With no picture, or one that fails to load,
 * the fallback (an icon or emoji) sits on the same backdrop. Lifted from the
 * styling game's GarmentImage, which now uses this.
 *
 * Props: item (a wardrobe row or a look piece: its clothing_category or
 * category picks the backdrop; its picture by resolveWardrobeCutoutUrl), or
 * `src` to name the picture outright; size / height (px or CSS), radius,
 * fallback, className, testId (the box) and imgTestId (the picture).
 */
import { useState } from 'react';
import { backdropFor, GAME_SLOT_DEFS, OTHER_GROUP } from '../../lib/closetGrouping';
import { resolveWardrobeCutoutUrl } from '../../utils/wardrobeImage';
import '../../styles/wardrobe-backdrop.css';

// The slot's own icon, the closet's, when no fallback is given.
const slotIcon = (slot) => (GAME_SLOT_DEFS.find((s) => s.key === slot) || OTHER_GROUP).icon;

export default function PieceImage({ item, src, size, height, radius = 8, fallback, className = '', testId, imgTestId, alt }) {
  const url = src !== undefined ? (src || null) : resolveWardrobeCutoutUrl(item);
  const slot = backdropFor(item);
  // Keyed by the URL so a new picture gets a fresh attempt after a failure.
  return <PieceImageInner key={url || 'none'} url={url} name={alt || item?.name || item?.label} slot={slot}
    size={size} height={height} radius={radius} fallback={fallback ?? slotIcon(slot)} className={className} testId={testId} imgTestId={imgTestId} />;
}

function PieceImageInner({ url, name, slot, size, height, radius, fallback, className, testId, imgTestId }) {
  const [failed, setFailed] = useState(false);
  const backdropClass = `wa-wd-backdrop bd-${slot}${className ? ` ${className}` : ''}`;
  const box = {
    width: size || '100%',
    height: height || size || '100%',
    borderRadius: radius,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  };
  if (!url || failed) {
    const px = typeof (height || size) === 'number' ? (height || size) : 40;
    const emojiSize = Math.min(40, Math.max(12, Math.round(px * 0.5)));
    return (
      <div data-testid={testId || 'garment-fallback'} data-backdrop={slot} role="img" aria-label={name || 'Wardrobe item'} className={backdropClass} style={box}>
        {typeof fallback === 'string' ? <span style={{ fontSize: emojiSize }}>{fallback}</span> : fallback}
      </div>
    );
  }
  return (
    <div className={backdropClass} style={box} data-testid={testId} data-backdrop={slot}>
      <img
        className="wa-wd-img"
        data-testid={imgTestId}
        src={url}
        alt={name || 'Wardrobe item'}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}

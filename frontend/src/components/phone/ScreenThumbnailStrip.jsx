import { getScreenImageStyle } from '../PhoneHub';

/**
 * Horizontal-scroll screen picker for the Zones tab.
 * Replaces the prev/next arrows + <select> pattern in the old zone
 * editor header — all editable screens are visible at once, click to
 * switch. Active screen gets a gold ring to match the phone skin.
 *
 * Props:
 *   screens      — array of screen overlay objects (should already be
 *                  filtered to editable screens by the caller)
 *   activeId     — currently selected screen id
 *   onSelect(s)  — callback when a thumbnail is clicked
 *   globalFit    — device-level fit for image positioning
 *   zoneCounts   — optional map: id -> { tap, icon, content } counts
 */
export default function ScreenThumbnailStrip({
  screens = [],
  activeId,
  onSelect,
  globalFit,
  zoneCounts,
}) {
  if (!screens.length) return null;
  return (
    <div className="zones-thumbnail-strip" role="tablist" aria-label="Screens">
      {screens.map(s => {
        const isActive = s.id === activeId;
        const counts = zoneCounts?.get?.(s.id) || zoneCounts?.[s.id];
        const total = counts ? (counts.tap || 0) + (counts.icon || 0) + (counts.content || 0) : 0;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect?.(s)}
            className={`zones-thumbnail ${isActive ? 'active' : ''}`}
            title={s.name}
          >
            <div className="zones-thumbnail__frame">
              {s.url ? (
                <img
                  src={s.url}
                  alt={s.name}
                  style={getScreenImageStyle(s, globalFit)}
                />
              ) : (
                <div className="zones-thumbnail__placeholder">—</div>
              )}
            </div>
            <span className="zones-thumbnail__label">{s.name}</span>
            {total > 0 && (
              <span className="zones-thumbnail__count" aria-label={`${total} zones`}>
                {total}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

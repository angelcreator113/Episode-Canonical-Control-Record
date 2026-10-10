/**
 * An image slot on the public site (Task #2809). With a src it is the
 * approved art; without one it is a visible, labelled placeholder, never
 * stock or fake content, so it is obvious what Evoni still has to supply.
 */
export default function MediaSlot({ src = null, alt = '', label, ratio = '4 / 5', className = '' }) {
  return (
    <div className={`site-media ${className}`.trim()} style={{ aspectRatio: ratio }}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" />
      ) : (
        <div className="site-media__placeholder" data-testid="site-media-placeholder">
          <span>Image coming soon</span>
          <span className="site-media__label">{label}</span>
        </div>
      )}
    </div>
  );
}

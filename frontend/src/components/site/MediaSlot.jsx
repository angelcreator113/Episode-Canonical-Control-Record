/**
 * An image slot on the public site (Task #2809). With a src it is the
 * approved art; without one it is a visible, labelled placeholder, never
 * stock or fake content, so it is obvious what Evoni still has to supply.
 *
 * Task #2822: `media` is the slot's published media from the Website page
 * (an image, or a clip of 30 seconds or less), shown in the same box so the
 * layout never shifts; without it the bundled default stays.
 */
import { prefersReducedMotion } from './siteMedia';

// A short brand clip: muted and looping, but never moving on its own for a
// visitor who prefers reduced motion (they get the poster and controls).
export function SiteClip({ media, alt }) {
  const reduced = prefersReducedMotion();
  return (
    <video
      className="site-media__clip"
      src={media.url}
      poster={media.poster_url || undefined}
      muted
      loop
      playsInline
      preload="metadata"
      autoPlay={!reduced}
      controls={reduced}
      aria-label={media.alt_text || alt}
      data-testid="site-clip"
    >
      {media.captions_url && <track kind="captions" src={media.captions_url} srcLang="en" label="English" default />}
    </video>
  );
}

export default function MediaSlot({ src = null, alt = '', label, ratio = '4 / 5', className = '', media = null }) {
  let body;
  if (media?.media_type === 'video_clip' && media.url) body = <SiteClip media={media} alt={alt} />;
  else if (media?.media_type === 'image' && media.url) body = <img src={media.url} alt={media.alt_text || alt} loading="lazy" />;
  else if (src) body = <img src={src} alt={alt} loading="lazy" />;
  else {
    body = (
      <div className="site-media__placeholder" data-testid="site-media-placeholder">
        <span>Image coming soon</span>
        <span className="site-media__label">{label}</span>
      </div>
    );
  }
  return (
    <div className={`site-media ${className}`.trim()} style={{ aspectRatio: ratio }}>
      {body}
    </div>
  );
}

/**
 * Section 5, Featured Production on lavender (spec Part 1, amended by #2818;
 * Task #2810). With no published video it shows the fallback: the map,
 * dimmed, in a 16:9 frame with "First look coming soon", and "Watch
 * Featured Video" disabled and labelled soon. Static: nothing is fetched
 * and nothing loads from YouTube.
 *
 * The one input is FEATURED.video (see siteContent.js). Only a published
 * YouTube id or uploaded clip counts; anything else falls back. The players
 * themselves land with the website media task (#2822).
 */
import { FEATURED, HERO_MAP, SECTION_IDS } from './siteContent';

export function isPublishedVideo(video) {
  if (!video || typeof video !== 'object') return false;
  if (video.kind === 'youtube') return typeof video.id === 'string' && video.id.length > 0;
  if (video.kind === 'clip') return typeof video.src === 'string' && video.src.length > 0 && Boolean(video.poster);
  return false;
}

function Fallback({ mapSrc }) {
  return (
    <div className="site-featured__frame site-featured__frame--fallback" data-testid="site-featured-fallback">
      {mapSrc ? <img src={mapSrc} alt="" aria-hidden="true" /> : <div className="site-featured__map" aria-hidden="true" />}
      <div className="site-featured__soon">
        <p className="site-featured__soon-title">{FEATURED.comingSoon}</p>
        <p>{FEATURED.comingSoonLine}</p>
      </div>
    </div>
  );
}

// The player for a published video, or null. #2822 adds the YouTube facade
// and the clip player here; until then every source falls back.
function playerFor(video) {
  if (!isPublishedVideo(video)) return null;
  switch (video.kind) {
    default: return null;
  }
}

export default function FeaturedScreening({ video = FEATURED.video, mapSrc = HERO_MAP }) {
  const player = playerFor(video);
  const published = Boolean(player);
  return (
    <section id={SECTION_IDS.featured} className="site-section site-featured" aria-labelledby="site-featured-heading">
      <div className="site-wrap site-featured__inner">
        {player || <Fallback mapSrc={mapSrc} />}
        <div className="site-featured__copy">
          <p className="site-eyebrow">{FEATURED.eyebrow}</p>
          <h2 id="site-featured-heading">{FEATURED.heading}</h2>
          <div className="site-featured__actions">
            <button type="button" className="site-btn site-btn--ivory" disabled={!published}>
              {FEATURED.watch}
              {!published && <span className="site-featured__badge">{FEATURED.watchSoon}</span>}
            </button>
            <a className="site-btn site-btn--outline" href={`#${SECTION_IDS.flagship}`}>{FEATURED.explore}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Section 5, Featured Production on lavender (spec Part 1, amended by #2818;
 * Task #2810). With no published video it shows the fallback: the map,
 * dimmed, in a 16:9 frame with "First look coming soon", and "Watch
 * Featured Video" disabled and labelled soon.
 *
 * Task #2822: the video comes from the Website page's featured_video slot
 * (or the `video` prop). A YouTube video shows a local facade (its poster,
 * or a plain frame) with a play button and loads the privacy-enhanced embed
 * (youtube-nocookie.com) only when tapped: nothing is fetched from YouTube
 * before that. An uploaded clip plays with controls, never on its own.
 */
import { useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { FEATURED, HERO_MAP, SECTION_IDS } from './siteContent';
import { useSlot, videoFromSlot } from './siteMedia';

export const youtubeEmbedUrl = (id) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;

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

function YouTubePlayer({ video, playing, onPlay }) {
  return (
    <div className="site-featured__frame site-featured__player" data-testid="site-featured-youtube">
      {playing ? (
        <iframe
          src={youtubeEmbedUrl(video.id)}
          title={video.title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          className="site-featured__facade"
          style={video.poster ? { backgroundImage: `url("${video.poster}")` } : undefined}
          onClick={onPlay}
          aria-label={`Play: ${video.title}`}
          data-testid="site-featured-facade"
        >
          <span className="site-featured__play" aria-hidden="true"><Play size={30} /></span>
          <span className="site-featured__facade-label">Plays from YouTube when you press play</span>
        </button>
      )}
    </div>
  );
}

function ClipPlayer({ video, clipRef }) {
  return (
    <div className="site-featured__frame site-featured__player" data-testid="site-featured-clip">
      <video ref={clipRef} src={video.src} poster={video.poster || undefined} controls preload="metadata" playsInline aria-label={video.title}>
        {video.captions && <track kind="captions" src={video.captions} srcLang="en" label="English" default />}
      </video>
    </div>
  );
}

export default function FeaturedScreening({ video: videoProp, mapSrc = HERO_MAP }) {
  const slot = useSlot('featured_video');
  const video = videoProp !== undefined ? videoProp : (videoFromSlot(slot) || FEATURED.video);
  const published = isPublishedVideo(video);
  const [playing, setPlaying] = useState(false);
  const clipRef = useRef(null);
  const frameRef = useRef(null);

  let player = null;
  if (published && video.kind === 'youtube') player = <YouTubePlayer video={video} playing={playing} onPlay={() => setPlaying(true)} />;
  else if (published && video.kind === 'clip') player = <ClipPlayer video={video} clipRef={clipRef} />;

  const watch = () => {
    frameRef.current?.scrollIntoView?.({ block: 'center' });
    if (video?.kind === 'youtube') setPlaying(true);
    else clipRef.current?.play?.()?.catch?.((err) => console.error('[Featured] the clip could not start:', err.message));
  };

  return (
    <section id={SECTION_IDS.featured} className="site-section site-featured" aria-labelledby="site-featured-heading">
      <div className="site-wrap site-featured__inner">
        <div ref={frameRef}>{player || <Fallback mapSrc={mapSrc} />}</div>
        <div className="site-featured__copy">
          <p className="site-eyebrow">{FEATURED.eyebrow}</p>
          <h2 id="site-featured-heading">{FEATURED.heading}</h2>
          <div className="site-featured__actions">
            <button type="button" className="site-btn site-btn--ivory" disabled={!player} onClick={watch}>
              {FEATURED.watch}
              {!player && <span className="site-featured__badge">{FEATURED.watchSoon}</span>}
            </button>
            <a className="site-btn site-btn--outline" href={`#${SECTION_IDS.flagship}`}>{FEATURED.explore}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

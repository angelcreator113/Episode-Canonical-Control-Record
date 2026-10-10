/**
 * The landing page hero (spec Part 1, section 2; Task #2808): the
 * LalaVerse map full-bleed with a lavender wash from the left, and real
 * text over it, never baked into the image. On phones the map sits above
 * the headline. "Explore Our Universe" goes to Our World; "Watch Our
 * Vision" scrolls to Featured Production until a vision video exists.
 */
import { HERO, HERO_MAP, HERO_MAP_ALT, SECTION_IDS } from './siteContent';
import { useSlot } from './siteMedia';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

function scrollToSection(id) {
  const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
  if (!el) return;
  el.scrollIntoView?.({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

export default function LandingHero({ mapSrc: bundledMap = HERO_MAP }) {
  // The published hero image from the Website page, else the bundled map.
  const hero = useSlot('hero');
  const mapSrc = (hero?.media_type === 'image' && hero.url) || bundledMap;
  const mapAlt = (hero?.url && hero.alt_text) || HERO_MAP_ALT;
  return (
    <section className="site-hero" aria-labelledby="site-hero-heading" data-testid="site-hero">
      <div className="site-hero__art">
        {mapSrc ? (
          <img src={mapSrc} alt={mapAlt} width="1600" height="900" fetchpriority="high" />
        ) : (
          <div className="site-hero__placeholder" data-testid="site-hero-placeholder" aria-hidden="true" />
        )}
      </div>
      <div className="site-wrap site-hero__content">
        <p className="site-eyebrow">{HERO.eyebrow}</p>
        <h1 id="site-hero-heading">{HERO.heading}</h1>
        <p className="site-hero__body">{HERO.body}</p>
        <div className="site-hero__actions">
          <a className="site-btn site-btn--ivory" href={`#${SECTION_IDS.world}`}>{HERO.primary}</a>
          <button type="button" className="site-btn site-btn--outline" onClick={() => scrollToSection(SECTION_IDS.featured)}>
            {HERO.secondary}
          </button>
        </div>
      </div>
    </section>
  );
}

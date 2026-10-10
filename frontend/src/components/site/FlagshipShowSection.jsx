/**
 * Section 3, the flagship production (spec Part 1; Task #2809): approved
 * Lala art beside the show's copy. "Discover the Show" goes to Featured
 * Production until a public show page exists.
 */
import MediaSlot from './MediaSlot';
import { useSlot } from './siteMedia';
import { FLAGSHIP, SECTION_IDS } from './siteContent';

export default function FlagshipShowSection() {
  const media = useSlot('flagship_lala');
  return (
    <section id={SECTION_IDS.flagship} className="site-section site-flagship" aria-labelledby="site-flagship-heading">
      <div className="site-wrap site-flagship__inner">
        <MediaSlot src={FLAGSHIP.image} media={media} alt="Lala" label={FLAGSHIP.imageLabel} className="site-flagship__media" />
        <div className="site-flagship__copy">
          <p className="site-eyebrow">{FLAGSHIP.eyebrow}</p>
          <h2 id="site-flagship-heading">{FLAGSHIP.heading}</h2>
          <p className="site-flagship__tagline">{FLAGSHIP.tagline}</p>
          <p>{FLAGSHIP.body}</p>
          <a className="site-btn site-btn--primary" href={`#${SECTION_IDS.featured}`}>{FLAGSHIP.button}</a>
        </div>
      </div>
    </section>
  );
}

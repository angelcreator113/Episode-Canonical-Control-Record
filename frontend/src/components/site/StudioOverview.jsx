/**
 * Section 6, Inside Prime Studios: "One World. Many Ways In." (spec Part 1,
 * amended by #2819; Task #2809). Four brand cards with 4:5 image-or-clip
 * slots. "Discover the Studio" goes to Collaborate until a studio page
 * exists.
 */
import MediaSlot from './MediaSlot';
import { STUDIO, SECTION_IDS } from './siteContent';

export default function StudioOverview() {
  return (
    <section id={SECTION_IDS.studio} className="site-section site-studio" aria-labelledby="site-studio-heading">
      <div className="site-wrap">
        <header className="site-section__head">
          <p className="site-eyebrow">{STUDIO.eyebrow}</p>
          <h2 id="site-studio-heading">{STUDIO.heading}</h2>
          <p className="site-section__lede">{STUDIO.line}</p>
        </header>
        <ul className="site-grid site-grid--4">
          {STUDIO.cards.map((c) => (
            <li key={c.key} className="site-card site-card--brand">
              <MediaSlot src={c.image} alt={c.title} label={c.imageLabel} ratio="4 / 5" />
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </li>
          ))}
        </ul>
        <div className="site-section__actions">
          <a className="site-btn site-btn--outline" href={`#${SECTION_IDS.collaborate}`}>{STUDIO.button}</a>
        </div>
      </div>
    </section>
  );
}

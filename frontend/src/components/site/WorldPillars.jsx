/**
 * Section 4, Our World (spec Part 1; Task #2809): three pillars on white,
 * each with an image slot.
 */
import MediaSlot from './MediaSlot';
import { SiteContentContext } from './siteMedia';
import { useContext } from 'react';
import { WORLD, SECTION_IDS } from './siteContent';

export default function WorldPillars() {
  const { slots } = useContext(SiteContentContext);
  return (
    <section id={SECTION_IDS.world} className="site-section site-world" aria-labelledby="site-world-heading">
      <div className="site-wrap">
        <header className="site-section__head">
          <p className="site-eyebrow">{WORLD.eyebrow}</p>
          <h2 id="site-world-heading">{WORLD.heading}</h2>
        </header>
        <ul className="site-grid site-grid--3">
          {WORLD.pillars.map((p) => (
            <li key={p.key} className="site-pillar">
              <MediaSlot src={p.image} media={slots?.[`pillar_${p.key}`] || null} alt={p.title} label={p.imageLabel} ratio="4 / 3" />
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

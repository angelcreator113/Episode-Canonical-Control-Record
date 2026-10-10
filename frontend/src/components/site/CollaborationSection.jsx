/**
 * Section 7, Collaborate (spec Part 1; Task #2809): three cards on blush,
 * champagne and ice, and a contact button.
 */
import { COLLABORATE, SECTION_IDS, mailto } from './siteContent';

export default function CollaborationSection() {
  return (
    <section id={SECTION_IDS.collaborate} className="site-section site-collaborate" aria-labelledby="site-collaborate-heading">
      <div className="site-wrap">
        <header className="site-section__head">
          <p className="site-eyebrow">{COLLABORATE.eyebrow}</p>
          <h2 id="site-collaborate-heading">{COLLABORATE.heading}</h2>
          <p className="site-section__lede">{COLLABORATE.body}</p>
        </header>
        <ul className="site-grid site-grid--3">
          {COLLABORATE.cards.map((c) => (
            <li key={c.key} className={`site-card site-card--${c.tone}`} data-tone={c.tone}>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </li>
          ))}
        </ul>
        <div className="site-section__actions">
          <a className="site-btn site-btn--primary" href={mailto('Collaboration with Prime Studios')}>{COLLABORATE.button}</a>
        </div>
      </div>
    </section>
  );
}

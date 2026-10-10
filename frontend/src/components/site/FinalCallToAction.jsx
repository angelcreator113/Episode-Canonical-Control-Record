/**
 * Section 8, the closing on deep lavender and the footer (spec Part 1; Task #2809).
 * Privacy and Terms are visible placeholders: no such pages exist yet.
 */
import { Link } from 'react-router-dom';
import { CLOSING, SECTION_IDS, LOGIN_PATH, mailto } from './siteContent';

export default function FinalCallToAction() {
  return (
    <>
      <section id={SECTION_IDS.contact} className="site-section site-closing" aria-labelledby="site-closing-heading">
        <div className="site-wrap site-closing__inner">
          <h2 id="site-closing-heading">{CLOSING.heading}</h2>
          <p>{CLOSING.body}</p>
          <a className="site-btn site-btn--closing" href={mailto('Hello, Prime Studios')}>{CLOSING.button}</a>
        </div>
      </section>
      <footer className="site-footer">
        <div className="site-wrap site-footer__inner">
          <p>{CLOSING.footer}</p>
          <ul className="site-footer__links">
            <li><span className="site-footer__pending" data-testid="site-footer-privacy">Privacy <em>(coming soon)</em></span></li>
            <li><span className="site-footer__pending" data-testid="site-footer-terms">Terms <em>(coming soon)</em></span></li>
            <li><Link to={LOGIN_PATH}>Enter Studio</Link></li>
          </ul>
        </div>
      </footer>
    </>
  );
}

/**
 * The public site's frame (spec Part 1, section 1; Task #2808): the
 * sticky 76px navigation (wordmark; Our World, Productions, Collaborate;
 * an outlined "Enter Studio" to the existing login), a menu drawer on
 * phones, and the page's own scroll (App.css locks the body's).
 * Static: no API calls, no auth changes.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { NAV_LINKS, LOGIN_PATH } from './siteContent';
import '../../styles/site-tokens.css';
import '../../styles/PublicSite.css';

export default function PublicSiteLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const drawerRef = useRef(null);

  // Escape closes the drawer and returns focus to its button; opening it
  // moves focus to its first link.
  useEffect(() => {
    if (!menuOpen) return undefined;
    drawerRef.current?.querySelector('a')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <div className="site" data-testid="public-site">
      <a className="site-skip" href="#site-main">Skip to content</a>
      <header className="site-nav">
        <div className="site-wrap site-nav__inner">
          <a className="site-wordmark" href="#site-main">Prime Studios</a>
          <nav className="site-nav__links" aria-label="Site">
            {NAV_LINKS.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
          </nav>
          <Link className="site-btn site-btn--outline site-nav__enter" to={LOGIN_PATH}>Enter Studio</Link>
          <button
            ref={menuButtonRef}
            type="button"
            className="site-nav__menu"
            aria-expanded={menuOpen}
            aria-controls="site-drawer"
            onClick={() => setMenuOpen((o) => !o)}
            data-testid="site-menu-button"
          >
            {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            <span className="site-sr">{menuOpen ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
        <div
          id="site-drawer"
          ref={drawerRef}
          className={`site-drawer${menuOpen ? ' is-open' : ''}`}
          hidden={!menuOpen}
          data-testid="site-drawer"
        >
          <nav aria-label="Site menu">
            {NAV_LINKS.map((l) => <a key={l.href} href={l.href} onClick={close}>{l.label}</a>)}
            <Link className="site-btn site-btn--outline" to={LOGIN_PATH} onClick={close}>Enter Studio</Link>
          </nav>
        </div>
      </header>
      <main id="site-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

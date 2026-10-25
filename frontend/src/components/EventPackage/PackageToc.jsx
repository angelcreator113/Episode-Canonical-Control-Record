/**
 * PackageToc — "On this page": a link per section with its readiness
 * dot (in words too), the one in view marked (usePackageNavigation).
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { TOC_STATE_TEXT } from '../../lib/eventPackageFields';

export default function PackageToc({ nav, activeAnchor, tocListRef, openSection }) {
  return (
    <nav className="epp-toc" aria-label="On this page" data-testid="package-toc">
      <span className="epp-toc-eyebrow">On this page</span>
      <ul ref={tocListRef}>
        {nav.map((s) => (
          <li key={s.anchor}>
            <a
              href={`#epp-sec-${s.anchor}`} className={`state-${s.state}${s.anchor === activeAnchor ? ' is-active' : ''}`}
              onClick={() => openSection(s.anchor)}
              aria-current={s.anchor === activeAnchor ? 'location' : undefined} data-testid={`toc-${s.anchor}`}
            >
              <span className="epp-toc-dot" aria-hidden="true" />{s.label}
              {/* The dot's state in words too, not colour alone (audit, 2026-10-23). */}
              {TOC_STATE_TEXT[s.state] && <span className="epp-sr-only"> ({TOC_STATE_TEXT[s.state]})</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * PhoneSetupGuide — plain-word progress across the phone's build, with one
 * "Continue setup →" (doctrine rule 18, Task #2053).
 *
 * Five lines, each counted from data the Phone Hub already has:
 *   Screens  N with an image of M
 *   Icons    N placed of M
 *   Links    N of M zones have a destination
 *   Content  N screens with content zones          (informational)
 *   Preview  the last flow test's issues, or "not run yet" with a Run link
 *                                                    (informational)
 * Setup is complete when Screens, Icons and Links are. "Continue setup →"
 * hands the first unmet of Screens, Links, Icons (in that order) to the page.
 *
 * The guide counts what exists: the Core Phone kit is undecided (doctrine
 * rule 18, "Not decided here"), so there are no target counts.
 */
import { ChevronDown } from 'lucide-react';
import { getScreenLinks, resolveZoneIconKey } from '../../lib/overlayUtils';
import './PhoneSetupGuide.css';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// screens: every phone screen; icons: every phone icon; diagnostics: the
// page's screenDiagnostics (generated screens only); flowAudit: the last
// flow test's result, or null.
export function phoneSetupProgress({ screens = [], icons = [], diagnostics = new Map(), flowAudit = null }) {
  const hasImage = (s) => !!(s.generated && s.url);

  const withImage = screens.filter(hasImage).length;
  const screensLine = {
    key: 'screens',
    label: 'Screens',
    state: screens.length > 0 && withImage === screens.length ? 'done' : 'todo',
    text: screens.length === 0 ? 'none yet' : `${withImage} with an image of ${screens.length}`,
  };

  // An icon is placed when a zone on some screen resolves to it (the same
  // test the Icons cards use).
  const placedKeys = new Set();
  screens.forEach(screen => getScreenLinks(screen).forEach(link => {
    const key = resolveZoneIconKey(link, icons);
    if (key) placedKeys.add(key);
  }));
  const placed = icons.filter(i => placedKeys.has(i.id)).length;
  const iconsLine = {
    key: 'icons',
    label: 'Icons',
    state: icons.length === 0 ? 'empty' : placed === icons.length ? 'done' : 'todo',
    text: icons.length === 0 ? 'none yet' : `${placed} placed of ${icons.length}`,
  };

  let zones = 0;
  let noDestination = 0;
  let firstUnlinked = null;
  let withContent = 0;
  screens.forEach(screen => {
    const d = diagnostics.get(screen.id);
    if (!d) return;
    zones += (d.counts?.tap || 0) + (d.counts?.icon || 0);
    const missing = (d.missingTarget || 0) + (d.brokenTarget || 0);
    noDestination += missing;
    if (missing > 0 && !firstUnlinked) firstUnlinked = screen;
    if ((d.counts?.content || 0) > 0) withContent += 1;
  });
  const linksLine = {
    key: 'links',
    label: 'Links',
    state: zones === 0 ? 'empty' : noDestination === 0 ? 'done' : 'todo',
    text: zones === 0 ? 'no zones yet' : `${zones - noDestination} of ${plural(zones, 'zone has', 'zones have')} a destination`,
  };

  const contentLine = {
    key: 'content',
    label: 'Content',
    state: 'info',
    text: `${plural(withContent, 'screen', 'screens')} with content zones`,
  };

  let previewText = 'not run yet';
  if (flowAudit) {
    const dead = flowAudit.deadLinks?.length || 0;
    const unreachable = flowAudit.unreachable?.length || 0;
    previewText = dead + unreachable === 0
      ? 'no issues in the last flow test'
      : [dead && plural(dead, 'dead link', 'dead links'), unreachable && plural(unreachable, 'screen not reached', 'screens not reached')]
        .filter(Boolean).join(', ') + ' in the last flow test';
  }
  const previewLine = { key: 'preview', label: 'Preview', state: 'info', text: previewText, canRun: !flowAudit };

  let next = null;
  if (screensLine.state === 'todo') next = { key: 'screens', screen: screens.find(s => !hasImage(s)) || null };
  else if (linksLine.state === 'todo') next = { key: 'links', screen: firstUnlinked };
  else if (iconsLine.state === 'todo') next = { key: 'icons', screen: null };

  const core = [screensLine, iconsLine, linksLine];
  return {
    lines: [screensLine, iconsLine, linksLine, contentLine, previewLine],
    next,
    complete: core.every(l => l.state !== 'todo'),
    doneCount: core.filter(l => l.state !== 'todo').length,
  };
}

const MARKS = { done: '✓', todo: '⚠', empty: '–', info: '·' };
const NEXT_TITLES = {
  screens: 'add the next screen image',
  links: 'give a zone its destination',
  icons: 'place the unplaced icons',
};

export default function PhoneSetupGuide({ progress, collapsed = false, onToggle, onContinue, onRunPreview }) {
  if (!progress) return null;
  const { lines, next, complete, doneCount } = progress;
  return (
    <section className={`phone-setup-guide${collapsed ? ' phone-setup-guide--collapsed' : ''}`} aria-label="Phone setup">
      <div className="phone-setup-guide__head">
        <button
          type="button"
          className="phone-setup-guide__toggle"
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          <span className="phone-setup-guide__title">Setup</span>
          <span className="phone-setup-guide__summary">
            {complete ? '✓ Screens, icons and links are done' : `${doneCount} of 3 done`}
          </span>
          <ChevronDown size={13} aria-hidden="true" className="phone-setup-guide__chevron" />
        </button>
        {next && onContinue && (
          <button
            type="button"
            className="phone-setup-guide__continue"
            aria-label={`Continue setup: ${NEXT_TITLES[next.key]}`}
            onClick={() => onContinue(next)}
          >
            Continue setup →
          </button>
        )}
      </div>
      {!collapsed && (
        <ul className="phone-setup-guide__lines">
          {lines.map(line => (
            <li key={line.key} className={`phone-setup-guide__line phone-setup-guide__line--${line.state}`} data-line={line.key}>
              <span className="phone-setup-guide__mark" aria-hidden="true">{MARKS[line.state]}</span>
              <span className="phone-setup-guide__text">
                <strong>{line.label}:</strong> {line.text}
              </span>
              {line.canRun && onRunPreview && (
                <button type="button" className="phone-setup-guide__run" onClick={onRunPreview}>Run</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

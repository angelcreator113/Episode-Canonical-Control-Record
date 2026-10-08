/**
 * ConnectScreenList — Connect's left column (Evoni's mockup, 2026-10-08):
 * the phone's screens in three groups, the ones that need something first.
 *
 *   Needs you   a zone goes nowhere, or nothing leads here (home aside)
 *   Dead ends   Lala can open it but can't tap back out (phoneFlowMap)
 *   Ready       the rest
 *
 * A row picks the screen to wire; "+ Add" adds a screen. Pure display: the
 * page passes the screens, its screenDiagnostics and phoneFlowMap's result.
 */
import { incomingById } from '../../lib/phoneHubSummary';
import './ConnectScreenList.css';

const NO_SCREENS = [];
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function groupConnectScreens({ screens = NO_SCREENS, diagnostics, flowMap, homeId }) {
  const reach = incomingById(screens);
  const dead = new Set((flowMap?.deadEnds || []).map(s => s.id));
  const groups = { needs: [], dead: [], ready: [] };
  screens.forEach((s) => {
    const d = diagnostics?.get?.(s.id);
    const nowhere = (d?.missingTarget || 0) + (d?.brokenTarget || 0);
    const zones = (d?.counts?.tap || 0) + (d?.counts?.icon || 0);
    if (nowhere > 0) groups.needs.push({ screen: s, line: `${plural(nowhere, 'zone goes', 'zones go')} nowhere` });
    else if (s.id !== homeId && !(reach.get(s.id) > 0)) groups.needs.push({ screen: s, line: 'Nothing links here' });
    else if (dead.has(s.id)) groups.dead.push({ screen: s, line: 'No way back' });
    else groups.ready.push({ screen: s, line: s.id === homeId ? `Home · ${plural(zones, 'zone')}` : plural(zones, 'zone') });
  });
  return groups;
}

const SECTIONS = [
  { key: 'needs', title: 'Needs you', tone: 'danger' },
  { key: 'dead', title: 'Dead ends', tone: 'warn' },
  { key: 'ready', title: 'Ready', tone: 'plain' },
];

export default function ConnectScreenList({ screens = NO_SCREENS, activeId, diagnostics, flowMap, homeId, onSelect, onAdd }) {
  const groups = groupConnectScreens({ screens, diagnostics, flowMap, homeId });
  return (
    <nav className="connect-screens" aria-label="Screens">
      <div className="connect-screens__head">
        <span className="connect-screens__title">Screens <span className="connect-screens__count">{screens.length}</span></span>
        {onAdd && <button type="button" className="connect-screens__add" onClick={onAdd}>+ Add</button>}
      </div>
      {SECTIONS.map(({ key, title, tone }) => groups[key].length > 0 && (
        <section key={key} className={`connect-screens__group is-${tone}`} data-testid={`connect-group-${key}`}>
          <div className="connect-screens__group-title">{title} · {groups[key].length}</div>
          <ul className="connect-screens__list">
            {groups[key].map(({ screen, line }) => (
              <li key={screen.id}>
                <button
                  type="button"
                  className={`connect-screens__item${screen.id === activeId ? ' is-active' : ''}`}
                  aria-current={screen.id === activeId ? 'true' : undefined}
                  onClick={() => onSelect?.(screen)}
                >
                  {screen.url ? <img src={screen.url} alt="" className="connect-screens__thumb" /> : <span className="connect-screens__thumb" aria-hidden="true" />}
                  <span className="connect-screens__text">
                    <span className="connect-screens__name">{screen.name}</span>
                    <span className="connect-screens__line">{line}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

// "Ready to film?" (Script tab audit, 2026-10-15): the script-wide checks in
// one card at the top of the Script tab (lib/scriptHealth). A row a beat can
// fix opens that beat. Open or closed is remembered per viewer. A phone-path
// row also fixes itself (lib/phonePaths: "Go home first"), and Fix all fixes
// every one (script phone paths, 2026-10-16).
import { useState } from 'react';
import { Check, AlertTriangle, ChevronDown } from 'lucide-react';

const STORE_KEY = 'esp-health-collapsed';

function readCollapsed() {
  try { return window.localStorage.getItem(STORE_KEY) === '1'; }
  catch (err) { console.error('[ScriptHealth] could not read the remembered state:', err); return false; }
}

export default function ScriptHealthPanel({ rows = [], beatNumbers = {}, onOpenBeat, onFix, busy = false }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toCheck = rows.filter((r) => !r.ok).length;
  const fixable = rows.filter((r) => !r.ok && r.fix);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { window.localStorage.setItem(STORE_KEY, next ? '1' : '0'); }
    catch (err) { console.error('[ScriptHealth] could not remember the state:', err); }
  };
  return (
    <section className={`esp-health${toCheck ? ' has-gaps' : ' is-clear'}`} data-testid="script-health">
      <button type="button" className="esp-health-head" aria-expanded={!collapsed} aria-controls="esp-health-list" onClick={toggle} data-testid="script-health-toggle">
        {toCheck ? <AlertTriangle size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
        <span className="esp-health-title">Ready to film?</span>
        <span className="esp-health-sum" data-testid="script-health-sum">{toCheck ? `${toCheck} to check` : 'All clear'}</span>
        <ChevronDown size={16} className="esp-health-chev" aria-hidden="true" />
      </button>
      {!collapsed && fixable.length > 1 && onFix && (
        <div className="esp-health-fixall">
          <button type="button" className="esp-btn-primary is-small" data-testid="script-health-fix-all" disabled={busy} onClick={() => onFix(null)}>
            Fix all {fixable.length}
          </button>
        </div>
      )}
      {!collapsed && (
        <ul className="esp-health-list" id="esp-health-list">
          {rows.map((r) => (
            <li key={r.key} className={r.ok ? 'is-ok' : 'is-gap'} data-testid={`script-health-${r.key}`} data-ok={r.ok ? 'true' : 'false'}>
              {r.ok ? <Check size={14} aria-label="OK" /> : <AlertTriangle size={14} aria-label="To check" />}
              <span className="esp-health-text">{r.text}</span>
              {r.fix && onFix && (
                <button type="button" className="esp-health-open esp-health-fix" data-testid={`script-health-fix-${r.key}`} disabled={busy} onClick={() => onFix(r.fix)}>
                  {r.fix.label}
                </button>
              )}
              {r.beatId && onOpenBeat && (
                <button type="button" className="esp-health-open" data-testid={`script-health-open-${r.key}`} onClick={() => onOpenBeat(r.beatId)}>
                  Open beat{beatNumbers[r.beatId] != null ? ` ${beatNumbers[r.beatId]}` : ''}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

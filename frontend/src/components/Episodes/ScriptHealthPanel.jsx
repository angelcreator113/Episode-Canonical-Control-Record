// "Ready to film?" (Script tab audit, 2026-10-15): the script-wide checks in
// one card at the top of the Script tab (lib/scriptHealth). A row a beat can
// fix opens that beat. A phone-path row also fixes itself (lib/phonePaths:
// "Go home first"), and Fix all fixes every one (script phone paths,
// 2026-10-16). It starts folded at every width, with its count on the
// button, as Evoni's mockup has the beats at the top (Script page audit 4,
// 2026-10-19); open or closed is not remembered.
// A row with `advice: true` (pacing, lib/scriptPacing) is a tip: an info
// mark, counted apart from the things to check; the timing row lists each
// beat's rough length (ScriptPacingList).
import { useState } from 'react';
import { Check, AlertTriangle, ChevronDown, Lightbulb, Info } from 'lucide-react';
import ScriptPacingList from './ScriptPacingList';

// A stat's key reads as words ("brand trust"); a [STAT: …] tag keeps it as
// the script writes it (Script page audit 3, 2026-10-19).
export const shownText = (text) => String(text ?? '').replace(/(\[STAT:[^\]]*\])|\bbrand_trust\b/g, (m, tag) => tag || 'brand trust');

export default function ScriptHealthPanel({ rows = [], beatNumbers = {}, onOpenBeat, onFix, busy = false }) {
  const [collapsed, setCollapsed] = useState(true);
  // A `low` row is a note (a voice habit not heard lately) and an `advice`
  // row a tip: shown, not counted as things to check.
  const toCheck = rows.filter((r) => !r.ok && !r.advice && !r.low).length;
  const tips = rows.filter((r) => !r.ok && r.advice).length;
  const tipNote = tips ? ` · ${tips} tip${tips === 1 ? '' : 's'}` : '';
  const fixable = rows.filter((r) => !r.ok && r.fix);
  const toggle = () => setCollapsed((c) => !c);
  return (
    <section className={`esp-health${toCheck ? ' has-gaps' : ' is-clear'}`} data-testid="script-health">
      <button type="button" className="esp-health-head" aria-expanded={!collapsed} aria-controls="esp-health-list" onClick={toggle} data-testid="script-health-toggle">
        {toCheck ? <AlertTriangle size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
        <span className="esp-health-title">Ready to film?</span>
        <span className="esp-health-sum" data-testid="script-health-sum">{toCheck ? `${toCheck} to check` : 'All clear'}{tipNote}</span>
        <ChevronDown size={16} className="esp-health-chev" aria-hidden="true" />
      </button>
      {!collapsed && fixable.length > 1 && onFix && (
        <div className="esp-health-fixall">
          <button type="button" className="esp-btn-primary is-small" data-testid="script-health-fix-all" disabled={busy} onClick={() => onFix(null)}>
            Fix all {fixable.length}
          </button>
        </div>
      )}
      {/* The list is always there, hidden while folded, so aria-controls
          names an element (Script page audit, 2026-10-19). */}
      <ul className="esp-health-list" id="esp-health-list" hidden={collapsed}>
        {!collapsed && rows.map((r) => (
          <li key={r.key} className={r.advice && !r.ok ? 'is-tip' : r.ok ? 'is-ok' : r.low ? 'is-low' : 'is-gap'} data-testid={`script-health-${r.key}`} data-ok={r.ok ? 'true' : 'false'}>
            {r.advice && !r.ok ? <Lightbulb size={14} aria-label="Tip" /> : r.ok ? <Check size={14} aria-label="OK" /> : r.low ? <Info size={14} aria-label="Note" /> : <AlertTriangle size={14} aria-label="To check" />}
            <span className="esp-health-text">{shownText(r.text)}{r.timings && <ScriptPacingList timings={r.timings} />}</span>
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
    </section>
  );
}

/**
 * StartConfirmDialog — Start Episode with warnings open (Task #1775):
 * each warning and its consequence, the money warnings, Go back / Start
 * Anyway.
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { AlertTriangle, X, ArrowLeft, PlayCircle } from 'lucide-react';

export default function StartConfirmDialog({ readiness, moneyWarnings, confirmCount, start }) {
  const { starting, setStartConfirmOpen, handleStartEpisode } = start;
  return (
    <div className="epp-modal-backdrop" onClick={() => { if (!starting) setStartConfirmOpen(false); }}>
      <div className="epp-modal epp-start-confirm" role="dialog" aria-modal="true" aria-label="Start Episode with warnings" data-testid="start-confirm" onClick={(e) => e.stopPropagation()}>
        <div className="epp-modal-header">
          <h3><AlertTriangle size={15} aria-hidden="true" /> Start with {confirmCount} warning{confirmCount === 1 ? '' : 's'}?</h3>
          <button className="epp-icon-btn" onClick={() => setStartConfirmOpen(false)} aria-label="Close" disabled={starting}>
            <X size={16} />
          </button>
        </div>
        <ul className="epp-start-warnings">
          {readiness.warningItems.map((w) => (
            <li key={`${w.section}.${w.key}`} data-testid={`start-warning-${w.section}-${w.key}`}>
              <div className="epp-start-warning-head">{w.sectionLabel}: {w.label}{w.note ? <span className="epp-rsection-note"> · {w.note}</span> : null}</div>
              {w.consequence && <div className="epp-start-warning-consequence">{w.consequence}</div>}
            </li>
          ))}
          {moneyWarnings.map((w) => (
            <li key={w.code} data-testid={`start-money-warning-${w.code}`}>
              <div className="epp-start-warning-head">Money: {w.code === 'PROJECTED_BELOW_ZERO' ? 'projected balance below zero' : 'costs exceed her balance'}</div>
              <div className="epp-start-warning-consequence">{w.message}</div>
            </li>
          ))}
        </ul>
        <div className="epp-start-confirm-actions">
          <button type="button" className="epp-btn epp-btn-secondary" onClick={() => setStartConfirmOpen(false)} disabled={starting} data-testid="start-go-back">
            <ArrowLeft size={15} /> Go back
          </button>
          <button type="button" className="epp-btn epp-btn-primary" onClick={handleStartEpisode} disabled={starting} data-testid="start-anyway">
            <PlayCircle size={15} /> {starting ? 'Starting…' : 'Start Anyway'}
          </button>
        </div>
      </div>
    </div>
  );
}

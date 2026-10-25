/**
 * ReadinessDetails — "What each section needs" (the old Review, Task
 * #1775, under its old anchor #epp-sec-review), folded inside the sticky
 * readiness bar: each section's state and what is missing, and the money
 * warnings.
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { CheckCircle2, Lock, AlertTriangle, CircleDashed, PackagePlus } from 'lucide-react';
import { READINESS_ICONS } from '../../lib/eventPackageFields';

export default function ReadinessDetails({ readiness, gatesMet, confirmCount, used, moneyWarnings, startedFrom, organizerSaving, acceptStartedFromOrganizer }) {
  return (
    <details className="epp-strip-details" id="epp-sec-review" data-testid="readiness-details">
      <summary>What each section needs</summary>
        <div className="epp-readiness" data-testid="readiness">
          <span className={`epp-readiness-label ${gatesMet ? 'is-ready' : ''}`} data-testid="readiness-label">{gatesMet ? 'READY' : 'PRE-FLIGHT'}</span>
          <span className="epp-readiness-summary">
            {gatesMet
              ? (confirmCount ? `Start Episode is open. ${confirmCount} warning${confirmCount === 1 ? '' : 's'} to review.` : 'Every section is complete.')
              : `${readiness.blockingItems.length} item${readiness.blockingItems.length === 1 ? '' : 's'} must be set before Start Episode.`}
          </span>
        </div>
        <ul className="epp-rsections">
          {readiness.sections.map((sec) => {
            const Icon = READINESS_ICONS[sec.key] || PackagePlus;
            const { kind } = sec;
            return (
              <li key={sec.key} className={`epp-rsection is-${kind}`} data-testid={`readiness-${sec.key}`} data-state={kind}>
                <div className="epp-rsection-head">
                  <Icon size={14} aria-hidden="true" />
                  <span className="epp-rsection-label">{sec.label}</span>
                  <span className="epp-rsection-state">
                    {kind === 'complete'
                      ? <><CheckCircle2 size={12} aria-hidden="true" /> Complete</>
                      : kind === 'blocking'
                        ? <><Lock size={12} aria-hidden="true" /> Blocks Start Episode</>
                        : <><AlertTriangle size={12} aria-hidden="true" /> Warning</>}
                  </span>
                </div>
                {!sec.complete && (
                  <ul className="epp-rsection-missing">
                    {sec.missing.map((m) => (
                      <li
                        key={m.key} className={m.gate ? 'is-gate' : 'is-warn'}
                        data-testid={`readiness-missing-${sec.key}-${m.key}`} data-item-state={m.state} data-gate={m.gate ? 'true' : 'false'}
                      >
                        <span className="epp-rsection-item">
                          {m.gate ? <Lock size={11} aria-hidden="true" /> : <CircleDashed size={11} aria-hidden="true" />} {m.label}
                          {m.note && <span className="epp-rsection-note"> · {m.note}</span>}
                        </span>
                        {sec.key === 'organizer' && m.key === 'organizer' && startedFrom?.suggestOrganizer && (
                          <button
                            type="button" className="epp-inline-link" data-testid="readiness-organizer-accept"
                            onClick={acceptStartedFromOrganizer} disabled={organizerSaving}
                          >
                            Use {startedFrom.name}
                          </button>
                        )}
                        {!m.gate && m.consequence && <span className="epp-rsection-consequence">{m.consequence}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        {!used && moneyWarnings.length > 0 && (
          <div className="epp-money-warnings" role="note" data-testid="money-warnings">
            <div className="epp-money-warnings-head"><AlertTriangle size={13} aria-hidden="true" /> Money</div>
            <ul>
              {moneyWarnings.map((w) => <li key={w.code} data-testid={`money-warning-${w.code}`}>{w.message}</li>)}
            </ul>
            <p className="epp-money-warnings-note">A warning only: Start Episode stays open.</p>
          </div>
        )}
    </details>
  );
}

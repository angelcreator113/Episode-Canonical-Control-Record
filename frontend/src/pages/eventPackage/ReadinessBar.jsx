/**
 * ReadinessBar — the Event Package's one sticky readiness bar (Evoni,
 * 2026-10-23: "I want them all"). It replaces the three places readiness
 * used to show (the strip's tiles, the next-step bar and the footer action
 * bar): "N of M ready", the next step, Lala's balance, and Continue / Start
 * Episode. The count is a disclosure: it opens the list of sections (what
 * the strip's tiles were), each jumping to its section, with the old
 * "What each section needs" fold (`children`) under it.
 *
 * The page owns every rule (what is gated, what Continue opens, when Start
 * may run); this only lays them out.
 */
import { useEffect, useRef } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Coins, Keyboard, Lock, Pencil, PlayCircle } from 'lucide-react';
import { readinessTile, readinessHeadline } from '../../lib/eventPackageHero';

const coins = (n) => Number(n || 0).toLocaleString();
const nextStepLabel = (it) => (it.label === it.sectionLabel ? it.label : `${it.sectionLabel}: ${it.label.toLowerCase()}`);

/** Lala's balance as the bar's chip reads it: { text, tone } or null. */
export function balanceChip({ moneyStatus, moneyPreview, warningCount = 0 }) {
  if (moneyStatus === 'loading') return { text: 'Lala: checking…', tone: 'muted' };
  if (moneyStatus === 'failed') return { text: 'Lala: couldn’t check', tone: 'warn' };
  if (!moneyPreview || moneyPreview.balance === undefined || moneyPreview.balance === null) return null;
  const after = moneyPreview.projection?.projected_balance;
  const hasAfter = after !== undefined && after !== null;
  return {
    text: `Lala: ${coins(moneyPreview.balance)} coins`,
    after: hasAfter ? `after: ${coins(after)}` : null,
    tone: warningCount > 0 ? 'warn' : 'ok',
  };
}

export default function ReadinessBar({
  readiness, nextStep, used, gatesMet, moneyWarningCount, moneyStatus, moneyPreview,
  starting, moneyPending, open, onOpenChange, onContinue, onStart, onJump, onEditDetails,
  onShowShortcuts, children,
}) {
  const panelRef = useRef(null);
  const countRef = useRef(null);

  // Escape inside the open list closes it and returns to the count.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || !panelRef.current?.contains(document.activeElement)) return;
      e.stopPropagation();
      onOpenChange(false);
      countRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const chip = used ? null : balanceChip({ moneyStatus, moneyPreview, warningCount: moneyWarningCount });
  const kind = used ? 'used' : gatesMet ? 'ready' : nextStep.kind;

  const count = (
    <button
      type="button" ref={countRef} className="epp-next-count" data-testid="package-next-count"
      aria-expanded={open} aria-controls="epp-bar-panel" onClick={() => onOpenChange(!open)}
    >
      {nextStep.done} of {nextStep.total} ready
      {open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
    </button>
  );

  return (
    <section className={`epp-bar${open ? ' is-open' : ''}`} id="epp-readiness" data-testid="readiness-strip" aria-label="Readiness">
      {used ? (
        <div className="epp-next is-used" data-testid="package-locked-bar">
          {count}
          <span className="epp-next-text"><Lock size={13} aria-hidden="true" /> Locked at Start Episode</span>
        </div>
      ) : (
        <div className={`epp-next is-${kind}`} data-testid="package-next" data-kind={nextStep.kind}>
          {count}
          <span className="epp-next-text">
            {nextStep.next
              ? <>{nextStep.kind === 'gate' ? 'Needed to start' : 'Recommended'}: {nextStepLabel(nextStep.next)}</>
              : 'Every section is complete.'}
          </span>
          {chip && (
            <span className={`epp-balance-chip is-${chip.tone}`} data-testid="balance-chip" data-tone={chip.tone}>
              <Coins size={12} aria-hidden="true" /> {chip.text}
              {chip.after && <span className="epp-balance-after"> · {chip.after}</span>}
            </span>
          )}
          {nextStep.kind === 'warning' && (
            <button
              type="button" className="epp-btn epp-btn-small epp-btn-secondary"
              data-testid="package-continue" onClick={() => onContinue(nextStep.next)}
            >
              Review
            </button>
          )}
          {gatesMet ? (
            <button
              type="button" className="epp-btn epp-btn-small epp-btn-primary epp-next-btn"
              data-testid="start-episode" onClick={onStart} disabled={starting || moneyPending}
              title={moneyPending ? 'Checking Lala’s money first' : undefined}
            >
              <PlayCircle size={14} aria-hidden="true" /> {starting ? 'Starting…' : moneyPending ? 'Checking money…' : 'Start Episode'}
            </button>
          ) : (
            <button
              type="button" className="epp-btn epp-btn-small epp-btn-primary epp-next-btn"
              data-testid="package-continue" onClick={() => onContinue(nextStep.next)}
            >
              Continue <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div id="epp-bar-panel" className="epp-bar-panel" ref={panelRef} hidden={!open} data-testid="readiness-panel">
        <div className="epp-strip-head">
          <span className="epp-strip-eyebrow">Readiness</span>
          <strong className="epp-strip-headline">{used ? 'Locked at Start Episode' : readinessHeadline(readiness, moneyWarningCount)}</strong>
        </div>
        <ul className="epp-strip-tiles">
          {readiness.sections.map((sec) => {
            const tile = readinessTile(sec);
            const anchor = sec.key === 'organizer' ? 'people' : sec.key;
            return (
              <li key={sec.key}>
                <a
                  className={`epp-strip-tile is-${tile.kind}`} href={`#epp-sec-${anchor}`}
                  data-testid={`strip-${sec.key}`} data-state={tile.kind}
                  onClick={(e) => { e.preventDefault(); onJump(anchor); }}
                >
                  <strong>{tile.label}</strong>
                  <span>{tile.text}</span>
                </a>
              </li>
            );
          })}
        </ul>
        {children}
        <div className="epp-bar-panel-foot">
          {onShowShortcuts && (
            <button type="button" className="epp-inline-link epp-shortcuts-link" onClick={onShowShortcuts} data-testid="shortcuts-open">
              <Keyboard size={13} aria-hidden="true" /> Keyboard shortcuts
            </button>
          )}
          {!used && (
            <button type="button" className="epp-btn epp-btn-small epp-btn-secondary" onClick={onEditDetails}>
              <Pencil size={13} aria-hidden="true" /> Edit details
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

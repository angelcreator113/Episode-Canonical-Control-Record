/**
 * EventFlowHeader — under the Event Package's header (Evoni, 2026-10-25:
 * "I want them all and show me first"): where the event is, Idea → Set up →
 * Invited → Ready → In an episode → Done, with what moves it on; and what is
 * left to set up, the same entries the Season page's card counts ("3 to set
 * up"), each jumping to where it is set and ticking off as she fills it in,
 * under the reason Start Episode can't run yet.
 *
 * The page's useEventFlow works it all out (lib/eventFlow); this lays it out.
 */
import { useState } from 'react';
import { CheckCircle2, Circle, CircleDot } from 'lucide-react';
import BlockedReason from './BlockedReason';
import './EventFlowHeader.css';

/** The stages as a row of steps; tapping one shows what moves the event on to it. */
export function StageTracker({ stage }) {
  const [picked, setPicked] = useState(null);
  if (!stage) return null;
  const shown = stage.stages.find((s) => s.key === picked) || stage.next || stage.stages.find((s) => s.state === 'current');
  const current = stage.stages.find((s) => s.state === 'current');
  return (
    <div className="eft" data-testid="stage-tracker" data-stage={stage.current}>
      <ol className="eft-steps" aria-label="Where this event is">
        {stage.stages.map((s) => {
          const Icon = s.state === 'done' ? CheckCircle2 : s.state === 'current' ? CircleDot : Circle;
          return (
            <li key={s.key} className={`eft-step is-${s.state}${shown?.key === s.key ? ' is-shown' : ''}`}>
              <button
                type="button" className="eft-step-btn" onClick={() => setPicked(s.key)} aria-pressed={shown?.key === s.key}
                aria-current={s.state === 'current' ? 'step' : undefined} data-testid={`stage-${s.key}`} data-state={s.state}
              >
                <Icon size={16} aria-hidden="true" className="eft-step-icon" />
                <span className="eft-step-label">{s.label}</span>
                <span className="epp-sr-only"> ({s.state === 'done' ? 'reached' : s.state === 'current' ? 'now' : 'not yet'})</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="eft-hint" data-testid="stage-hint" aria-live="polite">
        <strong>Now: {current?.label}.</strong> {shown && shown.key !== current?.key ? shown.hint : current?.hint}.
      </p>
    </div>
  );
}

/** "N to set up": each entry a jump; filled-in ones stay, ticked. */
export function SetupChecklist({ sections, left, reasons, onJump, onAction }) {
  if (!sections?.length) return null;
  return (
    <div className="efs" data-testid="setup-checklist" data-left={left}>
      <div className="efs-head">
        <strong className="efs-count" data-testid="setup-count">{left ? `${left} to set up` : 'All set up'}</strong>
        {left === 0 && <span className="efs-done-note"> · everything Start Episode needs is set</span>}
      </div>
      <BlockedReason reason={reasons?.start} onAction={onAction} testId="blocked-start" className="efs-reason" />
      <ul className="efs-list">
        {sections.map((s) => (
          <li key={s.key}>
            <button
              type="button" className={`efs-item${s.done ? ' is-done' : ''}`} data-testid={`setup-item-${s.key}`} data-done={s.done ? 'true' : 'false'}
              onClick={() => onJump(s)}
            >
              {s.done ? <CheckCircle2 size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
              <span className="efs-item-label">{s.label}</span>
              {s.done && <span className="epp-sr-only"> (done)</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function EventFlowHeader({ flow, used }) {
  return (
    <section className="efh" ref={flow.headerRef} data-testid="event-flow-header" aria-label="Progress">
      <StageTracker stage={flow.stage} />
      {!used && (
        <SetupChecklist sections={flow.sections} left={flow.leftToSetUp} reasons={flow.reasons} onJump={flow.jump} onAction={flow.runAction} />
      )}
      {!used && !flow.sections.length && <BlockedReason reason={flow.reasons.start} onAction={flow.runAction} testId="blocked-start" />}
    </section>
  );
}

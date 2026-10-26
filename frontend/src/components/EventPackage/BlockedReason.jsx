/**
 * BlockedReason — why something on the Event Package can't run yet, in
 * words, with the step that unblocks it beside (Evoni, 2026-10-25: "say why
 * something is blocked"): "Deal prices need a deal type first · Pick one".
 * It sits where the control is, instead of a disabled button saying nothing.
 * The reasons themselves are lib/eventFlow's blockedReasons.
 */
import { Lock, ArrowRight } from 'lucide-react';
import './BlockedReason.css';

export default function BlockedReason({ reason, onAction, testId = 'blocked-reason', className = '' }) {
  if (!reason?.text) return null;
  const { action } = reason;
  return (
    <p className={`ebr${className ? ` ${className}` : ''}`} data-testid={testId} role="note">
      <Lock size={12} aria-hidden="true" className="ebr-icon" />
      <span className="ebr-text">{reason.text}</span>
      {action && onAction && (
        <>
          <span className="ebr-dot" aria-hidden="true"> · </span>
          <button type="button" className="ebr-action" onClick={() => onAction(action)} data-testid={`${testId}-action`}>
            {action.label} <ArrowRight size={12} aria-hidden="true" />
          </button>
        </>
      )}
    </p>
  );
}

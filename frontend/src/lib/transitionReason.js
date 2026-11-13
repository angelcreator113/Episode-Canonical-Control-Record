/**
 * The reason an opportunity's step needs (Evoni's A1 ruling, 2026-11-13):
 * declining, cancelling, undoing a step, and starting an episode without
 * accepting its offer are recorded with who did it and why
 * (services/opportunityTransitionAudit on the server, which refuses them
 * without one).
 */
export const REASON_MAX = 500;

/** The decisions at Start Episode that need a reason. */
export const REASON_REQUIRED_DECISIONS = ['decline', 'proceed_unaccepted'];

/** A typed reason as it is sent: trimmed and no longer than the server keeps; '' when there is none. */
export function cleanReason(value) {
  return typeof value === 'string' ? value.trim().slice(0, REASON_MAX) : '';
}

/** Asks for the reason. Returns it, or null when none was given (the step is then not taken). */
export function askReason(question) {
  const reason = cleanReason(window.prompt(question));
  return reason || null;
}

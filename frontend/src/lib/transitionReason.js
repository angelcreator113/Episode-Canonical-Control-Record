/**
 * The reason an opportunity's step needs (Evoni's A1 ruling, 2026-11-13):
 * declining, cancelling, undoing a step, and starting an episode without
 * accepting its offer are recorded with who did it and why
 * (services/opportunityTransitionAudit on the server, which refuses them
 * without one). The reason is asked for in the page: OfferDecisionDialog at
 * Start Episode, ReasonDialog everywhere else.
 */
export const REASON_MAX = 500;

/** The decisions at Start Episode that need a reason. */
export const REASON_REQUIRED_DECISIONS = ['decline', 'proceed_unaccepted'];

/** A typed reason as it is sent: trimmed and no longer than the server keeps; '' when there is none. */
export function cleanReason(value) {
  return typeof value === 'string' ? value.trim().slice(0, REASON_MAX) : '';
}

/**
 * What to say when starting with a decision failed for a reason that is not
 * about the offer: the network, a server error, another refusal. The same
 * shape as the app's other save messages (lib/showEdit saveErrorText,
 * lib/wardrobeAddPiece): the server's own words when it gave any, a plain
 * sentence when the server could not be reached.
 */
export function startFailedText(err) {
  const data = err?.response?.data || {};
  const raw = data.error || data.message || err?.message || '';
  if (!err?.response && /Network Error|Failed to fetch|NetworkError|ERR_|timeout/i.test(raw)) {
    return "Couldn't reach the server, so the episode may not have started. Your reason is still here.";
  }
  if (err?.response?.status >= 500) return raw ? `The server could not start the episode: ${raw}` : 'The server could not start the episode.';
  return raw ? `The episode was not started: ${raw}` : 'The episode was not started.';
}

/**
 * Completing an episode: the one operation, for every screen that offers it
 * (Evoni, 2026-11-12).
 *
 * It calls the existing authoritative endpoint,
 *   POST /api/v1/world/:showId/episodes/:episodeId/complete
 * which runs services/episodeCompletionService completeEpisode with all of
 * its checks (terms, coins, second events, two-parters, filmed protections).
 * Nothing is decided here: this only asks, and puts the server's answer into
 * words the page can keep on screen.
 *
 * The episode is named by its own id. The event's link back to the episode
 * is never needed: the server finds the episode's event from its brief.
 */
import api from '../services/api';
import { completeMoneyWarning } from '../utils/moneyWarnings';

export const COMPLETE_CONFIRM = (title) => (
  `Complete ${title ? `"${title}"` : 'this episode'}?\n\n`
  + 'This evaluates the episode, books its money in the ledger, pays its deals and updates Lala\'s stats and goals.\n\n'
  + 'It is final: a completed episode is not evaluated again.'
);

/** What each known refusal means, and where to go to resolve it. `to` is built by actionFor(). */
const KNOWN = {
  AUTH_GROUP_REQUIRED: { title: 'Only an admin can complete an episode', action: null },
  AUTH_REQUIRED: { title: 'Sign in to complete the episode', action: null },
  EVENT_TERMS_REOPENED: { title: 'The event\'s terms are reopened', action: 'event' },
  INSUFFICIENT_COINS: { title: 'Not enough coins to complete', action: 'money' },
  UNSUPPORTED_SECONDARY_OBLIGATIONS: { title: 'A second event has commitments that cannot be booked yet', action: 'events' },
  EPISODE_EVENT_LINK_INCONSISTENT: { title: 'This episode\'s events need repairing first', action: 'events' },
  TWO_PART_TO_BE_CONTINUED: { title: 'This is Part 1 of a two-parter', action: 'season' },
  TWO_PART_REFUSED: { title: 'This two-parter cannot complete yet', action: 'season' },
  RETRY: { title: 'Something else was saving at the same moment', action: 'retry' },
  // Milestone attribution (Evoni, 2026-11-13): the refusal carries the rewards in question.
  MILESTONE_ATTRIBUTION_REQUIRED: { title: 'A milestone reward needs an admin\'s decision', action: null },
  MILESTONE_DECISION_STALE: { title: 'The rewards in question have changed', action: null },
  MILESTONE_DECISION_INVALID: { title: 'That milestone decision could not be read', action: null },
};

/** What an admin may say of a reward in question. Anything else leaves it undecided. */
export const MILESTONE_DECISIONS = [
  { value: '', label: 'Leave undecided' },
  { value: 'this_episode', label: 'This episode\'s' },
  { value: 'not_this_episode', label: 'Not this episode\'s' },
];

function actionFor(kind, { showId, episodeId, eventId }) {
  if (kind === 'money') return { label: 'Open Money', tab: 'money' };
  if (kind === 'events') return { label: 'Open this episode\'s events', tab: 'overview' };
  if (kind === 'event' && showId && eventId) return { label: 'Open the event package', to: `/shows/${showId}/events/${eventId}` };
  if (kind === 'event') return { label: 'Open this episode\'s events', tab: 'overview' };
  if (kind === 'season' && showId) return { label: 'Open the Season Roadmap', to: `/shows/${showId}/season?tab=roadmap` };
  if (kind === 'retry') return { label: 'Try again', retry: true };
  return null;
}

/**
 * A refusal the page keeps on screen: { status, code, title, message, action }.
 * message is the server's own words whenever it sent any.
 */
export function completionRefusal(err, ids = {}) {
  const status = err?.response?.status ?? null;
  const body = err?.response?.data || {};
  const code = typeof body.code === 'string' ? body.code : null;
  const known = (code && KNOWN[code]) || null;
  const message = body.error && typeof body.error === 'string' && body.error !== 'Forbidden' && body.error !== 'Unauthorized'
    ? body.error
    : (code === 'AUTH_GROUP_REQUIRED' ? 'Completing books money and changes Lala\'s stats for good, so it needs an admin account. Nothing was changed.'
      : (typeof body.message === 'string' && body.message) || err?.message || 'The episode could not be completed. Nothing was changed.');
  return {
    status,
    code,
    title: known?.title || (status && status >= 500 ? 'The server could not complete the episode' : 'The episode was not completed'),
    message,
    action: actionFor(known?.action, { ...ids, eventId: ids.eventId || body.event?.id || null }),
    // The milestone rewards in question, and those still undecided, when the server names them.
    ...(Array.isArray(body.candidates) ? { candidates: body.candidates, undecided: Array.isArray(body.undecided) ? body.undecided : [] } : {}),
  };
}

/**
 * Ask the server to complete the episode.
 *   confirm(message) -> boolean   asked first, and again for a money warning
 *   milestoneDecisions            { [reward row id]: 'this_episode' | 'not_this_episode' },
 *                                 an admin's answer to a MILESTONE_ATTRIBUTION_REQUIRED
 *                                 refusal. Sent as given; a reward left out stays
 *                                 undecided. The admin confirmed on the first
 *                                 attempt, so this one is not asked again.
 * Resolves:
 *   { status: 'cancelled' }
 *   { status: 'completed', data }          completed by this request
 *   { status: 'already', data }            it was completed before: nothing was booked again
 *   { status: 'refused', refusal }         nothing was changed; refusal is completionRefusal()
 */
export async function completeEpisode({ showId, episodeId, title = null, eventId = null, confirm = (m) => window.confirm(m), milestoneDecisions = null } = {}) {
  if (!showId || !episodeId) {
    return { status: 'refused', refusal: { status: null, code: null, title: 'The episode was not completed', message: 'This episode\'s show could not be read, so it cannot be completed from here.', action: null } };
  }
  if (!milestoneDecisions) {
    if (!confirm(COMPLETE_CONFIRM(title))) return { status: 'cancelled' };
    // MB4 (§8(gg)): warn early on money; never blocks.
    const moneyWarning = await completeMoneyWarning(showId, episodeId);
    if (moneyWarning && !confirm(moneyWarning)) return { status: 'cancelled' };
  }
  try {
    const res = milestoneDecisions
      ? await api.post(`/api/v1/world/${showId}/episodes/${episodeId}/complete`, { milestone_decisions: milestoneDecisions })
      : await api.post(`/api/v1/world/${showId}/episodes/${episodeId}/complete`);
    const data = res.data?.data || {};
    return { status: data.already_completed ? 'already' : 'completed', data };
  } catch (err) {
    console.error('[episodeCompletion] completion refused or failed:', err);
    return { status: 'refused', refusal: completionRefusal(err, { showId, episodeId, eventId }) };
  }
}

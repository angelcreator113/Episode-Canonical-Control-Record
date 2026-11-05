'use strict';

/**
 * The opportunity pipeline's legal steps: each status and the statuses one
 * Advance may move it to. Moved here unchanged from routes/opportunityRoutes
 * (which still uses it for Advance) so Start Episode's offer decision
 * (services/startOfferDecision) walks the same steps.
 */
const STATUS_FLOW = Object.freeze({
  offered: ['considering', 'declined'],
  considering: ['negotiating', 'declined'],
  negotiating: ['booked', 'declined'],
  booked: ['preparing', 'cancelled'],
  preparing: ['active', 'cancelled'],
  active: ['completed'],
  completed: ['paid', 'archived'],
  paid: ['archived'],
  declined: ['archived'],
  expired: ['archived'],
  cancelled: ['archived'],
});

/**
 * The legal steps from `from` to `to`, shortest first: [] when already
 * there, null when STATUS_FLOW has no way (e.g. from 'held', which only
 * beat 14 moves). Pure.
 */
function statusPath(from, to) {
  if (from === to) return [];
  const seen = new Set([from]);
  const queue = [[from, []]];
  while (queue.length) {
    const [at, path] = queue.shift();
    for (const next of STATUS_FLOW[at] || []) {
      if (seen.has(next)) continue;
      const nextPath = [...path, next];
      if (next === to) return nextPath;
      seen.add(next);
      queue.push([next, nextPath]);
    }
  }
  return null;
}

module.exports = { STATUS_FLOW, statusPath };

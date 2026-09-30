'use strict';

/**
 * An event's paid and free flags, as money reads them. A paid, free or deal
 * event is never charged its entry cost, and only a paid event earns its
 * payment.
 *
 * Shared by Finalize (financialTransactionService), Complete's paid-bonus
 * gate (episodeCompletionService, Task #2313) and Episode Money's expected
 * lines, so the three agree. It is a pure function with no dependencies, so
 * a test that mocks the financial service still gets the real rule.
 */
function normalizePaidFreeFlags(event) {
  const truthy = new Set([true, 1, '1', 'true', 'yes', 'y']);
  const isPaid = truthy.has(event?.is_paid);
  const isFree = truthy.has(event?.is_free);
  // A deal event (deal_type set) is never charged cost_coins: it keeps it
  // as difficulty only (Law 0), and its costs are its itemised event_costs
  // rows (deal build PR 4, Task #2365; docs/DEAL_DESIGN.md §5).
  const isDeal = Boolean(event?.deal_type);
  const eventCost = (isDeal || isFree || isPaid) ? 0 : (Number(event?.cost_coins) || 0);
  const eventPayment = isPaid ? (parseFloat(event?.payment_amount) || 0) : 0;
  return { isPaid, isFree, isDeal, eventCost, eventPayment };
}

module.exports = { normalizePaidFreeFlags };

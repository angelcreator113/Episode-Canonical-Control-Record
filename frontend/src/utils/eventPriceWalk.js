/**
 * "Price N items" in the Event Package's Terms (Evoni, 2026-10-23): every
 * line still reading "Price required", in the order the Terms show them,
 * and the walk through them one save at a time.
 *
 * unpricedItems: the deliverables whose fee the deal needs and is missing
 * (describeDeliverableFee's priceRequired), then the deal's fee components
 * with no number (missingPriceLabels' components), then the costs Lala pays
 * with no amount (missingCostPriceLabels). Each is { key, kind, id, label }:
 * kind 'deliverable' (id: the row), 'component' (id: the event column) or
 * 'cost' (id: the row).
 *
 * The walk ({ current, done }: the item open now and every item already
 * offered) lives outside React, by event, because the page remounts the
 * Terms after the refresh a save makes (its reloadTick key): the remounted
 * section carries on where the walk was. retainPriceWalk/release count the
 * mounted sections; when none is left the walk ends.
 */
import { dealPlanFor, describeDeliverableFee, deliverableTypeLabel, isDealEvent } from './eventTerms';
import { costName } from './eventCosts';

export function unpricedItems({ event, deliverables = [], costs = [] } = {}) {
  const out = [];
  for (const d of Array.isArray(deliverables) ? deliverables : []) {
    if (d && describeDeliverableFee(event, d).priceRequired) {
      out.push({ key: `deliverable:${d.id}`, kind: 'deliverable', id: d.id, label: d.description || deliverableTypeLabel(d) || 'Deliverable' });
    }
  }
  const plan = dealPlanFor(event);
  if (plan.cash) {
    for (const c of plan.components) {
      if (event?.[c.field] == null) out.push({ key: `component:${c.field}`, kind: 'component', id: c.field, label: c.label });
    }
  }
  if (isDealEvent(event)) {
    for (const c of Array.isArray(costs) ? costs : []) {
      if (c && c.paid_by === 'lala' && c.amount == null) out.push({ key: `cost:${c.id}`, kind: 'cost', id: c.id, label: costName(c) });
    }
  }
  return out;
}

/** The next item the walk has not offered yet, or null. */
export function nextUnpriced(items, done = []) {
  const seen = new Set(done);
  return (items || []).find((i) => !seen.has(i.key)) || null;
}

const walks = new Map(); // eventId -> { current, done }
const holders = new Map(); // eventId -> mounted sections

export const getPriceWalk = (eventId) => walks.get(String(eventId)) || null;

export function setPriceWalk(eventId, walk) {
  if (walk) walks.set(String(eventId), walk);
  else walks.delete(String(eventId));
  return walk || null;
}

/** A mounted Terms section holds the walk; the release ends it once none is left. */
export function retainPriceWalk(eventId) {
  const id = String(eventId);
  holders.set(id, (holders.get(id) || 0) + 1);
  return () => {
    holders.set(id, Math.max(0, (holders.get(id) || 1) - 1));
    setTimeout(() => { if (!holders.get(id)) walks.delete(id); }, 0);
  };
}

/**
 * Itemised event costs, as the Event Package shows and edits them (deal
 * build PR 4, Task #2365; docs/DEAL_DESIGN.md §5, Law 7).
 *
 * A deal event's costs are rows, each saying who pays: Lala (charged at
 * Finalize, one expense per row) or the host or brand (comped, never
 * charged). The kinds and payers mirror EventCost.KINDS / PAID_BY on the
 * server. The event's extras are drafted as rows, and a self-funded or
 * invited/comped deal's "Entry / ticket" line from its coin cost (Evoni,
 * 2026-09-30); a drafted row reads "Auto-drafted · event extras" or
 * "Auto-drafted · from event cost" until its amount changes, then Edited
 * (doctrine rule 14).
 *
 * The event cost split (Evoni, 2026-09-30): the extras are event spending,
 * edited on the episode's Money tab, so a new terms cost is never of kind
 * extras (TERMS_COST_KINDS); an extras row drafted before the split still
 * shows here and moves to the episode's spending at Start Episode.
 */

export const COST_KINDS = ['entry', 'travel', 'glam', 'styling', 'accommodation', 'extras', 'other'];

// The kinds a terms cost can be given: every kind but extras (event spending).
export const TERMS_COST_KINDS = COST_KINDS.filter((k) => k !== 'extras');

export const COST_KIND_LABELS = {
  entry: 'Entry',
  travel: 'Travel',
  glam: 'Glam',
  styling: 'Styling',
  accommodation: 'Accommodation',
  extras: 'Extras',
  other: 'Other',
};

export const COST_PAID_BY = ['lala', 'host', 'brand'];

export const COST_PAID_BY_LABELS = {
  lala: 'Lala pays',
  host: 'Comped by the host',
  brand: 'Comped by the brand',
};

export const COST_LABEL_MAX = 200;

export const costKindLabel = (kind) => COST_KIND_LABELS[kind] || kind || 'Cost';

/** The row's name: its label, else its kind. */
export const costName = (cost) => (cost?.label && String(cost.label).trim()) || costKindLabel(cost?.kind);

/** A form draft from a row, or an empty one. */
export function costDraftFrom(cost) {
  return {
    kind: cost?.kind || 'travel',
    label: cost?.label || '',
    amount: cost?.amount == null ? '' : String(cost.amount),
    paid_by: cost?.paid_by || 'lala',
  };
}

/**
 * The POST / PUT body from a draft: { body } or { error }. An empty amount
 * is null: no amount yet, "Price required" (D13 travel, 2026-09-30); Start
 * Episode waits on it while Lala pays the line.
 */
export function buildCostBody(draft) {
  const d = draft || {};
  if (!COST_KINDS.includes(d.kind)) return { error: 'Choose a kind of cost.' };
  if (!COST_PAID_BY.includes(d.paid_by)) return { error: 'Choose who pays.' };
  const raw = String(d.amount ?? '').trim();
  const amount = raw === '' ? null : Number(raw);
  if (amount !== null && (!Number.isInteger(amount) || amount < 0)) {
    return { error: 'The amount is a whole number of coins, 0 or more, or empty while the price is not known.' };
  }
  const label = String(d.label || '').trim();
  if (label.length > COST_LABEL_MAX) return { error: `The label is at most ${COST_LABEL_MAX} characters.` };
  return { body: { kind: d.kind, label: label || null, amount, paid_by: d.paid_by } };
}

/**
 * The rule 14 note for a row: a drafted row reads Auto-drafted, naming where
 * it came from (the event's cost for the entry line, Evoni's answer 2 of
 * 2026-09-30; the event's travel for travel and accommodation, D13 answer 7;
 * the event extras for rows drafted before the cost split), until its
 * amount or payer changes.
 */
export function costDraftNote(cost, drafted) {
  const record = drafted?.[cost?.id];
  if (!record) return null;
  const sameAmount = record.amount == null ? cost.amount == null : cost.amount != null && Number(record.amount) === Number(cost.amount);
  if (!sameAmount) return 'Edited';
  // D13: a record written with its payer compares it too.
  if (record.paid_by !== undefined && record.paid_by !== cost.paid_by) return 'Edited';
  if (record.source === 'travel') return 'Auto-drafted · Lala travels';
  return record.source === 'event_cost' || record.key === 'entry'
    ? 'Auto-drafted · from event cost'
    : 'Auto-drafted · event extras';
}

/** "Price required" for a line with no amount yet; else its coins. */
export function costAmountLabel(cost) {
  return cost?.amount == null ? 'Price required' : `${Number(cost.amount).toLocaleString()} coins`;
}

/** { lala, comped }: what Lala pays, and what the host or brand covers. */
export function costTotals(costs) {
  let lala = 0; let comped = 0;
  for (const c of costs || []) {
    const amount = Number(c.amount) || 0;
    if (c.paid_by === 'lala') lala += amount; else comped += amount;
  }
  return { lala, comped };
}

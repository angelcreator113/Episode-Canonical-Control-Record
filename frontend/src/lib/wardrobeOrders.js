/**
 * Producer Mode → Wardrobe → Import orders (Task 3102): pure helpers for
 * OrderImportDialog. The server reads the Amazon CSV
 * (POST /api/v1/wardrobe-orders/preview); here each previewed line gets a
 * pick (a piece, or kept for later) and an include tick, and the confirmed
 * lines go back to POST /confirm.
 */

export const KEEP_FOR_LATER = '';

/** Each new line's starting pick: its suggested piece, else kept for later; duplicates are left out. */
export function startingPicks(lines) {
  const picks = {};
  for (const l of lines || []) {
    if (l.status === 'new') picks[lineKey(l)] = { include: true, wardrobe_id: l.suggestion?.wardrobe_id || KEEP_FOR_LATER };
  }
  return picks;
}

export const lineKey = (l) => `${l.order_id}|${l.asin}`;

/** The lines to confirm: new, ticked, each with its piece or none. */
export function confirmLines(lines, picks) {
  return (lines || [])
    .filter((l) => l.status === 'new' && picks[lineKey(l)]?.include)
    .map((l) => {
      const { status: _status, suggestion: _suggestion, ...line } = l;
      return { ...line, wardrobe_id: picks[lineKey(l)].wardrobe_id || null };
    });
}

/** The closet's pieces for the picker, by name. */
export const pieceOptions = (pieces) => [...(pieces || [])]
  .filter((p) => p?.id && p?.name)
  .sort((a, b) => String(a.name).localeCompare(String(b.name)));

const money = (n, currency) => (n == null ? null : `${currency && currency !== 'USD' ? `${currency} ` : '$'}${Number(n).toFixed(2)}`);

/** "14 Sep 2026 · $48.99 · ×2" */
export function lineFacts(l) {
  const date = l.order_date
    ? new Date(`${l.order_date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : null;
  return [date, money(l.price_paid, l.currency), l.quantity > 1 ? `×${l.quantity}` : null].filter(Boolean).join(' · ');
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** "2 put on pieces, 1 kept for later, 3 already imported." */
export function summaryText(r) {
  const parts = [];
  if (r.matched) parts.push(`${plural(r.matched, 'put on a piece', 'put on pieces')}`);
  if (r.unmatched) parts.push(`${r.unmatched} kept for later`);
  if (r.duplicates) parts.push(`${r.duplicates} already imported`);
  if (r.invalid) parts.push(`${plural(r.invalid, 'line', 'lines')} could not be read`);
  return parts.length ? `${parts.join(', ')}.` : 'Nothing to import.';
}

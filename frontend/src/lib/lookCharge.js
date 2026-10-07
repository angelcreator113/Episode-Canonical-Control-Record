/**
 * What a piece of Lala's look costs, by the rule Complete charges by
 * (src/services/episodeLookCharges.js lookCharges; Evoni, 2026-10-07: one
 * rule for the look's cost). The Wardrobe and the Event Package used to add
 * up every unowned piece's coin_cost, so the same look cost three amounts:
 *   gifted or borrowed   free;
 *   rented               its rental price;
 *   owned                free;
 *   otherwise            to buy at coin_cost (price when there is none).
 * A piece the server already priced (episodeLook's `charge`) keeps that
 * price, which also knows the pieces Lala bought earlier.
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** { amount, kind: 'buy' | 'rent' | null, free: 'gifted' | 'borrowed' | 'owned' | 'bought' | null }. */
export function pieceCharge(piece) {
  if (!piece) return { amount: 0, kind: null, free: null };
  if (piece.charge !== undefined) {
    if (piece.charge) return { amount: num(piece.charge.amount), kind: piece.charge.category === 'wardrobe_rental' ? 'rent' : 'buy', free: null };
    return { amount: 0, kind: null, free: piece.free_because && piece.free_because !== 'free' ? piece.free_because : 'owned' };
  }
  const acq = piece.acquisition_type || 'purchased';
  if (acq === 'gifted' || acq === 'borrowed') return { amount: 0, kind: null, free: acq };
  if (acq === 'rented' && num(piece.rental_price) > 0) return { amount: num(piece.rental_price), kind: 'rent', free: null };
  if (piece.is_owned === true) return { amount: 0, kind: null, free: 'owned' };
  const cost = piece.coin_cost != null ? num(piece.coin_cost) : num(piece.price);
  return cost > 0 ? { amount: cost, kind: 'buy', free: null } : { amount: 0, kind: null, free: null };
}

/** What the look costs: the sum of its pieces' charges. */
export function lookTotal(pieces = []) {
  return (pieces || []).reduce((n, p) => n + pieceCharge(p).amount, 0);
}

/** A piece's cost in words: "to buy · 420 coins", "rented · 75 coins", "owned", "gifted". */
export function pieceChargeText(piece) {
  const c = pieceCharge(piece);
  if (c.kind === 'buy') return `to buy · ${c.amount.toLocaleString()} coins`;
  if (c.kind === 'rent') return `rented · ${c.amount.toLocaleString()} coins`;
  if (c.free === 'bought') return 'already bought';
  return c.free || 'free';
}

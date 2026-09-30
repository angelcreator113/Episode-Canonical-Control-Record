/**
 * Wardrobe auto-fill price (Task #2347).
 *
 * The AI's price_estimate is a suggestion. It is parsed without a floor (the
 * old 150.00 clamp is gone) and fills the price only when the form's price is
 * empty; a price already set is never overwritten.
 */

/** The AI estimate as a two-decimal string, or '' when it is not a positive number. */
export function parseAiPrice(estimate) {
  if (estimate == null) return '';
  const n = parseFloat(String(estimate).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : '';
}

/** The form's price after auto-fill: the current price when set, else the suggestion. */
export function fillPrice(currentPrice, aiPrice) {
  const current = currentPrice == null ? '' : String(currentPrice).trim();
  return current !== '' ? currentPrice : (aiPrice || '');
}

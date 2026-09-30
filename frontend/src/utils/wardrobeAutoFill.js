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

/**
 * The coin cost to suggest (Evoni, 2026-09-30). When the form already has a
 * price she set, the suggestion follows her price, 1:1, not the AI's. With
 * no price set, it is the AI's coin_cost, else the AI price. Whole coins; ''
 * when there is nothing to suggest. The form still fills it only when the
 * coin cost is empty.
 */
export function suggestCoinCost(currentPrice, aiCoinCost, aiPrice) {
  const own = currentPrice == null ? '' : String(currentPrice).trim();
  if (own !== '') {
    const n = parseFloat(own.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : '';
  }
  if (aiCoinCost != null && String(aiCoinCost).trim() !== '') {
    const n = parseInt(String(aiCoinCost).replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(n)) return n;
  }
  return aiPrice ? Math.round(parseFloat(aiPrice)) : '';
}

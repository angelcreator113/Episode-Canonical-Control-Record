/**
 * wardrobeReach — can Lala wear this wardrobe item now? (Task #1937)
 *
 * The styling game's Closet and Search tabs read GET /api/v1/wardrobe, a
 * general listing that knows nothing of Lala's coins, so they apply the
 * backend's reach rule here, to the same coins the component sends to
 * POST /wardrobe/browse-pool. This mirrors src/services/wardrobeReach.js
 * (itemReach) exactly; both test files pin the same cases. The server still
 * decides: POST /wardrobe/lock-outfit-atomic re-checks every piece against
 * the stored balance before it buys anything.
 *
 * Every piece Lala does not own is for sale at its coin_cost, except a
 * brand-exclusive or season-drop piece (Evoni's ruling, 2026-10-06). A
 * piece is within reach when it is owned (is_owned true; null is not
 * owned), or for sale and affordable. Reputation no longer gates a piece.
 */

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** The lock types that are never for sale. */
export const NOT_FOR_SALE = new Set(['brand_exclusive', 'season_drop']);

/** Whether a piece Lala does not own can be bought. */
export function isForSale(item) {
  return item?.is_owned !== true && !NOT_FOR_SALE.has(item?.lock_type);
}

export function itemReach(item, characterState = {}) {
  const coins = num(characterState?.coins);
  const owned = item?.is_owned === true;
  const coinCost = Number(item?.coin_cost) || 0;
  const forSale = isForSale(item);
  const affordable = forSale && coins >= coinCost;
  return {
    owned,
    can_select: owned || affordable,
    can_purchase: affordable,
    needs_purchase: forSale,
    coin_cost: coinCost,
  };
}

/** The item with can_select / can_purchase set by the reach rule. */
export function withReach(item, characterState) {
  const { can_select, can_purchase } = itemReach(item, characterState);
  return { ...item, can_select, can_purchase };
}

/**
 * Why Lala can't have a piece now, for the lock line on a card: not for
 * sale (brand exclusive, season drop), or short of its coins. null when
 * the piece is owned or affordable.
 */
export function lockReason(item, characterState) {
  if (item?.lock_type === 'brand_exclusive' && item?.is_owned !== true) return 'Brand exclusive · not for sale';
  if (item?.lock_type === 'season_drop' && item?.is_owned !== true) {
    return item?.season_unlock_episode ? `Drops Ep ${item.season_unlock_episode} · not for sale` : 'Season drop · not for sale';
  }
  if (itemReach(item, characterState).can_select) return null;
  return `Need ${Number(item?.coin_cost) || 0} coins`;
}

/**
 * What a matching set costs Lala: the coins for its pieces she doesn't own
 * and can buy, and the pieces that are not for sale.
 */
export function setCost(pieces = []) {
  const toBuy = pieces.filter(isForSale);
  return {
    cost: toBuy.reduce((n, p) => n + (Number(p.coin_cost) || 0), 0),
    toBuy,
    notForSale: pieces.filter((p) => p?.is_owned !== true && !isForSale(p)),
  };
}

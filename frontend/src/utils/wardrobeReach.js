/**
 * wardrobeReach — can Lala wear this wardrobe item now? (Task #1937)
 *
 * The styling game's Closet and Search tabs read GET /api/v1/wardrobe, a
 * general listing that knows nothing of Lala's coins or reputation, so they
 * apply the backend's reach rule here, to the same coins and reputation the
 * component sends to POST /wardrobe/browse-pool. This mirrors
 * src/services/wardrobeReach.js (itemReach) exactly; both test files pin the
 * same cases. The server still decides: POST /wardrobe/lock-outfit-atomic
 * re-checks every piece against the stored balance before it buys anything.
 *
 * An item is within reach when it is owned (is_owned true; null is not
 * owned), coin-locked and affordable, or reputation-locked and qualified.
 * Missing reputation counts as 0, as /wardrobe/select counts it.
 */

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function itemReach(item, characterState = {}) {
  const coins = num(characterState?.coins);
  const reputation = num(characterState?.reputation);
  const owned = item?.is_owned === true;
  const coinCost = Number(item?.coin_cost) || 0;
  const coinLocked = !owned && item?.lock_type === 'coin';
  const repOk = !owned && item?.lock_type === 'reputation'
    && reputation >= (Number(item?.reputation_required) || 0);
  const affordable = coinLocked && coins >= coinCost;
  return {
    owned,
    can_select: owned || repOk || affordable,
    can_purchase: affordable,
    needs_purchase: coinLocked,
    coin_cost: coinCost,
  };
}

/** The item with can_select / can_purchase set by the reach rule. */
export function withReach(item, characterState) {
  const { can_select, can_purchase } = itemReach(item, characterState);
  return { ...item, can_select, can_purchase };
}

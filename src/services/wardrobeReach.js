'use strict';

/**
 * wardrobeReach — can Lala wear this wardrobe item now? (Task #1937)
 *
 * One rule, used by POST /wardrobe/browse-pool (each item's can_select /
 * can_purchase and the pool's required-slot guarantee) and by
 * POST /wardrobe/lock-outfit-atomic (the up-front check before anything is
 * bought or linked). An item is within reach when it is:
 *   - owned (is_owned true; null counts as not owned, as /wardrobe/select
 *     treats it), or
 *   - coin-locked and Lala has at least its coin_cost, or
 *   - reputation-locked and Lala's reputation is at least reputation_required.
 * Brand-exclusive and season-drop items, and unowned items with no lock,
 * are out of reach.
 *
 * Reputation that is missing counts as 0, the same as /wardrobe/select
 * (`req.body.reputation || 0`). browse-pool used `|| 1`, so with no
 * reputation it offered reputation-1 items that /select then refused.
 *
 * The styling game's Closet and Search tabs apply the same rule from
 * frontend/src/utils/wardrobeReach.js (itemReach), which mirrors this one;
 * both test files pin the same cases.
 */

function toCharacter(characterState = {}) {
  const coins = Number(characterState?.coins);
  const reputation = Number(characterState?.reputation);
  return {
    coins: Number.isFinite(coins) ? coins : 0,
    reputation: Number.isFinite(reputation) ? reputation : 0,
  };
}

/**
 * @param {object} item — a wardrobe row (is_owned, lock_type, coin_cost, reputation_required)
 * @param {{ coins?: number, reputation?: number }} characterState
 * @returns {{ owned: boolean, can_select: boolean, can_purchase: boolean,
 *   needs_purchase: boolean, coin_cost: number }}
 *   needs_purchase: selecting it spends coin_cost (coin-locked, not owned).
 */
function itemReach(item, characterState) {
  const { coins, reputation } = toCharacter(characterState);
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

module.exports = { itemReach, toCharacter };

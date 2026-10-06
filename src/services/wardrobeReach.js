'use strict';

/**
 * wardrobeReach — can Lala wear this wardrobe item now? (Task #1937)
 *
 * One rule, used by POST /wardrobe/browse-pool (each item's can_select /
 * can_purchase and the pool's required-slot guarantee) and by
 * POST /wardrobe/lock-outfit-atomic (the up-front check before anything is
 * bought or linked), and by /wardrobe/purchase and /wardrobe/select.
 *
 * Every piece Lala does not own is for sale at its coin_cost, except a
 * brand-exclusive or season-drop piece (Evoni's ruling, 2026-10-06: "All of
 * them buyable unless brand-exclusive and season-drop"). A piece is within
 * reach when it is owned (is_owned true; null counts as not owned), or for
 * sale and Lala has at least its coin_cost. Reputation no longer gates a
 * piece (it unlocked one for free before); a reputation-locked piece is
 * bought like the rest. Before, only coin-locked pieces could be bought, so
 * an unowned piece with no lock showed Locked with no way to buy it.
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

// The lock types that are never for sale.
const NOT_FOR_SALE = new Set(['brand_exclusive', 'season_drop']);

/** Whether a piece Lala does not own can be bought (the ruling above). */
function isForSale(item) {
  return item?.is_owned !== true && !NOT_FOR_SALE.has(item?.lock_type);
}

/**
 * @param {object} item — a wardrobe row (is_owned, lock_type, coin_cost)
 * @param {{ coins?: number, reputation?: number }} characterState
 * @returns {{ owned: boolean, can_select: boolean, can_purchase: boolean,
 *   needs_purchase: boolean, coin_cost: number }}
 *   needs_purchase: selecting it spends coin_cost (for sale, not owned).
 */
function itemReach(item, characterState) {
  const { coins } = toCharacter(characterState);
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

module.exports = { itemReach, isForSale, toCharacter, NOT_FOR_SALE };

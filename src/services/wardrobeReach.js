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
 * A price is required (Evoni's ruling, 2026-10-14, Task #3143): a piece Lala
 * does not own and whose coin_cost is not above 0 is not for sale until it
 * is priced ("Price required"), never a free buy. Every uploaded piece starts
 * unowned (wardrobeController.createWardrobeItem), so it is bought, not given.
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

/** Whether a piece Lala does not own is waiting for a price (Task #3143). */
function priceRequired(item) {
  return item?.is_owned !== true && !NOT_FOR_SALE.has(item?.lock_type) && !((Number(item?.coin_cost) || 0) > 0);
}

/** Whether a piece Lala does not own can be bought (the rulings above). */
function isForSale(item) {
  return item?.is_owned !== true && !NOT_FOR_SALE.has(item?.lock_type) && !priceRequired(item);
}

/**
 * @param {object} item — a wardrobe row (is_owned, lock_type, coin_cost)
 * @param {{ coins?: number, reputation?: number }} characterState
 * @returns {{ owned: boolean, can_select: boolean, can_purchase: boolean,
 *   needs_purchase: boolean, price_required: boolean, coin_cost: number }}
 *   needs_purchase: selecting it spends coin_cost (for sale, not owned).
 *   price_required: not owned and not yet priced, so it can't be bought.
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
    price_required: priceRequired(item),
    coin_cost: coinCost,
  };
}

/** Why an unowned piece can't be bought: a sentence for a refusal, or null when it can. */
function cannotBuyReason(item) {
  if (item?.is_owned === true) return null;
  if (item?.lock_type === 'season_drop') return 'a season drop, not for sale';
  if (item?.lock_type === 'brand_exclusive') return 'brand exclusive, not for sale';
  if (priceRequired(item)) return 'price required: give it a coin price first';
  return null;
}

module.exports = { itemReach, isForSale, priceRequired, cannotBuyReason, toCharacter, NOT_FOR_SALE };

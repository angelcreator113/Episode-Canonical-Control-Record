'use strict';

/**
 * Financial rates & defaults — single source of truth for the coin economy.
 *
 * Keep this module tiny and CommonJS so both services (scoring, forecasting,
 * milestones) and any frontend twin can import the same numbers. If you add
 * a new rate or tier curve, put it here.
 */

// USD → LalaVerse coins. Currently 1:1 per show config — a $1,850 Jimmy Choo
// bag contributes 1,850 coins to outfit cost. If the economy needs rebalancing
// later, change this in one place.
const USD_TO_COINS = 1;

// Starting balance when a new show has no transactions yet. Configurable per
// show via shows.metadata.starting_balance; this is the fallback when unset.
// 1,900 coins gets Lala into the "one luxury piece or several mid-tier" range
// so the first few episodes have real financial tension without blocking play.
const DEFAULT_STARTING_BALANCE = 1900;

// Financial goal ladder. Each milestone is a balance threshold Lala has to
// cross (strictly upward — crossing back down and up again doesn't re-fire).
// `reward_coins` is paid once when triggered. Shows can override the whole
// ladder via shows.metadata.financial_goals.
const DEFAULT_GOALS = [
  { id: 'rising-star',   threshold: 5000,   reward_coins: 500,   label: '🌟 Rising Star',   description: "Lala's getting noticed — the right DMs, the right tags." },
  { id: 'it-girl',       threshold: 10000,  reward_coins: 1000,  label: '👑 It Girl',       description: 'Brands know her name. Invites arrive without pitching.' },
  { id: 'style-icon',    threshold: 25000,  reward_coins: 2500,  label: '💎 Style Icon',    description: "Her closet walks the runway too — street-style photographers follow." },
  { id: 'mogul',         threshold: 50000,  reward_coins: 5000,  label: '🏆 Mogul',         description: 'Closet is a portfolio. Collabs pay her, not the other way around.' },
  { id: 'legacy',        threshold: 100000, reward_coins: 10000, label: '✨ Legacy',        description: 'Icon status. Other girls study her archives.' },
];

// Per-event extras that fire on every event attendance on top of `cost_coins`
// (the explicit cover/ticket). Scaled by prestige so a prestige-2 coffee
// meetup doesn't conjure a $200 photo booth. Each function returns coins.
const EVENT_EXTRAS = {
  drinks:      (prestige) => prestige >= 3 ? 20 + prestige * 10 : 0,       // 50 @ p3 → 120 @ p10
  valet:       (prestige) => prestige >= 5 ? 15 + prestige * 5  : 0,       // 40 @ p5 →  65 @ p10
  photo_booth: (prestige) => prestige >= 4 ? 30 + prestige * 15 : 0,       // 90 @ p4 → 180 @ p10
};

// Rented / borrowed pieces cost a fraction of their retail. Kept conservative
// (10%) so renting 5 pieces is still cheaper than owning one — encourages
// rentals early game, ownership mid-late game.
const RENTAL_RATE = 0.10;

// Content revenue forecast — this is the invisible-for-now "posts will make
// money after the event" estimate. Multiplied by prestige so high-profile
// events generate more content value. Kept small so Lala has to pick events
// strategically; one gala doesn't make her rich.
const CONTENT_REVENUE_PER_PRESTIGE = 150;

module.exports = {
  USD_TO_COINS,
  DEFAULT_STARTING_BALANCE,
  DEFAULT_GOALS,
  EVENT_EXTRAS,
  RENTAL_RATE,
  CONTENT_REVENUE_PER_PRESTIGE,
};

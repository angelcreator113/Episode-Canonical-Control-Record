'use strict';

/**
 * Prime Coins are whole (docs/EVENT_EPISODE_FLOW.md §8(y) Q7, Task #2246):
 * an amount entering the ledger is rounded half away from zero, the same
 * rule as PostgreSQL's ROUND on numeric. Math.round alone rounds -2.5 to -2.
 */
function wholeCoins(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) throw new TypeError(`wholeCoins: not a number: ${amount}`);
  return Math.sign(n) * Math.round(Math.abs(n));
}

module.exports = { wholeCoins };

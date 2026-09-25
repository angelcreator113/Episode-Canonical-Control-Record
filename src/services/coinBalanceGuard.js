'use strict';

/**
 * Coin balance guard (Task #1933).
 *
 * Evoni's production read (ATTESTED, 2026-09-25) found a character_state row
 * at −100 coins. Every path that takes coins out of character_state now goes
 * through changeCoins, which does the balance check and the write in one
 * statement:
 *
 *   UPDATE character_state SET coins = coins + :delta
 *   WHERE id = :stateId AND (:delta >= 0 OR coins + :delta >= 0)
 *   RETURNING coins
 *
 * Before this, /wardrobe/select and /wardrobe/purchase read the balance, then
 * wrote in a second statement (two concurrent spends could both pass the
 * read), and episode completion subtracted with no check at all (the formula
 * floors coins at −9999). A spend that would take coins below zero is
 * refused with InsufficientCoinsError, never clamped. Income is never refused.
 */

class InsufficientCoinsError extends Error {
  constructor({ needed, have, action = 'spend' } = {}) {
    const haveText = have === null || have === undefined ? 'no balance' : `have ${have}`;
    super(`Not enough coins — need ${needed}, ${haveText}`);
    this.name = 'InsufficientCoinsError';
    this.code = 'INSUFFICIENT_COINS';
    this.status = 400;
    this.needed = needed;
    this.have = have === undefined ? null : have;
    this.action = action;
  }
}

/** The JSON body a route sends for an InsufficientCoinsError. */
function insufficientCoinsBody(err) {
  return {
    success: false,
    error: err.message,
    code: err.code,
    needed: err.needed,
    have: err.have,
    deficit: err.have === null ? err.needed : Math.max(0, err.needed - err.have),
  };
}

/**
 * Change one character_state row's coins by `delta`, atomically.
 * A negative delta (a spend) is applied only when the row has at least
 * |delta| coins; otherwise nothing is written and InsufficientCoinsError is
 * thrown. `extraSet` adds further `col = :param` assignments to the same
 * UPDATE (episode completion writes its other stats in the same statement).
 *
 * @returns {Promise<number|null>} the row's coins after the write, or null
 *   when delta is 0 (nothing to write).
 */
async function changeCoins(sequelize, {
  stateId, delta, transaction, action = 'spend', extraSet = '', extraReplacements = {},
}) {
  const d = Number(delta);
  if (!Number.isInteger(d)) throw new TypeError(`changeCoins: delta must be an integer, got ${delta}`);
  if (d === 0 && !extraSet) return null;

  const [rows] = await sequelize.query(
    `UPDATE character_state
     SET coins = coins + :delta${extraSet ? `, ${extraSet}` : ''}, updated_at = NOW()
     WHERE id = :stateId AND (:delta >= 0 OR coins + :delta >= 0)
     RETURNING coins`,
    {
      replacements: { ...extraReplacements, delta: d, stateId: stateId || null },
      ...(transaction ? { transaction } : {}),
    }
  );
  if (Array.isArray(rows) && rows.length > 0) return Number(rows[0].coins);

  // Nothing written: the row is missing, or the spend would go below zero.
  let have = null;
  if (stateId) {
    const [current] = await sequelize.query(
      'SELECT coins FROM character_state WHERE id = :stateId',
      { replacements: { stateId }, ...(transaction ? { transaction } : {}) }
    );
    if (Array.isArray(current) && current.length > 0) have = Number(current[0].coins);
  }
  throw new InsufficientCoinsError({ needed: Math.abs(d), have, action });
}

/** Spend `cost` (a non-negative integer) from one row. */
function spendCoins(sequelize, { stateId, cost, transaction, action }) {
  const c = Number(cost);
  if (!Number.isInteger(c) || c < 0) throw new TypeError(`spendCoins: cost must be a non-negative integer, got ${cost}`);
  return changeCoins(sequelize, { stateId, delta: -c, transaction, action });
}

module.exports = {
  InsufficientCoinsError,
  insufficientCoinsBody,
  changeCoins,
  spendCoins,
};

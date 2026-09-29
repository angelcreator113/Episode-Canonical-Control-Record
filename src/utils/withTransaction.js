'use strict';

/**
 * A handle on `sequelize` whose query() always runs inside `transaction`
 * (unless a call names its own). Lets helpers that each take a sequelize join
 * one transaction without a signature change (docs/EVENT_EPISODE_FLOW.md
 * §8(x) D2, Task #2228).
 */
function withTransaction(sequelize, transaction) {
  const bound = Object.create(sequelize);
  bound.query = (sql, options = {}) => sequelize.query(sql, { transaction, ...options });
  return bound;
}

module.exports = { withTransaction };

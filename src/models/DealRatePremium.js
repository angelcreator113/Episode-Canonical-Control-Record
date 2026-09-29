'use strict';
const { DataTypes } = require('sequelize');

/**
 * DealRatePremium — a percent added to the one deal component it affects
 * (deal build PR 1, Task #2319; QUESTION 4, docs/EVENT_EPISODE_FLOW.md
 * §8(cc)): rush (48h, 24h), usage (30d, 90d), exclusivity (7d, 30d, 90d)
 * and paid_ad (whitelisting). paid_ad's percent is null: the ruling makes it
 * a separate premium and gives no number. Versioned like DealRateAnchor;
 * version 1 is seeded by 20260929200002-create-deal-rate-anchors.js. No code
 * reads them yet.
 */
const PREMIUM_KINDS = Object.freeze(['rush', 'usage', 'exclusivity', 'paid_ad']);

module.exports = (sequelize) => {
  const DealRatePremium = sequelize.define('DealRatePremium', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    version: { type: DataTypes.INTEGER, allowNull: false },
    kind: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [PREMIUM_KINDS] } },
    key: { type: DataTypes.STRING(40), allowNull: false },
    percent: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    tableName: 'deal_rate_premiums',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  DealRatePremium.KINDS = PREMIUM_KINDS;

  return DealRatePremium;
};

module.exports.PREMIUM_KINDS = PREMIUM_KINDS;

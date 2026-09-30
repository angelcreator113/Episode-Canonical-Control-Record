'use strict';
const { DataTypes } = require('sequelize');

/**
 * DealRateAnchor — one Career Rate Anchor: the baseline Prime Coins for a
 * deal component at a career tier (deal build PR 1, Task #2319; Evoni's
 * QUESTION 4 answer, docs/EVENT_EPISODE_FLOW.md §8(cc)). "Rates are
 * baselines, not fixed payouts."
 *
 * career_tier 1–5 = Emerging, Rising, Established, Influential, Elite
 * (src/utils/careerTiers.js). amount is null where the ruling gives none.
 * Rows are versioned; version 1 is seeded by
 * 20260929200002-create-deal-rate-anchors.js. No code reads them yet.
 */
// Version 2 (20261001160000-add-deliverable-formats.js; ruling D15 and
// answer 8, 2026-09-30) adds the deliverable formats' anchors.
const RATE_COMPONENTS = Object.freeze([
  'paid_appearance', 'reel', 'stories_3', 'brand_partnership_base', 'performance_booking',
  'tiktok_video', 'grwm_video', 'instagram_post', 'carousel_post', 'go_live', 'try_on_haul', 'ugc', 'link_in_bio_week',
]);

module.exports = (sequelize) => {
  const DealRateAnchor = sequelize.define('DealRateAnchor', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    version: { type: DataTypes.INTEGER, allowNull: false },
    component: { type: DataTypes.STRING(40), allowNull: false, validate: { isIn: [RATE_COMPONENTS] } },
    career_tier: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    amount: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    tableName: 'deal_rate_anchors',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  DealRateAnchor.COMPONENTS = RATE_COMPONENTS;

  return DealRateAnchor;
};

module.exports.RATE_COMPONENTS = RATE_COMPONENTS;

'use strict';

/**
 * Add category and format to world_events, per Evoni's taxonomy ruling
 * (2026-09-22, docs/EVENT_EPISODE_FLOW.md §8(k)/(l), docs/EVENT_TAXONOMY_PLAN.md).
 *
 * event_type stays the mechanic (invite | upgrade | guest | fail_test |
 * deliverable | brand_deal) — unchanged, not touched by this migration.
 *
 *   category — what social/industry world the event belongs to:
 *     fashion | social | brunch_dining | beauty_wellness | creator_brand |
 *     arts_entertainment | luxury_prestige | community_local |
 *     travel_destination | personal_relationship
 *
 *   format — what kind of gathering it physically is:
 *     cocktail_party | garden_soiree | gallery_opening | gala | brunch |
 *     concert | brand_launch | premiere
 *
 * Both nullable STRING, no default, no backfill — existing rows keep NULL
 * on both. Enforcement is model-level (WorldEvent.js validate: isIn), not
 * a Postgres ENUM, per Evoni's own ruling: expanding either list later is
 * an application-code change, not a migration.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('world_events').catch(() => ({}));
    if (!table.category) {
      await queryInterface.addColumn('world_events', 'category', {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'fashion | social | brunch_dining | beauty_wellness | creator_brand | arts_entertainment | luxury_prestige | community_local | travel_destination | personal_relationship',
      });
    }
    if (!table.format) {
      await queryInterface.addColumn('world_events', 'format', {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'cocktail_party | garden_soiree | gallery_opening | gala | brunch | concert | brand_launch | premiere',
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('world_events').catch(() => ({}));
    if (table.category) await queryInterface.removeColumn('world_events', 'category');
    if (table.format) await queryInterface.removeColumn('world_events', 'format');
  },
};

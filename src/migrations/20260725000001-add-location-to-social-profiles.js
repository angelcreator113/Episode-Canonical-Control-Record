'use strict';

/**
 * Migration: Add location fields to social_profiles
 *
 * - home_location_id: FK to world_locations (where the creator lives)
 * - frequent_venues: JSONB array of location IDs they hang out at
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // home_location_id — their residence/studio
    await queryInterface.addColumn('social_profiles', 'home_location_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'world_locations', key: 'id' },
      onDelete: 'SET NULL',
    }).catch(() => {});

    // frequent_venues — array of location IDs they're known to visit
    await queryInterface.addColumn('social_profiles', 'frequent_venues', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
    }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('social_profiles', 'home_location_id').catch(() => {});
    await queryInterface.removeColumn('social_profiles', 'frequent_venues').catch(() => {});
  },
};

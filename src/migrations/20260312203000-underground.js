'use strict';

/** Migration: 20260312203000-underground
 *
 * Adds visibility_tier to social_profiles.
 * Underground profiles are invisible to characters without direct entanglement.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('social_profiles');
    if (desc.visibility_tier) return; // Already applied

    await queryInterface.addColumn('social_profiles', 'visibility_tier', {
      type: Sequelize.ENUM('public', 'semi_private', 'underground'),
      defaultValue: 'public',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('social_profiles', 'visibility_tier');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_social_profiles_visibility_tier";');
  },
};

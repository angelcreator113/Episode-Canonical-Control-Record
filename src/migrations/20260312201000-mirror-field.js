'use strict';

/** Migration: 20260312201000-mirror-field
 *
 * Adds Mirror Field columns to social_profiles.
 * Every Feed profile carries a hidden mapping to a dimension of
 * JustAWoman's interior life. Amber proposes. Evoni confirms.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('social_profiles', 'justawoman_mirror', {
      type: Sequelize.ENUM(
        'ambition', 'desire_unnamed', 'visibility_wound', 'grief',
        'class', 'body', 'habits', 'belonging', 'shadow', 'integration'
      ),
      allowNull: true,
    });
    await queryInterface.addColumn('social_profiles', 'mirror_proposed_by_amber', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: "Amber's reasoning, 2 sentences",
    });
    await queryInterface.addColumn('social_profiles', 'mirror_confirmed', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await queryInterface.addColumn('social_profiles', 'mirror_confirmed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('social_profiles', 'mirror_confirmed_at');
    await queryInterface.removeColumn('social_profiles', 'mirror_confirmed');
    await queryInterface.removeColumn('social_profiles', 'mirror_proposed_by_amber');
    await queryInterface.removeColumn('social_profiles', 'justawoman_mirror');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_social_profiles_justawoman_mirror";');
  },
};

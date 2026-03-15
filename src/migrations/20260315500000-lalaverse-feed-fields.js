'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('social_profiles');

    if (!cols.feed_layer) {
      // Must create the enum type first for PostgreSQL
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_social_profiles_feed_layer" AS ENUM ('real_world', 'lalaverse');`
      ).catch(() => {}); // ignore if exists
      await queryInterface.addColumn('social_profiles', 'feed_layer', {
        type: Sequelize.ENUM('real_world', 'lalaverse'),
        defaultValue: 'real_world',
        allowNull: false,
      });
    }

    if (!cols.city) {
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_social_profiles_city" AS ENUM ('nova_prime', 'velour_city', 'the_drift', 'solenne', 'cascade_row');`
      ).catch(() => {});
      await queryInterface.addColumn('social_profiles', 'city', {
        type: Sequelize.ENUM('nova_prime', 'velour_city', 'the_drift', 'solenne', 'cascade_row'),
        allowNull: true,
      });
    }

    if (!cols.lala_relationship) {
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_social_profiles_lala_relationship" AS ENUM ('direct', 'aware', 'one_sided', 'mutual_unaware', 'competitive', 'justawoman');`
      ).catch(() => {});
      await queryInterface.addColumn('social_profiles', 'lala_relationship', {
        type: Sequelize.ENUM('direct', 'aware', 'one_sided', 'mutual_unaware', 'competitive', 'justawoman'),
        allowNull: true,
      });
    }

    if (!cols.career_pressure) {
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_social_profiles_career_pressure" AS ENUM ('ahead', 'level', 'behind', 'different_lane');`
      ).catch(() => {});
      await queryInterface.addColumn('social_profiles', 'career_pressure', {
        type: Sequelize.ENUM('ahead', 'level', 'behind', 'different_lane'),
        allowNull: true,
      });
    }

    if (!cols.mirror_profile_id) {
      await queryInterface.addColumn('social_profiles', 'mirror_profile_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'social_profiles', key: 'id' },
      });
    }

    if (!cols.is_justawoman_record) {
      await queryInterface.addColumn('social_profiles', 'is_justawoman_record', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
    }

    if (!cols.lalaverse_cap_exempt) {
      await queryInterface.addColumn('social_profiles', 'lalaverse_cap_exempt', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('social_profiles', 'feed_layer').catch(() => {});
    await queryInterface.removeColumn('social_profiles', 'city').catch(() => {});
    await queryInterface.removeColumn('social_profiles', 'lala_relationship').catch(() => {});
    await queryInterface.removeColumn('social_profiles', 'career_pressure').catch(() => {});
    await queryInterface.removeColumn('social_profiles', 'mirror_profile_id').catch(() => {});
    await queryInterface.removeColumn('social_profiles', 'is_justawoman_record').catch(() => {});
    await queryInterface.removeColumn('social_profiles', 'lalaverse_cap_exempt').catch(() => {});
  },
};

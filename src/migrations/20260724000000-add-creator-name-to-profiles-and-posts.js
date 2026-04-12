'use strict';

/**
 * Add creator_name to social_profiles and poster_creator_name to feed_posts.
 * The real name behind the social handle — displayed alongside the @handle in feed UI.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add creator_name to social_profiles
    await queryInterface.addColumn('social_profiles', 'creator_name', {
      type: Sequelize.STRING(200),
      allowNull: true,
    }).catch(() => { /* column may already exist */ });

    // Add poster_creator_name to feed_posts
    await queryInterface.addColumn('feed_posts', 'poster_creator_name', {
      type: Sequelize.STRING(200),
      allowNull: true,
    }).catch(() => { /* column may already exist */ });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('social_profiles', 'creator_name').catch(() => {});
    await queryInterface.removeColumn('feed_posts', 'poster_creator_name').catch(() => {});
  },
};

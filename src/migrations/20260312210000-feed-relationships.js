'use strict';

/** Migration: 20260312210000-feed-relationships
 *
 * Creates: feed_profile_relationships
 * Feed profiles relate to each other — collabs, beefs, mentors, orbits.
 * When beef/former_friends change state, characters entangled with both get pressure flags.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop partially-created table from previous failed runs
    await queryInterface.dropTable('feed_profile_relationships').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_feed_profile_relationships_relationship_type" CASCADE').catch(() => {});

    await queryInterface.createTable('feed_profile_relationships', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      influencer_a_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'social_profiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      influencer_b_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'social_profiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      relationship_type: {
        type: Sequelize.ENUM(
          'collab', 'beef', 'copy_cat', 'mentor', 'public_shade',
          'silent_alliance', 'former_friends', 'competitors', 'orbit'
        ),
        allowNull: false,
      },
      is_public: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Does the story world know about this relationship',
      },
      story_position: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'story_clock_markers', key: 'id' },
        onDelete: 'SET NULL',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('feed_profile_relationships', ['influencer_a_id']);
    await queryInterface.addIndex('feed_profile_relationships', ['influencer_b_id']);
    await queryInterface.addIndex('feed_profile_relationships', ['relationship_type']);
    await queryInterface.addIndex('feed_profile_relationships', ['story_position']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('feed_profile_relationships');
  },
};

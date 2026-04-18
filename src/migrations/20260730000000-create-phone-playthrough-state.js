'use strict';

/**
 * Migration: create phone_playthrough_state
 *
 * Per-user, per-episode runtime state for the Lala's Phone playable experience.
 * - Unique on (user_id, episode_id): one active playthrough per episode per user.
 * - state_flags JSONB holds arbitrary key-value flags set by `set_state` actions.
 * - visited_screens tracks the `visited:<id>` condition support.
 * - completed_at is set when a `complete_episode` action fires; the client can
 *   then surface a "next episode" CTA.
 * - Soft delete (paranoid) per CLAUDE.md convention.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('phone_playthrough_state', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      episode_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'episodes', key: 'id' },
        onDelete: 'CASCADE',
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: false,
        // denormalized copy so we can query "all playthroughs for a show" without joining
      },
      state_flags: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      visited_screens: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: false,
        defaultValue: [],
      },
      last_screen_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // One active playthrough per (user, episode). A user who wants to replay can
    // hit the reset route, which clears state_flags and visited_screens in place
    // rather than creating a second row.
    await queryInterface.addIndex('phone_playthrough_state', ['user_id', 'episode_id'], {
      unique: true,
      name: 'uq_phone_playthrough_user_episode',
      where: { deleted_at: null },
    });

    await queryInterface.addIndex('phone_playthrough_state', ['episode_id'], {
      name: 'idx_phone_playthrough_episode',
    });

    await queryInterface.addIndex('phone_playthrough_state', ['show_id'], {
      name: 'idx_phone_playthrough_show',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('phone_playthrough_state');
  },
};

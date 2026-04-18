'use strict';

/**
 * Migration: create phone_missions
 *
 * Missions are read-only observers in v1 — they watch playthrough state and
 * report progress. No reward actions, no triggers, no state writes. Each
 * mission defines objectives (an array of condition rules) that the same
 * phoneRuntime.evaluate function tests against current state.
 *
 *   - episode_id nullable: allows show-wide missions (e.g. onboarding) in
 *     addition to per-episode ones.
 *   - objectives is JSONB (array of { id, label, condition: [...] }) so we
 *     don't need a separate objectives table just to store condition rules.
 *   - start_condition optional: when set, the mission only appears/tracks
 *     after this gate is true.
 *   - Soft delete per CLAUDE.md convention.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('phone_missions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      episode_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'episodes', key: 'id' },
        onDelete: 'SET NULL',
      },
      name: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      icon_url: { type: Sequelize.STRING(500), allowNull: true },
      start_condition: { type: Sequelize.JSONB, allowNull: true },
      objectives: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      display_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('phone_missions', ['show_id'], {
      name: 'idx_phone_missions_show',
    });
    await queryInterface.addIndex('phone_missions', ['episode_id'], {
      name: 'idx_phone_missions_episode',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('phone_missions');
  },
};

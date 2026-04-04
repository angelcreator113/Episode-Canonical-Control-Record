'use strict';

/**
 * Migration: Create episode_todo_lists table
 *
 * Stores the AI-generated to-do list for each episode.
 * Tasks map directly to wardrobe slots — one task per category.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('episode_todo_lists', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      episode_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'episodes', key: 'id' },
        onDelete: 'CASCADE',
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'shows', key: 'id' },
        onDelete: 'SET NULL',
      },
      event_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'The world_event this list was generated from',
      },
      tasks: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of task objects, one per wardrobe slot',
      },
      asset_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'The generated PNG overlay asset',
      },
      asset_url: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'S3 URL of the to-do list PNG',
      },
      generated_by: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'ai',
        comment: 'ai or manual',
      },
      status: {
        type: Sequelize.ENUM('draft', 'generated', 'locked'),
        allowNull: false,
        defaultValue: 'draft',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex('episode_todo_lists', ['episode_id'],
      { name: 'idx_episode_todo_lists_episode_id' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('episode_todo_lists');
  },
};

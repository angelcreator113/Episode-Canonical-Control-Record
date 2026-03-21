// Migration: 20260321130000-add-deleted-at-to-story-texture.js
// Adds deleted_at column for paranoid soft-delete support

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('story_texture', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('story_texture', 'deleted_at');
  },
};

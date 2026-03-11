'use strict';

/** Migration: 20260312230000-author-notes
 *
 * Creates: author_notes (polymorphic)
 * Every entity in the system has an Author Layer.
 * Notes can be private (Evoni only) or shared with Amber.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('author_notes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      entity_type: {
        type: Sequelize.ENUM(
          'feed_profile', 'character', 'entanglement',
          'calendar_event', 'relationship', 'crossing'
        ),
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Polymorphic; no DB-level FK constraint; enforce in application layer',
      },
      note_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      note_type: {
        type: Sequelize.ENUM('intent', 'watch', 'plant', 'amber_context', 'private'),
        allowNull: false,
      },
      visible_to_amber: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      created_by: {
        type: Sequelize.ENUM('evoni', 'amber'),
        allowNull: false,
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

    await queryInterface.addIndex('author_notes', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('author_notes', ['note_type']);
    await queryInterface.addIndex('author_notes', ['created_by']);
    await queryInterface.addIndex('author_notes', ['visible_to_amber']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('author_notes');
  },
};

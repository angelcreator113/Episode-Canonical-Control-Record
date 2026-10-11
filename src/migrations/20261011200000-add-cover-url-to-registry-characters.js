'use strict';

/**
 * registry_characters.cover_url (Task #2921): a character's cover photo,
 * set from Admin › The Pulse › Uploads › Characters alongside the profile
 * photo, which stays in portrait_url (Evoni, 2026-10-11; The Pulse spec §2
 * rule 3: character photos live on the character record).
 *
 * One nullable TEXT column, no backfill. registry_characters.deleted_at
 * already exists and is not touched. Guarded: added only when absent.
 * down drops exactly this column.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.describeTable('registry_characters');
    if (!existing.cover_url) {
      await queryInterface.addColumn('registry_characters', 'cover_url', { type: Sequelize.TEXT, allowNull: true });
    }
  },

  async down(queryInterface) {
    const existing = await queryInterface.describeTable('registry_characters');
    if (existing.cover_url) await queryInterface.removeColumn('registry_characters', 'cover_url');
  },
};

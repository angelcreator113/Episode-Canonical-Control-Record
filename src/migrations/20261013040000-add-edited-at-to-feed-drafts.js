'use strict';

/**
 * edited_at on feed_posts and feed_comments (Task #3070; Evoni, 2026-10-13:
 * her edits to a character's draft become that voice's examples). Stamped
 * when Evoni changes the text of an AI-drafted post or comment while it is a
 * draft; when that draft is approved, its approved text is added to the
 * character's Voice Profile as an "edit" example (services/pulseVoices.js
 * learnFromEdit). Drafts approved unchanged keep it NULL and add nothing.
 *
 * Additive and guarded: each column is added only when absent. down removes them.
 */

const TABLES = ['feed_posts', 'feed_comments'];

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      for (const table of TABLES) {
        const columns = await queryInterface.describeTable(table, { transaction });
        if (!columns.edited_at) await queryInterface.addColumn(table, 'edited_at', { type: Sequelize.DATE, allowNull: true }, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      for (const table of TABLES) {
        const columns = await queryInterface.describeTable(table, { transaction });
        if (columns.edited_at) await queryInterface.removeColumn(table, 'edited_at', { transaction });
      }
    });
  },
};

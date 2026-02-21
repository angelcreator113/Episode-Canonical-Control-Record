'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    // ── shows: add universe_id, era_name, era_description ─────────────────
    await queryInterface.addColumn('shows', 'universe_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'universes', key: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('shows', 'era_name', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'e.g. Soft Luxury Era, Prime Era',
    });

    await queryInterface.addColumn('shows', 'era_description', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Tone, aesthetic, and vibe for this era',
    });

    await queryInterface.addIndex('shows', ['universe_id'], {
      name: 'shows_universe_id_idx',
    });

    // ── storyteller_books: add series_id, era_name, era_description ────────
    await queryInterface.addColumn('storyteller_books', 'series_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'book_series', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Which series does this book belong to',
    });

    await queryInterface.addColumn('storyteller_books', 'era_name', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.addColumn('storyteller_books', 'era_description', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addIndex('storyteller_books', ['series_id'], {
      name: 'storyteller_books_series_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('shows', 'universe_id');
    await queryInterface.removeColumn('shows', 'era_name');
    await queryInterface.removeColumn('shows', 'era_description');
    await queryInterface.removeColumn('storyteller_books', 'series_id');
    await queryInterface.removeColumn('storyteller_books', 'era_name');
    await queryInterface.removeColumn('storyteller_books', 'era_description');
  },
};

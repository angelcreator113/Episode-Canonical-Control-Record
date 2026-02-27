'use strict';

/**
 * Migration: Add full book structure fields
 *
 * 1. storyteller_books:
 *    - front_matter (JSONB) — copyright, dedication, epigraph, foreword, preface, acknowledgments
 *    - back_matter (JSONB)  — appendix, glossary, bibliography, notes, about_author, index entries
 *    - author_name (STRING) — author display name
 *
 * 2. storyteller_chapters:
 *    - chapter_type (STRING) — prologue, chapter, interlude, epilogue, etc.
 *    - part_number (INTEGER) — groups chapters into Parts/Acts
 *    - part_title  (STRING)  — display name for the part
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── storyteller_books ──────────────────────────────────────────────
    const booksDesc = await queryInterface.describeTable('storyteller_books');

    if (!booksDesc.front_matter) {
      await queryInterface.addColumn('storyteller_books', 'front_matter', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: 'Front matter: { dedication, epigraph, foreword, preface, copyright }',
      });
    }
    if (!booksDesc.back_matter) {
      await queryInterface.addColumn('storyteller_books', 'back_matter', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: 'Back matter: { appendix, glossary, bibliography, notes, about_author, acknowledgments }',
      });
    }
    if (!booksDesc.author_name) {
      await queryInterface.addColumn('storyteller_books', 'author_name', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Author display name for title page and About the Author',
      });
    }

    // ── storyteller_chapters ───────────────────────────────────────────
    const chapDesc = await queryInterface.describeTable('storyteller_chapters');

    if (!chapDesc.chapter_type) {
      await queryInterface.addColumn('storyteller_chapters', 'chapter_type', {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'chapter',
        comment: 'prologue | chapter | interlude | epilogue | afterword',
      });
    }
    if (!chapDesc.part_number) {
      await queryInterface.addColumn('storyteller_chapters', 'part_number', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Groups chapters into Parts/Acts (1 = Part I, 2 = Part II, etc.)',
      });
    }
    if (!chapDesc.part_title) {
      await queryInterface.addColumn('storyteller_chapters', 'part_title', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Display title for the Part/Act grouping',
      });
    }
  },

  async down(queryInterface) {
    // Books
    await queryInterface.removeColumn('storyteller_books', 'front_matter').catch(() => {});
    await queryInterface.removeColumn('storyteller_books', 'back_matter').catch(() => {});
    await queryInterface.removeColumn('storyteller_books', 'author_name').catch(() => {});
    // Chapters
    await queryInterface.removeColumn('storyteller_chapters', 'chapter_type').catch(() => {});
    await queryInterface.removeColumn('storyteller_chapters', 'part_number').catch(() => {});
    await queryInterface.removeColumn('storyteller_chapters', 'part_title').catch(() => {});
  },
};

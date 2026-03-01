'use strict';

/**
 * Migration: 20260301100000-add-book-type-and-story-fields.js
 *
 * Adds Story Engine columns to:
 *   storyteller_books    — book_type, character_key, world_id
 *   storyteller_chapters — story_number, story_phase, story_type, task_brief,
 *                          word_count, consistency_checked, new_character_introduced
 *   universes            — book1_character_creation_open, lalaverse_character_creation_open
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── storyteller_books columns ──────────────────────────────────────
    const booksDesc = await queryInterface.describeTable('storyteller_books').catch(() => null);
    if (booksDesc) {
      if (!booksDesc.book_type) {
        await queryInterface.addColumn('storyteller_books', 'book_type', {
          type: Sequelize.STRING(20),
          allowNull: true,
          defaultValue: 'standard',
          comment: 'standard | story_engine',
        });
      }
      if (!booksDesc.character_key) {
        await queryInterface.addColumn('storyteller_books', 'character_key', {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: 'Matches CHARACTER_DNA key: justawoman, david, dana, lala, chloe, jade',
        });
      }
      if (!booksDesc.world_id) {
        await queryInterface.addColumn('storyteller_books', 'world_id', {
          type: Sequelize.STRING(20),
          allowNull: true,
          comment: 'book1 or lalaverse',
        });
      }
    }

    // ── storyteller_chapters columns ──────────────────────────────────
    const chaptersDesc = await queryInterface.describeTable('storyteller_chapters').catch(() => null);
    if (chaptersDesc) {
      if (!chaptersDesc.story_number) {
        await queryInterface.addColumn('storyteller_chapters', 'story_number', {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: '1-50 arc position',
        });
      }
      if (!chaptersDesc.story_phase) {
        await queryInterface.addColumn('storyteller_chapters', 'story_phase', {
          type: Sequelize.STRING(20),
          allowNull: true,
          comment: 'establishment | pressure | crisis | integration',
        });
      }
      if (!chaptersDesc.story_type) {
        await queryInterface.addColumn('storyteller_chapters', 'story_type', {
          type: Sequelize.STRING(20),
          allowNull: true,
          comment: 'internal | collision | wrong_win',
        });
      }
      if (!chaptersDesc.task_brief) {
        await queryInterface.addColumn('storyteller_chapters', 'task_brief', {
          type: Sequelize.JSONB,
          allowNull: true,
          comment: 'Full task brief JSON from generate-story-tasks',
        });
      }
      if (!chaptersDesc.word_count) {
        await queryInterface.addColumn('storyteller_chapters', 'word_count', {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 0,
        });
      }
      if (!chaptersDesc.consistency_checked) {
        await queryInterface.addColumn('storyteller_chapters', 'consistency_checked', {
          type: Sequelize.BOOLEAN,
          allowNull: true,
          defaultValue: false,
        });
      }
      if (!chaptersDesc.new_character_introduced) {
        await queryInterface.addColumn('storyteller_chapters', 'new_character_introduced', {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'Name of new character introduced in this story, if any',
        });
      }
    }

    // ── universes columns ─────────────────────────────────────────────
    const universesDesc = await queryInterface.describeTable('universes').catch(() => null);
    if (universesDesc) {
      if (!universesDesc.book1_character_creation_open) {
        await queryInterface.addColumn('universes', 'book1_character_creation_open', {
          type: Sequelize.BOOLEAN,
          allowNull: true,
          defaultValue: false,
          comment: 'Whether Book1 world accepts new characters',
        });
      }
      if (!universesDesc.lalaverse_character_creation_open) {
        await queryInterface.addColumn('universes', 'lalaverse_character_creation_open', {
          type: Sequelize.BOOLEAN,
          allowNull: true,
          defaultValue: false,
          comment: 'Whether LalaVerse world accepts new characters',
        });
      }
    }
  },

  async down(queryInterface) {
    // ── storyteller_books ─────────────────────────────────────────────
    const booksDesc = await queryInterface.describeTable('storyteller_books').catch(() => null);
    if (booksDesc) {
      if (booksDesc.book_type) await queryInterface.removeColumn('storyteller_books', 'book_type').catch(() => {});
      if (booksDesc.character_key) await queryInterface.removeColumn('storyteller_books', 'character_key').catch(() => {});
      if (booksDesc.world_id) await queryInterface.removeColumn('storyteller_books', 'world_id').catch(() => {});
    }

    // ── storyteller_chapters ─────────────────────────────────────────
    const chaptersDesc = await queryInterface.describeTable('storyteller_chapters').catch(() => null);
    if (chaptersDesc) {
      if (chaptersDesc.story_number) await queryInterface.removeColumn('storyteller_chapters', 'story_number').catch(() => {});
      if (chaptersDesc.story_phase) await queryInterface.removeColumn('storyteller_chapters', 'story_phase').catch(() => {});
      if (chaptersDesc.story_type) await queryInterface.removeColumn('storyteller_chapters', 'story_type').catch(() => {});
      if (chaptersDesc.task_brief) await queryInterface.removeColumn('storyteller_chapters', 'task_brief').catch(() => {});
      if (chaptersDesc.word_count) await queryInterface.removeColumn('storyteller_chapters', 'word_count').catch(() => {});
      if (chaptersDesc.consistency_checked) await queryInterface.removeColumn('storyteller_chapters', 'consistency_checked').catch(() => {});
      if (chaptersDesc.new_character_introduced) await queryInterface.removeColumn('storyteller_chapters', 'new_character_introduced').catch(() => {});
    }

    // ── universes ─────────────────────────────────────────────────────
    const universesDesc = await queryInterface.describeTable('universes').catch(() => null);
    if (universesDesc) {
      if (universesDesc.book1_character_creation_open) await queryInterface.removeColumn('universes', 'book1_character_creation_open').catch(() => {});
      if (universesDesc.lalaverse_character_creation_open) await queryInterface.removeColumn('universes', 'lalaverse_character_creation_open').catch(() => {});
    }
  },
};

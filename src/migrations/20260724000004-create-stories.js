'use strict';

/**
 * Create stories table — franchise story system
 *
 * Stories can be:
 * - Auto-generated from episodes (episode_id linked)
 * - Original stories set in the LalaVerse
 * - Multiple formats from the same seed
 * - Told from different character POVs
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('stories', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      show_id: { type: Sequelize.UUID, allowNull: true },
      episode_id: { type: Sequelize.UUID, allowNull: true },
      event_id: { type: Sequelize.UUID, allowNull: true },

      // Story content
      title: { type: Sequelize.STRING(500), allowNull: false },
      subtitle: { type: Sequelize.STRING(500), allowNull: true },
      content: { type: Sequelize.TEXT, allowNull: true }, // The prose story
      summary: { type: Sequelize.TEXT, allowNull: true }, // Short synopsis
      word_count: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },

      // Format
      format: {
        type: Sequelize.STRING(30), allowNull: false, defaultValue: 'short_story',
        // short_story | social_fiction | snippet | novella_chapter | screenplay | recap
      },

      // POV
      pov_character: { type: Sequelize.STRING(100), allowNull: true, defaultValue: 'lala' },
      pov_type: { type: Sequelize.STRING(20), allowNull: true, defaultValue: 'third_limited' },
      // first_person | third_limited | third_omniscient | epistolary

      // Source
      source_type: {
        type: Sequelize.STRING(20), allowNull: false, defaultValue: 'episode',
        // episode | original | character_spinoff | event
      },

      // Status
      status: {
        type: Sequelize.STRING(20), allowNull: false, defaultValue: 'draft',
        // draft | writing | review | published | archived
      },

      // Generation metadata
      generation_model: { type: Sequelize.STRING(60), allowNull: true },
      generation_tokens: { type: Sequelize.INTEGER, allowNull: true },
      context_snapshot: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },

      // Publishing
      published_at: { type: Sequelize.DATE, allowNull: true },
      published_to: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] }, // ['substack', 'kindle', 'instagram']

      // Metadata
      tags: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    }).catch(() => {});

    await queryInterface.addIndex('stories', ['show_id'], { name: 'idx_stories_show' }).catch(() => {});
    await queryInterface.addIndex('stories', ['episode_id'], { name: 'idx_stories_episode' }).catch(() => {});
    await queryInterface.addIndex('stories', ['format'], { name: 'idx_stories_format' }).catch(() => {});
    await queryInterface.addIndex('stories', ['status'], { name: 'idx_stories_status' }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stories').catch(() => {});
  },
};

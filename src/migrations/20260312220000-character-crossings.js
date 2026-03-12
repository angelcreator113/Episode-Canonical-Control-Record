'use strict';

/** Migration: 20260312220000-character-crossings
 *
 * Creates: character_crossings
 * Adds: performing_publicly, dimensions_performed, dimensions_hidden to registry_characters
 *
 * The tracked moment a character's interior life begins being performed publicly.
 * Performance gap = distance between who they are and who they present.
 */

module.exports = {
  async up(queryInterface, Sequelize) {

    // Drop partially-created table from previous failed runs
    await queryInterface.dropTable('character_crossings').catch(() => {});

    // ── character_crossings table ────────────────────────────────────────

    await queryInterface.createTable('character_crossings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      character_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'registry_characters', key: 'id' },
        onDelete: 'CASCADE',
      },
      crossing_date: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'story_clock_markers', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Story position at time of crossing',
      },
      calendar_event_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'story_calendar_events', key: 'id' },
        onDelete: 'SET NULL',
      },
      trigger: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What caused them to go public',
      },
      initial_feed_state: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Their public persona at time of crossing',
      },
      performance_gap_score: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '0–100; Amber proposes, Evoni confirms',
      },
      gap_proposed_by_amber: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Amber's reasoning paragraph",
      },
      gap_confirmed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
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

    await queryInterface.addIndex('character_crossings', ['character_id']);
    await queryInterface.addIndex('character_crossings', ['gap_confirmed']);
    await queryInterface.addIndex('character_crossings', ['performance_gap_score']);

    // ── Add columns to registry_characters (idempotent) ──────────────────────

    const desc = await queryInterface.describeTable('registry_characters');
    if (!desc.performing_publicly) {
      await queryInterface.addColumn('registry_characters', 'performing_publicly', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      });
    }
    if (!desc.dimensions_performed) {
      await queryInterface.addColumn('registry_characters', 'dimensions_performed', {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: 'Array of Deep Profile dimension strings being performed publicly',
      });
    }
    if (!desc.dimensions_hidden) {
      await queryInterface.addColumn('registry_characters', 'dimensions_hidden', {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: 'Array of dimensions being hidden',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('registry_characters', 'dimensions_hidden');
    await queryInterface.removeColumn('registry_characters', 'dimensions_performed');
    await queryInterface.removeColumn('registry_characters', 'performing_publicly');
    await queryInterface.dropTable('character_crossings');
  },
};

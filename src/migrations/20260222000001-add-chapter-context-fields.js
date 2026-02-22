'use strict';

/**
 * Migration: add chapter context fields to storyteller_chapters
 *
 * Adds:
 * - primary_character_id  FK → registry_characters (who this chapter focuses on)
 * - characters_present     JSONB array of character IDs present in this chapter
 * - pov                   VARCHAR — first_person | close_third | multi_pov | lala_voice
 * - scene_goal            TEXT — what must happen in this chapter
 * - emotional_state_start TEXT — where the primary character begins emotionally
 * - emotional_state_end   TEXT — where they end
 * - theme                 VARCHAR — the chapter's core theme
 * - chapter_notes         TEXT — writer's private notes, never shown to reader
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('storyteller_chapters', 'primary_character_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'registry_characters', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Primary character this chapter focuses on',
    });

    await queryInterface.addColumn('storyteller_chapters', 'characters_present', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of registry_character UUIDs present in this chapter',
    });

    await queryInterface.addColumn('storyteller_chapters', 'pov', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: 'first_person',
      comment: 'first_person | close_third | multi_pov | lala_voice',
    });

    await queryInterface.addColumn('storyteller_chapters', 'scene_goal', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'What must happen in this chapter — the narrative purpose',
    });

    await queryInterface.addColumn('storyteller_chapters', 'emotional_state_start', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Where the primary character begins emotionally',
    });

    await queryInterface.addColumn('storyteller_chapters', 'emotional_state_end', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Where the primary character ends emotionally',
    });

    await queryInterface.addColumn('storyteller_chapters', 'theme', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'The chapter core theme — e.g. Admiration turning into self-comparison',
    });

    await queryInterface.addColumn('storyteller_chapters', 'chapter_notes', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Private writer notes — never included in export',
    });

    await queryInterface.addIndex('storyteller_chapters', ['primary_character_id'], {
      name: 'storyteller_chapters_primary_character_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('storyteller_chapters', 'primary_character_id');
    await queryInterface.removeColumn('storyteller_chapters', 'characters_present');
    await queryInterface.removeColumn('storyteller_chapters', 'pov');
    await queryInterface.removeColumn('storyteller_chapters', 'scene_goal');
    await queryInterface.removeColumn('storyteller_chapters', 'emotional_state_start');
    await queryInterface.removeColumn('storyteller_chapters', 'emotional_state_end');
    await queryInterface.removeColumn('storyteller_chapters', 'theme');
    await queryInterface.removeColumn('storyteller_chapters', 'chapter_notes');
  },
};

// Migration: 20260321120000-add-texture-layer-generators.js
// Adds mom_tone_insert, aftermath_line, and memory_proposal columns to story_texture

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── Mom tone insert columns ─────────────────────────────────────
    await queryInterface.addColumn('story_texture', 'mom_tone_eligible', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await queryInterface.addColumn('story_texture', 'mom_tone_trigger', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('story_texture', 'mom_tone_text', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('story_texture', 'mom_tone_child', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('story_texture', 'mom_tone_confirmed', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });

    // ── Aftermath line columns ──────────────────────────────────────
    await queryInterface.addColumn('story_texture', 'aftermath_eligible', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await queryInterface.addColumn('story_texture', 'aftermath_line_text', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('story_texture', 'aftermath_confirmed', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });

    // ── Memory proposal columns ─────────────────────────────────────
    await queryInterface.sequelize.query(
      "CREATE TYPE \"enum_story_texture_memory_proposal_type\" AS ENUM ('keeps', 'buries', 'revises');"
    );
    await queryInterface.addColumn('story_texture', 'memory_proposal_type', {
      type: Sequelize.ENUM('keeps', 'buries', 'revises'),
      allowNull: true,
    });
    await queryInterface.addColumn('story_texture', 'memory_proposal_detail', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('story_texture', 'memory_proposal_text', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('story_texture', 'memory_proposal_confirmed', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    // Mom tone
    await queryInterface.removeColumn('story_texture', 'mom_tone_eligible');
    await queryInterface.removeColumn('story_texture', 'mom_tone_trigger');
    await queryInterface.removeColumn('story_texture', 'mom_tone_text');
    await queryInterface.removeColumn('story_texture', 'mom_tone_child');
    await queryInterface.removeColumn('story_texture', 'mom_tone_confirmed');

    // Aftermath
    await queryInterface.removeColumn('story_texture', 'aftermath_eligible');
    await queryInterface.removeColumn('story_texture', 'aftermath_line_text');
    await queryInterface.removeColumn('story_texture', 'aftermath_confirmed');

    // Memory proposal
    await queryInterface.removeColumn('story_texture', 'memory_proposal_type');
    await queryInterface.removeColumn('story_texture', 'memory_proposal_detail');
    await queryInterface.removeColumn('story_texture', 'memory_proposal_text');
    await queryInterface.removeColumn('story_texture', 'memory_proposal_confirmed');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_story_texture_memory_proposal_type";'
    );
  },
};

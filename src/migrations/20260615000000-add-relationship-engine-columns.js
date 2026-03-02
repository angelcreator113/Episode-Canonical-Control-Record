'use strict';

/**
 * Migration: Add Relationship Engine columns to character_relationships
 * New columns support the candidate/confirmation workflow, tension tracking,
 * and LalaVerse mirror system.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('character_relationships');

    // situation — freeform context for the relationship
    if (!tableDesc.situation) {
      await queryInterface.addColumn('character_relationships', 'situation', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    // tension_state — current tension level
    if (!tableDesc.tension_state) {
      await queryInterface.addColumn('character_relationships', 'tension_state', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }

    // pain_point_category — categorised pressure/pain
    if (!tableDesc.pain_point_category) {
      await queryInterface.addColumn('character_relationships', 'pain_point_category', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }

    // lala_mirror — how this relationship mirrors in LalaVerse
    if (!tableDesc.lala_mirror) {
      await queryInterface.addColumn('character_relationships', 'lala_mirror', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    // career_echo_potential — career/professional echo notes
    if (!tableDesc.career_echo_potential) {
      await queryInterface.addColumn('character_relationships', 'career_echo_potential', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    // confirmed — whether this is a confirmed relationship or an AI-generated candidate
    if (!tableDesc.confirmed) {
      await queryInterface.addColumn('character_relationships', 'confirmed', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true, // existing rows are confirmed
      });
    }

    // Add index on confirmed for pending-candidate queries
    await queryInterface.addIndex('character_relationships', ['confirmed'], {
      name: 'idx_char_rel_confirmed',
    }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('character_relationships', 'situation').catch(() => {});
    await queryInterface.removeColumn('character_relationships', 'tension_state').catch(() => {});
    await queryInterface.removeColumn('character_relationships', 'pain_point_category').catch(() => {});
    await queryInterface.removeColumn('character_relationships', 'lala_mirror').catch(() => {});
    await queryInterface.removeColumn('character_relationships', 'career_echo_potential').catch(() => {});
    await queryInterface.removeColumn('character_relationships', 'confirmed').catch(() => {});
    await queryInterface.removeIndex('character_relationships', 'idx_char_rel_confirmed').catch(() => {});
  },
};

'use strict';

/**
 * Create character_relationships table.
 *
 * Schema aligned with the CharacterRelationship model — uses UUID foreign keys
 * (character_id_a, character_id_b) into registry_characters.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('character_relationships', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      character_id_a: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'registry_characters', key: 'id' },
        onDelete: 'CASCADE',
      },
      character_id_b: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'registry_characters', key: 'id' },
        onDelete: 'CASCADE',
      },
      relationship_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      connection_mode: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'IRL',
      },
      lala_connection: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'none',
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'Active',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      situation: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      tension_state: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      pain_point_category: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      lala_mirror: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      career_echo_potential: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      confirmed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      /* ── Ensemble-World Fields ── */
      family_role: {
        type: Sequelize.STRING(120),
        allowNull: true,
        defaultValue: null,
      },
      is_blood_relation: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_romantic: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      conflict_summary: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      knows_about_connection: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      /* ── Knowledge Asymmetry ── */
      source_knows: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      target_knows: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reader_knows: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      /* ── Scene Brief Classification ── */
      role_tag: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Indexes
    await queryInterface.addIndex('character_relationships', ['character_id_a']);
    await queryInterface.addIndex('character_relationships', ['character_id_b']);
    await queryInterface.addIndex('character_relationships', ['relationship_type']);
    await queryInterface.addIndex('character_relationships', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('character_relationships');
  },
};

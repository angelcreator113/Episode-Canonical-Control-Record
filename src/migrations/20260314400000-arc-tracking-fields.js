'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── 1. Create character_arcs table ───────────────────────────────
    await queryInterface.createTable('character_arcs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      character_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      registry_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'registry_characters', key: 'id' },
        onDelete: 'SET NULL',
      },
      wound_clock: {
        type: Sequelize.INTEGER,
        defaultValue: 75,
        allowNull: false,
        comment: 'Starts at 75 — she has been trying for years before Book 1.',
      },
      stakes_level: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false,
        comment: '1-10. Escalates across the arc. Injected into generation prompts.',
      },
      visibility_score: {
        type: Sequelize.INTEGER,
        defaultValue: 20,
        allowNull: false,
        comment: '0-100. How seen she feels at this arc position.',
      },
      david_silence_counter: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Increments when JustAWoman has an intimate or charged moment with someone other than David.',
      },
      phone_appearances: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Tracks how many times the recurring object (her phone) has appeared. Weight increases per appearance.',
      },
      bleed_generated: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    // ── 2. Add intimate_eligible column to registry_characters ───────
    const tableDesc = await queryInterface.describeTable('registry_characters');
    if (!tableDesc.intimate_eligible) {
      await queryInterface.addColumn('registry_characters', 'intimate_eligible', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether this character is eligible for intimate scene generation.',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('character_arcs');

    const tableDesc = await queryInterface.describeTable('registry_characters');
    if (tableDesc.intimate_eligible) {
      await queryInterface.removeColumn('registry_characters', 'intimate_eligible');
    }
  },
};

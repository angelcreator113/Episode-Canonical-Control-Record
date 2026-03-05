'use strict';

/** ─────────────────────────────────────────────────────────────────────────────
 * Migration: Add Identity & Death Tracking to registry_characters
 *
 * Adds:
 *   gender          — woman / man / non-binary / genderfluid / agender / custom
 *   ethnicity       — open text
 *   species         — human / AI entity / digital being / hybrid / custom
 *   is_alive        — boolean, default true
 *   death_date      — nullable date
 *   death_cause     — nullable text
 *   death_impact    — nullable text (how their death affects story/relationships)
 * ───────────────────────────────────────────────────────────────────────────── */

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'registry_characters';

    await queryInterface.addColumn(table, 'gender', {
      type:         Sequelize.STRING(80),
      allowNull:    true,
      defaultValue: null,
      comment:      'woman | man | non-binary | genderfluid | agender | custom string',
    });

    await queryInterface.addColumn(table, 'ethnicity', {
      type:         Sequelize.STRING(150),
      allowNull:    true,
      defaultValue: null,
      comment:      'Open text — not constrained to a fixed vocabulary',
    });

    await queryInterface.addColumn(table, 'species', {
      type:         Sequelize.STRING(150),
      allowNull:    true,
      defaultValue: 'human',
      comment:      'human | AI entity | digital being | hybrid | LalaVerse-specific race',
    });

    await queryInterface.addColumn(table, 'is_alive', {
      type:         Sequelize.BOOLEAN,
      allowNull:    false,
      defaultValue: true,
      comment:      'false = deceased — affects relationship states and story threading',
    });

    await queryInterface.addColumn(table, 'death_date', {
      type:         Sequelize.DATEONLY,
      allowNull:    true,
      defaultValue: null,
      comment:      'In-world date of death (not real-world date)',
    });

    await queryInterface.addColumn(table, 'death_cause', {
      type:         Sequelize.TEXT,
      allowNull:    true,
      defaultValue: null,
      comment:      'How the character died — in-world narrative',
    });

    await queryInterface.addColumn(table, 'death_impact', {
      type:         Sequelize.TEXT,
      allowNull:    true,
      defaultValue: null,
      comment:      'Ripple effect: who is affected, how relationships shift, story consequences',
    });
  },

  async down(queryInterface) {
    const table = 'registry_characters';
    for (const col of [
      'gender', 'ethnicity', 'species',
      'is_alive', 'death_date', 'death_cause', 'death_impact',
    ]) {
      await queryInterface.removeColumn(table, col);
    }
  },
};

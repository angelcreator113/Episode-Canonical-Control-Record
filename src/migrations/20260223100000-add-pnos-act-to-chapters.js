'use strict';

/**
 * Migration: add pnos_act column to storyteller_chapters
 *
 * Adds a pnos_act field to track which PNOS act each chapter belongs to.
 * Values: act_1, act_2, act_3, act_4, act_5
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('storyteller_chapters', 'pnos_act', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: null,
      comment: 'PNOS act: act_1 | act_2 | act_3 | act_4 | act_5',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('storyteller_chapters', 'pnos_act');
  },
};

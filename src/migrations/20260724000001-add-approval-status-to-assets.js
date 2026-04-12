'use strict';

/**
 * Add approval_status column to assets table.
 * Defined in Asset model but not yet in the database.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('assets', 'approval_status', {
      type: Sequelize.STRING(50),
      allowNull: true,
    }).catch(() => { /* column may already exist */ });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('assets', 'approval_status').catch(() => {});
  },
};

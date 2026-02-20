'use strict';

/**
 * Migration: Add season_number column back to episodes table
 * 
 * The column was originally in the create-episodes migration but was
 * dropped by fix-episodes-id-column.sql. Now the model and controller
 * reference it, so we need to re-add it.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Only add if it doesn't already exist (idempotent)
    const tableDesc = await queryInterface.describeTable('episodes');
    if (!tableDesc.season_number) {
      await queryInterface.addColumn('episodes', 'season_number', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      console.log('✅ Added season_number column to episodes');
    } else {
      console.log('ℹ️  season_number column already exists');
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('episodes', 'season_number');
  },
};

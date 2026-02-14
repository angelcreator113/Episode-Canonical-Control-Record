'use strict';

/**
 * Migration: Add keyframes JSONB column to timeline_data table
 * Stores keyframe animation data for the advanced timeline feature.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('timeline_data');
    
    if (!tableInfo.keyframes) {
      await queryInterface.addColumn('timeline_data', 'keyframes', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Array of keyframe objects for element animations',
      });
      console.log('✅ Added keyframes column to timeline_data');
    } else {
      console.log('ℹ️  keyframes column already exists');
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('timeline_data', 'keyframes');
    console.log('✅ Removed keyframes column from timeline_data');
  },
};

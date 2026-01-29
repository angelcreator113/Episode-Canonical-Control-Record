'use strict';

/**
 * Add deleted_at column to thumbnail_compositions table for soft deletes
 * This brings thumbnail_compositions in line with other tables like episodes
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('thumbnail_compositions', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      field: 'deleted_at',
      comment: 'Soft delete timestamp - null means record is active',
    });

    // Add index for efficient filtering of non-deleted records
    await queryInterface.addIndex('thumbnail_compositions', ['deleted_at'], {
      name: 'idx_thumbnail_compositions_deleted_at',
    });

    console.log('✅ Added deleted_at column to thumbnail_compositions table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('thumbnail_compositions', 'idx_thumbnail_compositions_deleted_at');
    await queryInterface.removeColumn('thumbnail_compositions', 'deleted_at');
    console.log('✅ Removed deleted_at column from thumbnail_compositions table');
  },
};

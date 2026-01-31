/**
 * Migration: Add file_hash column for duplicate detection
 * Adds SHA-256 hash column with unique index to prevent duplicate uploads
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('📝 Adding file_hash column to assets table...');
      
      // Add file_hash column
      await queryInterface.addColumn(
        'assets',
        'file_hash',
        {
          type: Sequelize.STRING(64), // SHA-256 produces 64 hex characters
          allowNull: true,
          comment: 'SHA-256 hash of file content for duplicate detection',
        },
        { transaction }
      );
      
      // Add index for fast duplicate lookups
      await queryInterface.addIndex(
        'assets',
        ['file_hash'],
        {
          name: 'idx_assets_file_hash',
          where: {
            file_hash: { [Sequelize.Op.ne]: null },
            deleted_at: null,
          },
          transaction,
        }
      );
      
      // Add composite index for hash + deleted_at for even faster queries
      await queryInterface.addIndex(
        'assets',
        ['file_hash', 'deleted_at'],
        {
          name: 'idx_assets_file_hash_deleted',
          transaction,
        }
      );
      
      console.log('✅ file_hash column added successfully');
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 Rolling back file_hash column...');
      
      // Remove indexes
      await queryInterface.removeIndex('assets', 'idx_assets_file_hash_deleted', { transaction });
      await queryInterface.removeIndex('assets', 'idx_assets_file_hash', { transaction });
      
      // Remove column
      await queryInterface.removeColumn('assets', 'file_hash', { transaction });
      
      console.log('✅ Rollback complete');
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  },
};

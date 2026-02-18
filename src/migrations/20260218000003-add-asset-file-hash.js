'use strict';

/**
 * Migration: Add file_hash column to assets table
 * 
 * The AssetService uses file_hash for duplicate detection on upload,
 * but the column was never created on the table.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE assets ADD COLUMN IF NOT EXISTS "file_hash" VARCHAR(64);`
    );
    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_assets_file_hash ON assets(file_hash) WHERE file_hash IS NOT NULL;`
    );
    console.log('✅ Added file_hash column + index to assets');
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('assets', 'file_hash').catch(() => {});
  }
};

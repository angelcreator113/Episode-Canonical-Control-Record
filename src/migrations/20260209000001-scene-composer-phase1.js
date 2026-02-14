'use strict';

/**
 * Migration: Scene Composer Phase 1 - Database Extensions
 * Date: 2026-02-09
 * 
 * Description: Minimal schema changes to support Scene Composer
 * - Add layout (JSONB) for spatial composition data
 * - Add duration_auto flag for auto vs manual duration
 * - Add status field for scene completion tracking
 * - Add helper functions for duration calculation and completeness checks
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('Starting Scene Composer Phase 1 migration...');
      
      // ==========================================
      // PHASE 1: EXTEND SCENES TABLE
      // ==========================================
      console.log('Phase 1: Extending scenes table...');
      
      // Add layout JSONB column for spatial composition data
      await queryInterface.addColumn('scenes', 'layout', {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'JSONB: Spatial layout data for composition (canvas settings, default positions)'
      }, { transaction });
      
      // duration_seconds should already exist (INTEGER), but ensure it's DECIMAL
      // Check if it exists first
      const [results] = await queryInterface.sequelize.query(
        `SELECT column_name, data_type 
         FROM information_schema.columns 
         WHERE table_name = 'scenes' 
         AND column_name = 'duration_seconds'`,
        { transaction }
      );
      
      if (results.length === 0) {
        // Column doesn't exist, add it
        await queryInterface.addColumn('scenes', 'duration_seconds', {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
          comment: 'Scene duration in seconds (manual or auto-calculated from clips)'
        }, { transaction });
      } else if (results[0].data_type === 'integer') {
        // Column exists but is INTEGER, change to DECIMAL
        console.log('Converting duration_seconds from INTEGER to DECIMAL...');
        await queryInterface.changeColumn('scenes', 'duration_seconds', {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
          comment: 'Scene duration in seconds (manual or auto-calculated from clips)'
        }, { transaction });
      }
      
      // Add duration_auto flag
      await queryInterface.addColumn('scenes', 'duration_auto', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'If true, duration is auto-calculated from longest clip'
      }, { transaction });
      
      // Add status field (use production_status if it exists, or add new field)
      const [statusResults] = await queryInterface.sequelize.query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name = 'scenes' 
         AND column_name IN ('status', 'production_status')`,
        { transaction }
      );
      
      const hasStatus = statusResults.some(r => r.column_name === 'status');
      const hasProductionStatus = statusResults.some(r => r.column_name === 'production_status');
      
      if (!hasStatus && !hasProductionStatus) {
        // Add status field
        await queryInterface.addColumn('scenes', 'status', {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'planned',
          comment: 'Scene completion status: planned, in_progress, complete'
        }, { transaction });
      }
      
      // ==========================================
      // PHASE 2: ADD CONSTRAINTS
      // ==========================================
      console.log('Phase 2: Adding constraints...');
      
      // Check if constraint exists, drop if exists, then recreate
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE scenes DROP CONSTRAINT IF EXISTS scenes_duration_check`,
          { transaction }
        );
        
        await queryInterface.sequelize.query(
          `ALTER TABLE scenes 
           ADD CONSTRAINT scenes_duration_check 
           CHECK (duration_seconds IS NULL OR duration_seconds >= 0)`,
          { transaction }
        );
      } catch (error) {
        console.log('Note: Constraint handling skipped (may already exist or not needed)');
      }
      
      // ==========================================
      // PHASE 3: ADD INDEXES
      // ==========================================
      console.log('Phase 3: Adding indexes...');
      
      // Add index for status queries (if status column exists)
      if (!hasProductionStatus) {
        await queryInterface.addIndex('scenes', ['status'], {
          name: 'idx_scenes_status',
          transaction
        });
      }
      
      // ==========================================
      // PHASE 4: UPDATE EXISTING DATA
      // ==========================================
      console.log('Phase 4: Updating existing data...');
      
      // Set default status for existing scenes
      if (!hasProductionStatus) {
        await queryInterface.sequelize.query(
          `UPDATE scenes SET status = 'planned' WHERE status IS NULL`,
          { transaction }
        );
      }
      
      // Set duration_auto to true for all existing scenes
      await queryInterface.sequelize.query(
        `UPDATE scenes SET duration_auto = TRUE WHERE duration_auto IS NULL`,
        { transaction }
      );
      
      // ==========================================
      // PHASE 5: CREATE HELPER FUNCTIONS
      // ==========================================
      console.log('Phase 5: Creating helper functions...');
      
      // Function: Calculate scene duration from clips
      await queryInterface.sequelize.query(
        `CREATE OR REPLACE FUNCTION calculate_scene_duration(scene_uuid UUID)
         RETURNS DECIMAL(10,2) AS $$
         DECLARE
           max_duration DECIMAL(10,2);
         BEGIN
           SELECT MAX(
             COALESCE(
               (sa.metadata->>'trim_end')::DECIMAL,
               a.duration_seconds
             ) - COALESCE(
               (sa.metadata->>'trim_start')::DECIMAL,
               0
             )
           )
           INTO max_duration
           FROM scene_assets sa
           JOIN assets a ON sa.asset_id = a.id
           WHERE sa.scene_id = scene_uuid
             AND sa.role LIKE 'CLIP.%'
             AND a.asset_type = 'video';
           
           RETURN max_duration;
         END;
         $$ LANGUAGE plpgsql;`,
        { transaction }
      );
      
      // Function: Check scene completeness
      await queryInterface.sequelize.query(
        `CREATE OR REPLACE FUNCTION check_scene_complete(scene_uuid UUID)
         RETURNS BOOLEAN AS $$
         BEGIN
           RETURN EXISTS(
             SELECT 1 FROM scene_assets 
             WHERE scene_id = scene_uuid AND role LIKE 'BG.%'
           ) AND EXISTS(
             SELECT 1 FROM scene_assets 
             WHERE scene_id = scene_uuid AND role LIKE 'CLIP.%'
           );
         END;
         $$ LANGUAGE plpgsql;`,
        { transaction }
      );
      
      console.log('✅ Scene Composer Phase 1 migration completed successfully');
      
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
      console.log('Rolling back Scene Composer Phase 1 migration...');
      
      // Drop helper functions
      await queryInterface.sequelize.query(
        'DROP FUNCTION IF EXISTS check_scene_complete(UUID);',
        { transaction }
      );
      
      await queryInterface.sequelize.query(
        'DROP FUNCTION IF EXISTS calculate_scene_duration(UUID);',
        { transaction }
      );
      
      // Drop indexes
      await queryInterface.removeIndex('scenes', 'idx_scenes_status', { transaction });
      
      // Drop constraints
      await queryInterface.sequelize.query(
        'ALTER TABLE scenes DROP CONSTRAINT IF EXISTS scenes_duration_check;',
        { transaction }
      );
      
      // Remove columns (optional - comment out if you want to keep data)
      await queryInterface.removeColumn('scenes', 'duration_auto', { transaction });
      // await queryInterface.removeColumn('scenes', 'status', { transaction }); // Keep if production_status exists
      await queryInterface.removeColumn('scenes', 'layout', { transaction });
      
      console.log('✅ Rollback completed');
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};

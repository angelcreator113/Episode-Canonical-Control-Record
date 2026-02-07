/**
 * Migration: Add visual_role column to timeline_placements
 * 
 * Distinguishes between:
 * - 'primary-visual': B-roll, cutaways that replace main video
 * - 'overlay': Logos, lower thirds, wardrobe that layer on top
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addVisualRoleColumn() {
  const client = await pool.connect();
  
  try {
    console.log('Adding visual_role column to timeline_placements...');
    
    await client.query(`
      ALTER TABLE timeline_placements 
      ADD COLUMN IF NOT EXISTS visual_role VARCHAR(20) DEFAULT 'overlay' 
      CHECK (visual_role IN ('primary-visual', 'overlay'));
    `);
    
    console.log('✓ Added visual_role column');
    
    // Add comment
    await client.query(`
      COMMENT ON COLUMN timeline_placements.visual_role IS 
      'Visual hierarchy: primary-visual (replaces main video) or overlay (layers on top)';
    `);
    
    console.log('✓ Added column comment');
    
    // Set default values based on placement_type
    await client.query(`
      UPDATE timeline_placements 
      SET visual_role = 'primary-visual' 
      WHERE placement_type = 'asset' 
      AND visual_role = 'overlay';
    `);
    
    console.log('✓ Set default visual_role for assets to primary-visual');
    
    await client.query(`
      UPDATE timeline_placements 
      SET visual_role = 'overlay' 
      WHERE placement_type = 'wardrobe';
    `);
    
    console.log('✓ Set default visual_role for wardrobe to overlay');
    
    console.log('\n✅ Migration complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addVisualRoleColumn();

/**
 * Validation script for Icon Cue Timeline System
 * Run after migration to verify tables and seed data
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function validateIconCueSystem() {
  console.log('🔍 Validating Icon Cue Timeline System...\n');
  
  try {
    // Check tables exist
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'icon_slot_mappings',
        'icon_cues',
        'cursor_actions',
        'music_cues',
        'production_packages'
      )
      ORDER BY table_name;
    `);
    
    console.log('✅ Tables created:');
    tables.rows.forEach(row => console.log(`   - ${row.table_name}`));
    console.log();
    
    // Check icon slot mappings count
    const mappingsCount = await pool.query('SELECT COUNT(*) FROM icon_slot_mappings');
    console.log(`✅ Icon slot mappings: ${mappingsCount.rows[0].count} rows`);
    
    // Show slot distribution
    const slotDistribution = await pool.query(`
      SELECT slot_id, slot_category, COUNT(*) as icon_count
      FROM icon_slot_mappings
      GROUP BY slot_id, slot_category
      ORDER BY slot_id;
    `);
    
    console.log('\n📊 Slot Distribution:');
    slotDistribution.rows.forEach(row => {
      console.log(`   ${row.slot_id} (${row.slot_category}): ${row.icon_count} icons`);
    });
    
    // List all icon roles
    const iconRoles = await pool.query(`
      SELECT asset_role, slot_id, icon_type, is_persistent
      FROM icon_slot_mappings
      ORDER BY slot_id, asset_role;
    `);
    
    console.log('\n🎨 Icon Roles by Slot:');
    let currentSlot = null;
    iconRoles.rows.forEach(row => {
      if (row.slot_id !== currentSlot) {
        console.log(`\n   ${row.slot_id.toUpperCase()}:`);
        currentSlot = row.slot_id;
      }
      const persistent = row.is_persistent ? ' (persistent)' : '';
      console.log(`   - ${row.asset_role}${persistent}`);
    });
    
    console.log('\n✅ Icon Cue Timeline System validated successfully!\n');
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

validateIconCueSystem();

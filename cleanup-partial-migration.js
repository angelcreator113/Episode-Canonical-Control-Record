const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function cleanupPartialMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Cleaning up partial migration...\n');
    
    // Drop trigger and function first
    await client.query('DROP TRIGGER IF EXISTS update_processing_duration ON video_processing_jobs;');
    console.log('✓ Dropped trigger');
    
    await client.query('DROP FUNCTION IF EXISTS calculate_processing_duration();');
    console.log('✓ Dropped function');
    
    // Drop new tables
    const tables = [
      'layer_presets',
      'scene_layer_configuration',
      'script_metadata',
      'ai_training_data',
      'video_processing_jobs',
      'ai_revisions',
      'editing_decisions',
      'ai_edit_plans'
    ];
    
    for (const table of tables) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
      console.log(`✓ Dropped table: ${table}`);
    }
    
    // Drop indexes from existing tables (these might have been added)
    const indexDrops = [
      'DROP INDEX IF EXISTS idx_episodes_ai_edit_enabled',
      'DROP INDEX IF EXISTS idx_episodes_current_ai_edit_plan_id',
      'DROP INDEX IF EXISTS idx_episodes_rendering_status',
      'DROP INDEX IF EXISTS idx_scenes_source_filename',
      'DROP INDEX IF EXISTS idx_scenes_take_number',
      'DROP INDEX IF EXISTS idx_scenes_ai_selected',
      'DROP INDEX IF EXISTS idx_episode_scripts_ai_analysis_enabled'
    ];
    
    for (const drop of indexDrops) {
      try {
        await client.query(drop);
      } catch (err) {
        // Ignore if index doesn't exist
      }
    }
    console.log('✓ Dropped indexes');
    
    // Drop columns from existing tables
    try {
      await client.query('ALTER TABLE episodes DROP COLUMN IF EXISTS ai_edit_enabled CASCADE');
      await client.query('ALTER TABLE episodes DROP COLUMN IF EXISTS current_ai_edit_plan_id CASCADE');
      await client.query('ALTER TABLE episodes DROP COLUMN IF EXISTS final_video_s3_key CASCADE');
      await client.query('ALTER TABLE episodes DROP COLUMN IF EXISTS rendering_status CASCADE');
      console.log('✓ Dropped columns from episodes');
    } catch (err) {
      console.log('  Episodes columns may not exist');
    }
    
    try {
      await client.query('ALTER TABLE scenes DROP COLUMN IF EXISTS source_filename CASCADE');
      await client.query('ALTER TABLE scenes DROP COLUMN IF EXISTS take_number CASCADE');
      await client.query('ALTER TABLE scenes DROP COLUMN IF EXISTS raw_footage_s3_key CASCADE');
      await client.query('ALTER TABLE scenes DROP COLUMN IF EXISTS raw_footage_duration CASCADE');
      await client.query('ALTER TABLE scenes DROP COLUMN IF EXISTS raw_footage_metadata CASCADE');
      await client.query('ALTER TABLE scenes DROP COLUMN IF EXISTS ai_selected CASCADE');
      await client.query('ALTER TABLE scenes DROP COLUMN IF EXISTS ai_confidence_score CASCADE');
      console.log('✓ Dropped columns from scenes');
    } catch (err) {
      console.log('  Scenes columns may not exist');
    }
    
    try {
      await client.query('ALTER TABLE episode_scripts DROP COLUMN IF EXISTS ai_analysis_enabled CASCADE');
      await client.query('ALTER TABLE episode_scripts DROP COLUMN IF EXISTS last_analyzed_at CASCADE');
      console.log('✓ Dropped columns from episode_scripts');
    } catch (err) {
      console.log('  Episode_scripts columns may not exist');
    }
    
    console.log('\n✅ Cleanup complete! Ready to run migration.\n');
    
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupPartialMigration();

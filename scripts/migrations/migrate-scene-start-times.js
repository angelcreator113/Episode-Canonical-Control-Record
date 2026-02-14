/**
 * Migration Script: Add start_time_seconds to existing scenes
 * 
 * Calculates absolute start_time_seconds for each scene based on:
 * - Scene order (scene_order field)
 * - Cumulative duration of previous scenes
 * 
 * This enables CapCut-style absolute timeline positioning instead of
 * scene-based sequential layout.
 * 
 * Usage: node migrate-scene-start-times.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateSceneStartTimes() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting migration: Adding start_time_seconds to scenes...\n');
    
    // Step 1: Add column if it doesn't exist
    console.log('📝 Adding start_time_seconds column if missing...');
    await client.query(`
      ALTER TABLE episode_scenes 
      ADD COLUMN IF NOT EXISTS start_time_seconds NUMERIC(10, 3) DEFAULT 0;
    `);
    console.log('✅ Column added/verified\n');
    
    // Step 2: Get all episodes
    const episodesResult = await client.query(`
      SELECT id, title 
      FROM episodes 
      ORDER BY created_at DESC
    `);
    
    const episodes = episodesResult.rows;
    console.log(`📚 Found ${episodes.length} episodes to migrate\n`);
    
    let totalScenesUpdated = 0;
    
    // Step 3: Process each episode
    for (const episode of episodes) {
      console.log(`\n📺 Processing Episode: "${episode.title}" (ID: ${episode.id})`);
      
      // Get scenes ordered by scene_order with calculated duration
      const scenesResult = await client.query(`
        SELECT 
          es.id, 
          es.scene_order, 
          es.title_override, 
          es.start_time_seconds,
          es.manual_duration_seconds,
          es.trim_start,
          es.trim_end,
          sl.duration_seconds as library_duration
        FROM episode_scenes es
        LEFT JOIN scene_library sl ON es.scene_library_id = sl.id
        WHERE es.episode_id = $1
        ORDER BY es.scene_order ASC
      `, [episode.id]);
      
      const scenes = scenesResult.rows;
      
      if (scenes.length === 0) {
        console.log('  ⚠️  No scenes found, skipping...');
        continue;
      }
      
      console.log(`  📋 Found ${scenes.length} scenes`);
      
      // Calculate cumulative start times
      let cumulativeTime = 0;
      const updates = [];
      
      for (const scene of scenes) {
        // Calculate effective duration (same logic as EpisodeScene.effectiveDuration virtual field)
        let duration = 0;
        if (scene.manual_duration_seconds) {
          duration = parseFloat(scene.manual_duration_seconds);
        } else if (scene.library_duration) {
          const trimStart = parseFloat(scene.trim_start) || 0;
          const trimEnd = parseFloat(scene.trim_end) || parseFloat(scene.library_duration) || 0;
          duration = trimEnd - trimStart;
        }
        
        const currentStart = parseFloat(scene.start_time_seconds) || null;
        
        // Only update if start_time_seconds is null/0 or different from calculated
        if (currentStart === null || currentStart === 0 || Math.abs(currentStart - cumulativeTime) > 0.001) {
          updates.push({
            id: scene.id,
            sceneOrder: scene.scene_order,
            oldStart: currentStart,
            newStart: cumulativeTime,
            duration: duration,
            title: scene.title_override || `Scene ${scene.scene_order}`
          });
        }
        
        cumulativeTime += duration;
      }
      
      // Update scenes with new start times
      if (updates.length > 0) {
        console.log(`  🔧 Updating ${updates.length} scenes:`);
        
        for (const update of updates) {
          await client.query(`
            UPDATE episode_scenes
            SET start_time_seconds = $1
            WHERE id = $2
          `, [update.newStart, update.id]);
          
          console.log(`     Scene ${update.sceneOrder}: "${update.title}"`);
          console.log(`       Old: ${update.oldStart !== null ? update.oldStart.toFixed(2) + 's' : 'null'} → New: ${update.newStart.toFixed(2)}s (duration: ${update.duration.toFixed(2)}s)`);
          
          totalScenesUpdated++;
        }
      } else {
        console.log('  ✅ All scenes already have correct start_time_seconds');
      }
      
      const totalDuration = cumulativeTime;
      console.log(`  ⏱️  Total episode duration: ${totalDuration.toFixed(2)}s (${Math.floor(totalDuration / 60)}m ${Math.floor(totalDuration % 60)}s)`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Migration complete!`);
    console.log(`   Episodes processed: ${episodes.length}`);
    console.log(`   Scenes updated: ${totalScenesUpdated}`);
    console.log('='.repeat(60) + '\n');
    
    // Step 4: Verify migration
    console.log('🔍 Verifying migration...');
    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) as total_scenes,
        COUNT(*) FILTER (WHERE start_time_seconds IS NOT NULL AND start_time_seconds >= 0) as scenes_with_start_time
      FROM episode_scenes
    `);
    
    const { total_scenes, scenes_with_start_time } = verifyResult.rows[0];
    console.log(`   Total scenes: ${total_scenes}`);
    console.log(`   Scenes with start_time_seconds: ${scenes_with_start_time}`);
    
    if (parseInt(total_scenes) === parseInt(scenes_with_start_time)) {
      console.log('   ✅ All scenes have start_time_seconds!\n');
    } else {
      console.log('   ⚠️  Some scenes missing start_time_seconds\n');
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrateSceneStartTimes()
  .then(() => {
    console.log('🎉 Migration script finished successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });

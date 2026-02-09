const db = require('../src/models');

async function verifySchema() {
  console.log('🔍 Verifying database schema...\n');
  
  const tables = [
    // Core tables
    'shows',
    'episodes',
    'assets',
    'raw_footage',
    'scenes',
    'wardrobe',
    'wardrobe_library',
    'episode_scripts',
    'metadata_storage',
    'script_metadata',
    
    // Scene management
    'scene_library',
    'episode_scenes',
    'scene_assets',
    'scene_footage_links',
    'scene_layer_configuration',
    'scene_patterns',
    'scene_templates',
    'video_scenes',
    'thumbnail_compositions',
    
    // Assets & Layers
    'asset_roles',
    'asset_labels',
    'asset_label_map',
    'composition_assets',
    'composition_outputs',
    'episode_assets',
    'layer_assets',
    'layer_presets',
    'layers',
    'layout_templates',
    'show_assets',
    'template_studio',
    'thumbnail_templates',
    'timeline_placements',
    'video_compositions',
    
    // Wardrobe system
    'episode_outfit_items',
    'episode_outfits',
    'episode_wardrobe',
    'outfit_set_items',
    'outfit_sets',
    'wardrobe_library_references',
    'wardrobe_usage_history',
    
    // AI & Processing
    'ai_edit_plans',
    'ai_revisions',
    'ai_training_data',
    'edit_maps',
    'character_profiles',
    'video_processing_jobs',
    'upload_logs',
    
    // Decision & Learning
    'decision_logs',
    'decision_patterns',
    'editing_decisions',
    'user_decisions',
    'script_edits',
    'search_history',
    
    // Lala Formula (Week 4 Day 3.9)
    'lala_episode_formulas',
    'lala_episode_timeline',
    'lala_micro_goals',
    'lala_friend_archetypes',
    'lala_cash_grab_quests',
    
    // Game show features
    'interactive_elements',
    'episode_phases',
    'ai_interactions'
  ];
  
  let allExist = true;
  
  for (const table of tables) {
    try {
      const result = await db.sequelize.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = '${table}'
        )`,
        { type: db.sequelize.QueryTypes.SELECT }
      );
      
      const exists = result[0].exists;
      
      if (exists) {
        console.log(`✅ ${table}`);
      } else {
        console.log(`❌ ${table} - MISSING!`);
        allExist = false;
      }
    } catch (error) {
      console.log(`❌ ${table} - ERROR: ${error.message}`);
      allExist = false;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allExist) {
    console.log('✅ ALL TABLES EXIST - SCHEMA VERIFIED!');
  } else {
    console.log('❌ SOME TABLES MISSING - RUN MIGRATIONS!');
    process.exit(1);
  }
  
  process.exit(0);
}

verifySchema();

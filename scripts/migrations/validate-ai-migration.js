const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
});

(async () => {
  try {
    const [results] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (
        table_name LIKE 'ai_%' 
        OR table_name LIKE 'layer_%' 
        OR table_name = 'editing_decisions' 
        OR table_name = 'script_metadata' 
        OR table_name = 'scene_layer_configuration' 
        OR table_name = 'video_processing_jobs'
      )
      ORDER BY table_name;
    `);
    
    console.log('\n✅ New AI Tables Created:');
    results.forEach(r => console.log('  -', r.table_name));
    
    // Check modified columns in episodes
    const [episodeColumns] = await sequelize.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'episodes' 
      AND column_name IN ('ai_edit_enabled', 'current_ai_edit_plan_id', 'final_video_s3_key', 'rendering_status');
    `);
    console.log('\n✅ Episodes Table - New Columns:');
    episodeColumns.forEach(c => console.log('  -', c.column_name, `(${c.data_type})`));
    
    // Check modified columns in scenes
    const [sceneColumns] = await sequelize.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'scenes' 
      AND column_name IN ('source_filename', 'take_number', 'raw_footage_s3_key', 'raw_footage_duration', 'raw_footage_metadata', 'ai_selected', 'ai_confidence_score');
    `);
    console.log('\n✅ Scenes Table - New Columns:');
    sceneColumns.forEach(c => console.log('  -', c.column_name, `(${c.data_type})`));
    
    // Check modified columns in episode_scripts
    const [scriptColumns] = await sequelize.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'episode_scripts' 
      AND column_name IN ('ai_analysis_enabled', 'last_analyzed_at');
    `);
    console.log('\n✅ Episode Scripts Table - New Columns:');
    scriptColumns.forEach(c => console.log('  -', c.column_name, `(${c.data_type})`));
    
    // Verify trigger exists
    const [triggers] = await sequelize.query(`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE trigger_name = 'update_processing_duration';
    `);
    console.log('\n✅ Database Triggers:');
    triggers.forEach(t => console.log('  -', t.trigger_name));
    
    // Get total table count
    const [tableCount] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
    `);
    console.log(`\n📊 Total Database Tables: ${tableCount[0].count}`);
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await sequelize.close();
    process.exit(1);
  }
})();

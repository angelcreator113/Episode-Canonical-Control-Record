const { sequelize } = require('./src/models');

async function fixMigration() {
  try {
    console.log('🔧 Fixing scene_library_id column...\n');
    
    // Check current constraint
    const [results] = await sequelize.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'episode_scenes'
      AND column_name IN ('scene_library_id', 'type', 'manual_duration_seconds', 'title_override', 'note_text', 'added_by', 'last_edited_at');
    `);
    
    console.log('Current columns:');
    results.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}, nullable=${row.is_nullable}`);
    });
    console.log('');
    
    // Make scene_library_id nullable
    console.log('Making scene_library_id nullable...');
    await sequelize.query(`
      ALTER TABLE episode_scenes 
      ALTER COLUMN scene_library_id DROP NOT NULL;
    `);
    console.log('✅ scene_library_id is now nullable\n');
    
    console.log('Migration fix complete!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

fixMigration();

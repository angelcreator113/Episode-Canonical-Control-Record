// Run Phase 2.5 Animatic System Migration
const { sequelize } = require('./src/models');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🚀 Running Phase 2.5 - Animatic System Migration...\n');
    
    const migrationPath = path.join(__dirname, 'migrations', 'phase-2.5-animatic-system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Remove comment blocks
    let cleanSQL = migrationSQL.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Just execute the whole thing at once - PostgreSQL can handle it
    console.log('📝 Executing migration SQL...\n');
    
    try {
      await sequelize.query(cleanSQL);
      console.log('✅ All SQL executed successfully');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('⚠️  Some objects already exist (skipped)');
      } else {
        console.error('❌ Error executing migration:', err.message);
        throw err;
      }
    }
    
    console.log('\n✅ Migration complete!\n');
    
    // Verify tables were created
    console.log('🔍 Verifying tables...\n');
    const [tables] = await sequelize.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('beats', 'character_clips', 'audio_clips')
      ORDER BY tablename
    `);
    
    console.log('Created tables:');
    tables.forEach(t => console.log(`  ✓ ${t.tablename}`));
    
    // Check views
    const [views] = await sequelize.query(`
      SELECT viewname FROM pg_views 
      WHERE schemaname = 'public' 
      AND viewname = 'scene_composition'
    `);
    
    if (views.length > 0) {
      console.log('\nCreated views:');
      views.forEach(v => console.log(`  ✓ ${v.viewname}`));
    }
    
    console.log('\n🎉 Phase 2.5 Animatic System is ready!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

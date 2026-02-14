// Check tables using models sequelize
const { sequelize } = require('./src/models');

async function checkTables() {
  try {
    const [tables] = await sequelize.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    console.log('📋 Existing tables in episode_metadata database:\n');
    tables.forEach(t => console.log(`  - ${t.tablename}`));
    
    console.log('\n🔍 Checking for required tables:');
    const hasCharacters = tables.some(t => t.tablename === 'characters');
    const hasScenes = tables.some(t => t.tablename === 'scenes');
    const hasBeats = tables.some(t => t.tablename === 'beats');
    const hasCharacterClips = tables.some(t => t.tablename === 'character_clips');
    const hasAudioClips = tables.some(t => t.tablename === 'audio_clips');
    
    console.log(`  Characters: ${hasCharacters ? '✅ YES' : '❌ NO - Need to create!'}`);
    console.log(`  Scenes: ${hasScenes ? '✅ YES' : '❌ NO'}`);
    console.log(`  Beats: ${hasBeats ? '✅ YES' : '❌ NO (will be created)'}`);
    console.log(`  Character Clips: ${hasCharacterClips ? '✅ YES' : '❌ NO (will be created)'}`);
    console.log(`  Audio Clips: ${hasAudioClips ? '✅ YES' : '❌ NO (will be created)'}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTables();

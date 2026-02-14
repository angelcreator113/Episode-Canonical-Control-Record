// Test Phase 2.5 models loading
const { sequelize, Beat, CharacterClip, AudioClip, Scene} = require('./src/models');

async function testModels() {
  try {
    console.log('🔍 Testing Phase 2.5 Animatic System models...\n');
    
    // Check models are loaded
    console.log('✅ Models loaded:');
    console.log(`  - Beat: ${Beat ? '✓' : '✗'}`);
    console.log(`  - CharacterClip: ${CharacterClip ? '✓' : '✗'}`);
    console.log(`  - AudioClip: ${AudioClip ? '✓' : '✗'}`);
    console.log(`  - Scene: ${Scene ? '✓' : '✗'}`);
    
    // Check tables exist
    console.log('\n📋 Verifying tables in database...');
    const [tables] = await sequelize.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('beats', 'character_clips', 'audio_clips')
      ORDER BY tablename
    `);
    
    console.log('✅ Tables found:');
    tables.forEach(t => console.log(`  - ${t.tablename}`));
    
    // Check counts
    const beatResult = await Beat.findAndCountAll();
    const clipResult = await CharacterClip.findAndCountAll();
    const audioResult = await AudioClip.findAndCountAll();
    
    console.log('\n📊 Record counts:');
    console.log(`  - Beats: ${beatResult.count}`);
    console.log(`  - Character Clips: ${clipResult.count}`);
    console.log(`  - Audio Clips: ${audioResult.count}`);
    
    console.log('\n🎉 All Phase 2.5 models are working!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testModels();

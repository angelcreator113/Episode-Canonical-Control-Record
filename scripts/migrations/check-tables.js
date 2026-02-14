const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {dialect: 'postgres'});

sequelize.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
  .then(([results]) => {
    console.log('📋 Tables in database:');
    results.forEach(r => console.log('  -', r.table_name));
    
    console.log('\n🔍 Checking for required tables:');
    const hasCharacters = results.some(r => r.table_name === 'characters');
    const hasScenes = results.some(r => r.table_name === 'scenes');
    const hasBeats = results.some(r => r.table_name === 'beats');
    
    console.log(`  Characters: ${hasCharacters ? '✅ YES' : '❌ NO - Need to create!'}`);
    console.log(`  Scenes: ${hasScenes ? '✅ YES' : '❌ NO - Need to create!'}`);
    console.log(`  Beats: ${hasBeats ? '✅ YES' : '❌ NO - Not created yet (expected)'}`);
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });

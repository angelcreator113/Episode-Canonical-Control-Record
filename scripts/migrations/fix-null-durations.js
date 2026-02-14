// Fix NULL scene durations - set all to 5 seconds
const { sequelize } = require('./src/models');

const DEFAULT_DURATION = 5.0;

sequelize.query(`
  UPDATE scenes 
  SET duration_seconds = :duration 
  WHERE duration_seconds IS NULL OR duration_seconds = 0
  RETURNING id, title, scene_number, duration_seconds
`, {
  replacements: { duration: DEFAULT_DURATION },
  type: sequelize.QueryTypes.UPDATE
})
.then(([results, metadata]) => {
  console.log(`\n✅ Updated ${metadata.rowCount} scenes to ${DEFAULT_DURATION} seconds\n`);
  
  if (results && results.length > 0) {
    results.forEach(scene => {
      console.log(`  Scene ${scene.scene_number || 'NULL'}: "${scene.title}" → ${scene.duration_seconds}s`);
    });
  }
  
  console.log(`\n🎬 All scenes now have valid durations!`);
  process.exit(0);
})
.catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

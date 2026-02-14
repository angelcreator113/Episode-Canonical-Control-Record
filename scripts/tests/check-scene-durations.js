// Check scene durations for test episode
const { sequelize } = require('./src/models');

const episodeId = '2b7065de-f599-4c5b-95a7-61df8f91cffa';

sequelize.query(`
  SELECT id, title, scene_number, duration_seconds, created_at
  FROM scenes 
  WHERE episode_id = :episodeId
  ORDER BY scene_number
`, {
  replacements: { episodeId },
  type: sequelize.QueryTypes.SELECT
})
.then(scenes => {
  console.log(`\n🎬 Found ${scenes.length} scenes:\n`);
  scenes.forEach(scene => {
    console.log(`Scene ${scene.scene_number}: "${scene.title}"`);
    console.log(`  Duration: ${scene.duration_seconds} seconds`);
    console.log(`  ID: ${scene.id}`);
    console.log(`  Created: ${scene.created_at}\n`);
  });
  
  const nullCount = scenes.filter(s => s.duration_seconds === null || s.duration_seconds === 0).length;
  if (nullCount > 0) {
    console.log(`⚠️  ${nullCount} scene(s) have NULL or 0 duration - they won't render in Timeline!`);
  }
  
  process.exit(0);
})
.catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

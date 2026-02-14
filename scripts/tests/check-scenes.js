// check-scenes.js - Direct database check
const { Scene } = require('./src/models');

async function checkScenes() {
  console.log('🔍 Checking scenes in database...\n');

  try {
    const scenes = await Scene.findAll({
      attributes: ['id', 'title', 'scene_number'],
      limit: 5
    });

    console.log(`Found ${scenes.length} scenes:`);
    scenes.forEach((scene, index) => {
      console.log(`  ${index + 1}. ${scene.title} (${scene.id})`);
      console.log(`     Scene #: ${scene.scene_number || 'N/A'}`);
    });

    console.log('\n✅ Database check complete\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Check failed:', error.message);
    process.exit(1);
  }
}

checkScenes();

// setup-animatic-test.js - Create test data for animatic routes
const { Scene, Show, Episode } = require('./src/models');

async function setupTestData() {
  console.log('🔧 Setting up test data for animatic routes...\n');

  try {
    // Check for existing scene
    let scene = await Scene.findOne();
    
    if (scene) {
      console.log(`✅ Found existing scene: ${scene.title} (${scene.id})`);
      console.log('Test data ready!\n');
      process.exit(0);
    }

    // Create minimal test data
    console.log('Creating test show...');
    const show = await Show.create({
      title: 'Test Show',
      slug: 'test-show',
      status: 'active'
    });
    console.log(`✅ Created show: ${show.id}`);

    console.log('Creating test episode...');
    const episode = await Episode.create({
      show_id: show.id,
      title: 'Test Episode',
      episode_number: 1,
      status: 'draft'
    });
    console.log(`✅ Created episode: ${episode.id}`);

    console.log('Creating test scene...');
    scene = await Scene.create({
      episode_id: episode.id,
      title: 'Test Scene for Animatic',
      scene_number: 1,
      duration_seconds: 30,
      status: 'draft'
    });
    console.log(`✅ Created scene: ${scene.id}\n`);

    console.log('🎉 Test data setup complete!');
    console.log('You can now run: node test-animatic-routes.js\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

setupTestData();

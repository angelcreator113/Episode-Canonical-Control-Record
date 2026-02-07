const { models } = require('./src/models');
const { Episode, EpisodeScene, SceneLibrary } = models;

async function testEpisodeScenes() {
  try {
    console.log('Testing episode scenes query...\n');
    
    const episodeId = '2b7065de-f599-4c5b-95a7-61df8f91cffa';
    
    // Check if episode exists
    console.log('1. Checking if episode exists...');
    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      console.log('❌ Episode not found!');
      process.exit(1);
    }
    console.log('✅ Episode found:', episode.title);
    
    // Query episode scenes
    console.log('\n2. Querying episode scenes...');
    const episodeScenes = await EpisodeScene.findAll({
      where: { episode_id: episodeId },
      include: [
        {
          model: SceneLibrary,
          as: 'libraryScene',
          required: false,
        },
      ],
      order: [['scene_order', 'ASC']],
    });
    
    console.log(`✅ Found ${episodeScenes.length} episode scenes`);
    episodeScenes.forEach((es, i) => {
      console.log(`  ${i + 1}. Scene #${es.scene_order}: ${es.title_override || 'No title'} (Library: ${es.libraryScene?.title || 'none'})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testEpisodeScenes();

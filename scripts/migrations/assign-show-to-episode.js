const { models } = require('./src/models');
const { Episode, Show } = models;

async function assignShowToEpisode() {
  try {
    // Get all shows
    const shows = await Show.findAll({ limit: 10 });
    console.log('\n📚 Available Shows:');
    shows.forEach((show, idx) => {
      console.log(`  ${idx + 1}. ${show.name} (ID: ${show.id})`);
    });

    // Get the episode
    const episodeId = '51299ab6-1f9a-41af-951e-cd76cd9272a6';
    const episode = await Episode.findByPk(episodeId);
    
    if (!episode) {
      console.error('❌ Episode not found');
      process.exit(1);
    }

    console.log(`\n📺 Episode: ${episode.title} (ID: ${episode.id})`);
    console.log(`   Current show_id: ${episode.show_id || 'NULL'}`);

    if (shows.length === 0) {
      console.log('\n⚠️  No shows found. Creating a default show...');
      const defaultShow = await Show.create({
        name: 'Default Show',
        icon: '📺',
        color: '#667eea'
      });
      console.log(`✅ Created show: ${defaultShow.name} (ID: ${defaultShow.id})`);
      
      // Assign to episode
      episode.show_id = defaultShow.id;
      await episode.save();
      console.log(`✅ Assigned "${defaultShow.name}" to episode "${episode.title}"`);
    } else {
      // Use first show
      const firstShow = shows[0];
      episode.show_id = firstShow.id;
      await episode.save();
      console.log(`\n✅ Assigned "${firstShow.name}" to episode "${episode.title}"`);
    }

    console.log('\n🎉 Done! You can now upload scenes to this episode.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

assignShowToEpisode();

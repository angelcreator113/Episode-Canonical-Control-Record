const youtubeService = require('./src/services/youtubeService');

async function test() {
  try {
    console.log('🔍 Testing youtubeService.getTrainingVideos()...\n');
    
    const videos = await youtubeService.getTrainingVideos();
    
    console.log('✅ Success!');
    console.log(`Found ${videos.length} videos`);
    if (videos.length > 0) {
      console.log('\nFirst video:');
      console.log(JSON.stringify(videos[0].toJSON(), null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

test();

const youtubeService = require('../src/services/youtubeService');

async function test() {
  const testURL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Roll for testing
  
  console.log('🧪 Testing YouTube Service\n');
  
  // Test 1: Validate URL
  console.log('Test 1: Validate URL');
  const isValid = youtubeService.isValidURL(testURL);
  console.log(`  Result: ${isValid ? '✅ Valid' : '❌ Invalid'}\n`);
  
  // Test 2: Get Video ID
  console.log('Test 2: Get Video ID');
  const videoId = youtubeService.getVideoID(testURL);
  console.log(`  Result: ${videoId}\n`);
  
  // Test 3: Get Metadata (quick test)
  console.log('Test 3: Get Metadata');
  try {
    const metadata = await youtubeService.getMetadata(testURL);
    console.log(`  ✅ Title: ${metadata.title}`);
    console.log(`  ✅ Channel: ${metadata.author}`);
    console.log(`  ✅ Duration: ${metadata.lengthSeconds}s`);
    console.log(`  ✅ Views: ${metadata.viewCount.toLocaleString()}\n`);
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}\n`);
  }
  
  console.log('🎉 Basic tests complete!');
  console.log('\n⚠️ Full processing test (download + S3 + Claude) not run.');
  console.log('   Use the UI to test full workflow.');
  
  process.exit(0);
}

test();

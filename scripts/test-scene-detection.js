const ffmpegService = require('../src/services/ffmpegService');

async function test() {
  console.log('🧪 Testing Scene Detection\n');
  
  // You'll need a test video file
  const videoPath = '/tmp/test-video.mp4';
  
  // Check if file exists
  const fs = require('fs');
  if (!fs.existsSync(videoPath)) {
    console.log('❌ Test video not found at:', videoPath);
    console.log('   Please download a short test video first.');
    return;
  }

  console.log('📹 Getting video metadata...');
  const metadata = await ffmpegService.getVideoMetadata(videoPath);
  console.log(`  Duration: ${metadata.duration.toFixed(2)}s`);
  console.log(`  Resolution: ${metadata.video.width}x${metadata.video.height}`);
  console.log(`  FPS: ${metadata.video.fps.toFixed(2)}\n`);

  console.log('🎬 Detecting scenes...');
  const scenes = await ffmpegService.detectScenes(videoPath, 0.4);
  console.log(`  Found ${scenes.length} scene changes\n`);

  console.log('📊 Building scene data...');
  const sceneData = ffmpegService.buildSceneData(scenes, metadata.duration);
  console.log(`  Created ${sceneData.length} scenes\n`);

  sceneData.forEach(scene => {
    console.log(`Scene ${scene.scene_number}:`);
    console.log(`  Time: ${scene.start_time.toFixed(2)}s - ${scene.end_time.toFixed(2)}s`);
    console.log(`  Duration: ${scene.duration.toFixed(2)}s\n`);
  });

  console.log('✅ Test complete!');
}

test().catch(console.error);

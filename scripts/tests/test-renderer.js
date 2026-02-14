/**
 * Test script for the video renderer worker
 * Creates a test export job and adds it to the Bull queue.
 *
 * Usage: node test-renderer.js
 * Prerequisites: Redis must be running, worker must be running (npm run worker)
 */

require('dotenv').config();
const { addExportJob, videoQueue } = require('./src/queues/videoQueue');

async function testExport() {
  console.log('🧪 Creating test export job...\n');

  const job = await addExportJob({
    episodeId: 'test-episode-1',
    episode: {
      id: 'test-episode-1',
      title: 'Test Episode — Renderer Smoke Test',
    },
    scenes: [
      {
        id: 'scene-1',
        scene_number: 1,
        title: 'Opening Scene',
        duration_seconds: 3,
        background_url: null,
        characters: [],
        ui_elements: [
          {
            id: 'ui-title',
            label: 'Test Episode',
            position: { x: '50%', y: '40%' },
            backgroundColor: 'rgba(102, 126, 234, 0.85)',
            width: 500,
            height: 80,
            fontSize: 48,
            color: '#ffffff',
            borderRadius: 12,
          },
          {
            id: 'ui-subtitle',
            label: 'Export System Smoke Test',
            position: { x: '50%', y: '55%' },
            fontSize: 28,
            color: '#a0aec0',
          },
        ],
      },
      {
        id: 'scene-2',
        scene_number: 2,
        title: 'Middle Scene',
        duration_seconds: 2,
        background_url: null,
        characters: [],
        ui_elements: [
          {
            id: 'ui-mid',
            label: 'Scene 2 of 3',
            position: { x: '50%', y: '50%' },
            backgroundColor: 'rgba(72, 187, 120, 0.85)',
            width: 400,
            height: 60,
            fontSize: 36,
            color: '#ffffff',
            borderRadius: 10,
          },
        ],
      },
      {
        id: 'scene-3',
        scene_number: 3,
        title: 'Closing Scene',
        duration_seconds: 2,
        background_url: null,
        characters: [],
        ui_elements: [
          {
            id: 'ui-end',
            label: 'Export Complete ✓',
            position: { x: '50%', y: '50%' },
            backgroundColor: 'rgba(237, 137, 54, 0.85)',
            width: 450,
            height: 70,
            fontSize: 42,
            color: '#ffffff',
            borderRadius: 10,
          },
        ],
      },
    ],
    platform: {
      platform: 'youtube',
      width: 1920,
      height: 1080,
      ratio: '16:9',
    },
    timeline: {
      beats: [],
      markers: [],
      audioClips: [],
      characterClips: [],
      keyframes: [],
    },
    userId: 'test-user',
  });

  console.log(`✅ Job created: ${job.id}`);
  console.log(`   Queue: video-export`);
  console.log(`   Monitor: http://localhost:3002/admin/queues\n`);

  // Watch for completion
  console.log('⏳ Waiting for job to complete...\n');

  job.finished()
    .then((result) => {
      console.log('\n🎉 Export completed!');
      console.log('   Result:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Export failed:', err.message);
      process.exit(1);
    });

  // Also listen for progress events
  videoQueue.on('progress', (j, progress) => {
    if (j.id === job.id) {
      process.stdout.write(`\r   Progress: ${progress}%`);
    }
  });

  // Timeout after 2 minutes
  setTimeout(() => {
    console.log('\n\n⏰ Timeout — job did not complete in 2 minutes');
    console.log('   Check worker logs and /admin/queues for status');
    process.exit(1);
  }, 120000);
}

testExport().catch((err) => {
  console.error('❌ Failed to create test job:', err.message);
  console.error('   Is Redis running? Try: docker run -d -p 6379:6379 redis:alpine');
  process.exit(1);
});

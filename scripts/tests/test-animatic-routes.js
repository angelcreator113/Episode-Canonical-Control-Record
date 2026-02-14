// test-animatic-routes.js - Test Beat Generation and Composition Endpoints
// Phase 2.5: Animatic System Extended Routes

const axios = require('axios');

const BASE_URL = 'http://localhost:3002/api/v1';

/**
 * Test Animatic Routes
 * Tests beat generation, preview, and composition endpoints
 */
async function testAnimaticRoutes() {
  console.log('🎬 Testing Animatic Auto-Generation Routes\n');

  try {
    // Step 1: Get a test scene
    console.log('Step 1: Getting test scene...');
    console.log(`   Connecting to: ${BASE_URL}`);
    
    const scenesResponse = await axios.get(`${BASE_URL}/scenes`, {
      params: { limit: 1 }
    });

    if (!scenesResponse.data.data || scenesResponse.data.data.length === 0) {
      console.error('❌ No scenes found in database');
      console.error('   Run: node setup-animatic-test.js');
      process.exit(1);
    }

    const sceneId = scenesResponse.data.data[0].id;
    const sceneTitle = scenesResponse.data.data[0].title;
    console.log(`✅ Found scene: ${sceneTitle} (${sceneId})\n`);

    // Step 2: Preview beat generation
    console.log('Step 2: Previewing beat generation...');
    const scriptLines = [
      {
        id: 'line-1',
        character_id: '00000000-0000-0000-0000-000000000001',
        character_name: 'LaLa',
        dialogue: 'Welcome to At the Table! Today we\'re discussing gratitude.',
        emotion: 'excited',
        estimated_duration: 3.5
      },
      {
        id: 'line-2',
        character_id: '00000000-0000-0000-0000-000000000002',
        character_name: 'Guest',
        dialogue: 'Thanks for having me, LaLa! I\'m excited to be here.',
        emotion: 'happy',
        estimated_duration: 3.0
      },
      {
        id: 'line-3',
        character_id: '00000000-0000-0000-0000-000000000001',
        character_name: 'LaLa',
        dialogue: 'Let\'s start with a simple question - what are you grateful for today?',
        emotion: 'curious',
        estimated_duration: 3.5
      }
    ];

    const previewResponse = await axios.post(
      `${BASE_URL}/scenes/${sceneId}/beats/preview`,
      {
        scriptLines,
        options: {
          defaultDuration: 2.5,
          paddingBetweenLines: 0.3,
          autoGenerateIdle: true,
          includeUIBeats: false
        }
      }
    );

    const preview = previewResponse.data.data;
    console.log(`✅ Preview generated:`);
    console.log(`   Total Duration: ${preview.total_duration.toFixed(1)}s`);
    console.log(`   Beat Count: ${preview.beat_count}`);
    console.log(`   Dialogue Beats: ${preview.dialogue_count}`);
    console.log(`   Character Clips: ${preview.character_clip_count}`);
    console.log(`   Idle Clips (est.): ${preview.idle_clip_count}`);
    console.log(`   Characters: ${preview.characters.join(', ')}\n`);

    // Step 3: Clear existing beats
    console.log('Step 3: Clearing existing beats...');
    const clearResponse = await axios.delete(`${BASE_URL}/scenes/${sceneId}/beats/clear`);
    console.log(`✅ Cleared: ${clearResponse.data.data.beats_deleted} beats, ${clearResponse.data.data.clips_deleted} clips\n`);

    // Step 4: Generate beats
    console.log('Step 4: Generating beats...');
    const generateResponse = await axios.post(
      `${BASE_URL}/scenes/${sceneId}/beats/generate`,
      {
        scriptLines,
        options: {
          defaultDuration: 2.5,
          paddingBetweenLines: 0.3,
          autoGenerateIdle: true,
          includeUIBeats: false
        }
      }
    );

    console.log(`✅ Generated ${generateResponse.data.data.count} beats\n`);

    // Step 5: Get scene composition
    console.log('Step 5: Getting scene composition...');
    const compositionResponse = await axios.get(`${BASE_URL}/scenes/${sceneId}/composition`);
    const composition = compositionResponse.data.data;

    console.log(`✅ Scene Composition:`);
    console.log(`   Scene: ${composition.scene.title}`);
    console.log(`   Duration: ${composition.scene.duration_seconds}s`);
    console.log(`   Beats: ${composition.stats.total_beats} (${composition.stats.dialogue_beats} dialogue)`);
    console.log(`   Character Clips: ${composition.stats.total_character_clips} (${composition.stats.dialogue_clips} dialogue, ${composition.stats.idle_clips} idle)`);
    console.log(`   Audio Clips: ${composition.stats.total_audio_clips}\n`);

    // Step 6: Get timeline data
    console.log('Step 6: Getting timeline visualization data...');
    const timelineResponse = await axios.get(`${BASE_URL}/scenes/${sceneId}/timeline`);
    const timeline = timelineResponse.data.data;

    console.log(`✅ Timeline Data:`);
    console.log(`   Beat Track: ${timeline.tracks.beats.length} items`);
    console.log(`   Character Clip Track: ${timeline.tracks.character_clips.length} items`);
    console.log(`   Audio Clip Track: ${timeline.tracks.audio_clips.length} items`);

    if (timeline.tracks.beats.length > 0) {
      const firstBeat = timeline.tracks.beats[0];
      console.log(`\n   📌 First Beat:`);
      console.log(`      Type: ${firstBeat.type}`);
      console.log(`      Label: ${firstBeat.label}`);
      console.log(`      Time: ${firstBeat.start}s - ${firstBeat.end}s (${firstBeat.duration}s)`);
      console.log(`      Status: ${firstBeat.status}`);
    }

    if (timeline.tracks.character_clips.length > 0) {
      const firstClip = timeline.tracks.character_clips[0];
      console.log(`\n   📌 First Character Clip:`);
      console.log(`      Role: ${firstClip.role}`);
      console.log(`      Expression: ${firstClip.expression}`);
      console.log(`      Animation: ${firstClip.animation}`);
      console.log(`      Time: ${firstClip.start}s - ${firstClip.end}s (${firstClip.duration}s)`);
      console.log(`      Status: ${firstClip.status}`);
    }

    console.log('\n');

    // Step 7: Generate dialogue clips for existing beats
    console.log('Step 7: Generating dialogue clips from beats...');
    const dialogueResponse = await axios.post(`${BASE_URL}/scenes/${sceneId}/beats/dialogue-clips`);
    console.log(`✅ Generated ${dialogueResponse.data.data.count} dialogue clips\n`);

    // Step 8: Verify final composition
    console.log('Step 8: Verifying final composition...');
    const finalComposition = await axios.get(`${BASE_URL}/scenes/${sceneId}/composition`);
    const finalStats = finalComposition.data.data.stats;

    console.log(`✅ Final Scene State:`);
    console.log(`   Total Beats: ${finalStats.total_beats}`);
    console.log(`   Total Character Clips: ${finalStats.total_character_clips}`);
    console.log(`   Dialogue Clips: ${finalStats.dialogue_clips}`);
    console.log(`   Idle Clips: ${finalStats.idle_clips}\n`);

    // Step 9: Cleanup
    console.log('Step 9: Cleaning up...');
    await axios.delete(`${BASE_URL}/scenes/${sceneId}/beats/clear`);
    console.log('✅ Test data cleaned up\n');

    console.log('🎉 All Animatic Route tests passed!\n');
    console.log('📊 Summary:');
    console.log('  ✅ Beat generation preview');
    console.log('  ✅ Beat auto-generation from script');
    console.log('  ✅ Scene composition endpoint');
    console.log('  ✅ Timeline visualization endpoint');
    console.log('  ✅ Dialogue clip generation');
    console.log('  ✅ Clear beats operation');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Server not running!');
      console.error('   Start server: npm start');
      console.error('   Or check BASE_URL in test file');
    } else if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run test
testAnimaticRoutes();

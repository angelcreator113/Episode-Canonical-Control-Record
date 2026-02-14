// test-beat-service.js - Test Beat Auto-Generation Service
// Phase 2.5: Animatic System

const beatService = require('./src/services/beatService');
const { Scene } = require('./src/models');
const { Op } = require('sequelize');

/**
 * Test Beat Auto-Generation
 * 
 * This demonstrates the automated beat generation from script lines
 */

async function testBeatService() {
  console.log('🎬 Testing Beat Auto-Generation Service\n');

  try {
    // Step 1: Find a test scene
    console.log('Step 1: Finding test scene...');
    const scene = await Scene.findOne({
      where: { duration_seconds: { [Op.ne]: null } },
      order: [['created_at', 'DESC']]
    });

    if (!scene) {
      console.error('❌ No scenes found in database');
      process.exit(1);
    }

    console.log(`✅ Found scene: ${scene.title} (${scene.id})`);
    console.log(`   Duration: ${scene.duration_seconds}s\n`);

    const sceneId = scene.id;

    // Step 2: Define sample script lines
    console.log('Step 2: Preparing script lines...');
    const scriptLines = [
      {
        id: 'line-1',
        character_id: '00000000-0000-0000-0000-000000000001',
        character_name: 'LaLa',
        dialogue: 'Welcome to At the Table! Today we\'re talking about gratitude.',
        emotion: 'excited',
        estimated_duration: 3.5
      },
      {
        id: 'line-2',
        character_id: '00000000-0000-0000-0000-000000000002',
        character_name: 'Guest',
        dialogue: 'Thanks for having me, LaLa!',
        emotion: 'happy',
        estimated_duration: 2.0
      },
      {
        id: 'line-3',
        character_id: '00000000-0000-0000-0000-000000000001',
        character_name: 'LaLa',
        dialogue: 'So tell me, what are you grateful for today?',
        emotion: 'curious',
        estimated_duration: 2.5
      },
      {
        id: 'line-4',
        character_id: '00000000-0000-0000-0000-000000000002',
        character_name: 'Guest',
        dialogue: 'I\'m grateful for the opportunity to connect with people.',
        emotion: 'thoughtful',
        estimated_duration: 3.0
      }
    ];

    console.log(`✅ Prepared ${scriptLines.length} script lines\n`);

    // Step 3: Preview generation
    console.log('Step 3: Previewing generation...');
    const preview = await beatService.previewGeneration(sceneId, scriptLines, {
      defaultDuration: 2.5,
      paddingBetweenLines: 0.3,
      autoGenerateIdle: true,
      includeUIBeats: false
    });

    console.log('📊 Generation Preview:');
    console.log(`   Total Duration: ${preview.total_duration.toFixed(1)}s`);
    console.log(`   Beat Count: ${preview.beat_count}`);
    console.log(`   Dialogue Beats: ${preview.dialogue_count}`);
    console.log(`   Character Clips: ${preview.character_clip_count}`);
    console.log(`   Idle Clips (estimated): ${preview.idle_clip_count}`);
    console.log(`   Characters: ${preview.characters.join(', ')}\n`);

    // Step 4: Clear existing beats (if any)
    console.log('Step 4: Clearing existing beats...');
    const cleared = await beatService.clearSceneBeats(sceneId);
    console.log(`✅ Cleared ${cleared.beats_deleted} beats and ${cleared.clips_deleted} clips\n`);

    // Step 5: Generate beats
    console.log('Step 5: Generating beats from script...');
    const generatedBeats = await beatService.generateBeatsFromScript(
      sceneId,
      scriptLines,
      {
        defaultDuration: 2.5,
        paddingBetweenLines: 0.3,
        autoGenerateIdle: true,
        includeUIBeats: false
      }
    );

    console.log(`✅ Generated ${generatedBeats.length} beats:`);
    generatedBeats.forEach((beat, i) => {
      console.log(
        `   ${i + 1}. [${beat.beat_type}] ${beat.label} ` +
        `@ ${beat.start_time}s (${beat.duration}s)`
      );
    });
    console.log('');

    // Step 6: Get all beats with associations
    console.log('Step 6: Fetching beats...');
    const beats = await beatService.getSceneBeats(sceneId);
    console.log(`✅ Retrieved ${beats.length} beats from database\n`);

    // Step 7: Get all character clips
    console.log('Step 7: Fetching character clips...');
    const clips = await beatService.getSceneCharacterClips(sceneId);
    console.log(`✅ Retrieved ${clips.length} character clips:`);
    
    const dialogueClips = clips.filter(c => c.role === 'dialogue');
    const idleClips = clips.filter(c => c.role === 'idle');
    
    console.log(`   Dialogue clips: ${dialogueClips.length}`);
    console.log(`   Idle clips: ${idleClips.length}\n`);

    // Step 8: Show sample idle clip details
    if (idleClips.length > 0) {
      console.log('📌 Sample Idle Clip:');
      const sampleIdle = idleClips[0];
      console.log(`   Character: ${sampleIdle.character_id}`);
      console.log(`   Start: ${sampleIdle.start_time}s`);
      console.log(`   Duration: ${sampleIdle.duration}s`);
      console.log(`   Expression: ${sampleIdle.expression}`);
      console.log(`   Animation: ${sampleIdle.animation_type}`);
      console.log(`   Context: ${sampleIdle.metadata.context}\n`);
    }

    // Step 9: Update a beat
    console.log('Step 9: Testing beat update...');
    const beatToUpdate = beats[0];
    const updatedBeat = await beatService.updateBeat(beatToUpdate.id, {
      status: 'approved'
    });
    console.log(`✅ Updated beat status to: ${updatedBeat.status}\n`);

    // Step 10: Cleanup
    console.log('Step 10: Cleaning up test data...');
    await beatService.clearSceneBeats(sceneId);
    console.log('✅ Test data cleaned up\n');

    console.log('🎉 All Beat Service tests passed!\n');
    console.log('📊 Summary:');
    console.log('  ✅ Preview generation');
    console.log('  ✅ Beat auto-generation from script');
    console.log('  ✅ Idle clip auto-generation');
    console.log('  ✅ Beat retrieval with associations');
    console.log('  ✅ Character clip retrieval');
    console.log('  ✅ Beat updates');
    console.log('  ✅ Cleanup operations');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run test
testBeatService();

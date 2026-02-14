// Test Phase 2.5 Animatic System API
const axios = require('axios');

const BASE_URL = 'http://localhost:3002/api/v1';

async function testAnimaticSystem() {
  try {
    console.log('🧪 Testing Phase 2.5 Animatic System API\n');
    
    // Step 1: Get a scene to work with
    console.log('1️⃣  Fetching test scene...');
    const scenesResponse = await axios.get(`${BASE_URL}/scenes?limit=1`);
    
    if (!scenesResponse.data.data || scenesResponse.data.data.length === 0) {
      console.log('❌ No scenes found in database. Create a scene first.');
      process.exit(1);
    }
    
    const testScene = scenesResponse.data.data[0];
    const sceneId = testScene.id;
    console.log(`✅ Using scene: ${testScene.title} (ID: ${sceneId})\n`);
    
    // Step 2: Create a beat
    console.log('2️⃣  Creating beat...');
    const beatData = {
      beat_type: 'dialogue',
      label: 'LaLa introduces topic',
      start_time: 0.5,
      duration: 2.5,
      payload: {
        line: 'Welcome back to At the Table!',
        emotion: 'excited',
      },
      status: 'draft',
    };
    
    const beatResponse = await axios.post(`${BASE_URL}/scenes/${sceneId}/beats`, beatData);
    const beatId = beatResponse.data.data.id;
    console.log(`✅ Beat created: ${beatResponse.data.data.label} (ID: ${beatId})\n`);
    
    // Step 3: Create character clip
    console.log('3️⃣  Creating character clip...');
    const clipData = {
      character_id: '00000000-0000-0000-0000-000000000001', // Placeholder UUID
      beat_id: beatId,
      role: 'dialogue',
      start_time: 0.5,
      duration: 2.5,
      expression: 'excited',
      status: 'placeholder',
      metadata: {
        notes: 'Needs enthusiastic delivery',
      },
    };
    
    const clipResponse = await axios.post(`${BASE_URL}/scenes/${sceneId}/character-clips`, clipData);
    const clipId = clipResponse.data.data.id;
    console.log(`✅ Character clip created: ${clipResponse.data.data.role} - ${clipResponse.data.data.expression} (ID: ${clipId})\n`);
    
    // Step 4: Create audio clip
    console.log('4️⃣  Creating audio clip...');
    const audioData = {
      beat_id: beatId,
      track_type: 'dialogue',
      start_time: 0.5,
      duration: 2.5,
      url: 's3://test-bucket/audio/lala-intro.mp3',
      status: 'tts',
      metadata: {
        voice: 'alloy',
        volume: 0.8,
        source: 'openai-tts',
      },
    };
    
    const audioResponse = await axios.post(`${BASE_URL}/scenes/${sceneId}/audio-clips`, audioData);
    const audioId = audioResponse.data.data.id;
    console.log(`✅ Audio clip created: ${audioResponse.data.data.track_type} (ID: ${audioId})\n`);
    
    // Step 5: List all beats for scene
    console.log('5️⃣  Listing beats for scene...');
    const beatsListResponse = await axios.get(`${BASE_URL}/scenes/${sceneId}/beats`);
    console.log(`✅ Found ${beatsListResponse.data.count} beat(s)\n`);
    
    // Step 6: List all character clips for scene
    console.log('6️⃣  Listing character clips for scene...');
    const clipsListResponse = await axios.get(`${BASE_URL}/scenes/${sceneId}/character-clips`);
    console.log(`✅ Found ${clipsListResponse.data.count} character clip(s)\n`);
    
    // Step 7: List all audio clips for scene
    console.log('7️⃣  Listing audio clips for scene...');
    const audioListResponse = await axios.get(`${BASE_URL}/scenes/${sceneId}/audio-clips`);
    console.log(`✅ Found ${audioListResponse.data.count} audio clip(s)\n`);
    
    // Step 8: Update beat
    console.log('8️⃣  Updating beat status...');
    const updateBeatResponse = await axios.patch(`${BASE_URL}/beats/${beatId}`, {
      status: 'approved',
    });
    console.log(`✅ Beat status updated: ${updateBeatResponse.data.data.status}\n`);
    
    // Step 9: Update character clip
    console.log('9️⃣  Updating character clip...');
    const updateClipResponse = await axios.patch(`${BASE_URL}/character-clips/${clipId}`, {
      status: 'generated',
      video_url: 's3://test-bucket/video/lala-intro-clip.mp4',
    });
    console.log(`✅ Character clip updated: ${updateClipResponse.data.data.status}\n`);
    
    // Step 10: Update audio clip
    console.log('🔟  Updating audio clip...');
    const updateAudioResponse = await axios.patch(`${BASE_URL}/audio-clips/${audioId}`, {
      status: 'final',
    });
    console.log(`✅ Audio clip updated: ${updateAudioResponse.data.data.status}\n`);
    
    // Step 11: Get complete scene data with includes
    console.log('1️⃣1️⃣   Getting complete scene composition...');
    const sceneDataResponse = await axios.get(`${BASE_URL}/scenes/${sceneId}?include=thumbnail`);
    console.log(`✅ Scene loaded: ${sceneDataResponse.data.data.title}\n`);
    
    // Step 12: Clean up - Delete created records
    console.log('1️⃣2️⃣   Cleaning up test data...');
    await axios.delete(`${BASE_URL}/audio-clips/${audioId}`);
    console.log('  ✓ Audio clip deleted');
    
    await axios.delete(`${BASE_URL}/character-clips/${clipId}`);
    console.log('  ✓ Character clip deleted');
    
    await axios.delete(`${BASE_URL}/beats/${beatId}`);
    console.log('  ✓ Beat deleted');
    
    console.log('\n🎉 All Phase 2.5 Animatic System API tests passed!\n');
    console.log('📊 Summary:');
    console.log('  ✅ Beat CRUD operations');
    console.log('  ✅ Character Clip CRUD operations');
    console.log('  ✅ Audio Clip CRUD operations');
    console.log('  ✅ Scene-scoped queries');
    console.log('  ✅ Filtering and includes');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

testAnimaticSystem();

/**
 * Test Icon Cue Timeline System API Endpoints
 */

const http = require('http');

const BASE_URL = 'http://localhost:3002/api/v1';

// Helper to make HTTP requests
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const fullUrl = `http://localhost:3002${path}`;
    const url = new URL(fullUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Icon Cue Timeline System API...\n');
  
  try {
    // Test 1: Get all icon slots
    console.log('1️⃣  Testing GET /api/v1/icon-slots/mappings');
    const slotsResponse = await makeRequest('/api/v1/icon-slots/mappings');
    if (slotsResponse.status === 200) {
      const slots = slotsResponse.data.data || slotsResponse.data;
      console.log(`   ✅ Success! Found ${slots.length} icon slots`);
      const uniqueSlots = [...new Set(slots.map(s => s.slot_id))];
      console.log(`   📊 Slots: ${uniqueSlots.join(', ')}`);
    } else {
      console.log(`   ❌ Failed with status ${slotsResponse.status}`);
    }
    
    // Test 2: Get icon slots by slot_id
    console.log('\n2️⃣  Testing GET /api/v1/icon-slots/slot/slot_2');
    const slot2Response = await makeRequest('/api/v1/icon-slots/slot/slot_2');
    if (slot2Response.status === 200) {
      const slot2Icons = slot2Response.data.data || slot2Response.data;
      console.log(`   ✅ Success! Found ${slot2Icons.length} icons for slot_2`);
      console.log(`   🎨 Roles: ${slot2Icons.slice(0, 3).map(s => s.asset_role).join(', ')}...`);
    } else {
      console.log(`   ❌ Failed with status ${slot2Response.status}`);
    }
    
    // Test 3: Get icon slots by category
    console.log('\n3️⃣  Testing GET /api/v1/icon-slots/category/persistent');
    const persistentResponse = await makeRequest('/api/v1/icon-slots/category/persistent');
    if (persistentResponse.status === 200) {
      const persistentIcons = persistentResponse.data.data || persistentResponse.data;
      console.log(`   ✅ Success! Found ${persistentIcons.length} persistent icons`);
      console.log(`   🔒 Persistent: ${persistentIcons.map(s => s.asset_role).join(', ')}`);
    } else {
      console.log(`   ❌ Failed with status ${persistentResponse.status}`);
    }
    
    // Test 4: Get episodes (need one for further tests)
    console.log('\n4️⃣  Testing GET /api/v1/episodes (need episode ID)');
    const episodesResponse = await makeRequest('/api/v1/episodes');
    const episodes = episodesResponse.data.data || episodesResponse.data || [];
    if (episodesResponse.status === 200 && episodes.length > 0) {
      const firstEpisode = episodes[0];
      console.log(`   ✅ Success! Found episode: ${firstEpisode.episode_number || firstEpisode.id}`);
      
      // Test 5: Get icon cues for episode
      console.log(`\n5️⃣  Testing GET /api/v1/episodes/${firstEpisode.id}/icon-cues`);
      const iconCuesResponse = await makeRequest(`/api/v1/episodes/${firstEpisode.id}/icon-cues`);
      if (iconCuesResponse.status === 200) {
        const iconCues = iconCuesResponse.data.data || iconCuesResponse.data || [];
        console.log(`   ✅ Success! Found ${iconCues.length} icon cues`);
      } else {
        console.log(`   ❌ Failed with status ${iconCuesResponse.status}`);
      }
      
      // Test 6: Get cursor paths for episode
      console.log(`\n6️⃣  Testing GET /api/v1/episodes/${firstEpisode.id}/cursor-paths`);
      const cursorPathsResponse = await makeRequest(`/api/v1/episodes/${firstEpisode.id}/cursor-paths`);
      if (cursorPathsResponse.status === 200) {
        const cursorPaths = cursorPathsResponse.data.data || cursorPathsResponse.data || [];
        console.log(`   ✅ Success! Found ${cursorPaths.length} cursor paths`);
      } else {
        console.log(`   ❌ Failed with status ${cursorPathsResponse.status}`);
      }
      
      // Test 7: Get music cues for episode
      console.log(`\n7️⃣  Testing GET /api/v1/episodes/${firstEpisode.id}/music-cues`);
      const musicCuesResponse = await makeRequest(`/api/v1/episodes/${firstEpisode.id}/music-cues`);
      if (musicCuesResponse.status === 200) {
        const musicCues = musicCuesResponse.data.data || musicCuesResponse.data || [];
        console.log(`   ✅ Success! Found ${musicCues.length} music cues`);
      } else {
        console.log(`   ❌ Failed with status ${musicCuesResponse.status}`);
      }
      
      // Test 8: Get production packages for episode
      console.log(`\n8️⃣  Testing GET /api/v1/episodes/${firstEpisode.id}/production-package`);
      const packageResponse = await makeRequest(`/api/v1/episodes/${firstEpisode.id}/production-package`);
      if (packageResponse.status === 200) {
        const packages = packageResponse.data.data || packageResponse.data || [];
        console.log(`   ✅ Success! Found ${packages.length} production packages`);
      } else {
        console.log(`   ❌ Failed with status ${packageResponse.status}`);
      }
    } else {
      console.log('   ⚠️  No episodes found, skipping episode-specific tests');
    }
    
    console.log('\n✅ Icon Cue Timeline System API tests completed!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

runTests();

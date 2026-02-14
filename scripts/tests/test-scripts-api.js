/**
 * Test scripts API endpoints
 */

const http = require('http');

const baseUrl = 'http://127.0.0.1:3002';

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Scripts API\n');

  try {
    // Test 1: Get episodes
    console.log('1️⃣  Getting episodes...');
    const episodesRes = await makeRequest('/api/v1/episodes?limit=1');
    console.log(`   Status: ${episodesRes.status}`);
    
    if (episodesRes.data.data && episodesRes.data.data.length > 0) {
      const episodeId = episodesRes.data.data[0].id;
      console.log(`   ✓ Episode ID: ${episodeId}\n`);

      // Test 2: Get scripts for episode (should be empty)
      console.log('2️⃣  Getting scripts for episode...');
      const scriptsRes = await makeRequest(`/api/v1/episodes/${episodeId}/scripts`);
      console.log(`   Status: ${scriptsRes.status}`);
      console.log(`   Scripts count: ${scriptsRes.data.count || 0}`);
      console.log(`   ✓ Scripts: ${JSON.stringify(scriptsRes.data.data, null, 2)}\n`);

      // Test 3: Create a new script
      console.log('3️⃣  Creating a new script...');
      const newScript = {
        scriptType: 'main',
        versionLabel: 'First Draft',
        author: 'Test Writer',
        status: 'draft',
        duration: 1800, // 30 minutes in seconds
        sceneCount: 15,
        content: 'INT. TESTING FACILITY - DAY\n\nWe see a developer testing the scripts API...',
      };

      const createRes = await makeRequest(
        `/api/v1/episodes/${episodeId}/scripts`,
        'POST',
        newScript
      );
      console.log(`   Status: ${createRes.status}`);
      console.log(`   ✓ Created script:`, JSON.stringify(createRes.data, null, 2), '\n');

      if (createRes.data.data) {
        const scriptId = createRes.data.data.id;

        // Test 4: Get the created script
        console.log('4️⃣  Getting created script...');
        const getScriptRes = await makeRequest(`/api/v1/scripts/${scriptId}?includeContent=true`);
        console.log(`   Status: ${getScriptRes.status}`);
        console.log(`   ✓ Script:`, JSON.stringify(getScriptRes.data.data, null, 2), '\n');

        // Test 5: Update the script
        console.log('5️⃣  Updating script...');
        const updateRes = await makeRequest(
          `/api/v1/scripts/${scriptId}`,
          'PATCH',
          { status: 'final', duration: 1920 }
        );
        console.log(`   Status: ${updateRes.status}`);
        console.log(`   ✓ Updated script:`, JSON.stringify(updateRes.data.data, null, 2), '\n');

        // Test 6: Create another version
        console.log('6️⃣  Creating second version...');
        const version2 = {
          ...newScript,
          versionLabel: 'Second Draft',
          content: 'INT. TESTING FACILITY - DAY\n\nThe API test continues with version 2...',
        };
        const v2Res = await makeRequest(`/api/v1/episodes/${episodeId}/scripts`, 'POST', version2);
        console.log(`   Status: ${v2Res.status}`);
        console.log(`   ✓ Version 2:`, JSON.stringify(v2Res.data.data, null, 2), '\n');

        // Test 7: Get all versions
        console.log('7️⃣  Getting all versions...');
        const versionsRes = await makeRequest(
          `/api/v1/episodes/${episodeId}/scripts/main/versions`
        );
        console.log(`   Status: ${versionsRes.status}`);
        console.log(`   Versions count: ${versionsRes.data.count}`);
        console.log(`   ✓ Versions:`, JSON.stringify(versionsRes.data.data, null, 2), '\n');

        // Test 8: Set first version as primary
        console.log('8️⃣  Setting first version as primary...');
        const primaryRes = await makeRequest(`/api/v1/scripts/${scriptId}/set-primary`, 'POST');
        console.log(`   Status: ${primaryRes.status}`);
        console.log(`   ✓ Primary set:`, JSON.stringify(primaryRes.data, null, 2), '\n');

        // Test 9: Get edit history
        console.log('9️⃣  Getting edit history...');
        const historyRes = await makeRequest(`/api/v1/scripts/${scriptId}/history`);
        console.log(`   Status: ${historyRes.status}`);
        console.log(`   History count: ${historyRes.data.count}`);
        console.log(`   ✓ History:`, JSON.stringify(historyRes.data.data, null, 2), '\n');

        // Test 10: Search scripts
        console.log('🔟 Searching scripts...');
        const searchRes = await makeRequest('/api/v1/scripts/search?scriptType=main');
        console.log(`   Status: ${searchRes.status}`);
        console.log(`   Search results: ${searchRes.data.count}`);
        console.log(`   ✓ Results:`, JSON.stringify(searchRes.data.data, null, 2), '\n');
      }
    } else {
      console.log('   ❌ No episodes found. Please seed the database first.\n');
    }

    console.log('✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
runTests();

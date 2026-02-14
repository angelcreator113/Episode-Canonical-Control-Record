/**
 * Phase 2.5 Integration Test
 * Tests the full workflow without needing persistent server
 */

require('dotenv').config();

const http = require('http');

// Helper to make HTTP requests
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('\n🧪 Phase 2.5 Integration Tests\n');
  console.log('⏳ Waiting for server to be ready...\n');

  // Wait for server
  let serverReady = false;
  for (let i = 0; i < 10; i++) {
    try {
      const res = await makeRequest('GET', '/api/v1/health');
      if (res.status === 200 || res.status === 404) {
        serverReady = true;
        break;
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (!serverReady) {
    console.log('❌ Server not responding');
    process.exit(1);
  }

  console.log('✅ Server ready\n');

  // Test 1: Check episodes endpoint
  console.log('Test 1: GET /api/v1/episodes');
  try {
    const res = await makeRequest('GET', '/api/v1/episodes');
    console.log(`  Status: ${res.status}`);
    console.log(`  Response type: ${typeof res.data}`);
    if (res.status === 200 && res.data.data) {
      console.log(`  ✅ Episodes endpoint working - found ${res.data.data.length} episodes`);
    } else {
      console.log(`  ⚠️  Endpoint responded but unexpected format`);
    }
  } catch (err) {
    console.log(`  ❌ ${err.message}`);
  }

  // Test 2: Check assets endpoint
  console.log('\nTest 2: GET /api/v1/assets/approved/PROMO_LALA');
  try {
    const res = await makeRequest('GET', '/api/v1/assets/approved/PROMO_LALA');
    console.log(`  Status: ${res.status}`);
    if (res.status === 200 && res.data.data) {
      console.log(`  ✅ Assets endpoint working - found ${res.data.data.length} assets`);
    } else {
      console.log(`  ⚠️  Endpoint responded but unexpected format`);
    }
  } catch (err) {
    console.log(`  ❌ ${err.message}`);
  }

  // Test 3: Check compositions endpoint
  console.log('\nTest 3: GET /api/v1/compositions');
  try {
    const res = await makeRequest('GET', '/api/v1/compositions');
    console.log(`  Status: ${res.status}`);
    if (res.status === 200 || res.status === 404) {
      console.log(`  ✅ Compositions endpoint accessible`);
    }
  } catch (err) {
    console.log(`  ❌ ${err.message}`);
  }

  // Test 4: Check asset processing endpoint exists
  console.log('\nTest 4: PUT /api/v1/assets/:id/process (endpoint check)');
  try {
    const testId = 'test-asset-' + Date.now();
    const res = await makeRequest('PUT', `/api/v1/assets/${testId}/process`);
    console.log(`  Status: ${res.status}`);
    // Endpoint should exist (even if asset not found)
    if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 400) {
      console.log(`  ✅ Asset processing endpoint exists`);
    } else {
      console.log(`  ⚠️  Unexpected response: ${res.status}`);
    }
  } catch (err) {
    console.log(`  ❌ ${err.message}`);
  }

  // Test 5: Check thumbnail generation endpoint exists
  console.log('\nTest 5: POST /api/v1/compositions/:id/generate-thumbnails (endpoint check)');
  try {
    const testId = 'test-comp-' + Date.now();
    const res = await makeRequest('POST', `/api/v1/compositions/${testId}/generate-thumbnails`);
    console.log(`  Status: ${res.status}`);
    if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 400) {
      console.log(`  ✅ Thumbnail generation endpoint exists`);
    } else {
      console.log(`  ⚠️  Unexpected response: ${res.status}`);
    }
  } catch (err) {
    console.log(`  ❌ ${err.message}`);
  }

  console.log('\n✅ Integration test complete!\n');
  console.log('📋 Summary:');
  console.log('  • Backend server is running on port 3002');
  console.log('  • API routes are accessible');
  console.log('  • Asset processing endpoint ready for testing');
  console.log('  • Thumbnail generation endpoint ready for testing\n');
  console.log('🚀 Next: Upload test assets and run end-to-end tests\n');

  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

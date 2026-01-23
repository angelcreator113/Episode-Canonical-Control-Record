/**
 * Test All Endpoints
 * Quick check for common backend endpoints
 */

const https = require('https');

const BASE_URL = 'https://dev.primepisodes.com';
const TEST_EPISODE_ID = 'fbfdaa3e-c20c-4bda-8fd3-0927c79867c9';
const TEST_SCENE_ID = '00000000-0000-0000-0000-000000000001'; // You'll need a real scene ID

const endpoints = [
  { name: 'Episodes List', path: '/api/v1/episodes' },
  { name: 'Episode Detail', path: `/api/v1/episodes/${TEST_EPISODE_ID}` },
  { name: 'Episode Assets', path: `/api/v1/episodes/${TEST_EPISODE_ID}/assets` },
  { name: 'Episode Scripts', path: `/api/v1/episodes/${TEST_EPISODE_ID}/scripts` },
  { name: 'Episode Wardrobe', path: `/api/v1/episodes/${TEST_EPISODE_ID}/wardrobe` },
  { name: 'Scenes List', path: '/api/v1/scenes' },
  { name: 'Wardrobe List', path: '/api/v1/wardrobe' },
  { name: 'Templates List', path: '/api/v1/templates' },
  { name: 'Shows List', path: '/api/v1/shows' },
];

function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${endpoint.path}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            name: endpoint.name,
            status: res.statusCode,
            ok: res.statusCode >= 200 && res.statusCode < 300,
            error: json.error || json.message || null,
          });
        } catch (e) {
          resolve({
            name: endpoint.name,
            status: res.statusCode,
            ok: false,
            error: 'Invalid JSON response',
          });
        }
      });
    }).on('error', (err) => {
      resolve({
        name: endpoint.name,
        status: 'ERROR',
        ok: false,
        error: err.message,
      });
    });
  });
}

async function testAll() {
  console.log('🔍 Testing Dev Server Endpoints...\n');
  
  const results = await Promise.all(endpoints.map(testEndpoint));
  
  console.log('Results:');
  console.log('========');
  
  let passed = 0;
  let failed = 0;
  
  results.forEach((result) => {
    const icon = result.ok ? '✅' : '❌';
    const status = result.status;
    console.log(`${icon} ${result.name.padEnd(25)} - Status: ${status}`);
    if (!result.ok && result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    if (result.ok) passed++;
    else failed++;
  });
  
  console.log('\n========');
  console.log(`Summary: ${passed} passed, ${failed} failed`);
}

testAll().catch(console.error);

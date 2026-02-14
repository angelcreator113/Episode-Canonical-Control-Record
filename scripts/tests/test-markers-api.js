#!/usr/bin/env node
/**
 * Test Markers API (Phase 2 Week 1)
 * End-to-end test for markers system
 */

require('dotenv').config();

const BASE_URL = process.env.API_URL || 'http://localhost:3002';
let TEST_EPISODE_ID = null;
let TEST_SCENE_ID = null;
let createdMarkerIds = [];

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function makeRequest(method, url, body = null) {
  const fetch = (await import('node-fetch')).default;

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${url}`, options);
  const data = await response.json();

  return { status: response.status, data };
}

async function findTestEpisode() {
  log('\n📋 Step 1: Finding test episode...', 'cyan');

  const { status, data } = await makeRequest('GET', '/api/v1/episodes?limit=1');

  if (status === 200 && data.data && data.data.length > 0) {
    TEST_EPISODE_ID = data.data[0].id;
    log(`✅ Found episode: ${data.data[0].title} (${TEST_EPISODE_ID})`, 'green');
    return true;
  }

  log('❌ No episodes found in database', 'red');
  return false;
}

async function findTestScene() {
  log('\n📋 Step 2: Finding test scene...', 'cyan');

  const { status, data } = await makeRequest(
    'GET',
    `/api/v1/episodes/${TEST_EPISODE_ID}/scenes?limit=1`
  );

  if (status === 200 && data.data && data.data.length > 0) {
    TEST_SCENE_ID = data.data[0].id;
    log(`✅ Found scene: ${data.data[0].title} (${TEST_SCENE_ID})`, 'green');
    return true;
  }

  log('ℹ️  No scenes found (optional - markers can exist without scenes)', 'yellow');
  return true; // Non-blocking
}

async function testCreateMarker() {
  log('\n📋 Step 3: Creating marker...', 'cyan');

  const markerData = {
    timecode: 45.5,
    title: 'Test Marker: Important Moment',
    marker_type: 'chapter',
    category: 'production',
    color: '#10B981',
    description: 'This is a test marker created by the test script',
    tags: ['test', 'automated', 'phase2'],
    scene_id: TEST_SCENE_ID || null,
  };

  const { status, data } = await makeRequest(
    'POST',
    `/api/v1/episodes/${TEST_EPISODE_ID}/markers`,
    markerData
  );

  if (status === 201 && data.success) {
    createdMarkerIds.push(data.data.id);
    log(`✅ Marker created: ${data.data.title} at ${data.data.timecode}s`, 'green');
    log(`   ID: ${data.data.id}`, 'green');
    log(`   Scene linked: ${data.data.scene_id ? 'Yes' : 'No'}`, 'green');
    return data.data.id;
  }

  log(`❌ Failed to create marker: ${data.error || data.message}`, 'red');
  log(`   Status: ${status}`, 'red');
  log(`   Full response: ${JSON.stringify(data, null, 2)}`, 'yellow');
  return null;
}

async function testGetMarker(markerId) {
  log('\n📋 Step 4: Retrieving marker...', 'cyan');

  const { status, data } = await makeRequest(
    'GET',
    `/api/v1/markers/${markerId}?include=episode,scene`
  );

  if (status === 200 && data.success) {
    log(`✅ Marker retrieved: ${data.data.title}`, 'green');
    log(`   Timecode: ${data.data.timecode}s`, 'green');
    log(`   Type: ${data.data.marker_type}`, 'green');
    log(`   Color: ${data.data.color}`, 'green');
    if (data.data.episode) {
      log(`   Episode: ${data.data.episode.title}`, 'green');
    }
    if (data.data.scene) {
      log(`   Scene: ${data.data.scene.title}`, 'green');
    }
    return true;
  }

  log(`❌ Failed to get marker: ${data.error || data.message}`, 'red');
  log(`   Status: ${status}`, 'red');
  log(`   Full response: ${JSON.stringify(data, null, 2)}`, 'yellow');
  return false;
}

async function testListMarkers() {
  log('\n📋 Step 5: Listing all episode markers...', 'cyan');

  const { status, data } = await makeRequest(
    'GET',
    `/api/v1/episodes/${TEST_EPISODE_ID}/markers?include=scene`
  );

  if (status === 200 && data.success) {
    log(`✅ Found ${data.count} marker(s) for episode`, 'green');
    data.data.forEach((marker, index) => {
      log(
        `   ${index + 1}. ${marker.title || 'Untitled'} @ ${marker.timecode}s [${marker.marker_type}]`,
        'green'
      );
    });
    return true;
  }

  log(`❌ Failed to list markers: ${data.error || data.message}`, 'red');
  log(`   Status: ${status}`, 'red');
  log(`   Full response: ${JSON.stringify(data, null, 2)}`, 'yellow');
  return false;
}

async function testUpdateMarker(markerId) {
  log('\n📋 Step 6: Updating marker...', 'cyan');

  const updates = {
    title: 'UPDATED: Test Marker',
    timecode: 50.0,
    color: '#EF4444',
    tags: ['test', 'updated'],
  };

  const { status, data } = await makeRequest('PUT', `/api/v1/markers/${markerId}`, updates);

  if (status === 200 && data.success) {
    log(`✅ Marker updated successfully`, 'green');
    log(`   New title: ${data.data.title}`, 'green');
    log(`   New timecode: ${data.data.timecode}s`, 'green');
    log(`   New color: ${data.data.color}`, 'green');
    return true;
  }

  log(`❌ Failed to update marker: ${data.error}`, 'red');
  return false;
}

async function testFilterMarkersByType() {
  log('\n📋 Step 7: Filtering markers by type...', 'cyan');

  const { status, data } = await makeRequest(
    'GET',
    `/api/v1/episodes/${TEST_EPISODE_ID}/markers/by-type/chapter`
  );

  if (status === 200 && data.success) {
    log(`✅ Found ${data.count} chapter marker(s)`, 'green');
    return true;
  }

  log(`❌ Failed to filter markers: ${data.error}`, 'red');
  return false;
}

async function testAutoLinkScene(markerId) {
  if (!TEST_SCENE_ID) {
    log('\n⏭️  Step 8: Skipping auto-link (no scenes available)', 'yellow');
    return true;
  }

  log('\n📋 Step 8: Auto-linking marker to scene...', 'cyan');

  const { status, data } = await makeRequest(
    'POST',
    `/api/v1/markers/${markerId}/auto-scene-link`
  );

  if (status === 200 && data.success) {
    if (data.scene) {
      log(`✅ Marker auto-linked to scene: ${data.scene.title}`, 'green');
    } else {
      log(`ℹ️  Marker is outside scene boundaries (no auto-link)`, 'yellow');
    }
    return true;
  }

  log(`❌ Failed to auto-link: ${data.error}`, 'red');
  return false;
}

async function testDeleteMarker(markerId) {
  log('\n📋 Step 9: Deleting marker...', 'cyan');

  const { status, data } = await makeRequest('DELETE', `/api/v1/markers/${markerId}`);

  if (status === 200 && data.success) {
    log(`✅ Marker deleted successfully`, 'green');
    return true;
  }

  log(`❌ Failed to delete marker: ${data.error}`, 'red');
  return false;
}

async function cleanup() {
  if (createdMarkerIds.length === 0) return;

  log('\n🧹 Cleanup: Removing test markers...', 'magenta');

  for (const markerId of createdMarkerIds) {
    try {
      await makeRequest('DELETE', `/api/v1/markers/${markerId}`);
      log(`   ✅ Deleted marker ${markerId}`, 'green');
    } catch (error) {
      log(`   ⏭️  Marker ${markerId} already deleted`, 'yellow');
    }
  }
}

async function runTests() {
  log('╔════════════════════════════════════════════╗', 'cyan');
  log('║   MARKERS API TEST SUITE (Phase 2 Week 1) ║', 'cyan');
  log('╚════════════════════════════════════════════╝', 'cyan');

  console.log(`\n🔗 API URL: ${BASE_URL}`);

  let passedTests = 0;
  let totalTests = 0;

  try {
    // Setup
    if (!(await findTestEpisode())) {
      log('\n❌ Cannot proceed without test episode', 'red');
      process.exit(1);
    }

    await findTestScene();

    // Test 1: Create
    totalTests++;
    const markerId = await testCreateMarker();
    if (markerId) passedTests++;

    if (!markerId) {
      log('\n❌ Cannot continue tests without created marker', 'red');
      process.exit(1);
    }

    // Test 2: Get
    totalTests++;
    if (await testGetMarker(markerId)) passedTests++;

    // Test 3: List
    totalTests++;
    if (await testListMarkers()) passedTests++;

    // Test 4: Update
    totalTests++;
    if (await testUpdateMarker(markerId)) passedTests++;

    // Test 5: Filter
    totalTests++;
    if (await testFilterMarkersByType()) passedTests++;

    // Test 6: Auto-link
    totalTests++;
    if (await testAutoLinkScene(markerId)) passedTests++;

    // Test 7: Delete
    totalTests++;
    if (await testDeleteMarker(markerId)) passedTests++;

    // Results
    log('\n╔════════════════════════════════════════════╗', 'cyan');
    log('║              TEST RESULTS                  ║', 'cyan');
    log('╚════════════════════════════════════════════╝', 'cyan');
    log(`\n✅ Passed: ${passedTests}/${totalTests}`, passedTests === totalTests ? 'green' : 'yellow');
    log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`, passedTests === totalTests ? 'green' : 'red');

    if (passedTests === totalTests) {
      log('\n🎉 ALL TESTS PASSED! Markers system is working correctly.', 'green');
      process.exit(0);
    } else {
      log('\n⚠️  Some tests failed. Check logs above for details.', 'yellow');
      process.exit(1);
    }
  } catch (error) {
    log(`\n💥 Unexpected error: ${error.message}`, 'red');
    console.error(error);
    await cleanup();
    process.exit(1);
  }
}

// Run tests
runTests();

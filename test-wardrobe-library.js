/**
 * Test Wardrobe Library System
 * Tests Phase 1 (Database & Models) and Phase 2 (Core API)
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3002/api/v1';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token-123';

// Configure axios
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

let testLibraryItemId = null;
let testEpisodeId = null;

async function runTests() {
  console.log('🧪 Testing Wardrobe Library System\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Test 1: Upload to Library
    await testUploadToLibrary();

    // Test 2: List Library Items
    await testListLibrary();

    // Test 3: Get Single Library Item
    await testGetLibraryItem();

    // Test 4: Update Library Item
    await testUpdateLibraryItem();

    // Test 5: Track View
    await testTrackView();

    // Test 6: Track Selection
    await testTrackSelection();

    // Test 7: Get Episodes (to find one for assignment)
    await testGetEpisodes();

    // Test 8: Assign to Episode
    if (testEpisodeId) {
      await testAssignToEpisode();
    } else {
      console.log('⏭️  Skipping assignment test (no episodes found)\n');
    }

    // Test 9: Get Usage History
    await testGetUsageHistory();

    // Test 10: List with Filters
    await testListWithFilters();

    // Test 11: Search
    await testSearch();

    // Test 12: Delete (should fail if assigned)
    await testDelete();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ All tests completed!\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

async function testUploadToLibrary() {
  console.log('📤 Test 1: Upload to Library');
  console.log('───────────────────────────────────────────────────────────');

  try {
    const response = await api.post('/wardrobe-library', {
      name: 'Test Red Dress',
      description: 'A beautiful red evening dress for formal occasions',
      type: 'item',
      itemType: 'dress',
      color: 'red',
      tags: ['formal', 'evening', 'elegant'],
      defaultCharacter: 'lala',
      defaultOccasion: 'gala',
      defaultSeason: 'winter',
      price: 299.99,
      vendor: 'Designer Boutique',
      website: 'https://example.com/red-dress',
      imageUrl: 'https://via.placeholder.com/600x800/ff0000/ffffff?text=Red+Dress',
      thumbnailUrl: 'https://via.placeholder.com/150x200/ff0000/ffffff?text=Red+Dress',
    });

    if (response.data.success) {
      testLibraryItemId = response.data.data.id;
      console.log('✅ Upload successful');
      console.log(`   ID: ${testLibraryItemId}`);
      console.log(`   Name: ${response.data.data.name}`);
      console.log(`   Type: ${response.data.data.type}`);
      console.log(`   Item Type: ${response.data.data.itemType}\n`);
    } else {
      throw new Error('Upload failed: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testListLibrary() {
  console.log('📋 Test 2: List Library Items');
  console.log('───────────────────────────────────────────────────────────');

  try {
    const response = await api.get('/wardrobe-library', {
      params: {
        page: 1,
        limit: 10,
      },
    });

    if (response.data.success) {
      console.log('✅ List successful');
      console.log(`   Total items: ${response.data.pagination.total}`);
      console.log(`   Page: ${response.data.pagination.page}`);
      console.log(`   Items on page: ${response.data.data.length}\n`);
    } else {
      throw new Error('List failed: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testGetLibraryItem() {
  console.log('🔍 Test 3: Get Single Library Item');
  console.log('───────────────────────────────────────────────────────────');

  if (!testLibraryItemId) {
    console.log('⏭️  Skipped (no item ID)\n');
    return;
  }

  try {
    const response = await api.get(`/wardrobe-library/${testLibraryItemId}`);

    if (response.data.success) {
      console.log('✅ Get item successful');
      console.log(`   Name: ${response.data.data.name}`);
      console.log(`   Type: ${response.data.data.type}`);
      console.log(`   Color: ${response.data.data.color}`);
      console.log(`   View Count: ${response.data.data.viewCount}`);
      console.log(`   Usage Count: ${response.data.data.totalUsageCount}\n`);
    } else {
      throw new Error('Get item failed: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testUpdateLibraryItem() {
  console.log('✏️  Test 4: Update Library Item');
  console.log('───────────────────────────────────────────────────────────');

  if (!testLibraryItemId) {
    console.log('⏭️  Skipped (no item ID)\n');
    return;
  }

  try {
    const response = await api.put(`/wardrobe-library/${testLibraryItemId}`, {
      description: 'Updated: A stunning red evening dress perfect for galas and formal events',
      tags: ['formal', 'evening', 'elegant', 'gala', 'updated'],
      price: 349.99,
    });

    if (response.data.success) {
      console.log('✅ Update successful');
      console.log(`   Description updated: ${response.data.data.description.substring(0, 50)}...`);
      console.log(`   Tags: ${response.data.data.tags.join(', ')}`);
      console.log(`   Price: $${response.data.data.price}\n`);
    } else {
      throw new Error('Update failed: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testTrackView() {
  console.log('👁️  Test 5: Track View');
  console.log('───────────────────────────────────────────────────────────');

  if (!testLibraryItemId) {
    console.log('⏭️  Skipped (no item ID)\n');
    return;
  }

  try {
    const response = await api.post(`/wardrobe-library/${testLibraryItemId}/track-view`);

    if (response.data.success) {
      console.log('✅ View tracked successfully\n');
    } else {
      throw new Error('Track view failed: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testTrackSelection() {
  console.log('🎯 Test 6: Track Selection');
  console.log('───────────────────────────────────────────────────────────');

  if (!testLibraryItemId) {
    console.log('⏭️  Skipped (no item ID)\n');
    return;
  }

  try {
    const response = await api.post(`/wardrobe-library/${testLibraryItemId}/track-selection`, {
      episodeId: null,
      showId: null,
    });

    if (response.data.success) {
      console.log('✅ Selection tracked successfully\n');
    } else {
      throw new Error('Track selection failed: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testGetEpisodes() {
  console.log('📺 Test 7: Get Episodes (for assignment test)');
  console.log('───────────────────────────────────────────────────────────');

  try {
    const response = await api.get('/episodes', {
      params: { limit: 1 },
    });

    if (response.data.data && response.data.data.length > 0) {
      testEpisodeId = response.data.data[0].id;
      console.log('✅ Found episode for testing');
      console.log(`   Episode ID: ${testEpisodeId}`);
      console.log(`   Title: ${response.data.data[0].title}\n`);
    } else {
      console.log('⚠️  No episodes found\n');
    }
  } catch (error) {
    console.warn('⚠️  Could not fetch episodes:', error.message);
    console.log('   This is OK if episodes endpoint is not available\n');
  }
}

async function testAssignToEpisode() {
  console.log('🔗 Test 8: Assign to Episode');
  console.log('───────────────────────────────────────────────────────────');

  if (!testLibraryItemId || !testEpisodeId) {
    console.log('⏭️  Skipped (no item or episode ID)\n');
    return;
  }

  try {
    const response = await api.post(`/wardrobe-library/${testLibraryItemId}/assign`, {
      episodeId: testEpisodeId,
      character: 'lala',
      occasion: 'gala',
      season: 'winter',
    });

    if (response.data.success) {
      console.log('✅ Assignment successful');
      console.log(`   Wardrobe ID: ${response.data.data.wardrobeItem.id}`);
      console.log(`   Episode Wardrobe ID: ${response.data.data.episodeWardrobe.id}`);
      console.log(`   Approval Status: ${response.data.data.episodeWardrobe.approval_status}\n`);
    } else {
      throw new Error('Assignment failed: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testGetUsageHistory() {
  console.log('📊 Test 9: Get Usage History');
  console.log('───────────────────────────────────────────────────────────');

  if (!testLibraryItemId) {
    console.log('⏭️  Skipped (no item ID)\n');
    return;
  }

  try {
    const response = await api.get(`/wardrobe-library/${testLibraryItemId}/usage`);

    if (response.data.success) {
      console.log('✅ Usage history retrieved');
      console.log(`   Total usage: ${response.data.data.analytics.totalUsage}`);
      console.log(`   Usage by type:`, response.data.data.analytics.byType);
      console.log(`   Recent activity count: ${response.data.data.analytics.recentActivity.length}\n`);
    } else {
      throw new Error('Get usage failed: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testListWithFilters() {
  console.log('🔍 Test 10: List with Filters');
  console.log('───────────────────────────────────────────────────────────');

  try {
    const response = await api.get('/wardrobe-library', {
      params: {
        type: 'item',
        color: 'red',
        sort: 'created_at:DESC',
        limit: 5,
      },
    });

    if (response.data.success) {
      console.log('✅ Filtered list successful');
      console.log(`   Items found: ${response.data.data.length}`);
      console.log(`   Filter applied: type=item, color=red\n`);
    } else {
      throw new Error('Filtered list failed: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testSearch() {
  console.log('🔎 Test 11: Search');
  console.log('───────────────────────────────────────────────────────────');

  try {
    const response = await api.get('/wardrobe-library', {
      params: {
        search: 'dress',
        limit: 5,
      },
    });

    if (response.data.success) {
      console.log('✅ Search successful');
      console.log(`   Results found: ${response.data.data.length}`);
      console.log(`   Search term: "dress"\n`);
    } else {
      throw new Error('Search failed: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testDelete() {
  console.log('🗑️  Test 12: Delete Library Item');
  console.log('───────────────────────────────────────────────────────────');

  if (!testLibraryItemId) {
    console.log('⏭️  Skipped (no item ID)\n');
    return;
  }

  try {
    const response = await api.delete(`/wardrobe-library/${testLibraryItemId}`);

    if (response.data.success) {
      console.log('✅ Delete successful (item was not in use)\n');
    } else {
      throw new Error('Delete failed: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    // Expected to fail if item is in use
    if (error.response?.status === 409) {
      console.log('✅ Delete prevented (item is in use - expected behavior)');
      console.log(`   Usage count: ${error.response.data.data?.usageCount || 'N/A'}\n`);
    } else {
      console.error('❌ Test failed:', error.response?.data || error.message);
      throw error;
    }
  }
}

// Run tests
if (require.main === module) {
  runTests();
}

module.exports = { runTests };

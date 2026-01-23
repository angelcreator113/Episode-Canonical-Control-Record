/**
 * Test Suite for Wardrobe Library System - Phases 3-6
 * Tests outfit sets, approval workflow, usage tracking, and advanced features
 */

const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'https://dev.primepisodes.com';
const API_URL = `${BASE_URL}/api/v1`;

// Test user authentication
const TEST_USER = {
  email: 'test@example.com',
  password: 'test123',
};

let authToken = '';
let testLibraryItemId = null;
let testOutfitSetId = null;
let testEpisodeId = null;
let testWardrobeId = null;

// Helper function to make authenticated requests
async function authenticatedRequest(method, url, data = null) {
  const config = {
    method,
    url: `${API_URL}${url}`,
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  };

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`Error: ${error.response.status} - ${error.response.data.error || error.response.statusText}`);
      return { success: false, error: error.response.data.error };
    }
    throw error;
  }
}

// Setup: Login and create test data
async function setup() {
  console.log('\n=== SETUP ===');
  
  try {
    // Login
    console.log('Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, TEST_USER);
    authToken = loginResponse.data.token;
    console.log('✓ Logged in successfully');

    // Get or create test episode
    console.log('Getting test episode...');
    const episodesResponse = await authenticatedRequest('GET', '/episodes?limit=1');
    if (episodesResponse.data && episodesResponse.data.length > 0) {
      testEpisodeId = episodesResponse.data[0].id;
      console.log(`✓ Using episode: ${testEpisodeId}`);
    } else {
      console.log('✗ No episodes found. Please create an episode first.');
      process.exit(1);
    }

    // Create test library items
    console.log('Creating test library items...');
    const item1 = await authenticatedRequest('POST', '/wardrobe-library', {
      name: 'Test Shirt - Phase 3-6',
      description: 'Test shirt for advanced features',
      type: 'item',
      itemType: 'top',
      color: 'blue',
      tags: ['test', 'casual'],
      imageUrl: 'https://example.com/test-shirt.jpg',
    });
    
    if (item1.success) {
      testLibraryItemId = item1.data.id;
      console.log(`✓ Created test item: ${testLibraryItemId}`);
    }

    // Create outfit set
    console.log('Creating test outfit set...');
    const outfitSet = await authenticatedRequest('POST', '/wardrobe-library', {
      name: 'Test Outfit Set - Phase 3-6',
      description: 'Test outfit set',
      type: 'set',
      imageUrl: 'https://example.com/test-outfit.jpg',
    });
    
    if (outfitSet.success) {
      testOutfitSetId = outfitSet.data.id;
      console.log(`✓ Created test outfit set: ${testOutfitSetId}`);
    }

    console.log('✓ Setup complete\n');
  } catch (error) {
    console.error('Setup failed:', error.message);
    process.exit(1);
  }
}

// Phase 3: Outfit Sets Tests
async function testOutfitSets() {
  console.log('\n=== PHASE 3: OUTFIT SETS ===');
  
  if (!testLibraryItemId || !testOutfitSetId) {
    console.log('✗ Test data not available, skipping outfit sets tests');
    return;
  }

  try {
    // Test 1: Add items to outfit set
    console.log('\n1. Testing addItemsToOutfit...');
    const addResult = await authenticatedRequest('POST', `/wardrobe-library/${testOutfitSetId}/items`, {
      wardrobeItemIds: [testLibraryItemId],
      positions: [0],
      layers: ['base'],
      isOptional: [false],
    });
    
    if (addResult.success) {
      console.log(`✓ Added ${addResult.addedCount} item(s) to outfit set`);
    } else {
      console.log(`✗ Failed to add items: ${addResult.error}`);
    }

    // Test 2: Get outfit items
    console.log('\n2. Testing getOutfitItems...');
    const itemsResult = await authenticatedRequest('GET', `/wardrobe-library/${testOutfitSetId}/items`);
    
    if (itemsResult.success) {
      console.log(`✓ Retrieved ${itemsResult.data.length} item(s) from outfit set`);
      console.log('Items:', JSON.stringify(itemsResult.data, null, 2));
    } else {
      console.log(`✗ Failed to get items: ${itemsResult.error}`);
    }

    // Test 3: Remove item from outfit set
    console.log('\n3. Testing removeItemFromOutfit...');
    const removeResult = await authenticatedRequest('DELETE', `/wardrobe-library/${testOutfitSetId}/items/${testLibraryItemId}`);
    
    if (removeResult.success) {
      console.log('✓ Removed item from outfit set');
    } else {
      console.log(`✗ Failed to remove item: ${removeResult.error}`);
    }

    console.log('\n✓ Phase 3 tests complete');
  } catch (error) {
    console.error('Phase 3 tests failed:', error.message);
  }
}

// Phase 4: Approval Workflow Tests
async function testApprovalWorkflow() {
  console.log('\n=== PHASE 4: APPROVAL WORKFLOW ===');
  
  if (!testEpisodeId || !testLibraryItemId) {
    console.log('✗ Test data not available, skipping approval tests');
    return;
  }

  try {
    // First, assign item to episode to get wardrobe ID
    console.log('\nAssigning item to episode for approval testing...');
    const assignResult = await authenticatedRequest('POST', `/wardrobe-library/${testLibraryItemId}/assign`, {
      episodeId: testEpisodeId,
      character: 'Test Character',
      occasion: 'Test Scene',
    });
    
    if (assignResult.success) {
      testWardrobeId = assignResult.data.wardrobeId;
      console.log(`✓ Assigned item, wardrobe ID: ${testWardrobeId}`);
    } else {
      console.log(`✗ Failed to assign item: ${assignResult.error}`);
      return;
    }

    // Test 1: Get approval status
    console.log('\n1. Testing getApprovalStatus...');
    const statusResult = await authenticatedRequest('GET', `/episodes/${testEpisodeId}/wardrobe/approval-status`);
    
    if (statusResult.success) {
      console.log('✓ Retrieved approval status');
      console.log('Summary:', JSON.stringify(statusResult.summary, null, 2));
    } else {
      console.log(`✗ Failed to get status: ${statusResult.error}`);
    }

    // Test 2: Approve wardrobe item
    console.log('\n2. Testing approveWardrobeItem...');
    const approveResult = await authenticatedRequest('PUT', `/episodes/${testEpisodeId}/wardrobe/${testWardrobeId}/approve`, {
      approvedBy: 'test-user',
      notes: 'Looks great!',
    });
    
    if (approveResult.success) {
      console.log('✓ Item approved successfully');
      console.log('Approval status:', approveResult.data.approval_status);
    } else {
      console.log(`✗ Failed to approve: ${approveResult.error}`);
    }

    // Test 3: Reject wardrobe item
    console.log('\n3. Testing rejectWardrobeItem...');
    const rejectResult = await authenticatedRequest('PUT', `/episodes/${testEpisodeId}/wardrobe/${testWardrobeId}/reject`, {
      rejectedBy: 'test-user',
      reason: 'Wrong color for the scene',
    });
    
    if (rejectResult.success) {
      console.log('✓ Item rejected successfully');
      console.log('Rejection reason:', rejectResult.data.rejection_reason);
    } else {
      console.log(`✗ Failed to reject: ${rejectResult.error}`);
    }

    // Test 4: Get updated approval status
    console.log('\n4. Verifying approval status update...');
    const updatedStatusResult = await authenticatedRequest('GET', `/episodes/${testEpisodeId}/wardrobe/approval-status`);
    
    if (updatedStatusResult.success) {
      console.log('✓ Verified status update');
      console.log('Summary:', JSON.stringify(updatedStatusResult.summary, null, 2));
    } else {
      console.log(`✗ Failed to verify status: ${updatedStatusResult.error}`);
    }

    console.log('\n✓ Phase 4 tests complete');
  } catch (error) {
    console.error('Phase 4 tests failed:', error.message);
  }
}

// Phase 5: Usage Tracking Enhanced Tests
async function testUsageTracking() {
  console.log('\n=== PHASE 5: USAGE TRACKING ENHANCED ===');
  
  if (!testLibraryItemId) {
    console.log('✗ Test data not available, skipping usage tracking tests');
    return;
  }

  try {
    // Test 1: Get cross-show usage
    console.log('\n1. Testing getCrossShowUsage...');
    const crossShowResult = await authenticatedRequest('GET', `/wardrobe-library/${testLibraryItemId}/usage/shows`);
    
    if (crossShowResult.success) {
      console.log(`✓ Retrieved cross-show usage (${crossShowResult.data.length} shows)`);
      console.log('Usage by show:', JSON.stringify(crossShowResult.data, null, 2));
    } else {
      console.log(`✗ Failed to get cross-show usage: ${crossShowResult.error}`);
    }

    // Test 2: Get usage timeline
    console.log('\n2. Testing getUsageTimeline...');
    const timelineResult = await authenticatedRequest('GET', `/wardrobe-library/${testLibraryItemId}/usage/timeline?granularity=month`);
    
    if (timelineResult.success) {
      console.log(`✓ Retrieved usage timeline (${timelineResult.data.length} periods)`);
      console.log('Timeline:', JSON.stringify(timelineResult.data.slice(0, 5), null, 2));
    } else {
      console.log(`✗ Failed to get timeline: ${timelineResult.error}`);
    }

    // Test 3: Get most used items
    console.log('\n3. Testing getMostUsedItems...');
    const mostUsedResult = await authenticatedRequest('GET', '/wardrobe-library/analytics/most-used?limit=5');
    
    if (mostUsedResult.success) {
      console.log(`✓ Retrieved ${mostUsedResult.data.length} most used items`);
      mostUsedResult.data.forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.name} - Used ${item.totalUsageCount} times`);
      });
    } else {
      console.log(`✗ Failed to get most used: ${mostUsedResult.error}`);
    }

    // Test 4: Get never used items
    console.log('\n4. Testing getNeverUsedItems...');
    const neverUsedResult = await authenticatedRequest('GET', '/wardrobe-library/analytics/never-used?limit=5');
    
    if (neverUsedResult.success) {
      console.log(`✓ Retrieved ${neverUsedResult.data.length} never used items`);
      neverUsedResult.data.forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.name}`);
      });
    } else {
      console.log(`✗ Failed to get never used: ${neverUsedResult.error}`);
    }

    console.log('\n✓ Phase 5 tests complete');
  } catch (error) {
    console.error('Phase 5 tests failed:', error.message);
  }
}

// Phase 6: Advanced Features Tests
async function testAdvancedFeatures() {
  console.log('\n=== PHASE 6: ADVANCED FEATURES ===');
  
  try {
    // Test 1: Advanced search
    console.log('\n1. Testing advancedSearch...');
    const searchResult = await authenticatedRequest('GET', '/wardrobe-library/advanced-search?query=test&type=item&sortBy=relevance&limit=5');
    
    if (searchResult.success) {
      console.log(`✓ Found ${searchResult.data.length} items (page ${searchResult.pagination.page}/${searchResult.pagination.totalPages})`);
      searchResult.data.forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.name} (${item.type})`);
      });
    } else {
      console.log(`✗ Search failed: ${searchResult.error}`);
    }

    // Test 2: Get suggestions
    console.log('\n2. Testing getSuggestions...');
    if (testEpisodeId) {
      const suggestionsResult = await authenticatedRequest('GET', `/wardrobe-library/suggestions?episodeId=${testEpisodeId}&character=Main&limit=5`);
      
      if (suggestionsResult.success) {
        console.log(`✓ Retrieved ${suggestionsResult.data.length} suggestions`);
        suggestionsResult.data.forEach((item, i) => {
          console.log(`   ${i + 1}. ${item.name} - ${item.type}`);
        });
      } else {
        console.log(`✗ Failed to get suggestions: ${suggestionsResult.error}`);
      }
    } else {
      console.log('⊘ Skipping suggestions test (no episode ID)');
    }

    // Test 3: Duplicate detection
    console.log('\n3. Testing duplicateDetection...');
    const duplicatesResult = await authenticatedRequest('GET', '/wardrobe-library/check-duplicates?name=Test Shirt');
    
    if (duplicatesResult.success) {
      console.log(`✓ ${duplicatesResult.message}`);
      if (duplicatesResult.data.length > 0) {
        console.log('Potential duplicates:');
        duplicatesResult.data.forEach((item, i) => {
          console.log(`   ${i + 1}. ${item.name} (similarity: ${item.nameSimilarity})`);
        });
      }
    } else {
      console.log(`✗ Failed to check duplicates: ${duplicatesResult.error}`);
    }

    // Test 4: Bulk assign
    console.log('\n4. Testing bulkAssign...');
    if (testLibraryItemId && testEpisodeId) {
      const bulkResult = await authenticatedRequest('POST', '/wardrobe-library/bulk-assign', {
        libraryItemIds: [testLibraryItemId],
        episodeIds: [testEpisodeId],
        character: 'Bulk Test Character',
        occasion: 'Bulk Test Scene',
      });
      
      if (bulkResult.success) {
        console.log(`✓ ${bulkResult.message}`);
        console.log(`Assigned: ${bulkResult.assignedCount}`);
      } else {
        console.log(`✗ Bulk assign failed: ${bulkResult.error}`);
      }
    } else {
      console.log('⊘ Skipping bulk assign test (missing test data)');
    }

    console.log('\n✓ Phase 6 tests complete');
  } catch (error) {
    console.error('Phase 6 tests failed:', error.message);
  }
}

// Cleanup test data
async function cleanup() {
  console.log('\n=== CLEANUP ===');
  
  try {
    if (testLibraryItemId) {
      console.log('Cleaning up test item...');
      await authenticatedRequest('DELETE', `/wardrobe-library/${testLibraryItemId}`);
      console.log('✓ Deleted test item');
    }
    
    if (testOutfitSetId) {
      console.log('Cleaning up test outfit set...');
      await authenticatedRequest('DELETE', `/wardrobe-library/${testOutfitSetId}`);
      console.log('✓ Deleted test outfit set');
    }
    
    console.log('✓ Cleanup complete');
  } catch (error) {
    console.error('Cleanup failed:', error.message);
  }
}

// Run all tests
async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Wardrobe Library System - Advanced Features Test Suite     ║');
  console.log('║  Phases 3-6: Outfit Sets, Approval, Usage, Advanced         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  
  try {
    await setup();
    await testOutfitSets();
    await testApprovalWorkflow();
    await testUsageTracking();
    await testAdvancedFeatures();
    await cleanup();
    
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    ALL TESTS COMPLETE                        ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

// Run the tests
runTests();

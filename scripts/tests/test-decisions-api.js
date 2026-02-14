/**
 * Test script for Decision Logging API
 * Tests the new /api/decisions endpoints
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:3002';

async function testDecisionLoggingAPI() {
  console.log('🧪 Testing Decision Logging API...\n');

  try {
    // Test 1: Log a decision
    console.log('Test 1: POST /api/decisions - Log a decision');
    const createResponse = await axios.post(`${BASE_URL}/api/decisions`, {
      decision_type: 'scene_duration',
      decision_category: 'timing',
      chosen_option: {
        duration: 3,
        unit: 'seconds',
      },
      rejected_options: [
        { duration: 5, unit: 'seconds' },
        { duration: 7, unit: 'seconds' },
      ],
      was_ai_suggestion: true,
      ai_confidence_score: 0.85,
      user_rating: 5,
      user_notes: 'Perfect timing for intro scene',
      context_data: {
        scene_type: 'intro',
        previous_duration: 5,
      },
    });

    console.log('✅ Decision created:', createResponse.data.decision.id);
    console.log('   Type:', createResponse.data.decision.decision_type);
    console.log('   Category:', createResponse.data.decision.decision_category);
    const decisionId = createResponse.data.decision.id;

    // Test 2: Get decision by ID
    console.log('\nTest 2: GET /api/decisions/:id - Get single decision');
    const getResponse = await axios.get(`${BASE_URL}/api/decisions/${decisionId}`);
    console.log('✅ Decision retrieved:', getResponse.data.decision.id);

    // Test 3: List all decisions
    console.log('\nTest 3: GET /api/decisions - List decisions');
    const listResponse = await axios.get(`${BASE_URL}/api/decisions`, {
      params: {
        limit: 10,
      },
    });
    console.log('✅ Found', listResponse.data.count, 'decisions');
    console.log('   Pagination:', listResponse.data.pagination);

    // Test 4: Filter by decision type
    console.log('\nTest 4: GET /api/decisions?decision_type=scene_duration');
    const filterResponse = await axios.get(`${BASE_URL}/api/decisions`, {
      params: {
        decision_type: 'scene_duration',
      },
    });
    console.log('✅ Found', filterResponse.data.count, 'scene_duration decisions');

    // Test 5: List patterns
    console.log('\nTest 5: GET /api/decisions/patterns - List learned patterns');
    const patternsResponse = await axios.get(`${BASE_URL}/api/decisions/patterns`, {
      params: {
        min_confidence: 0.5,
      },
    });
    console.log('✅ Found', patternsResponse.data.patterns.length, 'patterns');

    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Error:', error.response.data);
    } else {
      console.error('   Error:', error.message);
    }
    process.exit(1);
  }
}

// Only run if server is accessible
async function checkServer() {
  try {
    await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is running\n');
    return true;
  } catch (error) {
    console.error('❌ Server is not running at', BASE_URL);
    console.error('   Start the server with: npm run dev');
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }
  await testDecisionLoggingAPI();
}

main();

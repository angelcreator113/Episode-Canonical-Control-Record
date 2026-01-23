/**
 * Complete End-to-End Test for Search System
 * Tests all search endpoints, history, and filters
 */

require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

async function checkServerReady(baseURL, maxRetries = 5) {
  console.log('🔍 Checking if server is ready...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(`${baseURL}/api/v1/search/episodes?q=test&limit=1`, {
        timeout: 5000, // Increased timeout to 5 seconds
        validateStatus: () => true,
        headers: {
          'User-Agent': 'Search-E2E-Test',
        },
      });
      
      // Any response (including 401) means server is up
      console.log(`   Server responded with status: ${response.status}`);
      console.log('✅ Server is ready!\n');
      return true;
    } catch (error) {
      if (i < maxRetries - 1) {
        console.log(`   Attempt ${i + 1}/${maxRetries}: ${error.code || error.message}, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  }
  
  console.log('❌ Server did not become ready after', maxRetries, 'attempts\n');
  return false;
}

async function runCompleteE2ETest() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   SEARCH SYSTEM - COMPLETE END-TO-END TEST            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const baseURL = process.env.API_BASE_URL || 'https://dev.primepisodes.com';
  
  // Check if server is ready
  const serverReady = await checkServerReady(baseURL);
  if (!serverReady) {
    console.log('⚠️  Server is not responding. Please ensure:');
    console.log('   1. Backend server is running: npm run dev');
    console.log('   2. Server has finished starting up');
    console.log('   3. Port 3002 is not blocked by firewall\n');
    process.exit(1);
  }
  
  // Generate test token if not provided
  let token = process.env.TEST_TOKEN;
  
  if (!token || token === 'YOUR_JWT_TOKEN_HERE') {
    console.log('⚠️  No TEST_TOKEN found, generating test token...');
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: 'test-user-e2e-123',  // Cognito subject ID
      email: 'test@example.com',
      name: 'Test User E2E',
      'cognito:groups': ['user'],
      token_use: 'access',
      iat: now,
      exp: now + 3600,  // 1 hour from now
    };
    const secret = process.env.JWT_SECRET || 'test-secret-key';
    token = jwt.sign(payload, secret);
    console.log('✓ Test token generated\n');
  }

  const headers = { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  const tests = [
    {
      name: '1. Episode Search (Basic)',
      method: 'GET',
      endpoint: '/api/v1/search/episodes?q=episode&limit=5',
      validate: (data) => ({
        hasResults: Array.isArray(data.data),
        hasSearchInfo: data.search_info !== undefined || data.data !== undefined,
        hasPagination: data.pagination !== undefined,
        successField: data.success === true,
      }),
    },
    {
      name: '2. Episode Search (With Filters)',
      method: 'GET',
      endpoint: '/api/v1/search/episodes?q=test&status=published',
      validate: (data) => ({
        hasResults: Array.isArray(data.data),
        hasSuccess: data.success === true,
      }),
    },
    {
      name: '3. Script Search (Basic)',
      method: 'GET',
      endpoint: '/api/v1/search/scripts?q=script&limit=5',
      validate: (data) => ({
        hasResults: Array.isArray(data.data),
        hasSuccess: data.success === true,
        hasPagination: data.pagination !== undefined,
      }),
    },
    {
      name: '4. Script Search (With Filters)',
      method: 'GET',
      endpoint: '/api/v1/search/scripts?q=test&scriptType=main',
      validate: (data) => ({
        hasResults: Array.isArray(data.data),
        hasSuccess: data.success === true,
      }),
    },
    {
      name: '5. Search History (GET)',
      method: 'GET',
      endpoint: '/api/v1/search/history?limit=10',
      validate: (data) => ({
        hasData: Array.isArray(data.data),
        hasSuccess: data.success === true,
        hasCount: typeof data.count === 'number',
      }),
    },
    {
      name: '6. Activity Search',
      method: 'GET',
      endpoint: '/api/v1/search/activities?q=create&limit=5',
      validate: (data) => ({
        hasResults: Array.isArray(data.data) || data.data !== undefined,
        hasSuccess: data.success === true || data.status === 'success',
      }),
    },
    {
      name: '7. Search Suggestions',
      method: 'GET',
      endpoint: '/api/v1/search/suggestions?q=ep&limit=5',
      validate: (data) => ({
        hasData: data.data !== undefined,
        hasSuccess: data.success === true,
      }),
    },
    {
      name: '8. Authentication Required (No Token)',
      method: 'GET',
      endpoint: '/api/v1/search/history',
      headers: {}, // No auth header
      expectStatus: 401,
      validate: (data) => ({
        isUnauthorized: true, // We expect this to fail
      }),
    },
  ];

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const test of tests) {
    try {
      const startTime = Date.now();
      const response = await axios({
        method: test.method,
        url: `${baseURL}${test.endpoint}`,
        headers: test.headers || headers,
        timeout: 10000, // Increased timeout to 10 seconds
        validateStatus: () => true, // Don't throw on any status
      });
      const duration = Date.now() - startTime;

      // Check expected status
      if (test.expectStatus) {
        if (response.status === test.expectStatus) {
          console.log(`✅ ${test.name}`);
          console.log(`   Response: ${duration}ms`);
          console.log(`   Status: ${response.status} (expected)`);
          passed++;
        } else {
          console.log(`❌ ${test.name}`);
          console.log(`   Expected status ${test.expectStatus}, got ${response.status}`);
          failed++;
        }
      } else {
        // Normal validation
        const validations = test.validate(response.data);
        const allValid = Object.values(validations).every(v => v === true);

        if (allValid && response.status < 400) {
          console.log(`✅ ${test.name}`);
          console.log(`   Response: ${duration}ms`);
          console.log(`   Status: ${response.status}`);
          console.log(`   Results: ${response.data.data?.length || 0}`);
          passed++;
        } else {
          console.log(`⚠️  ${test.name}`);
          console.log(`   Response: ${duration}ms`);
          console.log(`   Status: ${response.status}`);
          console.log(`   Validations:`);
          Object.entries(validations).forEach(([key, val]) => {
            console.log(`      ${val ? '✓' : '✗'} ${key}`);
          });
          failed++;
        }
      }

      results.push({
        test: test.name,
        passed: test.expectStatus ? response.status === test.expectStatus : true,
        duration,
        status: response.status,
      });

    } catch (error) {
      console.log(`❌ ${test.name}`);
      if (error.code === 'ECONNREFUSED') {
        console.log(`   Error: Cannot connect to ${baseURL}`);
        console.log(`   Is the backend server running?`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
      failed++;

      results.push({
        test: test.name,
        passed: false,
        error: error.message,
      });
    }
    console.log('');
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('                    TEST SUMMARY                       ');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total Tests: ${tests.length}`);
  console.log(`Passed:      ${passed} ✅`);
  console.log(`Failed:      ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Performance Stats
  const durations = results.filter(r => r.duration).map(r => r.duration);
  if (durations.length > 0) {
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    console.log('PERFORMANCE METRICS:');
    console.log(`Average Response Time: ${avgDuration.toFixed(0)}ms`);
    console.log(`Fastest Response:      ${minDuration}ms`);
    console.log(`Slowest Response:      ${maxDuration}ms`);
    console.log('');
  }

  // Recommendations
  if (failed > 0) {
    console.log('⚠️  RECOMMENDATIONS:');
    console.log('   1. Check that backend is running on port 3002');
    console.log('   2. Verify JWT token is valid and not expired');
    console.log('   3. Ensure all migrations have been run');
    console.log('   4. Check that search indexes exist');
    console.log('   5. Run: node create-search-history.js (if search_history table missing)');
    console.log('');
  } else {
    console.log('🎉 ALL TESTS PASSED - SEARCH SYSTEM FULLY OPERATIONAL!');
    console.log('');
    console.log('✅ Episode search working');
    console.log('✅ Script search working');
    console.log('✅ Search history working');
    console.log('✅ Activity search working');
    console.log('✅ Suggestions working');
    console.log('✅ Authentication enforced');
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

runCompleteE2ETest().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});

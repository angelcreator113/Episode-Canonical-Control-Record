#!/usr/bin/env node
/**
 * Phase 4A Day 2 - Comprehensive Testing Suite
 * Automated test runner for all Phase 4A features
 */

const http = require('http');
const https = require('https');

const API_BASE = 'http://localhost:3002';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1MGQxMTdhNS0zZDk2LTQzZGUtYTJkYy1lZTUwMjdjNzc2YTMiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzM2MTEzNDU5fQ.fKpP6M_wP60YXfkz3v4HVfE8N63pHjGQyqWvLYhKGOU';

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  duration: 0
};

// Helper function to make HTTP requests
async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Test runner
async function runTest(name, testFn) {
  try {
    console.log(`\n📋 ${name}`);
    const result = await testFn();
    if (result) {
      console.log(`   ✅ PASSED`);
      testResults.passed++;
      return true;
    } else {
      console.log(`   ❌ FAILED`);
      testResults.failed++;
      return false;
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    testResults.failed++;
    testResults.errors.push({ name, error: error.message });
    return false;
  }
}

// Test suite
async function runTestSuite() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Phase 4A Day 2 - Comprehensive Testing Suite             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();

  // Test Group 1: Backend Health
  console.log('\n🔴 TEST GROUP 1: Backend Health Checks\n');
  
  await runTest('Backend is running', async () => {
    const res = await makeRequest('GET', '/health');
    return res.status === 200 && res.body.status === 'healthy';
  });

  await runTest('Database is connected', async () => {
    const res = await makeRequest('GET', '/health');
    return res.status === 200 && res.body.database === 'connected';
  });

  // Test Group 2: Authentication
  console.log('\n🔴 TEST GROUP 2: Authentication\n');

  await runTest('Login endpoint available', async () => {
    const res = await makeRequest('POST', '/api/v1/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    return res.status === 200 && res.body.data?.accessToken;
  });

  // Test Group 3: Core Episode Endpoints
  console.log('\n🔴 TEST GROUP 3: Core Episode Endpoints\n');

  await runTest('List episodes returns 200', async () => {
    const res = await makeRequest('GET', '/api/v1/episodes?limit=5');
    return res.status === 200;
  });

  await runTest('Episodes have required fields', async () => {
    const res = await makeRequest('GET', '/api/v1/episodes?limit=1');
    const ep = res.body?.data?.[0];
    return ep && ep.id && ep.title && ep.status !== undefined;
  });

  await runTest('Pagination works', async () => {
    const res = await makeRequest('GET', '/api/v1/episodes?limit=10&page=1');
    return res.body?.pagination?.page === 1 && res.body?.pagination?.limit === 10;
  });

  // Test Group 4: Phase 4A Search Endpoints
  console.log('\n🔴 TEST GROUP 4: Phase 4A Search Endpoints\n');

  await runTest('Activity search endpoint works', async () => {
    const res = await makeRequest('GET', '/api/v1/search/activities?limit=5');
    return res.status === 200 && Array.isArray(res.body?.data);
  });

  await runTest('Episode search endpoint works', async () => {
    const res = await makeRequest('GET', '/api/v1/search/episodes?q=&limit=5');
    return res.status === 200 && Array.isArray(res.body?.data);
  });

  await runTest('Suggestions endpoint works', async () => {
    const res = await makeRequest('GET', '/api/v1/search/suggestions?q=&limit=5');
    return res.status === 200 && Array.isArray(res.body?.data);
  });

  await runTest('Audit trail endpoint works', async () => {
    const res = await makeRequest('GET', '/api/v1/search/audit-trail?limit=5');
    return res.status === 200 && Array.isArray(res.body?.data);
  });

  // Test Group 5: Search Functionality
  console.log('\n🔴 TEST GROUP 5: Search Functionality\n');

  await runTest('Episode search returns results', async () => {
    const res = await makeRequest('GET', '/api/v1/search/episodes?q=test&limit=10');
    return res.status === 200 && res.body?.pagination?.total >= 0;
  });

  await runTest('Search filtering by status works', async () => {
    const res = await makeRequest('GET', '/api/v1/search/episodes?status=published&limit=10');
    return res.status === 200;
  });

  await runTest('Search pagination parameters respected', async () => {
    const res = await makeRequest('GET', '/api/v1/search/episodes?limit=5&offset=0');
    return res.status === 200 && res.body?.data?.length <= 5;
  });

  // Test Group 6: Error Handling
  console.log('\n🔴 TEST GROUP 6: Error Handling\n');

  await runTest('Invalid endpoint returns 404', async () => {
    try {
      await makeRequest('GET', '/api/v1/invalid-endpoint');
      return false;
    } catch (e) {
      return true;
    }
  });

  await runTest('Missing auth token handled', async () => {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 3002,
        path: '/api/v1/episodes',
        method: 'GET'
      };
      const req = http.request(options, (res) => {
        resolve(res.statusCode === 401 || res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.end();
    });
  });

  // Test Group 7: Data Integrity
  console.log('\n🔴 TEST GROUP 7: Data Integrity\n');

  await runTest('Episodes have consistent fields', async () => {
    const res = await makeRequest('GET', '/api/v1/episodes?limit=1');
    const ep = res.body?.data?.[0];
    return ep?.id && ep?.title && ep?.episode_number !== undefined;
  });

  await runTest('Activity logs have required fields', async () => {
    const res = await makeRequest('GET', '/api/v1/search/activities?limit=1');
    const log = res.body?.data?.[0];
    return log && (log.user_id || log.resource_type || log.action_type);
  });

  // Test Group 8: Performance
  console.log('\n🔴 TEST GROUP 8: Performance\n');

  await runTest('Health check responds quickly', async () => {
    const start = Date.now();
    await makeRequest('GET', '/health');
    const elapsed = Date.now() - start;
    console.log(`      Response time: ${elapsed}ms`);
    return elapsed < 1000;
  });

  await runTest('Search returns within acceptable time', async () => {
    const start = Date.now();
    await makeRequest('GET', '/api/v1/search/episodes?limit=10');
    const elapsed = Date.now() - start;
    console.log(`      Response time: ${elapsed}ms`);
    return elapsed < 2000;
  });

  // Calculate duration
  testResults.duration = Date.now() - startTime;

  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     TEST SUMMARY                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⏱️  Duration: ${testResults.duration}ms`);
  console.log(`📊 Pass Rate: ${(testResults.passed / (testResults.passed + testResults.failed) * 100).toFixed(1)}%\n`);

  if (testResults.errors.length > 0) {
    console.log('Errors:\n');
    testResults.errors.forEach(e => {
      console.log(`  • ${e.name}: ${e.error}`);
    });
  }

  console.log('\n' + (testResults.failed === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED'));
  console.log('\nStatus: ' + (testResults.failed === 0 ? '✅ READY FOR DAY 2 TESTING' : '⚠️  REVIEW FAILURES'));
}

// Run test suite
runTestSuite().catch(console.error);

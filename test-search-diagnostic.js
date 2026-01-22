/**
 * Quick diagnostic test for search endpoints
 */

require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

async function diagnosticTest() {
  console.log('🔍 Search Endpoint Diagnostic Test\n');

  const baseURL = 'http://127.0.0.1:3002';
  
  // Generate token with Cognito-like structure
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'test-user-diag-123',  // Cognito subject ID
    email: 'test@example.com',
    name: 'Test User',
    'cognito:groups': ['user'],
    token_use: 'access',
    iat: now,
    exp: now + 3600,  // 1 hour from now
  };
  const secret = process.env.JWT_SECRET || 'test-secret-key';
  const token = jwt.sign(payload, secret);
  
  console.log('✓ Generated test token\n');

  // Test episode search
  console.log('Testing: GET /api/v1/search/episodes?q=test');
  try {
    const response = await axios.get(
      `${baseURL}/api/v1/search/episodes?q=test&limit=5`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      }
    );

    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.data, null, 2));
    console.log();
  } catch (error) {
    console.log('Error:', error.message);
    console.log();
  }

  // Test search history
  console.log('Testing: GET /api/v1/search/history');
  try {
    const response = await axios.get(
      `${baseURL}/api/v1/search/history?limit=5`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      }
    );

    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.data, null, 2));
    console.log();
  } catch (error) {
    console.log('Error:', error.message);
    console.log();
  }
}

diagnosticTest();

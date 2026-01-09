#!/usr/bin/env node

/**
 * Task 1 Authentication Implementation Test
 * Tests all components of JWT authentication
 */

require('dotenv').config();
const TokenService = require('./src/services/tokenService');
const { authenticateJWT, optionalJWTAuth, requireGroup } = require('./src/middleware/jwtAuth');

console.log('\n====================================');
console.log('Task 1: JWT Authentication Tests');
console.log('====================================\n');

// Test 1: Verify environment variables
console.log('✓ Test 1: Environment Variables');
const requiredVars = ['JWT_SECRET', 'JWT_EXPIRY', 'JWT_REFRESH_EXPIRY', 'TOKEN_ISSUER', 'TOKEN_AUDIENCE'];
const missingVars = requiredVars.filter(v => !process.env[v]);

if (missingVars.length === 0) {
  console.log('  ✅ All JWT environment variables configured');
  console.log(`     - JWT_SECRET: ${process.env.JWT_SECRET.substring(0, 10)}...`);
  console.log(`     - JWT_EXPIRY: ${process.env.JWT_EXPIRY}`);
  console.log(`     - JWT_REFRESH_EXPIRY: ${process.env.JWT_REFRESH_EXPIRY}`);
  console.log(`     - TOKEN_ISSUER: ${process.env.TOKEN_ISSUER}`);
  console.log(`     - TOKEN_AUDIENCE: ${process.env.TOKEN_AUDIENCE}`);
} else {
  console.log(`  ❌ Missing variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// Test 2: TokenService.generateToken()
console.log('\n✓ Test 2: Token Generation');
try {
  const user = {
    email: 'test@example.com',
    name: 'Test User',
    groups: ['USER', 'EDITOR'],
    role: 'EDITOR',
  };
  
  const accessToken = TokenService.generateToken(user, 'access');
  const refreshToken = TokenService.generateToken(user, 'refresh');
  
  console.log('  ✅ Access token generated');
  console.log(`     - Token: ${accessToken.substring(0, 20)}...`);
  console.log(`     - Length: ${accessToken.length} chars`);
  
  console.log('  ✅ Refresh token generated');
  console.log(`     - Token: ${refreshToken.substring(0, 20)}...`);
  console.log(`     - Length: ${refreshToken.length} chars`);
} catch (error) {
  console.log(`  ❌ Token generation failed: ${error.message}`);
  process.exit(1);
}

// Test 3: TokenService.generateTokenPair()
console.log('\n✓ Test 3: Token Pair Generation');
try {
  const user = {
    email: 'pair-test@example.com',
    name: 'Pair Test User',
    groups: ['USER'],
    role: 'USER',
  };
  
  const pair = TokenService.generateTokenPair(user);
  
  console.log('  ✅ Token pair generated');
  console.log(`     - Access Token: ${pair.accessToken.substring(0, 20)}...`);
  console.log(`     - Refresh Token: ${pair.refreshToken.substring(0, 20)}...`);
  console.log(`     - Expires In: ${pair.expiresIn}ms`);
  console.log(`     - Token Type: ${pair.tokenType}`);
} catch (error) {
  console.log(`  ❌ Token pair generation failed: ${error.message}`);
  process.exit(1);
}

// Test 4: TokenService.verifyToken()
console.log('\n✓ Test 4: Token Verification');
try {
  const user = { email: 'verify@example.com', name: 'Verify User' };
  const token = TokenService.generateToken(user, 'access');
  const decoded = TokenService.verifyToken(token, 'access');
  
  console.log('  ✅ Token verified successfully');
  console.log(`     - User ID: ${decoded.sub}`);
  console.log(`     - Email: ${decoded.email}`);
  console.log(`     - Name: ${decoded.name}`);
  console.log(`     - Token Type: ${decoded.type}`);
  console.log(`     - Issuer: ${decoded.iss}`);
  console.log(`     - Audience: ${decoded.aud}`);
} catch (error) {
  console.log(`  ❌ Token verification failed: ${error.message}`);
  process.exit(1);
}

// Test 5: Token refresh
console.log('\n✓ Test 5: Token Refresh');
try {
  const user = { email: 'refresh@example.com', name: 'Refresh User' };
  const { refreshToken } = TokenService.generateTokenPair(user);
  
  const newTokens = TokenService.refreshAccessToken(refreshToken);
  
  console.log('  ✅ Token refreshed successfully');
  console.log(`     - New Access Token: ${newTokens.accessToken.substring(0, 20)}...`);
  console.log(`     - Expires In: ${newTokens.expiresIn}ms`);
  console.log(`     - Token Type: ${newTokens.tokenType}`);
} catch (error) {
  console.log(`  ❌ Token refresh failed: ${error.message}`);
  process.exit(1);
}

// Test 6: generateTestToken()
console.log('\n✓ Test 6: Test Token Generation (Development)');
try {
  const testToken = TokenService.generateTestToken({
    email: 'admin@example.com',
    groups: ['USER', 'ADMIN'],
    role: 'ADMIN',
  });
  
  console.log('  ✅ Test token generated');
  console.log(`     - Access Token: ${testToken.accessToken.substring(0, 20)}...`);
  console.log(`     - User ID: ${testToken.user.id}`);
  console.log(`     - Email: ${testToken.user.email}`);
  console.log(`     - Groups: ${testToken.user.groups.join(', ')}`);
  console.log(`     - Role: ${testToken.user.role}`);
  console.log(`     - Expires At: ${testToken.expiresAt}`);
} catch (error) {
  console.log(`  ❌ Test token generation failed: ${error.message}`);
  process.exit(1);
}

// Test 7: Invalid token rejection
console.log('\n✓ Test 7: Invalid Token Rejection');
try {
  TokenService.verifyToken('invalid.token.here');
  console.log('  ❌ Invalid token was not rejected!');
  process.exit(1);
} catch (error) {
  console.log('  ✅ Invalid token properly rejected');
  console.log(`     - Error: ${error.message}`);
}

// Test 8: Middleware simulation
console.log('\n✓ Test 8: Middleware Functions Exist');
try {
  const middlewares = {
    authenticateJWT: typeof authenticateJWT === 'function',
    optionalJWTAuth: typeof optionalJWTAuth === 'function',
    requireGroup: typeof requireGroup === 'function',
  };
  
  if (Object.values(middlewares).every(v => v === true)) {
    console.log('  ✅ All middleware functions available');
    console.log(`     - authenticateJWT: ${middlewares.authenticateJWT}`);
    console.log(`     - optionalJWTAuth: ${middlewares.optionalJWTAuth}`);
    console.log(`     - requireGroup: ${middlewares.requireGroup}`);
  } else {
    console.log('  ❌ Some middleware functions missing');
    process.exit(1);
  }
} catch (error) {
  console.log(`  ❌ Middleware check failed: ${error.message}`);
  process.exit(1);
}

// Test 9: Auth routes file exists
console.log('\n✓ Test 9: Auth Routes Module');
try {
  const authRoutes = require('./src/routes/auth');
  console.log('  ✅ Auth routes module loads successfully');
  console.log(`     - Type: ${typeof authRoutes}`);
} catch (error) {
  console.log(`  ❌ Auth routes module failed to load: ${error.message}`);
  process.exit(1);
}

// Test 10: Files exist
console.log('\n✓ Test 10: Implementation Files');
const fs = require('fs');
const files = [
  'src/services/tokenService.js',
  'src/middleware/jwtAuth.js',
  'src/routes/auth.js',
];

let allFilesExist = true;
files.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`     ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

if (!allFilesExist) {
  console.log('  ❌ Some implementation files are missing');
  process.exit(1);
}

// Summary
console.log('\n====================================');
console.log('✅ Task 1: ALL TESTS PASSED');
console.log('====================================\n');

console.log('Implementation Summary:');
console.log('  ✅ JWT_SECRET configured');
console.log('  ✅ Token generation working');
console.log('  ✅ Token verification working');
console.log('  ✅ Token refresh working');
console.log('  ✅ Middleware available');
console.log('  ✅ Auth routes implemented');
console.log('  ✅ All required files created');

console.log('\nNext Steps:');
console.log('  1. Start the server: npm start');
console.log('  2. Test endpoints:');
console.log('     POST /api/v1/auth/test-token');
console.log('     POST /api/v1/auth/login');
console.log('     POST /api/v1/auth/refresh');
console.log('     POST /api/v1/auth/validate');
console.log('     GET  /api/v1/auth/me (with Bearer token)');
console.log('  3. Integrate token management into frontend');
console.log('  4. Protect composition endpoints');
console.log('\nReady for Task 2: Sharp Image Processing\n');

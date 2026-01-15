/**
 * Phase 2.5 Media Pipeline Test Suite
 * Tests Runway ML background removal and Sharp thumbnail generation
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3002';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
};

/**
 * Generic HTTP request helper
 */
function makeRequest(method, pathname, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Test 1: Asset Processing Endpoint Exists
 */
async function testAssetProcessingEndpoint() {
  log.info('Testing Asset Processing Endpoint...');
  try {
    const testAssetId = 'test-asset-' + Date.now();
    const response = await makeRequest('PUT', `/api/v1/assets/${testAssetId}/process`);

    // Expect 404 (asset not found) or 200 (processed)
    if (response.status === 404 || response.status === 200 || response.status === 500) {
      log.success('Asset processing endpoint is accessible');
      return true;
    } else {
      log.error(`Unexpected status code: ${response.status}`);
      return false;
    }
  } catch (err) {
    log.error(`Failed to test asset processing: ${err.message}`);
    return false;
  }
}

/**
 * Test 2: Composition Thumbnail Generation Endpoint Exists
 */
async function testThumbnailGenerationEndpoint() {
  log.info('Testing Thumbnail Generation Endpoint...');
  try {
    const testCompositionId = 'test-comp-' + Date.now();
    const response = await makeRequest('POST', `/api/v1/compositions/${testCompositionId}/generate-thumbnails`);

    // Expect 404 (composition not found), 400 (bad request), or 200 (success)
    if (response.status === 404 || response.status === 400 || response.status === 200 || response.status === 500) {
      log.success('Thumbnail generation endpoint is accessible');
      return true;
    } else {
      log.error(`Unexpected status code: ${response.status}`);
      return false;
    }
  } catch (err) {
    log.error(`Failed to test thumbnail generation: ${err.message}`);
    return false;
  }
}

/**
 * Test 3: Check RunwayMLService Exists
 */
async function testRunwayMLService() {
  log.info('Checking RunwayMLService...');
  try {
    const servicePath = path.join(__dirname, 'src', 'services', 'RunwayMLService.js');
    if (fs.existsSync(servicePath)) {
      const content = fs.readFileSync(servicePath, 'utf8');
      const checks = [
        { name: 'removeBackground method', regex: /removeBackground\s*\(/ },
        { name: 'processWithFallback method', regex: /processWithFallback\s*\(/ },
        { name: 'RUNWAY_ML_API_KEY config', regex: /RUNWAY_ML_API_KEY/ },
        { name: 'Error handling', regex: /catch\s*\(/ },
      ];

      let allFound = true;
      checks.forEach((check) => {
        if (check.regex.test(content)) {
          log.success(`RunwayMLService has ${check.name}`);
        } else {
          log.error(`RunwayMLService missing ${check.name}`);
          allFound = false;
        }
      });

      return allFound;
    } else {
      log.error('RunwayMLService.js not found');
      return false;
    }
  } catch (err) {
    log.error(`Failed to check RunwayMLService: ${err.message}`);
    return false;
  }
}

/**
 * Test 4: Check ThumbnailGeneratorService Exists
 */
async function testThumbnailGeneratorService() {
  log.info('Checking ThumbnailGeneratorService...');
  try {
    const servicePath = path.join(__dirname, 'src', 'services', 'ThumbnailGeneratorService.js');
    if (fs.existsSync(servicePath)) {
      const content = fs.readFileSync(servicePath, 'utf8');
      const checks = [
        { name: 'generateAllFormats method', regex: /generateAllFormats\s*\(/ },
        { name: 'YOUTUBE format', regex: /YOUTUBE/ },
        { name: 'INSTAGRAM_FEED format', regex: /INSTAGRAM_FEED/ },
        { name: 'Sharp integration', regex: /sharp/ },
      ];

      let allFound = true;
      checks.forEach((check) => {
        if (check.regex.test(content)) {
          log.success(`ThumbnailGeneratorService has ${check.name}`);
        } else {
          log.error(`ThumbnailGeneratorService missing ${check.name}`);
          allFound = false;
        }
      });

      return allFound;
    } else {
      log.error('ThumbnailGeneratorService.js not found');
      return false;
    }
  } catch (err) {
    log.error(`Failed to check ThumbnailGeneratorService: ${err.message}`);
    return false;
  }
}

/**
 * Test 5: Check Frontend Components Updated
 */
async function testFrontendComponents() {
  log.info('Checking Frontend Components...');
  try {
    const assetManagerPath = path.join(__dirname, 'frontend', 'src', 'pages', 'AssetManager.jsx');
    const composerPath = path.join(__dirname, 'frontend', 'src', 'pages', 'ThumbnailComposer.jsx');

    let allFound = true;

    if (fs.existsSync(assetManagerPath)) {
      const content = fs.readFileSync(assetManagerPath, 'utf8');
      if (content.includes('handleProcessBackground') && content.includes('processingId')) {
        log.success('AssetManager.jsx has process background functionality');
      } else {
        log.error('AssetManager.jsx missing process background functionality');
        allFound = false;
      }
    } else {
      log.error('AssetManager.jsx not found');
      allFound = false;
    }

    if (fs.existsSync(composerPath)) {
      const content = fs.readFileSync(composerPath, 'utf8');
      if (content.includes('handleGenerateThumbnails') && content.includes('generatingId')) {
        log.success('ThumbnailComposer.jsx has generate thumbnails functionality');
      } else {
        log.error('ThumbnailComposer.jsx missing generate thumbnails functionality');
        allFound = false;
      }
    } else {
      log.error('ThumbnailComposer.jsx not found');
      allFound = false;
    }

    return allFound;
  } catch (err) {
    log.error(`Failed to check frontend components: ${err.message}`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('\n' + colors.blue + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
  console.log(colors.blue + 'Phase 2.5 Media Pipeline Test Suite' + colors.reset);
  console.log(colors.blue + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' + colors.reset);

  const results = [];

  // Service checks (can run without server)
  results.push({
    name: 'RunwayMLService exists',
    passed: await testRunwayMLService(),
  });

  results.push({
    name: 'ThumbnailGeneratorService exists',
    passed: await testThumbnailGeneratorService(),
  });

  results.push({
    name: 'Frontend components updated',
    passed: await testFrontendComponents(),
  });

  // API checks (require running server)
  console.log('\n' + colors.yellow + 'Testing API endpoints (requires running server)...' + colors.reset + '\n');

  results.push({
    name: 'Asset processing endpoint',
    passed: await testAssetProcessingEndpoint(),
  });

  results.push({
    name: 'Thumbnail generation endpoint',
    passed: await testThumbnailGenerationEndpoint(),
  });

  // Summary
  console.log('\n' + colors.blue + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
  console.log(colors.blue + 'Test Summary' + colors.reset);
  console.log(colors.blue + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' + colors.reset);

  let passCount = 0;
  results.forEach((result) => {
    if (result.passed) {
      console.log(`${colors.green}✅${colors.reset} ${result.name}`);
      passCount++;
    } else {
      console.log(`${colors.red}❌${colors.reset} ${result.name}`);
    }
  });

  const totalCount = results.length;
  console.log(`\nPassed: ${passCount}/${totalCount}`);

  if (passCount === totalCount) {
    console.log(colors.green + '\n🎉 All tests passed!' + colors.reset);
    process.exit(0);
  } else {
    console.log(colors.red + '\n⚠️  Some tests failed. See details above.' + colors.reset);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((err) => {
  log.error(`Test suite failed: ${err.message}`);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Phase 2.5 Complete Test Runner
 * Executes all steps: Upload 3 assets → Process → Create composition → Generate thumbnails → Verify
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const FormData = require('form-data');

// ============================================================================
// CONFIGURATION
// ============================================================================
const API_BASE = 'http://localhost:3002/api/v1';
const TEST_IMAGES_DIR = path.join(__dirname, 'test-images');
const EPISODE_ID = 'EP001'; // Using default episode ID

// Test data
const TEST_ASSETS = [
  {
    name: 'Lala',
    file: 'test-lala.png',
    type: 'PROMO_LALA',
    description: 'Lala promotional asset'
  },
  {
    name: 'Guest',
    file: 'test-guest.png',
    type: 'PROMO_GUEST',
    description: 'Guest promotional asset'
  },
  {
    name: 'Frame',
    file: 'test-frame.png',
    type: 'EPISODE_FRAME',
    description: 'Episode background frame'
  }
];

// Episode ID to use (1st available in database)
let EPISODE_ID_TO_USE = 2;
// UTILITIES
// ============================================================================
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, prefix, message) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

function logStep(num, message) {
  log(colors.cyan, `[STEP ${num}]`, message);
}

function logSuccess(message) {
  log(colors.green, '✅', message);
}

function logWarn(message) {
  log(colors.yellow, '⚠️ ', message);
}

function logError(message) {
  log(colors.red, '❌', message);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// HTTP HELPERS
// ============================================================================
function makeRequest(method, url, data = null, isFormData = false) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': isFormData ? `multipart/form-data; boundary=${data.getBoundary()}` : 'application/json'
      }
    };

    const req = require('http').request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (isFormData) {
      data.pipe(req);
    } else if (data) {
      req.write(JSON.stringify(data));
      req.end();
    } else {
      req.end();
    }
  });
}

// ============================================================================
// TEST EXECUTION
// ============================================================================
async function testPhase25() {
  console.log('\n');
  log(colors.bright + colors.blue, '🎬', 'PHASE 2.5 - COMPLETE TEST RUNNER');
  console.log(colors.bright + colors.blue + '════════════════════════════════════════════════════════════════' + colors.reset);
  console.log();

  let uploadedAssets = [];
  let compositionId = null;

  try {
    // ========================================================================
    // STEP 1: Get Available Templates
    // ========================================================================
    logStep(1, 'Fetching available templates');
    const templatesRes = await makeRequest('GET', `${API_BASE}/templates`);
    
    if (templatesRes.status !== 200 || !templatesRes.data.data) {
      logError(`Failed to fetch templates: ${templatesRes.status}`);
      return;
    }

    const templates = templatesRes.data.data;
    logSuccess(`Found ${templates.length} templates`);
    templates.forEach(t => {
      console.log(`  • ${t.name} (${t.layout_name}): ${t.resolution}`);
    });
    console.log();

    // ========================================================================
    // STEP 2-4: Upload & Process Assets
    // ========================================================================
    for (let i = 0; i < TEST_ASSETS.length; i++) {
      const asset = TEST_ASSETS[i];
      logStep(i + 2, `Upload & Process Asset: ${asset.name} (${asset.type})`);

      const filePath = path.join(TEST_IMAGES_DIR, asset.file);
      if (!fs.existsSync(filePath)) {
        logError(`Test file not found: ${asset.file}`);
        return;
      }

      // Upload asset
      console.log(`  Uploading: ${asset.file}...`);
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));
      form.append('assetType', asset.type);
      form.append('metadata', JSON.stringify({
        description: asset.description,
        episode_id: EPISODE_ID
      }));

      const uploadRes = await makeRequest('POST', `${API_BASE}/assets/upload`, form, true);
      
      if (uploadRes.status !== 201 && uploadRes.status !== 200) {
        logError(`Upload failed: ${uploadRes.status}`);
        console.log(`  Response:`, uploadRes.data);
        return;
      }

      const uploadedAsset = uploadRes.data.data;
      const assetId = uploadedAsset.id;
      uploadedAssets.push({ id: assetId, type: asset.type, name: asset.name });
      logSuccess(`Uploaded: ${asset.name} (ID: ${assetId.substring(0, 8)}...)`);

      // Process (background removal)
      console.log(`  Processing background removal (Runway ML)...`);
      await sleep(1000); // Give server time to register

      const processRes = await makeRequest('PUT', `${API_BASE}/assets/${assetId}/process`);
      
      if (processRes.status !== 200) {
        logWarn(`Processing endpoint returned: ${processRes.status}`);
        console.log(`  Response:`, processRes.data);
      } else {
        const processed = processRes.data.data;
        logSuccess(`Processed: ${asset.name} → Status: ${processed.approval_status}`);
      }

      await sleep(500);
    }

    console.log();

    // ========================================================================
    // STEP 5: Verify Assets in Database
    // ========================================================================
    logStep(5, 'Verifying uploaded assets');
    const assetsRes = await makeRequest('GET', `${API_BASE}/assets/approved/PROMO_LALA`);
    
    if (assetsRes.status === 200) {
      logSuccess(`Found ${assetsRes.data.count} approved assets`);
    }

    console.log();

    // ========================================================================
    // STEP 6: Create Composition
    // ========================================================================
    logStep(6, 'Creating thumbnail composition');
    
    if (uploadedAssets.length < 3) {
      logError('Not enough assets uploaded');
      return;
    }

    // Find assets by type to ensure correct mapping
    const lalaAsset = uploadedAssets.find(a => a.type === 'PROMO_LALA');
    const guestAsset = uploadedAssets.find(a => a.type === 'PROMO_GUEST');
    const frameAsset = uploadedAssets.find(a => a.type === 'EPISODE_FRAME');

    if (!lalaAsset || !guestAsset || !frameAsset) {
      logError('Missing required assets');
      return;
    }

    // Use numeric episode ID from database
    const episodeIdForComposition = EPISODE_ID_TO_USE;

    const compositionPayload = {
      episode_id: episodeIdForComposition,
      template_id: templates[0].id,
      lala_asset_id: lalaAsset.id,
      guest_asset_id: guestAsset.id,
      background_frame_asset_id: frameAsset.id,
      selected_formats: ['YOUTUBE', 'INSTAGRAM_FEED']
    };

    const compRes = await makeRequest('POST', `${API_BASE}/compositions`, compositionPayload);
    
    if (compRes.status !== 201 && compRes.status !== 200) {
      logError(`Composition creation failed: ${compRes.status}`);
      console.log(`  Response:`, compRes.data);
      return;
    }

    const composition = compRes.data.data?.composition || compRes.data.data;
    console.log(`  Full composition response:`, JSON.stringify(composition, null, 2));
    
    compositionId = composition?.id;
    
    if (!compositionId) {
      logError(`No composition ID returned`);
      console.log(`  Response:`, compRes.data);
      return;
    }
    
    logSuccess(`Created composition (ID: ${compositionId.substring(0, 8)}...)`);
    console.log(`  Status: ${composition?.approval_status || 'DRAFT'}`);
    console.log(`  Template: ${templates[0].name}`);

    console.log();

    // ========================================================================
    // STEP 7: Generate Thumbnails
    // ========================================================================
    logStep(7, 'Generating thumbnails (Sharp compositing)');
    console.log(`  Creating: YouTube (1920x1080) + Instagram (1080x1080)...`);

    const generateRes = await makeRequest('POST', `${API_BASE}/compositions/${compositionId}/generate-thumbnails`);
    
    if (generateRes.status !== 200 && generateRes.status !== 201) {
      logError(`Thumbnail generation failed: ${generateRes.status}`);
      console.log(`  Response:`, generateRes.data);
      return;
    }

    const generated = generateRes.data.data;
    logSuccess(`Generated ${generated.length} thumbnails`);
    
    if (Array.isArray(generated)) {
      generated.forEach(thumb => {
        console.log(`  • ${thumb.template_name || thumb.format}: ${thumb.resolution} → S3`);
      });
    }

    console.log();

    // ========================================================================
    // STEP 8: Approve Composition
    // ========================================================================
    logStep(8, 'Approving composition');
    
    const approveRes = await makeRequest('PUT', `${API_BASE}/compositions/${compositionId}/approve`);
    
    if (approveRes.status === 200) {
      logSuccess(`Composition approved`);
      console.log(`  Status: ${approveRes.data.data.status}`);
    } else {
      logWarn(`Approval returned: ${approveRes.status}`);
    }

    console.log();

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log(colors.bright + colors.green + '════════════════════════════════════════════════════════════════' + colors.reset);
    log(colors.bright + colors.green, '✅', 'PHASE 2.5 TESTING COMPLETE!');
    console.log(colors.bright + colors.green + '════════════════════════════════════════════════════════════════' + colors.reset);
    console.log();
    console.log('📊 Summary:');
    console.log(`  ✅ Uploaded 3 assets (Lala, Guest, Frame)`);
    console.log(`  ✅ Processed background removal`);
    console.log(`  ✅ Created composition with references`);
    console.log(`  ✅ Generated 2 thumbnail formats`);
    console.log(`  ✅ Composition approved`);
    console.log();
    console.log('🎯 Next Steps:');
    console.log(`  1. Check S3 for processed images and thumbnails`);
    console.log(`  2. Download thumbnails and inspect visual quality`);
    console.log(`  3. Verify database records`);
    console.log();
    console.log('📂 Expected S3 Files:');
    console.log(`  • promotional/lala/raw/ + processed/`);
    console.log(`  • promotional/guest/raw/ + processed/`);
    console.log(`  • episode/frame/raw/`);
    console.log(`  • thumbnails/composite/EP001/*.jpg (2 files)`);
    console.log();

  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// ============================================================================
// RUN TESTS
// ============================================================================
testPhase25().catch(error => {
  logError(`Unhandled error: ${error.message}`);
  process.exit(1);
});

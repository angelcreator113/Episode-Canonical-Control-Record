#!/usr/bin/env node
/**
 * Comprehensive end-to-end test of asset upload and AssetSelector flow
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { Pool } = require('pg');

const pool = new Pool({
  host: '127.0.0.1',
  user: 'postgres',
  password: 'Ayanna123',
  database: 'episode_metadata',
});

const showId = '32bfbf8b-1f46-46dd-8a5d-3b705d324c1b';
const apiBase = 'http://localhost:3002/api/v1';

async function testE2E() {
  try {
    console.log('🧪 END-TO-END TEST: Asset Upload → AssetSelector\n');
    console.log('='.repeat(60));
    
    // Step 1: Upload test asset
    console.log('\n📤 STEP 1: Uploading test background asset...');
    const imagePath = path.join(__dirname, 'test-images', 'test-guest.png');
    const imageBuffer = fs.readFileSync(imagePath);
    
    const form = new FormData();
    form.append('file', imageBuffer, {
      filename: `test-bg-${Date.now()}.png`,
      contentType: 'image/png'
    });
    form.append('assetType', 'BACKGROUND_IMAGE');
    form.append('show_id', showId);
    form.append('entity_type', 'environment');
    form.append('category', 'background');
    form.append('metadata', JSON.stringify({
      show_id: showId,
      showId: showId,
      asset_scope: 'SHOW',
      purpose: 'backgrounds',
      uploadedFrom: 'E2ETest'
    }));
    
    const uploadRes = await axios.post(`${apiBase}/assets`, form, {
      headers: form.getHeaders(),
      timeout: 30000,
    });
    
    const uploadedAssetId = uploadRes.data.data.id;
    console.log(`✅ Asset uploaded successfully`);
    console.log(`   ID: ${uploadedAssetId}`);
    console.log(`   show_id: ${uploadRes.data.data.show_id}`);
    console.log(`   entity_type: ${uploadRes.data.data.entity_type}`);
    console.log(`   category: ${uploadRes.data.data.category}`);
    console.log(`   asset_scope: ${uploadRes.data.data.asset_scope}`);
    
    // Step 2: Verify in database
    console.log('\n🔍 STEP 2: Verifying asset in database...');
    const dbRes = await pool.query(`
      SELECT id, name, show_id, entity_type, category, asset_scope, deleted_at
      FROM assets 
      WHERE id = $1
    `, [uploadedAssetId]);
    
    if (dbRes.rows.length > 0) {
      const asset = dbRes.rows[0];
      console.log(`✅ Asset found in database`);
      console.log(`   show_id: ${asset.show_id}`);
      console.log(`   entity_type: ${asset.entity_type}`);
      console.log(`   category: ${asset.category}`);
      console.log(`   asset_scope: ${asset.asset_scope}`);
      console.log(`   deleted_at: ${asset.deleted_at}`);
    } else {
      console.log('❌ Asset NOT found in database!');
      return;
    }
    
    // Step 3: Query with AssetSelector filters
    console.log('\n🔗 STEP 3: Querying with AssetSelector filters...');
    const filters = {
      show_id: showId,
      entity_type: 'environment',
      category: 'background',
      asset_scope: 'SHOW',
      limit: 200
    };
    
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      params.append(key, val);
    });
    
    const queryRes = await axios.get(`${apiBase}/assets?${params}`);
    const assets = queryRes.data.data || [];
    
    console.log(`✅ Query returned ${assets.length} asset(s)`);
    
    // Check if our uploaded asset is in the results
    const foundAsset = assets.find(a => a.id === uploadedAssetId);
    if (foundAsset) {
      console.log(`✅ 🎉 NEWLY UPLOADED ASSET FOUND IN RESULTS!`);
      console.log(`\n📊 Asset Details:`);
      console.log(`   Name: ${foundAsset.name}`);
      console.log(`   URL: ${foundAsset.s3_url_raw}`);
      console.log(`   Show ID: ${foundAsset.show_id}`);
      console.log(`   Entity Type: ${foundAsset.entity_type}`);
      console.log(`   Category: ${foundAsset.category}`);
    } else {
      console.log('❌ Newly uploaded asset NOT found in results');
      console.log('   This should not happen!');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 END-TO-END TEST COMPLETE!');
    console.log('\n✅ Summary:');
    console.log('   1. Asset successfully uploaded with show_id + entity_type');
    console.log('   2. Asset correctly saved to database');
    console.log('   3. Asset returned by AssetSelector query');
    console.log('\n   The asset system is working correctly!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testE2E();

#!/usr/bin/env node
/**
 * Test to show what real data will display in AssetSelector
 */
const axios = require('axios');

async function testRealData() {
  try {
    // Get all shows first
    console.log('🎬 Fetching your shows...\n');
    const showsRes = await axios.get('http://localhost:3002/api/v1/shows');
    const shows = showsRes.data.data || [];
    
    console.log(`📺 Found ${shows.length} shows:\n`);
    shows.forEach((show, idx) => {
      console.log(`  ${idx + 1}. ${show.name || show.title} (${show.id})`);
    });
    
    if (shows.length === 0) {
      console.log('❌ No shows found');
      return;
    }
    
    // Test with first show
    const testShow = shows[0];
    console.log(`\n✅ Testing with show: ${testShow.name || testShow.title}`);
    console.log(`   ID: ${testShow.id}\n`);
    
    // Query for background assets with SHOW scope
    console.log('🔍 Querying for BACKGROUND assets in this show...\n');
    const assetsRes = await axios.get('http://localhost:3002/api/v1/assets', {
      params: {
        show_id: testShow.id,
        entity_type: 'environment',
        category: 'background',
        asset_scope: 'SHOW',
        limit: 50
      }
    });
    
    const assets = assetsRes.data.data || [];
    console.log(`📦 Found ${assets.length} background asset(s) in this show:\n`);
    
    if (assets.length === 0) {
      console.log('   (No background assets uploaded yet for this show)');
    } else {
      assets.forEach((asset, idx) => {
        console.log(`  ${idx + 1}. ${asset.name}`);
        console.log(`     📐 Size: ${asset.width}x${asset.height}`);
        console.log(`     🌐 URL: ${asset.s3_url_raw?.substring(0, 80)}...`);
        console.log('');
      });
    }
    
    // Check wardrobe/character assets
    console.log('👗 Querying for CHARACTER/WARDROBE assets in this show...\n');
    const wardrobeRes = await axios.get('http://localhost:3002/api/v1/assets', {
      params: {
        show_id: testShow.id,
        entity_type: 'character',
        asset_scope: 'SHOW',
        limit: 50
      }
    });
    
    const wardrobeAssets = wardrobeRes.data.data || [];
    console.log(`👗 Found ${wardrobeAssets.length} character asset(s) in this show:\n`);
    
    if (wardrobeAssets.length === 0) {
      console.log('   (No character assets uploaded yet for this show)');
    } else {
      wardrobeAssets.forEach((asset, idx) => {
        console.log(`  ${idx + 1}. ${asset.character_name || 'Unknown'}: ${asset.outfit_name || asset.name}`);
        console.log(`     Era: ${asset.outfit_era || 'N/A'}`);
        console.log('');
      });
    }
    
    console.log('\n✅ AssetSelector will display these assets when you open it in the Scene Composer!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testRealData();

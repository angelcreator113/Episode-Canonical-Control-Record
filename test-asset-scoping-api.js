const axios = require('axios');

async function testAssetScoping() {
  try {
    console.log('🧪 Testing Asset Scoping API\n');

    // Get a sample episode to find its show_id
    const episodesRes = await axios.get('http://localhost:3002/api/v1/episodes', {
      params: { limit: 1 }
    });

    if (!episodesRes.data.data || episodesRes.data.data.length === 0) {
      console.log('❌ No episodes found');
      return;
    }

    const episode = episodesRes.data.data[0];
    console.log('📺 Test Episode:', episode.title);
    console.log('   Episode ID:', episode.id);
    console.log('   Show ID:', episode.show_id);
    console.log();

    // Test 1: Fetch LALA assets WITHOUT scoping (old way)
    console.log('TEST 1: Fetch all LALA assets (no scoping)');
    const allAssets = await axios.get('http://localhost:3002/api/v1/assets', {
      params: {
        approval_status: 'APPROVED',
        limit: 1000
      }
    });
    const lalaAssetsAll = allAssets.data.data.filter(a => a.asset_group === 'LALA');
    console.log(`   Result: ${lalaAssetsAll.length} LALA assets`);
    console.log();

    // Test 2: Fetch LALA assets WITH scoping (new way)
    console.log('TEST 2: Fetch LALA assets WITH scoping');
    const scopedAssets = await axios.get('http://localhost:3002/api/v1/assets/by-folder', {
      params: {
        folders: 'LALA',
        showId: episode.show_id,
        episodeId: episode.id,
        approvalStatus: 'APPROVED'
      }
    });
    console.log(`   Result: ${scopedAssets.data.data.length} LALA assets`);
    console.log();

    // Test 3: Break down by scope
    console.log('📊 Breakdown of scoped assets:');
    const byScope = scopedAssets.data.data.reduce((acc, asset) => {
      const scope = asset.asset_scope || 'NULL';
      acc[scope] = (acc[scope] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(byScope).forEach(([scope, count]) => {
      console.log(`   ${scope}: ${count}`);
    });
    console.log();

    // Show sample assets
    console.log('📦 Sample scoped assets:');
    scopedAssets.data.data.slice(0, 5).forEach(asset => {
      console.log(`   - ${asset.name}`);
      console.log(`     Scope: ${asset.asset_scope}, Show ID: ${asset.show_id || 'null'}`);
    });
    console.log();

    console.log('💡 EXPECTED BEHAVIOR:');
    console.log(`   - Old way (no scoping): ${lalaAssetsAll.length} assets`);
    console.log(`   - New way (with scoping): ${scopedAssets.data.data.length} assets`);
    console.log(`   - The new way should show FEWER assets (only GLOBAL + matching SHOW)`);
    
    if (scopedAssets.data.data.length < lalaAssetsAll.length) {
      console.log('\n✅ Scoping is working! API returns fewer assets.');
    } else {
      console.log('\n❌ Scoping NOT working! API returns same number of assets.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testAssetScoping();

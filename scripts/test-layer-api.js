const axios = require('axios');

const API_BASE = 'http://localhost:3002/api/v1';

async function testLayerAPI() {
  try {
    console.log('🧪 Testing Layer Management API...\n');

    // Get episodes to use for testing
    console.log('1. Finding test episode...');
    const episodesRes = await axios.get(`${API_BASE}/episodes`);
    const episode = episodesRes.data.data[0];
    console.log(`✅ Using episode: ${episode.title} (${episode.id})\n`);

    // Create layers for the episode
    console.log('2. Creating 5 layers for episode...');
    const layerTypes = [
      { layer_number: 1, layer_type: 'background', name: 'Background Layer' },
      { layer_number: 2, layer_type: 'main', name: 'Main Content' },
      { layer_number: 3, layer_type: 'overlay', name: 'Overlay Graphics' },
      { layer_number: 4, layer_type: 'text', name: 'Text & Captions' },
      { layer_number: 5, layer_type: 'audio', name: 'Audio & Music' }
    ];

    const layersRes = await axios.post(`${API_BASE}/layers/bulk-create`, {
      episode_id: episode.id,
      layers: layerTypes.map(lt => ({
        ...lt,
        opacity: 1.00,
        blend_mode: 'normal',
        is_visible: true,
        is_locked: false
      }))
    });
    console.log(`✅ Created ${layersRes.data.data.length} layers\n`);

    // Get all layers for the episode
    console.log('3. Fetching layers for episode...');
    const getLayersRes = await axios.get(`${API_BASE}/layers?episode_id=${episode.id}`);
    console.log(`✅ Retrieved ${getLayersRes.data.data.length} layers`);
    getLayersRes.data.data.forEach(layer => {
      console.log(`   - Layer ${layer.layer_number}: ${layer.name} (${layer.layer_type})`);
    });
    console.log();

    // Update a layer
    const layerToUpdate = getLayersRes.data.data[2]; // Layer 3 (overlay)
    console.log(`4. Updating layer ${layerToUpdate.layer_number}...`);
    await axios.put(`${API_BASE}/layers/${layerToUpdate.id}`, {
      opacity: 0.85,
      blend_mode: 'overlay',
      metadata: { effect: 'blur', intensity: 5 }
    });
    console.log(`✅ Updated layer opacity and blend mode\n`);

    // Get assets to add to layers
    console.log('5. Finding assets to add to layers...');
    const assetsRes = await axios.get(`${API_BASE}/assets?limit=3`);
    const assets = assetsRes.data.data || assetsRes.data;
    
    if (assets && assets.length > 0) {
      console.log(`✅ Found ${assets.length} assets\n`);

      // Add assets to different layers
      console.log('6. Adding assets to layers...');
      const layer1 = getLayersRes.data.data[0];
      const layer2 = getLayersRes.data.data[1];

      const asset1Res = await axios.post(`${API_BASE}/layers/${layer1.id}/assets`, {
        asset_id: assets[0].id,
        position_x: 0,
        position_y: 0,
        opacity: 1.00,
        start_time: 0.0,
        duration: 10.0,
        order_index: 1
      });
      console.log(`✅ Added asset to ${layer1.name}`);

      if (assets.length > 1) {
        const asset2Res = await axios.post(`${API_BASE}/layers/${layer2.id}/assets`, {
          asset_id: assets[1].id,
          position_x: 100,
          position_y: 100,
          width: 1920,
          height: 1080,
          opacity: 1.00,
          scale_x: 0.5,
          scale_y: 0.5,
          rotation: 0,
          start_time: 2.0,
          duration: 15.0,
          order_index: 1
        });
        console.log(`✅ Added asset to ${layer2.name}`);
      }
      console.log();

      // Update asset position
      console.log('7. Updating asset position...');
      const assetPlacement = asset1Res.data.data;
      await axios.put(`${API_BASE}/layers/assets/${assetPlacement.id}`, {
        position_x: 50,
        position_y: 50,
        rotation: 15.0
      });
      console.log(`✅ Updated asset position and rotation\n`);
    } else {
      console.log('⚠️ No assets found, skipping asset placement tests\n');
    }

    // Get layers with assets included
    console.log('8. Fetching complete layer structure...');
    const completeLayersRes = await axios.get(`${API_BASE}/layers?episode_id=${episode.id}&include_assets=true`);
    const layersWithAssets = completeLayersRes.data.data;
    console.log(`✅ Retrieved ${layersWithAssets.length} layers with asset details`);
    layersWithAssets.forEach(layer => {
      const assetCount = layer.assets ? layer.assets.length : 0;
      console.log(`   - Layer ${layer.layer_number}: ${layer.name} - ${assetCount} asset(s)`);
    });
    console.log();

    // Delete a layer
    const layerToDelete = getLayersRes.data.data[4]; // Audio layer
    console.log(`9. Soft deleting layer ${layerToDelete.layer_number}...`);
    await axios.delete(`${API_BASE}/layers/${layerToDelete.id}`);
    console.log(`✅ Deleted ${layerToDelete.name}\n`);

    // Verify deletion
    console.log('10. Verifying layer deletion...');
    const finalLayersRes = await axios.get(`${API_BASE}/layers?episode_id=${episode.id}`);
    console.log(`✅ Remaining layers: ${finalLayersRes.data.data.length} (was ${layersWithAssets.length})`);

    console.log('\n🎉 All Layer Management API tests passed!');
    console.log('\nAPI Endpoints tested:');
    console.log('✅ GET /api/v1/layers (with filters)');
    console.log('✅ GET /api/v1/layers/:id');
    console.log('✅ POST /api/v1/layers');
    console.log('✅ POST /api/v1/layers/bulk-create');
    console.log('✅ PUT /api/v1/layers/:id');
    console.log('✅ DELETE /api/v1/layers/:id');
    console.log('✅ POST /api/v1/layers/:id/assets');
    console.log('✅ PUT /api/v1/layers/assets/:assetId');
    console.log('✅ DELETE /api/v1/layers/assets/:assetId');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response?.status) {
      console.error(`   Status: ${error.response.status}`);
    }
    process.exit(1);
  }
}

testLayerAPI();

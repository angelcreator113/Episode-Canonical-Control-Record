const axios = require('axios');

async function testQuery() {
  try {
    console.log('🧪 Testing AssetSelector query with correct filters...\n');
    
    const filters = {
      show_id: '32bfbf8b-1f46-46dd-8a5d-3b705d324c1b',
      entity_type: 'environment',
      category: 'background',
      asset_scope: 'SHOW',
      limit: 200
    };
    
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      params.append(key, val);
    });
    
    console.log('📤 Query URL: /api/v1/assets?' + params.toString());
    console.log('📋 Filters:', filters);
    console.log('');
    
    const res = await axios.get('http://localhost:3002/api/v1/assets', { params: filters });
    
    console.log('✅ Response received!');
    console.log(`📦 Assets found: ${res.data.data?.length || 0}`);
    
    if (res.data.data && res.data.data.length > 0) {
      console.log('\n🎉 SUCCESS! Assets are being returned!');
      console.log('\nFirst 3 assets:');
      res.data.data.slice(0, 3).forEach((asset, idx) => {
        console.log(`  ${idx + 1}. ${asset.name}`);
        console.log(`     - show_id: ${asset.show_id}`);
        console.log(`     - entity_type: ${asset.entity_type}`);
        console.log(`     - category: ${asset.category}`);
      });
    } else {
      console.log('❌ No assets returned. Check the query.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testQuery();

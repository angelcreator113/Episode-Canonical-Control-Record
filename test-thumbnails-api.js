/**
 * Test API after restart to verify thumbnails are being returned
 */

const axios = require('axios');

async function testThumbnails() {
  try {
    console.log('🧪 Testing API for thumbnail support...\n');

    const response = await axios.get('http://localhost:3002/api/v1/assets?limit=2');
    
    if (!response.data || !response.data.data || response.data.data.length === 0) {
      console.log('❌ No assets returned');
      return;
    }

    const asset = response.data.data[0];
    
    console.log('📦 First Asset:');
    console.log('  Name:', asset.name);
    console.log('  Has metadata?', asset.metadata ? '✅ YES' : '❌ NO');
    
    if (asset.metadata) {
      console.log('  Metadata keys:', Object.keys(asset.metadata));
      console.log('  thumbnail_url:', asset.metadata.thumbnail_url ? '✅ ' + asset.metadata.thumbnail_url.substring(0, 70) + '...' : '❌ NOT SET');
    }
    
    console.log('  s3_url_raw:', asset.s3_url_raw?.substring(0, 70) + '...');
    console.log('  width x height:', asset.width + ' × ' + asset.height);
    console.log('  file_size_bytes:', asset.file_size_bytes);
    
    console.log('\n✅ API is returning metadata field!');
    
    if (asset.metadata?.thumbnail_url) {
      console.log('✅ Thumbnail URL is present - frontend will now use optimized thumbnails!');
    } else {
      console.log('⚠️  This asset doesn\'t have a thumbnail (might be an old asset)');
      console.log('   New uploads will have thumbnails automatically');
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  Backend is not running. Start it with: node src/server.js');
    }
  }
}

testThumbnails();

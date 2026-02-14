const axios = require('axios');

async function testWardrobeEndpoint() {
  try {
    const episodeId = 'fbfdaa3e-c20c-4bda-8fd3-0927c79867c9';
    const url = `https://dev.primepisodes.com/api/v1/episodes/${episodeId}/wardrobe`;
    
    console.log('Testing:', url);
    
    const response = await axios.get(url);
    console.log('✅ Success:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.status);
    console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
  }
}

testWardrobeEndpoint();

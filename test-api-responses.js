const axios = require('axios');

(async () => {
  const episodeId = '18d5aad8-f226-4aba-a792-4326bf5e3bcf';
  
  console.log('=== Testing platform API ===');
  try {
    const platformRes = await axios.get(`http://localhost:3002/api/v1/episodes/${episodeId}/platform`);
    console.log('Status:', platformRes.status);
    console.log('Response keys:', Object.keys(platformRes.data));
    console.log('typeof response.data:', typeof platformRes.data);
    if (platformRes.data?.data) {
      console.log('  response.data.platform:', platformRes.data.platform);
      console.log('  response.data.data.platform:', platformRes.data.data?.platform);
    }
  } catch (e) {
    console.error('Platform error:', e.response?.status, e.response?.data?.message || e.message);
  }
  
  console.log('\n=== Testing scenes API ===');
  try {
    const scenesRes = await axios.get(`http://localhost:3002/api/v1/episodes/${episodeId}/scenes`);
    console.log('Status:', scenesRes.status);
    console.log('Response keys:', Object.keys(scenesRes.data));
    console.log('typeof response.data:', typeof scenesRes.data);
    console.log('Is array?', Array.isArray(scenesRes.data));
    console.log('Has response.data.data?', !!scenesRes.data?.data);
    console.log('Is response.data.data an array?', Array.isArray(scenesRes.data?.data));
    if (scenesRes.data?.data) {
      console.log('  First scene ID:', scenesRes.data.data[0]?.id);
    }
  } catch (e) {
    console.error('Scenes error:', e.response?.status, e.response?.data?.message || e.message);
  }
})();

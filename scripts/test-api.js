const axios = require('axios');

async function testAPI() {
  try {
    const episodeId = '2b7065de-f599-4c5b-95a7-61df8f91cffa';
    const ports = [3002, 5000];
    
    for (const port of ports) {
      console.log(`\n=== Testing port ${port} ===\n`);
      
      // Test stats endpoint
      try {
        const statsRes = await axios.get(`http://localhost:${port}/api/decision-analytics/stats?episode_id=${episodeId}`, { timeout: 2000 });
        console.log('✅ Stats endpoint response:', JSON.stringify(statsRes.data, null, 2));
      } catch (error) {
        console.log('❌ Stats endpoint error:', error.code || error.response?.status || error.message);
      }

      // Test by-type endpoint
      try {
        const typeRes = await axios.get(`http://localhost:${port}/api/decision-analytics/by-type?episode_id=${episodeId}`, { timeout: 2000 });
        console.log('\n✅ By-type endpoint response:', JSON.stringify(typeRes.data, null, 2));
      } catch (error) {
        console.log('\n❌ By-type endpoint error:', error.code || error.response?.status || error.message);
      }

      // Test decisions endpoint
      try {
        const decisionsRes = await axios.get(`http://localhost:${port}/api/v1/decisions?episode_id=${episodeId}`, { timeout: 2000 });
        console.log('\n✅ Decisions endpoint response (count):', decisionsRes.data.decisions?.length || decisionsRes.data.data?.length || 0);
      } catch (error) {
        console.log('\n❌ Decisions endpoint error:', error.code || error.response?.status || error.message);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testAPI();

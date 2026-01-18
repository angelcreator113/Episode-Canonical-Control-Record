const axios = require('axios');

async function testCreateEpisode() {
  try {
    console.log('Testing episode creation...');
    console.log('Make sure the server is running on port 3002');
    
    const response = await axios.post('http://localhost:3002/api/v1/episodes', {
      title: 'Test Episode',
      episode_number: 1,
      description: 'Testing episode creation after fixes',
      status: 'draft',
      categories: ['comedy', 'drama']
    }, {
      timeout: 5000
    });
    
    console.log('\n✅ SUCCESS! Episode created:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n🎉 Episode creation is working properly!');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Cannot connect to server. Please start the backend server first:');
      console.error('   Run: node src/server.js');
    } else {
      console.error('❌ ERROR:', error.response?.data || error.message);
    }
    process.exit(1);
  }
}

testCreateEpisode();

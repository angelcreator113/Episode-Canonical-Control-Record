const axios = require('axios');

async function createTestEpisode() {
  try {
    // Login first to get token
    console.log('Logging in...');
    const loginResponse = await axios.post('http://127.0.0.1:3000/api/v1/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful');

    // Create test episode
    console.log('\nCreating test episode...');
    const episodeResponse = await axios.post(
      'http://127.0.0.1:3000/api/v1/episodes',
      {
        title: 'Test Episode - Fashion Tips',
        episode_number: 1,
        status: 'draft',
        description: 'This is a test episode about fashion tips and styling advice for modern women.',
        air_date: '2026-02-01',
        categories: ['fashion', 'tutorial', 'lifestyle']
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Test episode created successfully!');
    console.log('\nEpisode Details:');
    console.log('  ID:', episodeResponse.data.data.id);
    console.log('  Title:', episodeResponse.data.data.title);
    console.log('  Episode #:', episodeResponse.data.data.episode_number);
    console.log('  Status:', episodeResponse.data.data.status);
    console.log('  Categories:', episodeResponse.data.data.categories);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

createTestEpisode();

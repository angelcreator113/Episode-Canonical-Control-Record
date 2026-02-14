/**
 * Test thumbnail-templates endpoint with SQL debugging
 */
const http = require('http');

// Enable Sequelize SQL logging
process.env.DEBUG = 'sequelize:sql';

// Import app
const app = require('./app');

const PORT = 3002;

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT} with SQL debugging`);
  console.log('');
  
  // Test the endpoint after a short delay
  setTimeout(async () => {
    const testUrl = 'http://localhost:3002/api/v1/thumbnail-templates?showId=32bfbf8b-1f46-46dd-8a5d-3b705d324c1b';
    console.log(`📡 Testing: ${testUrl}\n`);
    
    http.get(testUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('\n📥 Response:', res.statusCode);
        console.log(data);
        process.exit(res.statusCode === 200 ? 0 : 1);
      });
    }).on('error', (err) => {
      console.error('❌ Request failed:', err.message);
      process.exit(1);
    });
  }, 2000);
});

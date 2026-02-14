const http = require('http');

const endpoints = ['/ping', '/health', '/api/v1/episodes'];

function testEndpoint(path) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`✓ ${path} [${res.statusCode}]:`, JSON.stringify(json, null, 2));
        } catch (e) {
          console.log(`✓ ${path} [${res.statusCode}]:`, data);
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      console.error(`✗ ${path}: ${err.message}`);
      resolve();
    });

    setTimeout(() => {
      req.destroy();
      console.error(`✗ ${path}: timeout`);
      resolve();
    }, 5000);
  });
}

async function runTests() {
  console.log('Testing API endpoints...\n');
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
  process.exit(0);
}

runTests();

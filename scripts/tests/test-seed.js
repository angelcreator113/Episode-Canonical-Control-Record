#!/usr/bin/env node
const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 3002,
  path: '/api/v1/seed/templates',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000,
};

console.log('🔄 Calling seed endpoint...');

const req = http.request(options, (res) => {
  let data = '';
  console.log(`📊 Status: ${res.statusCode}`);
  
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ Response:', JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('📝 Response (raw):', data);
    }
    process.exit(0);
  });
});

req.on('timeout', () => {
  console.error('❌ Timeout: Server not responding');
  req.destroy();
  process.exit(1);
});

req.on('error', (error) => {
  console.error('❌ Error:', error.code, error.message || error);
  process.exit(1);
});

req.end();

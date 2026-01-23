// Quick script to check if junction tables exist on the dev server
const https = require('https');

const episodeId = 'fbfdaa3e-c20c-4bda-8fd3-0927c79867c9';

console.log('🔍 Testing dev server endpoints...\n');

// Test assets endpoint
https.get(`https://dev.primepisodes.com/api/v1/episodes/${episodeId}/assets`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Assets endpoint:');
    console.log(`  Status: ${res.statusCode}`);
    if (res.statusCode !== 200) {
      console.log(`  Error: ${data.substring(0, 200)}`);
    }
    console.log('');
    
    // Test scripts endpoint
    https.get(`https://dev.primepisodes.com/api/v1/episodes/${episodeId}/scripts?includeAllVersions=true&includeContent=true`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Scripts endpoint:');
        console.log(`  Status: ${res.statusCode}`);
        if (res.statusCode !== 200) {
          console.log(`  Error: ${data.substring(0, 200)}`);
        }
        process.exit(res.statusCode === 200 ? 0 : 1);
      });
    }).on('error', err => {
      console.error('Scripts request failed:', err.message);
      process.exit(1);
    });
  });
}).on('error', err => {
  console.error('Assets request failed:', err.message);
  process.exit(1);
});

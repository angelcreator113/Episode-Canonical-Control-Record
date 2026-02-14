#!/usr/bin/env node

/**
 * Check composition assets and S3 keys
 * Fetches composition data from API to see what S3 keys are used
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/v1/compositions',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      const compositions = Array.isArray(response) ? response : response.data || [];
      
      console.log('\n📦 Compositions and Asset S3 Keys\n');
      
      if (compositions.length === 0) {
        console.log('❌ No compositions found');
        console.log('API Response:', JSON.stringify(response, null, 2).substring(0, 500));
        process.exit(0);
      }

      compositions.forEach((comp, idx) => {
        console.log(`${idx + 1}. Composition: ${comp.id}`);
        console.log(`   Episode: ${comp.episode?.title || 'Unknown'}`);
        
        if (comp.lalaAsset) {
          console.log(`   Lala Asset:`);
          console.log(`     S3 Raw: ${comp.lalaAsset.s3_key_raw || '(empty)'}`);
          console.log(`     S3 Processed: ${comp.lalaAsset.s3_key_processed || '(empty)'}`);
        }
        
        if (comp.guestAsset) {
          console.log(`   Guest Asset:`);
          console.log(`     S3 Raw: ${comp.guestAsset.s3_key_raw || '(empty)'}`);
          console.log(`     S3 Processed: ${comp.guestAsset.s3_key_processed || '(empty)'}`);
        }

        if (comp.backgroundAsset) {
          console.log(`   Background Asset:`);
          console.log(`     S3 Raw: ${comp.backgroundAsset.s3_key_raw || '(empty)'}`);
          console.log(`     S3 Processed: ${comp.backgroundAsset.s3_key_processed || '(empty)'}`);
        }
        console.log('');
      });

      process.exit(0);

    } catch (error) {
      console.error('Error parsing response:', error.message);
      console.error('Raw response:', data.substring(0, 500));
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('API Error:', error.message);
  process.exit(1);
});

req.end();

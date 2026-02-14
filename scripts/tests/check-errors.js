const https = require('https');

function getError(endpoint) {
  return new Promise((resolve) => {
    https.get(`https://dev.primepisodes.com/api/v1/${endpoint}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ endpoint, status: res.statusCode, error: json.message || json.error });
        } catch (e) {
          resolve({ endpoint, status: res.statusCode, error: 'Parse error' });
        }
      });
    }).on('error', err => {
      resolve({ endpoint, status: 'ERROR', error: err.message });
    });
  });
}

async function main() {
  const endpoints = ['scenes', 'templates'];
  const results = await Promise.all(endpoints.map(getError));
  
  console.log('\nDetailed Errors:\n================');
  results.forEach(r => {
    console.log(`\n${r.endpoint}:`);
    console.log(`  Status: ${r.status}`);
    console.log(`  Error: ${r.error}`);
  });
}

main();

// Read .env manually
const fs = require('fs');
const envContent = fs.readFileSync('/home/ubuntu/episode-metadata/.env', 'utf8');
const lines = envContent.split('\n');
let key = '';
for (const line of lines) {
  if (line.startsWith('ANTHROPIC_API_KEY=')) {
    key = line.substring('ANTHROPIC_API_KEY='.length).trim();
    break;
  }
}
console.log('KEY_LENGTH:', key.length);
console.log('KEY_START:', key.substring(0, 25));
console.log('KEY_END:', key.substring(key.length - 10));
console.log('HAS_NEWLINE:', key.includes('\n'));
console.log('HAS_CR:', key.includes('\r'));

// Try to actually init the SDK and make a small call
process.env.ANTHROPIC_API_KEY = key;
try {
  const Anthropic = require('/home/ubuntu/episode-metadata/node_modules/@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: key });
  console.log('SDK_INIT: OK');
} catch (e) {
  console.log('SDK_INIT_ERROR:', e.message);
}

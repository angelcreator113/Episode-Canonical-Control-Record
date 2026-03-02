/**
 * Test that the therapy session-open route now includes story memories.
 * We'll call session-open with JustAWoman's character_id.
 */
const http = require('http');

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== Testing Therapy Session with Story Memories ===\n');

  const result = await request({
    hostname: '127.0.0.1', port: 3002,
    path: '/api/v1/therapy/session-open',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    character_id: '4ee8240d-f0bd-485f-ae7b-7bf2b3a37eda',
    character_name: 'JustAWoman',
    archetype: 'justawoman',
    nature: {
      nature: 'The entrepreneur who keeps building',
      wound: 'The people who love her most become the ceiling she has to push through.',
      unsayable: 'She might lose David in the becoming.',
    },
    emotional_state: { trust: 5, grief: 3, anger: 4, hope: 6, fear: 4, love: 5 },
    baseline: { trust: 5, grief: 2, anger: 3, hope: 5, fear: 3, love: 5 },
    known: ['David is concerned about her schedule'],
    sensed: ['Something is shifting between them'],
    never_knows: [],
    primary_defense: 'Deflection through competence',
    deja_vu_events: [],
    sessions_completed: 2,
    event: 'Her latest post went viral and David said nothing about it. When she finally brought it up, he said: "I just don\'t want you to burn out."',
  });

  console.log('Response from session-open:');
  console.log('  opening:', result.opening?.slice(0, 300));
  console.log('  deja_vu:', result.deja_vu_triggered);
  console.log('\n=== Test complete ===');
}

main().catch(e => console.error('Error:', e));

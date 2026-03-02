/**
 * Test the Story Engine → Therapy Room pipeline
 * 1. Calls extract-story-memories with a sample story
 * 2. Verifies memories are saved to DB
 * 3. Calls the GET story-memories endpoint
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

const PORT = 3002;
const CHAR_ID = '4ee8240d-f0bd-485f-ae7b-7bf2b3a37eda'; // JustAWoman

async function main() {
  console.log('=== Testing Story Engine → Therapy Room Pipeline ===\n');

  // 1. Extract memories from a test story
  console.log('1. Extracting memories from test story...');
  const extractResult = await request({
    hostname: '127.0.0.1', port: PORT,
    path: '/api/v1/memories/extract-story-memories',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    characterId: CHAR_ID,
    characterKey: 'justawoman',
    storyNumber: 99,
    storyTitle: 'The Silence After Success',
    storyText: 'She sat at her desk, watching the analytics dashboard. The numbers had tripled overnight. Her post about financial independence had gone viral. But instead of joy, she felt a familiar constriction in her chest. David had not said a word about it. He saw it — she knew he saw it — but he chose silence. The same silence that built walls instead of bridges. She opened her journal and wrote: I am becoming someone he does not recognize. And I am not sure I am sorry.',
  });

  console.log(`   Memories extracted: ${extractResult.memories_extracted}`);
  console.log(`   Pain points: ${(extractResult.pain_points || []).length}`);
  console.log(`   Belief shifts: ${(extractResult.belief_shifts || []).length}`);
  console.log(`   Therapy opening: ${extractResult.therapy_opening ? 'YES' : 'NO'}`);

  if (extractResult.memories_extracted > 0) {
    console.log('   ✅ Memories saved to DB!\n');
  } else {
    console.log('   ❌ No memories saved (check errors above)\n');
  }

  // 2. Fetch memories for the character
  console.log('2. Fetching stored memories via GET...');
  const getResult = await request({
    hostname: '127.0.0.1', port: PORT,
    path: `/api/v1/memories/story-memories/${CHAR_ID}`,
    method: 'GET',
  });

  console.log(`   Total in DB: ${getResult.total || 0}`);
  console.log(`   Pain points: ${(getResult.pain_points || []).length}`);
  console.log(`   Belief shifts: ${(getResult.belief_shifts || []).length}`);
  console.log(`   Therapy openings: ${(getResult.therapy_openings || []).length}`);

  if ((getResult.total || 0) > 0) {
    console.log('   ✅ GET endpoint works!\n');
    if (getResult.pain_points?.length) {
      console.log('   Sample pain point:', getResult.pain_points[0].statement?.slice(0, 80));
    }
  } else {
    console.log('   ❌ No memories returned\n');
  }

  console.log('\n=== Pipeline test complete ===');
}

main().catch(e => console.error('Test error:', e));

/**
 * test-story-engine.js — Tests all 4 Story Engine endpoints on EC2
 * Usage: node test-story-engine.js
 */
const http = require('http');

const BASE = { hostname: 'localhost', port: 3002 };

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      ...BASE,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf.slice(0, 500) }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== STORY ENGINE ENDPOINT TESTS ===\n');

  // ── 1. generate-story-tasks ──────────────────────────────────────
  console.log('1) POST /memories/generate-story-tasks (characterKey: justawoman)');
  console.log('   Calling Claude to generate 50 task briefs... (may take 30-60s)');
  const t1 = Date.now();
  const r1 = await post('/api/v1/memories/generate-story-tasks', { characterKey: 'justawoman' });
  console.log('   Status:', r1.status, '| Time:', ((Date.now() - t1) / 1000).toFixed(1) + 's');
  if (r1.status === 200 && r1.body.tasks) {
    console.log('   Tasks returned:', r1.body.tasks.length);
    console.log('   Character:', r1.body.display_name, '| World:', r1.body.world);
    const firstTask = r1.body.tasks[0];
    if (firstTask) {
      console.log('   First task:', JSON.stringify({
        story_number: firstTask.story_number,
        title: firstTask.title,
        phase: firstTask.phase,
        story_type: firstTask.story_type,
        task: firstTask.task?.slice(0, 80) + '...',
      }));
    }
  } else {
    console.log('   ERROR:', JSON.stringify(r1.body).slice(0, 300));
  }
  console.log();

  // ── 2. generate-story ────────────────────────────────────────────
  // Use the first task from step 1 if available, otherwise a mock
  const taskBrief = (r1.body.tasks && r1.body.tasks[0]) || {
    title: 'Test Story',
    phase: 'establishment',
    story_type: 'internal',
    task: 'Film a 90-second reel before Noah wakes up',
    obstacle: 'The tripod breaks and she has to hold the phone one-handed',
    strength_weaponized: 'Her consistency becomes stubbornness',
    opening_line: 'The kitchen was still dark when she pressed record.',
    new_character: false,
    therapy_seeds: ['visibility gap', 'comparison spiral'],
  };

  console.log('2) POST /memories/generate-story (story 1 for justawoman)');
  console.log('   Calling Claude to write a full story... (may take 30-90s)');
  const t2 = Date.now();
  const r2 = await post('/api/v1/memories/generate-story', {
    characterKey: 'justawoman',
    storyNumber: 1,
    taskBrief,
    previousStories: [],
  });
  console.log('   Status:', r2.status, '| Time:', ((Date.now() - t2) / 1000).toFixed(1) + 's');
  if (r2.status === 200 && r2.body.text) {
    console.log('   Title:', r2.body.title);
    console.log('   Word count:', r2.body.word_count);
    console.log('   Phase:', r2.body.phase, '| Type:', r2.body.story_type);
    console.log('   First 150 chars:', r2.body.text.slice(0, 150) + '...');
    console.log('   Fallback:', r2.body.fallback || false);
  } else {
    console.log('   ERROR:', JSON.stringify(r2.body).slice(0, 300));
  }
  console.log();

  // ── 3. check-story-consistency ───────────────────────────────────
  const storyText = r2.body?.text || 'She reached for the phone. The screen was cracked. David had left for work early.';
  console.log('3) POST /memories/check-story-consistency');
  console.log('   Checking edited story against empty later stories...');
  const t3 = Date.now();
  const r3 = await post('/api/v1/memories/check-story-consistency', {
    characterKey: 'justawoman',
    editedStoryNumber: 1,
    editedStoryText: storyText.slice(0, 2000),
    existingStories: [],
  });
  console.log('   Status:', r3.status, '| Time:', ((Date.now() - t3) / 1000).toFixed(1) + 's');
  if (r3.status === 200) {
    console.log('   Conflicts:', r3.body.conflicts?.length || 0);
    console.log('   Message:', r3.body.message || '(none)');
  } else {
    console.log('   ERROR:', JSON.stringify(r3.body).slice(0, 300));
  }
  console.log();

  // ── 4. extract-story-memories ────────────────────────────────────
  console.log('4) POST /memories/extract-story-memories');
  console.log('   Extracting therapy memories from story text...');
  const t4 = Date.now();
  const r4 = await post('/api/v1/memories/extract-story-memories', {
    characterId: 'test-character-id',
    characterKey: 'justawoman',
    storyNumber: 1,
    storyTitle: r2.body?.title || 'Test Story',
    storyText: storyText.slice(0, 4000),
  });
  console.log('   Status:', r4.status, '| Time:', ((Date.now() - t4) / 1000).toFixed(1) + 's');
  if (r4.status === 200) {
    console.log('   Memories extracted:', r4.body.memories_extracted);
    console.log('   Pain points:', r4.body.pain_points?.length || 0);
    console.log('   Belief shifts:', r4.body.belief_shifts?.length || 0);
    console.log('   Therapy opening:', r4.body.therapy_opening?.slice(0, 100) || '(none)');
    console.log('   Fallback:', r4.body.fallback || false);
  } else {
    console.log('   ERROR:', JSON.stringify(r4.body).slice(0, 300));
  }

  console.log('\n=== ALL TESTS COMPLETE ===');
}

main().catch((e) => console.error('FATAL:', e.message));

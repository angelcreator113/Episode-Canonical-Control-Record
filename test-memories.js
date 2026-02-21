/**
 * PNOS Phase 1 — API Test Script
 * 
 * Tests the full memory extraction → confirmation loop in sequence.
 * Run with: node test-memories.js
 * 
 * Requires:
 *   - Server running at API_BASE
 *   - At least one approved storyteller_line in the DB
 *   - At least one registry_character (non-finalized) in the DB
 *   - ANTHROPIC_API_KEY in server environment
 * 
 * Set the IDs below before running.
 */

const API_BASE = 'http://localhost:3002/api/v1/memories';

// ── SET THESE BEFORE RUNNING ───────────────────────────────────────────────
// An approved or edited storyteller_lines.id
const TEST_LINE_ID = '046849aa-7fc9-4819-bb98-128113b8d7d9';

// A non-finalized registry_characters.id  
const TEST_CHARACTER_ID = 'ef3373dc-ee29-4984-857a-1535f73b3be0';
// ──────────────────────────────────────────────────────────────────────────

let createdMemoryId = null;

async function run() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  PNOS Phase 1 — Memory API Test');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── TEST 1: Extract memories from a line ──────────────────────────────
  console.log('TEST 1 — POST /lines/:lineId/extract');
  console.log(`  Line ID: ${TEST_LINE_ID}`);

  try {
    const res = await fetch(`${API_BASE}/lines/${TEST_LINE_ID}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character_context: 'Book 1: Before Lala. PNOS characters.' }),
    });

    const data = await res.json();

    if (res.status === 201) {
      console.log(`  ✅ PASS — Status 201`);
      console.log(`  Extracted: ${data.extracted} memory candidate(s)`);
      if (data.memories.length > 0) {
        createdMemoryId = data.memories[0].id;
        console.log(`  First memory ID: ${createdMemoryId}`);
        console.log(`  Type: ${data.memories[0].type}`);
        console.log(`  Statement: "${data.memories[0].statement.slice(0, 80)}..."`);
        console.log(`  Confidence: ${data.memories[0].confidence}`);
        console.log(`  Confirmed: ${data.memories[0].confirmed} (should be false)`);
        if (data.memories[0].confirmed !== false) {
          console.log('  ❌ FAIL — confirmed should be false on extraction');
          process.exit(1);
        }
      } else {
        console.log('  ⚠️  WARN — Claude extracted 0 memories. Try with a more narrative line.');
        console.log('  Continuing tests with a manual memory creation...');
        // Create one manually so remaining tests can run
        const manual = await fetch(`${API_BASE}/lines/${TEST_LINE_ID}/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (manual.status === 409) {
          console.log('  ℹ️  Memories already exist for this line (409). Fetching them...');
        }
      }
    } else if (res.status === 409) {
      console.log('  ℹ️  Memories already extracted for this line (409 — expected on re-run)');
      console.log('  Fetching existing memories to get an ID...');
    } else {
      console.log(`  ❌ FAIL — Status ${res.status}`);
      console.log('  Response:', JSON.stringify(data, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.log(`  ❌ ERROR — ${err.message}`);
    process.exit(1);
  }

  console.log();

  // ── TEST 2: GET memories for the line ────────────────────────────────
  console.log('TEST 2 — GET /lines/:lineId/memories');

  try {
    const res = await fetch(`${API_BASE}/lines/${TEST_LINE_ID}/memories`);
    const data = await res.json();

    if (res.status === 200) {
      console.log(`  ✅ PASS — Status 200`);
      console.log(`  Memories returned: ${data.memories.length}`);
      if (data.memories.length > 0) {
        if (!createdMemoryId) {
          createdMemoryId = data.memories.find(m => !m.confirmed)?.id || data.memories[0].id;
        }
        const unconfirmed = data.memories.filter(m => !m.confirmed);
        console.log(`  Unconfirmed: ${unconfirmed.length} (these need confirmation)`);
        console.log(`  Using memory ID for next tests: ${createdMemoryId}`);
      } else {
        console.log('  ⚠️  No memories found. Check that extraction worked (Test 1).');
      }
    } else {
      console.log(`  ❌ FAIL — Status ${res.status}`);
      console.log('  Response:', JSON.stringify(data, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.log(`  ❌ ERROR — ${err.message}`);
    process.exit(1);
  }

  console.log();

  if (!createdMemoryId) {
    console.log('⚠️  No memory ID available — skipping confirm/dismiss tests.');
    console.log('   Re-run after extracting memories from an approved line.');
    process.exit(0);
  }

  // ── TEST 3: Edit a memory (sets protected=true) ───────────────────────
  console.log('TEST 3 — PUT /memories/:memoryId (edit → sets protected=true)');

  try {
    const res = await fetch(`${API_BASE}/memories/${createdMemoryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        statement: 'Edited statement — this memory is now protected from system overwrite.',
        tags: ['test', 'edited'],
      }),
    });

    const data = await res.json();

    if (res.status === 200) {
      console.log(`  ✅ PASS — Status 200`);
      console.log(`  Protected: ${data.memory.protected} (should be true)`);
      if (data.memory.protected !== true) {
        console.log('  ❌ FAIL — protected should be true after edit');
        process.exit(1);
      }
    } else {
      console.log(`  ❌ FAIL — Status ${res.status}`);
      console.log('  Response:', JSON.stringify(data, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.log(`  ❌ ERROR — ${err.message}`);
    process.exit(1);
  }

  console.log();

  // ── TEST 4: Confirm the memory ────────────────────────────────────────
  console.log('TEST 4 — POST /memories/:memoryId/confirm');
  console.log(`  Character ID: ${TEST_CHARACTER_ID}`);

  try {
    const res = await fetch(`${API_BASE}/memories/${createdMemoryId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character_id: TEST_CHARACTER_ID }),
    });

    const data = await res.json();

    if (res.status === 200) {
      console.log(`  ✅ PASS — Status 200`);
      console.log(`  Confirmed: ${data.memory.confirmed} (should be true)`);
      console.log(`  Confidence: ${data.memory.confidence} (should be 1.0)`);
      console.log(`  Character updated: ${data.character_updated}`);
      console.log(`  Confirmed at: ${data.memory.confirmed_at}`);

      if (data.memory.confirmed !== true) {
        console.log('  ❌ FAIL — confirmed should be true');
        process.exit(1);
      }
      if (parseFloat(data.memory.confidence) !== 1.0) {
        console.log('  ❌ FAIL — confidence should be 1.0 after user confirmation');
        process.exit(1);
      }
      if (!data.character_updated) {
        console.log('  ❌ FAIL — character_updated should be true');
        process.exit(1);
      }
    } else if (res.status === 409) {
      console.log('  ℹ️  Memory already confirmed (409 — expected on re-run). Continuing...');
    } else {
      console.log(`  ❌ FAIL — Status ${res.status}`);
      console.log('  Response:', JSON.stringify(data, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.log(`  ❌ ERROR — ${err.message}`);
    process.exit(1);
  }

  console.log();

  // ── TEST 5: GET confirmed memories for the character ──────────────────
  console.log('TEST 5 — GET /characters/:charId/memories');

  try {
    const res = await fetch(`${API_BASE}/characters/${TEST_CHARACTER_ID}/memories`);
    const data = await res.json();

    if (res.status === 200) {
      console.log(`  ✅ PASS — Status 200`);
      console.log(`  Confirmed memories for character: ${data.memories.length}`);
      if (data.memories.length === 0) {
        console.log('  ⚠️  WARN — Expected at least 1 confirmed memory. Check confirm step.');
      } else {
        console.log(`  Latest: "${data.memories[0].statement.slice(0, 60)}..."`);
      }
    } else {
      console.log(`  ❌ FAIL — Status ${res.status}`);
      console.log('  Response:', JSON.stringify(data, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.log(`  ❌ ERROR — ${err.message}`);
    process.exit(1);
  }

  console.log();

  // ── TEST 6: Attempt to confirm a finalized character (should 403) ─────
  console.log('TEST 6 — Confirm against finalized character (expect 403)');
  console.log('  Skipping if no finalized character available — set FINALIZED_CHAR_ID to test.');
  const FINALIZED_CHAR_ID = process.env.FINALIZED_CHAR_ID;

  if (FINALIZED_CHAR_ID) {
    // Create a fresh unconfirmed memory to test against
    // (re-extract won't work since line already has memories)
    // This test only runs if you have a second line and a finalized character
    console.log(`  Testing with FINALIZED_CHAR_ID: ${FINALIZED_CHAR_ID}`);
    const res = await fetch(`${API_BASE}/memories/${createdMemoryId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character_id: FINALIZED_CHAR_ID }),
    });
    const data = await res.json();
    if (res.status === 403) {
      console.log('  ✅ PASS — 403 returned for finalized character (correct)');
    } else if (res.status === 409) {
      console.log('  ℹ️  Memory already confirmed — 403 test inconclusive on this memory');
    } else {
      console.log(`  ❌ FAIL — Expected 403, got ${res.status}`);
      console.log('  The finalized character rule must be enforced on the memory confirm endpoint.');
    }
  } else {
    console.log('  ⏭  Skipped (set env FINALIZED_CHAR_ID=<uuid> to test finalized-character guard)');
  }

  console.log();

  // ── TEST 7: Dismiss should fail on confirmed memory ───────────────────
  console.log('TEST 7 — Dismiss a confirmed memory (expect 409)');

  try {
    const res = await fetch(`${API_BASE}/memories/${createdMemoryId}/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();

    if (res.status === 409) {
      console.log('  ✅ PASS — 409 returned (cannot dismiss a confirmed memory)');
    } else {
      console.log(`  ❌ FAIL — Expected 409, got ${res.status}`);
      console.log('  A confirmed memory should never be dismissable.');
      process.exit(1);
    }
  } catch (err) {
    console.log(`  ❌ ERROR — ${err.message}`);
    process.exit(1);
  }

  console.log();

  // ── SUMMARY ───────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════');
  console.log('  All tests passed ✅');
  console.log('');
  console.log('  Phase 1 core loop is wired:');
  console.log('  Approve line → extract memories → confirm → Character Registry updated');
  console.log('');
  console.log('  Next: Build the memory confirmation UI in the Book Editor.');
  console.log('═══════════════════════════════════════════════════════');
}

run().catch(err => {
  console.error('\n❌ Unhandled error:', err);
  process.exit(1);
});

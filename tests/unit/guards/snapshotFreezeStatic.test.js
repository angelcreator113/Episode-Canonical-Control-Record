// ============================================================================
// A1.2a static guards (A1.2-SPEC-v5 §3, §4, §8a, §13 item 9). Read as text:
// nothing is run, no database is touched. They keep the freeze's definition
// true as the code changes:
//   - episodes.season_context is written in exactly four functions, each of
//     which asks the freeze guard after taking the episode lock;
//   - no code in src/ sets season_context to NULL (the late-context design
//     relies on "no context" never being re-created by the app);
//   - raw clips are never hard-deleted and updateClip cannot move a clip to
//     another episode (either would "un-freeze" an episode);
//   - PUT /episodes/:id cannot write season_context.
// ============================================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Migrations are owner-run schema history, not app code (spec §10).
      if (entry.name === 'migrations' || entry.name === 'node_modules') continue;
      walk(p, out);
    } else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}
const FILES = walk(SRC).map((p) => ({ rel: path.relative(ROOT, p), text: fs.readFileSync(p, 'utf8') }));

/** The name of the function a character offset sits in (the nearest declaration above it). */
function enclosingFunction(text, index) {
  const before = text.slice(0, index);
  const re = /(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g;
  let name = null;
  let m;
  while ((m = re.exec(before))) name = m[1];
  return name;
}

describe('episodes.season_context has exactly four writers', () => {
  // An assignment in SQL: "season_context = …" (not a comparison like "season_context IS NULL").
  const WRITE = /\bseason_context\s*=\s*(?!=)/g;
  const found = [];
  for (const f of FILES) {
    let m;
    while ((m = WRITE.exec(f.text))) found.push(`${f.rel}:${enclosingFunction(f.text, m.index)}`);
  }

  test('they are snapshotEpisode, snapshotSpecialEpisode, stampTwoPart and unstampTwoPart', () => {
    expect([...new Set(found)].sort()).toEqual([
      'src/services/seasonSlotService.js:snapshotEpisode',
      'src/services/seasonSpecials.js:snapshotSpecialEpisode',
      'src/services/seasonSpecials.js:stampTwoPart',
      'src/services/seasonSpecials.js:unstampTwoPart',
    ]);
  });

  test('no Sequelize write names season_context (no update({ season_context }) anywhere in src/)', () => {
    for (const f of FILES) {
      expect(`${f.rel}: ${/\.(update|create|upsert|bulkCreate)\([^)]*season_context\s*:/s.test(f.text)}`).toBe(`${f.rel}: false`);
    }
  });

  const fnText = (file, name) => {
    const text = FILES.find((f) => f.rel === file).text;
    const start = text.indexOf(`async function ${name}(`);
    expect(start).toBeGreaterThan(-1);
    const next = text.indexOf('\nasync function ', start + 10);
    return text.slice(start, next === -1 ? undefined : next);
  };
  test.each([
    ['src/services/seasonSlotService.js', 'snapshotEpisode', /snapshotFrozen\(/],
    ['src/services/seasonSpecials.js', 'snapshotSpecialEpisode', /snapshotFrozen\(/],
    ['src/services/seasonSpecials.js', 'stampTwoPart', /frozenStampUnchanged\(/],
    ['src/services/seasonSpecials.js', 'unstampTwoPart', /frozenStampUnchanged\(/],
  ])('%s %s locks the episode, then asks the freeze guard, before its UPDATE', (file, name, guard) => {
    const body = fnText(file, name);
    const lock = body.indexOf('lockEpisodes(');
    const ask = body.search(guard);
    const write = body.search(/season_context\s*=/);
    expect(lock).toBeGreaterThan(-1);
    expect(ask).toBeGreaterThan(lock);
    expect(write).toBeGreaterThan(ask);
  });

  test('frozenStampUnchanged asks snapshotFrozen', () => {
    expect(fnText('src/services/seasonSpecials.js', 'frozenStampUnchanged')).toMatch(/snapshotFrozen\(/);
  });
});

describe('nothing in the app sets season_context to NULL (§8a point 4)', () => {
  test.each(FILES.map((f) => [f.rel, f.text]))('%s', (_rel, text) => {
    expect(text).not.toMatch(/season_context\s*=\s*NULL\b/i);
    expect(text).not.toMatch(/season_context\s*:\s*null\b/);
  });
});

describe('raw clips are only soft-deleted and never change episode', () => {
  test('no hard delete of episode_raw_clips in src/ (SQL or a model destroy)', () => {
    for (const f of FILES) {
      expect(`${f.rel}: ${/DELETE\s+FROM\s+"?episode_raw_clips/i.test(f.text)}`).toBe(`${f.rel}: false`);
      expect(`${f.rel}: ${/TRUNCATE[^;]*episode_raw_clips/i.test(f.text)}`).toBe(`${f.rel}: false`);
    }
  });
  test('no UPDATE of episode_raw_clips sets episode_id', () => {
    for (const f of FILES) {
      const updates = f.text.match(/UPDATE\s+episode_raw_clips\s+SET[\s\S]{0,400}?WHERE/gi) || [];
      for (const u of updates) expect(`${f.rel}: ${/\bepisode_id\s*=/.test(u.split(/WHERE/i)[0])}`).toBe(`${f.rel}: false`);
    }
  });
  test("updateClip's field list (readFields) has no episode_id", () => {
    const text = FILES.find((f) => f.rel === 'src/services/rawClipsService.js').text;
    const start = text.indexOf('function readFields(');
    const body = text.slice(start, text.indexOf('\n}\n', start));
    expect(body).not.toMatch(/episode_id/);
  });
  test('the raw clip insert never moves an existing row (ON CONFLICT DO NOTHING)', () => {
    const text = FILES.find((f) => f.rel === 'src/services/rawClipsService.js').text;
    const insert = text.match(/INSERT INTO episode_raw_clips[\s\S]*?RETURNING/)[0];
    expect(insert).toMatch(/ON CONFLICT \(id\) DO NOTHING/);
  });
});

test('PUT /episodes/:id cannot write season_context (its allowlist)', () => {
  const text = FILES.find((f) => f.rel === 'src/controllers/episodeController.js').text;
  const start = text.indexOf('const allowedFields = {');
  const block = text.slice(start, text.indexOf('};', start));
  expect(block).toMatch(/season_number: true/);
  expect(block).not.toMatch(/season_context/);
});

test('there is no switch that turns the freeze off (A1-d: permanent; no env flag)', () => {
  const text = FILES.find((f) => f.rel === 'src/utils/snapshotFreeze.js').text;
  expect(text).not.toMatch(/process\.env/);
});

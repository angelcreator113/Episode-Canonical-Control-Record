'use strict';

/**
 * Static guards for the one script save (A1c R1;
 * docs/reads/2026-10-27-a1c-r1-spec.md §4.3). They read the source as text,
 * so a new writer that goes around services/scriptSave.js fails here before
 * it ships.
 *   1. Only scriptSave.js writes script_content, script_line_keys or
 *      script_seq (the save number, decisions 1 and 2, 2026-10-27).
 *   2. Only scriptSave.js calls snapshotScript.
 *   3. Only the files listed here refer to the version table (design R4.5:
 *      the first durable reference to a version row adds a reference
 *      provider that pruning consults, and is added here in the same PR).
 *   4. No R1 code writes script_line_keys.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const SAVE = 'src/services/scriptSave.js';

function files(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...files(rel));
    } else if (/\.(c|m)?js$/.test(entry.name)) out.push(rel);
  }
  return out;
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
// Comments out, so a comment that names a column is not a write.
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

// Migrations create and change the columns; models define them.
const SOURCES = [...files('src'), ...files('scripts')].filter((f) => !f.startsWith('src/migrations/') && !f.startsWith('src/models/'));

const COLUMN = 'script_(?:content|line_keys|seq)';
const WRITES = [
  // an update or save whose values name the column: Model.update({ ... }), row.update({ ... }), row.set('...')
  new RegExp(`\\.(?:update|upsert|bulkCreate|set)\\(\\s*\\{[^}]*\\b${COLUMN}\\b`, 's'),
  new RegExp(`\\.set\\(\\s*['"]${COLUMN}['"]`),
  // raw SQL: UPDATE ... SET script_content = / INSERT INTO episodes (... script_content ...)
  new RegExp(`\\bSET\\b[^;\`]*\\b${COLUMN}\\s*=`, 'i'),
  new RegExp(`INSERT\\s+INTO\\s+"?episodes"?\\s*\\([^)]*\\b${COLUMN}\\b`, 'i'),
  // an assignment to a model instance's column
  new RegExp(`\\b(?:episode|row|ep|record|freshEpisode|episodeForGuard)\\.${COLUMN}\\s*=(?!=)`),
];

// Plain objects the code builds and passes to the save, never to a model:
// updateEpisode's updateData has its script removed before episode.update
// (src/controllers/episodeController.js, "The other fields; the script is
// already written.").
const ALLOWED_ASSIGNMENTS = [
  { file: 'src/controllers/episodeController.js', re: /updateData\.script_content\s*=(?!=)/g },
];

describe('A1c R1 static guards', () => {
  test('1. only scriptSave.js writes script_content, script_line_keys or script_seq', () => {
    const offenders = [];
    for (const f of SOURCES) {
      if (f === SAVE) continue;
      let text = code(read(f));
      for (const a of ALLOWED_ASSIGNMENTS) if (a.file === f) text = text.replace(a.re, '');
      for (const re of WRITES) if (re.test(text)) offenders.push(`${f}: ${re}`);
      if (new RegExp(`\\b${COLUMN}\\s*=(?!=)`).test(text.replace(/\bconst\s*\{[^}]*\}\s*=/g, ''))) offenders.push(`${f}: assignment`);
    }
    expect(offenders).toEqual([]);
  });

  test('1a. the controller hands the script to the save, not to episode.update', () => {
    const text = read('src/controllers/episodeController.js');
    expect(text).toContain('const { script_content: _script, ...rest } = updateData;');
    expect(text).toContain('await episode.update(rest, { transaction })');
  });

  test('1b. the guard sees a write: it catches each form it looks for', () => {
    const samples = [
      'await episode.update({ script_content: next });',
      'await models.Episode.update({ title, script_line_keys: k }, { where });',
      "row.set('script_content', x);",
      'UPDATE episodes SET script_content = :s WHERE id = :id',
      'INSERT INTO episodes (id, script_content) VALUES (1, 2)',
      'episode.script_content = text;',
    ];
    for (const s of samples) expect(WRITES.some((re) => re.test(s))).toBe(true);
    expect(WRITES.some((re) => re.test('const t = episode.script_content === x;'))).toBe(false);
  });

  test('2. only scriptSave.js calls snapshotScript', () => {
    const callers = SOURCES.filter((f) => f !== SAVE && f !== 'src/services/scriptVersions.js' && /\bsnapshotScript\s*\(/.test(code(read(f))));
    expect(callers).toEqual([]);
    expect(code(read(SAVE))).toMatch(/snapshotScript\([^)]*strict:\s*true/);
  });

  test('3. the version table is referred to only where listed', () => {
    // file → why it may refer to the version rows. None holds a durable reference to one.
    const ALLOWED = {
      'src/services/scriptVersions.js': 'keeps, lists, reads and prunes them (the only deleter)',
      'src/services/scriptSave.js': 'reads a version to tell a genuine restore (C9)',
      'src/services/characterVoice.js': 'reads version text to learn Lala\'s voice; stores no version id',
      'src/models/EpisodeScriptVersion.js': 'the model',
      'src/models/index.js': 'registers the model',
      'src/migrations/20261015100000-create-episode-script-versions.js': 'creates the table',
      'src/migrations/20261026190000-add-script-line-keys.js': 'A1a: adds the nullable column',
    };
    const all = [...files('src'), ...files('scripts')];
    const referring = all.filter((f) => /EpisodeScriptVersion|episode_script_versions/.test(read(f))).sort();
    expect(referring).toEqual(Object.keys(ALLOWED).sort());
  });

  test('4. R1 writes no line identity: the save never names script_line_keys in an update', () => {
    const save = code(read(SAVE));
    expect(save).toMatch(/const IDENTITY_WRITES = false;/);
    expect(save).not.toMatch(/script_line_keys\s*:/);
    expect(save).not.toMatch(/update\.script_line_keys|\['script_line_keys'\]\s*=/);
    // R1 adds no migration, and no later migration touches the episode's
    // line identity. Later migrations are listed with the change that
    // approved them; none of them names script_line_keys.
    const LATER = {
      'src/migrations/20261027190000-add-episode-script-seq.js': 'A1c correction (Evoni, 2026-10-27): the script save number',
      'src/migrations/20261027200000-create-voice-studio-tables.js': 'Voice Studio B1 (Evoni, 2026-10-27): new tables only',
      'src/migrations/20261028100000-create-episode-edit-tables.js': 'Timeline C1 (Evoni, 2026-10-28): new tables only',
      'src/migrations/20261028120000-add-episode-raw-clips-end-beat-number.js': 'Clip range (Evoni, 2026-10-28): one column on episode_raw_clips',
    };
    const migrations = files('src/migrations').filter((f) => /\/2026102[7-9]|\/20261[1-2]|\/2027/.test(f));
    expect(migrations.sort()).toEqual(Object.keys(LATER).sort());
    for (const f of migrations) expect(read(f)).not.toMatch(/script_line_keys/);
  });

  test('5. the save number: the save adds one only when the text changed, inside its transaction', () => {
    const save = code(read(SAVE));
    expect(save.match(/script_seq = script_seq \+ 1/g)).toHaveLength(1);
    // A BIGINT: read as text, never turned into a JavaScript number.
    expect(save).toMatch(/RETURNING script_seq::text AS script_seq/);
    expect(save).not.toMatch(/(Number|parseInt|parseFloat)\([^)]*script_?seq/i);
    expect(save).toMatch(/const scriptSeq = update\.script_content !== undefined \? await nextScriptSeq\(Episode\.sequelize, row\.id, t\) : null;/);
    // 1b's forms catch a write of it elsewhere.
    expect(WRITES.some((re) => re.test('UPDATE episodes SET script_seq = 3 WHERE id = 1'))).toBe(true);
    expect(WRITES.some((re) => re.test('await episode.update({ script_seq: 9 });'))).toBe(true);
  });
});

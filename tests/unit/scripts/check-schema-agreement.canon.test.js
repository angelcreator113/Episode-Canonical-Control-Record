/**
 * Task #1924 — step 2 of scripts/check-schema-agreement.js compares a model
 * whose table no live migration creates with the canon capture.
 *
 * EpisodeWardrobe declared four columns production lacked, and step 2 only
 * said `EpisodeWardrobe - no-table`: with no createTable in the live tree
 * there was nothing to compare its columns with. Now a NOTABLE or ALTERONLY
 * model is compared with the capture's columns plus what live migrations add,
 * and each declared column found in neither is keyed canon-missing-column.
 *
 * Task #2087: a live migration now creates episode_wardrobe
 * (20260927000000-create-episode-wardrobe.js), so EpisodeWardrobe is compared
 * with the migration tree, not the capture. The comparison's behaviour is
 * pinned on ContinuityBeat, which the capture lists.
 *
 * Runtime DDL removal (#3711, 2026-11-04): migration 20261104200000 now
 * creates continuity_beats, so in the live tree ContinuityBeat is compared
 * with the migration tree too (last test). The canon comparison is still
 * pinned on ContinuityBeat, against a fixture root: the live tree without
 * that one migration, where ContinuityBeat is only altered (it adds
 * deleted_at). No other model the capture lists declares a column a live
 * migration adds, so none could stand in for it.
 *
 * Runs the checker with --json. Static read: no database.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const CAPTURE = path.join(ROOT, 'docs', 'audit', 'EvidenceNote_Canon_Schema_Capture_2026-09-17.txt');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-agreement-canon-'));

function run(extra, name) {
  const out = path.join(TMP, `${name}.json`);
  execFileSync(process.execPath, ['scripts/check-schema-agreement.js', '--json', out, ...extra], {
    cwd: ROOT, stdio: 'pipe', env: { ...process.env, NODE_ENV: 'test' },
  });
  return JSON.parse(fs.readFileSync(out, 'utf8')).step2;
}

// The live tree without 20261104200000 (links, no copies): src/ as it is,
// src/migrations/ without the one file that creates the continuity tables.
const FIXTURE = path.join(TMP, 'root-before-3711');
fs.mkdirSync(path.join(FIXTURE, 'src', 'migrations'), { recursive: true });
for (const e of fs.readdirSync(path.join(ROOT, 'src'))) {
  if (e !== 'migrations') fs.symlinkSync(path.join(ROOT, 'src', e), path.join(FIXTURE, 'src', e));
}
for (const f of fs.readdirSync(path.join(ROOT, 'src', 'migrations'))) {
  if (f !== '20261104200000-create-runtime-created-tables.js') {
    fs.symlinkSync(path.join(ROOT, 'src', 'migrations', f), path.join(FIXTURE, 'src', 'migrations', f));
  }
}
const atFixture = (extra) => ['--root', FIXTURE, '--step2-capture', CAPTURE, ...extra];

let canon; let withoutNotes; let withoutDeletedAt; let off; let live;
beforeAll(() => {
  live = run([], 'live');
  canon = run(atFixture([]), 'canon');
  // The same capture with continuity_beats.note taken out.
  const trimmed = path.join(TMP, 'capture-without-note.txt');
  fs.writeFileSync(trimmed, fs.readFileSync(CAPTURE, 'utf8').split('\n')
    .filter((l) => !/^\s*continuity_beats\s*\|\s*note\s*\|/.test(l)).join('\n'));
  withoutNotes = run(['--root', FIXTURE, '--step2-capture', trimmed], 'without-note');
  // The same capture with continuity_beats.deleted_at taken out: a live
  // migration adds that column, so it must still count as present.
  const trimmedDeleted = path.join(TMP, 'capture-without-deleted-at.txt');
  fs.writeFileSync(trimmedDeleted, fs.readFileSync(CAPTURE, 'utf8').split('\n')
    .filter((l) => !/^\s*continuity_beats\s*\|\s*deleted_at\s*\|/.test(l)).join('\n'));
  withoutDeletedAt = run(['--root', FIXTURE, '--step2-capture', trimmedDeleted], 'without-deleted-at');
  off = run(['--step2-capture', 'none'], 'off');
}, 120000);

const keys = (s2) => (s2.canonMissing || []).map((x) => `${x.model}.${x.column}`);

test('an ALTERONLY model (ContinuityBeat) is compared with canon, and every column it declares is there', () => {
  expect(canon.canonCompared.map((x) => x.model)).toContain('ContinuityBeat');
  expect(keys(canon).filter((k) => k.startsWith('ContinuityBeat.'))).toEqual([]);
});

test('a declared column absent from the capture and from live migrations is reported', () => {
  expect(keys(withoutNotes)).toContain('ContinuityBeat.note');
  expect(keys(withoutNotes).length).toBe(keys(canon).length + 1);
});

test('a column a live migration adds counts as present even when the capture lacks it (deleted_at)', () => {
  expect(keys(withoutDeletedAt)).not.toContain('ContinuityBeat.deleted_at');
  expect(keys(withoutDeletedAt).length).toBe(keys(canon).length);
});

test('EpisodeWardrobe: a live migration creates its table (Task #2087), so it is compared with the migration tree, and nothing is missing', () => {
  expect(live.canonCompared.map((x) => x.model)).not.toContain('EpisodeWardrobe');
  expect(live.noTable.map((x) => x.model)).not.toContain('EpisodeWardrobe');
  expect(live.alteredOnly.map((x) => x.model)).not.toContain('EpisodeWardrobe');
  expect(live.missing.filter((x) => x.model === 'EpisodeWardrobe')).toEqual([]);
});

test('ContinuityBeat in the live tree: 20261104200000 creates its table (#3711), so it is compared with the migration tree, and nothing is missing', () => {
  expect(live.canonCompared.map((x) => x.model)).not.toContain('ContinuityBeat');
  expect(live.noTable.map((x) => x.model)).not.toContain('ContinuityBeat');
  expect(live.alteredOnly.map((x) => x.model)).not.toContain('ContinuityBeat');
  expect(live.missing.filter((x) => x.model === 'ContinuityBeat')).toEqual([]);
});

test('--step2-capture none turns the comparison off', () => {
  expect(off.canonCompared).toEqual([]);
  expect(off.canonMissing).toEqual([]);
});

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

let canon; let withoutNotes; let off;
beforeAll(() => {
  canon = run([], 'canon');
  // The same capture with episode_wardrobe.notes taken out.
  const trimmed = path.join(TMP, 'capture-without-notes.txt');
  fs.writeFileSync(trimmed, fs.readFileSync(CAPTURE, 'utf8').split('\n')
    .filter((l) => !/^\s*episode_wardrobe\s*\|\s*notes\s*\|/.test(l)).join('\n'));
  withoutNotes = run(['--step2-capture', trimmed], 'without-notes');
  off = run(['--step2-capture', 'none'], 'off');
}, 120000);

const keys = (s2) => (s2.canonMissing || []).map((x) => `${x.model}.${x.column}`);

test('EpisodeWardrobe is compared with canon, and every column it declares is there', () => {
  // On main there is no canon comparison at all (step2.canonMissing is absent).
  expect(canon.canonCompared.map((x) => x.model)).toContain('EpisodeWardrobe');
  expect(keys(canon).filter((k) => k.startsWith('EpisodeWardrobe.'))).toEqual([]);
});

test('a declared column absent from the capture and from live migrations is reported', () => {
  expect(keys(withoutNotes)).toContain('EpisodeWardrobe.notes');
  expect(keys(withoutNotes).length).toBe(keys(canon).length + 1);
});

test('a column a live migration adds counts as present (approval_status is not in canon)', () => {
  const fixture = fs.readFileSync(CAPTURE, 'utf8');
  expect(fixture).not.toMatch(/^\s*episode_wardrobe\s*\|\s*approval_status\s*\|/m);
  expect(keys(canon)).not.toContain('EpisodeWardrobe.approval_status');
});

test('--step2-capture none turns the comparison off', () => {
  expect(off.canonCompared).toEqual([]);
  expect(off.canonMissing).toEqual([]);
});

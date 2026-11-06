// ============================================================================
// D-21: scripts/deploy/release-summary.sh against a throwaway git repository
// with squash-style commits. Nothing outside the temp directory is touched.
// ============================================================================
const { spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', '..', '..', 'scripts', 'deploy', 'release-summary.sh');
let dir;
const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
function commit(subject, files) {
  for (const [f, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), body);
  }
  git('add', '-A');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', subject);
  return git('rev-parse', 'HEAD');
}
const run = (...args) => {
  const r = spawnSync('bash', [SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};

let base; let mid; let target;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-summary-'));
  git('init', '-q');
  base = commit('fix(episodes): base work [skip-automerge] (#3726)', { 'src/a.js': '1' });
  mid = commit('fix(scenes): beat sync [skip-automerge] (#3727)', { 'src/b.js': '1', 'src/migrations/20261107000000-new.js': 'x' });
  target = commit('fix(security): containment [skip-automerge] (#3730)', { 'frontend/src/x.jsx': '1' });
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

test('lists every commit since the base with its PR, the new migrations and frontend changes', () => {
  const r = run(base, target);
  expect(r.code).toBe(0);
  expect(r.out).toMatch(/\*\*Commits:\*\* 2/);
  expect(r.out).toMatch(/\| #3727 \| fix\(scenes\): beat sync/);
  expect(r.out).toMatch(/\| #3730 \| fix\(security\): containment/);
  expect(r.out).not.toMatch(/#3726/);
  expect(r.out).toMatch(/\*\*New migrations:\*\* 1/);
  expect(r.out).toMatch(/20261107000000-new\.js/);
  expect(r.out).toMatch(/\*\*Frontend files changed:\*\* 1/);
  expect(r.out.trim().split('\n').pop()).toBe(`RELEASE_BASE=${base}`);
});

test('expected_prs that match exactly pass, in any order or with #', () => {
  expect(run(base, target, '3730, #3727').code).toBe(0);
});

test('an extra PR in the range fails (exit 3) and names it', () => {
  const r = run(base, target, '3727');
  expect(r.code).toBe(3);
  expect(r.out).toMatch(/not expected: 3730/);
});

test('an expected PR absent from the range fails (exit 3) and names it', () => {
  const r = run(base, target, '3727,3730,3728');
  expect(r.code).toBe(3);
  expect(r.out).toMatch(/absent: 3728/);
});

test('a base that is not an ancestor of the target fails (exit 1)', () => {
  expect(run(target, mid).code).toBe(1);
});

test('an unknown base lists the recent commits; with expected_prs it fails as unverifiable', () => {
  const r = run('', target);
  expect(r.code).toBe(0);
  expect(r.out).toMatch(/Production now:\*\* unknown/);
  expect(r.out.trim().split('\n').pop()).toBe('RELEASE_BASE=');
  expect(run('', target, '3730').code).toBe(3);
});

test('a target that is not a commit fails (exit 1)', () => {
  expect(run(base, 'f'.repeat(40)).code).toBe(1);
});

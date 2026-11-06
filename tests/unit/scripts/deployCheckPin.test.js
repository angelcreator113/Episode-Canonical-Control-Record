// ============================================================================
// D-21: scripts/deploy/check-pin.sh, run under bash. Nothing else is touched.
// Review (Evoni, 2026-11-06): an unknown baseline fails closed with an
// explicit recovery (baseline_sha), and a box already at the target passes
// only on its own deploy record, never on the commit alone.
// ============================================================================
const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', '..', '..', 'scripts', 'deploy', 'check-pin.sh');
const run = (...args) => {
  const r = spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};
const A = 'a'.repeat(40); // target
const B = 'b'.repeat(40); // summary base (last successful deploy)
const C = 'c'.repeat(40); // somewhere else

describe('check-pin.sh pin', () => {
  test('an exact match passes', () => {
    expect(run('pin', A, A)).toMatchObject({ code: 0 });
  });
  test('a mismatch fails and names both commits', () => {
    const r = run('pin', A, B);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(new RegExp(`main is at ${B}, not the expected ${A}`));
    expect(r.out).toMatch(/Nothing was built or changed/);
  });
  test.each([
    ['empty', ''],
    ['short', 'abc1234'],
    ['uppercase', A.toUpperCase()],
    ['41 characters', `${A}a`],
    ['injection-shaped', `${A}; echo hi`],
  ])('an expected_sha that is %s fails', (_label, value) => {
    expect(run('pin', value, A).code).toBe(1);
  });
});

describe('check-pin.sh resolve (the release summary base; fails closed)', () => {
  test('a found last successful run is the base', () => {
    const r = run('resolve', '1', B, '');
    expect(r.code).toBe(0);
    expect(r.out).toMatch(new RegExp(`^BASE=${B}$`, 'm'));
    expect(r.out).toMatch(/^SOURCE=deploy-run$/m);
  });
  test('baseline_sha equal to the found run is accepted', () => {
    expect(run('resolve', '1', B, B).code).toBe(0);
  });
  test('baseline_sha that contradicts the found run fails and names both', () => {
    const r = run('resolve', '1', B, C);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(new RegExp(`baseline_sha ${C} contradicts the last successful Deploy run, which deployed ${B}`));
    expect(r.out).not.toMatch(/^BASE=/m);
  });
  test('no successful run found and no baseline_sha: fails closed, with the recovery', () => {
    const r = run('resolve', '1', '', '');
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/baseline is unknown \(no successful Deploy run on main was found\)/);
    expect(r.out).toMatch(/start a new run with that commit as baseline_sha/);
    expect(r.out).not.toMatch(/^BASE=/m);
  });
  test('a failed lookup is never read as "no earlier run": fails closed', () => {
    const r = run('resolve', '0', '', '');
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/the lookup of the last successful Deploy run failed/);
  });
  test('a failed lookup ignores whatever it printed', () => {
    expect(run('resolve', '0', B, '').code).toBe(1);
  });
  test('an unknown baseline with baseline_sha uses it, labelled as given, with a warning', () => {
    const r = run('resolve', '0', '', C);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(new RegExp(`^BASE=${C}$`, 'm'));
    expect(r.out).toMatch(/^SOURCE=given$/m);
    expect(r.out).toMatch(/::warning::/);
  });
  test.each([['short', 'abc'], ['injection-shaped', `${B}; echo hi`]])('a baseline_sha that is %s fails', (_l, v) => {
    expect(run('resolve', '0', '', v).code).toBe(1);
    expect(run('resolve', '1', B, v).code).toBe(1);
  });
  test('a malformed found commit fails', () => {
    expect(run('resolve', '1', 'nope', '').code).toBe(1);
  });
});

describe('check-pin.sh base (production at the summary base)', () => {
  test('production at the summary base passes', () => {
    expect(run('base', B, B, A, 'none', '').code).toBe(0);
  });
  test('a re-deploy of the last successfully deployed commit (box = base = target) passes', () => {
    expect(run('base', A, A, A, 'none', '').code).toBe(0);
  });
  test('production elsewhere fails and names both commits', () => {
    const r = run('base', C, B, A, 'none', '');
    expect(r.code).toBe(1);
    expect(r.out).toMatch(new RegExp(`Production is at ${C}, but the release summary .* computed from ${B}`));
  });
  test('an empty base fails closed (never a notice and a pass)', () => {
    const r = run('base', B, '', A, 'none', '');
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/had no baseline/);
    expect(r.out).not.toMatch(/::notice::/);
  });
  test('a malformed box, base or target commit fails', () => {
    expect(run('base', 'nope', B, A, 'none', '').code).toBe(1);
    expect(run('base', B, 'nope', A, 'none', '').code).toBe(1);
    expect(run('base', B, B, 'nope', 'none', '').code).toBe(1);
  });
});

describe('check-pin.sh base: a box already at the target (a resume) needs its deploy record', () => {
  test('at the target with no record: fails; the commit alone is not proof', () => {
    const r = run('base', A, B, A, 'none', '');
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/An equal commit is not proof the deploy happened or finished/);
  });
  test('at the target, unfinished from the summary base (tree moved, restart not done): passes', () => {
    const r = run('base', A, B, A, 'unfinished', B);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/restart did not succeed \(the API still runs/);
  });
  test('at the target, finished from the summary base (restart done, run did not finish): passes', () => {
    const r = run('base', A, B, A, 'finished', B);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/verifies it again/);
  });
  test.each(['unfinished', 'finished'])('at the target, %s but from another commit: fails', (stage) => {
    const r = run('base', A, B, A, stage, C);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(new RegExp(`coming from ${C}, not from the release summary's base ${B}`));
  });
  test.each(['unfinished', 'finished'])('at the target, %s with a malformed or missing from: fails', (stage) => {
    expect(run('base', A, B, A, stage, '').code).toBe(1);
    expect(run('base', A, B, A, stage, 'nope').code).toBe(1);
  });
  test('an unknown stage word is treated as no record', () => {
    expect(run('base', A, B, A, 'done', B).code).toBe(1);
  });
  test('an earlier unfinished deploy from the base, carried into a newer target: passes', () => {
    // Box at C (unfinished, from B); this run deploys A; the summary B..A covers C.
    expect(run('base', C, B, A, 'unfinished', B).code).toBe(0);
  });
});

test('an unknown mode is a usage error', () => {
  expect(run('other').code).toBe(2);
});

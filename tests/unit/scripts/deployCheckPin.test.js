// ============================================================================
// D-21: scripts/deploy/check-pin.sh, run under bash. Nothing else is touched.
// ============================================================================
const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', '..', '..', 'scripts', 'deploy', 'check-pin.sh');
const run = (...args) => {
  const r = spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);

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

describe('check-pin.sh base', () => {
  test('production at the summary base passes', () => {
    expect(run('base', B, B, A, '0').code).toBe(0);
  });
  test('production elsewhere fails and names both commits', () => {
    const r = run('base', C, B, A, '0');
    expect(r.code).toBe(1);
    expect(r.out).toMatch(new RegExp(`Production is at ${C}, but the release summary .* computed from ${B}`));
  });
  test('a re-run whose box is already at the target passes', () => {
    expect(run('base', A, B, A, '1').code).toBe(0);
  });
  test('resume=1 does not excuse a box that is neither the base nor the target', () => {
    expect(run('base', C, B, A, '1').code).toBe(1);
  });
  test('no earlier successful deploy (empty base) passes with a notice', () => {
    const r = run('base', B, '', A, '0');
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/::notice::/);
  });
  test('a malformed box or target commit fails', () => {
    expect(run('base', 'nope', B, A, '0').code).toBe(1);
    expect(run('base', B, B, 'nope', '0').code).toBe(1);
  });
});

test('an unknown mode is a usage error', () => {
  expect(run('other').code).toBe(2);
});

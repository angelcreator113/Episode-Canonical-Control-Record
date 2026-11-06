// ============================================================================
// D-21 review (Evoni, 2026-11-06): the on-box deploy records that let a re-run
// be judged on what actually happened, not on the commit alone.
//   ~/.episode-deploy-unfinished  "<from> <to>"  tree moved, restart not done
//   ~/.episode-deploy-finished    "<from> <to>"  restart on <to> succeeded
// The script is never run whole: its functions are cut out and run in bash
// against a throwaway HOME. No host, AWS, database or network is touched.
// ============================================================================
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const TEXT = fs.readFileSync(path.join(ROOT, 'scripts', 'deploy', 'workflow-deploy.sh'), 'utf8');
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);

function fn(name) {
  const m = new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}\\n`, 'm').exec(TEXT);
  if (!m) throw new Error(`${name}() not found`);
  return m[0];
}
let home;
beforeEach(() => { home = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-stage-')); });
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));
const marker = (s) => fs.writeFileSync(path.join(home, '.episode-deploy-unfinished'), s);
const finished = (s) => fs.writeFileSync(path.join(home, '.episode-deploy-finished'), s);
const sh = (body) => {
  const r = spawnSync('bash', ['-c', [
    'set -euo pipefail', fn('box_stage_of'), fn('marker_from_for'),
    'DEPLOY_MARKER="$HOME/.episode-deploy-unfinished"; DEPLOY_FINISHED="$HOME/.episode-deploy-finished"',
    body,
  ].join('\n')], { env: { PATH: process.env.PATH, HOME: home }, encoding: 'utf8' });
  return { code: r.status, out: r.stdout.trim(), err: r.stderr };
};

describe('box_stage_of', () => {
  test('no records: none', () => {
    expect(sh(`box_stage_of ${A}`).out).toBe('none -');
  });
  test('the unfinished marker naming this commit: unfinished, with its from', () => {
    marker(`${B} ${A}\n`);
    expect(sh(`box_stage_of ${A}`).out).toBe(`unfinished ${B}`);
  });
  test('the unfinished marker naming another commit is not evidence', () => {
    marker(`${B} ${C}\n`);
    expect(sh(`box_stage_of ${A}`).out).toBe('none -');
  });
  test('the finished record naming this commit: finished, with its from', () => {
    finished(`${B} ${A}\n`);
    expect(sh(`box_stage_of ${A}`).out).toBe(`finished ${B}`);
  });
  test('the unfinished marker wins over a finished record for the same commit', () => {
    finished(`${C} ${A}\n`);
    marker(`${B} ${A}\n`);
    expect(sh(`box_stage_of ${A}`).out).toBe(`unfinished ${B}`);
  });
  test.each([['empty', ''], ['one word', `${A}\n`], ['malformed from', `nope ${A}\n`], ['garbage', 'x y z\n']])(
    'a %s record is not evidence', (_l, body) => {
      marker(body);
      finished(body);
      expect(sh(`box_stage_of ${A}`).out).toBe('none -');
    },
  );
});

describe('marker_from_for: the commit the API still runs', () => {
  test('a box with no unfinished deploy: the head itself', () => {
    expect(sh(`marker_from_for ${A}`).out).toBe(A);
  });
  test('a box left unfinished from B: B is kept across the chain', () => {
    marker(`${B} ${A}\n`);
    expect(sh(`marker_from_for ${A}`).out).toBe(B);
  });
  test('a finished record does not change it', () => {
    finished(`${B} ${A}\n`);
    expect(sh(`marker_from_for ${A}`).out).toBe(A);
  });
});

describe('where the phases use them', () => {
  const phase = (name) => fn(`phase_${name}`);
  test('plan reports the record for the box commit right after PLAN_OLD_SHA, on the resume path too', () => {
    const plan = phase('plan');
    const old = plan.indexOf('echo "PLAN_OLD_SHA=$old"');
    const stage = plan.indexOf('echo "PLAN_BOX_STAGE=$box_stage"');
    expect(old).toBeGreaterThan(-1);
    expect(stage).toBeGreaterThan(old);
    expect(stage).toBeLessThan(plan.indexOf('echo "PLAN_RESUME=1"'));
    expect(plan).toMatch(/read -r box_stage box_from < <\(box_stage_of "\$old"\)/);
  });
  test('restart writes the finished record whole, after every refusal, before clearing the marker', () => {
    const restart = phase('restart');
    const write = restart.indexOf('mv -f "$DEPLOY_FINISHED.new" "$DEPLOY_FINISHED"');
    expect(write).toBeGreaterThan(restart.lastIndexOf('die '));
    expect(write).toBeLessThan(restart.indexOf('rm -f "$DEPLOY_MARKER" "$DEPLOY_MIGRATED"'));
    expect(write).toBeLessThan(restart.indexOf('RESTART_OK=1'));
  });
  test('migrate never touches either record', () => {
    expect(phase('migrate')).not.toMatch(/DEPLOY_MARKER|DEPLOY_FINISHED/);
  });
  test('the whole script parses', () => {
    const r = spawnSync('bash', ['-n'], { input: TEXT, encoding: 'utf8' });
    expect(r.status).toBe(0);
  });
});

describe('restart records what happened (end to end through the two functions)', () => {
  const finish = (target) => sh([
    `TARGET=${target}`,
    'read -r stage from < <(box_stage_of "$TARGET")',
    'if [ "$stage" = "none" ]; then from="$TARGET"; fi',
    'printf \'%s %s\\n\' "$from" "$TARGET" >"$DEPLOY_FINISHED.new"',
    'mv -f "$DEPLOY_FINISHED.new" "$DEPLOY_FINISHED"',
    'rm -f "$DEPLOY_MARKER"',
    'box_stage_of "$TARGET"',
  ].join('\n'));
  test('after an unfinished deploy from B to A: finished from B', () => {
    marker(`${B} ${A}\n`);
    expect(finish(A).out).toBe(`finished ${B}`);
  });
  test('a re-deploy of A with no marker keeps the earlier finished record', () => {
    finished(`${B} ${A}\n`);
    expect(finish(A).out).toBe(`finished ${B}`);
  });
  test('the restart steps in phase_restart are the ones this test runs', () => {
    const restart = fn('phase_restart');
    expect(restart).toContain('read -r stage from < <(box_stage_of "$TARGET")');
    expect(restart).toContain('if [ "$stage" = "none" ]; then from="$TARGET"; fi');
    expect(restart).toContain('printf \'%s %s\\n\' "$from" "$TARGET" >"$DEPLOY_FINISHED.new"');
  });
});

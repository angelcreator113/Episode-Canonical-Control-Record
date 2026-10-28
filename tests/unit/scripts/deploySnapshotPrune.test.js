// ============================================================================
// The Deploy workflow removes older deploy-* snapshots before taking its own
// (Evoni, 2026-10-22: runs #145 and #146 stopped at the snapshot with
// SnapshotQuotaExceeded, "cannot create more than 100 manual snapshots").
// ============================================================================
// scripts/deploy/prune-snapshots.sh is run here against a fake `aws` on PATH
// that records its calls; no AWS account, host or database is touched. The
// workflow is read as text for where it runs the script.
// ============================================================================

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'deploy', 'prune-snapshots.sh');
const WORKFLOW = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
const RUNBOOK = fs.readFileSync(path.join(ROOT, 'docs', 'runbooks', 'deploy-workflow.md'), 'utf8');

// Lists FAKE_JSON for describe-db-snapshots (or fails when FAKE_LIST_FAIL is
// set); for delete-db-snapshot, records the id and fails for FAKE_DENY (every
// id) or FAKE_FAIL (a comma-separated list of ids).
const FAKE_AWS = `#!/usr/bin/env bash
echo "$*" >>"$CALLS"
case "$2" in
  describe-db-snapshots)
    if [ -n "\${FAKE_LIST_FAIL:-}" ]; then echo "An error occurred (Throttling)" >&2; exit 255; fi
    printf '%s\\n' "$FAKE_JSON" ;;
  delete-db-snapshot)
    id="$4"
    if [ -n "\${FAKE_DENY:-}" ]; then echo "An error occurred (AccessDenied) when calling the DeleteDBSnapshot operation: not authorized" >&2; exit 254; fi
    case ",\${FAKE_FAIL:-}," in *",$id,"*) echo "An error occurred (InvalidDBSnapshotState)" >&2; exit 254 ;; esac
    echo "$id" ;;
  *) echo "unexpected: $*" >&2; exit 2 ;;
esac
`;

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-prune-'));
  fs.mkdirSync(path.join(tmp, 'bin'));
  fs.writeFileSync(path.join(tmp, 'bin', 'aws'), FAKE_AWS, { mode: 0o755 });
});
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

const NOW = Date.parse('2026-10-28T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
// n snapshots, newest first: index i was made (i + 1) * 2 days ago (all past the 7-day minimum from index 3).
const snaps = (n, { start = 0 } = {}) => Array.from({ length: n }, (_, i) => ({
  id: `deploy-${(start + i).toString(16).padStart(12, '0')}-${9000 - start - i}-1`,
  created: new Date(NOW - (start + i + 1) * 2 * DAY).toISOString(),
  tags: [],
}));
const ids = (list) => list.map((x) => x.id);
const shuffle = (list) => [...list].reverse();

function prune(list, env = {}) {
  const calls = path.join(tmp, 'calls');
  const output = path.join(tmp, 'github_output');
  fs.rmSync(calls, { force: true });
  fs.rmSync(output, { force: true });
  const res = spawnSync('bash', [SCRIPT], {
    env: {
      PATH: `${path.join(tmp, 'bin')}:${process.env.PATH}`,
      RDS_INSTANCE_ID: 'episode-control-dev',
      CALLS: calls,
      GITHUB_OUTPUT: output,
      NOW_EPOCH: String(NOW / 1000),
      DRY_RUN: '0',
      FAKE_JSON: typeof list === 'string' ? list : JSON.stringify(list),
      ...env,
    },
    encoding: 'utf8',
  });
  const lines = fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean) : [];
  const out = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '';
  return {
    status: res.status,
    stdout: res.stdout + res.stderr,
    deleted: lines.filter((l) => l.startsWith('rds delete-db-snapshot')).map((l) => l.split(' ')[3]),
    calls: lines,
    output: out,
    note: (/note=(.*)/.exec(out) || [])[1],
  };
}

test('the script parses (bash -n)', () => {
  const res = spawnSync('bash', ['-n', SCRIPT], { encoding: 'utf8' });
  expect(res.stderr).toBe('');
  expect(res.status).toBe(0);
});

test('lists only this instance\'s available deploy-* manual snapshots, with their times and tags', () => {
  const res = prune([]);
  expect(res.calls[0]).toContain('rds describe-db-snapshots --db-instance-identifier episode-control-dev --snapshot-type manual');
  expect(res.calls[0]).toContain("starts_with(DBSnapshotIdentifier, 'deploy-') && Status == 'available'");
  expect(res.calls[0]).toContain('created: SnapshotCreateTime');
  expect(res.calls[0]).toContain('tags: TagList');
  expect(res.calls[0]).toContain('--output json');
});

test('a dry run unless switched off: names what it would remove, removes nothing', () => {
  const all = snaps(14);
  for (const flag of [undefined, '', '1', 'true', 'yes']) {
    const res = prune(all, { DRY_RUN: flag });
    expect(res.deleted).toEqual([]);
    expect(res.note).toBe('dry-run');
    expect(res.output).toContain('would_remove=4');
  }
  const res = prune(all, { DRY_RUN: '' });
  expect(res.stdout).toContain(`Would remove ${all[13].id}.`);
  expect(res.stdout).toContain('dry run: nothing will be removed');
  for (const off of ['0', 'false', 'OFF']) expect(prune(all, { DRY_RUN: off }).deleted).toHaveLength(4);
});

test('keeps the newest 10 by default and removes older ones, oldest first, whatever order they are listed in', () => {
  const all = snaps(14);
  const res = prune(shuffle(all));
  expect(res.status).toBe(0);
  expect(res.deleted).toEqual(ids(all.slice(10)).reverse());
  expect(res.output).toBe('kept=10\nremoved=4\nwould_remove=0\nprotected=0\nnote=ok\n');
});

test('at most MAX_DELETE per run (default 5, 1 to 20), the oldest first', () => {
  const all = snaps(67);
  const res = prune(all);
  expect(res.deleted).toEqual(ids(all.slice(-5)).reverse());
  expect(prune(all, { MAX_DELETE: '2' }).deleted).toEqual(ids(all.slice(-2)).reverse());
  expect(prune(all, { MAX_DELETE: '0' }).deleted).toHaveLength(1);
  expect(prune(all, { MAX_DELETE: '500' }).deleted).toHaveLength(20);
  expect(prune(all, { MAX_DELETE: 'all' }).deleted).toHaveLength(5);
});

test('nothing newer than MIN_AGE_DAYS (default 7, at least 1) is removed', () => {
  // Made 2, 4, 6 … days ago; with KEEP=3 the candidates are 8 days old and older.
  const all = snaps(12);
  const res = prune(all, { KEEP: '3', MAX_DELETE: '20' });
  expect(res.deleted).toEqual(ids(all.slice(3)).reverse());
  const strict = prune(all, { KEEP: '3', MAX_DELETE: '20', MIN_AGE_DAYS: '15' });
  // 16 days and older only (index 7 onward).
  expect(strict.deleted).toEqual(ids(all.slice(7)).reverse());
  expect(strict.stdout).toContain(`Kept ${all[3].id}: newer than 15 day(s).`);
  expect(prune(all, { KEEP: '3', MAX_DELETE: '20', MIN_AGE_DAYS: '0' }).stdout).toContain('using 1, the least it allows');
});

test('DEPLOY_SNAPSHOTS_KEEP sets the count, never below 3; not a number means 10', () => {
  const all = snaps(14);
  expect(prune(all, { KEEP: '12' }).deleted).toEqual(ids(all.slice(12)).reverse());
  const low = prune(all, { KEEP: '0', MAX_DELETE: '20' });
  expect(low.deleted).toEqual(ids(all.slice(3)).reverse());
  expect(low.stdout).toContain('using 3, the least it allows');
  expect(prune(all, { KEEP: 'ten' }).deleted).toEqual(ids(all.slice(10)).reverse());
});

test('protected: keep=true, a name not made by the workflow, this run\'s own, an unreadable time', () => {
  const all = snaps(15);
  all[11].tags = [{ Key: 'Keep', Value: 'TRUE' }];
  all[12].id = 'deploy-before-gala';
  all[13].id = `deploy-${'a'.repeat(12)}-424242-2`;
  all[14].created = 'not a time';
  const res = prune(all, { GITHUB_RUN_ID: '424242', MAX_DELETE: '20' });
  expect(res.deleted).toEqual([all[10].id]);
  expect(res.output).toContain('protected=4');
  expect(res.stdout).toContain(`Kept ${all[11].id}: tagged keep=true.`);
  expect(res.stdout).toContain('Kept deploy-before-gala: not named as the workflow names its snapshots.');
  expect(res.stdout).toContain("this run's own");
  expect(res.stdout).toContain('its creation time could not be read');
});

test('a listing that looks wrong removes nothing: not JSON, not a list, a name twice', () => {
  for (const bad of ['None', '{"id":"x"}', 'not json']) {
    const res = prune(bad);
    expect(res.deleted).toEqual([]);
    expect(res.note).toBe('list-failed');
  }
  const all = snaps(14);
  const twice = prune([...all, all[12]]);
  expect(twice.deleted).toEqual([]);
  expect(twice.note).toBe('list-suspect');
  const failed = prune(all, { FAKE_LIST_FAIL: '1' });
  expect(failed.deleted).toEqual([]);
  expect(failed.note).toBe('list-failed');
  expect(prune([]).output).toContain('removed=0');
});

test('without the delete permission: one warning, nothing else tried, the run goes on', () => {
  const res = prune(snaps(15), { FAKE_DENY: '1' });
  expect(res.status).toBe(0);
  expect(res.deleted).toHaveLength(1);
  expect(res.stdout).toContain('::warning::The deploy role may not delete snapshots');
  expect(res.note).toBe('not-permitted');
});

test('a failed removal is a warning and the rest go; three failures stop the run\'s removals', () => {
  const all = snaps(16);
  const old = ids(all.slice(10)).reverse(); // oldest first: the order they are tried
  const one = prune(all, { FAKE_FAIL: old[1] });
  expect(one.status).toBe(0);
  expect(one.deleted).toEqual(old.slice(0, 5));
  expect(one.output).toContain('removed=4');
  expect(one.note).toBe('some-failed');
  const three = prune(all, { FAKE_FAIL: old.slice(0, 3).join(','), MAX_DELETE: '6' });
  expect(three.deleted).toEqual(old.slice(0, 3));
  expect(three.stdout).toContain('Three removals failed, so no more were tried this run.');
});

describe('the workflow', () => {
  test('runs the script after the plan and before the snapshot, with DEPLOY_SNAPSHOTS_KEEP', () => {
    const plan = WORKFLOW.indexOf('- name: Plan (read-only, on the box)');
    const step = WORKFLOW.indexOf('- name: Remove older deploy snapshots (keeps the newest few)');
    const snap = WORKFLOW.indexOf('- name: Snapshot the database');
    expect(plan).toBeGreaterThan(-1);
    expect(step).toBeGreaterThan(plan);
    expect(snap).toBeGreaterThan(step);
    const block = WORKFLOW.slice(step, snap);
    expect(block).toContain('KEEP: ${{ vars.DEPLOY_SNAPSHOTS_KEEP }}');
    expect(block).toContain('DRY_RUN: ${{ vars.DEPLOY_SNAPSHOTS_PRUNE_DRY_RUN }}');
    expect(block).toContain('MAX_DELETE: ${{ vars.DEPLOY_SNAPSHOTS_MAX_DELETE }}');
    expect(block).toContain('MIN_AGE_DAYS: ${{ vars.DEPLOY_SNAPSHOTS_MIN_AGE_DAYS }}');
    expect(block).toContain('run: bash scripts/deploy/prune-snapshots.sh');
    expect(block).not.toContain('continue-on-error');
  });

  test('the summary says when it was a dry run and how many it would remove', () => {
    expect(WORKFLOW).toContain('PRUNE_WOULD: ${{ steps.prune.outputs.would_remove }}');
    expect(WORKFLOW).toMatch(/dry-run\) echo "\| Older deploy snapshots removed \| none: dry run, \$\{PRUNE_WOULD:-0\} would be removed/);
    expect(WORKFLOW).toContain('list-suspect) echo');
  });

  test('a full snapshot quota stops the run with what to do', () => {
    expect(WORKFLOW).toContain('grep -q SnapshotQuotaExceeded');
    expect(WORKFLOW).toContain('RDS already holds its limit of manual snapshots. Nothing on the box was changed.');
  });

  test('the runbook\'s policy allows deleting deploy-* snapshots only, and denies every other RDS delete', () => {
    const policy = /3\. \*\*Permissions\*\*[\s\S]*?```json\n([\s\S]*?)```/.exec(RUNBOOK)[1]
      .replace(/<[A-Z_]+>/g, 'X');
    const { Statement } = JSON.parse(policy);
    const allow = Statement.find((st) => st.Sid === 'DeleteOldDeploySnapshots');
    expect(allow).toEqual({
      Sid: 'DeleteOldDeploySnapshots', Effect: 'Allow', Action: 'rds:DeleteDBSnapshot',
      Resource: 'arn:aws:rds:X:X:snapshot:deploy-*',
    });
    const deny = Statement.find((st) => st.Sid === 'NeverDeleteAnythingElse');
    expect(deny).toEqual({
      Sid: 'NeverDeleteAnythingElse', Effect: 'Deny', Action: 'rds:Delete*',
      NotResource: 'arn:aws:rds:X:X:snapshot:deploy-*',
    });
    // No other statement may deny the one allowed delete.
    const never = Statement.find((st) => st.Sid === 'NeverThese');
    expect(never.Action).not.toContain('rds:Delete*');
    expect(never.Action).toEqual(expect.arrayContaining(['rds:Modify*', 'rds:Restore*', 'iam:*']));
  });
});

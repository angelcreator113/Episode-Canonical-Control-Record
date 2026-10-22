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

// Lists FAKE_LIST for describe-db-snapshots (or fails when FAKE_LIST_FAIL is
// set); for delete-db-snapshot, records the id and fails for FAKE_DENY (every
// id) or FAKE_FAIL (one id).
const FAKE_AWS = `#!/usr/bin/env bash
echo "$*" >>"$CALLS"
case "$2" in
  describe-db-snapshots)
    if [ -n "\${FAKE_LIST_FAIL:-}" ]; then echo "An error occurred (Throttling)" >&2; exit 255; fi
    printf '%s\\n' "$FAKE_LIST" ;;
  delete-db-snapshot)
    id="$4"
    if [ -n "\${FAKE_DENY:-}" ]; then echo "An error occurred (AccessDenied) when calling the DeleteDBSnapshot operation: not authorized" >&2; exit 254; fi
    if [ "$id" = "\${FAKE_FAIL:-}" ]; then echo "An error occurred (InvalidDBSnapshotState)" >&2; exit 254; fi
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

const snaps = (n) => Array.from({ length: n }, (_, i) => `deploy-${String(i).padStart(12, '0')}-${1000 - i}-1`);

function prune(env = {}) {
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
      ...env,
    },
    encoding: 'utf8',
  });
  const lines = fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean) : [];
  return {
    status: res.status,
    stdout: res.stdout,
    deleted: lines.filter((l) => l.startsWith('rds delete-db-snapshot')).map((l) => l.split(' ')[3]),
    calls: lines,
    output: fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '',
  };
}

test('the script parses (bash -n)', () => {
  const res = spawnSync('bash', ['-n', SCRIPT], { encoding: 'utf8' });
  expect(res.stderr).toBe('');
  expect(res.status).toBe(0);
});

test('lists only this instance\'s available deploy-* manual snapshots, newest first', () => {
  const res = prune({ FAKE_LIST: '' });
  expect(res.calls[0]).toContain('rds describe-db-snapshots --db-instance-identifier episode-control-dev --snapshot-type manual');
  expect(res.calls[0]).toContain("starts_with(DBSnapshotIdentifier, 'deploy-') && Status == 'available'");
  expect(res.calls[0]).toContain('reverse(sort_by(');
  expect(res.calls[0]).toContain('&SnapshotCreateTime');
});

test('keeps the newest 10 by default and deletes the older ones', () => {
  const all = snaps(14);
  const res = prune({ FAKE_LIST: all.join('\t') });
  expect(res.status).toBe(0);
  expect(res.deleted).toEqual(all.slice(10));
  expect(res.output).toBe('kept=10\nremoved=4\nnote=ok\n');
});

test('at or under the keep count, nothing is deleted; an empty list ("None") is fine', () => {
  expect(prune({ FAKE_LIST: snaps(10).join('\t') }).deleted).toEqual([]);
  const none = prune({ FAKE_LIST: 'None' });
  expect(none.deleted).toEqual([]);
  expect(none.output).toContain('removed=0');
});

test('DEPLOY_SNAPSHOTS_KEEP sets the count, never below 3; not a number means 10', () => {
  const all = snaps(12);
  expect(prune({ FAKE_LIST: all.join('\t'), KEEP: '5' }).deleted).toEqual(all.slice(5));
  const low = prune({ FAKE_LIST: all.join('\t'), KEEP: '0' });
  expect(low.deleted).toEqual(all.slice(3));
  expect(low.stdout).toContain('keeping the newest 3');
  expect(prune({ FAKE_LIST: all.join('\t'), KEEP: 'ten' }).deleted).toEqual(all.slice(10));
});

test('anything not shaped like a deploy-* identifier is never deleted', () => {
  const all = snaps(11);
  const res = prune({ FAKE_LIST: [...all.slice(0, 10), 'rds:manual-keep', 'deploy-x;rm', all[10]].join('\t') });
  expect(res.deleted).toEqual([all[10]]);
});

test('without the delete permission: one warning, nothing else tried, the run goes on', () => {
  const res = prune({ FAKE_LIST: snaps(15).join('\t'), FAKE_DENY: '1' });
  expect(res.status).toBe(0);
  expect(res.deleted).toHaveLength(1);
  expect(res.stdout).toContain('::warning::The deploy role may not delete snapshots');
  expect(res.output).toBe('kept=10\nremoved=0\nnote=not-permitted\n');
});

test('one failed delete is a warning; the rest still go; a failed listing removes nothing', () => {
  const all = snaps(13);
  const res = prune({ FAKE_LIST: all.join('\t'), FAKE_FAIL: all[11] });
  expect(res.status).toBe(0);
  expect(res.deleted).toEqual(all.slice(10));
  expect(res.stdout).toContain(`::warning::Could not remove ${all[11]}`);
  expect(res.output).toBe('kept=10\nremoved=2\nnote=some-failed\n');

  const failed = prune({ FAKE_LIST_FAIL: '1' });
  expect(failed.status).toBe(0);
  expect(failed.deleted).toEqual([]);
  expect(failed.output).toContain('note=list-failed');
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
    expect(block).toContain('run: bash scripts/deploy/prune-snapshots.sh');
    expect(block).not.toContain('continue-on-error');
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

// ============================================================================
// The Deploy workflow removes older deploy-* snapshots LAST: only after its
// own snapshot is available and the migration, deploy, restart and public
// health check succeeded (Evoni, 2026-11-11 and 2026-11-12: an old recovery
// point is never removed before the new one exists, nor by a failed
// release). Until then it removed them first (2026-10-22: runs #145 and #146
// had stopped with SnapshotQuotaExceeded).
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

// The snapshot the run has just taken. Every listing below holds it, as RDS's
// would once the workflow has waited for it, unless a test says otherwise.
const NEW = 'deploy-ffffffffffff-777777-1';
const newSnap = (over = {}) => ({ id: NEW, created: new Date(NOW - 60 * 1000).toISOString(), tags: [], ...over });

function prune(list, env = {}, { withNew = true } = {}) {
  if (Array.isArray(list) && withNew) list = [newSnap(), ...list];
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
      NEW_SNAPSHOT: NEW,
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
  expect(twice.calls.filter((l) => l.includes('delete-db-snapshot'))).toEqual([]);
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

describe('the new snapshot comes first (Evoni, 2026-11-11)', () => {
  test('nothing is removed unless the run names its new snapshot', () => {
    const all = snaps(14);
    for (const name of [undefined, '', 'deploy-before-gala', 'episode-control-dev', `${NEW} extra`]) {
      const res = prune(all, { NEW_SNAPSHOT: name });
      expect(res.status).toBe(0);
      expect(res.deleted).toEqual([]);
      expect(res.note).toBe('no-new-snapshot');
      expect(res.output).toContain('removed=0');
    }
    // Not named: RDS is not even asked for the list.
    expect(prune(all, { NEW_SNAPSHOT: '' }).calls).toEqual([]);
  });

  test('nothing is removed when the new snapshot is not among the available ones', () => {
    const all = snaps(14);
    // The listing holds available snapshots only: one still being made, or one that failed, is not in it.
    const res = prune(all, {}, { withNew: false });
    expect(res.status).toBe(0);
    expect(res.deleted).toEqual([]);
    expect(res.note).toBe('no-new-snapshot');
    expect(res.stdout).toContain(`This run's new snapshot ${NEW} is not among the available deploy snapshots, so no older snapshot was removed.`);
    // A dry run says the same and lists nothing as removable.
    const dry = prune(all, { DRY_RUN: '1' }, { withNew: false });
    expect(dry.note).toBe('no-new-snapshot');
    expect(dry.stdout).not.toContain('Would remove');
  });

  test('the new snapshot is never removed, whatever its age, the counts or the limits', () => {
    // Made to look as old as possible, with the smallest KEEP and the largest batch.
    const all = [newSnap({ created: '2020-01-01T00:00:00Z' }), ...snaps(30)];
    const res = prune(all, { KEEP: '3', MAX_DELETE: '20', MIN_AGE_DAYS: '1' }, { withNew: false });
    expect(res.deleted).not.toContain(NEW);
    expect(res.deleted).toHaveLength(20);
    expect(res.stdout).toContain(`This run's new snapshot ${NEW} is available. It is kept and does not count toward the newest 3.`);
    // Alone in the listing: nothing to remove.
    expect(prune([]).deleted).toEqual([]);
  });

  test('the number of older snapshots kept is unchanged: the new one does not count toward KEEP', () => {
    const all = snaps(14);
    // Before this change a run kept the newest 10 and then added its own: 11. It still leaves 10 older ones.
    const res = prune(all);
    expect(res.deleted).toEqual(ids(all.slice(10)).reverse());
    expect(res.output).toBe('kept=10\nremoved=4\nwould_remove=0\nprotected=0\nnote=ok\n');
    // Exactly 10 older ones and the new one: nothing goes.
    expect(prune(snaps(10)).deleted).toEqual([]);
  });

  test('keep=true and the seven-day minimum hold as before', () => {
    const all = snaps(14);
    all[13].tags = [{ Key: 'keep', Value: 'true' }];
    const res = prune(all);
    expect(res.deleted).toEqual(ids(all.slice(10, 13)).reverse());
    expect(res.stdout).toContain(`Kept ${all[13].id}: tagged keep=true.`);
    // Fourteen snapshots all younger than seven days: none is old enough.
    const young = Array.from({ length: 14 }, (_, i) => ({ id: `deploy-${i.toString(16).padStart(12, '0')}-${8000 - i}-1`, created: new Date(NOW - (i + 1) * 3600 * 1000).toISOString(), tags: [] }));
    expect(prune(young).deleted).toEqual([]);
  });

  test('every snapshot selected is named, with when it was made, before the first removal', () => {
    const all = snaps(13);
    const res = prune(all);
    const lines = res.stdout.split('\n');
    const header = lines.indexOf('Selected for removal (3, oldest first):');
    expect(header).toBeGreaterThan(-1);
    expect(lines.slice(header + 1, header + 4)).toEqual(all.slice(10).reverse().map((x) => `  ${x.id}  created ${x.created}`));
    expect(lines.findIndex((l) => l.startsWith('Removed '))).toBeGreaterThan(header + 3);
    // A dry run names the same ones and removes none.
    const dry = prune(all, { DRY_RUN: '1' });
    expect(dry.stdout).toContain('Selected for removal (3, oldest first):');
    expect(dry.deleted).toEqual([]);
    expect(prune(snaps(4)).stdout).toContain('Selected for removal: none.');
  });
});

describe('the workflow', () => {
  const yaml = require('js-yaml');
  const STEPS = yaml.load(WORKFLOW).jobs.deploy.steps;
  const NAMES = STEPS.map((x) => x.name || x.uses);
  const at = (name) => NAMES.indexOf(name);
  const PRUNE = 'Remove older deploy snapshots (after a healthy deploy; keeps the newest few)';
  const pruneStep = STEPS[at(PRUNE)];

  test('removal is the last thing a healthy deploy does: after the snapshot, the migration, the deploy, the restart and the public health check', () => {
    expect(at(PRUNE)).toBeGreaterThan(-1);
    for (const earlier of ['Snapshot the database', 'Wait for the snapshot to be available',
      'Migrate (on the box, from the staged commit, if pending)', 'Deploy (fast-forward and the frontend, on the box)',
      'Restart and health check (on the box)', 'Public health check']) {
      expect(at(earlier)).toBeGreaterThan(-1);
      expect(at(earlier)).toBeLessThan(at(PRUNE));
    }
    // Directly after the final health gate, not merely after the restart; only the reporting steps follow.
    expect(at(PRUNE)).toBe(at('Public health check') + 1);
    expect(NAMES.slice(at(PRUNE) + 1)).toEqual(['Summary', 'Point to the snapshot and the runbook']);
    // One removal step in the whole workflow, and nothing before it deletes a snapshot.
    expect(WORKFLOW.split('scripts/deploy/prune-snapshots.sh').length - 1).toBe(1);
    expect(NAMES.filter((n) => /Remove older deploy snapshots/.test(n))).toHaveLength(1);
    expect(WORKFLOW.slice(0, WORKFLOW.indexOf(`- name: ${PRUNE}`))).not.toContain('delete-db-snapshot');
  });

  test('a failed migration, deploy, restart or health check leaves older snapshots untouched', () => {
    // The step runs only when every earlier step succeeded AND the public health check itself did.
    expect(pruneStep.if).toBe("${{ success() && steps.health.outcome == 'success' }}");
    expect(STEPS[at('Public health check')].id).toBe('health');
    expect(pruneStep.if).not.toMatch(/always\(\)|failure\(\)|cancelled\(\)/);
    // None of the gates before it may fail without failing the job.
    for (const gate of ['Snapshot the database', 'Wait for the snapshot to be available',
      'Migrate (on the box, from the staged commit, if pending)', 'Deploy (fast-forward and the frontend, on the box)',
      'Restart and health check (on the box)', 'Public health check']) {
      expect(STEPS[at(gate)]['continue-on-error']).toBeUndefined();
    }
    // The health check fails the job when production is not healthy with its database connected.
    const health = STEPS[at('Public health check')].run;
    expect(health).toContain('"status":"healthy"');
    expect(health).toContain('"database":"connected"');
    expect(health.trim().endsWith('exit 1')).toBe(true);
    // The snapshot wait stops the run on anything but "available".
    const wait = STEPS[at('Wait for the snapshot to be available')].run;
    expect(wait).toContain('available) exit 0 ;;');
    expect(wait).toMatch(/\*\) echo "::error::Snapshot \$\{SNAP\} is \$\{STATUS\}\. Nothing on the box was changed\."; exit 1 ;;/);
  });

  test('it is handed the snapshot this run took, and the retention settings', () => {
    expect(pruneStep.id).toBe('prune');
    expect(pruneStep.env).toEqual({
      NEW_SNAPSHOT: '${{ steps.snapshot.outputs.name }}',
      KEEP: '${{ vars.DEPLOY_SNAPSHOTS_KEEP }}',
      DRY_RUN: '${{ vars.DEPLOY_SNAPSHOTS_PRUNE_DRY_RUN }}',
      MAX_DELETE: '${{ vars.DEPLOY_SNAPSHOTS_MAX_DELETE }}',
      MIN_AGE_DAYS: '${{ vars.DEPLOY_SNAPSHOTS_MIN_AGE_DAYS }}',
    });
    expect(pruneStep.run).toContain('bash scripts/deploy/prune-snapshots.sh');
    expect(pruneStep['continue-on-error']).toBeUndefined();
  });

  // The step's own shell, run for real (GitHub runs it with bash -e), with a stand-in for the script.
  const runPruneStep = (scriptBody) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-prune-step-'));
    fs.mkdirSync(path.join(dir, 'scripts', 'deploy'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'scripts', 'deploy', 'prune-snapshots.sh'), `#!/usr/bin/env bash\n${scriptBody}\n`);
    const output = path.join(dir, 'out');
    fs.writeFileSync(output, '');
    const res = spawnSync('bash', ['-e', '-c', pruneStep.run], { cwd: dir, encoding: 'utf8', env: { PATH: process.env.PATH, GITHUB_OUTPUT: output, RUNBOOK: 'docs/runbooks/deploy-workflow.md' } });
    const out = { status: res.status, stdout: res.stdout + res.stderr, output: fs.readFileSync(output, 'utf8') };
    fs.rmSync(dir, { recursive: true, force: true });
    return out;
  };

  test('a retention step that stops unexpectedly is a warning: the step still succeeds, so the deploy is not reported as failed', () => {
    const crashed = runPruneStep('echo "partway"; exit 3');
    expect(crashed.status).toBe(0);
    expect(crashed.stdout).toContain('::warning title=Snapshot retention::The retention step stopped unexpectedly. The deployment succeeded and is not affected.');
    expect(crashed.stdout).not.toContain('::error');
    expect(crashed.output).toBe('note=stopped\n');
    // The ordinary case: the script reports for itself and nothing is added.
    const fine = runPruneStep('echo "note=ok" >>"$GITHUB_OUTPUT"; exit 0');
    expect(fine.status).toBe(0);
    expect(fine.stdout).not.toContain('::warning');
    expect(fine.output).toBe('note=ok\n');
  });

  // The Summary step's own shell, run for real with the values a run would hand it.
  const summary = (env) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-summary-'));
    const file = path.join(dir, 'summary.md');
    const res = spawnSync('bash', ['-e', '-c', STEPS[at('Summary')].run], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, GITHUB_STEP_SUMMARY: file, RUNNER_TEMP: dir, TARGET_SHA: 'a'.repeat(40), RUNBOOK: 'docs/runbooks/deploy-workflow.md',
        OLD_SHA: 'b'.repeat(40), COMMITS: '6', MIGRATIONS: '1', SNAP: 'deploy-aaaaaaaaaaaa-1-1', ...env },
    });
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    fs.rmSync(dir, { recursive: true, force: true });
    return { status: res.status, text, err: res.stderr };
  };
  const HEALTHY = { JOB_STATUS: 'success', MIGRATE_RAN: '1', RESTART_OUTCOME: 'success', HEALTH_OUTCOME: 'success' };

  test('the summary: a healthy deploy with snapshots removed, and with a dry run', () => {
    const ok = summary({ ...HEALTHY, PRUNE_NOTE: 'ok', PRUNE_REMOVED: '4', PRUNE_KEPT: '10' });
    expect(ok.status).toBe(0);
    expect(ok.text).toContain('## Deploy success');
    expect(ok.text).toContain('| Older deploy snapshots removed | 4 (the newest 10 kept) |');
    expect(ok.text).not.toMatch(/Retention warning|Stopped/);
    // The retention row comes after the health row: it is the last thing that happened.
    expect(ok.text.indexOf('| Public health | success |')).toBeLessThan(ok.text.indexOf('| Older deploy snapshots removed |'));
    const dry = summary({ ...HEALTHY, PRUNE_NOTE: 'dry-run', PRUNE_WOULD: '4', PRUNE_PROTECTED: '2' });
    expect(dry.text).toContain("| Older deploy snapshots removed | none: dry run, 4 would be removed (the step's log names them; 2 protected) |");
    expect(dry.text).not.toMatch(/Retention warning|Stopped/);
  });

  test('the summary: a retention problem after a healthy deploy is a retention warning, never a deployment failure', () => {
    for (const [note, words] of [['not-permitted', 'the role may not delete them'], ['list-failed', 'they could not be listed'],
      ['some-failed', 'some could not be removed'], ['list-suspect', 'the listing looked wrong'],
      ['no-new-snapshot', "this run's new snapshot was not confirmed available"], ['stopped', 'the retention step stopped unexpectedly']]) {
      const res = summary({ ...HEALTHY, PRUNE_NOTE: note, PRUNE_REMOVED: '2' });
      expect(res.status).toBe(0);
      expect(res.text).toContain('## Deploy success');
      expect(res.text).toContain('| Public health | success |');
      expect(res.text).toMatch(new RegExp(`\\| Older deploy snapshots removed \\| retention warning: [^|]*${words}`));
      expect(res.text).toContain('**Retention warning, not a deployment failure.** The deployment and its health checks succeeded.');
      expect(res.text).not.toContain('**Stopped.**');
      expect(res.text).not.toContain('rolling back');
    }
  });

  test('the summary: a failed release says no older snapshot was removed', () => {
    for (const failed of [
      { MIGRATE_RAN: '', RESTART_OUTCOME: '', HEALTH_OUTCOME: '' }, // stopped at the migration
      { MIGRATE_RAN: '1', RESTART_OUTCOME: 'failure', HEALTH_OUTCOME: '' }, // stopped at the restart
      { MIGRATE_RAN: '1', RESTART_OUTCOME: 'success', HEALTH_OUTCOME: 'failure' }, // unhealthy
    ]) {
      const res = summary({ JOB_STATUS: 'failure', PRUNE_NOTE: '', ...failed });
      expect(res.status).toBe(0);
      expect(res.text).toContain('## Deploy failure');
      expect(res.text).toContain('| Older deploy snapshots removed | none: they are removed only after a successful deployment and public health check |');
      expect(res.text).toContain('**Stopped.** No automatic rollback was attempted.');
      expect(res.text).toContain('The database snapshot taken before any migration is `deploy-aaaaaaaaaaaa-1-1`.');
      expect(res.text).not.toContain('Retention warning');
    }
  });

  test('the summary says when it was a dry run and how many it would remove', () => {
    expect(WORKFLOW).toContain('PRUNE_WOULD: ${{ steps.prune.outputs.would_remove }}');
    expect(WORKFLOW).toMatch(/dry-run\) echo "\| Older deploy snapshots removed \| none: dry run, \$\{PRUNE_WOULD:-0\} would be removed/);
    expect(WORKFLOW).toContain('list-suspect) RETENTION_WARNING=');
    expect(WORKFLOW).toContain('no-new-snapshot) RETENTION_WARNING=');
    expect(WORKFLOW).toContain('stopped) RETENTION_WARNING=');
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

/**
 * F-Tools-5 (2026-10-31): sessions may start, re-run and cancel workflow runs
 * and merge PRs when Evoni asks; auto-merge and direct writes to main or dev
 * stay denied; irreversible or outside-the-repo GitHub actions ask first, and
 * are refused where a prompt may not reach her. The session's GitHub tool
 * acts as her account, so the hook (.claude/hooks/guard-github-tools.js) is
 * defense in depth. This suite pins every decision and the settings that wire
 * the hook. (It replaces the Issue #3650 rulings' version.)
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'guard-github-tools.js');
const SETTINGS = path.join(ROOT, '.claude', 'settings.json');

const run = (input) => {
  const r = spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8' });
  expect(r.status).toBe(0);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
};
const decisionOf = (tool, toolInput = {}, mode = 'default') => {
  const out = run(JSON.stringify({ tool_name: `mcp__github__${tool}`, permission_mode: mode, tool_input: toolInput }));
  return out ? out.permissionDecision : 'pass';
};

describe('guard-github-tools: workflow runs are allowed (F-Tools-5 §1, §8 Q2)', () => {
  test.each([
    ['starting a workflow', 'actions_run_trigger', { method: 'run_workflow', workflow_id: 'deploy.yml', ref: 'main' }],
    ['starting Diagnostics', 'actions_run_trigger', { method: 'run_workflow', workflow_id: 'diagnostics.yml', ref: 'main' }],
    ['re-running a CI run', 'actions_run_trigger', { method: 'rerun_workflow_run', run_id: 1 }],
    ['re-running failed jobs', 'actions_run_trigger', { method: 'rerun_failed_jobs', run_id: 1 }],
    ['cancelling a run', 'actions_run_trigger', { method: 'cancel_workflow_run', run_id: 1 }],
  ])('passes %s', (_label, tool, input) => {
    expect(decisionOf(tool, input)).toBe('pass');
  });
});

describe('guard-github-tools: merges and branches', () => {
  test('a merge passes (F-Tools-5 §8 Q1 default: no separate yes)', () => {
    expect(decisionOf('merge_pull_request', { pullNumber: 5, merge_method: 'squash' })).toBe('pass');
  });

  test('auto-merge is denied', () => {
    expect(decisionOf('enable_pr_auto_merge', { pullNumber: 5 })).toBe('deny');
  });

  test.each([
    ['a file write to main', 'create_or_update_file', { branch: 'main', path: 'x' }],
    ['a file write to refs/heads/main', 'create_or_update_file', { branch: 'refs/heads/main', path: 'x' }],
    ['a file write with no branch (the default branch)', 'create_or_update_file', { path: 'x' }],
    ['a push to dev', 'push_files', { branch: 'dev', files: [] }],
    ['a delete on main', 'delete_file', { branch: 'main', path: 'x' }],
    ['creating a branch named main', 'create_branch', { branch: 'main' }],
  ])('denies %s', (_label, tool, input) => {
    expect(decisionOf(tool, input)).toBe('deny');
  });

  test.each([
    ['a file write to a claude/ branch', 'create_or_update_file', { branch: 'claude/x', path: 'x' }],
    ['a push to a claude/ branch', 'push_files', { branch: 'claude/x', files: [] }],
    ['creating a claude/ branch from main', 'create_branch', { branch: 'claude/x', from_branch: 'main' }],
    ['bringing main into a PR branch', 'update_pull_request_branch', { pullNumber: 5 }],
    ['opening a PR', 'create_pull_request', { head: 'claude/x', base: 'main' }],
    ['reading a PR', 'pull_request_read', { method: 'get', pullNumber: 5 }],
    ['reading job logs', 'get_job_logs', { job_id: 1 }],
    ['commenting', 'add_issue_comment', { issue_number: 5, body: 'x' }],
    ['turning auto-merge off', 'disable_pr_auto_merge', { pullNumber: 5 }],
  ])('passes %s to the normal permission flow', (_label, tool, input) => {
    expect(decisionOf(tool, input)).toBe('pass');
  });
});

describe('guard-github-tools: irreversible or outside-the-repo actions ask first (F-Tools-5 §4)', () => {
  const GATED = [
    ['deleting run logs', 'actions_run_trigger', { method: 'delete_workflow_run_logs', run_id: 1 }],
    ['the older delete-logs tool', 'delete_workflow_run_logs', { run_id: 1 }],
    ['creating a repository', 'create_repository', {}],
    ['forking a repository', 'fork_repository', {}],
    ['handing a PR to Copilot', 'create_pull_request_with_copilot', {}],
    ['assigning Copilot', 'assign_copilot_to_issue', {}],
  ];
  test.each(GATED)('asks before %s in the default mode', (_label, tool, input) => {
    expect(decisionOf(tool, input, 'default')).toBe('ask');
  });
  test.each(GATED)('refuses %s in auto mode, where a prompt may not reach Evoni', (_label, tool, input) => {
    expect(decisionOf(tool, input, 'auto')).toBe('deny');
  });
});

describe('guard-github-tools: robustness', () => {
  test('unreadable input is denied (fail closed)', () => {
    expect(run('{not json').permissionDecision).toBe('deny');
  });

  test('tools of other servers are not its business', () => {
    expect(run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } }))).toBeNull();
  });
});

describe('settings wire the guard', () => {
  const settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));

  test('the hook runs before every GitHub tool call', () => {
    const entry = settings.hooks.PreToolUse.find((h) => h.matcher === 'mcp__github__.*');
    expect(entry).toBeDefined();
    expect(entry.hooks[0].command).toBe('node');
    expect(entry.hooks[0].args.join(' ')).toContain('guard-github-tools.js');
  });

  test('the shell guard still runs for Bash and PowerShell', () => {
    expect(settings.hooks.PreToolUse.some((h) => h.matcher === 'Bash|PowerShell')).toBe(true);
  });

  test('the deny list keeps auto-merge shut and no longer holds the workflow, rerun, cancel and merge doors', () => {
    expect(settings.permissions.deny).toEqual(expect.arrayContaining(['mcp__github__enable_pr_auto_merge']));
    // F-Tools-5: workflow runs, re-runs, cancels and merges are no longer statically denied.
    ['mcp__github__actions_run_trigger', 'Bash(gh run rerun *)', 'Bash(gh run cancel *)', 'Bash(gh pr merge *)', 'Bash(gh workflow run *)']
      .forEach((rule) => expect(settings.permissions.deny).not.toContain(rule));
  });
});

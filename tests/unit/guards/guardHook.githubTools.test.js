/**
 * Evoni's rulings on Issue #3650 (2026-10-30): she starts every production
 * workflow; a session never starts, approves, re-runs or cancels a workflow
 * run, never turns on auto-merge, and merges only after her explicit yes.
 * The session's GitHub tool acts as her account, so these doors are closed
 * in the session too (.claude/hooks/guard-github-tools.js), as defense in
 * depth. This suite pins every decision and the settings that wire the hook.
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
const decisionOf = (tool, toolInput = {}) => {
  const out = run(JSON.stringify({ tool_name: `mcp__github__${tool}`, tool_input: toolInput }));
  return out ? out.permissionDecision : 'pass';
};

describe('guard-github-tools: workflow runs are Evoni\'s', () => {
  test.each([
    ['starting a workflow', 'actions_run_trigger', { method: 'run_workflow', workflow_id: 'deploy.yml', ref: 'main' }],
    ['starting Diagnostics', 'actions_run_trigger', { method: 'run_workflow', workflow_id: 'diagnostics.yml', ref: 'main' }],
    ['re-running a CI run', 'actions_run_trigger', { method: 'rerun_workflow_run', run_id: 1 }],
    ['re-running failed jobs', 'actions_run_trigger', { method: 'rerun_failed_jobs', run_id: 1 }],
    ['cancelling a run', 'actions_run_trigger', { method: 'cancel_workflow_run', run_id: 1 }],
    ['deleting run logs', 'actions_run_trigger', { method: 'delete_workflow_run_logs', run_id: 1 }],
    ['an unknown method of the same tool', 'actions_run_trigger', { method: 'something_new' }],
    ['the older run_workflow tool', 'run_workflow', { workflow_id: 'deploy.yml' }],
    ['the older rerun tool', 'rerun_failed_jobs', { run_id: 1 }],
    ['the older cancel tool', 'cancel_workflow_run', { run_id: 1 }],
  ])('denies %s', (_label, tool, input) => {
    expect(decisionOf(tool, input)).toBe('deny');
  });
});

describe('guard-github-tools: merges and branches', () => {
  test('a merge asks (Rule 7: only after Evoni\'s explicit yes)', () => {
    const out = run(JSON.stringify({ tool_name: 'mcp__github__merge_pull_request', tool_input: { pullNumber: 5, merge_method: 'squash' } }));
    expect(out.permissionDecision).toBe('ask');
    expect(out.permissionDecisionReason).toMatch(/explicit yes/);
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

describe('guard-github-tools: outside any task', () => {
  test.each(['create_repository', 'fork_repository', 'create_pull_request_with_copilot', 'assign_copilot_to_issue'])('denies %s', (tool) => {
    expect(decisionOf(tool)).toBe('deny');
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
    expect(entry.hooks[0].command).toContain('guard-github-tools.js');
  });

  test('the shell guard still runs for Bash and PowerShell', () => {
    expect(settings.hooks.PreToolUse.some((h) => h.matcher === 'Bash|PowerShell')).toBe(true);
  });

  test('the deny list holds the workflow, rerun, cancel, merge and auto-merge doors', () => {
    expect(settings.permissions.deny).toEqual(expect.arrayContaining([
      'mcp__github__actions_run_trigger',
      'mcp__github__enable_pr_auto_merge',
      'Bash(gh run rerun *)',
      'Bash(gh run cancel *)',
      'Bash(gh pr merge *)',
    ]));
  });
});

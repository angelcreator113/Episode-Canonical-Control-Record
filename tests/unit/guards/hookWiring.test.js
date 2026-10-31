/**
 * Task #3661: the hooks must run on every platform the owner uses, including a
 * local VS Code session on Windows without Git Bash, where shell-form hook
 * commands run in PowerShell and bash syntax such as `$CLAUDE_PROJECT_DIR`
 * does not expand (DEVELOPMENT_WORKFLOW.md §2.1). Every hook is therefore
 * exec form: `command` is `node` and `args` holds one script path built from
 * the `${CLAUDE_PROJECT_DIR}` placeholder, which Claude Code substitutes itself
 * with no shell involved (code.claude.com/docs/en/hooks, "Exec form and shell
 * form"). This suite pins that wiring and runs each hook the way exec form
 * does: node, the resolved path, no shell.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));

const allHooks = Object.entries(settings.hooks).flatMap(([event, entries]) =>
  entries.flatMap((entry) => entry.hooks.map((hook) => ({ event, matcher: entry.matcher, hook }))));
const resolve = (arg) => arg.replace('${CLAUDE_PROJECT_DIR}', ROOT);
const runExecForm = (hook, input, env = {}) => spawnSync(hook.command === 'node' ? process.execPath : hook.command,
  hook.args.map(resolve), { input, encoding: 'utf8', shell: false, env: { ...process.env, ...env } });

describe('every hook is exec form, with no shell syntax', () => {
  test('there are hooks to check', () => {
    expect(allHooks.length).toBeGreaterThanOrEqual(3);
  });

  test.each(allHooks.map((h) => [`${h.event} ${h.matcher || ''}`.trim(), h.hook]))('%s', (_name, hook) => {
    expect(hook.type).toBe('command');
    expect(hook.command).toBe('node');
    expect(Array.isArray(hook.args)).toBe(true);
    expect(hook.args).toHaveLength(1);
    expect(hook.args[0].startsWith('${CLAUDE_PROJECT_DIR}/.claude/hooks/')).toBe(true);
    // No bare bash variable, quoting or shell operators anywhere in the hook.
    expect(JSON.stringify(hook)).not.toMatch(/\$CLAUDE_PROJECT_DIR|\$env:|&&|\|\||\.sh"/);
    expect(fs.existsSync(resolve(hook.args[0]))).toBe(true);
  });
});

describe('each hook runs the way exec form runs it', () => {
  const find = (event, matcher) => allHooks.find((h) => h.event === event && h.matcher === matcher).hook;

  test('the shell guard blocks a guarded command and allows a plain one', () => {
    const guard = find('PreToolUse', 'Bash|PowerShell');
    const blocked = runExecForm(guard, JSON.stringify({ tool_input: { command: 'pm2 list' } }));
    expect(blocked.status).toBe(2);
    expect(blocked.stderr).toContain('[guard] BLOCKED');
    expect(runExecForm(guard, JSON.stringify({ tool_input: { command: 'git status' } })).status).toBe(0);
  });

  test('the shell guard reads a PowerShell command with Windows line endings', () => {
    const guard = find('PreToolUse', 'Bash|PowerShell');
    const r = runExecForm(guard, JSON.stringify({ tool_name: 'PowerShell', tool_input: { command: 'Get-ChildItem\r\npm2 list\r\n' } }));
    expect(r.status).toBe(2);
    expect(runExecForm(guard, JSON.stringify({ tool_name: 'PowerShell', tool_input: { command: 'Get-ChildItem -Path .\r\n' } })).status).toBe(0);
  });

  test('the GitHub tool guard denies a workflow dispatch', () => {
    const guard = find('PreToolUse', 'mcp__github__.*');
    const r = runExecForm(guard, JSON.stringify({ tool_name: 'mcp__github__actions_run_trigger', tool_input: {} }));
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  test('the session-start hook does nothing outside a cloud session', () => {
    const start = allHooks.find((h) => h.event === 'SessionStart').hook;
    const r = runExecForm(start, '', { CLAUDE_CODE_REMOTE: '' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });
});

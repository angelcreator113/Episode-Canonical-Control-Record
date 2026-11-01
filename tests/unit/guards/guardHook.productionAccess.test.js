/**
 * F-Tools-5 (2026-10-31, docs/audit/F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md):
 * every agent session, cloud or laptop, may operate production for what Evoni
 * asks. The shell guard (.claude/hooks/guard-dangerous-commands.js) keeps:
 *   §4  deletes and irreversible changes: `ask` where a prompt reaches her
 *       (default, plan, acceptEdits), refused elsewhere (auto, dontAsk,
 *       bypassPermissions);
 *   §5  printing a secret: refused, in every mode;
 *   and the Git conventions (no push to main/dev, no force-push).
 * The guard's own matrix (.claude/hooks/guard-dangerous-commands.test.js) is
 * run here too, so CI holds it. The outcome does not depend on the cloud
 * variable or the old F-Tools-4 marker: cloud and laptop sessions are the same.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'guard-dangerous-commands.js');
const MATRIX = path.join(ROOT, '.claude', 'hooks', 'guard-dangerous-commands.test.js');

const decide = (command, { mode = 'default', env = {} } = {}) => {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', permission_mode: mode, tool_input: { command } }),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  if (r.status === 2) return 'deny';
  expect(r.status).toBe(0);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : 'pass';
};

const SESSIONS = [
  ['a cloud session', { CLAUDE_CODE_REMOTE: 'true' }],
  ['a laptop session', { CLAUDE_CODE_REMOTE: '' }],
  ['a laptop session with the old F-Tools-4 marker', { CLAUDE_CODE_REMOTE: '', PRIME_ATTENDED_LAPTOP: '1' }],
];

describe('guard hook: F-Tools-5 production access', () => {
  test('the hook matrix passes', () => {
    const r = spawnSync(process.execPath, [MATRIX], { encoding: 'utf8' });
    expect(r.stdout).toContain('all cases passed');
    expect(r.status).toBe(0);
  });

  describe.each(SESSIONS)('in %s', (_name, env) => {
    test.each([
      'ssh ubuntu@box "pm2 restart episode-api"',
      'aws ec2 describe-instances',
      'aws ssm send-command --document-name AWS-RunShellScript --targets Key=instanceids,Values=i-1',
      'psql -h db -c "select 1"',
      'gh workflow run deploy.yml',
    ])('passes production work: %s', (command) => {
      expect(decide(command, { env })).toBe('pass');
      expect(decide(command, { env, mode: 'auto' })).toBe('pass');
    });

    test.each([
      'aws s3 rm s3://bucket/x',
      'aws ec2 terminate-instances --instance-ids i-1',
      'aws iam attach-role-policy --role-name r --policy-arn arn',
      'psql -h db -c "DROP TABLE users"',
      'ssh box "psql -c \'TRUNCATE episodes\'"',
    ])('asks before an irreversible action, and refuses it in automatic modes: %s', (command) => {
      ['default', 'plan', 'acceptEdits'].forEach((mode) => expect(decide(command, { env, mode })).toBe('ask'));
      ['auto', 'dontAsk', 'bypassPermissions'].forEach((mode) => expect(decide(command, { env, mode })).toBe('deny'));
    });

    test.each([
      'printenv',
      'echo $AWS_SECRET_ACCESS_KEY',
      'cat .env',
      'aws secretsmanager get-secret-value --secret-id x',
      'gh auth token',
    ])('refuses printing a secret in every mode: %s', (command) => {
      ['default', 'auto', 'bypassPermissions'].forEach((mode) => expect(decide(command, { env, mode })).toBe('deny'));
    });
  });

  test('the ask names the rule and what it needs from Evoni', () => {
    const r = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ tool_name: 'Bash', permission_mode: 'default', tool_input: { command: 'aws s3 rm s3://b/x' } }),
      encoding: 'utf8',
    });
    const out = JSON.parse(r.stdout).hookSpecificOutput;
    expect(out.permissionDecision).toBe('ask');
    expect(out.permissionDecisionReason).toMatch(/F-Tools-5 §4/);
    expect(out.permissionDecisionReason).toMatch(/explicit yes/);
  });
});

describe('settings: the static deny list matches F-Tools-5', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const deny = settings.permissions.deny;

  test('production tools are no longer statically denied', () => {
    ['Bash(ssh *)', 'Bash(scp *)', 'Bash(pm2 *)', 'Bash(aws *)', 'Bash(gh workflow run *)', 'Bash(gh pr merge *)', 'mcp__github__actions_run_trigger']
      .forEach((rule) => expect(deny).not.toContain(rule));
  });

  test('git conventions, auto-merge and the secret files stay denied', () => {
    expect(deny).toEqual(expect.arrayContaining([
      'Bash(git push * main)', 'Bash(git push * dev)', 'Bash(git push --force *)', 'Bash(git push -f *)',
      'mcp__github__enable_pr_auto_merge', 'Read(./.env)', 'Read(./.env.production)',
    ]));
  });

  test('no allow rule pre-approves a command the guard would ask about', () => {
    expect(settings.permissions.allow.join(' ')).not.toMatch(/\b(aws|gh|psql|ssh|pm2)\b/);
  });
});

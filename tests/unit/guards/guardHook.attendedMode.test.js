/**
 * F-Tools-4 (2026-10-31): attended laptop mode. The shell guard
 * (.claude/hooks/guard-dangerous-commands.js) is strict everywhere except a
 * session that is (a) not a cloud session, (b) carries Evoni's opt-in marker
 * PRIME_ATTENDED_LAPTOP=1 from her user-level settings, and (c) runs in a
 * permission mode where an `ask` reaches her. There, gh and aws commands are
 * asked, never allowed; the never-list (§4) is denied in every mode.
 * Each case runs the hook with a controlled environment, so the result does
 * not depend on where the suite runs.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'guard-dangerous-commands.js');

const baseEnv = () => {
  const env = { ...process.env };
  delete env.CLAUDE_CODE_REMOTE;
  delete env.PRIME_ATTENDED_LAPTOP;
  return env;
};
const ATTENDED = { env: { PRIME_ATTENDED_LAPTOP: '1' }, mode: 'default' };
const CLOUD = { env: { CLAUDE_CODE_REMOTE: 'true', PRIME_ATTENDED_LAPTOP: '1' }, mode: 'default' };

// Returns 'deny' (exit 2), 'ask' (ask JSON on stdout) or 'pass' (exit 0, no decision).
const decide = (command, { env = {}, mode = 'default' } = {}) => {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', ...(mode === null ? {} : { permission_mode: mode }), tool_input: { command } }),
    encoding: 'utf8',
    env: { ...baseEnv(), ...env },
  });
  if (r.status === 2) return 'deny';
  expect(r.status).toBe(0);
  if (!r.stdout) return 'pass';
  const out = JSON.parse(r.stdout).hookSpecificOutput;
  expect(out.hookEventName).toBe('PreToolUse');
  return out.permissionDecision;
};

describe('mode detection fails closed', () => {
  test.each([
    ['a cloud session, even with the marker', CLOUD],
    ['a local session without the marker', { env: {}, mode: 'default' }],
    ['the marker set to something other than 1', { env: { PRIME_ATTENDED_LAPTOP: 'true' }, mode: 'default' }],
    ['the marker, but auto mode', { env: { PRIME_ATTENDED_LAPTOP: '1' }, mode: 'auto' }],
    ['the marker, but bypassPermissions', { env: { PRIME_ATTENDED_LAPTOP: '1' }, mode: 'bypassPermissions' }],
    ['the marker, but dontAsk', { env: { PRIME_ATTENDED_LAPTOP: '1' }, mode: 'dontAsk' }],
    ['the marker, but no permission mode in the input', { env: { PRIME_ATTENDED_LAPTOP: '1' }, mode: null }],
  ])('strict: %s', (_name, ctx) => {
    expect(decide('aws sts get-caller-identity', ctx)).toBe('deny');
    expect(decide('aws ec2 describe-instances --region us-east-1', ctx)).toBe('deny');
  });

  test.each(['default', 'plan', 'acceptEdits'])('attended in %s mode', (mode) => {
    expect(decide('aws sts get-caller-identity', { env: ATTENDED.env, mode })).toBe('ask');
  });
});

describe('attended mode: gh and aws are asked, never allowed', () => {
  test.each([
    'aws sts get-caller-identity',
    'aws --profile prime --region us-east-1 ec2 describe-instances',
    'aws s3 ls s3://bucket/episodes/',
    'aws s3api get-bucket-versioning --bucket b',
    'aws s3api put-bucket-versioning --bucket b --versioning-configuration Status=Enabled',
    'aws logs filter-log-events --log-group-name deploy --limit 20',
    'aws iam list-roles',
    "aws cognito-idp describe-user-pool-client --user-pool-id p --client-id c --query 'UserPoolClient.{Id:ClientId,Name:ClientName}'",
    'gh issue create --title x --body y',
    'gh pr create --base main --head claude/x --title t --body b',
    'gh pr view 3663',
    'cd /tmp && gh run list --limit 5',
  ])('%s', (command) => {
    expect(decide(command, ATTENDED)).toBe('ask');
  });

  test('commands that are neither gh nor aws are untouched', () => {
    expect(decide('git status', ATTENDED)).toBe('pass');
    expect(decide('npm test', ATTENDED)).toBe('pass');
    expect(decide('grep -rn guard docs/runbooks', ATTENDED)).toBe('pass');
  });

  test('a command that only mentions gh or aws is asked too, not passed', () => {
    expect(decide("grep -rn 'aws s3 ls' docs/runbooks", ATTENDED)).toBe('ask');
    expect(decide('node scripts/x.js | gh issue list', ATTENDED)).toBe('ask');
  });

  test.each([
    'xargs -n1 aws s3 rm',
    'bash -c "aws s3 rm s3://bucket/x"',
    "sh -c 'gh repo delete o/r --yes'",
    'env AWS_PROFILE=prime aws iam create-access-key --user-name u',
    'sudo -E aws ec2 terminate-instances --instance-ids i-1',
    'nohup aws ssm send-command --document-name x &',
    'echo x | xargs gh release delete',
  ])('wrapped never-list commands are still denied: %s', (command) => {
    expect(decide(command, ATTENDED)).toBe('deny');
    expect(decide(command, CLOUD)).toBe('deny');
  });
});

describe('the never-list is denied in every mode (F-Tools-4 §4)', () => {
  const NEVER = [
    // §4.1 destructive
    'aws s3 rm s3://bucket/episodes/x.mp4',
    'aws s3 rb s3://bucket --force',
    'aws s3 mv s3://bucket/a s3://bucket/b',
    'aws s3 sync ./out s3://bucket/episodes/',
    'aws s3 sync s3://bucket/episodes/ ./local --delete',
    'aws s3 cp ./x.mp4 s3://bucket/episodes/x.mp4',
    'aws s3api put-object --bucket b --key k --body f',
    'aws s3api delete-objects --bucket b --delete file://d.json',
    'aws ec2 terminate-instances --instance-ids i-1',
    'aws ec2 stop-instances --instance-ids i-1',
    'aws ec2 reboot-instances --instance-ids i-1',
    'aws ec2 modify-instance-attribute --instance-id i-1 --no-disable-api-termination',
    'aws ec2 revoke-security-group-ingress --group-id sg-1 --protocol tcp --port 22 --cidr 0.0.0.0/0',
    'aws rds delete-db-instance --db-instance-identifier x',
    'aws rds modify-db-instance --db-instance-identifier x --backup-retention-period 0',
    'aws rds reboot-db-instance --db-instance-identifier x',
    'aws rds restore-db-instance-from-db-snapshot --db-instance-identifier y --db-snapshot-identifier s',
    'aws kms schedule-key-deletion --key-id k --pending-window-in-days 7',
    'aws cloudformation delete-stack --stack-name s',
    'gh repo delete angelcreator113/x --yes',
    'gh repo archive angelcreator113/x',
    'gh release delete v1',
    'gh cache delete --all',
    'gh issue delete 12',
    'gh api -X DELETE repos/o/r/git/refs/heads/x',
    'gh api --method DELETE repos/o/r/releases/1',
    // §4.2 credentials
    'aws configure list',
    'aws configure export-credentials --format env',
    'aws sso login',
    'aws sts get-session-token',
    'aws sts assume-role --role-arn arn --role-session-name s',
    'aws iam create-access-key --user-name u',
    'aws ssm get-parameter --name /x --with-decryption',
    'aws ssm get-parameters-by-path --path /x',
    'aws secretsmanager get-secret-value --secret-id x',
    'aws ecr get-login-password',
    'aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id c',
    'aws cognito-idp describe-user-pool-client --user-pool-id p --client-id c',
    "aws cognito-idp describe-user-pool-client --user-pool-id p --client-id c --query 'UserPoolClient.ClientSecret'",
    'gh auth token',
    'gh auth status --show-token',
    'gh auth login --web',
    'gh secret set X --body y',
    'cat ~/.aws/credentials',
    'cat ~/.config/gh/hosts.yml',
    'printenv',
    'echo $AWS_SECRET_ACCESS_KEY',
    // §4.3 security boundaries and settings
    'aws iam attach-role-policy --role-name r --policy-arn arn',
    'aws iam put-role-policy --role-name r --policy-name p --policy-document file://p.json',
    'aws s3api put-bucket-policy --bucket b --policy file://p.json',
    'aws s3api put-public-access-block --bucket b --public-access-block-configuration x',
    'aws ec2 authorize-security-group-ingress --group-id sg-1 --protocol tcp --port 22 --cidr 0.0.0.0/0',
    'aws kms put-key-policy --key-id k --policy file://p.json',
    'aws cognito-idp admin-create-user --user-pool-id p --username u',
    'aws cognito-idp update-user-pool --user-pool-id p',
    'gh repo edit --visibility public',
    'gh variable set X --body y',
    // §4.4 production changes outside the approved paths
    'aws ssm send-command --document-name AWS-RunShellScript --targets Key=x,Values=y',
    'aws ssm start-session --target i-1',
    'aws rds-data execute-statement --sql "DELETE FROM users"',
    'aws lambda update-function-configuration --function-name f --environment x',
    'gh workflow run deploy.yml',
    'gh run rerun 1',
    'gh pr merge 3663 --squash',
    'ssh ubuntu@host',
    'pm2 restart all',
    'git push origin main',
  ];
  test.each(NEVER)('attended: %s', (command) => {
    expect(decide(command, ATTENDED)).toBe('deny');
  });
  test.each(NEVER)('cloud: %s', (command) => {
    expect(decide(command, CLOUD)).toBe('deny');
  });
});

describe('the opt-in marker never comes from the repository', () => {
  test('no settings file under .claude/ sets PRIME_ATTENDED_LAPTOP', () => {
    const dir = path.join(ROOT, '.claude');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files).toContain('settings.json');
    for (const f of files) {
      expect(fs.readFileSync(path.join(dir, f), 'utf8')).not.toContain('PRIME_ATTENDED_LAPTOP');
    }
  });

  test('the static deny list no longer blocks the AWS CLI; the guard does, by mode', () => {
    const settings = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
    expect(settings.permissions.deny).not.toContain('Bash(aws *)');
    expect(settings.permissions.deny).not.toContain('PowerShell(aws *)');
    expect(settings.permissions.allow.join(' ')).not.toMatch(/\b(aws|gh)\b/);
    expect(settings.permissions.deny).toEqual(expect.arrayContaining(['Bash(gh workflow run *)', 'Bash(gh pr merge *)', 'Bash(ssh *)', 'Bash(pm2 *)']));
  });
});

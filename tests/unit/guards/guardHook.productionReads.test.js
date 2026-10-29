/**
 * F-Tools-3 (2026-10-29): production is default-deny. The session guard hook
 * (.claude/hooks/guard-dangerous-commands.js) must keep every production
 * write, delete, deploy, IAM change and direct AWS request blocked, and must
 * never let a session read credentials from its environment or carry a signed
 * link in a command. The hook's own matrix
 * (.claude/hooks/guard-dangerous-commands.test.js) is run here too, so CI
 * holds it, not only a manual run.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'guard-dangerous-commands.js');
const MATRIX = path.join(ROOT, '.claude', 'hooks', 'guard-dangerous-commands.test.js');

const exitOf = (command) => spawnSync(process.execPath, [HOOK], {
  input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8',
}).status;

describe('guard hook: production stays default-deny (F-Tools-3)', () => {
  test('the hook matrix passes', () => {
    const r = spawnSync(process.execPath, [MATRIX], { encoding: 'utf8' });
    expect(r.stdout).toContain('all cases passed');
    expect(r.status).toBe(0);
  });

  test.each([
    ['an S3 write', 'aws s3 cp f.mp4 s3://b/episodes/x/raw-clips/y/original.mp4'],
    ['an S3 delete', 'aws s3 rm s3://b/episodes/x/raw-clips/y/cutout.webm'],
    ['a bucket policy change', 'aws s3api put-bucket-policy --bucket b --policy file://p.json'],
    ['an ACL change', 'aws s3api put-object-acl --bucket b --key k --acl public-read'],
    ['an IAM change', 'aws iam put-role-policy --role-name r --policy-name p --policy-document file://p.json'],
    ['assuming a role', 'aws sts assume-role --role-arn arn --role-session-name s'],
    ['a command on the server', 'aws ssm send-command --document-name AWS-RunShellScript'],
    ['a deploy dispatch', 'gh workflow run deploy.yml'],
    ['a migration against RDS', 'DATABASE_URL=postgresql://u:p@episode-control-prod.x.rds.amazonaws.com/db npm run migrate:up'],
    ['a restart', 'pm2 restart all'],
    ['ssh to a host', 'ssh ubuntu@54.163.229.144'],
    ['a direct S3 download', 'curl -o /tmp/x.mp4 https://b.s3.us-east-1.amazonaws.com/episodes/x/original.mp4'],
    ['a direct S3 upload', 'curl -X PUT -T f https://b.s3.amazonaws.com/k'],
    ['an SDK call', "node -e \"require('@aws-sdk/client-s3')\""],
    ['a script calling S3', "python3 -c \"import urllib.request as u; u.urlopen('https://b.s3.amazonaws.com/k')\""],
    ['a signed link in a command', 'curl -o x "https://example.com/k?X-Amz-Signature=abc"'],
    ['reading an environment secret', 'echo $AWS_SECRET_ACCESS_KEY'],
    ['using an environment key', 'AWS_ACCESS_KEY_ID=x node app.js'],
    ['dumping the environment', 'printenv'],
    ['reading the credentials file', 'cat ~/.aws/credentials'],
    ['reading the SSO cache', 'ls ~/.aws/sso/cache'],
  ])('blocks %s', (_label, command) => {
    expect(exitOf(command)).toBe(2);
  });

  test.each([
    ['searching docs for a hostname', "grep -rn 'amazonaws.com' docs/runbooks"],
    ['writing a doc that names a command', "cat > docs/x.md <<'EOF'\nNo session runs aws s3 cp or curl https://b.s3.amazonaws.com/k.\nEOF"],
    ['a named variable', 'printenv HOME'],
    ['strict shell options', 'set -euo pipefail; npm test'],
    ['an env-prefixed test run', 'env NODE_ENV=test npx jest tests/unit/guards'],
  ])('allows %s', (_label, command) => {
    expect(exitOf(command)).toBe(0);
  });
});

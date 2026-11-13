/**
 * F-Tools-5 Amendment 1 (2026-11-13,
 * docs/audit/F-Tools-5_AgentProductionAccess_Ruling_Amendment1_2026-11-13.md) §5.
 *
 * In a cloud session whose AWS identity is `claude-code-ops`, the shell guard
 * (.claude/hooks/guard-dangerous-commands.js) lets a short list of reversible
 * load balancer and security-group commands through. The wall is that
 * identity's IAM policy, not the guard. Everything else gated is still
 * refused in the cloud, and the laptop is unchanged.
 *
 * The guard asks AWS who is calling. Here a stand-in `aws` on PATH answers,
 * so no test reaches AWS and the guard carries no test-only switch.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'guard-dangerous-commands.js');
const OPS = 'arn:aws:iam::637423256673:user/claude-code-ops';
const ADMIN = 'arn:aws:iam::637423256673:user/evoni-admin';

let shimDir;
beforeAll(() => {
  shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-aws-shim-'));
  // Answers `aws sts get-caller-identity` with FAKE_CALLER_ARN, or fails.
  fs.writeFileSync(path.join(shimDir, 'aws'), '#!/bin/sh\n[ -n "$FAKE_CALLER_ARN" ] || exit 255\necho "$FAKE_CALLER_ARN"\n', { mode: 0o755 });
  fs.writeFileSync(path.join(shimDir, 'aws.cmd'), '@echo off\r\nif "%FAKE_CALLER_ARN%"=="" exit /b 255\r\necho %FAKE_CALLER_ARN%\r\n');
});
afterAll(() => {
  fs.rmSync(shimDir, { recursive: true, force: true });
});

const decide = (command, { mode = 'auto', cloud = true, arn = OPS } = {}) => {
  const env = { ...process.env, CLAUDE_CODE_REMOTE: cloud ? 'true' : '', FAKE_CALLER_ARN: arn };
  const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
  env[pathKey] = `${shimDir}${path.delimiter}${env[pathKey] || ''}`;
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', permission_mode: mode, tool_input: { command } }),
    encoding: 'utf8',
    env,
  });
  if (r.status === 2) return 'deny';
  expect(r.status).toBe(0);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : 'pass';
};

const LISTED = [
  'aws elbv2 modify-listener --listener-arn arn:l --default-actions Type=redirect',
  'aws elbv2 create-rule --listener-arn arn:l --priority 5 --conditions Field=path-pattern,Values=/x --actions Type=forward,TargetGroupArn=arn:t',
  'aws elbv2 modify-rule --rule-arn arn:r --actions Type=forward,TargetGroupArn=arn:t',
  'aws elbv2 delete-rule --rule-arn arn:r',
  'aws elbv2 set-rule-priorities --rule-priorities RuleArn=arn:r,Priority=2',
  'aws elbv2 set-security-groups --load-balancer-arn arn:lb --security-groups sg-1',
  'aws elbv2 modify-target-group --target-group-arn arn:t --health-check-path /health',
  'aws elbv2 modify-target-group-attributes --target-group-arn arn:t --attributes Key=deregistration_delay.timeout_seconds,Value=30',
  'aws elbv2 register-targets --target-group-arn arn:t --targets Id=i-1,Port=3000',
  'aws elbv2 deregister-targets --target-group-arn arn:t --targets Id=i-1',
  'aws ec2 authorize-security-group-ingress --group-id sg-1 --protocol tcp --port 443 --cidr 0.0.0.0/0',
  'aws ec2 authorize-security-group-ingress --group-id sg-1 --protocol tcp --port 22 --cidr 203.0.113.7/32',
  'aws ec2 authorize-security-group-ingress --group-id sg-1 --ip-permissions IpProtocol=tcp,FromPort=3000,ToPort=3000,UserIdGroupPairs=[{GroupId=sg-2}]',
  'aws ec2 authorize-security-group-egress --group-id sg-1 --ip-permissions IpProtocol=tcp,FromPort=3000,ToPort=3000,UserIdGroupPairs=[{GroupId=sg-2}]',
  'aws ec2 revoke-security-group-ingress --group-id sg-1 --protocol tcp --port 80 --cidr 0.0.0.0/0',
  'aws ec2 revoke-security-group-egress --group-id sg-1 --ip-permissions IpProtocol=-1,IpRanges=[{CidrIp=0.0.0.0/0}]',
  'aws ec2 modify-security-group-rules --group-id sg-1 --security-group-rules SecurityGroupRuleId=sgr-1,SecurityGroupRule={IpProtocol=tcp,FromPort=443,ToPort=443,CidrIpv4=0.0.0.0/0}',
  'aws --region us-east-1 elbv2 delete-rule --rule-arn arn:r',
];

describe('guard hook: F-Tools-5 Amendment 1, the cloud list', () => {
  test.each(LISTED)('a cloud session as claude-code-ops may run: %s', (command) => {
    ['auto', 'dontAsk', 'bypassPermissions', 'default'].forEach((mode) => expect(decide(command, { mode })).toBe('pass'));
  });

  describe.each([
    ['the identity is not claude-code-ops', { arn: ADMIN }],
    ['AWS gives no answer about the identity', { arn: '' }],
    ['the session is on the laptop', { cloud: false }],
    ['the session is on the laptop, even as claude-code-ops', { cloud: false, arn: OPS }],
  ])('when %s', (_name, opts) => {
    test.each(LISTED.filter((c) => /b(modify|delete|deregister|revoke)-|authorize-security-group/.test(c)))('still gated: %s', (command) => {
      expect(decide(command, { ...opts, mode: 'auto' })).toBe('deny');
      expect(decide(command, { ...opts, mode: 'default' })).toBe('ask');
    });
  });

  test.each([
    'aws --profile admin elbv2 delete-rule --rule-arn arn:r',
    'aws elbv2 delete-rule --rule-arn arn:r --profile admin',
    'aws elbv2 delete-rule --rule-arn arn:r --endpoint-url https://example.invalid',
    'AWS_PROFILE=admin aws elbv2 delete-rule --rule-arn arn:r',
    'export AWS_ACCESS_KEY_ID=x; aws elbv2 delete-rule --rule-arn arn:r',
  ])('a command that chooses its own identity or endpoint is still gated: %s', (command) => {
    expect(decide(command)).toBe('deny');
  });

  test.each([
    'aws ec2 authorize-security-group-ingress --group-id sg-1 --protocol tcp --port 3002 --cidr 203.0.113.7/32',
    'aws ec2 authorize-security-group-ingress --group-id sg-1 --protocol tcp --port 5432 --source-group sg-2',
    'aws ec2 authorize-security-group-ingress --group-id sg-1 --protocol tcp --port 3000-3010 --cidr 203.0.113.7/32',
    'aws ec2 authorize-security-group-ingress --group-id sg-1 --protocol tcp --port 22 --cidr 0.0.0.0/0',
    'aws ec2 authorize-security-group-ingress --group-id sg-1 --ip-permissions IpProtocol=tcp,FromPort=22,ToPort=22,Ipv6Ranges=[{CidrIpv6=::/0}]',
    'aws ec2 authorize-security-group-ingress --group-id sg-1 --protocol all --cidr 203.0.113.7/32',
    'aws ec2 authorize-security-group-ingress --group-id sg-1 --ip-permissions IpProtocol=-1,IpRanges=[{CidrIp=10.0.0.0/8}]',
    'aws ec2 authorize-security-group-ingress --group-id sg-1 --ip-permissions IpProtocol=tcp,FromPort=5000,ToPort=6000,IpRanges=[{CidrIp=10.0.0.0/8}]',
    'aws ec2 modify-security-group-rules --group-id sg-1 --security-group-rules SecurityGroupRuleId=sgr-1,SecurityGroupRule={IpProtocol=tcp,FromPort=5432,ToPort=5432,CidrIpv4=10.0.0.0/8}',
  ])('refused in the cloud in every mode, the ports that stay closed: %s', (command) => {
    ['auto', 'bypassPermissions', 'default'].forEach((mode) => expect(decide(command, { mode })).toBe('deny'));
    expect(decide(command, { arn: ADMIN })).toBe('deny');
  });

  test.each([
    'aws ec2 authorize-security-group-ingress --group-id sg-1 --ip-permissions file://rule.json',
    'aws ec2 authorize-security-group-ingress --cli-input-json file://in.json',
    'aws ec2 authorize-security-group-ingress --group-id sg-1 --protocol tcp --port $PORT --cidr 203.0.113.7/32',
    'aws ec2 authorize-security-group-ingress --group-id sg-1 --source-group sg-2',
    'aws ec2 modify-security-group-rules --group-id sg-1 --security-group-rules "$(cat rule.txt)"',
  ])('an inbound rule the guard cannot read is still gated: %s', (command) => {
    expect(decide(command)).toBe('deny');
  });

  test.each([
    'aws elbv2 delete-load-balancer --load-balancer-arn arn:lb',
    'aws elbv2 delete-listener --listener-arn arn:l',
    'aws elbv2 delete-target-group --target-group-arn arn:t',
    'aws ec2 delete-security-group --group-id sg-1',
    'aws ec2 create-security-group --group-name x --description y',
    'aws ec2 terminate-instances --instance-ids i-1',
    'aws ec2 stop-instances --instance-ids i-1',
    'aws rds delete-db-snapshot --db-snapshot-identifier agent-1',
    'aws rds restore-db-instance-from-db-snapshot --db-instance-identifier x --db-snapshot-identifier agent-1',
    'aws iam put-user-policy --user-name claude-code-ops --policy-name p --policy-document file://p.json',
    'aws cognito-idp admin-delete-user --user-pool-id p --username u',
    'aws s3 rm s3://bucket/x',
    'gh variable set DEPLOY_SNAPSHOTS_PRUNE_DRY_RUN --body 1',
    'git push origin --delete claude/some-branch',
    'psql -h db -c "DROP TABLE users"',
  ])('everything else gated is still refused in the cloud as claude-code-ops: %s', (command) => {
    ['auto', 'dontAsk', 'bypassPermissions'].forEach((mode) => expect(decide(command, { mode })).toBe('deny'));
  });

  test.each([
    'aws rds create-db-snapshot --db-instance-identifier episode-control-dev --db-snapshot-identifier agent-20261113',
    'aws rds add-tags-to-resource --resource-name arn:aws:rds:us-east-1:637423256673:snapshot:agent-1 --tags Key=keep,Value=true',
    'aws elbv2 describe-rules --listener-arn arn:l',
    'aws ec2 describe-security-groups --group-ids sg-1',
  ])('never gated, in the cloud or on the laptop: %s', (command) => {
    expect(decide(command)).toBe('pass');
    expect(decide(command, { cloud: false, arn: ADMIN })).toBe('pass');
  });

  test('a listed command beside an unlisted gated one is still stopped', () => {
    expect(decide('aws elbv2 delete-rule --rule-arn arn:r && aws elbv2 delete-listener --listener-arn arn:l')).toBe('deny');
  });

  test('the guard holds no switch a test or a command could use to skip the identity check', () => {
    const src = fs.readFileSync(HOOK, 'utf8');
    expect(src).not.toMatch(/FAKE_CALLER_ARN|GUARD_TEST|SKIP_IDENTITY/);
    expect(src).toContain(OPS);
  });
});

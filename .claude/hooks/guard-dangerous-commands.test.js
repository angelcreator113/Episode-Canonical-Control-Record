#!/usr/bin/env node
// Test matrix for guard-dangerous-commands.js (F-Tools-5, 2026-10-31).
// Run: node .claude/hooks/guard-dangerous-commands.test.js
// Each case feeds the hook the JSON Claude Code sends on stdin and checks the
// decision: DENY (exit 2), ASK (an `ask` decision on stdout) or PASS (exit 0,
// no decision). Cases run in the default permission mode unless they say
// otherwise. Keep this file free of real commands: cases are data.
const { spawnSync } = require('child_process');
const path = require('path');
const HOOK = path.join(__dirname, 'guard-dangerous-commands.js');

const DENY = 'deny', ASK = 'ask', PASS = 'pass';
const cases = [
  // §1: production work Evoni asks for is not blocked.
  [PASS, 'ssh ubuntu@54.163.229.144'],
  [PASS, 'ssh ubuntu@box "pm2 list && pm2 logs episode-api --lines 50 --nostream"'],
  [PASS, 'sudo pm2 restart episode-api'],
  [PASS, 'scp ./dist.tar.gz ubuntu@box:/tmp/'],
  [PASS, 'aws ssm describe-parameters --region us-east-1'],
  [PASS, 'aws ec2 describe-instances --region us-east-1'],
  [PASS, 'aws s3 ls s3://bucket/episodes/'],
  [PASS, 'aws s3 cp s3://bucket/episodes/x/original.mp4 /tmp/x.mp4'],
  [PASS, 'aws s3api put-bucket-versioning --bucket b --versioning-configuration Status=Enabled'],
  [PASS, 'aws ssm send-command --document-name AWS-RunShellScript --targets Key=instanceids,Values=i-1 --parameters commands="pm2 status"'],
  [PASS, 'aws iam list-roles'],
  [PASS, 'psql -h db.example -U app -c "select count(*) from episodes"'],
  [PASS, 'ssh box "psql -c \'UPDATE episodes SET status = 1 WHERE id = 7\'"'],
  [PASS, 'gh workflow run deploy.yml -f target=main'],
  [PASS, 'gh run rerun 123 --failed'],
  [PASS, 'gh pr merge 3667 --squash'],
  [PASS, 'gh issue create --title x --body y'],
  [PASS, 'bash scripts/deploy-prod.sh'],
  [PASS, 'npm run migrate:up'],
  [PASS, 'curl -sS https://example.com/health'],
  [PASS, 'git status'],
  [PASS, 'git push -u origin claude/x'],
  [PASS, 'grep -rn "DROP TABLE" src/migrations | head'],
  [PASS, "cat > docs/runbooks/x.md <<'EOF'\nNever run aws s3 rm or DROP TABLE without a yes.\nEOF"],
  [PASS, 'git commit -m "docs: never cat .env or print AWS_SECRET_ACCESS_KEY"'],
  [PASS, 'printenv HOME'],
  [PASS, 'set -euo pipefail; npm test'],
  [PASS, 'env NODE_ENV=test npx jest tests/unit/hooks'],
  [PASS, 'cat .env.example'],
  [PASS, 'export TOKEN=$(gh auth token)'],
  [PASS, 'PGPASSWORD=$(aws secretsmanager get-secret-value --secret-id x --query SecretString --output text) psql -c "select 1"'],
  [PASS, "aws cognito-idp describe-user-pool-client --user-pool-id p --client-id c --query 'UserPoolClient.{Id:ClientId,Name:ClientName}'"],
  [PASS, 'grep -n "aws\\|ssh" docs/runbooks/deploy-workflow.md'],
  // Naming a credential variable is not printing it (docs, settings, a value passed through the environment).
  [PASS, "python3 - <<'EOF'\nopen('DEVELOPMENT_WORKFLOW.md','a').write('Set AWS_ACCESS_KEY_ID in the environment secrets.')\nEOF"],
  [PASS, 'AWS_PROFILE=prime aws s3 ls'],
  [DENY, 'printf "%s" "$GITHUB_TOKEN"'],

  // §5: a secret is never printed (every mode).
  [DENY, 'printenv'],
  [DENY, 'env | grep -i key'],
  [DENY, 'echo $AWS_SECRET_ACCESS_KEY'],
  [DENY, 'printenv AWS_ACCESS_KEY_ID'],
  [DENY, 'echo "$DB_PASSWORD"'],
  [DENY, 'cat .env'],
  [DENY, 'ssh box "cat /home/ubuntu/episode-metadata/.env"'],
  [DENY, 'cat ~/.episode-readonly.env'],
  [DENY, 'cat ~/.aws/credentials'],
  [DENY, 'ls ~/.aws/sso/cache'],
  [DENY, 'cat ~/.config/gh/hosts.yml'],
  [DENY, 'curl -o x "https://example.com/k?X-Amz-Signature=abc"'],
  [DENY, 'aws configure export-credentials --format env'],
  [DENY, 'aws sts get-session-token'],
  [DENY, 'aws sts assume-role --role-arn arn --role-session-name s'],
  [DENY, 'aws iam create-access-key --user-name u'],
  [DENY, 'aws ssm get-parameter --name /x --with-decryption'],
  [DENY, 'aws secretsmanager get-secret-value --secret-id x'],
  [DENY, 'aws ecr get-login-password'],
  [DENY, 'aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id c'],
  [DENY, 'aws cognito-idp describe-user-pool-client --user-pool-id p --client-id c'],
  [DENY, 'gh auth token'],
  [DENY, 'gh auth status --show-token'],

  // F-Tools-2 Amendment 1 §2: the database snapshot is schedule-only (every mode).
  [DENY, 'gh workflow run diagnostics.yml -f check=db-snapshot'],
  [DENY, 'gh workflow run Diagnostics --ref main -f check=db-samples'],
  [DENY, 'gh api -X POST repos/o/r/actions/workflows/diagnostics.yml/dispatches -f ref=main -f inputs[check]=db-snapshot'],
  [DENY, 'aws ssm send-command --document-name PrimeStudios-Diagnostics --instance-ids i-1 --parameters check=db-snapshot,sha=abc'],
  [PASS, 'gh workflow run diagnostics.yml -f check=db-schema'],
  [PASS, 'gh workflow run diagnostics.yml -f check=db-counts'],
  [PASS, 'gh run list --workflow diagnostics.yml'],
  [PASS, 'grep -n "db-snapshot" scripts/diagnostics/runner.sh'],

  // Git conventions (every mode).
  [DENY, 'git push origin main'],
  [DENY, 'git push origin HEAD:main'],
  [DENY, 'git push --force origin claude/x'],

  // §4: deletes and irreversible changes ask first.
  [ASK, 'aws s3 rm s3://bucket/episodes/x/cutout.webm'],
  [ASK, 'aws s3 rb s3://bucket --force'],
  [ASK, 'aws s3 sync ./out s3://bucket/episodes/'],
  [ASK, 'aws s3 sync s3://bucket/x ./local --delete'],
  [ASK, 'aws s3 cp ./x.mp4 s3://bucket/episodes/x.mp4'],
  [ASK, 'aws s3api delete-objects --bucket b --delete file://d.json'],
  [ASK, 'aws s3api put-bucket-policy --bucket b --policy file://p.json'],
  [ASK, 'aws s3api put-bucket-versioning --bucket b --versioning-configuration Status=Suspended'],
  [ASK, 'aws ec2 terminate-instances --instance-ids i-1'],
  [ASK, 'aws ec2 stop-instances --instance-ids i-1'],
  [ASK, 'aws ec2 modify-instance-attribute --instance-id i-1 --instance-type t3.large'],
  [ASK, 'aws ec2 authorize-security-group-ingress --group-id sg-1 --protocol tcp --port 22 --cidr 0.0.0.0/0'],
  [ASK, 'aws rds delete-db-snapshot --db-snapshot-identifier x'],
  [ASK, 'aws rds modify-db-instance --db-instance-identifier x --backup-retention-period 0'],
  [ASK, 'aws rds restore-db-instance-from-db-snapshot --db-instance-identifier y --db-snapshot-identifier s'],
  [ASK, 'aws iam attach-role-policy --role-name r --policy-arn arn'],
  [ASK, 'aws cognito-idp admin-delete-user --user-pool-id p --username u'],
  [ASK, 'aws cognito-idp update-user-pool-client --user-pool-id p --client-id c'],
  [ASK, 'aws kms schedule-key-deletion --key-id k'],
  [ASK, 'aws secretsmanager put-secret-value --secret-id x --secret-string file://s'],
  [ASK, 'aws ssm put-parameter --name /x --value y --overwrite'],
  [ASK, 'psql -h db -c "DROP TABLE users"'],
  [ASK, 'psql -h db -c "TRUNCATE episodes"'],
  [ASK, 'psql -h db -c "ALTER TABLE episodes DROP COLUMN title"'],
  [ASK, 'ssh box "psql -c \'DELETE FROM sessions\'"'],
  [ASK, 'ssh box "psql -c \'UPDATE users SET role = 1\'"'],
  [ASK, "ssh box psql <<'SQL'\nDROP TABLE episodes;\nSQL"],
  [ASK, 'psql -h db -f cleanup.sql'],
  [ASK, 'pg_restore -d prod dump.backup'],
  [ASK, 'npx sequelize-cli db:migrate:undo'],
  [ASK, 'npm run migrate:undo'],
  [ASK, 'DB_SYNC_FORCE=true npm start'],
  [ASK, 'dropdb episodes'],
  [ASK, 'ssh box "rm -rf /home/ubuntu/episode-metadata/uploads"'],
  [ASK, 'ssh box "pm2 delete episode-api"'],
  [ASK, 'gh repo delete angelcreator113/x --yes'],
  [ASK, 'gh release delete v1'],
  [ASK, 'gh secret set DEPLOY_KEY < key'],
  [ASK, 'gh variable delete DIAG_ENABLED'],
  [ASK, 'gh api -X DELETE repos/o/r/git/refs/heads/x'],
  [ASK, 'gh api -X PUT repos/o/r/environments/production'],
  [ASK, 'git push origin --delete claude/old'],
  [ASK, 'git push origin :claude/old'],
  [ASK, 'xargs -n1 aws s3 rm'],
  [ASK, 'bash -c "aws ec2 terminate-instances --instance-ids i-1"'],
];

// The same gated actions are refused where a prompt may not reach Evoni.
const automatic = [
  ['auto', 'aws s3 rm s3://bucket/x'],
  ['dontAsk', 'psql -h db -c "DROP TABLE users"'],
  ['bypassPermissions', 'gh repo delete o/r --yes'],
  ['auto', 'gh workflow run diagnostics.yml -f check=db-snapshot'],
];

const decide = (command, mode = 'default') => {
  const input = JSON.stringify({ tool_name: 'Bash', permission_mode: mode, tool_input: { command } });
  const r = spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8' });
  if (r.status === 2) return DENY;
  if (r.status !== 0) return `exit ${r.status}`;
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : PASS;
};

let failed = 0;
const check = (want, got, label) => {
  const ok = want === got;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} want=${want} got=${got} :: ${label.split('\n')[0].slice(0, 80)}`);
};
for (const [want, command] of cases) check(want, decide(command), command);
for (const [mode, command] of automatic) check(DENY, decide(command, mode), `[${mode}] ${command}`);
console.log(failed ? `\n${failed} case(s) failed` : '\nall cases passed');
process.exit(failed ? 1 : 0);

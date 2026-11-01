// ============================================================================
// The Diagnostics workflow (F-Tools-2, Evoni's ruling 2026-10-29).
// ============================================================================
// Level 1, standing read-only production checks. These tests prove, without
// touching AWS, the box or production:
//   1. the workflow, the SSM document and the scripts agree on one fixed list
//      of checks, and nothing else can be passed in;
//   2. the IAM policy allows only reads (plus SendCommand for the diagnostics
//      document) and explicitly denies object reads, secrets and writes;
//   3. nothing a check prints reaches the public Actions log: the collect step
//      prints only a size and an exit code, and publish.sh only a path and a
//      checksum, and refuses a repository that is not private;
//   4. output is masked (keys, tokens, passwords, emails, IPs);
//   5. the self-test reports PASS only when IAM refuses, and FAIL otherwise;
//   6. the read-only database role in sql/readonly-role.sql refuses every
//      write (against a scratch database, when TEST_DATABASE_URL is set).
// `aws`, `pm2`, `curl`, `systemctl` and `id` are stubs on PATH; the real ones
// are never called.
// ============================================================================

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..', '..');
const DIAG = path.join(ROOT, 'scripts', 'diagnostics');
const WORKFLOW = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'diagnostics.yml'), 'utf8');
const SSM_DOC = JSON.parse(fs.readFileSync(path.join(DIAG, 'ssm-document.json'), 'utf8'));
const POLICY = JSON.parse(fs.readFileSync(path.join(DIAG, 'iam', 'readonly-permissions-policy.json'), 'utf8'));
const TRUST = JSON.parse(fs.readFileSync(path.join(DIAG, 'iam', 'readonly-trust-policy.json'), 'utf8'));
const RUNNER = fs.readFileSync(path.join(DIAG, 'runner.sh'), 'utf8');
const ONBOX = fs.readFileSync(path.join(DIAG, 'on-box.sh'), 'utf8');
const { redact } = require('../../../scripts/diagnostics/redact');
const dbCheck = require('../../../scripts/diagnostics/db-check');

const SHA = 'a'.repeat(40);
const NODE_DIR = path.dirname(process.execPath);
const BOX_CHECKS = ['health', 'deploy-state', 'app-logs', 'worker-logs', 'nginx-logs', 'db', 'db-schema', 'db-counts', 'self-test',
  'db-snapshot'];
// What a session may dispatch. db-snapshot is schedule-only (F-Tools-2 Amendment 1 §2), so it is a
// runner check but never a dispatch option.
const ALL_CHECKS = ['overview', 'health', 'deploy-state', 'app-logs', 'worker-logs', 'nginx-logs', 'db', 'db-schema',
  'db-counts', 'aws-infra', 's3-config', 'cognito-config', 'self-test'];
const RUNNER_CHECKS = [...ALL_CHECKS, 'db-snapshot'];
// Values in the shapes the masking must catch. None may appear in any output.
const SECRET_KEY_ID = `AKIA${'Q'.repeat(16)}`;
const SECRETS = [SECRET_KEY_ID, 'hunter2-password', 'person@example.com', '203.0.113.9', 'sk-ant-api03-abcdefghijkl'];

function tmpdir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'diag-test-')); }

/** Writes an executable stub into dir. */
function stub(dir, name, body) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, `#!/usr/bin/env bash\n${body}\n`);
  fs.chmodSync(p, 0o755);
  return p;
}

/** The lines of a step's `run: |` block, de-indented. */
function stepRun(name) {
  const lines = WORKFLOW.split('\n');
  const at = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  if (at === -1) throw new Error(`step not found: ${name}`);
  const runAt = lines.findIndex((l, i) => i > at && /^\s+run: \|$/.test(l));
  const indent = lines[runAt].match(/^\s*/)[0].length;
  const out = [];
  for (const l of lines.slice(runAt + 1)) {
    if (l.trim() && l.match(/^\s*/)[0].length <= indent) break;
    out.push(l.slice(indent + 2));
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
describe('one fixed list of checks', () => {
  test('the workflow starts by hand or from its one daily schedule, on main, when DIAG_ENABLED, in prod-readonly', () => {
    const triggers = WORKFLOW.split('\n').filter((l) => /^ {2}[a-z_]+:/.test(l) && WORKFLOW.indexOf(l) < WORKFLOW.indexOf('\npermissions:'))
      .map((l) => l.trim().replace(/:.*/, ''));
    expect(triggers).toEqual(['schedule', 'workflow_dispatch']);
    expect([...WORKFLOW.matchAll(/^\s+- cron: '([^']+)'$/gm)].map((m) => m[1])).toEqual(['17 6 * * *']);
    expect(WORKFLOW).not.toMatch(/^\s+(push|pull_request|pull_request_target|workflow_run):/m);
    expect(WORKFLOW).toContain("    if: vars.DIAG_ENABLED == 'true' && github.ref == 'refs/heads/main'");
    expect(WORKFLOW).toContain('    environment: prod-readonly');
    expect(WORKFLOW).not.toMatch(/environment: production/);
  });

  test('the dispatch input is a choice whose options are exactly the runner checks', () => {
    const opts = WORKFLOW.split('options:\n')[1].split('\n\n')[0].split('\n')
      .map((l) => l.trim()).filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
    expect(WORKFLOW).toMatch(/type: choice/);
    expect(opts).toEqual(ALL_CHECKS);
    expect(opts).not.toContain('db-snapshot');
    expect(RUNNER).toContain(`  ${RUNNER_CHECKS.join('|')}) ;;`);
  });

  test('a scheduled run is always the snapshot; the runner refuses the snapshot from any other event', () => {
    expect(WORKFLOW).toContain("      CHECK: ${{ github.event_name == 'schedule' && 'db-snapshot' || inputs.check }}");
    expect(RUNNER).toMatch(/if \[ "\$CHECK" = "db-snapshot" \] && \[ "\$\{GITHUB_EVENT_NAME:-\}" != "schedule" \]; then/);
  });

  test('the SSM document accepts exactly the on-box checks, a full SHA and the snapshot page numbers, and nothing else', () => {
    expect(Object.keys(SSM_DOC.parameters).sort()).toEqual(['check', 'page', 'run', 'sha']);
    expect(SSM_DOC.parameters.page.allowedPattern).toBe('^[0-9]{1,3}$');
    expect(SSM_DOC.parameters.run.allowedPattern).toBe('^[0-9]{1,20}$');
    expect(SSM_DOC.parameters.check.allowedValues).toEqual(BOX_CHECKS);
    expect(SSM_DOC.parameters.sha.allowedPattern).toBe('^[0-9a-f]{40}$');
    expect(ONBOX).toContain(`  ${BOX_CHECKS.join('|')}) ;;`);
  });

  test('the SSM document runs as ubuntu, only scripts from a commit on origin/main, with a short timeout', () => {
    const [step] = SSM_DOC.mainSteps;
    expect(SSM_DOC.mainSteps).toHaveLength(1);
    expect(step.action).toBe('aws:runShellScript');
    expect(Number(step.inputs.timeoutSeconds)).toBeLessThanOrEqual(120);
    const cmd = step.inputs.runCommand.join('\n');
    expect(cmd).toMatch(/^sudo -u ubuntu -H bash -c /);
    expect(cmd).toContain('git merge-base --is-ancestor {{ sha }} origin/main');
    expect(cmd).toContain('git archive {{ sha }} scripts/diagnostics');
    expect(cmd).toContain('on-box.sh" {{ check }} {{ sha }} {{ page }} {{ run }}');
    // It never checks out, resets or pulls the live tree.
    expect(cmd).not.toMatch(/git (checkout|reset|pull|merge |clean)/);
  });

  test('every runner box() call names an on-box check', () => {
    const calls = [...RUNNER.matchAll(/(?:^|;|\$\()\s*box ([a-z-]+|"\$CHECK")/gm)].map((m) => m[1]);
    expect(calls).toContain('db-snapshot');
    expect(calls.length).toBeGreaterThan(3);
    for (const c of calls.filter((x) => x !== '"$CHECK"')) expect(BOX_CHECKS).toContain(c);
  });
});

// ---------------------------------------------------------------------------
describe('the read-only role', () => {
  const allows = POLICY.Statement.filter((s) => s.Effect === 'Allow');
  const allowed = allows.flatMap((s) => s.Action);
  const denied = POLICY.Statement.filter((s) => s.Effect === 'Deny').flatMap((s) => s.Action);

  test('only a job in the prod-readonly environment of this repository can assume it', () => {
    const [st] = TRUST.Statement;
    expect(TRUST.Statement).toHaveLength(1);
    expect(st.Action).toBe('sts:AssumeRoleWithWebIdentity');
    expect(st.Condition.StringEquals['token.actions.githubusercontent.com:sub'])
      .toBe('repo:angelcreator113/Episode-Canonical-Control-Record:environment:prod-readonly');
    expect(st.Condition.StringEquals['token.actions.githubusercontent.com:aud']).toBe('sts.amazonaws.com');
    expect(JSON.stringify(TRUST)).not.toMatch(/StringLike|\*/);
  });

  test('every allowed action is a read, except SendCommand for the diagnostics document', () => {
    for (const a of allowed) {
      if (a === 'ssm:SendCommand') continue;
      expect(a).toMatch(/^[a-z0-9-]+:(Describe|List|Get)[A-Za-z]*$/);
      expect(a).not.toMatch(/\*/);
    }
    const send = allows.find((s) => [].concat(s.Action).includes('ssm:SendCommand'));
    expect([].concat(send.Action)).toEqual(['ssm:SendCommand']);
    expect(send.Resource).toEqual([
      'arn:aws:ssm:us-east-1:637423256673:document/PrimeStudios-Diagnostics',
      'arn:aws:ec2:us-east-1:637423256673:instance/<EC2_INSTANCE_ID>',
    ]);
    expect(JSON.stringify(send)).not.toMatch(/AWS-RunShellScript|document\/\*/);
  });

  test('nothing allowed can read an object, a secret, a parameter, users, or a function', () => {
    for (const a of allowed) {
      expect(a).not.toMatch(/^s3:GetObject|^secretsmanager:|^ssm:GetParameter|^kms:|^iam:|^lambda:/);
      expect(a).not.toMatch(/^cognito-idp:(ListUsers|Admin|DescribeUserPoolClient)/);
      expect(a).not.toMatch(/^ec2:(DescribeInstanceAttribute|GetPasswordData|GetConsoleOutput)$/);
    }
  });

  test('an explicit Deny covers object reads, secrets, shell sessions, IAM and every write family', () => {
    for (const a of ['s3:GetObject*', 's3:Put*', 's3:Delete*', 'ssm:GetParameter*', 'ssm:StartSession',
      'secretsmanager:GetSecretValue', 'kms:Decrypt', 'iam:*', 'sts:AssumeRole', 'ec2:DescribeInstanceAttribute',
      'lambda:GetFunction*', 'cognito-idp:Admin*', 'cognito-idp:ListUsers', 'cognito-idp:DescribeUserPoolClient',
      'rds:Create*', 'rds:Modify*', 'rds:Delete*', 'ec2:Stop*', 'ec2:Terminate*', 'ec2:Modify*', 'sqs:ReceiveMessage']) {
      expect(denied).toContain(a);
    }
    expect(POLICY.Statement.find((s) => s.Effect === 'Deny').Resource).toBe('*');
  });

  test('the workflow assumes it for 15 minutes as diag-<run id>, with OIDC, and holds no stored key', () => {
    expect(WORKFLOW).toContain('role-to-assume: ${{ secrets.AWS_READONLY_ROLE_ARN }}');
    expect(WORKFLOW).toContain('role-session-name: diag-${{ github.run_id }}');
    expect(WORKFLOW).toContain('role-duration-seconds: 900');
    expect(WORKFLOW).toMatch(/permissions:\n {6}contents: read\n {6}id-token: write/);
    expect(WORKFLOW).not.toMatch(/aws-access-key-id|aws-secret-access-key|AWS_SECRET_ACCESS_KEY/);
    expect(WORKFLOW).not.toMatch(/secrets\.AWS_ROLE_ARN/); // the Deploy role
  });
});

// ---------------------------------------------------------------------------
describe('masking', () => {
  test('keys, tokens, passwords, connection strings, emails and IPs are masked', () => {
    const text = [
      `aws key ${SECRET_KEY_ID} and ASIA${'R'.repeat(16)}`,
      'DB_PASSWORD=hunter2-password',
      '"password": "hunter2-password", "apiKey": "abc123"',
      'Authorization: Bearer abc.def.ghi-123456',
      'postgres://admin:hunter2-password@db.internal:5432/x',
      'jwt eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4',
      'from person@example.com at 203.0.113.9',
      'https://bucket.s3.amazonaws.com/k?X-Amz-Signature=deadbeefdeadbeef&X-Amz-Credential=AKIAxyz',
      'key sk-ant-api03-abcdefghijkl, ghp_abcdefghijklmnopqrstuvwxyz12',
      '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXk\n-----END OPENSSH PRIVATE KEY-----',
    ].join('\n');
    const out = redact(text);
    for (const s of [...SECRETS, 'abc123', 'abc.def.ghi-123456', 'eyJhbGci', 'deadbeef', 'ghp_', 'b3BlbnNzaC1rZXk', 'RRRRRRRR']) {
      expect(out).not.toContain(s);
    }
    expect(out).toContain('[aws-key-id]');
    expect(out).toContain('[email]');
    expect(out).toContain('[ip]');
    expect(out).toContain('[private-key]');
  });

  test('ordinary diagnostic text passes unchanged', () => {
    const text = 'episode-api-prod-hotfix: online; restarts 3; memory 210 MB\nmigrations: 211 applied; 0 pending';
    expect(redact(text)).toBe(text);
  });

  test('long lines are cut and the total is capped', () => {
    expect(redact('x'.repeat(1000))).toMatch(/^x{400} …\[cut\]$/);
    const out = redact(Array(100).fill('y'.repeat(100)).join('\n'), 2000);
    expect(Buffer.byteLength(out)).toBeLessThan(2100);
    expect(out).toMatch(/output cut at 2000 bytes/);
  });
});

// ---------------------------------------------------------------------------
describe('on-box.sh (the server half)', () => {
  function box(check, { env = {}, setup } = {}) {
    const tmp = tmpdir();
    const bin = path.join(tmp, 'bin');
    fs.mkdirSync(bin);
    stub(bin, 'id', 'case "$1" in -u) echo 1000 ;; -un) echo ubuntu ;; *) echo "uid=1000(ubuntu)" ;; esac');
    stub(bin, 'systemctl', 'echo active');
    const app = path.join(tmp, 'app');
    fs.mkdirSync(path.join(app, 'logs'), { recursive: true });
    if (setup) setup({ tmp, bin, app });
    const res = spawnSync('bash', [path.join(DIAG, 'on-box.sh'), check, env.SHA || SHA], {
      env: { PATH: `${bin}:${NODE_DIR}:/usr/bin:/bin`, HOME: tmp, NVM_DIR: path.join(tmp, 'nvm'), APP_DIR: app, NGINX_LOG_DIR: path.join(tmp, 'nginx'), ...env },
      encoding: 'utf8',
    });
    fs.rmSync(tmp, { recursive: true, force: true });
    return res;
  }

  test.each([
    ['an unknown check', 'rm-rf', {}],
    ['a short SHA', 'health', { SHA: 'abc123' }],
    ['a Claude Code session', 'health', { CLAUDECODE: '1' }],
  ])('refuses %s', (_, check, env) => {
    const res = box(check, { env });
    expect(res.status).toBe(2);
    expect(res.stdout).toMatch(/^REFUSED/);
  });

  test('refuses to run as root', () => {
    const res = box('health', { setup: ({ bin }) => stub(bin, 'id', 'case "$1" in -u) echo 0 ;; *) echo root ;; esac') });
    expect(res.status).toBe(2);
    expect(res.stdout).toMatch(/REFUSED: run as ubuntu/);
  });

  test('app-logs prints the log tails with secrets and personal data masked', () => {
    const res = box('app-logs', {
      setup: ({ app }) => {
        fs.writeFileSync(path.join(app, 'logs', 'error.log'),
          `ok line\nError: login failed for person@example.com from 203.0.113.9 password=hunter2-password key ${SECRET_KEY_ID}\n`);
        fs.writeFileSync(path.join(app, 'logs', 'out.log'), 'server listening\n');
      },
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('login failed for [email] from [ip]');
    expect(res.stdout).toContain('server listening');
    for (const s of SECRETS.slice(0, 4)) expect(res.stdout).not.toContain(s);
  });

  test('health works while the API is down, prints only chosen pm2 fields, and reports the failure', () => {
    const res = box('health', {
      setup: ({ bin }) => {
        stub(bin, 'pm2', `echo '[{"name":"episode-api-prod-hotfix","pm2_env":{"status":"errored","restart_time":15,"DB_PASSWORD":"hunter2-password","ANTHROPIC_API_KEY":"sk-ant-api03-abcdefghijkl"},"monit":{"memory":0,"cpu":0}}]'`);
        stub(bin, 'curl', 'echo "curl: (7) Failed to connect to localhost port 3000"; printf "\\n000"');
      },
    });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('episode-api-prod-hotfix: errored; restarts 15');
    expect(res.stdout).toContain('http status: 000');
    expect(res.stdout).toContain('nginx: active');
    expect(res.stdout).toMatch(/on-box result: problems found/);
    expect(res.stdout).not.toContain('hunter2-password');
    expect(res.stdout).not.toContain('sk-ant');
  });

  test('db reports "not configured" (and fails) when the read-only credential file is missing', () => {
    const res = box('db');
    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/not configured: .*\.episode-readonly\.env does not exist/);
  });

  test('output is capped below the SSM limit', () => {
    const res = box('app-logs', {
      setup: ({ app }) => fs.writeFileSync(path.join(app, 'logs', 'error.log'), `${'z'.repeat(390)}\n`.repeat(200)),
    });
    expect(Buffer.byteLength(res.stdout)).toBeLessThan(24000);
  });
});

// ---------------------------------------------------------------------------
// A stub `aws` that answers like IAM with the read-only policy applied: reads
// succeed, everything the self-test probes is refused unless ALLOW_<OP>=1.
const AWS_STUB = `
echo "$*" >>"$CALLS"
op="$1 $2"
deny() { echo "An error occurred (AccessDenied) when calling the $2 operation: User is not authorized to perform $1:$2 with an explicit deny" >&2; exit 254; }
case "$op" in
  "sts get-caller-identity") echo "arn:aws:sts::637423256673:assumed-role/PrimeStudios-ReadOnly-GHA/diag-42" ;;
  "ssm describe-instance-information") echo "\${PING:-Online}" ;;
  "ssm send-command")
    case "$*" in *AWS-RunShellScript*) deny ssm SendCommand ;; esac
    echo cmd-123 ;;
  "ssm get-command-invocation")
    case "$*" in
      *"Query Status"*|*"--query Status"*) echo Success ;;
      *StandardOutputContent*) printf 'PASS runs as ubuntu\\nleak ${SECRET_KEY_ID} person@example.com\\n' ;;
      *) echo None ;;
    esac ;;
  "s3api list-objects-v2")
    case "$*" in
      *"Contents[0].Key"*)
        [ -n "\${LIST_FAIL:-}" ] && deny s3 ListBucket
        [ -n "\${LIST_EMPTY:-}" ] && { echo None; exit 0; }
        [ -n "\${LIST_MULTILINE:-}" ] && { printf 'media/clip.mp4\\nNone\\n'; exit 0; }
        case "$*" in
          *"--max-keys 1 --no-paginate"*) echo "media/clip.mp4" ;;
          *) printf 'media/clip.mp4\\nNone\\n' ;;
        esac ;;
      *) echo 1 ;;
    esac ;;
  "s3api put-object") [ -n "\${ALLOW_PUT:-}" ] && { echo '{"ETag":"x"}'; exit 0; }; deny s3 PutObject ;;
  "s3api get-object"|"s3api head-object")
    [ -n "\${READ_NOT_FOUND:-}" ] && { echo "An error occurred (NoSuchKey) when calling the $2 operation" >&2; exit 254; }
    [ -n "\${ALLOW_READ:-}" ] && { echo '{}'; exit 0; }
    if [ "$2" = head-object ]; then
      [ -n "\${HEAD_UNEXPECTED:-}" ] && { echo 'Connection timed out at https://example.test/media/clip.mp4' >&2; exit 255; }
      echo "An error occurred (\${HEAD_CODE:-403}) when calling the HeadObject operation: \${HEAD_MESSAGE:-Forbidden}" >&2
      exit 254
    fi
    [ -n "\${GET_HTTP_403:-}" ] && { echo 'An error occurred (403) when calling the GetObject operation: Forbidden' >&2; exit 254; }
    case "$*" in
      *$'\\n'*) echo "An error occurred (NoSuchKey) when calling the $2 operation" >&2; exit 254 ;;
    esac
    deny s3 "$2" ;;
  "s3api delete-object") deny s3 "$2" ;;
  "ssm get-parameter") deny ssm GetParameter ;;
  "secretsmanager get-secret-value") deny secretsmanager GetSecretValue ;;
  "ec2 stop-instances") echo "An error occurred (UnauthorizedOperation) when calling the StopInstances operation" >&2; exit 254 ;;
  "ec2 describe-instance-attribute") deny ec2 DescribeInstanceAttribute ;;
  "rds create-db-snapshot")
    [ -n "\${ALLOW_SNAPSHOT:-}" ] && { echo "An error occurred (DBInstanceNotFound) when calling the CreateDBSnapshot operation" >&2; exit 254; }
    deny rds CreateDBSnapshot ;;
  "rds modify-db-instance") deny rds ModifyDBInstance ;;
  "iam list-users") deny iam ListUsers ;;
  "lambda list-functions") deny lambda ListFunctions ;;
  "cognito-idp list-users") deny cognito-idp ListUsers ;;
  "cognito-idp describe-user-pool-client") deny cognito-idp DescribeUserPoolClient ;;
  *) echo "{}" ;;
esac
`;

function runner(check, env = {}) {
  const tmp = tmpdir();
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  stub(bin, 'aws', AWS_STUB);
  stub(bin, 'curl', 'printf \'{"status":"ok"}\\n200 0.1s\'');
  const calls = path.join(tmp, 'calls');
  fs.writeFileSync(calls, '');
  const res = spawnSync('bash', [path.join(DIAG, 'runner.sh'), check], {
    env: {
      PATH: `${bin}:${NODE_DIR}:/usr/bin:/bin`, HOME: tmp, CALLS: calls, POLL_S: '0', GITHUB_RUN_ID: '42',
      AWS_REGION: 'us-east-1', EC2_INSTANCE_ID: 'i-0123456789abcdef0', RDS_INSTANCE_ID: 'episode-control-dev',
      TARGET_SHA: SHA, DIAG_S3_BUCKETS: 'studio-bucket', DIAG_COGNITO_POOL_ID: 'us-east-1_abc', HEALTH_URL: 'https://example.test/health',
      ...env,
    },
    encoding: 'utf8',
  });
  res.calls = fs.readFileSync(calls, 'utf8');
  fs.rmSync(tmp, { recursive: true, force: true });
  return res;
}

describe('runner.sh (the AWS half) and the self-test', () => {
  test('refuses in a Claude Code session before any aws call', () => {
    const res = runner('self-test', { CLAUDECODE: '1' });
    expect(res.status).toBe(2);
    expect(res.calls).toBe('');
  });

  test('refuses an unknown check', () => {
    const res = runner('anything; rm -rf /');
    expect(res.status).toBe(2);
    expect(res.calls).toBe('');
  });

  test('with the read-only policy, every probe passes: reads work, writes/secrets/object reads are refused', () => {
    const res = runner('self-test');
    expect(res.stdout).not.toMatch(/^FAIL/m);
    for (const label of ['short-lived session of PrimeStudios-ReadOnly-GHA', 'write an object to studio-bucket: refused',
      "read an object's contents from studio-bucket: refused", 'read an SSM parameter: refused',
      'read a Secrets Manager secret: refused', 'run an arbitrary shell command (AWS-RunShellScript): refused',
      'stop the production instance (dry run): refused', 'create a database snapshot: refused',
      'list Cognito users: refused', 'read an app client (it carries the client secret): refused']) {
      expect(res.stdout).toContain(`PASS ${label}`);
    }
    expect(res.status).toBe(0);
  });

  test('if the role could write an object, the self-test fails loudly', () => {
    const res = runner('self-test', { ALLOW_PUT: '1' });
    expect(res.stdout).toContain('FAIL write an object to studio-bucket: it SUCCEEDED');
    expect(res.status).toBe(1);
  });

  test('recognizes the bodyless HeadObject 403 Forbidden response as refusal', () => {
    const res = runner('self-test');
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("PASS read an object's metadata (needs GetObject) from studio-bucket: refused");
  });

  test.each(['400', '404', '405', '412', '500'])('HeadObject HTTP %s remains a failure and reports its numeric code', (code) => {
    const res = runner('self-test', { HEAD_CODE: code });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain(`FAIL read an object's metadata (needs GetObject) from studio-bucket: not refused by IAM ((${code}))`);
  });

  test('does not classify an unrelated HeadObject 403 message as the documented Forbidden response', () => {
    const res = runner('self-test', { HEAD_MESSAGE: 'Unexpected response' });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain("FAIL read an object's metadata (needs GetObject) from studio-bucket: not refused by IAM ((403))");
  });

  test('unexpected HeadObject errors still fail without exposing raw error text or object keys', () => {
    const res = runner('self-test', { HEAD_UNEXPECTED: '1' });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain("FAIL read an object's metadata (needs GetObject) from studio-bucket: not refused by IAM (unexpected error)");
    expect(res.stdout).not.toContain('example.test/media/clip.mp4');
  });

  test('does not extend numeric HTTP refusal recognition to GetObject', () => {
    const res = runner('self-test', { GET_HTTP_403: '1' });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain("FAIL read an object's contents from studio-bucket: not refused by IAM ((403))");
  });

  test('successful object reads still fail both refusal checks', () => {
    const res = runner('self-test', { ALLOW_READ: '1' });
    expect(res.status).toBe(1);
    for (const label of ["read an object's contents", "read an object's metadata (needs GetObject)"]) {
      expect(res.stdout).toContain(`FAIL ${label} from studio-bucket: it SUCCEEDED, so the role is allowed to do it`);
    }
  });

  test('selects one service-bounded key without CLI pagination for both object-read probes', () => {
    const res = runner('self-test');
    expect(res.status).toBe(0);
    expect(res.calls).toContain('s3api list-objects-v2 --bucket studio-bucket --max-keys 1 --no-paginate --query Contents[0].Key --output text');
    expect(res.calls).toContain('s3api get-object --bucket studio-bucket --key media/clip.mp4 /dev/null');
    expect(res.calls).toContain('s3api head-object --bucket studio-bucket --key media/clip.mp4');
    expect(res.stdout).not.toContain('media/clip.mp4');
  });

  test.each([
    [{ LIST_FAIL: '1' }, 'listing failed'],
    [{ LIST_EMPTY: '1' }, 'no object found'],
    [{ LIST_MULTILINE: '1' }, 'expected one single-line key'],
  ])('fails explicitly without object reads when selection is invalid: %s', (env, reason) => {
    const res = runner('self-test', env);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain(`FAIL select an object from studio-bucket: ${reason}; object-read refusals were not tested`);
    expect(res.calls).not.toMatch(/s3api (get-object|head-object)/);
    expect(res.stdout).not.toContain('media/clip.mp4');
  });

  test('missing-object errors still fail both refusal checks instead of passing as IAM denials', () => {
    const res = runner('self-test', { READ_NOT_FOUND: '1' });
    expect(res.status).toBe(1);
    for (const label of ["read an object's contents", "read an object's metadata (needs GetObject)"]) {
      expect(res.stdout).toContain(`FAIL ${label} from studio-bucket: not refused by IAM ((NoSuchKey))`);
    }
  });

  test('"not found" instead of "access denied" counts as a FAIL (the permission was granted)', () => {
    const res = runner('self-test', { ALLOW_SNAPSHOT: '1' });
    expect(res.stdout).toMatch(/FAIL create a database snapshot: not refused by IAM \(\(DBInstanceNotFound\)\)/);
    expect(res.status).toBe(1);
  });

  test('when the SSM agent is offline, says so, sends nothing, and still reports AWS-side state', () => {
    const res = runner('overview', { PING: 'ConnectionLost' });
    expect(res.stdout).toContain('SSM agent status: ConnectionLost');
    expect(res.stdout).toContain('## EC2');
    expect(res.calls).not.toMatch(/send-command/);
    expect(res.status).toBe(1);
  });

  test('server checks go only through the diagnostics document', () => {
    const res = runner('app-logs');
    expect(res.calls).toMatch(/ssm send-command .*--document-name PrimeStudios-Diagnostics/);
    expect(res.calls).not.toMatch(/AWS-RunShellScript/);
  });
});

// ---------------------------------------------------------------------------
describe('nothing reaches the public log', () => {
  test('the collect step prints only a size and an exit code; the report is masked', () => {
    const tmp = tmpdir();
    const bin = path.join(tmp, 'bin');
    fs.mkdirSync(bin);
    stub(bin, 'aws', AWS_STUB);
    const calls = path.join(tmp, 'calls');
    fs.writeFileSync(calls, '');
    const ghOut = path.join(tmp, 'gh-output');
    fs.mkdirSync(path.join(tmp, 'w', 'scripts'), { recursive: true });
    fs.symlinkSync(DIAG, path.join(tmp, 'w', 'scripts', 'diagnostics'));
    const res = spawnSync('bash', ['-e', '-c', stepRun('Collect (output stays off this log)')], {
      cwd: path.join(tmp, 'w'),
      env: {
        PATH: `${bin}:${NODE_DIR}:/usr/bin:/bin`, HOME: tmp, CALLS: calls, POLL_S: '0', RUNNER_TEMP: tmp, GITHUB_OUTPUT: ghOut,
        CHECK: 'app-logs', AWS_REGION: 'us-east-1', EC2_INSTANCE_ID: 'i-1', RDS_INSTANCE_ID: 'db', TARGET_SHA: SHA,
      },
      encoding: 'utf8',
    });
    const report = fs.readFileSync(path.join(tmp, 'report.md'), 'utf8');
    fs.rmSync(tmp, { recursive: true, force: true });
    expect(res.status).toBe(0);
    expect(res.stderr).toBe('');
    expect(res.stdout.trim()).toMatch(/^Collected \d+ bytes; checks exit 0\.$/);
    expect(report).toContain('PASS runs as ubuntu');
    expect(report).toContain('leak [aws-key-id] [email]');
    expect(report).not.toContain(SECRET_KEY_ID);
  });

  test('no workflow step prints the report or the raw output', () => {
    expect(WORKFLOW).not.toMatch(/\b(cat|tail|head|less)\b[^\n]*(report\.md|raw\.txt)/);
    expect(WORKFLOW).not.toMatch(/upload-artifact/);
    expect(WORKFLOW).toMatch(/runner\.sh "\$CHECK" >"\$RAW" 2>&1/);
    expect(WORKFLOW).not.toMatch(/set -x|ACTIONS_STEP_DEBUG/);
  });

  test('the privacy check runs before AWS credentials are obtained or anything is collected', () => {
    const order = ['Confirm the output repository is private', 'Configure AWS credentials', 'Collect (output stays off this log)', 'Publish to the private repository'];
    const idx = order.map((n) => WORKFLOW.indexOf(`- name: ${n}`));
    expect(idx.every((i) => i > 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });
});

// ---------------------------------------------------------------------------
describe('publish.sh (the private output repository)', () => {
  function publish(args, { code = '404', env = {}, bare } = {}) {
    const tmp = tmpdir();
    const bin = path.join(tmp, 'bin');
    fs.mkdirSync(bin);
    stub(bin, 'curl', `printf '%s' "${code}"`);
    const report = path.join(tmp, 'report.md');
    fs.writeFileSync(report, '# Diagnostics: self-test\nPASS a read works (211 migration rows)\n');
    const res = spawnSync('bash', [path.join(DIAG, 'publish.sh'), ...args.map((a) => (a === '<report>' ? report : a))], {
      env: {
        PATH: `${bin}:/usr/bin:/bin`, HOME: tmp, RUNNER_TEMP: tmp, GITHUB_RUN_ID: '42',
        GITHUB_REPOSITORY: 'angelcreator113/Episode-Canonical-Control-Record', DIAG_OUTPUT_REPO: 'angelcreator113/prime-diagnostics',
        DIAG_OUTPUT_DEPLOY_KEY: 'not-a-real-key', ...(bare ? { DIAG_OUTPUT_REMOTE: bare } : {}), ...env,
      },
      encoding: 'utf8',
    });
    fs.rmSync(tmp, { recursive: true, force: true });
    return res;
  }

  test.each([['200', 'PUBLIC'], ['301', 'could not confirm'], ['000', 'could not confirm']])(
    'refuses to publish when a signed-out visitor gets %s', (code, why) => {
      const bare = tmpdir();
      spawnSync('git', ['init', '-q', '--bare', bare]);
      const res = publish(['<report>', 'self-test'], { code, bare });
      expect(res.status).toBe(2);
      expect(res.stdout).toContain(why);
      expect(spawnSync('git', ['--git-dir', bare, 'rev-parse', '--verify', 'main']).status).not.toBe(0);
      fs.rmSync(bare, { recursive: true, force: true });
    },
  );

  test('refuses this public repository as the output repository', () => {
    const res = publish(['--check-private'], { env: { DIAG_OUTPUT_REPO: 'angelcreator113/Episode-Canonical-Control-Record' } });
    expect(res.status).toBe(2);
  });

  test('publishes to the private repository and prints only the path, size and checksum', () => {
    const bare = tmpdir();
    spawnSync('git', ['init', '-q', '--bare', bare]);
    const first = publish(['<report>', 'self-test'], { bare });
    const second = publish(['<report>', 'self-test'], { bare, env: { GITHUB_RUN_ID: '43' } });
    for (const res of [first, second]) {
      expect(res.status).toBe(0);
      expect(res.stdout).not.toContain('migration rows');
      const lines = res.stdout.trim().split('\n');
      expect(lines[0]).toMatch(/is private/);
      expect(lines[1]).toMatch(/^Published to the private repository: angelcreator113\/prime-diagnostics\/runs\/\d{4}-\d{2}-\d{2}\/4[23]-self-test\.md \(\d+ bytes, sha256 [0-9a-f]{16}…\)\.$/);
    }
    const tree = spawnSync('git', ['--git-dir', bare, 'ls-tree', '-r', '--name-only', 'main'], { encoding: 'utf8' }).stdout;
    expect(tree).toMatch(/runs\/\d{4}-\d{2}-\d{2}\/42-self-test\.md/);
    expect(tree).toMatch(/runs\/\d{4}-\d{2}-\d{2}\/43-self-test\.md/);
    expect(tree).toContain('latest-self-test.md');
    const latest = spawnSync('git', ['--git-dir', bare, 'show', 'main:latest-self-test.md'], { encoding: 'utf8' }).stdout;
    expect(latest).toContain('PASS a read works');
    fs.rmSync(bare, { recursive: true, force: true });
  });

  test('pins GitHub\'s host key rather than trusting on first use', () => {
    const text = fs.readFileSync(path.join(DIAG, 'publish.sh'), 'utf8');
    expect(text).toContain('StrictHostKeyChecking=yes');
    expect(text).toContain('github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl');
  });
});

// ---------------------------------------------------------------------------
describe('db-check.js', () => {
  test('reads only the DB_* connection names from the app .env, and the credential from the read-only file', () => {
    const appEnv = dbCheck.parseEnvFile('# c\nDB_HOST=db.example\nDB_NAME="episode_metadata"\nDB_PASSWORD=app-secret\nexport DB_PORT=6543\n');
    const cfg = dbCheck.connectionConfig({ appEnv, roEnv: { DB_USER: 'prime_readonly', DB_PASSWORD: 'ro' } });
    expect(cfg).toMatchObject({ host: 'db.example', database: 'episode_metadata', port: 6543, user: 'prime_readonly', password: 'ro' });
    expect(JSON.stringify(cfg)).not.toContain('app-secret');
    expect(cfg.ssl).toEqual({ rejectUnauthorized: false });
  });

  test('refuses an unknown mode, a missing credential file and a file others can read', async () => {
    const tmp = tmpdir();
    const lines = [];
    const say = (l) => lines.push(l);
    expect(await dbCheck.main('DROP TABLE x', say)).toBe(2);
    process.env.RO_ENV = path.join(tmp, 'ro.env');
    jest.resetModules();
    const fresh = require('../../../scripts/diagnostics/db-check');
    expect(await fresh.main('db', say)).toBe(2);
    fs.writeFileSync(process.env.RO_ENV, 'DB_USER=prime_readonly\nDB_PASSWORD=x\n', { mode: 0o644 });
    fs.chmodSync(process.env.RO_ENV, 0o644);
    expect(await fresh.main('db', say)).toBe(2);
    expect(lines.join('\n')).toMatch(/does not exist[\s\S]*readable by others/);
    delete process.env.RO_ENV;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('every statement is fixed in the file: no query is built from input', () => {
    const src = fs.readFileSync(path.join(DIAG, 'db-check.js'), 'utf8');
    expect(src).not.toMatch(/process\.argv\[[3-9]\]/);
    // No query is a template literal: the only built statements are countSql()
    // and sampleSql(), whose names come from the catalog or the fixed lists and pass ident().
    expect(src).not.toMatch(/client\.query\(`/);
    const built = [...src.matchAll(/client\.query\(([a-zA-Z]+)\(/g)].map((m) => m[1]);
    expect(new Set(built)).toEqual(new Set(['countSql', 'sampleSql']));
    expect(src).toMatch(/for \(const t of COUNT_TABLES\)/);
  });
});

// ---------------------------------------------------------------------------
// The daily database snapshot (F-Tools-2 Amendment 1, 2026-10-31; Task #3659).
describe('db-snapshot: what may be sampled (Amendment 1 §3)', () => {
  test('the allowlist is the ruling\'s list, and none of it is on the never-list', () => {
    expect(dbCheck.SAMPLE_TABLES).toEqual(['shows', 'show_configs', 'episodes', 'episode_briefs', 'characters',
      'character_registries', 'registry_characters', 'world_characters', 'universes', 'book_series', 'social_profiles',
      'feed_posts', 'world_events', 'world_locations', 'scene_sets', 'scene_angles', 'wardrobe', 'wardrobe_library',
      'lalaverse_brands', 'phone_missions']);
    for (const t of dbCheck.SAMPLE_TABLES) expect(dbCheck.isNeverTable(t)).toBe(false);
  });

  test.each(['users', 'user_roles', 'accounts', 'roles', 'permissions', 'auth_events', 'sessions', 'refresh_tokens',
    'storyteller_memories', 'therapy_sessions', 'character_therapy_profiles', 'brain_entries', 'author_notes',
    'writing_goals', 'pulse_dm_threads', 'social_media_imports', 'ai_usage_logs', 'activity_logs', 'user_decisions',
    'assets', 'raw_footage', 'media_asset_sources', 'audio_clips'])('%s is on the never-list and cannot be sampled', (t) => {
    expect(dbCheck.isNeverTable(t)).toBe(true);
    expect(() => dbCheck.sampleSql(t, ['id'], {})).toThrow(/not a sampled table/);
  });

  test('a table that is not on the allowlist is never sampled, even one that is not on the never-list', () => {
    expect(() => dbCheck.sampleSql('new_content_table', ['id'], {})).toThrow(/not a sampled table/);
  });

  test.each(['password', 'password_hash', 'passwordDigest', 'pwd', 'secret_answer', 'api_key', 'private_key', 'auth_token',
    'refreshToken', 'session_id', 'cookie', 'otp_code', 'mfa_secret', 'email', 'contactEmail', 'phone_number', 'mobile',
    'address', 'ip_address', 'ssn', 'dob', 'birthdate', 'birthday', 'avatar_url', 'signed_url', 'image_uri', 'link',
    'href', 'file_path', 's3_key', 'bucket', 'cognito_sub', 'sub', 'user_id', 'userId', 'owner_id', 'credentials',
    'credential_ref', 'passwd', 'salt', 'tokenized', 'secretive'])('drops the column %s', (c) => {
    expect(dbCheck.dropColumn(c, 'text')).toBe(true);
  });

  test.each(['id', 'title', 'subtitle', 'description', 'relationship', 'character_key', 'key', 'display_name', 'status',
    'created_at', 'updated_at', 'season_number', 'tags', 'notes', 'passive_trait', 'subscriber_count'])('keeps the column %s', (c) => {
    expect(dbCheck.dropColumn(c, 'text')).toBe(false);
  });

  test('bytea columns are always dropped', () => {
    expect(dbCheck.dropColumn('thumbnail', 'bytea')).toBe(true);
  });

  test('values are cut at 200 characters, whitespace flattened, objects as JSON, binaries never shown', () => {
    expect(dbCheck.VALUE_MAX).toBe(200);
    const long = dbCheck.boundValue('x'.repeat(500));
    expect(long).toBe(`${'x'.repeat(200)}…[cut]`);
    expect(dbCheck.boundValue('a\n\tb')).toBe('a b');
    expect(dbCheck.boundValue({ a: 1 })).toBe('{"a":1}');
    expect(dbCheck.boundValue(null)).toBe('null');
    expect(dbCheck.boundValue(Buffer.from('raw'))).toBe('[binary]');
    expect(dbCheck.boundValue(new Date('2026-10-31T00:00:00Z'))).toBe('2026-10-31T00:00:00.000Z');
  });

  test('identifiers outside [A-Za-z0-9_] are refused before they reach SQL; mixed case is quoted', () => {
    expect(dbCheck.ident('SequelizeMeta')).toBe('"SequelizeMeta"');
    for (const bad of ['shows"; DROP TABLE x; --', 'a"b', 'a b', 'a.b', '', '1abc', 'x'.repeat(64)]) {
      expect(() => dbCheck.ident(bad)).toThrow(/refused identifier/);
      expect(() => dbCheck.countSql(bad)).toThrow(/refused identifier/);
    }
    expect(() => dbCheck.sampleSql('shows', ['id', 'name"--'], {})).toThrow(/refused identifier/);
  });

  test('a sample is an explicit column list, newest first, without soft-deleted rows, at most 20 rows', () => {
    expect(dbCheck.sampleSql('shows', ['id', 'title'], { orderBy: 'updated_at', paranoid: true }))
      .toBe('SELECT "id", "title" FROM public."shows" WHERE "deleted_at" IS NULL ORDER BY "updated_at" DESC NULLS LAST LIMIT 20');
    expect(dbCheck.sampleSql('episodes', ['id'], { orderBy: null, paranoid: false })).toBe('SELECT "id" FROM public."episodes" LIMIT 20');
    expect(dbCheck.sampleSql('shows', ['id'], {})).not.toMatch(/\*/);
  });
});

/** A pg client that answers the snapshot's catalog queries from fixtures and records every statement. */
function fakeClient({ columns, indexes = [], rows = {}, failCount = [] }) {
  const seen = [];
  return {
    seen,
    async query(sql) {
      seen.push(sql);
      if (/information_schema\.columns/.test(sql)) return { rows: columns };
      if (/pg_indexes/.test(sql)) return { rows: indexes };
      const count = /^SELECT count\(\*\)::bigint AS n FROM public\."([a-z0-9_]+)"$/.exec(sql);
      if (count) {
        if (failCount.includes(count[1])) throw Object.assign(new Error('x'), { code: '42501' });
        return { rows: [{ n: String((rows[count[1]] || []).length) }] };
      }
      const sample = /FROM public\."([a-z0-9_]+)"/.exec(sql);
      if (sample) return { rows: rows[sample[1]] || [] };
      throw new Error(`unexpected statement: ${sql}`);
    },
  };
}
const col = (table_name, column_name, data_type = 'text', extra = {}) => ({ table_name, column_name, data_type, is_nullable: 'YES', column_default: null, ...extra });

describe('db-snapshot: the report db-check.js builds', () => {
  const columns = [
    col('shows', 'id', 'integer', { is_nullable: 'NO', column_default: "nextval('shows_id_seq'::regclass)" }),
    col('shows', 'title'), col('shows', 'owner_id', 'uuid'), col('shows', 'cover_url'), col('shows', 'updated_at', 'timestamp with time zone'),
    col('shows', 'deleted_at', 'timestamp with time zone'),
    col('users', 'id', 'integer'), col('users', 'email'), col('users', 'password_hash'),
    col('episodes', 'id', 'integer'), col('episodes', 'title'),
  ];
  const rows = {
    shows: [{ id: 2, title: `Styling Adventures ${'!'.repeat(300)}`, updated_at: new Date('2026-10-30T00:00:00Z') }, { id: 1, title: 'Before Lala', updated_at: null }],
    users: [{ id: 1, email: 'person@example.com', password_hash: 'hunter2-password' }],
    episodes: [{ id: 7, title: 'Pilot' }],
  };
  const indexes = [{ tablename: 'shows', indexname: 'shows_pkey', indexdef: 'CREATE UNIQUE INDEX shows_pkey ON public.shows USING btree (id)' }];

  async function build(opts = {}) {
    const client = fakeClient({ columns, indexes, rows, ...opts });
    const lines = [];
    const ok = await dbCheck.snapshot(client, (l) => lines.push(l));
    return { ok, text: lines.join('\n'), seen: client.seen };
  }

  test('schema: every table with its columns (type, nullability, default) and its indexes (uniqueness, columns)', async () => {
    const { ok, text } = await build();
    expect(ok).toBe(true);
    expect(text).toContain('## 1. Schema (db-schema, extended)');
    expect(text).toContain("- id: integer, not null, default nextval('shows_id_seq'::regclass)");
    expect(text).toContain('- title: text');
    expect(text).toContain('- index shows_pkey: unique, btree (id)');
    expect(text).toContain('### users');
    expect(text).toContain('- password_hash: text');
  });

  test('counts: an exact count for every table, including tables that are never sampled', async () => {
    const { text } = await build();
    expect(text).toContain('## 2. Row counts (db-counts, extended: exact, every table)');
    expect(text).toContain('- users: 1');
    expect(text).toContain('- shows: 2');
    expect(text).toContain('- episodes: 1');
  });

  test('samples: only allowlisted tables, only kept columns, newest first, not soft-deleted, values bounded', async () => {
    const { text, seen } = await build();
    expect(seen).toContain('SELECT "id", "title", "updated_at", "deleted_at" FROM public."shows" WHERE "deleted_at" IS NULL ORDER BY "updated_at" DESC NULLS LAST LIMIT 20');
    expect(seen).toContain('SELECT "id", "title" FROM public."episodes" ORDER BY "id" DESC NULLS LAST LIMIT 20');
    // users is in the catalog, but never sampled; its rows are never selected.
    expect(seen.filter((q) => /FROM public\."users"/.test(q))).toEqual(['SELECT count(*)::bigint AS n FROM public."users"']);
    expect(seen.some((q) => /SELECT \*/.test(q))).toBe(false);
    const samples = text.split('## 3. Content samples (db-samples)')[1];
    expect(samples).toContain('2 rows; 4 columns shown, 2 left out; newest by updated_at');
    expect(samples).toContain(`  title: Styling Adventures ${'!'.repeat(200 - 'Styling Adventures '.length)}…[cut]`);
    expect(samples).toContain('  updated_at: 2026-10-30T00:00:00.000Z');
    expect(samples).not.toMatch(/owner_id|cover_url|person@example\.com|hunter2/);
    expect(samples).toContain('### show_configs\n(no such table)');
  });

  test('a failing count is reported and fails the check without stopping the report', async () => {
    const { ok, text } = await build({ failCount: ['users'] });
    expect(ok).toBe(false);
    expect(text).toContain('- users: count failed (42501)');
    expect(text).toContain('## 3. Content samples (db-samples)');
  });

  test('the samples stop at the 200 KB cap', async () => {
    expect(dbCheck.SAMPLES_MAX_BYTES).toBe(200 * 1024);
    const wide = [col('episodes', 'id', 'integer'), ...Array.from({ length: 40 }, (_, i) => col('episodes', `field_${i}`))];
    const many = Array.from({ length: 20 }, (_, i) => Object.fromEntries([['id', i], ...Array.from({ length: 40 }, (__, k) => [`field_${k}`, 'y'.repeat(300)])]));
    const big = {};
    for (const t of dbCheck.SAMPLE_TABLES) big[t] = many;
    const allCols = dbCheck.SAMPLE_TABLES.flatMap((t) => wide.map((c) => ({ ...c, table_name: t })));
    const client = fakeClient({ columns: allCols, rows: big });
    const lines = [];
    await dbCheck.snapshot(client, (l) => lines.push(l));
    const text = lines.join('\n');
    const samples = text.split('## 3. Content samples (db-samples)')[1];
    expect(Buffer.byteLength(samples)).toBeLessThan(200 * 1024 + 4096);
    expect(text).toContain('…[samples stop here: the 200 KB cap was reached]');
  });
});

describe('db-snapshot: transport from the box (paged, checksummed)', () => {
  // A copy of scripts/diagnostics with db-check.js replaced by a stub that prints
  // a report of the given size (and, on purpose, a secret, which the box masks
  // before packing).
  function fakeDiag(tmp, { bytes = 60000, exit = 0 } = {}) {
    const dir = path.join(tmp, 'diag');
    fs.cpSync(DIAG, dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'db-check.js'), `
      const crypto = require('crypto');
      process.stdout.write('# Database snapshot\\nleak ${SECRET_KEY_ID} person@example.com\\n');
      let n = 0; const seed = crypto.createHash('sha256');
      while (n < ${bytes}) { const l = crypto.createHash('sha256').update(String(n)).digest('hex') + '\\n'; process.stdout.write(l); n += l.length; }
      process.stdout.write('END OF SNAPSHOT\\n');
      process.exitCode = ${exit};
    `);
    return dir;
  }
  function onBoxEnv(tmp) {
    const bin = path.join(tmp, 'bin');
    fs.mkdirSync(bin, { recursive: true });
    stub(bin, 'id', 'case "$1" in -u) echo 1000 ;; -un) echo ubuntu ;; *) echo "uid=1000(ubuntu)" ;; esac');
    fs.mkdirSync(path.join(tmp, 'app'), { recursive: true });
    return { PATH: `${bin}:${NODE_DIR}:/usr/bin:/bin`, HOME: tmp, NVM_DIR: path.join(tmp, 'nvm'), APP_DIR: path.join(tmp, 'app') };
  }
  const RUN = String(9000000000 + process.pid);
  const SNAP = `/tmp/prime-db-snapshot-${RUN}.b64`;
  afterEach(() => { fs.rmSync(SNAP, { force: true }); fs.rmSync(`${SNAP}.rc`, { force: true }); });

  test('on-box: page 0 builds the snapshot in a mode-600 file; every page fits under the SSM limit; the last page removes it', () => {
    const tmp = tmpdir();
    const dir = fakeDiag(tmp);
    const env = onBoxEnv(tmp);
    const page = (n) => spawnSync('bash', [path.join(dir, 'on-box.sh'), 'db-snapshot', SHA, String(n), RUN], { env, encoding: 'utf8' });
    const first = page(0);
    expect(first.status).toBe(0);
    expect(fs.statSync(SNAP).mode & 0o777).toBe(0o600);
    const pages = Number(/^SNAPSHOT-PAGES (\d+)$/m.exec(first.stdout)[1]);
    expect(pages).toBeGreaterThan(1);
    const outs = [first, ...Array.from({ length: pages - 1 }, (_, i) => page(i + 1))];
    for (const o of outs) {
      expect(o.status).toBe(0);
      expect(o.stdout.length).toBeLessThan(24000);
      expect(o.stdout).toMatch(/SNAPSHOT-END\n$/);
    }
    expect(fs.existsSync(SNAP)).toBe(false);
    const b64 = outs.map((o) => o.stdout.split(/^SNAPSHOT-PART \d+\n/m)[1].split('\nSNAPSHOT-END')[0].replace(/\n/g, '')).join('');
    const sha = /^SNAPSHOT-SHA256 ([0-9a-f]{64})$/m.exec(first.stdout)[1];
    expect(require('crypto').createHash('sha256').update(b64).digest('hex')).toBe(sha);
    const text = require('zlib').gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
    expect(text).toMatch(/^# Database snapshot\n/);
    expect(text).toContain('END OF SNAPSHOT');
    expect(text).toContain('leak [aws-key-id] [email]');
    expect(/^SNAPSHOT-DB-EXIT (\S+)$/m.exec(first.stdout)[1]).toBe('0');
    // After the last page, nothing is left to read.
    const again = page(1);
    expect(again.status).toBe(1);
    expect(again.stdout).toMatch(/SNAPSHOT-ERROR no snapshot/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test.each([['a page that is not a number', 'x', RUN], ['a run that is not a number', '0', '1;rm']])('on-box refuses %s', (_l, p, r) => {
    const tmp = tmpdir();
    const res = spawnSync('bash', [path.join(DIAG, 'on-box.sh'), 'db-snapshot', SHA, p, r], { env: onBoxEnv(tmp), encoding: 'utf8' });
    expect(res.status).toBe(2);
    expect(res.stdout).toMatch(/^REFUSED/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  // The runner, with an `aws` stub that runs the real on-box.sh for each page
  // (as SSM would) and, if CORRUPT is set, damages page 1 in transit.
  function snapshotRun({ event = 'schedule', bytes, exit, corrupt } = {}) {
    const tmp = tmpdir();
    const dir = fakeDiag(tmp, { bytes, exit });
    const env = onBoxEnv(tmp);
    stub(path.join(tmp, 'bin'), 'aws', `
echo "$*" >>"$CALLS"
case "$1 $2" in
  "ssm describe-instance-information") echo Online ;;
  "ssm send-command")
    f=""; prev=""; for a in "$@"; do [ "$prev" = "--parameters" ] && f="\${a#file://}"; prev="$a"; done
    id="cmd-$(date +%s%N)"
    bash "$ONBOX" "$(jq -r '.check[0]' "$f")" "$(jq -r '.sha[0]' "$f")" "$(jq -r '.page[0]' "$f")" "$(jq -r '.run[0]' "$f")" >"$TMPD/$id.out" 2>&1
    if [ -n "\${CORRUPT:-}" ] && [ "$(jq -r '.page[0]' "$f")" = 1 ]; then sed -i '/^SNAPSHOT-PART/{n;s/^./~/}' "$TMPD/$id.out"; fi
    echo "$id" ;;
  "ssm get-command-invocation")
    id=""; prev=""; for a in "$@"; do [ "$prev" = "--command-id" ] && id="$a"; prev="$a"; done
    case "$*" in
      *"--query Status"*) echo Success ;;
      *StandardOutputContent*) cat "$TMPD/$id.out" ;;
      *) echo None ;;
    esac ;;
  *) echo "{}" ;;
esac`);
    const calls = path.join(tmp, 'calls');
    fs.writeFileSync(calls, '');
    const res = spawnSync('bash', [path.join(DIAG, 'runner.sh'), 'db-snapshot'], {
      env: {
        ...env, CALLS: calls, TMPD: tmp, ONBOX: path.join(dir, 'on-box.sh'), POLL_S: '0', GITHUB_RUN_ID: RUN,
        GITHUB_EVENT_NAME: event, CORRUPT: corrupt ? '1' : '', AWS_REGION: 'us-east-1', EC2_INSTANCE_ID: 'i-0123456789abcdef0',
        RDS_INSTANCE_ID: 'episode-control-dev', TARGET_SHA: SHA,
      },
      encoding: 'utf8',
    });
    res.calls = fs.readFileSync(calls, 'utf8');
    fs.rmSync(tmp, { recursive: true, force: true });
    return res;
  }

  test('runner: joins the pages, checks the checksum, and prints the unpacked (masked) snapshot', () => {
    const res = snapshotRun();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/^# Database snapshot$/m);
    expect(res.stdout).toContain('END OF SNAPSHOT');
    expect(res.stdout).toContain('leak [aws-key-id] [email]');
    expect(res.stdout).not.toContain(SECRET_KEY_ID);
    expect(res.stdout).not.toMatch(/^[A-Za-z0-9+/=]{76}$/m); // no base64 reaches the report
    expect(res.stdout).toMatch(/snapshot: \d+ page\(s\), sha256 [0-9a-f]{16}…; database part exit 0/);
    expect(res.stdout).toMatch(/result: ok/);
    const sends = res.calls.split('\n').filter((l) => l.startsWith('ssm send-command'));
    expect(sends.length).toBeGreaterThan(1);
    for (const s of sends) expect(s).toContain('--document-name PrimeStudios-Diagnostics');
  });

  test('runner: a page damaged in transit fails the check and prints no snapshot', () => {
    const res = snapshotRun({ corrupt: true });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('FAIL the joined pages do not match the box\'s checksum');
    expect(res.stdout).not.toContain('END OF SNAPSHOT');
  });

  test('runner: a database error on the box fails the check, and the report still arrives', () => {
    const res = snapshotRun({ bytes: 100, exit: 1 });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('END OF SNAPSHOT');
    expect(res.stdout).toMatch(/database part exit 1/);
  });

  test.each(['workflow_dispatch', 'push', ''])('runner refuses the snapshot from the %s event, before any aws call', (event) => {
    const res = snapshotRun({ event });
    expect(res.status).toBe(2);
    expect(res.stdout).toContain('REFUSED: db-snapshot runs only from the schedule');
    expect(res.calls).toBe('');
  });
});

// ---------------------------------------------------------------------------
// The real role, against a scratch database. Runs where TEST_DATABASE_URL is
// set (CI's Tests job, and a local docker compose postgres); skipped elsewhere.
const PG_URL = process.env.TEST_DATABASE_URL;
(PG_URL ? describe : describe.skip)('sql/readonly-role.sql against a scratch database', () => {
  const { Client } = require('pg');
  const DB = `diag_selftest_${process.pid}`;
  const PASSWORD = `ro-${process.pid}-${Date.now()}`;
  const admin = () => new Client({ connectionString: PG_URL });
  const urlFor = (db) => { const u = new URL(PG_URL); u.pathname = `/${db}`; return u; };
  let tmp;

  beforeAll(async () => {
    const c = admin();
    await c.connect();
    await c.query(`CREATE DATABASE ${DB}`);
    await c.end();
    const d = new Client({ connectionString: urlFor(DB).toString() });
    await d.connect();
    await d.query('CREATE TABLE "SequelizeMeta" (name varchar(255) PRIMARY KEY)');
    await d.query('INSERT INTO "SequelizeMeta" VALUES (\'20260101000000-first.js\'), (\'20260102000000-second.js\')');
    await d.query('CREATE TABLE shows (id serial PRIMARY KEY, name text)');
    await d.query("INSERT INTO shows (name) VALUES ('Styling Adventures')");
    // A role left behind by an interrupted earlier run would make CREATE ROLE fail.
    const left = await d.query("SELECT 1 FROM pg_roles WHERE rolname = 'prime_readonly'");
    if (left.rows.length) throw new Error('a prime_readonly role already exists on this server; drop it before running this test');
    const sql = fs.readFileSync(path.join(DIAG, 'sql', 'readonly-role.sql'), 'utf8')
      .replace(/:"dbname"/g, `"${DB}"`).replace(/:"migrate_user"/g, `"${urlFor(DB).username}"`);
    await d.query(sql);
    await d.query(`ALTER ROLE prime_readonly PASSWORD '${PASSWORD}'`);
    // Created after the grants, as the migration user would: still readable.
    await d.query('CREATE TABLE episodes (id serial PRIMARY KEY)');
    await d.end();
    tmp = tmpdir();
    const u = urlFor(DB);
    fs.mkdirSync(path.join(tmp, 'app', 'src', 'migrations'), { recursive: true });
    for (const f of ['20260101000000-first.js', '20260102000000-second.js', '20260103000000-third.js']) {
      fs.writeFileSync(path.join(tmp, 'app', 'src', 'migrations', f), '');
    }
    fs.writeFileSync(path.join(tmp, 'app', '.env'), `DB_HOST=${u.hostname}\nDB_PORT=${u.port || 5432}\nDB_NAME=${DB}\nDB_SSL=false\n`);
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'app', 'node_modules'));
    fs.writeFileSync(path.join(tmp, 'ro.env'), `DB_USER=prime_readonly\nDB_PASSWORD=${PASSWORD}\n`, { mode: 0o600 });
  });

  afterAll(async () => {
    const c = admin();
    await c.connect();
    await c.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
    await c.query('DROP ROLE IF EXISTS prime_readonly');
    await c.end();
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  function check(mode) {
    return spawnSync(process.execPath, [path.join(DIAG, 'db-check.js'), mode], {
      env: { PATH: process.env.PATH, HOME: tmp, APP_DIR: path.join(tmp, 'app'), RO_ENV: path.join(tmp, 'ro.env') },
      encoding: 'utf8',
    });
  }

  test('self-test: connected as prime_readonly, and every write is refused, even with read-only switched off', () => {
    const res = check('self-test');
    expect(res.stdout).not.toMatch(/^FAIL/m);
    for (const l of ['PASS connected as prime_readonly', 'PASS the session defaults to read-only', 'PASS not a superuser',
      'PASS create a table in the default session: refused (25006)', 'PASS update with read-only switched off: refused (42501)',
      'PASS insert with read-only switched off: refused (42501)', 'PASS delete with read-only switched off: refused (42501)',
      'PASS read a server file: refused (42501)']) {
      expect(res.stdout).toContain(l);
    }
    expect(res.status).toBe(0);
  });

  test('db: connectivity and migration state, with no password in the output', () => {
    const res = check('db');
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/connected: yes/);
    expect(res.stdout).toContain('user: prime_readonly; read-only session: on');
    expect(res.stdout).toContain('migrations: 2 applied; 3 files in the deployed tree; 1 pending');
    expect(res.stdout).toContain('pending: 20260103000000-third.js');
    expect(res.stdout).not.toContain(PASSWORD);
  });

  test('db-counts reads tables created after the grants (default privileges)', () => {
    const res = check('db-counts');
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('  shows: 1');
    expect(res.stdout).toContain('  episodes: 0');
    expect(res.stdout).toContain('  assets: (no such table)');
  });

  test('snapshot: schema, exact counts and the allowlisted samples, as the read-only role', () => {
    const res = check('snapshot');
    expect(res.stdout).toContain('## 1. Schema (db-schema, extended)');
    expect(res.stdout).toContain('- id: integer, not null, default nextval');
    expect(res.stdout).toMatch(/- index shows_pkey: unique, btree \(id\)/);
    expect(res.stdout).toContain('- shows: 1');
    expect(res.stdout).toContain('- episodes: 0');
    expect(res.stdout).toContain('  name: Styling Adventures');
    expect(res.stdout).toContain('1 rows; 2 columns shown, 0 left out; newest by id');
    expect(res.stdout).not.toContain(PASSWORD);
    expect(res.status).toBe(0);
  });
});

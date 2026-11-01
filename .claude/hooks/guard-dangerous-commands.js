#!/usr/bin/env node
// PreToolUse guard for Bash / PowerShell commands, F-Tools-5 (2026-10-31,
// docs/audit/F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md).
//
// Sessions may operate production for what Evoni asks (§1): AWS, SSM, SSH,
// pm2, psql, gh and workflows are not blocked here. The guard keeps the two
// limits the ruling leaves, plus two repository conventions:
//   §4  a command that deletes or irreversibly changes data or infrastructure
//       stops at Claude Code's prompt (`ask`); in a permission mode where a
//       prompt may not reach Evoni (auto, dontAsk, bypassPermissions) it is
//       refused, and the session asks her in the conversation instead. The
//       rule is her explicit yes in the conversation; this is the backstop.
//   §5  a command that would print a secret is refused, in every mode.
//   Git: no push to main or dev, no force-push (also in settings.json).
// Exit 2 = refused (stderr is shown to Claude). Exit 0 = allowed, or the
// `ask` decision as PreToolUse JSON on stdout.
// Matching is by command position and parsed arguments, so prose, greps and
// heredoc bodies written to files are not caught. Pattern-matching has gaps
// (§9.3): an action the guard cannot recognise is still gated by §4.

const ASK_MODES = new Set(['default', 'plan', 'acceptEdits']);

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let cmd = '';
  let event = {};
  try { event = JSON.parse(raw) || {}; cmd = String((event.tool_input || {}).command || ''); } catch (e) { process.exit(0); }

  // A commit, tag or note message is data, not commands (Task #2299). An
  // escaped pipe (`\|`) is a literal character, never a shell pipe (#3650).
  const unescaped = cmd.replace(/\\\|/g, '\\¦');
  const isGitMessage = /(^|[\n;&|(`]\s*)git\s+(commit|tag|notes)\b/.test(unescaped);
  const input = isGitMessage
    ? unescaped.replace(/(\s(?:-m|--message)(?:\s+|=))("(?:[^"\\]|\\[\s\S])*"|'[^']*')/g, '$1""')
    : unescaped;
  // Heredoc bodies written to a file (cat/tee) or read as a git message are
  // data; heredocs fed to anything else (a shell, psql, ssh) are scanned.
  const dataConsumer = (line) =>
    /(^|[\s;&|(])(cat|tee)\b/.test(line) || /(^|[\s;&|(])git\s+(commit|tag|notes)\b/.test(line);
  const heredoc = /(^|\n)([^\n]*?)<<-?\s*'?"?([A-Za-z_][A-Za-z0-9_]*)"?'?[^\n]*\n([\s\S]*?)\n\3(?=\n|$)/g;
  const scan = input.replace(heredoc, (m, pre, line, tag) => (dataConsumer(line) ? `${pre}${line}<<${tag}\n${tag}` : m));

  const refuse = (why) => {
    process.stderr.write(`[guard] BLOCKED: ${why}\nCommand: ${cmd.slice(0, 300)}\n`);
    process.exit(2);
  };
  const gate = (what) => {
    const reason = `[guard] F-Tools-5 §4: ${what}. This deletes or irreversibly changes data or infrastructure. Run it only after Evoni's explicit yes in this conversation, for this exact command, with its target, what is lost and how to undo it stated first.`;
    if (!ASK_MODES.has(String(event.permission_mode || ''))) {
      refuse(`${reason} In this permission mode the prompt may not reach her, so the guard refuses it: ask her in the conversation, and she runs it or switches to the default permission mode.`);
    }
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } }));
    process.exit(0);
  };

  // Each invocation of `tool` at command position (wrappers included: sudo,
  // env, xargs, nohup, time, watch, eval, exec, command, and a shell or ssh
  // given a command string), as its words, and whether it sits inside a
  // command substitution `$( … )`, where its output feeds another command
  // instead of the screen.
  const WRAP = `(?:sudo\\s+(?:-\\S+\\s+)*|env\\s+(?:-\\S+\\s+)*(?:[A-Za-z_]+=\\S*\\s+)*|xargs\\s+(?:-\\S+\\s+)*|(?:nohup|time|watch|eval|exec|command)\\s+|(?:bash|sh|zsh|dash|pwsh|powershell|cmd)(?:\\.exe)?\\s+(?:[-/]\\S+\\s+)*["']?|ssh\\s+(?:-\\S+\\s+(?:(?!-)\\S+\\s+)?)*\\S+\\s+["']?|[A-Za-z_][A-Za-z0-9_]*=\\S*\\s+)*`;
  const invocations = (tool) => {
    const re = new RegExp(`(^|[\\n;&|(\`]\\s*|\\$\\(\\s*)${WRAP}${tool}(?:\\.exe)?(?:\\s+([^\\n;&|]*)|\\s*$)`, 'gm');
    return [...scan.matchAll(re)].map((m) => ({
      substituted: /\$\(\s*$/.test(m[1] || ''),
      words: (m[2] || '').trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/^['"]|['"]$/g, '')),
    }));
  };

  /* ── §5: never print a secret (every mode) ─────────────────────────── */
  if (/(^|[\n;&|(`]\s*)(printenv|env|export\s+-p|declare\s+-x|set)\s*($|\||;|&|\n)/.test(scan)) {
    refuse('printing the whole environment, which holds credentials (F-Tools-5 §5). Name the variable you need, and never print a secret one.');
  }
  // Printing a secret variable, not naming one: docs and settings may name
  // AWS_ACCESS_KEY_ID; a command may not show its value.
  const SECRET_VAR = '[A-Za-z0-9_]*(KEY|TOKEN|SECRET|PASSWORD|PASSWD|PASS|CREDENTIAL)S?(_ID)?\\b';
  if (new RegExp(`(^|[\\n;&|(\`]\\s*)(echo|printf|print|Write-Output|Write-Host)\\b[^\\n;&|]*\\$\\{?(env:)?${SECRET_VAR}`, 'i').test(scan)
    || new RegExp(`(^|[\\n;&|(\`]\\s*)printenv\\s+${SECRET_VAR}`, 'i').test(scan)) {
    refuse('printing a credential variable (F-Tools-5 §5). The CLI reads its credentials itself; a secret is never shown.');
  }
  if (/(^|[\s;&|(=])~?[^\s;&|]*\.aws[\\/](credentials|config|sso|cli)\b/.test(scan)
    || /(^|[\s;&|(=])~?[^\s;&|]*\.config[\\/]gh[\\/]/.test(scan)) {
    refuse('reading a CLI credential or login-cache file (F-Tools-5 §5).');
  }
  if (/(^|[\n;&|(`"']\s*)(cat|less|more|head|tail|bat|type|Get-Content|gc|nl|strings|xxd|od)\b[^\n;&|]*?(^|[\s"'/\\~])[\w.-]*\.env(?:\.(?!example\b|sample\b|template\b)[\w-]+)?(?=$|[\s"';&|)])/m.test(scan)) {
    refuse('printing a .env file, which holds secrets (F-Tools-5 §5). Read the variable names with a filter that drops the values, or use the value without showing it.');
  }
  if (/X-Amz-(Signature|Credential|Security-Token)=/i.test(scan)) {
    refuse('a presigned AWS link in a command. Signed links are credentials (F-Tools-5 §5).');
  }
  const AWS_SECRET_OPS = [
    [(s, o) => s === 'configure' && ['export-credentials', 'get'].includes(o), 'aws configure export-credentials / get'],
    [(s, o) => s === 'sts' && /^(get-session-token|assume-role|get-federation-token)/.test(o), 'an STS call that returns credentials'],
    [(s, o) => s === 'iam' && o === 'create-access-key', 'iam create-access-key (it prints the new secret key)'],
    [(s, o, f) => s === 'ssm' && /^get-parameter/.test(o) && /--with-decryption/.test(f), 'an SSM parameter read with --with-decryption'],
    [(s, o) => s === 'secretsmanager' && o === 'get-secret-value', 'secretsmanager get-secret-value'],
    [(s, o) => /^ecr(-public)?$/.test(s) && o === 'get-login-password', 'a registry login password'],
    [(s, o) => s === 'codeartifact' && o === 'get-authorization-token', 'a registry token'],
    [(s, o) => s === 'cognito-idp' && /^(initiate-auth|admin-initiate-auth|respond-to-auth-challenge|admin-respond-to-auth-challenge)$/.test(o), 'a Cognito call that returns tokens'],
  ];
  const AWS_BOOLEAN_GLOBALS = new Set(['--debug', '--no-verify-ssl', '--no-paginate', '--no-cli-pager', '--no-sign-request', '--no-cli-auto-prompt', '--cli-auto-prompt']);
  const awsParts = (words) => {
    let i = 0;
    while (i < words.length && words[i].startsWith('--')) i += AWS_BOOLEAN_GLOBALS.has(words[i]) || words[i].includes('=') ? 1 : 2;
    const [svc = '', op = '', ...rest] = words.slice(i);
    return { svc, op, rest, flags: rest.join(' ') };
  };
  const aws = invocations('aws');
  for (const { substituted, words } of aws) {
    const { svc, op, flags } = awsParts(words);
    if (svc === 'cognito-idp' && op === 'describe-user-pool-client') {
      const q = (flags.match(/--query[=\s]+(\S+)/) || [])[1] || '';
      if (!q || /ClientSecret/i.test(q) || /^UserPoolClient\s*$|\*|^@$/.test(q)) {
        refuse('describe-user-pool-client without a --query that selects named fields and leaves out ClientSecret (F-Tools-5 §5).');
      }
    }
    if (substituted) continue; // its output feeds the command around it, not the screen
    for (const [hit, what] of AWS_SECRET_OPS) {
      if (hit(svc, op, flags)) refuse(`${what} would print a secret (F-Tools-5 §5). Use it only inside $( … ) where it feeds the command that needs it.`);
    }
  }
  const gh = invocations('gh');
  for (const { substituted, words } of gh) {
    const [group = '', sub = ''] = words;
    const flags = words.slice(2).join(' ');
    if (group === 'auth' && ((sub === 'token' && !substituted) || (sub === 'status' && /--show-token|(?:^|\s)-t\b/.test(flags)))) {
      refuse(`gh auth ${sub} would print a token (F-Tools-5 §5).`);
    }
  }

  /* ── F-Tools-2 Amendment 1 §2: the snapshot is schedule-only (every mode) ── */
  // A session reads the newest snapshot at /wake-up; it never starts one, by
  // workflow dispatch, a dispatch API call, or SSM to the diagnostics document.
  const SNAPSHOT_CHECK = /(^|[^a-z0-9-])db-(snapshot|samples)([^a-z0-9-]|$)/;
  const startsSnapshot = (words) => SNAPSHOT_CHECK.test(words.join(' '));
  for (const { words } of gh) {
    const [group = '', sub = ''] = words;
    const dispatch = (group === 'workflow' && sub === 'run') || (group === 'api' && /\/dispatches\b/.test(words.join(' ')));
    if (dispatch && startsSnapshot(words)) {
      refuse('the database snapshot (db-snapshot / db-samples) runs only from the Diagnostics schedule; a session never starts it (F-Tools-2 Amendment 1 §2). Read latest-db-snapshot.md in the private diagnostics repository instead.');
    }
  }
  for (const { words } of aws) {
    const { svc, op } = awsParts(words);
    if (svc === 'ssm' && op === 'send-command' && startsSnapshot(words)) {
      refuse('the database snapshot (db-snapshot / db-samples) runs only from the Diagnostics schedule; a session never starts it on the box (F-Tools-2 Amendment 1 §2).');
    }
  }

  /* ── Git conventions (every mode) ──────────────────────────────────── */
  if (/(^|[\n;&|(`]\s*)git\s+push\b[^\n]*(--force\b|\s-f\b|--force-with-lease)/.test(scan)) {
    refuse('force push (settings.json denies it too). History on a shared branch is not rewritten; if it is truly needed, Evoni runs it.');
  }
  if (/(^|[\n;&|(`]\s*)git\s+push\b[^\n]*(\s|:)(origin\s+)?(main|dev)(\s|$)/.test(scan)) {
    refuse('direct push to main or dev. Work lands by PR + squash-merge.');
  }

  /* ── §4: gated, irreversible actions ───────────────────────────────── */
  const DESTRUCTIVE_OP = /^(?:admin-)?(?:delete|remove|terminate|deregister|purge|stop|reboot|restore|revoke|disable|detach|disassociate|cancel|modify)-/;
  for (const { words } of aws) {
    const { svc, op, rest, flags } = awsParts(words);
    const positional = rest.filter((w) => !w.startsWith('-'));
    if (DESTRUCTIVE_OP.test(op)) gate(`aws ${svc} ${op}`);
    if (svc === 's3' && ['rm', 'rb', 'mv'].includes(op)) gate(`aws s3 ${op}`);
    if (svc === 's3' && ['cp', 'sync'].includes(op) && (/^s3:\/\//.test(positional[positional.length - 1] || '') || /--delete\b/.test(flags))) gate(`aws s3 ${op} into production storage (it can overwrite or delete objects)`);
    if (svc === 's3api' && /^(put-object|copy-object|upload-part|complete-multipart-upload|restore-object|put-bucket-(lifecycle|policy|acl|public-access-block|ownership-controls|encryption|replication))/.test(op)) gate(`aws s3api ${op}`);
    if (svc === 's3api' && op === 'put-bucket-versioning' && /Suspended/.test(flags)) gate('suspending bucket versioning');
    if (svc === 'iam' && op && !/^(get|list|simulate|generate-credential-report|generate-service-last-accessed-details)/.test(op)) gate(`an IAM change (aws iam ${op})`);
    if (svc === 'cognito-idp' && op && !/^(describe|list|get|admin-get|admin-list)-/.test(op) && !/^(initiate-auth|admin-initiate-auth|respond-to-auth-challenge|admin-respond-to-auth-challenge)$/.test(op)) gate(`a Cognito change (aws cognito-idp ${op})`);
    if (svc === 'kms' && /^(put-key-policy|create-grant|schedule-key-deletion|disable-key|retire-grant|revoke-grant)/.test(op)) gate(`a KMS change (aws kms ${op})`);
    if (svc === 'ec2' && /^(authorize-security-group|create-security-group|revoke-security-group|update-security-group)/.test(op)) gate(`a security-group change (aws ec2 ${op})`);
    if (svc === 'secretsmanager' && /^(put-secret-value|update-secret|rotate-secret|restore-secret)/.test(op)) gate(`overwriting a secret (aws secretsmanager ${op})`);
    if (svc === 'ssm' && op === 'put-parameter' && /--overwrite\b/.test(flags)) gate('overwriting an SSM parameter');
  }
  for (const { words } of gh) {
    const [group = '', sub = ''] = words;
    const rest = words.slice(1).join(' ');
    if (sub === 'delete' || (group === 'repo' && ['archive', 'rename', 'edit'].includes(sub))) gate(`gh ${group} ${sub}`);
    if (['secret', 'variable'].includes(group) && ['set', 'delete', 'remove'].includes(sub)) gate(`changing a GitHub ${group} (gh ${group} ${sub})`);
    if (group === 'api' && /(?:-X\s*|--method[=\s]+)DELETE\b/i.test(rest)) gate('a GitHub API DELETE');
    if (group === 'api' && /(?:-X\s*|--method[=\s]+)(PUT|POST|PATCH)\b/i.test(rest) && /\/(protection|rulesets|environments|actions\/(secrets|variables|permissions))\b/.test(rest)) gate('a GitHub settings, environment or secret change');
  }
  if (/(^|[\n;&|(`]\s*)git\s+push\b[^\n]*(\s--delete\b|\s-d\b|\s:[^\s]+)/.test(scan)) gate('deleting a remote branch or tag');

  // The database: destructive SQL and schema changes, wherever the command
  // sends SQL (psql, a migration tool, SSM or SSH to the box).
  if (/\b(psql|pg_restore|sequelize|rds-data|send-command|ssh|knex|prisma)\b/.test(scan)) {
    if (/\b(DROP\s+(TABLE|SCHEMA|DATABASE|COLUMN|INDEX|VIEW|TYPE|SEQUENCE|MATERIALIZED|EXTENSION|ROLE|USER|OWNED)|TRUNCATE)\b/i.test(scan)) gate('DROP or TRUNCATE in the database');
    if (/\bALTER\s+TABLE\b[^;]*\bDROP\b/i.test(scan)) gate('ALTER TABLE … DROP');
    for (const m of scan.matchAll(/\bDELETE\s+FROM\b([^;"']*)/gi)) if (!/\bWHERE\b/i.test(m[1])) gate('DELETE without WHERE');
    for (const m of scan.matchAll(/\bUPDATE\s+[\w."]+\s+SET\b([^;"']*)/gi)) if (!/\bWHERE\b/i.test(m[1])) gate('UPDATE without WHERE');
    if (/\bpg_restore\b/.test(scan)) gate('pg_restore (restoring over a database)');
    if (/\bpsql\b[^\n]*\s(-f|--file)[=\s]/.test(scan)) gate('psql running a SQL file the guard cannot read');
  }
  if (/\b(db:migrate:undo|migrate:undo|migrate:down|migrate:reset|db:drop|db:seed:undo)\b/.test(scan)) gate('undoing migrations or dropping the database');
  if (/(^|[\s;&|(])(DB_SYNC_FORCE|CONFIRM_FORCE_SYNC)=/.test(scan)) gate('force sync, which drops every table');
  if (/(^|[\n;&|(`]\s*)(sudo\s+)?(dropdb|dropuser)\b/.test(scan)) gate('dropdb / dropuser');
  // The production box: deleting files, the process manager's entries, or
  // the server's settings.
  if (/\bssh\b/.test(scan) && /\brm\s+(-[a-zA-Z]*[rf][a-zA-Z]*\s+)+/.test(scan)) gate('rm -r/-f on a remote host');
  if (invocations('pm2').some(({ words }) => ['delete', 'kill', 'flush'].includes(words[0]))) gate('pm2 delete / kill / flush');

  process.exit(0);
});

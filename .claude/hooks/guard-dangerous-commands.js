#!/usr/bin/env node
// PreToolUse guard for Bash / PowerShell commands.
// Blocks anything that would touch a production host, AWS, RDS, PM2,
// dispatch or enable a workflow, push straight to main/dev, or force-sync the DB.
// Agent sessions never contact hosts; production actions are Evoni's (CLAUDE.md).
// Production reads are default-deny: only the method F-Tools-3 approves, for a
// task Evoni authorizes, and never with credentials found in the environment.
// Exit 2 = block (stderr is shown to Claude). Exit 0 = allow.
// It matches COMMAND POSITION only, so prose or documents that merely mention
// `pm2` or an RDS hostname are not blocked. Heredoc bodies written to files with
// `cat`/`tee` are treated as data and ignored; heredocs fed to a shell are not.
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let cmd = '';
  try { cmd = String((JSON.parse(raw).tool_input || {}).command || ''); } catch (e) { process.exit(0); }

  // A commit, tag or note message is data, not commands (Task #2299): its
  // quoted -m/--message arguments are blanked, and a heredoc that git reads
  // as a message is treated like a cat/tee heredoc. Anything outside the
  // quotes, or a heredoc piped on into a shell, is still scanned.
  // An escaped pipe (`\|`, as in grep -n "a\|pm2") is a literal character,
  // never a shell pipe, so it never starts a command (Issue #3650: two such
  // greps were blocked as if they ran pm2 or the deploy script).
  const unescaped = cmd.replace(/\\\|/g, '\\¦');
  const isGitMessage = /(^|[\n;&|(`]\s*)git\s+(commit|tag|notes)\b/.test(unescaped);
  const input = isGitMessage
    ? unescaped.replace(/(\s(?:-m|--message)(?:\s+|=))("(?:[^"\\]|\\[\s\S])*"|'[^']*')/g, '$1""')
    : unescaped;
  const dataConsumer = (line) =>
    /(^|[\s;&|(])(cat|tee)\b/.test(line) || /(^|[\s;&|(])git\s+(commit|tag|notes)\b/.test(line);

  // Drop heredoc bodies whose consumer is a file writer (cat/tee) or a git
  // message, keep the rest.
  const heredoc = /(^|\n)([^\n]*?)<<-?\s*'?"?([A-Za-z_][A-Za-z0-9_]*)"?'?[^\n]*\n([\s\S]*?)\n\3(?=\n|$)/g;
  const scan = input.replace(heredoc, (m, pre, line, tag, body) =>
    dataConsumer(line) ? `${pre}${line}<<${tag}\n${tag}` : m);

  // "command position": start of string, start of a line, or after ; & | ( ` $( or sudo/env prefixes.
  const at = (name) => new RegExp(`(^|[\\n;&|(\`]\\s*|\\$\\(\\s*)(sudo\\s+|env\\s+[A-Z_]+=\\S+\\s+)*${name}(\\s|$)`);
  const rules = [
    [at('(ssh|scp|sftp|rsync)'), 'SSH/SCP/rsync to any host. Agent sessions never contact hosts; production actions are Evoni\'s (CLAUDE.md).'],
    [at('pm2'), 'pm2 on any box. A process reload can silently swap prod onto the empty DB.'],
    [at('aws'), 'AWS CLI. Evoni runs AWS commands personally (v25 Owed Index Amd30 AF2.6). Task-scoped production reads go only through the approved method in F-Tools-3, never the CLI in a session.'],
    // F-Tools-3 (2026-10-29): production is default-deny. No direct request to
    // AWS from a session, whatever the tool: a production read happens only
    // through the method F-Tools-3 approves, for a task Evoni authorizes.
    [/(^|[\n;&|(`]\s*|\$\(\s*)(sudo\s+)?(curl|wget|aria2c|https?|xh)\b[^\n]*(amazonaws\.com|awsapps\.com|amazoncognito\.com|cloudfront\.net)/i, 'A direct request to an AWS endpoint (S3, SSO, Cognito, CloudFront). Production is default-deny (F-Tools-3); reads go only through the approved method for a task Evoni authorizes.'],
    [/(^|[\n;&|(`]\s*)(python3?|node|deno|bun|ruby|perl)\b[\s\S]*?(amazonaws\.com|awsapps\.com|amazoncognito\.com)/i, 'A script that calls an AWS endpoint. Production is default-deny (F-Tools-3); reads go only through the approved method for a task Evoni authorizes.'],
    [/\b(boto3|botocore|@aws-sdk\/|aws-sdk['"/])/, 'An AWS SDK used from a session. Production is default-deny (F-Tools-3).'],
    // A signed link is a credential: it never appears in a command, where the transcript would keep it.
    [/X-Amz-(Signature|Credential|Security-Token)=/i, 'A presigned AWS link in a command. Signed links are credentials and never appear in a session transcript (F-Tools-3).'],
    // Credentials in the session environment are never read or used (CLAUDE.md, F-Tools-1, F-Tools-3).
    [/AWS_(SECRET_ACCESS_KEY|SESSION_TOKEN|ACCESS_KEY_ID)\b/, 'Reading or using AWS credentials from the environment. Credentials found in a session are never used (F-Tools-1, F-Tools-3).'],
    [/(^|[\n;&|(`]\s*)(printenv|env|export\s+-p|declare\s+-x|set)\s*($|\||;|&|\n)/, 'Printing the whole environment, which may contain credentials. Name the variable you need instead (F-Tools-3).'],
    [/(^|[\s;&|(=])~?[^\s;&|]*\.aws\/(credentials|config|sso|cli)\b/, 'Reading the AWS credential or SSO cache files. Credentials found in a session are never used (F-Tools-1, F-Tools-3).'],
    [/(psql|pg_dump|pg_restore|pg_isready|DATABASE_URL=|DB_HOST=|postgres(ql)?:\/\/)[^\n]*(rds\.amazonaws\.com|episode-control-(dev|prod))/i, 'A connection to a live RDS instance. No DB contact from agent sessions; identity by query, never by name.'],
    [/(rds\.amazonaws\.com|episode-control-(dev|prod))[^\n]*(psql|pg_dump|pg_restore|sequelize)/i, 'A connection to a live RDS instance. No DB contact from agent sessions.'],
    [/(^|[\s;&|(])(DB_SYNC_FORCE|CONFIRM_FORCE_SYNC)=/, 'Force sync drops every table.'],
    [at('gh\\s+workflow\\s+(enable|disable|run|dispatch)'), 'Enabling or dispatching a workflow is a Rule 7 gate for Evoni, not an agent action.'],
    // Issue #3650 rulings (2026-10-30): Evoni starts every workflow run; a
    // session never re-runs, cancels or approves one, never merges without her
    // explicit yes (and then only through the GitHub tool, which asks), never
    // turns on auto-merge and never changes repository settings or secrets.
    // The GitHub tool has its own guard (guard-github-tools.js); these close
    // the same doors in the shell.
    [at('gh\\s+run\\s+(rerun|cancel|delete)'), 'Re-running, cancelling or deleting a workflow run is Evoni\'s (Issue #3650 rulings).'],
    [at('gh\\s+pr\\s+merge'), 'Merging from the shell. A merge needs Evoni\'s explicit yes and goes through the GitHub tool, which asks (Rule 7).'],
    [at('gh\\s+(repo\\s+(edit|delete|rename|archive)|secret\\s+(set|delete|remove)|variable\\s+(set|delete|remove))'), 'Changing repository settings, secrets or variables is Evoni\'s (Issue #3650 rulings).'],
    [/(^|[\n;&|(`]\s*|\$\(\s*)(sudo\s+)?(gh\s+api|(curl|wget|https?|xh)\b[^\n]*api\.github\.com)\b[^\n]*(\/dispatches\b|\/pending_deployments\b|\/merges?\b|\/rerun|\/cancel\b|\/environments\b|\/rulesets\b|\/protection\b|\/actions\/(secrets|variables|permissions)\b|\/automerge|mergePullRequest|enablePullRequestAutoMerge|approveDeployments|reviewPendingDeployments)/i, 'A GitHub API call that starts, approves, re-runs, cancels or merges, or changes settings, environments, rulesets, secrets or variables. Those are Evoni\'s (Issue #3650 rulings).'],
    [/(^|[\n;&|(`]\s*)git\s+push\b[^\n]*(\s|:)(origin\s+)?(main|dev)(\s|$)/, 'Direct push to main or dev. Work lands by PR + squash-merge.'],
    [/(^|[\n;&|(`]\s*)git\s+push\b[^\n]*(--force\b|\s-f\b|--force-with-lease)/, 'Force push. Never rewrite history on a shared branch.'],
  ];
  // Task #2161: scripts/deploy-prod.sh is Evoni's production deploy. Executing
  // it is blocked; reading, editing, grepping, syntax-checking (bash -n) and
  // git commands on it are allowed. Execution means, at command position and
  // after any sudo/env/nohup/time/nice/timeout/VAR=value prefix:
  //   - a shell, exec, source or . given the script (bash|sh|zsh|dash|ksh);
  //   - the script's path as the command (./scripts/deploy-prod.sh, …), but
  //     not a bare assignment that only names it (S=scripts/deploy-prod.sh);
  //   - its contents piped into a shell (cat …deploy-prod… | bash).
  // Heredoc bodies fed to a shell count too, including a cat/tee heredoc
  // whose output is piped into one (those are otherwise dropped as data).
  const scanExec = input.replace(heredoc, (m, pre, line, tag) => {
    const firstLine = m.slice(pre.length).split('\n')[0]; // the whole `cat <<EOF | …` line
    return dataConsumer(line) && !/\|\s*(sudo\s+)?(bash|sh|zsh|dash|ksh)\b/.test(firstLine)
      ? `${pre}${line}<<${tag}\n${tag}` : m;
  });
  const POS = '(?:^|[\\n;&|(`]\\s*|\\$\\(\\s*)';
  // sudo may carry options with or without a value (`sudo -u ubuntu -H bash …`, Task #2845).
  const PREFIX = '(?:sudo(?:\\s+-[A-Za-z]+(?:\\s+(?!-)[^\\s;&|]+)?)*\\s+|(?:nohup|time|nice|setsid|command|builtin)\\s+|env(?:\\s+-\\S+)*\\s+|timeout\\s+\\S+\\s+|[A-Za-z_][A-Za-z0-9_]*=\\S*\\s+)*';
  // The three execution forms above, for a script whose path matches `name`.
  const execForms = (name) => {
    const syntaxOnly = `-n\\s+[^\\s;&|]*${name}[^\\s;&|]*\\s*(?:$|[;&|\\n])`;
    return [
      new RegExp(`${POS}${PREFIX}(?:(?:bash|sh|zsh|dash|ksh)\\s+(?!${syntaxOnly})|(?:exec|source|\\.)\\s+)[^\\n;&|]*${name}`),
      // The command word itself must not be an assignment: `S=scripts/deploy-prod.sh`
      // only names the path (Task #2166); `S=x ./scripts/deploy-prod.sh` still runs it.
      new RegExp(`${POS}${PREFIX}(?![A-Za-z_][A-Za-z0-9_]*=)[^\\s;&|()<>]*${name}`),
      new RegExp(`${name}[^\\n]*\\|\\s*(?:sudo\\s+)?(?:bash|sh|zsh|dash|ksh)\\b`),
    ];
  };
  // Task #2845: the Deploy workflow's scripts, scripts/deploy/workflow-deploy.sh
  // (on the box) and scripts/deploy/ssm-phase.sh (the runner side, which calls
  // aws ssm), get the same rule. Only GitHub Actions runs them.
  const guardedScripts = [
    [execForms('deploy-prod'), "executing scripts/deploy-prod.sh, Evoni's production deploy. Agent sessions never run it; reading, editing and git commands on it are fine."],
    [execForms('(?:workflow-deploy|ssm-phase)'), 'executing scripts/deploy/workflow-deploy.sh or scripts/deploy/ssm-phase.sh, the Deploy workflow\'s scripts. Only GitHub Actions runs them, after Evoni approves a run; reading, editing, linting and git commands on them are fine.'],
    // F-Tools-2: the Diagnostics workflow's runner-side scripts (they call aws
    // and push to the private output repository). A session starts the
    // workflow through the GitHub tool and reads its private report instead.
    [execForms('diagnostics/(?:runner|publish)'), 'executing scripts/diagnostics/runner.sh or publish.sh, the Diagnostics workflow\'s scripts. Only GitHub Actions runs them; a session starts the workflow and reads its report. Reading, editing, testing and git commands on them are fine.'],
  ];
  for (const [res, why] of guardedScripts) {
    if (res.some((re) => re.test(scanExec))) {
      process.stderr.write(`[guard] BLOCKED: ${why}\nCommand: ${cmd.slice(0, 300)}\nIf this is genuinely needed, Evoni runs it herself outside the agent session.\n`);
      process.exit(2);
    }
  }
  for (const [re, why] of rules) {
    if (re.test(scan)) {
      process.stderr.write(`[guard] BLOCKED: ${why}\nCommand: ${cmd.slice(0, 300)}\nIf this is genuinely needed, Evoni runs it herself outside the agent session.\n`);
      process.exit(2);
    }
  }
  process.exit(0);
});

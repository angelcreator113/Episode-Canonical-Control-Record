#!/usr/bin/env node
// PreToolUse guard for Bash / PowerShell commands.
// Blocks anything that would touch a production host, AWS, RDS, PM2,
// dispatch or enable a workflow, push straight to main/dev, or force-sync the DB.
// Agent sessions never contact hosts; production actions are Evoni's (CLAUDE.md).
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

  // Drop heredoc bodies whose consumer is a file writer (cat/tee), keep the rest.
  const heredoc = /(^|\n)([^\n]*?)<<-?\s*'?"?([A-Za-z_][A-Za-z0-9_]*)"?'?[^\n]*\n([\s\S]*?)\n\3(?=\n|$)/g;
  const scan = cmd.replace(heredoc, (m, pre, line, tag, body) =>
    /(^|[\s;&|(])(cat|tee)\b/.test(line) ? `${pre}${line}<<${tag}\n${tag}` : m);

  // "command position": start of string, start of a line, or after ; & | ( ` $( or sudo/env prefixes.
  const at = (name) => new RegExp(`(^|[\\n;&|(\`]\\s*|\\$\\(\\s*)(sudo\\s+|env\\s+[A-Z_]+=\\S+\\s+)*${name}(\\s|$)`);
  const rules = [
    [at('(ssh|scp|sftp|rsync)'), 'SSH/SCP/rsync to any host. Agent sessions never contact hosts; production actions are Evoni\'s (CLAUDE.md).'],
    [at('pm2'), 'pm2 on any box. A process reload can silently swap prod onto the empty DB.'],
    [at('aws'), 'AWS CLI. Evoni runs AWS commands personally (v25 Owed Index Amd30 AF2.6).'],
    [/(psql|pg_dump|pg_restore|pg_isready|DATABASE_URL=|DB_HOST=|postgres(ql)?:\/\/)[^\n]*(rds\.amazonaws\.com|episode-control-(dev|prod))/i, 'A connection to a live RDS instance. No DB contact from agent sessions; identity by query, never by name.'],
    [/(rds\.amazonaws\.com|episode-control-(dev|prod))[^\n]*(psql|pg_dump|pg_restore|sequelize)/i, 'A connection to a live RDS instance. No DB contact from agent sessions.'],
    [/(^|[\s;&|(])(DB_SYNC_FORCE|CONFIRM_FORCE_SYNC)=/, 'Force sync drops every table.'],
    [at('gh\\s+workflow\\s+(enable|run|dispatch)'), 'Enabling or dispatching a workflow is a Rule 7 gate for Evoni, not an agent action.'],
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
  const scanExec = cmd.replace(heredoc, (m, pre, line, tag) => {
    const firstLine = m.slice(pre.length).split('\n')[0]; // the whole `cat <<EOF | …` line
    return /(^|[\s;&|(])(cat|tee)\b/.test(line) && !/\|\s*(sudo\s+)?(bash|sh|zsh|dash|ksh)\b/.test(firstLine)
      ? `${pre}${line}<<${tag}\n${tag}` : m;
  });
  const POS = '(?:^|[\\n;&|(`]\\s*|\\$\\(\\s*)';
  const PREFIX = '(?:(?:sudo|nohup|time|nice|setsid|command|builtin)\\s+|env(?:\\s+-\\S+)*\\s+|timeout\\s+\\S+\\s+|[A-Za-z_][A-Za-z0-9_]*=\\S*\\s+)*';
  const SYNTAX_ONLY = '-n\\s+[^\\s;&|]*deploy-prod[^\\s;&|]*\\s*(?:$|[;&|\\n])';
  const deployProdExec = [
    new RegExp(`${POS}${PREFIX}(?:(?:bash|sh|zsh|dash|ksh)\\s+(?!${SYNTAX_ONLY})|(?:exec|source|\\.)\\s+)[^\\n;&|]*deploy-prod`),
    // The command word itself must not be an assignment: `S=scripts/deploy-prod.sh`
    // only names the path (Task #2166); `S=x ./scripts/deploy-prod.sh` still runs it.
    new RegExp(`${POS}${PREFIX}(?![A-Za-z_][A-Za-z0-9_]*=)[^\\s;&|()<>]*deploy-prod`),
    /deploy-prod[^\n]*\|\s*(?:sudo\s+)?(?:bash|sh|zsh|dash|ksh)\b/,
  ];
  if (deployProdExec.some((re) => re.test(scanExec))) {
    process.stderr.write(`[guard] BLOCKED: executing scripts/deploy-prod.sh, Evoni's production deploy. Agent sessions never run it; reading, editing and git commands on it are fine.\nCommand: ${cmd.slice(0, 300)}\nIf this is genuinely needed, Evoni runs it herself outside the agent session.\n`);
    process.exit(2);
  }
  for (const [re, why] of rules) {
    if (re.test(scan)) {
      process.stderr.write(`[guard] BLOCKED: ${why}\nCommand: ${cmd.slice(0, 300)}\nIf this is genuinely needed, Evoni runs it herself outside the agent session.\n`);
      process.exit(2);
    }
  }
  process.exit(0);
});

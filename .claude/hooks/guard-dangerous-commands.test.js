#!/usr/bin/env node
// Test matrix for guard-dangerous-commands.js. Run: node .claude/hooks/guard-dangerous-commands.test.js
// Each case feeds the hook the JSON Claude Code sends on stdin and checks the exit code
// (2 = blocked, 0 = allowed). Keep this file free of real commands: cases are data.
const { spawnSync } = require('child_process');
const path = require('path');
const HOOK = path.join(__dirname, 'guard-dangerous-commands.js');

const BLOCK = 2, ALLOW = 0;
const cases = [
  [BLOCK, 'ssh ubuntu@54.163.229.144'],
  [BLOCK, 'sudo pm2 restart episode-api'],
  [BLOCK, 'cd /x && pm2 list'],
  [BLOCK, 'aws ssm describe-parameters --region us-east-1'],
  [BLOCK, 'psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com -U postgres'],
  [BLOCK, 'DATABASE_URL=postgresql://u:p@episode-control-prod.x.rds.amazonaws.com/db npm run migrate:up'],
  [BLOCK, 'git push origin main'],
  [BLOCK, 'git push origin HEAD:main'],
  [BLOCK, 'git push --force origin claude/x'],
  [BLOCK, 'gh workflow run deploy-dev.yml'],
  [BLOCK, 'DB_SYNC_FORCE=true npm start'],
  [BLOCK, 'bash <<EOF\npm2 restart all\nEOF'],
  [BLOCK, 'echo hi; scp file ubuntu@host:/tmp'],
  // Task #2161: executing the production deploy script is blocked…
  [BLOCK, 'bash scripts/deploy-prod.sh'],
  [BLOCK, 'bash scripts/deploy-prod.sh --update-env'],
  [BLOCK, 'sh scripts/deploy-prod.sh'],
  [BLOCK, 'zsh ./scripts/deploy-prod.sh'],
  [BLOCK, 'exec scripts/deploy-prod.sh'],
  [BLOCK, './scripts/deploy-prod.sh --app episode-api-prod-hotfix'],
  [BLOCK, 'scripts/deploy-prod.sh'],
  [BLOCK, '/home/ubuntu/episode-metadata/scripts/deploy-prod.sh'],
  [BLOCK, 'source scripts/deploy-prod.sh'],
  [BLOCK, '. scripts/deploy-prod.sh'],
  [BLOCK, 'cd /x && bash scripts/deploy-prod.sh'],
  [BLOCK, 'env bash scripts/deploy-prod.sh'],
  [BLOCK, 'env -i PATH=/usr/bin bash scripts/deploy-prod.sh'],
  [BLOCK, 'env CLAUDECODE= bash scripts/deploy-prod.sh'],
  [BLOCK, 'CLAUDECODE= ./scripts/deploy-prod.sh'],
  [BLOCK, 'sudo bash scripts/deploy-prod.sh'],
  [BLOCK, 'nohup bash scripts/deploy-prod.sh &'],
  [BLOCK, 'timeout 60 bash scripts/deploy-prod.sh'],
  [BLOCK, 'bash -x scripts/deploy-prod.sh'],
  [BLOCK, 'bash -c "scripts/deploy-prod.sh"'],
  [BLOCK, 'bash < scripts/deploy-prod.sh'],
  [BLOCK, 'cat scripts/deploy-prod.sh | bash'],
  [BLOCK, 'git show HEAD:scripts/deploy-prod.sh | sudo sh'],
  [BLOCK, 'echo ok; $(scripts/deploy-prod.sh)'],
  [BLOCK, "bash <<EOF\nscripts/deploy-prod.sh\nEOF"],
  [BLOCK, "cat <<EOF | bash\nscripts/deploy-prod.sh\nEOF"],
  // …while reading, editing, grepping, syntax checks and git commands are not.
  [ALLOW, 'cat scripts/deploy-prod.sh'],
  [ALLOW, 'sed -n 1,40p scripts/deploy-prod.sh'],
  [ALLOW, 'grep -n "stop" scripts/deploy-prod.sh'],
  [ALLOW, 'grep -rn deploy-prod DEVELOPMENT_WORKFLOW.md'],
  [ALLOW, 'bash -n scripts/deploy-prod.sh'],
  [ALLOW, 'bash -n scripts/deploy-prod.sh && echo ok'],
  [ALLOW, 'shellcheck scripts/deploy-prod.sh'],
  [ALLOW, 'chmod +x scripts/deploy-prod.sh'],
  [ALLOW, 'git add scripts/deploy-prod.sh'],
  [ALLOW, 'git diff -- scripts/deploy-prod.sh'],
  [ALLOW, 'git log --oneline -- scripts/deploy-prod.sh'],
  [ALLOW, 'git commit -m "feat(tooling): add scripts/deploy-prod.sh [skip-automerge]"'],
  [ALLOW, 'echo "Evoni runs bash scripts/deploy-prod.sh on the box"'],
  [ALLOW, "cat > docs/x.md <<'EOF'\nRun: bash scripts/deploy-prod.sh\nEOF"],
  [ALLOW, 'npx jest tests/unit/scripts/deployProdScript.test.js'],
  [ALLOW, 'bash scripts/deploy-dev.sh'],
  [ALLOW, 'git push -u origin claude/issue-12-fix'],
  [ALLOW, 'npm run validate'],
  [ALLOW, "echo 'never run pm2 restart on prod'"],
  [ALLOW, "grep -rn 'aws' src/ | head"],
  [ALLOW, 'git log --oneline -5 -- docs/audit/Session_PE_Roster.md'],
  [ALLOW, "cat > docs/x.md <<'EOF'\n# note\nDo not run pm2 restart. The RDS instance episode-control-dev holds canon.\nssh is forbidden.\nEOF"],
  [ALLOW, 'awsome-tool --version'],
  [ALLOW, 'node scripts/check-root-junk.js'],
  [ALLOW, 'git push origin claude/feature-dev-mainline'],
];

let failed = 0;
for (const [want, command] of cases) {
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command } });
  const r = spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8' });
  const ok = r.status === want;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} want=${want} got=${r.status} :: ${command.split('\n')[0].slice(0, 70)}`);
}
console.log(failed ? `\n${failed} case(s) failed` : '\nall cases passed');
process.exit(failed ? 1 : 0);

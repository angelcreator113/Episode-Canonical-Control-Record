#!/usr/bin/env node
// SessionStart hook. In cloud sessions (CLAUDE_CODE_REMOTE=true) it installs
// backend and frontend dependencies in the background; locally it does nothing.
// Written in Node, not bash, so it runs on every platform from the exec-form
// hook command in .claude/settings.json (Task #3661: a Windows session without
// Git Bash runs shell-form hooks in PowerShell, where bash syntax breaks).
const { spawnSync } = require('child_process');
const path = require('path');

if (process.env.CLAUDE_CODE_REMOTE !== 'true') process.exit(0);

// Async mode: the session starts at once while the installs run.
process.stdout.write('{"async": true, "asyncTimeout": 300000}\n');

const root = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
for (const dir of [root, path.join(root, 'frontend')]) {
  const r = spawnSync('npm', ['install'], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.error || r.status !== 0) {
    console.error(`[session-start] npm install failed in ${dir}:`, r.error ? r.error.message : `exit ${r.status}`);
    process.exit(1);
  }
}

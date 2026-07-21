#!/usr/bin/env node
// scripts/check-root-junk.js
// Pre-commit guard: blocks loose/unrecognized files staged at repo ROOT.
// Origin: the ct_modifydb.json incident (2026-06-26) - scratch swept onto
// main by imprecise `git add`, with no commit-time debris guard. The cost
// hook does not catch this class. Allowlist-based: known root entries pass,
// anything else loose at root blocks. Node-based (no bash dependency).
const { execSync } = require("child_process");

// Legit root entries from verified origin/main (2026-06-26). Files inside
// these dirs contain "/" and are never flagged. Debris (0, cors.json,
// tmp_audit.js, tmp_check_db.js) is EXCLUDED so re-staging them also blocks.
// Maintain this set as the repo legitimately grows.
const ALLOWED_ROOT = new Set([
  ".claude", ".dockerignore", ".env.example", ".env.production.template",
  ".eslintignore", ".eslintrc.js", ".gitattributes", ".githooks", ".github",
  ".gitignore", ".pgmrc.json", ".prettierrc.js", ".sequelizerc",
  "CLAUDE.md", "CONTRIBUTING.md", "Dockerfile", "Dockerfile.parity",
  "Dockerfile.prod", "F-Deploy-1_INCIDENT_2026-05-30_prod-autodeploy.md",
  "F-Deploy-1_PROD_SplitBrain_HAZARD.md", "Mvp", "README.md",
  "SESSION_HANDOFF.md", "START_APP.bat", "START_APP.ps1", "VERSION.txt",
  "app.js", "backups", "docker-compose.parity.yml", "docker-compose.test.yml",
  "docker-compose.yml", "docs", "ecosystem.config.js", "ecosystem.dev.config.js", "frontend",
  "jest.config.js", "lambda", "migrations-node-pg-migrate", "migrations",
  "nginx", "package-lock.json", "package.json", "scripts", "src",
  "start-servers.ps1", "start.bat", "start.ps1", "start.sh", "templates",
  "test-assets", "test-images", "tests"
]);

let staged;
try {
  staged = execSync("git diff --cached --name-only --diff-filter=AM", { encoding: "utf8" })
    .split("\n").map(s => s.trim()).filter(Boolean);
} catch (e) {
  console.error("[root-junk] could not read staged files: " + e.message);
  process.exit(1);
}

const rootStaged = staged.filter(p => !p.includes("/"));
const offenders = rootStaged.filter(p => !ALLOWED_ROOT.has(p));

if (offenders.length === 0) process.exit(0);

console.error("");
console.error("[root-junk] Commit blocked - unrecognized file(s) staged at repo root:");
for (const f of offenders) console.error("  - " + f);
console.error("");
console.error("Repo root is allowlisted. If this is scratch/debris:");
console.error("  - move it into a subdir (scripts/, docs/, tests/, ...), or");
console.error("  - add it to .gitignore, or");
console.error("  - unstage it:  git restore --staged <file>");
console.error("If it is a legitimate new root file, add it to ALLOWED_ROOT");
console.error("in scripts/check-root-junk.js.");
console.error("");
process.exit(1);
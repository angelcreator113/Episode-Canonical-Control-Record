#!/usr/bin/env bash
# scripts/deploy-prod.sh — Evoni's manual production deploy (Task #2161).
#
# Evoni-only. Agent sessions never run this.
#
# It performs the manual deploy of DEVELOPMENT_WORKFLOW.md §7.1 (with §7.2's
# --update-env restart and §7.3's frontend/dist backup), stops with a plain
# message at every hazard, and ends with a summary to paste into a session for
# the deploy record. The manual steps in §7.1 stay valid; this only runs them.
#
# It never edits .env, runs migrations, runs npm ci or npm install, runs
# git reset, or deletes anything. Rollback steps are printed as text only.
#
# Usage, on the production box, from the repo root:
#   bash scripts/deploy-prod.sh [--app <pm2 app name>] [--update-env]
#
#   --app <name>   pm2 app to restart (default: episode-api-prod-hotfix)
#   --update-env   restart with --update-env, then pm2 save (§7.2: use after
#                  any change to a credential or to .env)
#
# Exit codes: 0 deployed, or nothing to deploy; 1 stopped at a hazard (the
# message says what, and what has already changed); 2 refused to start.

set -euo pipefail

APP="episode-api-prod-hotfix"
UPDATE_ENV=0
HEALTH_URL="http://localhost:3000/health"
HEALTH_TRIES=20      # every 3 s, so up to 60 s
CFO_TRIES=10         # every 3 s after /health is healthy, so up to 30 s more

usage() {
  sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --app)
      if [ $# -lt 2 ] || [ -z "$2" ]; then echo "--app needs a pm2 app name." >&2; exit 2; fi
      APP="$2"; shift 2 ;;
    --update-env) UPDATE_ENV=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1 (see --help)." >&2; exit 2 ;;
  esac
done

STEP_N=0
OLD_SHA=""
NEW_SHA=""
BACKUP=""
BACKUP_SHOWN=""
RESTARTED=0

step() {
  STEP_N=$((STEP_N + 1))
  printf '\n== %d. %s ==\n' "$STEP_N" "$1"
}

refuse() {
  printf 'REFUSED: %s\n' "$1" >&2
  exit 2
}

# Removes IP addresses and AWS-style hostnames from any text it prints.
redact() {
  sed -E \
    -e 's/([0-9]{1,3}\.){3}[0-9]{1,3}/[ip]/g' \
    -e 's/[A-Za-z0-9._-]+\.(amazonaws\.com|compute\.internal|ec2\.internal)/[host]/g' \
    -e 's/ip-[0-9]+-[0-9]+-[0-9]+-[0-9]+/[host]/g'
}

# Printed, never run.
rollback_text() {
  echo "Rollback steps (NOT run; do these by hand only if you decide to roll back):"
  if [ -n "$NEW_SHA" ] && [ "$NEW_SHA" != "$OLD_SHA" ]; then
    echo "  1. git reset --hard $OLD_SHA        # the tree before this deploy"
  else
    echo "  1. (the tree was not moved; it is still at $OLD_SHA)"
  fi
  if [ -n "$BACKUP" ]; then
    echo "  2. rm -rf frontend/dist && cp -a $BACKUP_SHOWN frontend/dist"
  else
    echo "  2. (no frontend/dist backup was taken; the build was not touched)"
  fi
  if [ "$RESTARTED" = 1 ]; then
    echo "  3. pm2 restart $APP                 # after steps 1 and 2"
  else
    echo "  3. (the API was not restarted; it is still running the old code)"
  fi
}

# stop <reason> [detail lines...]: prints the reason, what has changed so
# far, and the rollback text when something has changed; exits 1.
stop() {
  {
    printf '\nSTOPPED: %s\n' "$1"
    shift
    for line in "$@"; do printf '  %s\n' "$line"; done
    if [ -n "$BACKUP" ] || { [ -n "$NEW_SHA" ] && [ "$NEW_SHA" != "$OLD_SHA" ]; }; then
      echo
      if [ -n "$NEW_SHA" ] && [ "$NEW_SHA" != "$OLD_SHA" ] && [ "$RESTARTED" = 0 ]; then
        echo "  Note: the tree is fast-forwarded and frontend/dist was rebuilt, so the new"
        echo "  frontend is already being served (§7.3), while the API still runs the old code."
      fi
      rollback_text | sed 's/^/  /'
    else
      echo "  Nothing has been changed."
    fi
  } >&2
  exit 1
}

ask() {
  local answer=""
  printf '%s [y/N] ' "$1"
  if ! read -r answer; then answer=""; fi
  [ "$answer" = "y" ] || [ "$answer" = "Y" ]
}

# ── Refuse to start unless this is Evoni, at the repo root, with the app ──
if [ -n "${CLAUDECODE:-}" ]; then
  refuse "CLAUDECODE is set, so this is a Claude Code session. Evoni-only: agent sessions never run this."
fi
if [ ! -d .git ] || [ ! -f package.json ] || [ ! -f scripts/check-pending-migrations.js ] || [ ! -d frontend ]; then
  refuse "Run this from the repo root (the directory with .git, package.json, frontend/ and scripts/check-pending-migrations.js)."
fi
if ! command -v pm2 >/dev/null 2>&1; then
  refuse "pm2 is not on PATH."
fi
if ! pm2 describe "$APP" >/dev/null 2>&1; then
  refuse "pm2 has no app named '$APP'. Pass the right one with --app <name>."
fi

# ── a. Current state ──
step "Current state"
OLD_SHA="$(git rev-parse HEAD)"
echo "Current SHA: $OLD_SHA"
echo "git status --short:"
git status --short | redact
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  stop "Tracked files are modified in the working tree (listed above; untracked files are fine)." \
    "Commit, stash or restore them by hand first."
fi

# ── b. What would be deployed ──
step "Fetch origin/main"
git fetch origin
TARGET_SHA="$(git rev-parse origin/main)"
COUNT="$(git rev-list --count "HEAD..$TARGET_SHA")"
if [ "$COUNT" -eq 0 ]; then
  echo "Nothing to deploy: origin/main has no commits beyond $OLD_SHA."
  exit 0
fi
echo "$COUNT commit(s) to deploy, $OLD_SHA..$TARGET_SHA:"
git log --oneline "HEAD..$TARGET_SHA"

# ── c. Migrations and packages ──
step "Migrations and packages in the range"
MIGRATIONS="$(git diff --name-only HEAD "$TARGET_SHA" -- src/migrations/)"
PACKAGES="$(git diff --name-only HEAD "$TARGET_SHA" -- package.json package-lock.json frontend/package.json frontend/package-lock.json)"
if [ -n "$MIGRATIONS" ]; then
  # shellcheck disable=SC2086
  stop "Migration files change in this range:" $MIGRATIONS \
    "This script does not deploy migrations. Follow DEVELOPMENT_WORKFLOW.md §7.1 by hand."
fi
if [ -n "$PACKAGES" ]; then
  # shellcheck disable=SC2086
  stop "Package files change in this range:" $PACKAGES \
    "npm ci is needed before continuing, and this script does not run it." \
    "Deploy this range by hand (fast-forward, npm ci, then §7.1)."
fi
echo "No migration files and no package or lock files change."

# ── d. Back up, fast-forward, build ──
step "Back up frontend/dist, fast-forward, build"
if [ ! -d frontend/dist ]; then
  stop "frontend/dist does not exist, so there is nothing to back up." \
    "Build or restore it by hand first; a deploy without a backup has no rollback."
fi
TS="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$HOME/dist-backup-$TS"
# A literal ~ for display: the printed path, not the one used.
# shellcheck disable=SC2088
BACKUP_SHOWN="~/dist-backup-$TS"
if [ -e "$BACKUP" ]; then
  BACKUP=""
  stop "$BACKUP_SHOWN already exists; not overwriting it. Run again in a second."
fi
cp -a frontend/dist "$BACKUP"
echo "Backed up frontend/dist to $BACKUP_SHOWN"

if ! git merge --ff-only "$TARGET_SHA"; then
  stop "git merge --ff-only $TARGET_SHA was refused (not a fast-forward)." \
    "The tree was not moved. Look at why HEAD and origin/main diverged before deploying."
fi
NEW_SHA="$(git rev-parse HEAD)"
echo "Fast-forwarded to $NEW_SHA"

BUILD_LOG="$HOME/dist-backup-$TS.vite-build.log"
echo "Building the frontend (log: ~/dist-backup-$TS.vite-build.log)..."
if ! (cd frontend && npx vite build) >"$BUILD_LOG" 2>&1; then
  tail -20 "$BUILD_LOG" | redact
  stop "The vite build failed (last lines above)." \
    "frontend/dist may be partly rebuilt: restore it from the backup (step 2 below) before anything else."
fi
tail -3 "$BUILD_LOG" | redact
BUILD_TIME="$(grep -oE 'built in [0-9.]+ ?m?s' "$BUILD_LOG" | tail -1 || true)"
BUILD_TIME="${BUILD_TIME:-built (time not found in the log)}"

# ── e. Pending migrations ──
step "Pending migrations (read-only)"
set +e
PENDING_OUT="$(NODE_ENV=production node scripts/check-pending-migrations.js 2>&1)"
PENDING_RC=$?
set -e
TARGET_LINE="$(printf '%s\n' "$PENDING_OUT" | grep 'reading SequelizeMeta:' | tail -1 \
  | sed -E 's#→ [^/]*/#→ [host hidden]/#' | redact || true)"
RESULT_LINE="$(printf '%s\n' "$PENDING_OUT" \
  | grep -E '^\[pending-migrations\] (OK|FAIL|ERROR|[0-9]+ pending)' | head -1 | redact || true)"
echo "${TARGET_LINE:-(no \"reading SequelizeMeta\" line printed)}"
echo "${RESULT_LINE:-(no result line printed)}"
echo "exit $PENDING_RC"
if [ "$PENDING_RC" -ne 0 ]; then
  stop "The pending-migration check exited $PENDING_RC, not 0. Do not restart." \
    "Run NODE_ENV=production node scripts/check-pending-migrations.js by hand for the full output."
fi
if ! ask "Is that the database the API uses?"; then
  stop "You did not confirm the database. Do not restart until the check reads the API's database."
fi

# ── f. ANTHROPIC_API_KEY ──
step "ANTHROPIC_API_KEY in .env (count only)"
KEY_COUNT=0
if [ -f .env ]; then
  KEY_COUNT="$(grep -cE '^[[:space:]]*(export[[:space:]]+)?ANTHROPIC_API_KEY=[^[:space:]]' .env || true)"
fi
echo "ANTHROPIC_API_KEY lines with a value in .env: $KEY_COUNT (value not read or printed)"
if [ "$KEY_COUNT" -eq 0 ]; then
  echo "WARNING: no ANTHROPIC_API_KEY in .env. AI features and creation drafts will be off. Continuing."
fi

# ── g. Restart ──
step "Restart"
if [ "$UPDATE_ENV" = 1 ]; then
  echo "Will run: pm2 restart $APP --update-env, then pm2 save (§7.2)"
else
  echo "Will run: pm2 restart $APP (plain; use --update-env after a credential or .env change)"
fi
if ! ask "Restart now?"; then
  stop "You chose not to restart."
fi
if [ "$UPDATE_ENV" = 1 ]; then
  pm2 restart "$APP" --update-env | redact
  RESTARTED=1
  pm2 save | redact
else
  pm2 restart "$APP" | redact
  RESTARTED=1
fi

# ── h. /health ──
step "Waiting for /health (every 3 s, up to 60 s)"
HEALTH_BODY=""
LAST_BODY=""
for _ in $(seq 1 "$HEALTH_TRIES"); do
  sleep 3
  LAST_BODY="$(curl -s -m 5 "$HEALTH_URL" || true)"
  if printf '%s' "$LAST_BODY" | grep -q '"status":"healthy"' \
    && printf '%s' "$LAST_BODY" | grep -q '"database":"connected"'; then
    HEALTH_BODY="$LAST_BODY"
    break
  fi
done
if [ -z "$HEALTH_BODY" ]; then
  stop "/health did not report healthy with the database connected within 60 s." \
    "Last response: $(printf '%s' "${LAST_BODY:-(none)}" | redact)"
fi
HEALTH_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "/health at $HEALTH_AT: $(printf '%s' "$HEALTH_BODY" | redact)"

# ── i. Restart count, Ready line, first CFO audit ──
step "Restart count, Ready line and CFO audit"
RESTART_COUNT="$(pm2 jlist | node -e '
let s = ""; process.stdin.on("data", (d) => { s += d; }).on("end", () => {
  const app = process.argv[1];
  const p = (JSON.parse(s) || []).find((x) => (x.name || (x.pm2_env || {}).name) === app);
  console.log(p && p.pm2_env && p.pm2_env.restart_time !== undefined ? p.pm2_env.restart_time : "unknown");
});' "$APP" 2>/dev/null || echo unknown)"
echo "Restart count: $RESTART_COUNT"

# Log lines since the latest "Ready to accept requests".
since_ready() {
  pm2 logs "$APP" --nostream --lines 300 2>/dev/null \
    | awk '/Ready to accept requests/ { buf = ""; found = 1 } found { buf = buf $0 "\n" } END { printf "%s", buf }'
}
READY_LINE="$(since_ready | head -1 | redact || true)"
echo "Ready line: ${READY_LINE:-(not found in the last 300 log lines)}"

CFO_LINES=""
for _ in $(seq 1 "$CFO_TRIES"); do
  CFO_LINES="$(since_ready | grep '\[CFO\]' | redact || true)"
  if printf '%s' "$CFO_LINES" | grep -qE 'Audit complete|Scheduled audit failed'; then break; fi
  sleep 3
done
if [ -n "$CFO_LINES" ]; then
  echo "CFO lines:"
  printf '%s\n' "$CFO_LINES" | sed 's/^/  /'
else
  echo "CFO lines: (none within the wait)"
fi

# ── Summary ──
COMMITS="$(git rev-list --count "$OLD_SHA..$NEW_SHA")"
PRS="$(git log --format=%s "$OLD_SHA..$NEW_SHA" | grep -oE '\(#[0-9]+\)$' | tr -d '()' | sort -t'#' -k2 -n | paste -sd' ' - || true)"
FILES="$(git diff --name-only "$OLD_SHA" "$NEW_SHA" | wc -l | tr -d ' ')"

{
  echo
  echo "===== Paste this into a session for the deploy record ====="
  echo "Deploy (Evoni, $(date -u +%Y-%m-%d), via scripts/deploy-prod.sh)"
  echo "Tree: $OLD_SHA -> $NEW_SHA (fast-forward)"
  echo "Range: $COMMITS commit(s), $FILES file(s); PRs: ${PRS:-none found}"
  echo "No migration or package/lock file in the range."
  echo "Backup: frontend/dist -> $BACKUP_SHOWN"
  echo "vite build: $BUILD_TIME"
  echo "Pending check: ${TARGET_LINE:-(no target line)}"
  echo "Pending result: ${RESULT_LINE:-(no result line)} (exit $PENDING_RC); database confirmed by Evoni"
  echo "ANTHROPIC_API_KEY in .env: count $KEY_COUNT (value not read)"
  if [ "$UPDATE_ENV" = 1 ]; then
    echo "Restart: pm2 restart $APP --update-env, then pm2 save; restart count $RESTART_COUNT"
  else
    echo "Restart: plain pm2 restart $APP; restart count $RESTART_COUNT"
  fi
  echo "/health at $HEALTH_AT: $HEALTH_BODY"
  echo "Ready line: ${READY_LINE:-(not found)}"
  if [ -n "$CFO_LINES" ]; then
    echo "CFO lines:"
    printf '%s\n' "$CFO_LINES" | sed 's/^/  /'
  else
    echo "CFO lines: none within the wait"
  fi
  echo "===== end ====="
} | redact

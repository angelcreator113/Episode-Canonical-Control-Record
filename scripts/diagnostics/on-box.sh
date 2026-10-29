#!/usr/bin/env bash
# scripts/diagnostics/on-box.sh — the server half of the Diagnostics workflow
# (.github/workflows/diagnostics.yml; F-Tools-2, 2026-10-29).
#
# Runs on the production box only, as ubuntu, through the PrimeStudios-Diagnostics
# SSM document, which copies scripts/diagnostics/ out of a commit already on
# origin/main and runs this file with one check name from a fixed list. It reads
# and reports; it changes nothing: no pm2 restart, no git checkout, no writes to
# the app tree, the database or AWS. It never calls `aws`.
#
# It works when the API is down: the SSM agent is a separate service, and every
# item below runs on its own (a failure is reported, then the next item runs).
#
# Everything printed passes through redact.js (keys, tokens, passwords, emails,
# IPs, internal host names), and the total is capped below SSM's 24,000-character
# output limit. It never prints an .env value, `pm2 env`, `pm2 describe` or an
# unfiltered `pm2 jlist` (those carry the app's environment).
#
# Usage: on-box.sh <check> <sha>
#   health        load, memory, disk, pm2 processes, nginx, SSM agent, local /health
#   deploy-state  deployed commit vs origin/main, tree clean, unfinished-deploy marker
#   app-logs      last lines of the API's error and output logs
#   worker-logs   last lines of the worker's error and output logs
#   nginx-logs    nginx error log tail; access-log status counts and top 5xx paths
#   db            database connectivity, read-only proof, migration state
#   db-schema     table list with column counts
#   db-counts     row counts (fixed table list) and largest tables
#   self-test     runs as ubuntu, file modes, redaction works, database refuses writes
# Exit: 0 ok; 1 a check reported a failure; 2 refused (bad arguments, CLAUDECODE, root).

set -uo pipefail

CHECK="${1:-}"
TARGET="${2:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${APP_DIR:-/home/ubuntu/episode-metadata}"
LOG_DIR="${LOG_DIR:-$APP_DIR/logs}"
NGINX_LOG_DIR="${NGINX_LOG_DIR:-/var/log/nginx}"
API_APP="episode-api-prod-hotfix"
HEALTH_URL="${BOX_HEALTH_URL:-http://localhost:3000/health}"
MAX_BYTES=22000
RC=0

refuse() { printf 'REFUSED: %s\n' "$1"; exit 2; }

if [ -n "${CLAUDECODE:-}" ]; then
  refuse "CLAUDECODE is set, so this is a Claude Code session. Only the Diagnostics workflow runs this, on the box."
fi
case "$CHECK" in
  health|deploy-state|app-logs|worker-logs|nginx-logs|db|db-schema|db-counts|self-test) ;;
  *) refuse "unknown check '$CHECK'." ;;
esac
if ! printf '%s' "$TARGET" | grep -qE '^[0-9a-f]{40}$'; then
  refuse "the commit must be a full 40-character SHA."
fi
if [ "$(id -u)" = "0" ]; then
  refuse "run as ubuntu, not root."
fi

# Node 20 from nvm, as scripts/deploy/workflow-deploy.sh does. A missing node
# is reported, and the shell-only items still run.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
  nvm use 20 >/dev/null 2>&1 || echo "note: nvm could not select node 20"
fi
HAVE_NODE=0
if command -v node >/dev/null 2>&1; then HAVE_NODE=1; fi

# Masks secrets and personal data. Without node, falls back to dropping the line
# content of anything that looks sensitive, so nothing passes unmasked.
mask() {
  if [ "$HAVE_NODE" = 1 ]; then
    node "$HERE/redact.js"
  else
    sed -E \
      -e 's/(password|secret|token|key|authorization|cookie)[^ ]*[=:].*/\1=[redacted]/Ig' \
      -e 's/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/[email]/g' \
      -e 's/([0-9]{1,3}\.){3}[0-9]{1,3}/[ip]/g' \
      -e 's/(AKIA|ASIA)[A-Z0-9]{16}/[aws-key-id]/g' \
      -e 's/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/[jwt]/g' \
      | cut -c1-400
  fi
}

section() { printf '\n## %s\n' "$1"; }

# Tails a file, masked. Missing or unreadable files are reported, not fatal.
tail_file() {
  local file="$1" lines="$2"
  if [ ! -e "$file" ]; then echo "(missing: $file)"; return; fi
  if [ ! -r "$file" ]; then echo "(not readable by $(id -un): $file)"; return; fi
  echo "last $lines lines of $file (modified $(date -u -r "$file" '+%Y-%m-%d %H:%M UTC')):"
  tail -n "$lines" "$file" | mask
}

check_health() {
  section "box"
  echo "time: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "uptime: $(uptime -p 2>/dev/null || uptime)"
  echo "load: $(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null || echo unknown)"
  free -m 2>/dev/null | sed 's/^/  /' || echo "  memory: unknown"
  df -h / "$HOME" 2>/dev/null | sed 's/^/  /' || echo "  disk: unknown"

  section "processes (pm2)"
  if [ "$HAVE_NODE" = 1 ] && command -v pm2 >/dev/null 2>&1; then
    # Only these fields leave the box; pm2 jlist also carries each process's environment.
    pm2 jlist 2>/dev/null | node -e '
      let s = ""; process.stdin.on("data", (c) => { s += c; }).on("end", () => {
        let list = [];
        try { list = JSON.parse(s); } catch (e) { console.log("pm2 jlist did not return JSON"); return; }
        if (!list.length) console.log("no pm2 processes");
        for (const p of list) {
          const e = p.pm2_env || {};
          const up = e.pm_uptime ? Math.round((Date.now() - e.pm_uptime) / 60000) + " min" : "-";
          const mem = p.monit && p.monit.memory ? Math.round(p.monit.memory / 1048576) + " MB" : "-";
          const cpu = p.monit ? p.monit.cpu + "%" : "-";
          console.log(`  ${p.name}: ${e.status}; restarts ${e.restart_time}; up ${up}; memory ${mem}; cpu ${cpu}`);
        }
      });' || { echo "pm2 summary failed"; RC=1; }
  else
    echo "pm2 or node not on PATH for $(id -un)"; RC=1
  fi

  section "services"
  echo "nginx: $(systemctl is-active nginx 2>/dev/null || echo unknown)"
  echo "ssm agent: $(systemctl is-active snap.amazon-ssm-agent.amazon-ssm-agent 2>/dev/null || systemctl is-active amazon-ssm-agent 2>/dev/null || echo unknown)"

  section "api health (on the box, $HEALTH_URL)"
  local code body
  body="$(curl -sS -m 10 -o - -w '\n%{http_code}' "$HEALTH_URL" 2>&1)"
  code="$(printf '%s' "$body" | tail -n 1)"
  echo "http status: $code"
  printf '%s\n' "$body" | sed '$d' | head -c 1500 | mask
  case "$code" in 2*) ;; *) RC=1 ;; esac
}

check_deploy_state() {
  section "deployed commit"
  cd "$APP_DIR" || { echo "missing $APP_DIR"; RC=1; return; }
  echo "HEAD: $(git rev-parse HEAD 2>/dev/null) $(git log -1 --format='%cd %s' --date=format:'%Y-%m-%d %H:%M' 2>/dev/null | mask)"
  local main; main="$(git rev-parse origin/main 2>/dev/null || echo unknown)"
  echo "origin/main (last fetched): $main"
  if [ "$main" != unknown ]; then
    echo "commits on main not deployed: $(git rev-list --count HEAD..origin/main 2>/dev/null || echo unknown)"
    echo "commits deployed but not on main: $(git rev-list --count origin/main..HEAD 2>/dev/null || echo unknown)"
  fi
  local dirty; dirty="$(git status --porcelain --untracked-files=no 2>/dev/null | wc -l)"
  echo "tracked files modified on the box: $dirty"
  if [ -e "$HOME/.episode-deploy-unfinished" ]; then
    echo "unfinished-deploy marker: PRESENT (a deploy moved the tree but the restart has not completed)"; RC=1
  else
    echo "unfinished-deploy marker: none"
  fi
  echo "frontend build: $(stat -c '%y' "$APP_DIR/frontend/dist/index.html" 2>/dev/null | cut -d. -f1 || echo missing)"
  echo "node: $(node -v 2>/dev/null || echo none)"
}

check_app_logs() {
  section "API errors"; tail_file "$LOG_DIR/error.log" 120
  section "API output"; tail_file "$LOG_DIR/out.log" 60
}

check_worker_logs() {
  section "worker errors"; tail_file "$LOG_DIR/worker-error.log" 100
  section "worker output"; tail_file "$LOG_DIR/worker-out.log" 40
}

check_nginx_logs() {
  section "nginx errors"; tail_file "$NGINX_LOG_DIR/error.log" 60
  section "nginx access (last 5000 requests)"
  local f="$NGINX_LOG_DIR/access.log"
  if [ ! -r "$f" ]; then echo "(missing or not readable: $f)"; return; fi
  # Combined log format: the status is the 9th field, the path the 7th. Query
  # strings are dropped (they can carry tokens); IPs are never printed.
  echo "status codes:"
  tail -n 5000 "$f" | awk '{print $9}' | sort | uniq -c | sort -rn | head -10 | sed 's/^/  /'
  echo "top paths returning 5xx:"
  tail -n 5000 "$f" | awk '$9 ~ /^5/ {split($7, p, "?"); print $9, p[1]}' | sort | uniq -c | sort -rn | head -10 | mask | sed 's/^/  /'
}

run_db() {
  local mode="$1"
  section "database ($mode)"
  if [ "$HAVE_NODE" != 1 ]; then echo "node is not available; cannot run the database check"; RC=1; return; fi
  APP_DIR="$APP_DIR" node "$HERE/db-check.js" "$mode" 2>&1 | mask
  local rc="${PIPESTATUS[0]}"
  if [ "$rc" != 0 ]; then RC=1; fi
}

check_self_test() {
  section "box self-test"
  if [ "$(id -un)" = "ubuntu" ]; then echo "PASS runs as ubuntu"; else echo "FAIL runs as $(id -un)"; RC=1; fi
  local ro="$HOME/.episode-readonly.env"
  if [ -e "$ro" ]; then
    local m; m="$(stat -c '%a %U' "$ro")"
    if [ "$m" = "600 ubuntu" ]; then echo "PASS $ro is 600 ubuntu"; else echo "FAIL $ro is $m (want 600 ubuntu)"; RC=1; fi
  else
    echo "FAIL $ro does not exist (setup step 3)"; RC=1
  fi
  # Fake values in the shapes the filter must catch; none may survive.
  local probe out
  probe="key AKIA$(printf 'Z%.0s' {1..16}) password=hunter2 a@b.example 10.1.2.3 eyJaaaaaaaaa.bbbbbbbbbb.cccccccccc"
  out="$(printf '%s\n' "$probe" | mask)"
  if printf '%s' "$out" | grep -qE 'AKIA|hunter2|a@b|10\.1\.2\.3|eyJ'; then
    echo "FAIL redaction let a probe value through"; RC=1
  else
    echo "PASS redaction masks keys, passwords, emails, IPs and JWTs"
  fi
  run_db self-test
}

# The body writes to a file, not a pipe, so RC set inside it survives.
OUT_FILE="$(mktemp)"
trap 'rm -f "$OUT_FILE"' EXIT
{
  echo "# on-box check: $CHECK"
  echo "commit of the diagnostics scripts: $TARGET"
  case "$CHECK" in
    health) check_health ;;
    deploy-state) check_deploy_state ;;
    app-logs) check_app_logs ;;
    worker-logs) check_worker_logs ;;
    nginx-logs) check_nginx_logs ;;
    db) run_db db ;;
    db-schema) run_db db-schema ;;
    db-counts) run_db db-counts ;;
    self-test) check_self_test ;;
  esac
  echo
  echo "on-box result: $([ "$RC" = 0 ] && echo ok || echo 'problems found')"
} >"$OUT_FILE" 2>&1
head -c "$MAX_BYTES" "$OUT_FILE"
if [ "$(wc -c <"$OUT_FILE")" -gt "$MAX_BYTES" ]; then printf '\n…[output cut at %s bytes]\n' "$MAX_BYTES"; fi
exit "$RC"

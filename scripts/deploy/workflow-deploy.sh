#!/usr/bin/env bash
# scripts/deploy/workflow-deploy.sh — the on-box half of the Deploy workflow
# (.github/workflows/deploy.yml, Task #2837; Evoni's Rule 7 decision,
# docs/audit/F-Deploy-1_Rule7_DeployWorkflow_Ruling_2026-10-10.md).
#
# Never run by hand and never by an agent session. The PrimeStudios-Deploy
# SSM document (docs/runbooks/deploy-workflow.md) runs it as `ubuntu`, from
# the reviewed commit itself (`git show <sha>:scripts/deploy/workflow-deploy.sh`),
# one phase per call:
#
#   plan    <sha>  read-only: clean tree, fast-forward, no package change,
#                  nothing pending in the ledger; prints PLAN_* lines. If the
#                  box is already at <sha> (a re-run), it resumes instead.
#   deploy  <sha>  back up frontend/dist, fast-forward to <sha>, vite build
#   migrate <sha>  if files are pending: sequelize-cli db:migrate with the
#                  credential in ~/.episode-migrate.env, then re-check
#   restart <sha>  pm2 restart the API, /health, then the worker
#
# It prints no .env value, no credential, no host or IP (redact() below),
# never runs `set -x`, `pm2 describe`, `pm2 env` or an unfiltered
# `pm2 jlist`, never calls /_diag/health, and never calls `aws`.
# Database credentials stay on this box: the app's come from .env as today
# (ecosystem.config.js), the migration user's from ~/.episode-migrate.env.

set -euo pipefail

PHASE="${1:-}"
TARGET="${2:-}"

APP_DIR="/home/ubuntu/episode-metadata"
API_APP="episode-api-prod-hotfix"
WORKER_APP="episode-worker"
HEALTH_URL="http://localhost:3000/health"
MIGRATE_ENV="$HOME/.episode-migrate.env"

die() {
  printf 'STOPPED (%s): %s\n' "$PHASE" "$1" >&2
  shift
  for line in "$@"; do printf '  %s\n' "$line" >&2; done
  exit 1
}

# Removes IP addresses and AWS-style host names (as scripts/deploy-prod.sh does).
redact() {
  sed -E \
    -e 's/([0-9]{1,3}\.){3}[0-9]{1,3}/[ip]/g' \
    -e 's/[A-Za-z0-9._-]+\.(amazonaws\.com|compute\.internal|ec2\.internal)/[host]/g' \
    -e 's/ip-[0-9]+-[0-9]+-[0-9]+-[0-9]+/[host]/g'
}

if [ -n "${CLAUDECODE:-}" ]; then
  die "CLAUDECODE is set, so this is a Claude Code session. Only the Deploy workflow runs this."
fi
case "$PHASE" in
  plan|deploy|migrate|restart) ;;
  *) die "unknown phase '$PHASE' (plan, deploy, migrate or restart)." ;;
esac
if ! printf '%s' "$TARGET" | grep -qE '^[0-9a-f]{40}$'; then
  die "the target must be a full 40-character commit SHA."
fi
if [ "$(id -un)" != "ubuntu" ]; then
  die "run as ubuntu (the pm2 owner), not $(id -un)."
fi

cd "$APP_DIR"

# Node 20 from nvm, as ecosystem.config.js's PATH expects.
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use 20 >/dev/null 2>&1 || true
fi
case "$(node -v 2>/dev/null || echo none)" in
  v20.*) ;;
  *) die "node 20 is not on PATH (found: $(node -v 2>/dev/null || echo none))." ;;
esac

require_clean_tree() {
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    die "tracked files are modified in $APP_DIR." "Nothing was changed. Evoni restores or commits them by hand."
  fi
}

require_at_target() {
  local head
  head="$(git rev-parse HEAD)"
  if [ "$head" != "$TARGET" ]; then
    die "the tree is at $head, not $TARGET." "The deploy phase has not completed for this commit."
  fi
}

# Runs the read-only ledger check; sets PENDING_RC and prints its result line.
pending_check() {
  local out
  set +e
  out="$(NODE_ENV=production node scripts/check-pending-migrations.js 2>&1)"
  PENDING_RC=$?
  set -e
  printf '%s\n' "$out" | grep -E '^\[pending-migrations\] (OK|FAIL|ERROR|[0-9]+ pending)' | head -1 | redact || true
  printf '%s\n' "$out" | grep -oE '[0-9]{14}-[A-Za-z0-9_.-]+\.js' | sort -u | sed 's/^/  pending: /' || true
  echo "pending-check exit $PENDING_RC"
}

# Prints the pm2 restart count and status of one app, nothing else.
pm2_state() {
  pm2 jlist 2>/dev/null | node -e '
let s = ""; process.stdin.on("data", (d) => { s += d; }).on("end", () => {
  const app = process.argv[1];
  let list = [];
  try { list = JSON.parse(s) || []; } catch (e) { console.log("unreadable"); return; }
  const p = list.find((x) => (x.name || (x.pm2_env || {}).name) === app);
  if (!p || !p.pm2_env) { console.log("missing"); return; }
  console.log(p.pm2_env.status + " restarts=" + p.pm2_env.restart_time);
});' "$1"
}

phase_plan() {
  require_clean_tree
  git fetch --quiet origin main
  if ! git merge-base --is-ancestor "$TARGET" origin/main; then
    die "$TARGET is not on origin/main."
  fi
  local old
  old="$(git rev-parse HEAD)"
  echo "PLAN_OLD_SHA=$old"
  if [ "$old" = "$TARGET" ]; then
    # A re-run after a stop past the fast-forward, or a box already moved by
    # hand: carry on so the migrate and restart phases finish the job.
    echo "The box is already at $TARGET: resuming (build, migrate if pending, restart)."
    echo "PLAN_RESUME=1"
    echo "PLAN_COMMITS=0"
    echo "PLAN_MIGRATIONS=0"
    echo "PLAN_OK=1"
    return 0
  fi
  if ! git merge-base --is-ancestor "$old" "$TARGET"; then
    die "$TARGET is not a fast-forward of the box's $old." "Nothing was changed. Evoni looks at why they diverged."
  fi
  echo "PLAN_COMMITS=$(git rev-list --count "$old..$TARGET")"

  local packages migrations
  packages="$(git diff --name-only "$old" "$TARGET" -- package.json package-lock.json frontend/package.json frontend/package-lock.json)"
  if [ -n "$packages" ]; then
    # shellcheck disable=SC2086
    die "package files change in this range:" $packages \
      "npm ci is needed, and this workflow does not run it (Evoni's ruling for #2837)." \
      "Nothing was changed. Deploy this range by hand (DEVELOPMENT_WORKFLOW.md §7.1)."
  fi
  if [ ! -d frontend/dist ]; then
    die "frontend/dist does not exist, so there is nothing to back up." "Nothing was changed."
  fi

  migrations="$(git diff --name-only --diff-filter=A "$old" "$TARGET" -- src/migrations/ | sed 's#^src/migrations/##')"
  echo "PLAN_MIGRATIONS=$(printf '%s' "$migrations" | grep -c . || true)"
  printf '%s\n' "$migrations" | grep . | sed 's/^/PLAN_MIGRATION=/' || true
  if [ -n "$(git diff --name-only --diff-filter=MDR "$old" "$TARGET" -- src/migrations/)" ]; then
    die "an existing migration file is modified, deleted or renamed in this range." "Nothing was changed. Evoni deploys this range by hand."
  fi

  echo "Ledger before the deploy (the box's current tree):"
  pending_check
  if [ "$PENDING_RC" -ne 0 ]; then
    die "the pending-migration check on the current tree exited $PENDING_RC, not 0." \
      "Either the ledger is behind the deployed code or it could not be read. Nothing was changed."
  fi
  echo "PLAN_OK=1"
}

phase_deploy() {
  require_clean_tree
  local head
  head="$(git rev-parse HEAD)"
  if [ "$head" = "$TARGET" ]; then
    echo "The tree is already at $TARGET; rebuilding the frontend only."
  else
    if ! git merge-base --is-ancestor "$head" "$TARGET"; then
      die "$TARGET is not a fast-forward of $head." "Nothing was changed."
    fi
    local ts backup
    ts="$(date -u +%Y%m%dT%H%M%SZ)"
    backup="$HOME/dist-backup-$ts-${TARGET:0:12}"
    if [ -e "$backup" ]; then die "$backup already exists." "Nothing was changed."; fi
    cp -a frontend/dist "$backup"
    echo "DEPLOY_BACKUP=~/${backup#"$HOME"/}"
    echo "DEPLOY_FROM=$head"
    if ! git merge --ff-only --quiet "$TARGET"; then
      die "git merge --ff-only $TARGET was refused." "The tree was not moved."
    fi
    echo "Fast-forwarded $head -> $TARGET ($(git diff --name-only "$head" "$TARGET" | wc -l | tr -d ' ') files)."
  fi

  local log="$HOME/vite-build-${TARGET:0:12}.log"
  if ! (cd frontend && npx vite build) >"$log" 2>&1; then
    tail -20 "$log" | redact
    die "the vite build failed (last lines above)." \
      "The tree is at $TARGET and frontend/dist may be partly rebuilt; the API still runs the old code." \
      "See docs/runbooks/deploy-workflow.md, 'Rolling back the code'."
  fi
  tail -3 "$log" | redact
  echo "DEPLOY_OK=1"
}

phase_migrate() {
  require_at_target
  echo "Ledger after the fast-forward:"
  pending_check
  case "$PENDING_RC" in
    0) echo "Nothing pending; no migration run."; echo "MIGRATE_RAN=0"; return 0 ;;
    1) ;;
    *) die "the pending-migration check exited $PENDING_RC (ledger unreadable). No migration was run." ;;
  esac

  if [ ! -f "$MIGRATE_ENV" ]; then
    die "$MIGRATE_ENV does not exist, so there is no migration credential on the box." \
      "No migration was run. See docs/runbooks/deploy-workflow.md, 'One-time setup'."
  fi
  local perms
  perms="$(stat -c '%a %U' "$MIGRATE_ENV")"
  if [ "$perms" != "600 ubuntu" ]; then
    die "$MIGRATE_ENV must be mode 600 and owned by ubuntu (it is: $perms)." "No migration was run."
  fi

  local mig_user mig_pass
  mig_user="$(sed -n 's/^DB_USER=//p' "$MIGRATE_ENV" | head -1)"
  mig_pass="$(sed -n 's/^DB_PASSWORD=//p' "$MIGRATE_ENV" | head -1)"
  if [ -z "$mig_user" ] || [ -z "$mig_pass" ]; then
    die "$MIGRATE_ENV needs a DB_USER= line and a DB_PASSWORD= line." "No migration was run."
  fi

  echo "Running sequelize-cli db:migrate (NODE_ENV=production, the migration user from $MIGRATE_ENV)..."
  local out rc
  set +e
  out="$(DB_USER="$mig_user" DB_PASSWORD="$mig_pass" NODE_ENV=production npx sequelize-cli db:migrate 2>&1)"
  rc=$?
  set -e
  # Print the output with the migration user's name and password removed.
  printf '%s\n' "$out" | MIG_USER="$mig_user" MIG_PASS="$mig_pass" awk '
    function scrub(line, s,   i) {
      if (s == "") return line
      while ((i = index(line, s)) > 0) line = substr(line, 1, i - 1) "[redacted]" substr(line, i + length(s))
      return line
    }
    { print scrub(scrub($0, ENVIRON["MIG_PASS"]), ENVIRON["MIG_USER"]) }' | redact
  unset mig_user mig_pass out
  echo "db:migrate exit $rc"
  if [ "$rc" -ne 0 ]; then
    die "db:migrate exited $rc." \
      "The database may be partly migrated. The snapshot taken before this phase is the restore point." \
      "The API still runs the old code. See docs/runbooks/deploy-workflow.md."
  fi

  echo "Ledger after the migration:"
  pending_check
  if [ "$PENDING_RC" -ne 0 ]; then
    die "the re-check exited $PENDING_RC, not 0, after db:migrate." "The API still runs the old code."
  fi
  echo "MIGRATE_RAN=1"
}

phase_restart() {
  require_at_target
  echo "Before: $API_APP $(pm2_state "$API_APP"); $WORKER_APP $(pm2_state "$WORKER_APP")"
  if ! pm2 restart "$API_APP" >/dev/null 2>&1; then
    die "pm2 restart $API_APP failed." "The tree and the database are already at the new version."
  fi

  local body="" last=""
  for _ in $(seq 1 20); do
    sleep 3
    last="$(curl -s -m 5 "$HEALTH_URL" || true)"
    if printf '%s' "$last" | grep -q '"status":"healthy"' \
      && printf '%s' "$last" | grep -q '"database":"connected"'; then
      body="$last"
      break
    fi
  done
  if [ -z "$body" ]; then
    die "/health did not report healthy with the database connected within 60 s after the restart." \
      "Last response: $(printf '%s' "${last:-(none)}" | redact)" \
      "The worker was not restarted."
  fi
  echo "RESTART_HEALTH=$(printf '%s' "$body" | redact)"

  if ! pm2 restart "$WORKER_APP" >/dev/null 2>&1; then
    die "pm2 restart $WORKER_APP failed (the API is restarted and healthy)."
  fi
  sleep 5
  local worker
  worker="$(pm2_state "$WORKER_APP")"
  case "$worker" in
    online*) ;;
    *) die "$WORKER_APP is not online after its restart ($worker). The API is restarted and healthy." ;;
  esac
  echo "After: $API_APP $(pm2_state "$API_APP"); $WORKER_APP $worker"
  echo "RESTART_HEAD=$(git rev-parse HEAD)"
  echo "RESTART_OK=1"
}

"phase_$PHASE"

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
#                  Files pending on the current tree are carried into this
#                  run only when a workflow deploy put the box there and did
#                  not finish (Task #2948); otherwise the plan stops.
#   migrate <sha>  before the deploy phase (Evoni, 2026-10-26): repeats the
#                  plan's checks for <sha>, stages <sha>'s backend files in
#                  ~/.episode-stage/<sha> (git archive, each file checked
#                  against the commit; links to the live .env and
#                  node_modules), and if files are pending runs
#                  sequelize-cli db:migrate from there with the credential
#                  in ~/.episode-migrate.env, then re-checks. The staged
#                  release is read-only and checked again right before and
#                  after db:migrate. The live tree and the running API stay
#                  on the old code throughout. Only a success records <sha>
#                  for the deploy and restart phases
#                  (~/.episode-deploy-migrated); a failure is never undone.
#   deploy  <sha> [<artifact-url> <sha256>]
#                  only for the <sha> the migrate phase recorded, with its
#                  staged release unchanged and nothing pending in the ledger:
#                  back up frontend/dist, fast-forward to <sha>, and put the
#                  new frontend in place, marking the deploy unfinished until
#                  the restart succeeds. With an artifact (the runner's own
#                  build of <sha>'s frontend, through a presigned S3 link the
#                  workflow made; Evoni, 2026-10-12, after runs 93-94 found
#                  the 2 GB box too small to build), it downloads and checks
#                  it before changing anything, then unpacks it; no build on
#                  the box. Without one ("none", or an older SSM document
#                  that passes no third argument): vite build with an
#                  explicit heap (Task #2948). It stops first if another
#                  vite build is still running, prints the box's memory, and
#                  ends a build that runs past BUILD_TIMEOUT_S itself, inside
#                  the SSM document's 1800 s (Deploy runs 80-81 hung in the
#                  build until SSM timed them out)
#   restart <sha>  under the same checks as deploy: pm2 restart the API,
#                  /health, then the worker only if it was online before (a
#                  stopped worker stays stopped, #2861); a success removes
#                  the record and the staged release
#
# It prints no .env value, no credential, no host or IP (redact() below),
# never runs `set -x`, `pm2 describe`, `pm2 env` or an unfiltered
# `pm2 jlist`, never calls /_diag/health, and never calls `aws`.
# Database credentials stay on this box: the app's come from .env as today
# (ecosystem.config.js), the migration user's from ~/.episode-migrate.env.

set -euo pipefail

PHASE="${1:-}"
TARGET="${2:-}"
# The runner's build of the frontend (deploy phase only): a presigned S3 link
# and the archive's sha256, or "none". The link carries a signature, so it is
# never printed.
ARTIFACT_URL="${3:-none}"
ARTIFACT_SHA256="${4:-none}"

APP_DIR="/home/ubuntu/episode-metadata"
API_APP="episode-api-prod-hotfix"
WORKER_APP="episode-worker"
HEALTH_URL="http://localhost:3000/health"
MIGRATE_ENV="$HOME/.episode-migrate.env"
# "<from> <to>" while a deploy that moved the tree has not yet restarted the
# API; removed by a successful restart (Task #2948).
DEPLOY_MARKER="$HOME/.episode-deploy-unfinished"
# The target whose migrate phase succeeded, ledger re-checked; the deploy and
# restart phases refuse any other. Removed when a migrate phase starts and by
# a successful restart.
DEPLOY_MIGRATED="$HOME/.episode-deploy-migrated"
# Staged releases, one per target: the migration runs from here, never from
# the live tree. Kept until a successful restart (deploy and restart read
# the ledger from it), or after a failure until the next migrate phase.
STAGE_ROOT="$HOME/.episode-stage"
# What a staged release holds: everything sequelize-cli and the ledger check
# load. No file in src/ requires one outside it (checked at ab1d74e3).
STAGE_PATHS=(.sequelizerc package.json src scripts/check-pending-migrations.js)
# The longest the on-box vite build may run, in seconds. A healthy build takes
# about 4 minutes (Deploy run 79); the SSM document gives the whole deploy
# phase 1800 s, so a hung build ends here with a message, not as TimedOut.
BUILD_TIMEOUT_S=1200

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

# The artifact arguments: both "none", or an https link to an S3 object (a
# presigned URL: no quotes, spaces or shell characters) and a sha256.
artifact_args_ok() {
  if [ "$ARTIFACT_URL" = "none" ]; then [ "$ARTIFACT_SHA256" = "none" ]; return; fi
  printf '%s' "$ARTIFACT_URL" | grep -qE '^https://[a-z0-9.-]+\.amazonaws\.com/[A-Za-z0-9/._-]+\?[A-Za-z0-9%&=._~-]+$' \
    && printf '%s' "$ARTIFACT_SHA256" | grep -qE '^[0-9a-f]{64}$'
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
if ! artifact_args_ok; then
  die "the frontend artifact must be 'none', or an https S3 link with its 64-character sha256." "Nothing was changed."
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

# Runs the read-only ledger check against the migration files of the tree in
# $1 (default: the current directory, the live tree); sets PENDING_RC and
# PENDING_FILES (one migration file name per line) and prints its result line.
pending_check() {
  local out
  set +e
  out="$(cd "${1:-.}" && NODE_ENV=production node scripts/check-pending-migrations.js 2>&1)"
  PENDING_RC=$?
  set -e
  printf '%s\n' "$out" | grep -E '^\[pending-migrations\] (OK|FAIL|ERROR|[0-9]+ pending)' | head -1 | redact || true
  PENDING_FILES="$(printf '%s\n' "$out" | grep -oE '[0-9]{14}-[A-Za-z0-9_.-]+\.js' | sort -u || true)"
  if [ -n "$PENDING_FILES" ]; then printf '%s\n' "$PENDING_FILES" | sed 's/^/  pending: /'; fi
  echo "pending-check exit $PENDING_RC"
}

# The heap, in MB, for the on-box vite build (Task #2948): about 60% of the
# box's RAM, at least 1536 and at most 3072. Node's default is about a
# quarter of RAM, and the build needs more than 768 MB (measured at
# 0be931f2); Deploy runs 62 and 64 ran out of heap. MEMINFO overrides
# /proc/meminfo for the tests.
build_heap_mb() {
  local kb heap
  kb="$(awk '/^MemTotal:/ { print $2; exit }' "${MEMINFO:-/proc/meminfo}" 2>/dev/null || true)"
  if ! printf '%s' "$kb" | grep -qE '^[0-9]+$'; then
    echo 1536
    return 0
  fi
  heap=$(( kb / 1024 * 6 / 10 ))
  if [ "$heap" -lt 1536 ]; then heap=1536; fi
  if [ "$heap" -gt 3072 ]; then heap=3072; fi
  echo "$heap"
}

# The process ids of vite builds still running on the box, one per line, or
# nothing. A build a timed-out deploy left behind starves the next one of
# memory (Deploy runs 80-82).
running_vite_builds() {
  pgrep -f -- 'vite(\.js)? build' 2>/dev/null || true
}

# The box's memory and swap in one line each, in MB (no host, no credential).
# FREE_CMD overrides `free -m` for the tests.
memory_lines() {
  ${FREE_CMD:-free -m} 2>/dev/null | awk '
    /^Mem:/  { print "Memory: " $2 " MB total, " $7 " MB available" }
    /^Swap:/ { print "Swap: " $2 " MB total, " $3 " MB used" }' || true
}

# Downloads the runner's frontend build to $ARTIFACT_FILE and checks it: its
# sha256, and that every entry is under dist/ (no absolute path, no ..).
# Changes nothing in the app. CURL_CMD and SHA256_CMD override for the tests.
fetch_artifact() {
  ARTIFACT_FILE="$HOME/frontend-dist-${TARGET:0:12}.tgz"
  rm -f "$ARTIFACT_FILE"
  if ! ${CURL_CMD:-curl} -sS --fail --max-time 300 -o "$ARTIFACT_FILE" "$ARTIFACT_URL" 2>/dev/null; then
    rm -f "$ARTIFACT_FILE"
    die "the frontend artifact could not be downloaded (the link may have expired)." "Nothing was changed. Run the workflow again."
  fi
  local got
  got="$(${SHA256_CMD:-sha256sum} "$ARTIFACT_FILE" | awk '{ print $1 }')"
  if [ "$got" != "$ARTIFACT_SHA256" ]; then
    rm -f "$ARTIFACT_FILE"
    die "the frontend artifact's sha256 is $got, not the $ARTIFACT_SHA256 the runner built." "Nothing was changed."
  fi
  local entries
  if ! entries="$(tar -tzf "$ARTIFACT_FILE" 2>/dev/null)" || [ -z "$entries" ]; then
    rm -f "$ARTIFACT_FILE"
    die "the frontend artifact is not a readable archive." "Nothing was changed."
  fi
  # Checked on the captured list: a grep that stops early under pipefail would
  # hand tar a SIGPIPE and turn the check around.
  if printf '%s\n' "$entries" | grep -vqE '^(\./)?dist(/|$)' || printf '%s\n' "$entries" | grep -qE '(^/|(^|/)\.\.(/|$))'; then
    rm -f "$ARTIFACT_FILE"
    die "the frontend artifact holds something other than dist/." "Nothing was changed."
  fi
  if ! printf '%s\n' "$entries" | grep -qxE '(\./)?dist/index\.html'; then
    rm -f "$ARTIFACT_FILE"
    die "the frontend artifact has no dist/index.html." "Nothing was changed."
  fi
  echo "Frontend artifact: $(wc -c <"$ARTIFACT_FILE" | tr -d ' ') bytes, sha256 ${ARTIFACT_SHA256:0:12}… checked."
}

# Puts the checked artifact's dist/ in place of frontend/dist.
install_artifact() {
  local tmp
  tmp="$(mktemp -d "$HOME/frontend-dist-new.XXXXXX")"
  tar -xzf "$ARTIFACT_FILE" -C "$tmp"
  if [ ! -f "$tmp/dist/index.html" ]; then
    rm -rf "$tmp"
    die "the frontend artifact has no dist/index.html." \
      "The tree is at $TARGET; frontend/dist was not touched; the API still runs the old code."
  fi
  rm -rf frontend/dist
  mv "$tmp/dist" frontend/dist
  rm -rf "$tmp" "$ARTIFACT_FILE"
}

# Prints why the box's current commit $1 was put there by a workflow deploy
# that did not finish, or returns 1 (Task #2948). The deploy phase marks the
# deploy unfinished ($DEPLOY_MARKER, "<from> <to>") once it moves the tree,
# and a successful restart removes the mark. A box moved before the mark
# existed has only the deploy phase's own dist backup for that commit
# (~/dist-backup-<time>-<sha12>); with files pending, that backup means its
# deploy stopped before the migrate phase finished.
unfinished_deploy_of() {
  local head="$1" to backup
  if [ -f "$DEPLOY_MARKER" ]; then
    to="$(awk '{ print $2; exit }' "$DEPLOY_MARKER" 2>/dev/null || true)"
    if [ "$to" = "$head" ]; then echo "the deploy marker names $head"; return 0; fi
    # A mark for another commit: the tree was moved by hand since. Stop.
    return 1
  fi
  for backup in "$HOME"/dist-backup-*-"${head:0:12}"; do
    if [ -d "$backup" ]; then echo "the deploy's frontend backup ~/${backup#"$HOME"/}"; return 0; fi
  done
  return 1
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

# The status word alone (online, stopped, errored, missing, ...), spaces as
# dashes, for the WORKER_BEFORE / WORKER_AFTER lines the workflow reads.
pm2_status() {
  local s
  s="$(pm2_state "$1")"
  s="${s%% restarts=*}"
  printf '%s' "${s// /-}"
}

# The deploy and restart phases run only for the target the migrate phase
# recorded, and only while the ledger still has every migration of that
# target: the record alone is not enough, since the database may have been
# restored since. Checks the staged release again and reads the ledger from
# it; changes nothing. Sets STAGE.
require_migrated() {
  local migrated
  migrated="$(cat "$DEPLOY_MIGRATED" 2>/dev/null || true)"
  if [ "$migrated" != "$TARGET" ]; then
    die "the migrate phase has not succeeded for $TARGET (recorded: ${migrated:-nothing})." \
      "Nothing was changed: the live tree, frontend/dist and the running API are as they were." \
      "This phase runs only after the same run's migrate phase (docs/runbooks/deploy-workflow.md §1)."
  fi
  STAGE="$STAGE_ROOT/$TARGET"
  if [ -L "$STAGE" ] || [ ! -d "$STAGE" ]; then
    die "the staged release of $TARGET is gone." "Nothing was changed. Start a new run."
  fi
  verify_stage
  echo "Ledger against the staged release, before this phase changes anything:"
  pending_check "$STAGE"
  if [ "$PENDING_RC" -ne 0 ]; then
    die "the ledger check for $TARGET exited $PENDING_RC, not 0." \
      "The database no longer has every migration of this commit (restored or changed since the migrate phase), or the ledger could not be read." \
      "Nothing was changed. Start a new run: its migrate phase applies what is missing."
  fi
}

# Prints the ids of processes whose working directory or an open file is
# under $1, one per line, or nothing. Only this user's processes can be read,
# which covers everything a deploy starts. PROC_ROOT overrides /proc for the
# tests.
processes_using() {
  local dir="$1" p link target
  for p in "${PROC_ROOT:-/proc}"/[0-9]*; do
    for link in "$p/cwd" "$p"/fd/*; do
      target="$(readlink "$link" 2>/dev/null)" || continue
      case "$target" in
        "$dir"|"$dir"/*) echo "${p##*/}"; break ;;
      esac
    done
  done
}

# Removes one staged release, $STAGE_ROOT/<sha> or a .incoming. one, or
# returns 1 (printing why) while a process still uses it. Never follows a
# link: find without -L does not, -type d never matches one, and rm -rf
# removes the .env and node_modules links themselves, not what they point to.
remove_stage() {
  local dir="$1" name pids
  name="${dir#"$STAGE_ROOT"/}"
  if [ "$name" = "$dir" ] || ! printf '%s' "$name" | grep -qE '^([0-9a-f]{40}|\.incoming\.[A-Za-z0-9]{6})$'; then
    die "refusing to remove $dir: it is not a staged release in $STAGE_ROOT."
  fi
  pids="$(processes_using "$dir")"
  if [ -n "$pids" ]; then
    echo "~/${dir#"$HOME"/} is in use (pid $(printf '%s' "$pids" | tr '\n' ' ' | sed 's/ $//')); not removed."
    return 1
  fi
  # A staged release is read-only (stage_release); its directories need
  # write permission back before rm can empty them.
  if [ -d "$dir" ] && [ ! -L "$dir" ]; then find "$dir" -type d -exec chmod u+w {} +; fi
  rm -rf -- "$dir"
}

# Removes the staged releases earlier runs left. One still in use (a
# db:migrate a stopped run left running) stops the phase before anything is
# staged or migrated.
clean_stages() {
  local d
  for d in "$STAGE_ROOT"/* "$STAGE_ROOT"/.incoming.*; do
    [ -e "$d" ] || [ -L "$d" ] || continue
    if ! printf '%s' "${d##*/}" | grep -qE '^([0-9a-f]{40}|\.incoming\.[A-Za-z0-9]{6})$'; then
      echo "Left alone, not a staged release: ~/${d#"$HOME"/}"
      continue
    fi
    if ! remove_stage "$d"; then
      die "an earlier staged release is still in use; a migration a stopped run left running may still be going." \
        "No migration was run; the live tree is unchanged. Evoni checks the process on the box (docs/runbooks/deploy-workflow.md §4)."
    fi
  done
}

# Puts $TARGET's STAGE_PATHS in $STAGE_ROOT/$TARGET, exported by git itself
# (the repository is only read), with links to the live .env and
# node_modules, then checks it (verify_stage). The live tree is not touched.
# Sets STAGE.
stage_release() {
  if [ -L "$STAGE_ROOT" ]; then die "$STAGE_ROOT is a symbolic link." "No migration was run."; fi
  mkdir -p "$STAGE_ROOT"
  chmod 700 "$STAGE_ROOT"
  clean_stages
  if [ ! -f "$APP_DIR/.env" ]; then die "$APP_DIR/.env does not exist." "No migration was run."; fi
  if [ ! -x "$APP_DIR/node_modules/.bin/sequelize-cli" ]; then
    die "$APP_DIR/node_modules has no sequelize-cli." "No migration was run."
  fi
  local incoming
  incoming="$(mktemp -d "$STAGE_ROOT/.incoming.XXXXXX")"
  if ! git archive --format=tar "$TARGET" -- "${STAGE_PATHS[@]}" | tar -x -C "$incoming"; then
    rm -rf -- "$incoming"
    die "$TARGET could not be exported from git." "No migration was run; the live tree is unchanged."
  fi
  ln -s "$APP_DIR/.env" "$incoming/.env"
  ln -s "$APP_DIR/node_modules" "$incoming/node_modules"
  STAGE="$STAGE_ROOT/$TARGET"
  mv -T "$incoming" "$STAGE"
  verify_stage
  # Read-only from here, files and directories (never through a link): no
  # file can change, appear or go without a mode changing first, and
  # verify_stage runs again right before and after db:migrate and in the
  # deploy and restart phases.
  find "$STAGE" -type f -exec chmod a-w {} +
  find "$STAGE" -type d -exec chmod a-w {} +
}

# The staged release holds exactly $TARGET's files (each one hashed and
# compared with the commit's blob), its two links point at the live .env and
# node_modules, and Node, started there as sequelize-cli is, loads the staged
# config and migrations, the live .env and the live sequelize. Prints the
# STAGE_* paths it checked; stops on any difference.
verify_stage() {
  local want paths got
  want="$(git -c core.quotePath=false ls-tree -r "$TARGET" -- "${STAGE_PATHS[@]}" \
    | awk -F'\t' '{ split($1, m, " "); if (m[2] == "blob" && m[1] != "120000") print $2 "\t" m[3] }' | LC_ALL=C sort)"
  paths="$(cd "$STAGE" && find . -type f -printf '%P\n' | LC_ALL=C sort)"
  got="$(paste <(printf '%s\n' "$paths") <(cd "$STAGE" && printf '%s\n' "$paths" | git hash-object --no-filters --stdin-paths) | LC_ALL=C sort)"
  if [ -z "$want" ] || [ "$want" != "$got" ]; then
    die "the staged release does not hold exactly $TARGET's files." "No migration was run; the live tree is unchanged."
  fi
  if [ "$(readlink "$STAGE/.env")" != "$APP_DIR/.env" ] || [ "$(readlink "$STAGE/node_modules")" != "$APP_DIR/node_modules" ]; then
    die "the staged release's .env or node_modules is not the live one." "No migration was run; the live tree is unchanged."
  fi
  echo "Staged $TARGET at ~/${STAGE#"$HOME"/}: $(printf '%s\n' "$paths" | grep -c .) files, each matching the commit."

  local where stage_real
  stage_real="$(realpath "$STAGE")"
  where="$(cd "$STAGE" && node -e '
const fs = require("fs"), path = require("path");
const real = (p) => fs.realpathSync(p);
console.log("STAGE_CONFIG=" + real(path.resolve("src/config/sequelize.js")));
console.log("STAGE_MIGRATIONS=" + real(path.resolve("src/migrations")));
console.log("STAGE_DOTENV=" + real(path.resolve(".env")));
console.log("STAGE_SEQUELIZE=" + real(require.resolve("sequelize")));' 2>&1)" || where=""
  printf '%s\n' "$where" | grep -E '^STAGE_[A-Z]+=' || true
  local config migrations dotenv sequelize ok=1
  config="$(printf '%s\n' "$where" | sed -n 's/^STAGE_CONFIG=//p')"
  migrations="$(printf '%s\n' "$where" | sed -n 's/^STAGE_MIGRATIONS=//p')"
  dotenv="$(printf '%s\n' "$where" | sed -n 's/^STAGE_DOTENV=//p')"
  sequelize="$(printf '%s\n' "$where" | sed -n 's/^STAGE_SEQUELIZE=//p')"
  [ "$config" = "$stage_real/src/config/sequelize.js" ] || ok=0
  [ "$migrations" = "$stage_real/src/migrations" ] || ok=0
  [ "$dotenv" = "$(realpath "$APP_DIR/.env")" ] || ok=0
  case "$sequelize" in
    "$(realpath "$APP_DIR/node_modules")"/sequelize/*) ;;
    *) ok=0 ;;
  esac
  if [ "$ok" -ne 1 ]; then
    die "the staged release would not load the staged config and migrations with the live .env and node_modules." \
      "No migration was run; the live tree is unchanged."
  fi
}

# After a successful migrate: the live tree must be where it was ($1); then
# the target is recorded for the deploy and restart phases, written whole or
# not at all. The staged release stays for them; a successful restart
# removes it.
finish_migrate() {
  local now
  now="$(git rev-parse HEAD)"
  if [ "$now" != "$1" ]; then
    die "the live tree moved during the migrate phase ($1 -> $now)." \
      "The deploy phase will refuse to run. Evoni looks at what moved it."
  fi
  printf '%s\n' "$TARGET" >"$DEPLOY_MIGRATED.new"
  mv -f "$DEPLOY_MIGRATED.new" "$DEPLOY_MIGRATED"
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
    local evidence=""
    # Files pending (exit 1, never 2: an unreadable ledger always stops) on a
    # commit a workflow deploy put here and did not finish: that deploy
    # stopped before its migrate phase. They are carried into this run; the
    # snapshot is taken first as always, and the migrate phase applies them
    # with this range's files (Task #2948).
    if [ "$PENDING_RC" -eq 1 ] && [ -n "$PENDING_FILES" ] && evidence="$(unfinished_deploy_of "$old")"; then
      echo "The box was put at $old by a deploy that did not finish ($evidence)."
      echo "Its pending migrations are carried into this run:"
      printf '%s\n' "$PENDING_FILES" | sed 's/^/PLAN_CARRIED=/'
    else
      die "the pending-migration check on the current tree exited $PENDING_RC, not 0." \
        "Either the ledger is behind the deployed code or it could not be read. Nothing was changed."
    fi
  fi
  echo "PLAN_OK=1"
}

phase_deploy() {
  require_migrated
  require_clean_tree
  local stale
  stale="$(running_vite_builds)"
  if [ -n "$stale" ]; then
    die "a vite build is still running on the box (pid $(printf '%s' "$stale" | tr '\n' ' ' | sed 's/ $//'))." \
      "Probably left by a deploy that timed out; it would starve this build of memory." \
      "Nothing was changed. Evoni stops it by hand, then approves a new run (docs/runbooks/deploy-workflow.md §4)."
  fi
  # The runner's build is fetched and checked before anything on the box changes.
  if [ "$ARTIFACT_URL" != "none" ]; then fetch_artifact; fi
  local head
  head="$(git rev-parse HEAD)"
  if [ "$head" = "$TARGET" ]; then
    echo "The tree is already at $TARGET; putting the frontend in place only."
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
    # Unfinished until the restart phase succeeds (Task #2948).
    printf '%s %s\n' "$head" "$TARGET" >"$DEPLOY_MARKER"
    echo "Fast-forwarded $head -> $TARGET ($(git diff --name-only "$head" "$TARGET" | wc -l | tr -d ' ') files)."
  fi

  if [ "$ARTIFACT_URL" != "none" ]; then
    install_artifact
    echo "Frontend from the runner's build of $TARGET; no build on the box."
    echo "DEPLOY_OK=1"
    return 0
  fi

  local log="$HOME/vite-build-${TARGET:0:12}.log" heap
  heap="$(build_heap_mb)"
  memory_lines
  echo "vite build with a ${heap} MB heap, for at most ${BUILD_TIMEOUT_S} s."
  local rc=0
  # timeout signals the build's whole process group (npx and the node under it).
  (cd frontend && NODE_OPTIONS="--max-old-space-size=${heap}" timeout -k 30 "$BUILD_TIMEOUT_S" npx vite build) >"$log" 2>&1 || rc=$?
  if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
    tail -20 "$log" | redact
    memory_lines
    die "the vite build ran past ${BUILD_TIMEOUT_S} s and was stopped (last lines and memory above)." \
      "A healthy build takes about 4 minutes; a hang like this is usually the box short of memory." \
      "The tree is at $TARGET and frontend/dist may be partly rebuilt; the API still runs the old code." \
      "See docs/runbooks/deploy-workflow.md §4, row 'Deploy'."
  fi
  if [ "$rc" -ne 0 ]; then
    tail -20 "$log" | redact
    die "the vite build failed (last lines above)." \
      "The tree is at $TARGET and frontend/dist may be partly rebuilt; the API still runs the old code." \
      "See docs/runbooks/deploy-workflow.md, 'Rolling back the code'."
  fi
  tail -3 "$log" | redact
  echo "DEPLOY_OK=1"
}

# Runs before the deploy phase (Evoni, 2026-10-26): the migration runs from a
# staged copy of $TARGET while the live tree and the running API stay on the
# old code, so no process can load models the database does not match yet.
phase_migrate() {
  # An earlier attempt's record never lets this run's deploy phase through.
  rm -f "$DEPLOY_MIGRATED" "$DEPLOY_MIGRATED.new"
  require_clean_tree
  # The plan's checks, repeated for this phase's own target: the staged
  # release shares the live node_modules, so a package change must stop here.
  if ! git merge-base --is-ancestor "$TARGET" origin/main; then
    die "$TARGET is not on origin/main." "No migration was run; nothing was changed."
  fi
  local live packages
  live="$(git rev-parse HEAD)"
  if [ "$live" != "$TARGET" ]; then
    if ! git merge-base --is-ancestor "$live" "$TARGET"; then
      die "$TARGET is not a fast-forward of the live tree's $live." "No migration was run; nothing was changed."
    fi
    packages="$(git diff --name-only "$live" "$TARGET" -- package.json package-lock.json frontend/package.json frontend/package-lock.json)"
    if [ -n "$packages" ]; then
      # shellcheck disable=SC2086
      die "package files change between the live tree and $TARGET:" $packages \
        "The staged release shares the live node_modules, so it cannot migrate this range." \
        "No migration was run; nothing was changed. Deploy this range by hand (DEVELOPMENT_WORKFLOW.md §7.1)."
    fi
    if [ -n "$(git diff --name-only --diff-filter=MDR "$live" "$TARGET" -- src/migrations/)" ]; then
      die "an existing migration file is modified, deleted or renamed between the live tree and $TARGET." \
        "No migration was run; nothing was changed. Evoni deploys this range by hand."
    fi
  fi
  echo "Live tree: $live. This phase does not change it, and the API keeps running it."

  stage_release
  echo "Ledger against the staged release:"
  pending_check "$STAGE"
  case "$PENDING_RC" in
    0) echo "Nothing pending; no migration run."; finish_migrate "$live"; echo "MIGRATE_RAN=0"; return 0 ;;
    1) ;;
    *) die "the pending-migration check exited $PENDING_RC (ledger unreadable). No migration was run." \
         "The live tree is unchanged ($live)." ;;
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

  # Checked again right before it runs, and again after.
  verify_stage
  echo "Running sequelize-cli db:migrate from the staged release (NODE_ENV=production, the migration user from $MIGRATE_ENV)..."
  local out rc
  set +e
  out="$(cd "$STAGE" && DB_USER="$mig_user" DB_PASSWORD="$mig_pass" NODE_ENV=production \
    "$STAGE/node_modules/.bin/sequelize-cli" db:migrate \
    --config "$STAGE/src/config/sequelize.js" --migrations-path "$STAGE/src/migrations" 2>&1)"
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
      "The database may be partly migrated. Nothing is undone or restored automatically; the snapshot taken before this phase is the restore point." \
      "The live tree ($live) and the running API are unchanged, and the deploy phase will refuse to run." \
      "The staged release is kept at ~/${STAGE#"$HOME"/} until the next run. See docs/runbooks/deploy-workflow.md §4."
  fi

  # The staged release must still be exactly the commit it ran.
  verify_stage
  echo "Ledger after the migration:"
  pending_check "$STAGE"
  if [ "$PENDING_RC" -ne 0 ]; then
    die "the re-check exited $PENDING_RC, not 0, after db:migrate." \
      "The live tree ($live) and the running API are unchanged, and the deploy phase will refuse to run."
  fi
  finish_migrate "$live"
  echo "MIGRATE_RAN=1"
}

phase_restart() {
  require_at_target
  require_migrated
  local worker_before
  worker_before="$(pm2_status "$WORKER_APP")"
  echo "Before: $API_APP $(pm2_state "$API_APP"); $WORKER_APP $(pm2_state "$WORKER_APP")"
  echo "WORKER_BEFORE=$worker_before"
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

  # Only a worker that was running is restarted; a stopped (or missing) one is
  # left exactly as it was, so a deploy never starts what Evoni switched off.
  if [ "$worker_before" = "online" ]; then
    if ! pm2 restart "$WORKER_APP" >/dev/null 2>&1; then
      echo "WORKER_AFTER=$(pm2_status "$WORKER_APP")"
      die "pm2 restart $WORKER_APP failed (the API is restarted and healthy)."
    fi
    sleep 5
    local worker
    worker="$(pm2_state "$WORKER_APP")"
    case "$worker" in
      online*) ;;
      *) echo "WORKER_AFTER=$(pm2_status "$WORKER_APP")"
         die "$WORKER_APP is not online after its restart ($worker). The API is restarted and healthy." ;;
    esac
    echo "WORKER_ACTION=restarted"
  else
    echo "WORKER_ACTION=left-$worker_before"
    echo "$WORKER_APP was $worker_before before the deploy, so it was left as it was (not started)."
  fi
  echo "After: $API_APP $(pm2_state "$API_APP"); $WORKER_APP $(pm2_state "$WORKER_APP")"
  echo "WORKER_AFTER=$(pm2_status "$WORKER_APP")"
  echo "RESTART_HEAD=$(git rev-parse HEAD)"
  # The deploy is finished: the API runs the tree's code (Task #2948), and a
  # later deploy phase needs its own run's migrate phase.
  rm -f "$DEPLOY_MARKER" "$DEPLOY_MIGRATED"
  remove_stage "$STAGE" || echo "The next migrate phase removes it."
  echo "RESTART_OK=1"
}

"phase_$PHASE"

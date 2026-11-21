#!/usr/bin/env bash
# Preflight for a dev deploy or rollback: is it safe to install this commit?
# Read-only. It stops nothing, deletes nothing and writes nothing. Run as root
# on the dev box, BEFORE the dev app is stopped and before either application
# tree (live, rollback) is touched. deploy-dev-box.sh calls it first; a refusal
# there leaves the installed app running exactly as it was (Evoni, 2026-11-13).
#
#   sudo REF=<full sha> MIGRATIONS_FILE=<path> bash preflight-dev-deploy.sh
#
#   MIGRATIONS_FILE   the migration file names of the commit to install, one
#                     per line (the runner writes it from that commit's
#                     src/migrations). Empty lines are ignored.
#
# 1. Disk: at least MIN_FREE_MIB (default 2048) free on /. An install adds one
#    application tree, about 700 MiB (measured on 2026-11-11 and 2026-11-12:
#    1.1 G free before, 414 M and 404 M after), while the live tree and the
#    rollback tree both stay in place until the swap. The rest is margin for
#    npm, logs and the database.
# 2. Memory: at least MIN_MEM_MIB (default 2800) of RAM + swap, the
#    installer's own guard, asked here before anything is stopped.
# 3. Schema: every migration the LOCAL database has applied must be a file of
#    this commit. A database ahead of the code (a rollback across a
#    migration) is refused: the older code would run against a schema it does
#    not know. Migrations this commit has and the database lacks are counted;
#    the installer applies them before the swap. A ledger that cannot be read
#    is a refusal, never "compatible". Names are compared exactly, in the
#    repository's two conventions (an 8- or 14-digit prefix); a name in
#    neither, applied or in the commit, is a refusal. The one exception is
#    RETIRED_APPLIED below: nine exact names, reported and set aside.
#
# Exit 0: safe to go on. 1: refused (one PREFLIGHT REFUSED line per reason).
# 2: bad arguments, or a database that is not local.
# Prints numbers and migration file names. Never a credential or a hostname.
set -uo pipefail
set +x

REF="${REF:-}"
MIGRATIONS_FILE="${MIGRATIONS_FILE:-}"
APP_USER="${APP_USER:-ubuntu}"
CONF="${CONF:-/home/${APP_USER}/.config/episode-dev}"
MIN_FREE_MIB="${MIN_FREE_MIB:-2048}"
MIN_MEM_MIB="${MIN_MEM_MIB:-2800}"
MEMINFO="${MEMINFO:-/proc/meminfo}"

# The repository's two migration file-name conventions (measured on main,
# 2026-11-21: 403 files with a 14-digit prefix, 3 with an 8-digit one).
NAME_RE='^([0-9]{8}|[0-9]{14})-[A-Za-z0-9_.-]+\.js$'

# Applied names that no selectable commit has (Evoni, 2026-11-21). The dev
# database is a copy of production's, and its ledger keeps nine names from
# before 2026-11-11, the first commit this workflow can install: files that
# were re-timestamped, or that lived in a tree that no longer runs. Read from
# the dev ledger on 2026-11-21 (415 rows: 406 are files on main, these 9 are
# not). None is a file in any selectable commit, so setting them aside cannot
# hide a difference between two of those commits. Exact names only: no
# prefix, pattern or near match. Any other applied name the commit lacks is
# still a refusal, and so is a commit that has one of these as a file.
RETIRED_APPLIED=(
  "20260208000000-create-lala-formula.js"
  "20260306100000-create-episode-orchestration-tables.js"
  "20260307140000-create-franchise-knowledge.js"
  "20260311200000-create-story-calendar-system.js"
  "20260315000000-add-relationship-engine-columns.js"
  "20260315100000-add-expanded-world-character-columns.js"
  "20260320000000-create-scene-sets-and-angles.js"
  "20260627000000-add-base-still-url.js"
  "20260710000000-create-generation-jobs.js"
)

if ! [[ "$REF" =~ ^[0-9a-f]{40}$ ]]; then echo "PREFLIGHT REFUSED: REF must be a full 40-character commit sha. Nothing was changed."; exit 2; fi
if [ -z "$MIGRATIONS_FILE" ] || [ ! -f "$MIGRATIONS_FILE" ]; then echo "PREFLIGHT REFUSED: MIGRATIONS_FILE is missing. Nothing was changed."; exit 2; fi
for n in "$MIN_FREE_MIB" "$MIN_MEM_MIB"; do
  [[ "$n" =~ ^[0-9]+$ ]] || { echo "PREFLIGHT REFUSED: a threshold is not a whole number. Nothing was changed."; exit 2; }
done
if [ ! -s "$CONF/local-db.env" ]; then echo "PREFLIGHT REFUSED: the local database login file is missing. Nothing was changed."; exit 2; fi

echo "== preflight for ${REF:0:12} (read-only)"
refused=0

# 1. Disk.
FREE_MIB="$(df -Pm / 2>/dev/null | awk 'NR==2{print $4}')"
if ! [[ "$FREE_MIB" =~ ^[0-9]+$ ]]; then
  echo "PREFLIGHT REFUSED: free disk space could not be read."; refused=1
else
  echo "   disk: ${FREE_MIB} MiB free on / (need ${MIN_FREE_MIB})"
  if [ "$FREE_MIB" -lt "$MIN_FREE_MIB" ]; then
    echo "PREFLIGHT REFUSED: ${FREE_MIB} MiB free is under the ${MIN_FREE_MIB} MiB an install needs. Free space or grow the disk first (docs/runbooks/dev-environment.md, Disk)."; refused=1
  fi
fi

# 2. Memory.
MEM_MIB="$(awk '/^MemTotal:/{m=$2} /^SwapTotal:/{s=$2} END{print int((m+s)/1024)}' "$MEMINFO" 2>/dev/null)"
if ! [[ "$MEM_MIB" =~ ^[0-9]+$ ]]; then
  echo "PREFLIGHT REFUSED: memory could not be read."; refused=1
else
  echo "   memory: ${MEM_MIB} MiB RAM + swap (need ${MIN_MEM_MIB})"
  if [ "$MEM_MIB" -lt "$MIN_MEM_MIB" ]; then
    echo "PREFLIGHT REFUSED: ${MEM_MIB} MiB of RAM + swap is under ${MIN_MEM_MIB} MiB. Add swap first."; refused=1
  fi
fi

# 3. Schema: the local database's applied migrations against this commit's files.
APPLIED="$(
  set -a
  # shellcheck disable=SC1090,SC1091
  . "$CONF/local-db.env"
  set +a
  case "${LOCAL_DB_HOST:-}" in
    127.0.0.1|localhost) ;;
    *) echo "__NOT_LOCAL__"; exit 0 ;;
  esac
  PGPASSWORD="${LOCAL_DB_PASSWORD:-}" PGCONNECT_TIMEOUT=10 psql -XAtq \
    -h "$LOCAL_DB_HOST" -p "${LOCAL_DB_PORT:-5432}" -U "${LOCAL_DB_USER:-}" -d "${LOCAL_DB_NAME:-}" \
    -c 'SELECT name FROM "SequelizeMeta" ORDER BY name' 2>/dev/null || echo "__UNREADABLE__"
)"
if [ "$APPLIED" = "__NOT_LOCAL__" ]; then
  echo "PREFLIGHT REFUSED: the database login is not for a local database. Nothing was read or changed."; exit 2
fi
if printf '%s\n' "$APPLIED" | grep -q '__UNREADABLE__'; then
  echo "PREFLIGHT REFUSED: the local database's migration ledger could not be read, so the schema cannot be checked against ${REF:0:12}."; refused=1
else
  # Names are compared exactly as the ledger and the commit give them: nothing
  # is renamed, trimmed or given a missing ".js". A name in neither convention
  # cannot be compared, so it is a refusal, never skipped.
  FILES="$(grep -v '^$' "$MIGRATIONS_FILE" | LC_ALL=C sort -u || true)"
  ROWS="$(printf '%s\n' "$APPLIED" | grep -v '^$' | LC_ALL=C sort -u || true)"
  HAVE="$(printf '%s\n' "$FILES" | grep -E "$NAME_RE" || true)"
  DONE="$(printf '%s\n' "$ROWS" | grep -E "$NAME_RE" || true)"
  ODD_FILES="$(printf '%s\n' "$FILES" | grep -v '^$' | grep -vE "$NAME_RE" || true)"
  ODD_ROWS="$(printf '%s\n' "$ROWS" | grep -v '^$' | grep -vE "$NAME_RE" || true)"
  RETIRED="$(printf '%s\n' "${RETIRED_APPLIED[@]}" | LC_ALL=C sort -u)"
  if [ -z "$HAVE" ] && [ -z "$ODD_FILES" ]; then
    echo "PREFLIGHT REFUSED: MIGRATIONS_FILE names no migration file, so the schema cannot be checked."; refused=1
  else
    if [ -n "$ODD_FILES" ]; then
      echo "PREFLIGHT REFUSED: ${REF:0:12} has $(printf '%s\n' "$ODD_FILES" | grep -c .) migration file name(s) in neither naming convention (8 or 14 digits, a dash, a name, .js), so the schema cannot be compared:"
      printf '%s\n' "$ODD_FILES" | head -10 | cut -c1-120 | sed 's/^/     in this commit, not recognised: /'
      refused=1
    fi
    if [ -n "$ODD_ROWS" ]; then
      echo "PREFLIGHT REFUSED: the database has $(printf '%s\n' "$ODD_ROWS" | grep -c .) applied migration name(s) in neither naming convention, so they cannot be compared with ${REF:0:12}:"
      printf '%s\n' "$ODD_ROWS" | head -10 | cut -c1-120 | sed 's/^/     applied, not recognised: /'
      refused=1
    fi
    # A retired name is a name no selectable commit has. If this commit has
    # one, the list is out of date: stop for review instead of ignoring it.
    BACK="$(LC_ALL=C comm -12 <(printf '%s\n' "$HAVE") <(printf '%s\n' "$RETIRED") | grep . || true)"
    if [ -n "$BACK" ]; then
      echo "PREFLIGHT REFUSED: ${REF:0:12} has $(printf '%s\n' "$BACK" | grep -c .) migration file(s) named on the retired list. The list must be reviewed before this commit is installed:"
      printf '%s\n' "$BACK" | sed 's/^/     retired name, present in this commit: /'
      refused=1
    fi
    SET_ASIDE="$(LC_ALL=C comm -12 <(printf '%s\n' "$DONE") <(printf '%s\n' "$RETIRED") | grep . || true)"
    LIVE="$(LC_ALL=C comm -23 <(printf '%s\n' "$DONE") <(printf '%s\n' "$RETIRED") | grep . || true)"
    AHEAD="$(LC_ALL=C comm -23 <(printf '%s\n' "$LIVE") <(printf '%s\n' "$HAVE") | grep . || true)"
    PENDING="$(LC_ALL=C comm -13 <(printf '%s\n' "$DONE") <(printf '%s\n' "$HAVE") | grep -c . || true)"
    echo "   schema: $(printf '%s\n' "$DONE" | grep -c . || true) applied; ${PENDING} of this commit's still to apply (the installer applies them before the swap)"
    if [ -n "$SET_ASIDE" ]; then
      echo "   retired: $(printf '%s\n' "$SET_ASIDE" | grep -c .) applied name(s) from before the selectable commits, set aside (exact names; the ledger is not changed):"
      printf '%s\n' "$SET_ASIDE" | sed 's/^/     retired, set aside: /'
    fi
    if [ -n "$AHEAD" ]; then
      echo "PREFLIGHT REFUSED: the database has $(printf '%s\n' "$AHEAD" | grep -c .) migration(s) that ${REF:0:12} does not have. Installing it would run older code against a newer schema:"
      printf '%s\n' "$AHEAD" | head -10 | sed 's/^/     applied, not in this commit: /'
      refused=1
    fi
  fi
fi

if [ "$refused" -ne 0 ]; then
  echo "PREFLIGHT FAILED for ${REF:0:12}: nothing was stopped, deleted or installed."
  exit 1
fi
echo "PREFLIGHT OK for ${REF:0:12}"

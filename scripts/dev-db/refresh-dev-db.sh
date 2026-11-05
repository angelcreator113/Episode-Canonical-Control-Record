#!/usr/bin/env bash
# Refresh the dev box's local database from production RDS. Run as root on the
# dev box (via SSM). Read-only against RDS.
#
#   sudo bash /home/ubuntu/dev-db/bin/refresh-dev-db.sh
#
# 1. Refuses to run while the dev app (pm2 episode-api / episode-worker) is online.
# 2. Reads the RDS connection from Secrets Manager through the app's own
#    loader (scripts/print-db-env.js) into this process's environment only.
# 3. pg_dump (custom format, read-only transaction) of episode_metadata,
#    excluding data_correction_log: the application role has no SELECT on it
#    by design (#3709); it is recreated empty from its own migration.
# 4. Restores into a fresh local database, clears session/token tables,
#    compares per-table row counts with RDS, then swaps it into place. A
#    failure before the swap leaves the existing local database untouched.
#
# Prints step names, sizes, counts and table names only: never a credential,
# hostname or row of data. Runbook: docs/runbooks/dev-environment.md
set -euo pipefail
set +x

APP_USER="${APP_USER:-ubuntu}"
APP_DIR="${APP_DIR:-/home/${APP_USER}/episode-metadata}"
DEV_DB_HOME="/home/${APP_USER}/dev-db"
PG_MAJOR="${PG_MAJOR:-17}"
PGBIN="/usr/lib/postgresql/${PG_MAJOR}/bin"
LOCAL_DB="${LOCAL_DB:-episode_metadata}"
LOCAL_ROLE="${LOCAL_ROLE:-episode_dev}"
RESTORE_DB="${LOCAL_DB}_restore"
CRED_FILE="/home/${APP_USER}/.config/episode-dev/local-db.env"
EXCLUDE_TABLE="public.data_correction_log"
DCL_MIGRATION_NAME="20261104170000-create-data-correction-log.js"
# Session/token tables emptied after every restore (Evoni, 2026-11-05, #3715).
CLEAR_TABLES="${CLEAR_TABLES:-teleprompter_remote_sessions}"

step() { echo "== $*"; }
as_app() { sudo -u "$APP_USER" -H "$@"; }
as_pg() { sudo -u postgres "$@"; }
lpsql() { as_pg "$PGBIN/psql" -X -v ON_ERROR_STOP=1 -Atq "$@"; }

[ "$(id -u)" -eq 0 ] || { echo "must run as root" >&2; exit 1; }
[ -x "$PGBIN/pg_dump" ] || { echo "postgresql-client-${PG_MAJOR} missing; run install-local-postgres.sh" >&2; exit 1; }
[ -s "$CRED_FILE" ] || { echo "local credential file missing; run install-local-postgres.sh" >&2; exit 1; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/dev-db-refresh.XXXXXX")"
chmod 700 "$WORK"
trap 'rm -rf "$WORK"' EXIT

step "dev app must be stopped"
RUNNING="$(as_app bash -lc 'pm2 jlist 2>/dev/null' | python3 -c '
import json,sys
try: apps=json.load(sys.stdin)
except Exception: apps=[]
print(" ".join(a["name"] for a in apps if a["name"] in ("episode-api","episode-worker") and a["pm2_env"]["status"]=="online"))')"
if [ -n "$RUNNING" ]; then echo "refusing: online: $RUNNING" >&2; exit 1; fi
echo "ok: episode-api and episode-worker not online"

step "RDS connection from Secrets Manager (not printed)"
DB_ENV="$(cd "$APP_DIR" && as_app node scripts/print-db-env.js)"
eval "$DB_ENV"; unset DB_ENV
export PGHOST="$DB_HOST" PGPORT="${DB_PORT:-5432}" PGDATABASE="$DB_NAME" PGUSER="$DB_USER" PGPASSWORD="$DB_PASSWORD"
export PGSSLMODE=require PGCONNECT_TIMEOUT=15 PGAPPNAME=dev-db-refresh
unset DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD
"$PGBIN/psql" -X -Atqc "select 'rds server_version=' || current_setting('server_version') || ' user=' || current_user || ' db=' || current_database()"

COUNT_SQL="select format('select %L || ''|'' || count(*) from public.%I', c.relname, c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p') and c.relname <> 'data_correction_log'
  order by c.relname"

step "pg_dump (read-only, excluding ${EXCLUDE_TABLE})"
T0=$(date +%s)
"$PGBIN/pg_dump" -Fc --no-owner --no-acl --exclude-table="$EXCLUDE_TABLE" -f "$WORK/rds.dump"
echo "dump: $(du -h "$WORK/rds.dump" | cut -f1) in $(( $(date +%s) - T0 ))s"

step "RDS row counts (right after the dump)"
printf '%s\n\\gexec\n' "$COUNT_SQL" | "$PGBIN/psql" -X -v ON_ERROR_STOP=1 -Atq | sort > "$WORK/rds.counts"
echo "tables: $(wc -l < "$WORK/rds.counts")"
unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGSSLMODE PGAPPNAME

step "restore into ${RESTORE_DB}"
chgrp postgres "$WORK" "$WORK/rds.dump"; chmod 750 "$WORK"; chmod 640 "$WORK/rds.dump"
as_pg "$PGBIN/dropdb" --if-exists "$RESTORE_DB"
as_pg "$PGBIN/createdb" -O "$LOCAL_ROLE" "$RESTORE_DB"
T0=$(date +%s)
as_pg "$PGBIN/pg_restore" --exit-on-error --no-owner --no-acl --role="$LOCAL_ROLE" -d "$RESTORE_DB" "$WORK/rds.dump"
chmod 700 "$WORK"; rm -f "$WORK/rds.dump"
echo "restored in $(( $(date +%s) - T0 ))s; dump file removed"

step "recreate ${EXCLUDE_TABLE} (empty) from its migration"
MIG="$APP_DIR/src/migrations/$DCL_MIGRATION_NAME"
[ -f "$MIG" ] || MIG="$DEV_DB_HOME/migrations/$DCL_MIGRATION_NAME"
[ -f "$MIG" ] || { echo "migration $DCL_MIGRATION_NAME not found" >&2; exit 1; }
as_app env CRED_FILE="$CRED_FILE" TARGET_DB="$RESTORE_DB" MIG="$MIG" APP_DIR="$APP_DIR" node -e '
  const fs = require("fs");
  const kv = Object.fromEntries(fs.readFileSync(process.env.CRED_FILE, "utf8").split("\n").filter(Boolean).map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
  const { Sequelize } = require(process.env.APP_DIR + "/node_modules/sequelize");
  const s = new Sequelize(process.env.TARGET_DB, kv.LOCAL_DB_USER, kv.LOCAL_DB_PASSWORD, { host: kv.LOCAL_DB_HOST, port: +kv.LOCAL_DB_PORT, dialect: "postgres", logging: false });
  require(process.env.MIG).up(s.getQueryInterface())
    .then(() => s.query("select count(*)::int n from public.data_correction_log"))
    .then(([[r]]) => { console.log("data_correction_log present, rows=" + r.n); return s.close(); })
    .catch(e => { console.error("migration failed:", e.message); process.exit(1); });
'
lpsql -d "$RESTORE_DB" -c "select 'SequelizeMeta has it: ' || exists(select 1 from \"SequelizeMeta\" where name = '$DCL_MIGRATION_NAME')"

step "clear session/token tables"
for t in $CLEAR_TABLES; do
  before="$(lpsql -d "$RESTORE_DB" -c "select count(*) from public.\"$t\"")"
  lpsql -d "$RESTORE_DB" -c "truncate table public.\"$t\""
  after="$(lpsql -d "$RESTORE_DB" -c "select count(*) from public.\"$t\"")"
  echo "cleared $t: rows $before -> $after"
done

step "compare row counts with RDS"
printf '%s\n\\gexec\n' "$COUNT_SQL" | lpsql -d "$RESTORE_DB" | sort > "$WORK/local.counts"
python3 - "$WORK/rds.counts" "$WORK/local.counts" "$CLEAR_TABLES" <<'PY'
import sys
rd = dict(l.rsplit('|', 1) for l in open(sys.argv[1]).read().split('\n') if l)
lo = dict(l.rsplit('|', 1) for l in open(sys.argv[2]).read().split('\n') if l)
cleared = set(sys.argv[3].split())
same = [t for t in rd if lo.get(t) == rd[t]]
diff = [t for t in rd if t not in cleared and lo.get(t) != rd[t]]
print(f"tables: rds={len(rd)} local={len(lo)}  matching={len(same)}  differing={len(diff)}  cleared={len(cleared & set(rd))}")
print(f"rows: rds={sum(map(int, rd.values()))} local={sum(map(int, lo.values()))}")
for t in diff: print(f"  DIFF {t}: rds={rd[t]} local={lo.get(t)}")
for t in sorted(set(lo) - set(rd)): print(f"  LOCAL-ONLY {t}: {lo[t]}")
for t in ("shows", "episodes", "social_profiles", "registry_characters", "scene_sets", "SequelizeMeta"):
    if t in rd: print(f"  {t}: rds={rd[t]} local={lo.get(t)}")
sys.exit(1 if diff or len(lo) != len(rd) else 0)
PY

step "swap ${RESTORE_DB} -> ${LOCAL_DB}"
lpsql -d postgres -c "select count(pg_terminate_backend(pid)) from pg_stat_activity where datname in ('$LOCAL_DB', '$RESTORE_DB') and pid <> pg_backend_pid()" >/dev/null
as_pg "$PGBIN/dropdb" --if-exists "$LOCAL_DB"
lpsql -d postgres -c "alter database \"$RESTORE_DB\" rename to \"$LOCAL_DB\""
lpsql -d postgres -c "select 'local ' || datname || ' size=' || pg_size_pretty(pg_database_size(datname)) || ' owner=' || pg_get_userbyid(datdba) from pg_database where datname = '$LOCAL_DB'"
step "done"

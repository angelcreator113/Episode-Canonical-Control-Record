#!/usr/bin/env bash
# Apply the pending migrations of one app tree to the dev box's LOCAL
# database, and say truthfully whether that worked. Run as the app user.
# install-dev-app.sh calls it on the staged tree BEFORE the tree swap, so a
# failure here leaves the running app and its tree exactly as they were.
#
#   bash scripts/dev-db/migrate-local-db.sh <app tree> <env file>
#
# 1. Refuses unless the env file's DB_HOST is 127.0.0.1 or localhost.
# 2. Reads the ledger with scripts/check-pending-migrations.js (the same
#    read-only check the production Deploy workflow uses): 0 nothing pending,
#    1 files pending, anything else the ledger could not be read.
# 3. With files pending, runs sequelize-cli db:migrate and keeps its exit code.
# 4. Reads the ledger again. Anything still pending is a failure.
#
# Exit: 0 only when nothing is pending at the end and db:migrate (if it ran)
# exited 0. 1 for a failed or incomplete migration or an unreadable ledger.
# 2 for bad arguments or a database that is not local. A healthy /health
# afterwards says nothing about migrations; this exit code does.
#
# Prints migration file names, sequelize's own "== " and "ERROR" lines and
# counts. Never a credential, a hostname or a row. Task: dev installer
# migration-failure handling (Evoni, 2026-11-11).
set -uo pipefail
set +x

TREE="${1:-}"; ENV_FILE="${2:-}"
if [ -z "$TREE" ] || [ -z "$ENV_FILE" ] || [ ! -d "$TREE" ] || [ ! -s "$ENV_FILE" ]; then
  echo "MIGRATION REFUSED: usage: migrate-local-db.sh <app tree> <env file>"; exit 2
fi
cd "$TREE" || { echo "MIGRATION REFUSED: cannot enter the app tree"; exit 2; }
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
case "${DB_HOST:-}" in
  127.0.0.1|localhost) ;;
  *) echo "MIGRATION REFUSED: DB_HOST is not local. Nothing was read or changed."; exit 2 ;;
esac

# Sets LEDGER_RC and LEDGER_PENDING (a count) from the read-only ledger check.
ledger() {
  local out
  out="$(NODE_ENV=development node scripts/check-pending-migrations.js 2>&1)"
  LEDGER_RC=$?
  LEDGER_FILES="$(printf '%s\n' "$out" | grep -oE '[0-9]{14}-[A-Za-z0-9_.-]+\.js' | sort -u || true)"
  LEDGER_PENDING="$(printf '%s' "$LEDGER_FILES" | grep -c . || true)"
}

ledger
case "$LEDGER_RC" in
  0) echo "pending before: 0"; echo "MIGRATIONS OK: nothing pending; no migration run."; exit 0 ;;
  1) echo "pending before: $LEDGER_PENDING"; printf '%s\n' "$LEDGER_FILES" | sed 's/^/  pending: /' ;;
  *) echo "MIGRATION FAILED: the migration ledger could not be read (check exit $LEDGER_RC). No migration was run."; exit 1 ;;
esac

OUT="$(NODE_ENV=development npx sequelize db:migrate 2>&1)"
MIGRATE_RC=$?
SHOWN="$(printf '%s\n' "$OUT" | grep -E '^== |migrated|ERROR' | tail -20 || true)"
unset OUT
if [ -n "$SHOWN" ]; then printf '%s\n' "$SHOWN"; fi
echo "db:migrate exit $MIGRATE_RC"

ledger
case "$LEDGER_RC" in
  0|1) echo "pending after: $LEDGER_PENDING" ;;
  *) echo "pending after: unknown (the ledger could not be read, check exit $LEDGER_RC)" ;;
esac

if [ "$MIGRATE_RC" -ne 0 ]; then
  [ -n "$SHOWN" ] || echo "(db:migrate printed no ERROR line; its full output is not shown in this log)"
  echo "MIGRATION FAILED: db:migrate exited $MIGRATE_RC. A migration that runs in one transaction is rolled back whole; migrations that finished before it stay applied."
  exit 1
fi
if [ "$LEDGER_RC" -ne 0 ]; then
  [ "$LEDGER_RC" -eq 1 ] && printf '%s\n' "$LEDGER_FILES" | sed 's/^/  still pending: /'
  echo "MIGRATION INCOMPLETE: db:migrate exited 0 but the ledger is not clean afterwards."
  exit 1
fi
echo "MIGRATIONS OK: db:migrate exited 0 and nothing is pending."

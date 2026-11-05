#!/usr/bin/env bash
# One-tap dev data refresh (Task #3717). Run as root on the dev box; the
# refresh-dev-data workflow runs it through the SSM document
# EpisodeDevRefresh (scripts/dev-db/ssm/EpisodeDevRefresh.json).
#
#   1. stop the dev app (refresh-dev-db.sh refuses while it is online);
#   2. run refresh-dev-db.sh from the deployed tree: pg_dump production as the
#      read-only dev_refresh_ro, restore locally, clear session/token tables,
#      compare row counts, swap into place;
#   3. start the dev app and verify it (:3002 on 127.0.0.1 only, /health
#      healthy + connected); pm2 save.
#
# PUBLIC-LOG HYGIENE: the repository is public and so are workflow logs. This
# script prints NOTHING about the data: no table names, no row counts, no
# hostnames. It prints step names, exit codes, and match yes/no. The full
# refresh output stays on the box, readable only by root, in
# /var/log/dev-refresh/ (last 10 kept).
set -uo pipefail
set +x

APP_USER="${APP_USER:-ubuntu}"
APP_DIR="/home/${APP_USER}/episode-metadata"
REFRESH="${REFRESH:-$APP_DIR/scripts/dev-db/refresh-dev-db.sh}"
LOG_DIR=/var/log/dev-refresh
LOG="$LOG_DIR/refresh-$(date -u +%Y%m%dT%H%M%SZ).log"

say() { echo "$(date -u +%H:%M:%SZ) $*"; }
pm2u() { sudo -u "$APP_USER" -H bash -lc "$1" >/dev/null 2>&1; }

[ "$(id -u)" -eq 0 ] || { say "must run as root"; exit 2; }
[ -f "$REFRESH" ] || { say "refresh script missing from the deployed tree"; exit 2; }
install -d -m 700 "$LOG_DIR"; umask 077

say "refresh: start (deployed commit $(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo unknown))"

say "stop dev app"
pm2u "pm2 stop episode-api episode-worker" || true

say "refresh database (full output kept on the box)"
bash "$REFRESH" > "$LOG" 2>&1
RC=$?
TABLES_OK=no; ROWS_OK=no; CLEARED=0
grep -qE '^tables: rds=([0-9]+) local=\1 +matching=\1 +differing=0' "$LOG" && TABLES_OK=yes
grep -qE '^rows: rds=([0-9]+) local=\1$' "$LOG" && ROWS_OK=yes
CLEARED=$(grep -c '^cleared ' "$LOG" || true)
say "refresh exit: $RC | tables match: $TABLES_OK | rows match: $ROWS_OK | session/token tables cleared: $CLEARED"
[ "$RC" -eq 0 ] || say "refresh FAILED at step: $(grep '^== ' "$LOG" | tail -1 | sed 's/^== //' | cut -c1-60). The local database is unchanged unless the swap step ran."

say "start dev app"
pm2u "cd '$APP_DIR' && pm2 startOrRestart ecosystem.dev.config.js --only episode-api,episode-worker --update-env"
for _ in $(seq 1 45); do curl -s -m 2 -o /dev/null http://127.0.0.1:3002/health && break; sleep 2; done
BOUND="$(ss -ltn | awk '$4 ~ /:3002$/{print $4}' | sort -u | tr '\n' ' ')"
LOOPBACK=no; [ "$BOUND" = "127.0.0.1:3002 " ] && LOOPBACK=yes
HEALTH="$(curl -s -m 10 http://127.0.0.1:3002/health | python3 -c 'import json,sys
try: d=json.load(sys.stdin); print("yes" if d.get("status")=="healthy" and d.get("database")=="connected" else "no")
except Exception: print("no")')"
say "app: loopback-only: $LOOPBACK | healthy + database connected: $HEALTH"
if [ "$LOOPBACK" != yes ]; then say "NOT loopback-only: stopping the dev app"; pm2u "pm2 stop episode-api episode-worker"; fi
pm2u "pm2 save"

ls -1t "$LOG_DIR"/refresh-*.log 2>/dev/null | tail -n +11 | xargs -r rm -f
say "refresh: done; full log on the box: $LOG"
[ "$RC" -eq 0 ] && [ "$TABLES_OK" = yes ] && [ "$ROWS_OK" = yes ] && [ "$LOOPBACK" = yes ] && [ "$HEALTH" = yes ]

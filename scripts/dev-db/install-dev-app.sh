#!/usr/bin/env bash
# Install a given commit of this repository as the dev app on the dev box,
# wired to the box's local database. Run as root on the dev box (via SSM).
# It does not start the app (see docs/runbooks/dev-environment.md).
#
#   sudo REF=<full commit sha> DIST_TARBALL=/path/dist.tar.gz DIST_SHA256=<sha256> \
#     bash scripts/dev-db/install-dev-app.sh
#
# The frontend is built OFF the box (same commit, `npx vite build` in
# frontend/, then `tar -C dist -czf dist.tar.gz .`) and handed in as
# DIST_TARBALL. Building it on this 2 GB box exhausted memory and hung the
# instance on 2026-11-05.
#
# 1. Clones the public repository at REF into a staging folder and checks
#    the checked-out SHA equals REF.
# 2. npm ci (all dependencies: migrations need sequelize-cli; sharp and canvas
#    need their install scripts), then unpacks DIST_TARBALL into
#    frontend/dist after checking its sha256. Refuses with less than
#    MIN_MEM_MIB of RAM + swap (default 2800).
# 3. Writes ~/.config/episode-dev/dev.env (mode 600): the preserved app
#    settings (app.env), the local database login (local-db.env),
#    DB_SSL=false, HOST=127.0.0.1 and NODE_ENV=production (app.env's own
#    NODE_ENV is ignored). The app's .env is a symlink to it.
#    Nothing in it is printed.
# 4. Applies pending migrations to the LOCAL database only
#    (scripts/dev-db/migrate-local-db.sh). If a migration fails, or anything
#    is still pending afterwards, it stops here: nothing is swapped.
# 5. Swaps the staging tree into /home/ubuntu/episode-metadata. The previous
#    tree is kept beside it as episode-metadata.prev for rollback.
#
# Refuses while episode-api or episode-worker is online. Task #3716.
set -euo pipefail
set +x

REF="${REF:?set REF to the full commit sha to install}"
REPO_URL="${REPO_URL:-https://github.com/angelcreator113/Episode-Canonical-Control-Record.git}"
APP_USER="${APP_USER:-ubuntu}"
HOME_DIR="/home/${APP_USER}"
APP_DIR="${HOME_DIR}/episode-metadata"
STAGE="${HOME_DIR}/episode-metadata.next"
PREV="${HOME_DIR}/episode-metadata.prev"
CONF="${HOME_DIR}/.config/episode-dev"
DEV_ENV="${CONF}/dev.env"
DIST_TARBALL="${DIST_TARBALL:?set DIST_TARBALL to a frontend/dist tarball built off the box}"
DIST_SHA256="${DIST_SHA256:?set DIST_SHA256 to the sha256 of the tarball}"
MIN_MEM_MIB="${MIN_MEM_MIB:-2800}"

step() { echo "== $*"; }
as_app() { sudo -u "$APP_USER" -H bash -lc "$1"; }
free() { df -h / | awk 'NR==2{print $4" free ("$5" used)"}'; }

[ "$(id -u)" -eq 0 ] || { echo "must run as root" >&2; exit 1; }
[[ "$REF" =~ ^[0-9a-f]{40}$ ]] || { echo "REF must be a full 40-character commit sha" >&2; exit 1; }
for f in "$CONF/app.env" "$CONF/local-db.env" "$DIST_TARBALL"; do [ -s "$f" ] || { echo "missing $f" >&2; exit 1; }; done
echo "$DIST_SHA256  $DIST_TARBALL" | sha256sum -c --quiet - || { echo "DIST_TARBALL sha256 mismatch" >&2; exit 1; }

step "memory guard (RAM + swap >= ${MIN_MEM_MIB} MiB)"
MEM_MIB=$(awk '/^MemTotal:/{m=$2} /^SwapTotal:/{s=$2} END{print int((m+s)/1024)}' /proc/meminfo)
echo "RAM+swap: ${MEM_MIB} MiB"
[ "$MEM_MIB" -ge "$MIN_MEM_MIB" ] || { echo "refusing: ${MEM_MIB} MiB < ${MIN_MEM_MIB} MiB; add swap first (docs/runbooks/dev-environment.md)" >&2; exit 1; }

step "dev app must be stopped"
RUNNING="$(as_app 'pm2 jlist 2>/dev/null' | python3 -c '
import json,sys
try: apps=json.load(sys.stdin)
except Exception: apps=[]
print(" ".join(a["name"] for a in apps if a["name"] in ("episode-api","episode-worker") and a["pm2_env"]["status"]=="online"))')"
[ -z "$RUNNING" ] || { echo "refusing: online: $RUNNING" >&2; exit 1; }
echo "ok; disk: $(free); node: $(as_app 'node -v'), npm: $(as_app 'npm -v')"

# At most two app trees on disk at any time (the box has ~1.5 GB free): the
# rollback tree from the PREVIOUS install goes first. The live tree stays
# untouched until the swap, so a failed install still leaves it running.
step "free the previous rollback tree"
[ -d "$PREV" ] && { rm -rf "$PREV"; echo "removed $PREV"; } || echo "none"
echo "disk: $(free)"

step "clone ${REF:0:12} into ${STAGE}"
rm -rf "$STAGE"
as_app "git init -q '$STAGE' && cd '$STAGE' && git remote add origin '$REPO_URL' && git fetch -q --depth 1 origin '$REF' && git -c advice.detachedHead=false checkout -q FETCH_HEAD"
GOT="$(as_app "git -C '$STAGE' rev-parse HEAD")"
[ "$GOT" = "$REF" ] || { echo "checked out $GOT, expected $REF" >&2; exit 1; }
echo "HEAD $GOT  $(as_app "git -C '$STAGE' log -1 --format=%s" | cut -c1-90)"

step "npm ci"
T0=$(date +%s)
as_app "cd '$STAGE' && npm ci --no-audit --no-fund --loglevel=error"
echo "done in $(( $(date +%s) - T0 ))s; node_modules $(du -sh "$STAGE/node_modules" | cut -f1); disk: $(free)"

step "frontend/dist from the off-box build"
rm -rf "$STAGE/frontend/dist"; install -d -o "$APP_USER" -g "$APP_USER" "$STAGE/frontend/dist"
as_app "tar -C '$STAGE/frontend/dist' -xzf '$DIST_TARBALL'"
[ -s "$STAGE/frontend/dist/index.html" ] || { echo "frontend/dist/index.html missing after unpack" >&2; exit 1; }
echo "dist $(du -sh "$STAGE/frontend/dist" | cut -f1); disk: $(free)"

step "dev.env (local database; loopback; values not printed)"
umask 077
{
  echo "# Generated by scripts/dev-db/install-dev-app.sh (Task #3716). Do not commit."
  grep -vE '^(#|$|DB_|DATABASE_URL|HOST=|NODE_ENV=)' "$CONF/app.env"
  sed -n 's/^LOCAL_DB_HOST=/DB_HOST=/p; s/^LOCAL_DB_PORT=/DB_PORT=/p; s/^LOCAL_DB_NAME=/DB_NAME=/p; s/^LOCAL_DB_USER=/DB_USER=/p; s/^LOCAL_DB_PASSWORD=/DB_PASSWORD=/p' "$CONF/local-db.env"
  echo "DB_SSL=false"
  echo "HOST=127.0.0.1"
  # Always production, here and not only in the pm2 env: src/routes/memories/*.js
  # re-read .env with override when ANTHROPIC_API_KEY is unset (as on this
  # box), which replaces whatever pm2 set. Any other value makes the API
  # return stack traces and skip the login rate limit.
  echo "NODE_ENV=production"
} > "$DEV_ENV"
chown "$APP_USER:$APP_USER" "$DEV_ENV"; chmod 600 "$DEV_ENV"
as_app "ln -sfn '$DEV_ENV' '$STAGE/.env' && mkdir -p '$STAGE/logs' '$STAGE/exports-temp'"
echo "keys: $(sed -nE 's/^([A-Z_]+)=.*/\1/p' "$DEV_ENV" | tr '\n' ' ')"
echo "DB_HOST=$(sed -n 's/^DB_HOST=//p' "$DEV_ENV")  DB_NAME=$(sed -n 's/^DB_NAME=//p' "$DEV_ENV")  DB_USER=$(sed -n 's/^DB_USER=//p' "$DEV_ENV")"

step "pending migrations against the LOCAL database"
# Before the swap, and it must succeed: scripts/dev-db/migrate-local-db.sh
# (from the commit being installed) exits non-zero when db:migrate fails, when
# anything is still pending afterwards, or when the ledger cannot be read. The
# live tree and the running app are untouched at this point, so stopping here
# leaves them as they were; deploy-dev-box.sh restarts the existing tree and
# fails the deploy. The staged tree is kept for diagnosis until the next run.
[ -f "$STAGE/scripts/dev-db/migrate-local-db.sh" ] || { echo "== MIGRATION FAILED: ${REF:0:12} has no scripts/dev-db/migrate-local-db.sh, so its migrations cannot be checked. Not installed; the live tree was not changed." >&2; exit 1; }
if ! as_app "bash '$STAGE/scripts/dev-db/migrate-local-db.sh' '$STAGE' '$DEV_ENV'"; then
  echo "== MIGRATION FAILED: ${REF:0:12} is NOT installed. The live tree at $APP_DIR was not changed (see the MIGRATION line above)."
  echo "MIGRATION FAILED: ${REF:0:12} is not installed; the live tree was not changed" >&2
  exit 1
fi

step "swap trees"
rm -rf "$PREV"
[ -d "$APP_DIR" ] && mv "$APP_DIR" "$PREV"
mv "$STAGE" "$APP_DIR"
as_app "ln -sfn '$DEV_ENV' '$APP_DIR/.env'"
echo "installed $(as_app "git -C '$APP_DIR' rev-parse --short=12 HEAD") at $APP_DIR; previous tree at $PREV; disk: $(free)"

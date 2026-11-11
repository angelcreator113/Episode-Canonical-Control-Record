#!/usr/bin/env bash
# Deploy one commit to the dev box: stop the dev app, install the commit
# (install-dev-app.sh), start it, verify it, save. Run as root on the dev box.
# deploy-dev.yml calls it through SSM; it can also be run by hand:
#
#   sudo REF=<full sha> DIST_TARBALL=<path> DIST_SHA256=<sha256> \
#     INSTALLER=/path/install-dev-app.sh bash deploy-dev-box.sh
#
# Verification after start (all must hold, or the previous tree is put back
# and restarted):
#   * :3002 is bound to 127.0.0.1 only (the dev API is never public);
#   * GET /health is 200 with "database":"connected" and
#     "environment":"production" (ecosystem.dev.config.js pins it for the API:
#     any other value exposes stack traces and switches off the login limit);
#   * GET /api/v1/shows without a token is refused (401/403): auth is enforced.
# It never touches nginx, the security group, or any secret. Task #3716.
set -euo pipefail
set +x

REF="${REF:?}"; DIST_TARBALL="${DIST_TARBALL:?}"; DIST_SHA256="${DIST_SHA256:?}"
INSTALLER="${INSTALLER:-/home/ubuntu/dev-db/bin/install-dev-app.sh}"
APP_USER="${APP_USER:-ubuntu}"
APP_DIR="/home/${APP_USER}/episode-metadata"
PREV="/home/${APP_USER}/episode-metadata.prev"

step() { echo "== $*"; }
pm2u() { sudo -u "$APP_USER" -H bash -lc "$1"; }
start_apps() { pm2u "cd '$APP_DIR' && pm2 startOrRestart ecosystem.dev.config.js --only episode-api,episode-worker --update-env 2>&1 | grep -E '\[PM2\]' | tail -4"; }

verify() {
  local i bound code body
  for i in $(seq 1 45); do curl -s -m 2 -o /dev/null http://127.0.0.1:3002/health && break; sleep 2; done
  bound="$(ss -ltn | awk '$4 ~ /:3002$/{print $4}' | sort -u | tr '\n' ' ')"
  echo "   :3002 bound on: ${bound:-nothing}"
  [ "$bound" = "127.0.0.1:3002 " ] || { echo "   FAIL: not loopback-only"; return 1; }
  body="$(curl -s -m 10 http://127.0.0.1:3002/health || true)"
  echo "$body" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("   /health:", d.get("status"), "| database:", d.get("database"), "| environment:", d.get("environment")); sys.exit(0 if d.get("status")=="healthy" and d.get("database")=="connected" and d.get("environment")=="production" else 1)' \
    || { echo "   FAIL: /health not healthy+connected, or the API is not running as production"; return 1; }
  code="$(curl -s -m 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:3002/api/v1/shows)"
  echo "   GET /api/v1/shows without a token -> $code"
  case "$code" in 401|403) ;; *) echo "   FAIL: an authenticated route answered without a token"; return 1;; esac
}

step "stop the dev app"
pm2u "pm2 stop episode-api episode-worker >/dev/null 2>&1 || true"
pm2u 'pm2 jlist' | python3 -c 'import json,sys;[print("  ",p["name"],p["pm2_env"]["status"]) for p in json.load(sys.stdin)]'

step "install ${REF:0:12}"
if ! REF="$REF" DIST_TARBALL="$DIST_TARBALL" DIST_SHA256="$DIST_SHA256" bash "$INSTALLER"; then
  echo "== install FAILED before or during the tree swap"
  # Failed mid-swap: the live tree was moved aside but the new one not in.
  if [ ! -d "$APP_DIR" ] && [ -d "$PREV" ]; then echo "   moving the previous tree back"; mv "$PREV" "$APP_DIR"; fi
  if [ -d "$APP_DIR" ]; then echo "   restarting the existing tree"; start_apps; verify || true; fi
  exit 1
fi

step "start ${REF:0:12}"
start_apps
if ! verify; then
  echo "== verification FAILED: putting the previous tree back"
  pm2u "pm2 stop episode-api episode-worker >/dev/null 2>&1 || true"
  if [ -d "$PREV" ]; then
    rm -rf "$APP_DIR.failed"; mv "$APP_DIR" "$APP_DIR.failed"; mv "$PREV" "$APP_DIR"
    start_apps
    if verify; then echo "   previous tree restored and healthy; failed tree at $APP_DIR.failed"; else echo "   previous tree restored but NOT healthy"; fi
    pm2u "pm2 save >/dev/null 2>&1 || true"
  else
    echo "   no previous tree to restore"
  fi
  exit 1
fi

step "pm2 save"
pm2u "pm2 save 2>&1 | tail -1"
python3 -c 'import json;[print("   saved:",a["name"],a.get("status")) for a in json.load(open("/home/'"$APP_USER"'/.pm2/dump.pm2"))]'
echo "   running: $(pm2u "git -C '$APP_DIR' rev-parse HEAD")"
echo "   disk: $(df -h / | awk 'NR==2{print $4" free ("$5" used)"}')"
step "done"

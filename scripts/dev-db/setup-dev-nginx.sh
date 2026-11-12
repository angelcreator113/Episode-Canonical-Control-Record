#!/usr/bin/env bash
# Put nginx in front of the dev app on the dev box, with a Let's Encrypt
# certificate. Run as root on the dev box (via SSM). Idempotent.
#
#   sudo bash setup-dev-nginx.sh                 # port 80 only, or 80 + 443 when a certificate exists
#   sudo ISSUE_CERT=1 bash setup-dev-nginx.sh    # also get the certificate (see below)
#
# The two site files in nginx/ beside this script are installed as they are.
# The script never opens a port: the security group decides what reaches
# nginx, and the app stays on 127.0.0.1:3002.
#
# It refuses unless the dev API is bound to loopback only and reports
# "environment":"production". With NODE_ENV=development the app returns
# stack traces to anyone and switches the login rate limit off, so it must
# not be put behind a public nginx (docs/runbooks/dev-environment.md).
#
# ISSUE_CERT=1 needs DNS for the domain to point at this box and port 80 to
# be reachable from the internet. The first run on a box registers a Let's
# Encrypt account, which means agreeing to its Subscriber Agreement: that
# needs CERTBOT_AGREE_TOS=yes, and CERTBOT_EMAIL=<address> or no address at
# all (expiry notices are then not sent). A certificate that certbot did not
# issue (the self-signed one from July 2026) is moved aside, not deleted.
#
# Undo: systemctl disable --now nginx (the app is untouched).
set -euo pipefail

DOMAIN="${DOMAIN:-dev.primepisodes.com}"
APP_USER="${APP_USER:-ubuntu}"
APP_DIR="/home/${APP_USER}/episode-metadata"
DIST="${APP_DIR}/frontend/dist"
SRC="${SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/nginx}"
WEBROOT=/var/www/certbot
LIVE="/etc/letsencrypt/live/${DOMAIN}"
ISSUE_CERT="${ISSUE_CERT:-0}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

step() { echo "== $*"; }
have_certbot_cert() {
  [ -s "/etc/letsencrypt/renewal/${DOMAIN}.conf" ] && [ -s "${LIVE}/fullchain.pem" ] \
    && openssl x509 -in "${LIVE}/fullchain.pem" -noout -checkend 86400 >/dev/null 2>&1
}

[ "$(id -u)" -eq 0 ] || { echo "must run as root" >&2; exit 1; }
for f in dev-site-http.conf dev-site-https.conf; do
  [ -s "${SRC}/$f" ] || { echo "missing ${SRC}/$f" >&2; exit 1; }
done

step "exposure guard: the app is loopback-only and runs as production"
BOUND="$(ss -ltn | awk '$4 ~ /:3002$/{print $4}' | sort -u | tr '\n' ' ')"
echo "   :3002 bound on: ${BOUND:-nothing}"
[ "$BOUND" = "127.0.0.1:3002 " ] || { echo "refusing: the dev API must listen on 127.0.0.1:3002 only" >&2; exit 1; }
APP_ENV="$(curl -s -m 10 http://127.0.0.1:3002/health | python3 -c 'import json,sys; print(json.load(sys.stdin).get("environment",""))' 2>/dev/null || true)"
echo "   /health environment: ${APP_ENV:-unknown}"
[ "$APP_ENV" = "production" ] || { echo "refusing: the dev API must run with NODE_ENV=production before it is reachable" >&2; exit 1; }
PUBLIC_PG="$(ss -ltn | awk '$4 ~ /:5432$/ && $4 !~ /^127\.0\.0\.1:/ && $4 !~ /^\[::1\]:/{print $4}' | tr '\n' ' ')"
[ -z "$PUBLIC_PG" ] || { echo "refusing: PostgreSQL listens on ${PUBLIC_PG}" >&2; exit 1; }

step "let nginx read the built frontend (traverse-only on /home/${APP_USER})"
[ -s "${DIST}/index.html" ] || { echo "missing ${DIST}/index.html" >&2; exit 1; }
if ! command -v setfacl >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  timeout 300 apt-get install -y -qq acl >/dev/null
fi
setfacl -m u:www-data:--x "/home/${APP_USER}"
sudo -u www-data test -r "${DIST}/index.html" || { echo "www-data still cannot read ${DIST}/index.html" >&2; exit 1; }
if sudo -u www-data test -r "/home/${APP_USER}/.config/episode-dev/dev.env"; then
  echo "refusing: www-data can read dev.env" >&2; exit 1
fi
echo "   ok: www-data reads index.html and cannot read dev.env"

step "site files"
install -d -m 755 "$WEBROOT"
install -m 644 "${SRC}/dev-site-http.conf" /etc/nginx/sites-available/dev-site-http.conf
install -m 644 "${SRC}/dev-site-https.conf" /etc/nginx/sites-available/dev-site-https.conf
# The old site file (July 2026: /var/www/html and localhost:3002) is kept, out of use.
for old in episode default; do
  if [ -L "/etc/nginx/sites-enabled/${old}" ]; then
    rm "/etc/nginx/sites-enabled/${old}"
    echo "   unlinked sites-enabled/${old}"
  elif [ -e "/etc/nginx/sites-enabled/${old}" ]; then
    mv "/etc/nginx/sites-enabled/${old}" "/etc/nginx/sites-available/${old}.retired-${STAMP}"
    echo "   moved sites-enabled/${old} to sites-available/${old}.retired-${STAMP}"
  fi
done
ln -sfn /etc/nginx/sites-available/dev-site-http.conf /etc/nginx/sites-enabled/dev-site-http.conf
if have_certbot_cert; then
  ln -sfn /etc/nginx/sites-available/dev-site-https.conf /etc/nginx/sites-enabled/dev-site-https.conf
else
  rm -f /etc/nginx/sites-enabled/dev-site-https.conf
fi
nginx -t
systemctl enable --now nginx >/dev/null 2>&1
systemctl reload nginx

if [ "$ISSUE_CERT" = "1" ] && ! have_certbot_cert; then
  step "certificate for ${DOMAIN} (HTTP-01 through ${WEBROOT})"
  if [ -d "$LIVE" ] && [ ! -s "/etc/letsencrypt/renewal/${DOMAIN}.conf" ]; then
    mv "$LIVE" "/etc/letsencrypt/not-certbot-${DOMAIN}-${STAMP}"
    echo "   moved the certificate certbot did not issue to /etc/letsencrypt/not-certbot-${DOMAIN}-${STAMP}"
  fi
  ACCOUNT_ARGS=()
  if ! find /etc/letsencrypt/accounts -name regr.json 2>/dev/null | grep -q .; then
    [ "${CERTBOT_AGREE_TOS:-}" = "yes" ] || { echo "refusing: no Let's Encrypt account on this box; registering one needs CERTBOT_AGREE_TOS=yes" >&2; exit 1; }
    ACCOUNT_ARGS+=(--agree-tos)
    if [ -n "${CERTBOT_EMAIL:-}" ]; then
      ACCOUNT_ARGS+=(-m "$CERTBOT_EMAIL" --no-eff-email)
    else
      ACCOUNT_ARGS+=(--register-unsafely-without-email)
    fi
  fi
  certbot certonly --webroot -w "$WEBROOT" -d "$DOMAIN" --cert-name "$DOMAIN" \
    --non-interactive --keep-until-expiring "${ACCOUNT_ARGS[@]}" 2>&1 | tail -8
  have_certbot_cert || { echo "no certificate after certbot" >&2; exit 1; }
  ln -sfn /etc/nginx/sites-available/dev-site-https.conf /etc/nginx/sites-enabled/dev-site-https.conf
  nginx -t
  systemctl reload nginx
fi

if have_certbot_cert; then
  step "renewal: certbot.timer, nginx reloaded after each renewal"
  install -d /etc/letsencrypt/renewal-hooks/deploy
  printf '#!/bin/sh\nsystemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
  chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
  systemctl enable --now certbot.timer >/dev/null 2>&1
  echo "   certbot.timer: $(systemctl is-enabled certbot.timer) / $(systemctl is-active certbot.timer)"
  echo "   certificate: $(openssl x509 -in "${LIVE}/fullchain.pem" -noout -issuer -enddate | tr '\n' ' ')"
  # Without --no-random-sleep-on-renew a non-interactive renewal waits up to
  # 8 minutes first, and a second certbot started meanwhile refuses to run.
  echo "   renewal dry run: $(timeout 150 certbot renew --dry-run --no-random-sleep-on-renew --cert-name "$DOMAIN" 2>&1 | grep -iE 'succeeded|failed|error|another instance' | tail -2 | tr '\n' ' ')"
fi

step "state"
echo "   nginx: $(systemctl is-enabled nginx) / $(systemctl is-active nginx); sites: $(ls /etc/nginx/sites-enabled | tr '\n' ' ')"
echo "   listening: $(ss -ltn | awk 'NR>1{print $4}' | sort -u | tr '\n' ' ')"
have_certbot_cert || echo "   no certificate yet: port 80 only. Run again with ISSUE_CERT=1 once DNS and port 80 reach this box."
step "done"

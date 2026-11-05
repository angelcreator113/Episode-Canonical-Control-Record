#!/usr/bin/env bash
# Install a local PostgreSQL on the dev box, matching the RDS major version,
# listening on localhost only. Run as root (via SSM). Idempotent.
#
#   sudo PG_MAJOR=17 bash scripts/dev-db/install-local-postgres.sh
#
# Creates the local role and database the dev app will use, with a random
# password written only to $CRED_FILE (mode 600, owned by ubuntu). The
# password is never printed.
#
# Runbook: docs/runbooks/dev-environment.md
set -euo pipefail

PG_MAJOR="${PG_MAJOR:-17}"
APP_USER="${APP_USER:-ubuntu}"
LOCAL_ROLE="${LOCAL_ROLE:-episode_dev}"
LOCAL_DB="${LOCAL_DB:-episode_metadata}"
CRED_DIR="/home/${APP_USER}/.config/episode-dev"
CRED_FILE="${CRED_DIR}/local-db.env"

step() { echo "== $*"; }

[ "$(id -u)" -eq 0 ] || { echo "must run as root" >&2; exit 1; }
. /etc/os-release

step "PGDG apt source (${VERSION_CODENAME}-pgdg)"
KEY=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
if [ ! -s "$KEY" ]; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsS --max-time 60 -o "$KEY" https://www.postgresql.org/media/keys/ACCC4CF8.asc
fi
echo "deb [signed-by=${KEY}] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list
gpg --show-keys --with-colons "$KEY" 2>/dev/null | awk -F: '$1=="fpr"{print "key fingerprint:", $10; exit}'

step "apt-get update + install postgresql-${PG_MAJOR}"
export DEBIAN_FRONTEND=noninteractive
timeout 300 apt-get -o Acquire::Retries=3 update -qq
timeout 600 apt-get install -y -qq "postgresql-${PG_MAJOR}" "postgresql-client-${PG_MAJOR}" >/dev/null
apt-get clean

step "cluster config (localhost only, sized for a 2 GB box)"
CONF_DIR="/etc/postgresql/${PG_MAJOR}/main/conf.d"
install -d "$CONF_DIR"
cat > "${CONF_DIR}/10-dev-box.conf" <<EOF
# Managed by scripts/dev-db/install-local-postgres.sh
listen_addresses = 'localhost'
port = 5432
max_connections = 30
shared_buffers = 128MB
effective_cache_size = 512MB
work_mem = 4MB
maintenance_work_mem = 64MB
EOF
systemctl enable --now "postgresql@${PG_MAJOR}-main" >/dev/null 2>&1 || systemctl enable --now postgresql >/dev/null
systemctl restart "postgresql@${PG_MAJOR}-main"
for _ in $(seq 1 30); do pg_isready -q -h 127.0.0.1 -p 5432 && break; sleep 1; done
pg_isready -h 127.0.0.1 -p 5432

step "local role ${LOCAL_ROLE} and credential file"
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "$CRED_DIR"
if [ ! -s "$CRED_FILE" ]; then
  PW="$(openssl rand -hex 24)"
  umask 077
  printf 'LOCAL_DB_HOST=127.0.0.1\nLOCAL_DB_PORT=5432\nLOCAL_DB_NAME=%s\nLOCAL_DB_USER=%s\nLOCAL_DB_PASSWORD=%s\n' \
    "$LOCAL_DB" "$LOCAL_ROLE" "$PW" > "$CRED_FILE"
  chown "$APP_USER:$APP_USER" "$CRED_FILE"; chmod 600 "$CRED_FILE"
fi
PW="$(sed -n 's/^LOCAL_DB_PASSWORD=//p' "$CRED_FILE")"
# The password goes to psql on stdin as a psql variable, never on a command line.
sudo -u postgres psql -v ON_ERROR_STOP=1 -q -v role="$LOCAL_ROLE" -v pw="$PW" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN', :'role') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role') \gexec
ALTER ROLE :"role" WITH LOGIN NOSUPERUSER CREATEDB PASSWORD :'pw';
SQL
unset PW
ls -l "$CRED_FILE" | awk '{print "cred file:", $1, $3, $NF}'

step "verify"
sudo -u postgres psql -Atqc "select 'server_version=' || current_setting('server_version')"
ss -ltnp | awk 'NR==1 || /:5432 /'

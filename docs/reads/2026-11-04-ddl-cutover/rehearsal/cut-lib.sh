# Local rehearsal only (never on the box). Paths are the rehearsal machine's: /tmp/wt-main = origin/main,
# /tmp/wt-combo = main + #3709 + #3711 merged locally, /tmp/wt-ddl = the #3711 branch.
# Cutover rehearsal library. Production-equivalent stand-ins:
#   cut_mig = postgres (non-superuser, CREATEROLE, owns the database and every table)
#   cut_app = episode_app_dev (CREATE on public, default privileges arwd/rU, owns brain_documents)
#   cut_ro  = prime_readonly (NOINHERIT, SELECT via default privileges)
export PGPASSWORD=postgres PGHOST=localhost PGPORT=5432
C=/tmp/wt-ddl/docs/reads/2026-11-04-ddl-cutover
OLD=/tmp/wt-main; NEW=/tmp/wt-combo
V="-v mig_role=cut_mig -v app_role=cut_app -v ro_role=cut_ro"
as_su()  { psql -X -q -U postgres -d "$1" "${@:2}"; }
as_mig() { PGPASSWORD=x psql -X -U cut_mig -d "$1" $V "${@:2}"; }
as_app() { PGPASSWORD=x psql -X -U cut_app -d "$1" $V "${@:2}"; }
as_ro()  { PGPASSWORD=x psql -X -U cut_ro  -d "$1" $V "${@:2}"; }
menv()   { echo "PATH=$PATH HOME=/tmp NODE_ENV=production DB_SSL=false DB_HOST=localhost DB_PORT=5432 DB_NAME=$1 DB_USER=cut_mig DB_PASSWORD=x"; }
# The Deploy migrate phase, as phase_migrate runs it (trust check, then db:migrate, same PGOPTIONS).
deploy_migrate() {
  local db=$1 tree=${2:-$NEW} pg="-c lock_timeout=30s -c search_path=public"
  echo "-- trust check"
  (cd $tree && env -i $(menv $db) PGOPTIONS="$pg" node scripts/deploy/migration-trust-check.js --config src/config/sequelize.js 2>&1 | grep migration-trust)
  local rc=${PIPESTATUS[0]}
  if ! (cd $tree && env -i $(menv $db) PGOPTIONS="$pg" node scripts/deploy/migration-trust-check.js --config src/config/sequelize.js >/dev/null 2>&1); then echo "-- trust check refused: db:migrate NOT run (phase_migrate dies here)"; return 1; fi
  echo "-- db:migrate"
  local out rc
  out=$(cd $tree && env -i $(menv $db) PGOPTIONS="$pg" node_modules/.bin/sequelize-cli db:migrate --config src/config/sequelize.js --migrations-path src/migrations 2>&1); rc=$?
  printf '%s\n' "$out" | grep -E "migrat|ERROR" | grep -v "^Loaded\|Using env"
  echo "-- db:migrate exit $rc"
  return $rc
}
probe() { # probe <db> <old|new>
  local tree=$OLD; [ "$2" = new ] && tree=$NEW
  (cd $tree && DATABASE_URL=postgresql://cut_app:x@localhost:5432/$1 timeout 90 node $(dirname "${BASH_SOURCE[0]}")/cut-probe.js $tree 2>/dev/null | sed "s/^/   [$2 code] /")
}
fingerprint() { # every table in public: rows, and an md5 of the data
  as_su "$1" -At -c "SELECT string_agg(c.relname || '=' || (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM public.%I', c.relname), false, true, '')))[1]::text, ' ' ORDER BY c.relname) FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relname IN ('brain_documents','continuity_timelines','continuity_characters','ecosystem_previews','video_compositions','chapter_versions','shows','episodes','franchise_knowledge','generation_jobs','data_correction_log')"
}
state() { # owners and privileges that matter
  as_su "$1" -At -c "SELECT 'brain_documents=' || COALESCE((SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = to_regclass('public.brain_documents')), 'absent')
    || ' chapter_versions=' || COALESCE((SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = to_regclass('public.chapter_versions')), 'absent')
    || ' data_correction_log=' || COALESCE((SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = to_regclass('public.data_correction_log')), 'absent')
    || ' app_create_public=' || has_schema_privilege('cut_app', 'public', 'CREATE')
    || ' recorded=' || COALESCE((SELECT string_agg(left(name, 14), ',' ORDER BY name) FROM \"SequelizeMeta\" WHERE name LIKE '20261104%'), 'none')"
}
newdb() { as_su postgres -c "DROP DATABASE IF EXISTS $1 WITH (FORCE)" -c "CREATE DATABASE $1 TEMPLATE cut_base OWNER cut_mig" 2>&1 | grep -v NOTICE; }

. $(dirname "${BASH_SOURCE[0]}")/cut-lib.sh
as_su postgres <<'SQL' 2>&1 | grep -v NOTICE
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname LIKE 'cut_%' OR datname LIKE 'sc_%';
SQL
for d in $(as_su postgres -At -c "SELECT datname FROM pg_database WHERE datname LIKE 'cut_%' OR datname LIKE 'sc_%'"); do as_su postgres -c "DROP DATABASE $d WITH (FORCE)"; done
for r in cut_app cut_ro cut_mig; do as_su postgres -c "DROP ROLE IF EXISTS $r" 2>&1 | grep -v NOTICE; done
as_su postgres -c "CREATE ROLE cut_mig LOGIN CREATEROLE CREATEDB PASSWORD 'x'" -c "CREATE ROLE cut_app LOGIN PASSWORD 'x'" -c "CREATE ROLE cut_ro LOGIN NOINHERIT PASSWORD 'x'" -c "CREATE DATABASE cut_base OWNER cut_mig"
as_su cut_base -c "REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE, CREATE ON SCHEMA public TO cut_app; GRANT USAGE ON SCHEMA public TO cut_ro;"
as_mig cut_base -q <<'SQL'
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cut_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO cut_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO cut_app;
SQL
echo "main's migrations as the migration role: $(cd $OLD && env -i $(menv cut_base) PGOPTIONS='-c search_path=public' node_modules/.bin/sequelize-cli db:migrate --config src/config/sequelize.js --migrations-path src/migrations 2>&1 | grep -c ': migrated') (errors: $(cd $OLD && true))"
# Production-only tables, with production's definitions (owned by the migration role, as in production).
(cd /tmp/wt-ddl && env -i $(menv cut_base) node -e "
const { Sequelize } = require('sequelize'); const m = require('./src/migrations/20261104200000-create-runtime-created-tables.js');
const s = new Sequelize('cut_base', 'cut_mig', 'x', { host: 'localhost', dialect: 'postgres', logging: false });
(async () => { for (const [t, sql] of m.TABLES) if (!['chapter_versions', 'brain_documents'].includes(t)) await s.query(sql);
  for (const [, t, sql] of m.INDEXES) await s.query(sql.replace('CREATE INDEX', 'CREATE INDEX IF NOT EXISTS').replace('CREATE UNIQUE INDEX', 'CREATE UNIQUE INDEX IF NOT EXISTS')); await s.close(); })().catch((e) => { console.error('ERR', e.message); process.exit(1); });")
# brain_documents as production has it: created by the application role, empty, prime_readonly SELECT.
as_mig cut_base -q -c "DROP TABLE public.brain_documents"
as_app cut_base -q -c "CREATE TABLE public.brain_documents (id SERIAL PRIMARY KEY, source_name VARCHAR(300) NOT NULL, document_text TEXT NOT NULL, entries_created INTEGER DEFAULT 0, ingested_by VARCHAR(100) DEFAULT 'manual', ingested_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ); GRANT SELECT ON public.brain_documents TO cut_ro;"
# Some legitimate data that must survive every path.
as_app cut_base -q <<'SQL'
INSERT INTO public.continuity_timelines (title) VALUES ('Season 1 timeline');
INSERT INTO public.continuity_characters (timeline_id, character_key, name) SELECT id, 'lala', 'Lala' FROM public.continuity_timelines;
INSERT INTO public.ecosystem_previews (preview_id, characters) VALUES ('pv-1', '[{"name":"x"}]');
SQL
echo "base state:  $(state cut_base)"
echo "base data:   $(fingerprint cut_base)"
echo "trust check on the base (production now):"; deploy_migrate cut_base >/dev/null; (cd $NEW && env -i $(menv cut_base) PGOPTIONS='-c search_path=public' node scripts/deploy/migration-trust-check.js --config src/config/sequelize.js 2>&1 | grep migration-trust)

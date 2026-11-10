#!/usr/bin/env node
// scripts/diagnostics/db-check.js — the database half of the Diagnostics
// workflow (F-Tools-2, 2026-10-29). Runs on the production box only, called by
// on-box.sh, as the read-only database role prime_readonly.
//
// Every statement is fixed in this file: there is no way to pass SQL in. The
// connection host, port, database and SSL setting come from the app's .env
// (the same DB_* names src/config/sequelize.js reads in production); the user
// and password come from ~/.episode-readonly.env, a mode-600 file Evoni
// creates. Neither the password nor any row of personal data is printed: the
// checks report counts, names of tables and migrations, and PASS/FAIL lines.
//
// snapshot (F-Tools-2 Amendment 1, 2026-10-31; Task #3659): the daily database
// snapshot, for the scheduled run only. Every table's columns (type, null,
// default) and indexes, an exact count for every table, and the latest rows
// of an allowlisted set of content tables (SAMPLE_TABLES), with denylisted
// columns dropped and every value bounded. Table and column names come from
// the catalog and pass ident(); nothing comes from input.
//
// season-integrity (Gate 2, docs/design/2026-11-season-planning.md §8): Season
// Planning counts in three classes (integrity violations, protected records,
// planning conditions), from one read-only transaction that is rolled back.
// Dispatch only; never scheduled. COMPLETE needs every metric and the
// rollback to succeed, and the report ends with an END line.
//
// Usage: node db-check.js <db|db-schema|db-counts|self-test|snapshot|season-integrity>
// Needs: APP_DIR (default /home/ubuntu/episode-metadata), HOME.
// Exit: 0 ok; 1 a check failed; 2 bad usage or missing configuration.

'use strict';

const fs = require('fs');
const path = require('path');

const APP_DIR = process.env.APP_DIR || '/home/ubuntu/episode-metadata';
const RO_ENV = process.env.RO_ENV || path.join(process.env.HOME || '/home/ubuntu', '.episode-readonly.env');
const MODES = ['db', 'db-schema', 'db-counts', 'self-test', 'snapshot', 'season-integrity'];

// Exact counts for the tables a production question usually turns on. Missing
// tables are reported as missing, not as errors.
const COUNT_TABLES = [
  'shows', 'episodes', 'episode_briefs', 'episode_scripts', 'raw_footage',
  'assets', 'wardrobe', 'episode_wardrobe', 'scene_sets', 'scene_angles',
  'registry_characters', 'world_events', 'career_goals', 'season_slots',
  'ai_usage_logs', 'feed_posts', 'users',
];

// ── The snapshot's sampling rules (F-Tools-2 Amendment 1 §3) ───────────────
// §3.1: rows are read only from these content tables. A table not listed is
// never sampled, including one added to the database later.
const SAMPLE_TABLES = [
  'shows', 'show_configs', 'episodes', 'episode_briefs', 'characters', 'character_registries',
  'registry_characters', 'world_characters', 'universes', 'book_series', 'social_profiles',
  'feed_posts', 'world_events', 'world_locations', 'scene_sets', 'scene_angles', 'wardrobe',
  'wardrobe_library', 'lalaverse_brands', 'phone_missions',
];
// §3.2: never sampled, whatever the list says (a test keeps SAMPLE_TABLES clear of these).
const NEVER_TABLES = [
  /(^|_)(users?|accounts?|roles?|permissions?|auth\w*|sessions?|tokens?)(_|$)/,
  /^(storyteller|therapy|brain|writing)_/, /^character_therapy_profiles$/, /^author_notes$/,
  /^pulse_dm_/, /^social_media_imports$/, /^ai_/, /^activity_logs$/, /^user_decisions$/,
  /^(assets|raw_footage|media_asset_sources|audio_clips)$/,
];
// §3.3: a column is dropped if any part of its name (split on _ and on
// lower-to-upper case changes) is one of these, or begins with one of the prefixes.
const DROP_PARTS = new Set(['password', 'passwd', 'pwd', 'pass', 'secret', 'token', 'hash', 'salt', 'api', 'private',
  'auth', 'session', 'cookie', 'otp', 'mfa', 'email', 'phone', 'mobile', 'address', 'ip', 'ssn', 'dob', 'birthdate',
  'birthday', 'url', 'uri', 'link', 'href', 'path', 's3', 'bucket', 'signed', 'credential', 'credentials', 'cognito',
  'sub', 'user', 'owner']);
const DROP_PREFIXES = ['passw', 'secret', 'token', 'credential'];
const SAMPLE_ROWS = 20;
const VALUE_MAX = 200;
const SAMPLES_MAX_BYTES = 200 * 1024;

/** A catalog name, checked before it goes into SQL; anything else is refused. */
function ident(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(String(name))) throw new Error(`refused identifier: ${String(name).slice(0, 40)}`);
  return `"${name}"`;
}

const isNeverTable = (t) => NEVER_TABLES.some((re) => re.test(t));

/** §3.3: true when the column must not reach the snapshot. */
function dropColumn(name, dataType = '') {
  if (String(dataType).toLowerCase() === 'bytea') return true;
  const parts = String(name).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[_\W]+/).filter(Boolean);
  return parts.some((p) => DROP_PARTS.has(p) || DROP_PREFIXES.some((x) => p.startsWith(x)));
}

/** §3.4: a value as at most VALUE_MAX characters; objects as JSON. */
function boundValue(v) {
  if (v === null || v === undefined) return 'null';
  if (Buffer.isBuffer(v)) return '[binary]';
  const text = v instanceof Date ? v.toISOString() : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  const flat = text.replace(/\s+/g, ' ');
  return flat.length > VALUE_MAX ? `${flat.slice(0, VALUE_MAX)}…[cut]` : flat;
}

/** "unique, btree (a, b)" from a pg_indexes definition: uniqueness, method and columns. */
function indexSummary(def) {
  const d = String(def || '');
  const using = /\bUSING\s+(.*)$/i.exec(d);
  return `${/^CREATE UNIQUE INDEX/i.test(d) ? 'unique' : 'not unique'}, ${boundValue(using ? using[1] : d)}`;
}

/**
 * How many rows of each sampled table fit under the cap, newest first (Task #3659).
 * sizes[i] is table i's row sizes in bytes. The next row always goes to the
 * table that has used the fewest bytes so far (ties: list order), while it
 * fits; a table whose next row does not fit stops. So every table gets its
 * newest row before any table gets a second, the cap is shared as evenly as
 * the row sizes allow, and the total never exceeds the cap: a very wide table
 * neither crowds out the rest nor is crowded out itself.
 */
function allocateSamples(sizes, cap) {
  const shown = sizes.map(() => 0);
  const mine = sizes.map(() => 0);
  const open = sizes.map((rows) => rows.length > 0);
  let used = 0;
  for (;;) {
    let i = -1;
    open.forEach((o, k) => { if (o && (i < 0 || mine[k] < mine[i])) i = k; });
    if (i < 0) return shown;
    const next = sizes[i][shown[i]];
    if (used + next > cap) { open[i] = false; continue; }
    used += next;
    mine[i] += next;
    shown[i] += 1;
    if (shown[i] >= sizes[i].length) open[i] = false;
  }
}

const countSql = (table) => `SELECT count(*)::bigint AS n FROM public.${ident(table)}`;

/** The latest rows of one sampled table: kept columns only, newest first, not soft-deleted. */
function sampleSql(table, columns, { orderBy, paranoid }) {
  if (!SAMPLE_TABLES.includes(table) || isNeverTable(table)) throw new Error(`not a sampled table: ${table}`);
  const cols = columns.map(ident).join(', ');
  const where = paranoid ? ' WHERE "deleted_at" IS NULL' : '';
  const order = orderBy ? ` ORDER BY ${ident(orderBy)} DESC NULLS LAST` : '';
  return `SELECT ${cols} FROM public.${ident(table)}${where}${order} LIMIT ${SAMPLE_ROWS}`;
}

/** Parses KEY=value lines; ignores comments and blank lines; strips matching quotes. */
function parseEnvFile(text) {
  const out = {};
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

/** The connection settings: host and database from the app's .env, user and password from the read-only file. */
function connectionConfig({ appEnv, roEnv }) {
  const host = appEnv.DB_HOST;
  const database = appEnv.DB_NAME || appEnv.DB_DATABASE;
  if (!host || !database) throw new Error('DB_HOST or DB_NAME is not set in the app .env');
  if (!roEnv.DB_USER || !roEnv.DB_PASSWORD) throw new Error(`DB_USER or DB_PASSWORD is missing from ${RO_ENV}`);
  return {
    host,
    port: parseInt(appEnv.DB_PORT || '5432', 10),
    database,
    user: roEnv.DB_USER,
    password: roEnv.DB_PASSWORD,
    ssl: appEnv.DB_SSL === 'false' ? false : { rejectUnauthorized: appEnv.DB_SSL_REJECT_UNAUTHORIZED === 'true' },
    application_name: 'prime-diagnostics',
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
    query_timeout: 35000,
  };
}

function loadPg() {
  // The script runs from a temporary copy, so resolve pg from the app's install.
  return require(require.resolve('pg', { paths: [APP_DIR] }));
}

async function checkDb(client, say) {
  const t0 = Date.now();
  const r = await client.query(
    "SELECT current_user AS who, current_setting('transaction_read_only') AS ro, "
    + "current_setting('server_version') AS version, pg_size_pretty(pg_database_size(current_database())) AS size, "
    + '(SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::int AS connections',
  );
  const row = r.rows[0];
  say(`connected: yes (${Date.now() - t0} ms round trip)`);
  say(`user: ${row.who}; read-only session: ${row.ro}`);
  say(`server: PostgreSQL ${row.version}; database size: ${row.size}; open connections: ${row.connections}`);
  const applied = await client.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
  const appliedSet = new Set(applied.rows.map((x) => x.name));
  const dir = path.join(APP_DIR, 'src', 'migrations');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort() : [];
  const pending = files.filter((f) => !appliedSet.has(f));
  say(`migrations: ${appliedSet.size} applied; ${files.length} files in the deployed tree; ${pending.length} pending`);
  for (const f of pending.slice(0, 20)) say(`  pending: ${f}`);
  for (const f of applied.rows.slice(-3)) say(`  latest applied: ${f.name}`);
  return true;
}

async function checkSchema(client, say) {
  const r = await client.query(
    'SELECT c.table_name, count(*)::int AS columns, '
    + "bool_or(c.column_name = 'deleted_at') AS paranoid "
    + 'FROM information_schema.columns c '
    + "WHERE c.table_schema = 'public' GROUP BY c.table_name ORDER BY c.table_name",
  );
  say(`tables in public: ${r.rows.length}`);
  for (const t of r.rows) say(`  ${t.table_name}: ${t.columns} columns${t.paranoid ? '' : ' (no deleted_at)'}`);
  return true;
}

async function checkCounts(client, say) {
  say('exact counts:');
  for (const t of COUNT_TABLES) {
    const exists = await client.query('SELECT to_regclass($1) IS NOT NULL AS ok', [`public.${t}`]);
    if (!exists.rows[0].ok) { say(`  ${t}: (no such table)`); continue; }
    // The name is from the fixed list above, never from input.
    const c = await client.query(countSql(t));
    say(`  ${t}: ${c.rows[0].n}`);
  }
  const est = await client.query(
    'SELECT relname, n_live_tup::bigint AS n FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 25',
  );
  say('largest tables (estimated rows):');
  for (const t of est.rows) say(`  ${t.relname}: ~${t.n}`);
  return true;
}

/** Expects the statement to fail with one of the given SQLSTATE codes. */
async function expectRefused(client, say, label, sql, codes) {
  try {
    await client.query(sql);
    say(`FAIL ${label}: the statement succeeded`);
    return false;
  } catch (err) {
    if (codes.includes(err.code)) { say(`PASS ${label}: refused (${err.code})`); return true; }
    say(`FAIL ${label}: unexpected error ${err.code || 'unknown'}`);
    return false;
  } finally {
    // A failed statement inside a transaction would poison the next one.
    await client.query('ROLLBACK').catch((e) => say(`note: rollback after ${label}: ${e.code || 'error'}`));
  }
}

async function selfTest(client, say) {
  let ok = true;
  const who = await client.query("SELECT current_user AS who, current_setting('transaction_read_only') AS ro, "
    + '(SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS super');
  const { who: user, ro, super: isSuper } = who.rows[0];
  if (user === 'prime_readonly') say('PASS connected as prime_readonly'); else { say(`FAIL connected as ${user}, not prime_readonly`); ok = false; }
  if (ro === 'on') say('PASS the session defaults to read-only'); else { say('FAIL the session is not read-only by default'); ok = false; }
  if (isSuper === false) say('PASS not a superuser'); else { say('FAIL the role is a superuser'); ok = false; }
  const sel = await client.query('SELECT count(*)::int AS n FROM "SequelizeMeta"');
  say(`PASS a read works (${sel.rows[0].n} migration rows)`);
  // 25006 = read_only_sql_transaction; 42501 = insufficient_privilege.
  ok = await expectRefused(client, say, 'create a table in the default session', 'CREATE TEMP TABLE diag_selftest(i int)', ['25006', '42501']) && ok;
  // With the read-only default switched off, the grants alone must still refuse writes.
  ok = await expectRefused(client, say, 'update with read-only switched off',
    'BEGIN READ WRITE; UPDATE "SequelizeMeta" SET name = name WHERE false', ['42501']) && ok;
  ok = await expectRefused(client, say, 'insert with read-only switched off',
    'BEGIN READ WRITE; INSERT INTO "SequelizeMeta"(name) SELECT \'diag-selftest\' WHERE false', ['42501']) && ok;
  ok = await expectRefused(client, say, 'delete with read-only switched off',
    'BEGIN READ WRITE; DELETE FROM "SequelizeMeta" WHERE false', ['42501']) && ok;
  ok = await expectRefused(client, say, 'read a server file', "SELECT pg_read_file('/etc/hostname')", ['42501']) && ok;
  return ok;
}

// ── season-integrity (Gate 2; docs/design/2026-11-season-planning.md §8 item 2) ──
// Counts only. Every statement is a fixed string in SEASON_METRICS; nothing
// comes from input. Each metric has one class, set here and never inferred
// from its value:
//   A  integrity violations: a non-zero count is a defect. `a2: true` marks
//      the P1, P2, P3 and P6 counts the A2 migration needs at 0 (§8 item 3).
//   B  protected records: valid states Move/Swap or intention sync must
//      refuse or preserve. Counts, not defects.
//   C  planning conditions: informational.
// "Live" means deleted_at IS NULL. Filmed means any episode_raw_clips row,
// soft-deleted rows included (src/utils/snapshotFreeze.js).
const SEASON_METRICS = Object.freeze([
  { id: 'A1', cls: 'A', a2: true, name: 'weekly_episode_in_multiple_slots',
    sql: 'SELECT count(*) AS n FROM (SELECT episode_id FROM season_slots WHERE deleted_at IS NULL AND episode_id IS NOT NULL '
      + 'GROUP BY episode_id HAVING count(*) > 1) d' },
  { id: 'A2', cls: 'A', a2: true, name: 'weekly_episode_also_special',
    sql: 'SELECT count(DISTINCT s.episode_id) AS n FROM season_slots s JOIN season_specials sp ON sp.episode_id = s.episode_id '
      + "AND sp.deleted_at IS NULL AND sp.kind IN ('bonus', 'special') WHERE s.deleted_at IS NULL" },
  { id: 'A3', cls: 'A', a2: true, name: 'slot_episode_missing_or_deleted',
    sql: 'SELECT count(*) AS n FROM season_slots s LEFT JOIN episodes e ON e.id = s.episode_id AND e.deleted_at IS NULL '
      + 'WHERE s.deleted_at IS NULL AND s.episode_id IS NOT NULL AND e.id IS NULL' },
  { id: 'A4', cls: 'A', a2: true, name: 'slot_locked_without_episode',
    sql: 'SELECT count(*) AS n FROM season_slots WHERE deleted_at IS NULL AND locked_at IS NOT NULL AND episode_id IS NULL' },
  { id: 'A5', cls: 'A', a2: true, name: 'slot_accepted_without_episode',
    sql: 'SELECT count(*) AS n FROM season_slots WHERE deleted_at IS NULL AND accepted_at IS NOT NULL AND episode_id IS NULL' },
  { id: 'A6', cls: 'A', a2: false, name: 'special_episode_missing_or_deleted',
    sql: 'SELECT count(*) AS n FROM season_specials sp LEFT JOIN episodes e ON e.id = sp.episode_id AND e.deleted_at IS NULL '
      + "WHERE sp.deleted_at IS NULL AND sp.kind IN ('bonus', 'special') AND sp.episode_id IS NOT NULL AND e.id IS NULL" },
  { id: 'A7', cls: 'A', a2: false, name: 'special_locked_without_episode',
    sql: "SELECT count(*) AS n FROM season_specials WHERE deleted_at IS NULL AND kind IN ('bonus', 'special') "
      + 'AND locked_at IS NOT NULL AND episode_id IS NULL' },
  { id: 'A8', cls: 'A', a2: false, name: 'special_accepted_without_episode',
    sql: "SELECT count(*) AS n FROM season_specials WHERE deleted_at IS NULL AND kind IN ('bonus', 'special') "
      + 'AND accepted_at IS NOT NULL AND episode_id IS NULL' },
  { id: 'A9', cls: 'A', a2: false, name: 'two_part_slot_link_missing_or_deleted',
    sql: 'SELECT count(*) AS n FROM season_specials tp '
      + 'LEFT JOIN season_slots one ON one.id = tp.part_one_slot_id AND one.deleted_at IS NULL AND one.arc_id = tp.arc_id '
      + 'LEFT JOIN season_slots two ON two.id = tp.part_two_slot_id AND two.deleted_at IS NULL AND two.arc_id = tp.arc_id '
      + "WHERE tp.deleted_at IS NULL AND tp.kind = 'two_part' AND (one.id IS NULL OR two.id IS NULL)" },
  { id: 'A10', cls: 'A', a2: true, name: 'arc_slot_count_not_24',
    sql: 'SELECT count(*) AS n FROM (SELECT s.arc_id FROM season_slots s JOIN show_arcs a ON a.id = s.arc_id AND a.deleted_at IS NULL '
      + 'WHERE s.deleted_at IS NULL GROUP BY s.arc_id HAVING count(*) <> 24) d' },
  { id: 'A11', cls: 'A', a2: true, name: 'slot_number_out_of_range',
    sql: 'SELECT count(*) AS n FROM season_slots WHERE deleted_at IS NULL AND (slot_number < 1 OR slot_number > 24)' },
  { id: 'A12', cls: 'A', a2: true, name: 'duplicate_live_slot_number',
    sql: 'SELECT count(*) AS n FROM (SELECT arc_id, slot_number FROM season_slots WHERE deleted_at IS NULL '
      + 'GROUP BY arc_id, slot_number HAVING count(*) > 1) d' },
  { id: 'A13', cls: 'A', a2: true, name: 'slot_season_number_mismatch',
    sql: 'SELECT count(*) AS n FROM season_slots s JOIN show_arcs a ON a.id = s.arc_id AND a.deleted_at IS NULL '
      + 'WHERE s.deleted_at IS NULL AND s.season_number <> COALESCE(a.season_number, 1)' },
  // A two-parter writes its event to both of its slots (seasonSpecials.js,
  // the part-two pencil), so that one pair is not a duplicate.
  { id: 'A14', cls: 'A', a2: false, name: 'event_in_two_live_slots_of_arc',
    sql: 'SELECT count(*) AS n FROM season_slots s1 JOIN season_slots s2 ON s2.arc_id = s1.arc_id AND s2.event_id = s1.event_id '
      + 'AND s2.id > s1.id AND s2.deleted_at IS NULL WHERE s1.deleted_at IS NULL AND s1.event_id IS NOT NULL '
      + "AND NOT EXISTS (SELECT 1 FROM season_specials tp WHERE tp.deleted_at IS NULL AND tp.kind = 'two_part' "
      + 'AND ((tp.part_one_slot_id = s1.id AND tp.part_two_slot_id = s2.id) OR (tp.part_one_slot_id = s2.id AND tp.part_two_slot_id = s1.id)))' },
  { id: 'A15', cls: 'A', a2: false, name: 'slot_event_differs_from_brief_event',
    sql: 'SELECT count(*) AS n FROM season_slots s JOIN episode_briefs b ON b.episode_id = s.episode_id AND b.deleted_at IS NULL '
      + 'WHERE s.deleted_at IS NULL AND s.event_id IS NOT NULL AND b.event_id IS NOT NULL AND s.event_id <> b.event_id' },

  { id: 'B1', cls: 'B', name: 'placed_episode_filmed',
    sql: 'SELECT count(DISTINCT s.episode_id) AS n FROM season_slots s WHERE s.deleted_at IS NULL AND s.episode_id IS NOT NULL '
      + 'AND EXISTS (SELECT 1 FROM episode_raw_clips r WHERE r.episode_id = s.episode_id)' },
  { id: 'B2', cls: 'B', name: 'placed_slot_accepted',
    sql: 'SELECT count(*) AS n FROM season_slots WHERE deleted_at IS NULL AND episode_id IS NOT NULL AND accepted_at IS NOT NULL' },
  { id: 'B3', cls: 'B', name: 'placed_episode_published',
    sql: 'SELECT count(DISTINCT s.episode_id) AS n FROM season_slots s JOIN episodes e ON e.id = s.episode_id AND e.deleted_at IS NULL '
      + "WHERE s.deleted_at IS NULL AND e.status::text = 'published'" },
  { id: 'B4', cls: 'B', name: 'placed_episode_has_air_date',
    sql: 'SELECT count(DISTINCT s.episode_id) AS n FROM season_slots s JOIN episodes e ON e.id = s.episode_id AND e.deleted_at IS NULL '
      + 'WHERE s.deleted_at IS NULL AND e.air_date IS NOT NULL' },
  { id: 'B5', cls: 'B', name: 'two_part_protected',
    sql: 'SELECT count(*) AS n FROM season_specials tp '
      + 'JOIN season_slots one ON one.id = tp.part_one_slot_id AND one.deleted_at IS NULL '
      + 'JOIN season_slots two ON two.id = tp.part_two_slot_id AND two.deleted_at IS NULL '
      + "WHERE tp.deleted_at IS NULL AND tp.kind = 'two_part' "
      + 'AND (one.episode_id IS NOT NULL OR one.locked_at IS NOT NULL OR two.episode_id IS NOT NULL OR two.locked_at IS NOT NULL)' },
  { id: 'B6', cls: 'B', name: 'slotted_brief_locked',
    sql: 'SELECT count(DISTINCT s.episode_id) AS n FROM season_slots s JOIN episode_briefs b ON b.episode_id = s.episode_id '
      + "AND b.deleted_at IS NULL WHERE s.deleted_at IS NULL AND b.status::text = 'locked'" },

  { id: 'C1', cls: 'C', name: 'shows_with_multiple_active_arcs',
    sql: "SELECT count(*) AS n FROM (SELECT show_id FROM show_arcs WHERE deleted_at IS NULL AND status = 'active' "
      + 'GROUP BY show_id HAVING count(*) > 1) d' },
  // season_context is never cleared when a slot is released; a special's
  // episode has one too, so only episodes in neither table are counted.
  { id: 'C2', cls: 'C', name: 'season_context_without_live_slot',
    sql: 'SELECT count(*) AS n FROM episodes e WHERE e.deleted_at IS NULL AND e.season_context IS NOT NULL '
      + 'AND NOT EXISTS (SELECT 1 FROM season_slots s WHERE s.episode_id = e.id AND s.deleted_at IS NULL) '
      + 'AND NOT EXISTS (SELECT 1 FROM season_specials sp WHERE sp.episode_id = e.id AND sp.deleted_at IS NULL)' },
  { id: 'C3', cls: 'C', name: 'empty_slot_pencilled',
    sql: 'SELECT count(*) AS n FROM season_slots WHERE deleted_at IS NULL AND episode_id IS NULL AND event_id IS NOT NULL' },
  { id: 'C4', cls: 'C', name: 'empty_slot_pencil_event_used_by_episode',
    sql: 'SELECT count(*) AS n FROM season_slots s JOIN world_events w ON w.id = s.event_id AND w.deleted_at IS NULL '
      + 'WHERE s.deleted_at IS NULL AND s.episode_id IS NULL AND w.used_in_episode_id IS NOT NULL' },
  { id: 'C5', cls: 'C', name: 'episode_air_date_outside_weekly_slot',
    sql: 'SELECT count(*) AS n FROM episodes e WHERE e.deleted_at IS NULL AND e.air_date IS NOT NULL '
      + 'AND NOT EXISTS (SELECT 1 FROM season_slots s WHERE s.episode_id = e.id AND s.deleted_at IS NULL)' },
  { id: 'C6', cls: 'C', name: 'intention_source', fields: ['auto_drafted', 'edited', 'unset', 'other'],
    sql: "SELECT count(*) FILTER (WHERE intention_source = 'auto-drafted') AS auto_drafted, "
      + "count(*) FILTER (WHERE intention_source = 'edited') AS edited, count(*) FILTER (WHERE intention_source IS NULL) AS unset, "
      + "count(*) FILTER (WHERE intention_source NOT IN ('auto-drafted', 'edited')) AS other FROM season_slots WHERE deleted_at IS NULL" },
  // The statement depends on air_date's type, read in the same transaction.
  { id: 'C7', cls: 'C', name: 'air_date_not_utc_midnight',
    probe: 'SELECT data_type AS v FROM information_schema.columns '
      + "WHERE table_schema = current_schema() AND table_name = 'episodes' AND column_name = 'air_date'",
    variants: {
      'timestamp with time zone': "SELECT count(*) AS n FROM episodes WHERE deleted_at IS NULL AND air_date IS NOT NULL AND (air_date AT TIME ZONE 'UTC')::time <> '00:00'",
      'timestamp without time zone': "SELECT count(*) AS n FROM episodes WHERE deleted_at IS NULL AND air_date IS NOT NULL AND air_date::time <> '00:00'",
      date: null,
    } },
  { id: 'C8', cls: 'C', name: 'server_default_timezone', text: 'tz', suffix: ' (app sessions set their own)',
    sql: "SELECT current_setting('TimeZone') AS tz" },
  { id: 'C9', cls: 'C', name: 'activity_logs_by_age', fields: ['last_1d', 'last_7d', 'last_30d', 'older', 'unset'],
    probe: 'SELECT column_name AS v FROM information_schema.columns WHERE table_schema = current_schema() '
      + "AND table_name = 'activity_logs' AND column_name IN ('timestamp', 'created_at') ORDER BY column_name DESC LIMIT 1",
    optional: true,
    variants: {
      timestamp: 'SELECT count(*) FILTER (WHERE "timestamp" >= now() - interval \'1 day\') AS last_1d, '
        + 'count(*) FILTER (WHERE "timestamp" >= now() - interval \'7 days\') AS last_7d, '
        + 'count(*) FILTER (WHERE "timestamp" >= now() - interval \'30 days\') AS last_30d, '
        + 'count(*) FILTER (WHERE "timestamp" < now() - interval \'30 days\') AS older, '
        + 'count(*) FILTER (WHERE "timestamp" IS NULL) AS unset FROM activity_logs',
      created_at: "SELECT count(*) FILTER (WHERE created_at >= now() - interval '1 day') AS last_1d, "
        + "count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS last_7d, "
        + "count(*) FILTER (WHERE created_at >= now() - interval '30 days') AS last_30d, "
        + "count(*) FILTER (WHERE created_at < now() - interval '30 days') AS older, "
        + 'count(*) FILTER (WHERE created_at IS NULL) AS unset FROM activity_logs',
    } },
  // Existing labels only; which labels the #1948 repair needs is not settled here.
  { id: 'C10', cls: 'C', name: 'activity_logs_enum_labels', labels: true,
    sql: 'SELECT a.attname AS col, string_agg(e.enumlabel, \',\' ORDER BY e.enumsortorder) AS labels '
      + 'FROM pg_attribute a JOIN pg_enum e ON e.enumtypid = a.atttypid '
      + "WHERE a.attrelid = to_regclass('activity_logs') AND a.attnum > 0 AND NOT a.attisdropped GROUP BY a.attname ORDER BY a.attname" },
]);
const SEASON_CLASSES = [
  ['A', 'Integrity violations (expected 0)'],
  ['B', 'Protected records (counts, not defects)'],
  ['C', 'Planning conditions (informational)'],
];
const SEASON_PREAMBLE = [
  'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
  "SET LOCAL statement_timeout = '10s'",
  "SET LOCAL lock_timeout = '2s'",
  "SET LOCAL idle_in_transaction_session_timeout = '15s'",
];
const SEASON_BUDGET_MS = 60000;

const COUNT_RE = /^\d{1,20}$/;
/** A server error carries a SQLSTATE; a client or socket error does not. */
function sqlState(err) {
  return err && typeof err.severity === 'string' && /^[0-9A-Z]{5}$/.test(String(err.code)) ? err.code : null;
}
class Broken extends Error {}

/** One metric's value as printed, or throws when the result is not what the metric defines. */
function seasonValue(m, rows) {
  const bad = (why) => { throw Object.assign(new Error(why), { malformed: true }); };
  if (m.labels) {
    if (!rows.length) return 'none';
    return rows.map((r) => {
      const labels = String(r.labels).split(',');
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(String(r.col)) || !labels.every((l) => /^[A-Za-z0-9_ .-]{1,63}$/.test(l))) bad('label');
      return `${r.col}=${labels.join(',')}`;
    }).join('; ');
  }
  if (rows.length !== 1) bad('rows');
  const row = rows[0];
  if (m.text) {
    const v = String(row[m.text]);
    if (!/^[A-Za-z0-9_+/:-]{1,64}$/.test(v)) bad('text');
    return `${v}${m.suffix || ''}`;
  }
  const fields = m.fields || ['n'];
  const vals = fields.map((f) => (row[f] === null || row[f] === undefined ? '' : String(row[f])));
  if (!vals.every((v) => COUNT_RE.test(v))) bad('count');
  return fields.length === 1 ? vals[0] : fields.map((f, i) => `${f}=${vals[i]}`).join(' ');
}

/**
 * The season-integrity report. Read-only: one REPEATABLE READ READ ONLY
 * transaction, rolled back. COMPLETE only when BEGIN, every metric and the
 * ROLLBACK succeed; anything else is INCOMPLETE and returns false (exit 1).
 * A client or socket error (no SQLSTATE) stops at once without another
 * statement: the connection's state is unknown, and main() closes it, which
 * ends the transaction on the server.
 */
async function checkSeasonIntegrity(client, say, { now = Date.now, budgetMs = SEASON_BUDGET_MS } = {}) {
  const t0 = now();
  const results = new Map();
  const reasons = [];
  let began = false;
  let broken = false;
  const run = async (sql) => {
    try {
      return await client.query(sql);
    } catch (err) {
      if (!sqlState(err)) { broken = true; throw new Broken(); }
      throw err;
    }
  };
  try {
    for (const sql of SEASON_PREAMBLE) {
      await run(sql);
      began = true;
    }
    for (const m of SEASON_METRICS) {
      if (now() - t0 > budgetMs) { reasons.push('time budget exceeded'); break; }
      await run('SAVEPOINT season_metric');
      try {
        let rows;
        let variantKey;
        if (m.probe) {
          const p = (await run(m.probe)).rows;
          if (!p.length && m.optional) {
            results.set(m.id, 'not applicable (no timestamp or created_at column)');
            await run('RELEASE SAVEPOINT season_metric');
            continue;
          }
          if (p.length !== 1) throw Object.assign(new Error('probe'), { malformed: true });
          variantKey = String(p[0].v);
          if (!Object.prototype.hasOwnProperty.call(m.variants, variantKey)) throw Object.assign(new Error('type'), { malformed: true });
          if (m.variants[variantKey] === null) {
            results.set(m.id, `not applicable (${variantKey})`);
            await run('RELEASE SAVEPOINT season_metric');
            continue;
          }
          rows = (await run(m.variants[variantKey])).rows;
        } else {
          rows = (await run(m.sql)).rows;
        }
        results.set(m.id, seasonValue(m, rows));
        await run('RELEASE SAVEPOINT season_metric');
      } catch (err) {
        if (err instanceof Broken) throw err;
        results.set(m.id, err.malformed ? 'failed (malformed result)' : `failed (${sqlState(err) || 'error'})`);
        await run('ROLLBACK TO SAVEPOINT season_metric');
      }
    }
  } catch (err) {
    if (err instanceof Broken) reasons.push('connection error (no SQLSTATE); nothing more was sent');
    else reasons.push(began ? `statement failed (${sqlState(err) || 'unknown'})` : `could not start the transaction (${sqlState(err) || 'unknown'})`);
  } finally {
    if (began && !broken) {
      try {
        await client.query('ROLLBACK');
      } catch (err) {
        reasons.push(`rollback failed (${sqlState(err) || 'no SQLSTATE'})`);
      }
    }
  }

  const ok = (id) => results.has(id) && !String(results.get(id)).startsWith('failed');
  const reported = SEASON_METRICS.filter((m) => ok(m.id)).length;
  if (SEASON_METRICS.some((m) => results.has(m.id) && !ok(m.id))) reasons.unshift('a metric failed');
  const complete = reasons.length === 0 && reported === SEASON_METRICS.length;
  const nonZero = (ms) => ms.filter((m) => ok(m.id) && results.get(m.id) !== '0').length;
  const integrity = SEASON_METRICS.filter((m) => m.cls === 'A');
  const blockers = integrity.filter((m) => m.a2);

  say(`season-integrity: ${complete ? 'COMPLETE' : 'INCOMPLETE'}`);
  for (const r of reasons) say(`reason: ${r}`);
  say('snapshot: one repeatable-read, read-only transaction, rolled back');
  for (const [cls, title] of SEASON_CLASSES) {
    say('');
    say(`## ${cls}. ${title}`);
    for (const m of SEASON_METRICS.filter((x) => x.cls === cls)) {
      const v = results.has(m.id) ? results.get(m.id) : 'not run';
      say(`- ${m.id} ${m.name}: ${v}${m.a2 ? ' [blocks A2]' : ''}`);
    }
  }
  say('');
  if (complete) {
    say(`integrity violations: ${nonZero(integrity)} of ${integrity.length} metrics non-zero`);
    say(`A2 migration blockers: ${nonZero(blockers)} of ${blockers.length} metrics non-zero`);
  } else {
    say('integrity violations: not determined (incomplete)');
    say('A2 migration blockers: not determined (incomplete)');
  }
  say(`season-integrity: END ${reported}/${SEASON_METRICS.length}`);
  return complete;
}

/** The daily snapshot (Amendment 1 §2): schema, exact counts, allowlisted samples, as Markdown. */
async function snapshot(client, say) {
  const started = new Date();
  say('# Database snapshot');
  say('');
  say(`taken: ${started.toISOString()} (UTC)`);
  const cols = await client.query(
    'SELECT table_name, column_name, data_type, is_nullable, column_default '
    + "FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position",
  );
  const idx = await client.query("SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname");
  const tables = new Map();
  for (const c of cols.rows) {
    if (!tables.has(c.table_name)) tables.set(c.table_name, []);
    tables.get(c.table_name).push(c);
  }
  const names = [...tables.keys()].filter((t) => /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(t));
  say(`tables in public: ${names.length}`);

  say('');
  say('## 1. Schema (db-schema, extended)');
  for (const t of names) {
    say('');
    say(`### ${t}`);
    for (const c of tables.get(t)) {
      const def = c.column_default == null ? '' : `, default ${boundValue(c.column_default)}`;
      say(`- ${c.column_name}: ${c.data_type}${c.is_nullable === 'NO' ? ', not null' : ''}${def}`);
    }
    for (const i of idx.rows.filter((x) => x.tablename === t)) say(`- index ${i.indexname}: ${indexSummary(i.indexdef)}`);
  }

  say('');
  say('## 2. Row counts (db-counts, extended: exact, every table)');
  let ok = true;
  for (const t of names) {
    try {
      const c = await client.query(countSql(t));
      say(`- ${t}: ${c.rows[0].n}`);
    } catch (err) {
      say(`- ${t}: count failed (${err.code || 'error'})`);
      ok = false;
    }
  }

  say('');
  say('## 3. Content samples (db-samples)');
  say(`The latest ${SAMPLE_ROWS} rows of each allowlisted table; columns whose names suggest a secret, a credential, contact details, a link or a person are left out, and values are cut at ${VALUE_MAX} characters.`);
  // Read every table first, then share the 200 KB cap (see allocateSamples).
  const sections = [];
  for (const t of SAMPLE_TABLES) {
    const sec = { t, notes: [], rows: [] };
    sections.push(sec);
    if (isNeverTable(t)) { sec.notes.push('(refused: on the never-list)'); continue; }
    const tcols = tables.get(t);
    if (!tcols) { sec.notes.push('(no such table)'); continue; }
    const kept = tcols.filter((c) => !dropColumn(c.column_name, c.data_type)).map((c) => c.column_name)
      .filter((c) => /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(c));
    const dropped = tcols.length - kept.length;
    const has = (n) => tcols.some((c) => c.column_name === n);
    const orderBy = ['updated_at', 'created_at', 'id'].find(has) || null;
    if (!kept.length) { sec.notes.push('(no columns left to show)'); continue; }
    let r;
    try {
      r = await client.query(sampleSql(t, kept, { orderBy, paranoid: has('deleted_at') }));
    } catch (err) {
      sec.notes.push(`(sample failed: ${err.code || 'error'})`);
      ok = false;
      continue;
    }
    sec.summary = `${kept.length} columns shown, ${dropped} left out${orderBy ? `; newest by ${orderBy}` : ''}`;
    sec.rows = r.rows.map((row, n) => [`row ${n + 1}:`, ...kept.map((c) => `  ${c}: ${boundValue(row[c])}`)]);
  }
  const shown = allocateSamples(sections.map((x) => x.rows.map((l) => Buffer.byteLength(l.join('\n')))), SAMPLES_MAX_BYTES);
  for (const [i, sec] of sections.entries()) {
    say('');
    say(`### ${sec.t}`);
    sec.notes.forEach((l) => say(l));
    if (sec.summary === undefined) continue;
    const k = shown[i];
    const cut = k < sec.rows.length ? ` (${sec.rows.length - k} more left out: this table's share of the ${SAMPLES_MAX_BYTES / 1024} KB cap)` : '';
    say(`${sec.rows.length} rows; ${k} shown${cut}; ${sec.summary}`);
    sec.rows.slice(0, k).forEach((lines) => lines.forEach((l) => say(l)));
  }
  return ok;
}

async function main(mode, say = (l) => process.stdout.write(`${l}\n`)) {
  if (!MODES.includes(mode)) { say(`unknown database check '${mode}'`); return 2; }
  let cfg;
  try {
    const appEnvPath = path.join(APP_DIR, '.env');
    const appEnv = fs.existsSync(appEnvPath) ? parseEnvFile(fs.readFileSync(appEnvPath, 'utf8')) : {};
    if (!fs.existsSync(RO_ENV)) { say(`not configured: ${RO_ENV} does not exist (setup step 3)`); return 2; }
    const mode600 = (fs.statSync(RO_ENV).mode & 0o077) === 0;
    if (!mode600) { say(`not configured: ${RO_ENV} is readable by others; chmod 600 it`); return 2; }
    cfg = connectionConfig({ appEnv, roEnv: parseEnvFile(fs.readFileSync(RO_ENV, 'utf8')) });
  } catch (err) {
    say(`not configured: ${err.message}`);
    return 2;
  }
  const { Client } = loadPg();
  const client = new Client(cfg);
  try {
    await client.connect();
  } catch (err) {
    say(`connected: NO (${err.code || 'error'}: ${String(err.message).slice(0, 200)})`);
    return 1;
  }
  try {
    const run = {
      db: checkDb, 'db-schema': checkSchema, 'db-counts': checkCounts, 'self-test': selfTest, snapshot,
      'season-integrity': checkSeasonIntegrity,
    }[mode];
    return (await run(client, say)) ? 0 : 1;
  } catch (err) {
    say(`error: ${err.code || 'unknown'}: ${String(err.message).slice(0, 200)}`);
    return 1;
  } finally {
    await client.end().catch((e) => say(`note: closing the connection: ${e.code || 'error'}`));
  }
}

module.exports = {
  parseEnvFile, connectionConfig, main, snapshot, COUNT_TABLES, MODES,
  SAMPLE_TABLES, NEVER_TABLES, isNeverTable, dropColumn, boundValue, indexSummary, allocateSamples, ident, countSql, sampleSql, SAMPLE_ROWS, VALUE_MAX, SAMPLES_MAX_BYTES,
  checkSeasonIntegrity, SEASON_METRICS, SEASON_PREAMBLE, SEASON_BUDGET_MS,
};

if (require.main === module) {
  main(process.argv[2]).then((code) => { process.exitCode = code; });
}

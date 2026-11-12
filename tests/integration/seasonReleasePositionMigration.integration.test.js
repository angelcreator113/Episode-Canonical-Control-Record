/**
 * A2 release position: the migration itself, up and down (K15 and K16, Stage
 * B; docs/design/2026-11-season-planning.md §4.6). Authorized by Evoni on
 * 2026-11-10.
 *
 * It runs the REAL migration files against a database of its own, so it can
 * take the column away and put it back without touching the shared test
 * database other suites are using:
 *
 *   1. creates a scratch database beside the test database
 *      (<test database>_a2_<pid>), with two stand-in parent tables (shows,
 *      show_arcs) holding only the columns the migrations read;
 *   2. runs 20261001230000-create-season-slots (the real file: the table, the
 *      live-slot unique index, 24 slots per active season);
 *   3. runs 20261110230000-add-season-slot-release-position up, down and up
 *      again, and checks the schema and every row each time;
 *   4. drops the scratch database.
 *
 * The same file runs on PostgreSQL 15 (the Tests job) and PostgreSQL 17 (the
 * "A2 constraints (PostgreSQL 17)" job; production is 17).
 *
 * Narrow on purpose (Evoni, 2026-11-10: "Narrow PostgreSQL 17 coverage"): the
 * two migrations that define season_slots and its rules, not the whole chain.
 * The whole chain runs on PostgreSQL 15 in the Tests job, where
 * seasonReleasePosition.integration.test.js checks the migrated schema.
 *
 * The database is the isolated test server only (the usual skip guard).
 */
jest.unmock('uuid');

const crypto = require('crypto');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');
const createSeasonSlots = require('../../src/migrations/20261001230000-create-season-slots');
const releasePosition = require('../../src/migrations/20261110230000-add-season-slot-release-position');

const PG_URL = process.env.DATABASE_URL;
const shouldSkip = !PG_URL || PG_URL.includes('amazonaws.com') || !PG_URL.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const SCRATCH = `episode_metadata_test_a2_${process.pid}`;

const RULES = {
  season_slots_release_position_range: /^CHECK \(\(\(release_position IS NULL\) OR \(\(release_position >= 1\) AND \(release_position <= 24\)\)\)\)$/,
  season_slots_effective_position_live: /^EXCLUDE USING btree \(arc_id WITH =, COALESCE\(release_position, slot_number\) WITH =\) WHERE \(\(deleted_at IS NULL\)\) DEFERRABLE INITIALLY DEFERRED$/,
  season_slots_episode_live: /^EXCLUDE USING btree \(episode_id WITH =\) WHERE \(\(\(deleted_at IS NULL\) AND \(episode_id IS NOT NULL\)\)\) DEFERRABLE INITIALLY DEFERRED$/,
};

/** The SQLSTATE a statement fails with, or null when it succeeds. */
async function codeOf(fn) {
  try {
    await fn();
    return null;
  } catch (err) {
    return err?.code || err?.original?.code || err?.parent?.code || 'no-code';
  }
}

(shouldSkip ? describe.skip : describe)('A2: the release-position migration, up and down, on the real season_slots (K15, K16)', () => {
  jest.setTimeout(120000);
  let admin; // the test database: only to create and drop the scratch one
  let db; // the scratch database, plain pg
  let scratch; // the scratch database, Sequelize (what a migration is given)
  let serverVersion;
  const show = uuid();
  const arcs = { one: uuid(), two: uuid(), archived: uuid() };
  const episode = uuid();

  const scratchUrl = () => {
    const u = new URL(PG_URL);
    u.pathname = `/${SCRATCH}`;
    return u.toString();
  };
  const up = () => releasePosition.up(scratch.getQueryInterface(), Sequelize);
  const down = () => releasePosition.down(scratch.getQueryInterface(), Sequelize);
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const columns = async () => (await q(
    `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'season_slots' ORDER BY ordinal_position`));
  const rules = async () => Object.fromEntries((await q(
    `SELECT conname, pg_get_constraintdef(oid) AS def, condeferrable, condeferred, convalidated
       FROM pg_constraint WHERE conrelid = 'public.season_slots'::regclass AND contype IN ('c', 'x') ORDER BY conname`))
    .map((r) => [r.conname, r]));
  const indexes = async () => (await q(
    "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'season_slots' ORDER BY indexname"))
    .map((r) => r.indexname);
  /** Every row, without release_position, so "before" and "after" compare whether or not the column exists. */
  const snapshot = async () => (await q(
    `SELECT id, show_id, arc_id, season_number, slot_number, phase, event_id, episode_id, story_purpose, career_focus,
            desired_pressure, story_thread_id, outcome_range, intention_source, actual_outcome, actual_pressure,
            accepted_at, locked_at, created_at, updated_at, deleted_at
       FROM season_slots ORDER BY arc_id, slot_number, id`));
  const slotId = async (arcId, n) => (await q(
    'SELECT id FROM season_slots WHERE arc_id = $1 AND slot_number = $2 AND deleted_at IS NULL', [arcId, n]))[0].id;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = new Client({ connectionString: PG_URL });
    await admin.connect();
    serverVersion = (await admin.query('SHOW server_version')).rows[0].server_version;
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH}`);
    await admin.query(`CREATE DATABASE ${SCRATCH}`);
    db = new Client({ connectionString: scratchUrl() });
    await db.connect();
    scratch = new Sequelize(scratchUrl(), { logging: false, pool: { max: 3 } });

    // Stand-ins for the two parents: only what the migrations read.
    await db.query('CREATE TABLE shows (id uuid PRIMARY KEY, deleted_at timestamptz)');
    await db.query(`CREATE TABLE show_arcs (
      id uuid PRIMARY KEY, show_id uuid NOT NULL REFERENCES shows (id), season_number integer, phases jsonb,
      status varchar(20) NOT NULL DEFAULT 'active', deleted_at timestamptz)`);
    await db.query('INSERT INTO shows (id) VALUES ($1)', [show]);
    await db.query(
      `INSERT INTO show_arcs (id, show_id, season_number, status) VALUES ($1, $4, 1, 'active'), ($2, $4, 2, 'active'), ($3, $4, 3, 'archived')`,
      [arcs.one, arcs.two, arcs.archived, show]);

    // The real season_slots, from its own migration: 24 slots for each active season.
    await createSeasonSlots.up(scratch.getQueryInterface(), Sequelize);
    // Rows as production has them: a started slot, a pencilled slot, an intention, and a soft-deleted row beside its live twin.
    await db.query('UPDATE season_slots SET episode_id = $1, locked_at = NOW() WHERE arc_id = $2 AND slot_number = 1', [episode, arcs.one]);
    await db.query('UPDATE season_slots SET event_id = $1 WHERE arc_id = $2 AND slot_number = 2', [uuid(), arcs.one]);
    await db.query("UPDATE season_slots SET story_purpose = 'The launch', intention_source = 'edited' WHERE arc_id = $1 AND slot_number = 3", [arcs.one]);
    await db.query(
      `INSERT INTO season_slots (id, show_id, arc_id, season_number, slot_number, phase, episode_id, deleted_at)
       VALUES (gen_random_uuid(), $1, $2, 1, 1, 1, $3, NOW())`, [show, arcs.one, episode]);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (scratch) await scratch.close();
    if (db) await db.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH} WITH (FORCE)`);
      await admin.end();
    }
  });

  it('runs on PostgreSQL 15 or later, against its own scratch database', async () => {
    expect(Number(serverVersion.split('.')[0])).toBeGreaterThanOrEqual(15);
    expect((await q('SELECT current_database() AS name'))[0].name).toBe(SCRATCH);
    // What production's table starts as: 48 live slots, one soft-deleted, no release_position, the live-slot unique index.
    expect((await q('SELECT COUNT(*)::int AS n FROM season_slots WHERE deleted_at IS NULL'))[0].n).toBe(48);
    expect((await columns()).map((c) => c.column_name)).not.toContain('release_position');
    expect(await indexes()).toEqual(expect.arrayContaining(['season_slots_arc_slot_live', 'season_slots_pkey', 'season_slots_show_id']));
    expect(Object.keys(await rules())).toEqual([]);
  });

  it('K15: up adds the nullable column and the three rules beside season_slots_arc_slot_live, and changes no row', async () => {
    const before = await snapshot();
    const indexesBefore = await indexes();
    await up();

    const column = (await columns()).find((c) => c.column_name === 'release_position');
    expect(column).toEqual({ column_name: 'release_position', data_type: 'integer', is_nullable: 'YES', column_default: null });
    const found = await rules();
    expect(Object.keys(found).sort()).toEqual(Object.keys(RULES).sort());
    for (const [name, shape] of Object.entries(RULES)) expect(found[name].def).toMatch(shape);
    expect(found.season_slots_release_position_range).toMatchObject({ condeferrable: false, convalidated: true });
    expect(found.season_slots_effective_position_live).toMatchObject({ condeferrable: true, condeferred: true });
    expect(found.season_slots_episode_live).toMatchObject({ condeferrable: true, condeferred: true });
    // The existing unique index is still there, and no extension was needed.
    expect(await indexes()).toEqual(expect.arrayContaining(indexesBefore));
    expect((await q("SELECT extname FROM pg_extension WHERE extname = 'btree_gist'"))).toEqual([]);

    // No row changed, and no release position was written.
    expect(await snapshot()).toEqual(before);
    expect((await q('SELECT COUNT(release_position)::int AS n FROM season_slots'))[0].n).toBe(0);
  });

  it('K15: running up again changes nothing', async () => {
    const before = { rows: await snapshot(), rules: await rules(), columns: await columns(), indexes: await indexes() };
    await up();
    expect({ rows: await snapshot(), rules: await rules(), columns: await columns(), indexes: await indexes() }).toEqual(before);
  });

  it('the rules hold on the real table: range at once, positions and occupancy at COMMIT', async () => {
    const two = await slotId(arcs.one, 2);
    const five = await slotId(arcs.one, 5);
    // Range: refused by the statement.
    expect(await codeOf(() => db.query('UPDATE season_slots SET release_position = 0 WHERE id = $1', [two]))).toBe('23514');
    expect(await codeOf(() => db.query('UPDATE season_slots SET release_position = 25 WHERE id = $1', [two]))).toBe('23514');

    // Two slots trade positions inside one transaction: the commit succeeds.
    await db.query('BEGIN');
    await db.query('UPDATE season_slots SET release_position = 5 WHERE id = $1', [two]);
    await db.query('UPDATE season_slots SET release_position = 2 WHERE id = $1', [five]);
    await db.query('COMMIT');
    const effective = (await q(
      'SELECT COALESCE(release_position, slot_number) AS p FROM season_slots WHERE arc_id = $1 AND deleted_at IS NULL ORDER BY 1', [arcs.one]))
      .map((r) => r.p);
    expect(effective).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    // The other season is untouched.
    expect((await q('SELECT COUNT(release_position)::int AS n FROM season_slots WHERE arc_id = $1', [arcs.two]))[0].n).toBe(0);

    // A repeated effective position: every statement succeeds, the COMMIT is refused, nothing is written.
    await db.query('BEGIN');
    await db.query('UPDATE season_slots SET release_position = 7 WHERE id = $1', [two]);
    expect(await codeOf(() => db.query('COMMIT'))).toBe('23P01');
    expect((await q('SELECT release_position FROM season_slots WHERE id = $1', [two]))[0].release_position).toBe(5);

    // One episode in two live slots: refused at COMMIT. The soft-deleted twin of slot 1 was never in the way.
    await db.query('BEGIN');
    await db.query('UPDATE season_slots SET episode_id = $1 WHERE id = $2', [episode, five]);
    expect(await codeOf(() => db.query('COMMIT'))).toBe('23P01');
    expect((await q('SELECT episode_id FROM season_slots WHERE id = $1', [five]))[0].episode_id).toBeNull();
    // The same position in another season is allowed.
    await db.query('UPDATE season_slots SET release_position = NULL WHERE arc_id = $1', [arcs.one]);
  });

  it('K16: down refuses, changing nothing, while any slot has a release position', async () => {
    const two = await slotId(arcs.one, 2);
    const five = await slotId(arcs.one, 5);
    await db.query('BEGIN');
    await db.query('UPDATE season_slots SET release_position = 5 WHERE id = $1', [two]);
    await db.query('UPDATE season_slots SET release_position = 2 WHERE id = $1', [five]);
    await db.query('COMMIT');
    const before = { rules: await rules(), columns: await columns() };

    await expect(down()).rejects.toThrow(/down refused, nothing changed: 2 slot row\(s\) have a release position/);
    expect({ rules: await rules(), columns: await columns() }).toEqual(before);
    expect((await q('SELECT COUNT(release_position)::int AS n FROM season_slots'))[0].n).toBe(2);

    await db.query('UPDATE season_slots SET release_position = NULL');
  });

  it('K16: down removes the column and the three rules only; up puts them back; every row is as it was', async () => {
    const before = await snapshot();
    const withRules = { rules: await rules(), columns: await columns(), indexes: await indexes() };

    await down();
    expect((await columns()).map((c) => c.column_name)).not.toContain('release_position');
    expect(Object.keys(await rules())).toEqual([]);
    const names = await indexes();
    expect(names).toEqual(expect.arrayContaining(['season_slots_arc_slot_live', 'season_slots_pkey', 'season_slots_show_id']));
    expect(names).not.toEqual(expect.arrayContaining(['season_slots_effective_position_live']));
    expect(names).not.toEqual(expect.arrayContaining(['season_slots_episode_live']));
    expect(await snapshot()).toEqual(before);
    // The table works as it did before the migration: the live-slot unique index still refuses a second live slot 4.
    expect(await codeOf(() => db.query(
      `INSERT INTO season_slots (id, show_id, arc_id, season_number, slot_number, phase)
       VALUES (gen_random_uuid(), $1, $2, 1, 4, 1)`, [show, arcs.one]))).toBe('23505');

    // down again: nothing to do, no error.
    await down();
    expect(await snapshot()).toEqual(before);

    await up();
    expect({ rules: await rules(), columns: await columns(), indexes: await indexes() }).toEqual(withRules);
    expect(await snapshot()).toEqual(before);
    expect((await q('SELECT COUNT(release_position)::int AS n FROM season_slots'))[0].n).toBe(0);
  });

  it('up refuses, changing nothing, when an episode is already in two live slots', async () => {
    await down();
    const five = await slotId(arcs.one, 5);
    await db.query('UPDATE season_slots SET episode_id = $1 WHERE id = $2', [episode, five]);
    const before = { rows: await snapshot(), columns: await columns() };

    await expect(up()).rejects.toThrow(/refused, nothing changed: 1 episode\(s\) are in more than one live season slot/);
    expect({ rows: await snapshot(), columns: await columns() }).toEqual(before);
    expect(Object.keys(await rules())).toEqual([]);

    // Repaired, it goes on.
    await db.query('UPDATE season_slots SET episode_id = NULL WHERE id = $1', [five]);
    await up();
    expect(Object.keys(await rules()).sort()).toEqual(Object.keys(RULES).sort());
  });
});

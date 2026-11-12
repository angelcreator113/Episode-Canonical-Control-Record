/**
 * db-season-integrity against real PostgreSQL (Gate 2;
 * docs/design/2026-11-season-planning.md §8 item 2).
 *
 * The database is CI's migrated test DB (TEST_DATABASE_URL). Two kinds of run:
 *   1. against `public`: every fixed statement parses and names real columns
 *      of the migrated schema, and the report is COMPLETE;
 *   2. against a scratch schema whose tables are copies of the real ones
 *      (column names and types, no constraints), one planted defect at a
 *      time: exactly that integrity count becomes 1.
 * The check itself only reads, in a READ ONLY transaction it rolls back.
 * Nothing here touches production.
 */
const crypto = require('crypto');
const { Client } = require('pg');
const { checkSeasonIntegrity, SEASON_METRICS } = require('../../scripts/diagnostics/db-check');

const PG_URL = process.env.TEST_DATABASE_URL;
const shouldSkip = !PG_URL || PG_URL.includes('amazonaws.com') || !PG_URL.includes('episode_metadata_test');

const TABLES = ['season_slots', 'season_specials', 'episodes', 'episode_briefs', 'episode_raw_clips', 'show_arcs', 'world_events',
  'activity_logs'];
const A_IDS = SEASON_METRICS.filter((m) => m.cls === 'A').map((m) => m.id);
const uuid = () => crypto.randomUUID();

async function runCheck(client) {
  const lines = [];
  const ok = await checkSeasonIntegrity(client, (l) => lines.push(l));
  const values = Object.fromEntries(lines.filter((l) => /^- [ABC]\d/.test(l))
    .map((l) => l.match(/^- ([ABC]\d{1,2}) [a-z0-9_]+: (.*?)( \[blocks A2\])?$/)).map((x) => [x[1], x[2]]));
  return { ok, lines, values, text: lines.join('\n') };
}

(shouldSkip ? describe.skip : describe)('db-season-integrity against PostgreSQL', () => {
  const SCHEMA = `diag_season_${process.pid}`;
  let admin;
  let reader;

  beforeAll(async () => {
    admin = new Client({ connectionString: PG_URL });
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${SCHEMA}`);
    for (const t of TABLES) await admin.query(`CREATE TABLE ${SCHEMA}.${t} (LIKE public.${t} INCLUDING DEFAULTS)`);
    // Copies keep the real names and types; NOT NULL is lifted so a fixture
    // row needs only the columns a metric reads.
    const nn = await admin.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1 AND is_nullable = 'NO'", [SCHEMA]);
    for (const r of nn.rows) await admin.query(`ALTER TABLE ${SCHEMA}.${r.table_name} ALTER COLUMN "${r.column_name}" DROP NOT NULL`);
    reader = new Client({ connectionString: PG_URL });
    await reader.connect();
  });

  afterAll(async () => {
    if (reader) await reader.end().catch((e) => console.error('closing the reader', e.code));
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch((e) => console.error('dropping the scratch schema', e.code));
      await admin.end();
    }
  });

  test('against the migrated public schema: every statement runs, COMPLETE, END 31/31', async () => {
    await reader.query('SET search_path TO public');
    const r = await runCheck(reader);
    if (!r.ok) console.error(r.text);
    expect(r.lines[0]).toBe('season-integrity: COMPLETE');
    expect(r.lines[r.lines.length - 1]).toBe('season-integrity: END 31/31');
    expect(r.text).not.toMatch(/failed \(/);
    expect(r.ok).toBe(true);
  });

  describe('planted defects in a scratch copy', () => {
    const ids = {};
    const ins = (sql, params) => admin.query(sql.replace(/\bS\./g, `${SCHEMA}.`), params);

    /** A clean season: one live active arc with its 24 live slots, one live episode e1 and its brief. */
    async function seed() {
      for (const t of TABLES) await admin.query(`TRUNCATE ${SCHEMA}.${t}`);
      Object.assign(ids, { show: uuid(), arc: uuid(), e1: uuid(), e2: uuid(), ev1: uuid(), ev2: uuid(), slots: [] });
      await ins("INSERT INTO S.show_arcs (id, show_id, status, season_number) VALUES ($1, $2, 'active', 1)", [ids.arc, ids.show]);
      for (let n = 1; n <= 24; n += 1) {
        const id = uuid();
        ids.slots.push(id);
        await ins('INSERT INTO S.season_slots (id, show_id, arc_id, season_number, slot_number, phase) VALUES ($1, $2, $3, 1, $4, 1)',
          [id, ids.show, ids.arc, n]);
      }
      await ins('INSERT INTO S.episodes (id) VALUES ($1), ($2)', [ids.e1, ids.e2]);
      await ins('INSERT INTO S.world_events (id) VALUES ($1), ($2)', [ids.ev1, ids.ev2]);
    }
    const slot = (n) => ids.slots[n - 1];
    async function check() {
      await reader.query(`SET search_path TO ${SCHEMA}`);
      return runCheck(reader);
    }
    const onlyA = (values, id) => Object.fromEntries(A_IDS.map((x) => [x, x === id ? '1' : '0']));
    const aValues = (values) => Object.fromEntries(A_IDS.map((x) => [x, values[x]]));

    test('a clean season: COMPLETE, every integrity count 0', async () => {
      await seed();
      const r = await check();
      expect(r.ok).toBe(true);
      expect(aValues(r.values)).toEqual(onlyA(r.values, null));
      expect(r.text).toContain('A2 migration blockers: 0 of 9 metrics non-zero');
    });

    const PLANTS = {
      A1: () => ins('UPDATE S.season_slots SET episode_id = $1 WHERE id = ANY($2)', [ids.e1, [slot(1), slot(2)]]),
      A2: async () => {
        await ins('UPDATE S.season_slots SET episode_id = $1 WHERE id = $2', [ids.e1, slot(1)]);
        await ins("INSERT INTO S.season_specials (id, show_id, arc_id, kind, episode_id) VALUES ($1, $2, $3, 'bonus', $4)",
          [uuid(), ids.show, ids.arc, ids.e1]);
      },
      A3: () => ins('UPDATE S.season_slots SET episode_id = $1 WHERE id = $2', [uuid(), slot(1)]),
      A4: () => ins('UPDATE S.season_slots SET locked_at = NOW() WHERE id = $1', [slot(1)]),
      A5: () => ins('UPDATE S.season_slots SET accepted_at = NOW() WHERE id = $1', [slot(1)]),
      A6: () => ins("INSERT INTO S.season_specials (id, show_id, arc_id, kind, episode_id) VALUES ($1, $2, $3, 'special', $4)",
        [uuid(), ids.show, ids.arc, uuid()]),
      A7: () => ins("INSERT INTO S.season_specials (id, show_id, arc_id, kind, locked_at) VALUES ($1, $2, $3, 'bonus', NOW())",
        [uuid(), ids.show, ids.arc]),
      A8: () => ins("INSERT INTO S.season_specials (id, show_id, arc_id, kind, accepted_at) VALUES ($1, $2, $3, 'special', NOW())",
        [uuid(), ids.show, ids.arc]),
      A9: () => ins(`INSERT INTO S.season_specials (id, show_id, arc_id, kind, part_one_slot_id, part_two_slot_id)
                     VALUES ($1, $2, $3, 'two_part', $4, $5)`, [uuid(), ids.show, ids.arc, slot(1), uuid()]),
      A10: () => ins('UPDATE S.season_slots SET deleted_at = NOW() WHERE id = $1', [slot(24)]),
      A11: () => ins('UPDATE S.season_slots SET slot_number = 25 WHERE id = $1', [slot(24)]),
      A12: () => ins('UPDATE S.season_slots SET slot_number = 1 WHERE id = $1', [slot(24)]),
      A13: () => ins('UPDATE S.season_slots SET season_number = 2 WHERE id = $1', [slot(1)]),
      A14: () => ins('UPDATE S.season_slots SET event_id = $1 WHERE id = ANY($2)', [ids.ev1, [slot(1), slot(2)]]),
      A15: async () => {
        await ins('UPDATE S.season_slots SET episode_id = $1, event_id = $2 WHERE id = $3', [ids.e1, ids.ev1, slot(1)]);
        await ins('INSERT INTO S.episode_briefs (id, episode_id, event_id) VALUES ($1, $2, $3)', [uuid(), ids.e1, ids.ev2]);
      },
    };

    test.each(Object.keys(PLANTS))('one planted %s: exactly that integrity count is 1, still COMPLETE', async (id) => {
      await seed();
      await PLANTS[id]();
      const r = await check();
      expect(r.ok).toBe(true);
      expect(aValues(r.values)).toEqual(onlyA(r.values, id));
      const blocks = SEASON_METRICS.find((m) => m.id === id).a2 ? 1 : 0;
      expect(r.text).toContain(`A2 migration blockers: ${blocks} of 9 metrics non-zero`);
    });

    test('a two-parter shares its event across its two slots and holds its episode: no integrity count', async () => {
      await seed();
      await ins('UPDATE S.season_slots SET event_id = $1 WHERE id = ANY($2)', [ids.ev1, [slot(5), slot(6)]]);
      await ins('UPDATE S.season_slots SET episode_id = $1, locked_at = NOW() WHERE id = $2', [ids.e1, slot(5)]);
      await ins(`INSERT INTO S.season_specials (id, show_id, arc_id, kind, event_id, episode_id, part_one_slot_id, part_two_slot_id)
                 VALUES ($1, $2, $3, 'two_part', $4, $5, $6, $7)`, [uuid(), ids.show, ids.arc, ids.ev1, ids.e1, slot(5), slot(6)]);
      const r = await check();
      expect(r.ok).toBe(true);
      expect(aValues(r.values)).toEqual(onlyA(r.values, null));
      expect(r.values.B5).toBe('1');
    });

    test('filmed counts a soft-deleted raw clip (the A1.2 freeze); a locked brief is a protected record', async () => {
      await seed();
      await ins('UPDATE S.season_slots SET episode_id = $1 WHERE id = $2', [ids.e1, slot(1)]);
      await ins('INSERT INTO S.episode_raw_clips (id, episode_id, deleted_at) VALUES ($1, $2, NOW())', [uuid(), ids.e1]);
      await ins("INSERT INTO S.episode_briefs (id, episode_id, status) VALUES ($1, $2, 'locked')", [uuid(), ids.e1]);
      const r = await check();
      expect(r.ok).toBe(true);
      expect(r.values.B1).toBe('1');
      expect(r.values.B6).toBe('1');
      expect(aValues(r.values)).toEqual(onlyA(r.values, null));
    });

    test('pencils and stale season context are planning conditions, not violations', async () => {
      await seed();
      await ins('UPDATE S.season_slots SET event_id = $1 WHERE id = $2', [ids.ev1, slot(3)]);
      await ins('UPDATE S.world_events SET used_in_episode_id = $1 WHERE id = $2', [ids.e2, ids.ev1]);
      await ins("UPDATE S.episodes SET season_context = '{}'::jsonb WHERE id = $1", [ids.e2]);
      const r = await check();
      expect(r.ok).toBe(true);
      expect(r.values.C3).toBe('1');
      expect(r.values.C4).toBe('1');
      expect(r.values.C2).toBe('1');
      expect(aValues(r.values)).toEqual(onlyA(r.values, null));
    });

    test('air_date: midnight in New York is not UTC midnight, whatever the session zone', async () => {
      await seed();
      await ins("UPDATE S.episodes SET air_date = '2026-11-10 05:00:00+00' WHERE id = $1", [ids.e1]);
      await ins("UPDATE S.episodes SET air_date = '2026-11-10 00:00:00+00' WHERE id = $1", [ids.e2]);
      await reader.query("SET TIME ZONE 'America/New_York'");
      const r = await check();
      await reader.query('SET TIME ZONE DEFAULT');
      expect(r.ok).toBe(true);
      expect(r.values.C7).toBe('1');
      expect(r.values.C5).toBe('2');
    });

    test('air_date of type date is not applicable; the report stays COMPLETE', async () => {
      await seed();
      await admin.query(`ALTER TABLE ${SCHEMA}.episodes ALTER COLUMN air_date TYPE date`);
      try {
        const r = await check();
        expect(r.ok).toBe(true);
        expect(r.values.C7).toBe('not applicable (date)');
      } finally {
        await admin.query(`ALTER TABLE ${SCHEMA}.episodes ALTER COLUMN air_date TYPE timestamp with time zone`);
      }
    });

    test('the check writes nothing and leaves no open transaction', async () => {
      await seed();
      await PLANTS.A4();
      const before = await admin.query(`SELECT count(*) AS n, max(updated_at) AS u FROM ${SCHEMA}.season_slots`);
      const r = await check();
      expect(r.ok).toBe(true);
      const after = await admin.query(`SELECT count(*) AS n, max(updated_at) AS u FROM ${SCHEMA}.season_slots`);
      expect(after.rows).toEqual(before.rows);
      const st = await admin.query('SELECT state FROM pg_stat_activity WHERE pid = $1', [reader.processID]);
      expect(st.rows[0].state).toBe('idle');
    });

    test('a real server error in one metric makes the report INCOMPLETE and still rolls back', async () => {
      await seed();
      await admin.query(`ALTER TABLE ${SCHEMA}.world_events RENAME TO world_events_gone`);
      try {
        const r = await check();
        expect(r.ok).toBe(false);
        expect(r.lines[0]).toBe('season-integrity: INCOMPLETE');
        expect(r.values.C4).toBe('failed (42P01)');
        expect(r.values.C5).toMatch(/^\d+$/);
        expect(r.lines[r.lines.length - 1]).toBe('season-integrity: END 30/31');
        const st = await admin.query('SELECT state FROM pg_stat_activity WHERE pid = $1', [reader.processID]);
        expect(st.rows[0].state).toBe('idle');
      } finally {
        await admin.query(`ALTER TABLE ${SCHEMA}.world_events_gone RENAME TO world_events`);
      }
    });
  });
});

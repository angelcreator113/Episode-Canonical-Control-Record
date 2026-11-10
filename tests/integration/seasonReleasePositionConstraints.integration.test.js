/**
 * A2 release position: the proposed constraints, on PostgreSQL itself
 * (docs/design/2026-11-season-planning.md §4.2 and §4.6; K1-K14 and K17,
 * Stage A). Authorized by Evoni on 2026-11-10 as tests only.
 *
 * Nothing here is the A2 migration, and no application code is exercised
 * except where a test says so (K14: Sequelize's commit; K17: the existing
 * episodeLocks.isLockConflict). The tests create a throwaway schema with an
 * ordinary table shaped like season_slots (the columns the rules read, and
 * the existing live-slot unique index), add the PROPOSED rules to it, and drop
 * the schema afterwards. An ordinary table, not a TEMP table: the concurrency
 * cases need two sessions.
 *
 * The proposed rules, verbatim from §4.2:
 *   CHECK (release_position IS NULL OR release_position BETWEEN 1 AND 24)
 *   EXCLUDE USING btree (arc_id WITH =, (COALESCE(release_position, slot_number)) WITH =)
 *     WHERE (deleted_at IS NULL) DEFERRABLE INITIALLY DEFERRED
 *   EXCLUDE USING btree (episode_id WITH =)
 *     WHERE (deleted_at IS NULL AND episode_id IS NOT NULL) DEFERRABLE INITIALLY DEFERRED
 *
 * Not here (design §4.6): K15 and K16 (the migration up and down, Stage B, in
 * the A2 migration PR) and K11-R (a placement-service test). The response
 * codes the design names (SEASON_PLACEMENT_STALE, _INTEGRITY, _BUSY) belong
 * to the placement service, which does not exist yet: these tests pin the
 * database signal each one will be built on (0 rows updated; SQLSTATE 23P01
 * at COMMIT; 40P01 or 55P03).
 *
 * The database is the isolated test database only (the usual skip guard).
 */
jest.unmock('uuid');

const crypto = require('crypto');
const { Client } = require('pg');
const models = require('../../src/models');
const { isLockConflict } = require('../../src/utils/episodeLocks');

const { sequelize } = models;
const PG_URL = process.env.DATABASE_URL;
const shouldSkip = !PG_URL || PG_URL.includes('amazonaws.com') || !PG_URL.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const SCHEMA = `a2_constraints_${process.pid}`;
const T = `${SCHEMA}.season_slots`;

const CHECK = 'CHECK (release_position IS NULL OR release_position BETWEEN 1 AND 24)';
const POSITION_RULE = 'EXCLUDE USING btree (arc_id WITH =, (COALESCE(release_position, slot_number)) WITH =) WHERE (deleted_at IS NULL)';
const OCCUPANCY_RULE = 'EXCLUDE USING btree (episode_id WITH =) WHERE (deleted_at IS NULL AND episode_id IS NOT NULL)';
const DEFERRED = 'DEFERRABLE INITIALLY DEFERRED';

/** The SQLSTATE a statement fails with, or null when it succeeds. */
async function codeOf(fn) {
  try {
    await fn();
    return null;
  } catch (err) {
    return err?.code || err?.original?.code || err?.parent?.code || 'no-code';
  }
}

(shouldSkip ? describe.skip : describe)('A2: the proposed release-position constraints on PostgreSQL (K1-K14, K17)', () => {
  jest.setTimeout(60000);
  let admin;
  let s1;
  let s2;
  let serverVersion;
  const arcs = { one: uuid(), two: uuid() };

  const connect = async () => {
    const c = new Client({ connectionString: PG_URL });
    await c.connect();
    return c;
  };
  /** Rows of one season as [slot_number, effective position], by slot number. */
  const positions = async (arcId) => (await admin.query(
    `SELECT slot_number, COALESCE(release_position, slot_number) AS position, release_position, episode_id
       FROM ${T} WHERE arc_id = $1 AND deleted_at IS NULL ORDER BY slot_number`, [arcId])).rows;
  const effective = async (arcId) => (await positions(arcId)).map((r) => r.position);
  const isPermutation = (list) => [...list].sort((a, b) => a - b).join() === Array.from({ length: 24 }, (_, i) => i + 1).join();
  const slotIdOf = async (arcId, n) => (await admin.query(`SELECT id FROM ${T} WHERE arc_id = $1 AND slot_number = $2 AND deleted_at IS NULL`, [arcId, n])).rows[0].id;
  /** Sets one slot's release position to `position`, stored NULL when it equals its own slot number (the design's normal form). */
  const setPosition = (c, arcId, slotNumber, position) => c.query(
    `UPDATE ${T} SET release_position = NULLIF($3::int, slot_number) WHERE arc_id = $1 AND slot_number = $2 AND deleted_at IS NULL`,
    [arcId, slotNumber, position]);
  /** Both seasons back to 24 live slots, every release_position NULL, no episodes. */
  async function reset() {
    await admin.query(`TRUNCATE ${T}`);
    for (const arcId of Object.values(arcs)) {
      await admin.query(
        `INSERT INTO ${T} (id, arc_id, slot_number) SELECT gen_random_uuid(), $1, n FROM generate_series(1, 24) n`, [arcId]);
    }
  }
  const snapshot = async () => JSON.stringify((await admin.query(
    `SELECT id, arc_id, slot_number, release_position, episode_id, deleted_at FROM ${T} ORDER BY arc_id, slot_number, id`)).rows);

  beforeAll(async () => {
    admin = await connect();
    s1 = await connect();
    s2 = await connect();
    serverVersion = (await admin.query('SHOW server_version')).rows[0].server_version;
    await admin.query(`CREATE SCHEMA ${SCHEMA}`);
    // The columns the rules read, typed as in src/migrations/20261001230000-create-season-slots
    // (uuid ids, integer slot_number, timestamptz deleted_at), plus the proposed column.
    await admin.query(
      `CREATE TABLE ${T} (
         id uuid PRIMARY KEY, arc_id uuid NOT NULL, slot_number integer NOT NULL,
         episode_id uuid, deleted_at timestamptz, release_position integer)`);
    // The existing live-slot index stays as it is (§4.2).
    await admin.query(`CREATE UNIQUE INDEX season_slots_arc_slot_live ON ${T} (arc_id, slot_number) WHERE deleted_at IS NULL`);
  });

  afterAll(async () => {
    for (const c of [s1, s2]) {
      if (c) {
        await c.query('ROLLBACK').catch((e) => console.error('rollback at teardown', e.code));
        await c.end().catch((e) => console.error('closing a session', e.code));
      }
    }
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch((e) => console.error('dropping the scratch schema', e.code));
      await admin.end();
    }
    await sequelize.close();
  });

  afterEach(async () => {
    for (const c of [s1, s2]) await c.query('ROLLBACK').catch((e) => console.error('rollback after a test', e.code));
  });

  // ── K1 ──────────────────────────────────────────────────────────────────
  test('K1: the CHECK and both exclusion rules can be created as written, deferrable and initially deferred, with no extension', async () => {
    const before = (await admin.query('SELECT extname FROM pg_extension ORDER BY 1')).rows.map((r) => r.extname);
    await admin.query(`ALTER TABLE ${T} ADD CONSTRAINT season_slots_release_position_range ${CHECK}`);
    await admin.query(`ALTER TABLE ${T} ADD CONSTRAINT season_slots_release_position_live ${POSITION_RULE} ${DEFERRED}`);
    await admin.query(`ALTER TABLE ${T} ADD CONSTRAINT season_slots_episode_live ${OCCUPANCY_RULE} ${DEFERRED}`);
    const after = (await admin.query('SELECT extname FROM pg_extension ORDER BY 1')).rows.map((r) => r.extname);

    expect(after).toEqual(before);
    expect(after).not.toContain('btree_gist');
    const cons = (await admin.query(
      `SELECT conname, contype, condeferrable, condeferred FROM pg_constraint
        WHERE conrelid = $1::regclass ORDER BY conname`, [T])).rows;
    expect(cons).toEqual(expect.arrayContaining([
      { conname: 'season_slots_release_position_range', contype: 'c', condeferrable: false, condeferred: false },
      { conname: 'season_slots_release_position_live', contype: 'x', condeferrable: true, condeferred: true },
      { conname: 'season_slots_episode_live', contype: 'x', condeferrable: true, condeferred: true },
    ]));
    // Each exclusion rule is backed by a btree index, with its predicate.
    const idx = (await admin.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 AND tablename = 'season_slots' ORDER BY indexname`, [SCHEMA])).rows;
    const def = (name) => idx.find((i) => i.indexname === name).indexdef;
    expect(def('season_slots_release_position_live')).toMatch(/USING btree \(arc_id, COALESCE\(release_position, slot_number\)\) WHERE \(deleted_at IS NULL\)/);
    expect(def('season_slots_episode_live')).toMatch(/USING btree \(episode_id\) WHERE \(\(deleted_at IS NULL\) AND \(episode_id IS NOT NULL\)\)/);
    expect(serverVersion).toMatch(/^\d+\./);
  });

  // ── K2, K3 ──────────────────────────────────────────────────────────────
  test('K2: two seasons of 24 slots, every release_position NULL, are accepted', async () => {
    await reset();
    for (const arcId of Object.values(arcs)) {
      const rows = await positions(arcId);
      expect(rows).toHaveLength(24);
      expect(rows.every((r) => r.release_position === null)).toBe(true);
      expect(isPermutation(rows.map((r) => r.position))).toBe(true);
    }
  });

  test('K3: two slots exchange their effective positions in one transaction; the season stays a permutation and the other season is untouched', async () => {
    await reset();
    const other = await snapshot();
    await s1.query('BEGIN');
    await setPosition(s1, arcs.one, 3, 7); // for a moment E3 and E7 are both at 7: allowed until COMMIT
    await setPosition(s1, arcs.one, 7, 3);
    await s1.query('COMMIT');

    const rows = await positions(arcs.one);
    expect(rows.find((r) => r.slot_number === 3).position).toBe(7);
    expect(rows.find((r) => r.slot_number === 7).position).toBe(3);
    expect(isPermutation(rows.map((r) => r.position))).toBe(true);
    expect(await effective(arcs.two)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(JSON.parse(await snapshot()).filter((r) => r.arc_id === arcs.two))
      .toEqual(JSON.parse(other).filter((r) => r.arc_id === arcs.two));

    // Swapping back stores NULL again (the normal form): the same dates as before A2.
    await s1.query('BEGIN');
    await setPosition(s1, arcs.one, 3, 3);
    await setPosition(s1, arcs.one, 7, 7);
    await s1.query('COMMIT');
    expect((await positions(arcs.one)).every((r) => r.release_position === null)).toBe(true);
  });

  // ── K4 ──────────────────────────────────────────────────────────────────
  test('K4: with the rule forced immediate, the first update of a swap fails 23P01: deferral is required', async () => {
    await reset();
    await s1.query('BEGIN');
    await s1.query('SET CONSTRAINTS ALL IMMEDIATE');
    expect(await codeOf(() => setPosition(s1, arcs.one, 3, 7))).toBe('23P01');
    await s1.query('ROLLBACK');
    expect((await positions(arcs.one)).every((r) => r.release_position === null)).toBe(true);
  });

  // ── K5, K6, K7 ──────────────────────────────────────────────────────────
  test('K5: writing raw slot numbers after an earlier swap breaks the permutation: COMMIT fails 23P01 and the earlier state stays', async () => {
    await reset();
    await s1.query('BEGIN');
    await setPosition(s1, arcs.one, 3, 7);
    await setPosition(s1, arcs.one, 7, 3);
    await s1.query('COMMIT');
    const before = await snapshot();

    // E3 (now at 7) "swaps" with E5 using slot numbers, not effective positions:
    // E3 takes 5, E5 takes 3, but 3 is already E7's position.
    await s1.query('BEGIN');
    await setPosition(s1, arcs.one, 3, 5);
    await setPosition(s1, arcs.one, 5, 3);
    expect(await codeOf(() => s1.query('COMMIT'))).toBe('23P01');

    expect(await snapshot()).toBe(before);
    expect(isPermutation(await effective(arcs.one))).toBe(true);
  });

  test('K6: an override that collides with a slot whose position is NULL (its own slot number): COMMIT fails 23P01', async () => {
    await reset();
    const before = await snapshot();
    await s1.query('BEGIN');
    await setPosition(s1, arcs.one, 3, 7); // E7 has no override, so it is at 7
    expect(await codeOf(() => s1.query('COMMIT'))).toBe('23P01');
    expect(await snapshot()).toBe(before);
  });

  test('K7: the same effective position in two different seasons is allowed', async () => {
    await reset();
    for (const arcId of Object.values(arcs)) {
      await s1.query('BEGIN');
      await setPosition(s1, arcId, 3, 7);
      await setPosition(s1, arcId, 7, 3);
      await s1.query('COMMIT');
    }
    expect((await positions(arcs.one)).find((r) => r.slot_number === 3).position).toBe(7);
    expect((await positions(arcs.two)).find((r) => r.slot_number === 3).position).toBe(7);
  });

  // ── K8 ──────────────────────────────────────────────────────────────────
  test('K8: a soft-deleted row may share a position; restoring it fails 23P01 at COMMIT', async () => {
    await reset();
    const id24 = await slotIdOf(arcs.one, 24);
    // E24 is soft-deleted and given position 3, which live E3 holds.
    await s1.query('BEGIN');
    await s1.query(`UPDATE ${T} SET deleted_at = NOW(), release_position = 3 WHERE id = $1`, [id24]);
    await s1.query('COMMIT');
    const whileDeleted = await snapshot();
    expect((await positions(arcs.one)).map((r) => r.slot_number)).not.toContain(24);

    await s1.query('BEGIN');
    await s1.query(`UPDATE ${T} SET deleted_at = NULL WHERE id = $1`, [id24]);
    expect(await codeOf(() => s1.query('COMMIT'))).toBe('23P01');
    expect(await snapshot()).toBe(whileDeleted);
  });

  // ── K9 ──────────────────────────────────────────────────────────────────
  test('K9: position 0, 25 or a negative number is refused at once (23514); 1 and 24 are in range', async () => {
    await reset();
    for (const bad of [0, 25, -1]) {
      await s1.query('BEGIN');
      expect(await codeOf(() => s1.query(`UPDATE ${T} SET release_position = $2 WHERE arc_id = $1 AND slot_number = 3`, [arcs.one, bad]))).toBe('23514');
      await s1.query('ROLLBACK');
    }
    // 1 and 24, exchanged with the slots that hold them.
    await s1.query('BEGIN');
    await setPosition(s1, arcs.one, 1, 24);
    await setPosition(s1, arcs.one, 24, 1);
    await s1.query('COMMIT');
    expect(isPermutation(await effective(arcs.one))).toBe(true);
  });

  // ── K10 ─────────────────────────────────────────────────────────────────
  test('K10: two slots exchange their episodes in one transaction; a live duplicate occupant fails 23P01; a soft-deleted duplicate is allowed', async () => {
    await reset();
    const a = uuid();
    const b = uuid();
    const occupy = (c, n, episodeId) => c.query(`UPDATE ${T} SET episode_id = $3 WHERE arc_id = $1 AND slot_number = $2 AND deleted_at IS NULL`, [arcs.one, n, episodeId]);
    await occupy(admin, 3, a);
    await occupy(admin, 7, b);

    await s1.query('BEGIN');
    await occupy(s1, 3, b); // for a moment b is in both E3 and E7
    await occupy(s1, 7, a);
    await s1.query('COMMIT');
    const rows = await positions(arcs.one);
    expect(rows.find((r) => r.slot_number === 3).episode_id).toBe(b);
    expect(rows.find((r) => r.slot_number === 7).episode_id).toBe(a);
    const before = await snapshot();

    // The same episode in a second live slot, in this season and in another.
    for (const [arcId, n] of [[arcs.one, 9], [arcs.two, 9]]) {
      await s1.query('BEGIN');
      await s1.query(`UPDATE ${T} SET episode_id = $3 WHERE arc_id = $1 AND slot_number = $2`, [arcId, n, a]);
      expect(await codeOf(() => s1.query('COMMIT'))).toBe('23P01');
      expect(await snapshot()).toBe(before);
    }

    // A soft-deleted row may name it too.
    await s1.query('BEGIN');
    await s1.query(`UPDATE ${T} SET episode_id = $2, deleted_at = NOW() WHERE arc_id = $1 AND slot_number = 24`, [arcs.one, a]);
    expect(await codeOf(() => s1.query('COMMIT'))).toBeNull();
    // Slots with no episode never collide with each other.
    expect((await admin.query(`SELECT count(*)::int AS n FROM ${T} WHERE deleted_at IS NULL AND episode_id IS NULL`)).rows[0].n).toBeGreaterThan(40);
  });

  // ── K11, K12 ────────────────────────────────────────────────────────────
  test('K11: a second session confirming with stale expected state updates 0 rows and changes nothing', async () => {
    await reset();
    // Both sessions "previewed" E3 at position 3. Session 1 swaps E3 and E7 and commits.
    await s1.query('BEGIN');
    await setPosition(s1, arcs.one, 3, 7);
    await setPosition(s1, arcs.one, 7, 3);
    await s1.query('COMMIT');
    const afterFirst = await snapshot();

    // Session 2 confirms E3 <-> E5, each update guarded by the position it previewed.
    const guarded = (c, n, expected, position) => c.query(
      `UPDATE ${T} SET release_position = NULLIF($4::int, slot_number)
        WHERE arc_id = $1 AND slot_number = $2 AND deleted_at IS NULL AND COALESCE(release_position, slot_number) = $3`,
      [arcs.one, n, expected, position]);
    await s2.query('BEGIN');
    const first = await guarded(s2, 3, 3, 5);
    expect(first.rowCount).toBe(0); // the signal for SEASON_PLACEMENT_STALE: stop, write nothing
    await s2.query('ROLLBACK');

    expect(await snapshot()).toBe(afterFirst);
    expect(isPermutation(await effective(arcs.one))).toBe(true);
  });

  test('K11: the same stale confirmation that waited on the row lock still updates 0 rows once the first session commits', async () => {
    await reset();
    await s1.query('BEGIN');
    await setPosition(s1, arcs.one, 3, 7);
    await setPosition(s1, arcs.one, 7, 3);
    // Session 2 starts while session 1 holds E3: it waits, then re-checks its predicate against the committed row.
    await s2.query('BEGIN');
    const waiting = s2.query(
      `UPDATE ${T} SET release_position = 5
        WHERE arc_id = $1 AND slot_number = 3 AND deleted_at IS NULL AND COALESCE(release_position, slot_number) = 3`, [arcs.one]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await s1.query('COMMIT');
    expect((await waiting).rowCount).toBe(0);
    await s2.query('ROLLBACK');
    expect(isPermutation(await effective(arcs.one))).toBe(true);
  });

  test('K12: two sessions without the expected-state check: the constraint refuses the second COMMIT (23P01) and the season stays valid', async () => {
    await reset();
    // Both read E3 at 3. Session 1 swaps E3 <-> E7; session 2 swaps E3 <-> E5 from its stale read.
    await s1.query('BEGIN');
    await setPosition(s1, arcs.one, 3, 7);
    await setPosition(s1, arcs.one, 7, 3);
    await s2.query('BEGIN');
    const waiting = setPosition(s2, arcs.one, 3, 5); // waits for session 1's lock on E3
    await new Promise((resolve) => setTimeout(resolve, 300));
    await s1.query('COMMIT');
    await waiting;
    await setPosition(s2, arcs.one, 5, 3); // 3 is E7's position now
    expect(await codeOf(() => s2.query('COMMIT'))).toBe('23P01');

    const rows = await positions(arcs.one);
    expect(isPermutation(rows.map((r) => r.position))).toBe(true);
    expect(rows.find((r) => r.slot_number === 3).position).toBe(7);
    expect(rows.find((r) => r.slot_number === 5).position).toBe(5);
  });

  // ── K13 ─────────────────────────────────────────────────────────────────
  test('K13: an error in the middle of the transaction: nothing commits, and COMMIT answers ROLLBACK', async () => {
    await reset();
    const before = await snapshot();
    await s1.query('BEGIN');
    await setPosition(s1, arcs.one, 3, 7);
    expect(await codeOf(() => s1.query('SELECT 1 / 0'))).toBe('22012');
    expect(await codeOf(() => setPosition(s1, arcs.one, 7, 3))).toBe('25P02'); // the transaction is aborted
    const end = await s1.query('COMMIT');
    expect(end.command).toBe('ROLLBACK');
    expect(await snapshot()).toBe(before);
  });

  // ── K14 ─────────────────────────────────────────────────────────────────
  test('K14: through Sequelize, a deferred violation rejects the managed transaction at COMMIT with 23P01, and nothing is written', async () => {
    await reset();
    const before = await snapshot();
    let reached = false;
    let caught = null;
    try {
      await sequelize.transaction(async (transaction) => {
        await sequelize.query(
          `UPDATE ${T} SET release_position = 7 WHERE arc_id = :arcId AND slot_number = 3 AND deleted_at IS NULL`,
          { replacements: { arcId: arcs.one }, transaction });
        reached = true; // every statement succeeded: the refusal can only come from COMMIT
      });
    } catch (err) {
      caught = err;
    }
    expect(reached).toBe(true);
    expect(caught).not.toBeNull();
    // The signal for SEASON_PLACEMENT_INTEGRITY. It is not a lock conflict, so it is never offered as "try again".
    expect(caught.original?.code || caught.parent?.code || caught.code).toBe('23P01');
    expect(isLockConflict(caught)).toBe(false);
    expect(await snapshot()).toBe(before);

    // And a valid exchange through the same path commits.
    await sequelize.transaction(async (transaction) => {
      for (const [n, p] of [[3, 7], [7, 3]]) {
        await sequelize.query(
          `UPDATE ${T} SET release_position = :p WHERE arc_id = :arcId AND slot_number = :n AND deleted_at IS NULL`,
          { replacements: { arcId: arcs.one, n, p }, transaction });
      }
    });
    expect(isPermutation(await effective(arcs.one))).toBe(true);
  });

  // ── K17 ─────────────────────────────────────────────────────────────────
  test('K17: a lock wait that times out is 55P03; nothing is written and the existing lock-conflict check recognises it', async () => {
    await reset();
    const before = await snapshot();
    const lock = (c, n) => c.query(`SELECT id FROM ${T} WHERE arc_id = $1 AND slot_number = $2 AND deleted_at IS NULL FOR UPDATE`, [arcs.one, n]);
    await s1.query('BEGIN');
    await lock(s1, 3);
    await s2.query('BEGIN');
    await s2.query("SET LOCAL lock_timeout = '200ms'");
    let err = null;
    try {
      await lock(s2, 3);
    } catch (e) {
      err = e;
    }
    expect(err?.code).toBe('55P03');
    expect(isLockConflict(err)).toBe(true);
    await s2.query('ROLLBACK');
    await s1.query('ROLLBACK');
    expect(await snapshot()).toBe(before);
  });

  test('K17: two sessions locking the same two slots in opposite order: one is refused (40P01 or 55P03), the other can finish, and the season stays valid', async () => {
    await reset();
    const lock = (c, n) => c.query(`SELECT id FROM ${T} WHERE arc_id = $1 AND slot_number = $2 AND deleted_at IS NULL FOR UPDATE`, [arcs.one, n]);
    for (const c of [s1, s2]) {
      await c.query('BEGIN');
      await c.query("SET LOCAL lock_timeout = '5s'");
    }
    await lock(s1, 3);
    await lock(s2, 7);
    const outcome = async (p) => {
      try {
        await p;
        return null;
      } catch (e) {
        return e;
      }
    };
    const [r1, r2] = await Promise.all([outcome(lock(s1, 7)), outcome(lock(s2, 3))]);
    const failed = [r1, r2].filter(Boolean);
    expect(failed.length).toBeGreaterThanOrEqual(1);
    for (const e of failed) {
      expect(['40P01', '55P03']).toContain(e.code);
      expect(isLockConflict(e)).toBe(true);
    }
    // The session that was not refused (if any) completes its swap; the refused one rolls back. One attempt each.
    if (!r1) {
      await setPosition(s1, arcs.one, 3, 7);
      await setPosition(s1, arcs.one, 7, 3);
      await s1.query('COMMIT');
    } else {
      await s1.query('ROLLBACK');
    }
    if (!r2) {
      await setPosition(s2, arcs.one, 3, 7);
      await setPosition(s2, arcs.one, 7, 3);
      await s2.query('COMMIT');
    } else {
      await s2.query('ROLLBACK');
    }
    expect(isPermutation(await effective(arcs.one))).toBe(true);
  });

  test('the server version these results are for is recorded', () => {
    // Printed so a run's output says which PostgreSQL it proved the rules on.
    // eslint-disable-next-line no-console
    console.info(`[A2 constraints] PostgreSQL ${serverVersion}`);
    expect(Number(String(serverVersion).split('.')[0])).toBeGreaterThanOrEqual(15);
  });
});

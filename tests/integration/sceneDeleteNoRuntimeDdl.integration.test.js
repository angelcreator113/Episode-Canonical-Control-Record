/**
 * Deleting a scene changes no schema, and the delete and the renumbering are
 * one transaction (Evoni, 2026-11-22; the runtime-DDL inventory's D9).
 *
 * Before: DELETE /api/v1/scenes/:id soft-deleted the scene, committed, and
 * then, in a second transaction, took idx_scenes_episode_scene_number away,
 * renumbered the episode's scenes and put the index back. Production's
 * `scenes` has that index, owned by `postgres`; the application's role cannot
 * take it away, so there the renumbering failed after the delete had
 * committed and the caller got a 500 for a scene that was gone. A freshly
 * migrated database has no such index, and the first delete made one.
 *
 * Two shapes of `scenes`, each in a schema of this suite's own, so the public
 * table (and whether it happens to carry the index) plays no part and nothing
 * public is changed:
 *   - "absent":  the migrated table, no (episode_id, scene_number) index;
 *   - "present": the same table with production's partial unique index.
 * The controller and the models are loaded once per shape, on a connection
 * whose search_path puts that schema first: `scenes` is the suite's table,
 * `episodes` and everything else are public's. A third load connects as a
 * role that does not own the table, as the application does in production.
 *
 * The handlers are called directly (no router): authorization is the
 * route's, and this suite is about what the handler does to the database.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const lockTrace = require('../helpers/lockTrace');

const ADMIN_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const shouldSkip = !ADMIN_URL || ADMIN_URL.includes('amazonaws.com') || !ADMIN_URL.includes('episode_metadata_test');

const tag = crypto.randomBytes(4).toString('hex');
const SCHEMAS = { absent: `scenedel_absent_${tag}`, present: `scenedel_present_${tag}` };
const INDEX = 'idx_scenes_episode_scene_number';
const ROLE = `scenedel_app_${tag}`;
const PASSWORD = `pw-${crypto.randomBytes(12).toString('hex')}`;
const uuid = () => crypto.randomUUID();
const dbName = () => new URL(ADMIN_URL).pathname.replace(/^\//, '');
const roleUrl = () => {
  const u = new URL(ADMIN_URL);
  u.username = ROLE;
  u.password = PASSWORD;
  return u.toString();
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const DDL = /^\s*(?:DROP|CREATE|ALTER|TRUNCATE|REINDEX|GRANT|REVOKE)\b/i;

/** The controller and its models on a connection that sees `schema` before public. */
function load(schema, url = ADMIN_URL) {
  const saved = { DATABASE_URL: process.env.DATABASE_URL, TEST_DATABASE_URL: process.env.TEST_DATABASE_URL };
  process.env.DATABASE_URL = url;
  process.env.TEST_DATABASE_URL = url;
  let loaded;
  try {
    jest.isolateModules(() => {
      const { sequelize, models } = require('../../src/models');
      sequelize.addHook('afterConnect', (connection) => connection.query(`SET search_path TO ${schema}, public`));
      loaded = { sequelize, models, controller: require('../../src/controllers/sceneController') };
    });
  } finally {
    process.env.DATABASE_URL = saved.DATABASE_URL;
    process.env.TEST_DATABASE_URL = saved.TEST_DATABASE_URL;
  }
  return loaded;
}

/** Calls a handler as Express would and resolves what it answered. */
function call(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body }); return this; },
    };
    Promise.resolve(handler({ params: {}, body: {}, query: {}, ...req }, res)).catch(reject);
  });
}

(shouldSkip ? describe.skip : describe)('Deleting a scene: one transaction, no schema change', () => {
  jest.setTimeout(90000);
  let admin;
  const show = uuid();
  const episodes = [];
  const regs = {};
  let asRole;

  const q = async (sql, replacements = {}) => (await admin.query(sql, { replacements }))[0];

  async function episode() {
    const ep = uuid();
    await q(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
             VALUES (:ep, :show, 'Scene delete ep', :n, 'draft', NOW(), NOW())`, { ep, show, n: Math.floor(Math.random() * 1000000) + 500 });
    episodes.push(ep);
    return ep;
  }
  /** Scenes for an episode in one shape: [number, { deleted, locked }] each; resolves their ids in order. */
  async function seed(shape, ep, defs) {
    const ids = [];
    let i = 0;
    for (const def of defs) {
      const [number, opts = {}] = Array.isArray(def) ? def : [def];
      const id = uuid();
      i += 1;
      await q(`INSERT INTO ${SCHEMAS[shape]}.scenes (id, episode_id, scene_number, title, is_locked, deleted_at, created_at, updated_at)
               VALUES (:id, :ep, :number, :title, :locked, :deleted, NOW() + (:i * interval '1 millisecond'), NOW())`,
      { id, ep, number, title: `Scene ${i}`, locked: !!opts.locked, deleted: opts.deleted ? new Date() : null, i });
      ids.push(id);
    }
    return ids;
  }
  const all = (shape, ep) => q(`SELECT * FROM ${SCHEMAS[shape]}.scenes WHERE episode_id = :ep ORDER BY created_at, id`, { ep });
  const live = async (shape, ep) => (await q(
    `SELECT id, scene_number FROM ${SCHEMAS[shape]}.scenes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY scene_number, created_at, id`, { ep }))
    .map((r) => [r.id, r.scene_number]);
  const one = async (shape, id) => (await q(`SELECT * FROM ${SCHEMAS[shape]}.scenes WHERE id = :id`, { id }))[0];
  /** Every index of the shape's table: name, oid, storage file, definition and the table's owner. */
  const indexes = (shape) => q(
    `SELECT i.relname AS name, i.oid::text AS oid, i.relfilenode::text AS file, pg_get_indexdef(i.oid) AS def, pg_get_userbyid(t.relowner) AS owner
       FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid JOIN pg_class t ON t.oid = x.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = :schema AND t.relname = 'scenes' ORDER BY i.relname`, { schema: SCHEMAS[shape] });
  const del = (reg, id) => call(reg.controller.deleteScene, { params: { id } });
  const reorder = (reg, episodeId, sceneIds) => call(reg.controller.reorderScenes, { params: { episodeId }, body: { sceneIds } });
  /** Resolves 'pending' when the promise has not settled within ms. */
  const settledWithin = (promise, ms) => Promise.race([promise.then(() => 'settled'), sleep(ms).then(() => 'pending')]);

  beforeAll(async () => {
    admin = new Sequelize(ADMIN_URL, { logging: false });
    await q(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `Scene delete ${tag}`, slug: `scene-delete-${tag}` });
    for (const shape of ['absent', 'present']) {
      const schema = SCHEMAS[shape];
      await admin.query(`CREATE SCHEMA ${schema}`);
      // The migrated table's columns, defaults and checks; indexes are named here, so public's play no part.
      await admin.query(`CREATE TABLE ${schema}.scenes (LIKE public.scenes INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING GENERATED INCLUDING IDENTITY)`);
      await admin.query(`ALTER TABLE ${schema}.scenes ADD PRIMARY KEY (id)`);
    }
    // Production's index (read 2026-11-06: unique on (episode_id, scene_number) WHERE deleted_at IS NULL).
    await admin.query(`CREATE UNIQUE INDEX ${INDEX} ON ${SCHEMAS.present}.scenes (episode_id, scene_number) WHERE deleted_at IS NULL`);

    // The application's place in production: a login that may read and write the rows and does not own the table.
    await admin.query(`CREATE ROLE "${ROLE}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '${PASSWORD}'`);
    await admin.query(`GRANT CONNECT ON DATABASE "${dbName()}" TO "${ROLE}"`);
    await admin.query(`GRANT USAGE ON SCHEMA public, ${SCHEMAS.present} TO "${ROLE}"`);
    await admin.query(`GRANT SELECT, INSERT, UPDATE ON ${SCHEMAS.present}.scenes TO "${ROLE}"`);
    await admin.query(`GRANT SELECT, UPDATE ON public.episodes TO "${ROLE}"`);

    regs.absent = load(SCHEMAS.absent);
    regs.present = load(SCHEMAS.present);
    asRole = load(SCHEMAS.present, roleUrl());
  });

  afterAll(async () => {
    for (const reg of [regs.absent, regs.present, asRole]) {
      if (reg) await reg.sequelize.close().catch((err) => console.error('[test] close failed:', err.message));
    }
    if (!admin) return;
    // Only what this suite made: its two schemas, its role, its episodes and its show.
    const quietly = (sql, replacements) => admin.query(sql, { replacements }).catch((err) => console.error('[test] cleanup failed:', err.message));
    await quietly(`REVOKE ALL ON public.episodes FROM "${ROLE}"`);
    await quietly(`REVOKE ALL ON SCHEMA public FROM "${ROLE}"`);
    await quietly(`REVOKE ALL ON DATABASE "${dbName()}" FROM "${ROLE}"`);
    for (const schema of Object.values(SCHEMAS)) await quietly(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await quietly(`DROP ROLE IF EXISTS "${ROLE}"`);
    if (episodes.length) await quietly('DELETE FROM episodes WHERE id IN (:episodes)', { episodes });
    await quietly('DELETE FROM shows WHERE id = :show', { show });
    await admin.close();
  });

  afterEach(() => jest.restoreAllMocks());

  it('each shape is what it says: its own scenes table, with and without the index, and public is not it', async () => {
    for (const shape of ['absent', 'present']) {
      const [[{ schema }]] = await regs[shape].sequelize.query(
        `SELECT n.nspname AS schema FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.oid = 'scenes'::regclass`);
      expect(schema).toBe(SCHEMAS[shape]);
      const [[{ episodes: where }]] = await regs[shape].sequelize.query(
        `SELECT n.nspname AS episodes FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.oid = 'episodes'::regclass`);
      expect(where).toBe('public');
    }
    expect((await indexes('absent')).map((i) => i.name)).toEqual(['scenes_pkey']);
    const present = await indexes('present');
    expect(present.map((i) => i.name)).toEqual([INDEX, 'scenes_pkey']);
    expect(present[0].def).toMatch(/UNIQUE INDEX .* \(episode_id, scene_number\) WHERE \(deleted_at IS NULL\)/);
    // The index bites: a second live scene with a taken number is refused there, and accepted where there is none.
    const ep = await episode();
    await seed('present', ep, [1]);
    await expect(seed('present', ep, [1])).rejects.toMatchObject({ name: 'SequelizeUniqueConstraintError', original: { code: '23505' } });
    await seed('absent', ep, [1, 1]);
  });

  describe.each(['absent', 'present'])('the (episode_id, scene_number) index %s', (shape) => {
    const reg = () => regs[shape];

    it('a middle scene: it is soft-deleted, the rest read 1..n in their order, the answer is as it was, and the indexes are the same objects', async () => {
      const ep = await episode();
      const ids = await seed(shape, ep, [1, 2, 3, 4, 5]);
      const before = await indexes(shape);
      const trace = lockTrace.install(reg().sequelize);
      let res;
      try { res = await del(reg(), ids[2]); } finally { trace.uninstall(); }

      expect(res).toEqual({ status: 200, body: { success: true, message: 'Scene deleted successfully', data: { deletedSceneId: ids[2], episode_id: ep } } });
      expect(await live(shape, ep)).toEqual([[ids[0], 1], [ids[1], 2], [ids[3], 3], [ids[4], 4]]);
      const gone = await one(shape, ids[2]);
      expect(gone.deleted_at).not.toBeNull();
      expect(gone.scene_number).toBe(3); // the deleted row keeps its number
      // Same names, same oids, same storage files, same definitions, same owner: nothing was dropped, made or rebuilt.
      expect(await indexes(shape)).toEqual(before);

      // No statement of the request is DDL.
      const sql = trace.records.map((r) => r.sql || r.kind);
      expect(sql.filter((s) => DDL.test(s))).toEqual([]);
      expect(sql.join('\n')).not.toMatch(/idx_scenes_episode_scene_number|\bINDEX\b/i);
      // One transaction holds everything that wrote: it began, locked the episode, wrote, and committed once.
      const kinds = trace.records.map((r) => r.kind);
      expect(kinds.filter((k) => k === 'begin')).toHaveLength(1);
      expect(kinds.filter((k) => k === 'commit')).toHaveLength(1);
      expect(kinds).not.toContain('rollback');
      const writes = trace.records.filter((r) => r.kind === 'write' || r.kind === 'insert');
      expect(writes.length).toBeGreaterThanOrEqual(3); // the soft delete and the two renumbering statements
      const tx = new Set(writes.map((r) => r.txId));
      expect(tx.size).toBe(1);
      expect([...tx][0]).toBeTruthy();
      const episodeLock = trace.records.findIndex((r) => r.kind === 'lock' && r.table === 'episodes' && r.mode === 'update');
      const firstWrite = trace.records.findIndex((r) => r.kind === 'write');
      expect(episodeLock).toBeGreaterThanOrEqual(0);
      expect(episodeLock).toBeLessThan(firstWrite);
      expect(trace.records[episodeLock].ids).toEqual([ep]);
      expect(trace.records[episodeLock].txId).toBe([...tx][0]);
    });

    it('the last scene, and the only scene: deleted, and no other row is written', async () => {
      const ep = await episode();
      const ids = await seed(shape, ep, [1, 2, 3]);
      const rowsBefore = await all(shape, ep);
      const trace = lockTrace.install(reg().sequelize);
      let res;
      try { res = await del(reg(), ids[2]); } finally { trace.uninstall(); }
      expect(res.status).toBe(200);
      expect(await live(shape, ep)).toEqual([[ids[0], 1], [ids[1], 2]]);
      expect((await all(shape, ep)).slice(0, 2)).toEqual(rowsBefore.slice(0, 2)); // updated_at included
      expect(trace.records.filter((r) => r.kind === 'write')).toHaveLength(1); // the soft delete alone

      const solo = await episode();
      const [only] = await seed(shape, solo, [1]);
      expect((await del(reg(), only)).status).toBe(200);
      expect(await live(shape, solo)).toEqual([]);
      expect((await one(shape, only)).deleted_at).not.toBeNull();
    });

    it('soft-deleted scenes that hold the same numbers are not read and not written', async () => {
      const ep = await episode();
      const ids = await seed(shape, ep, [[2, { deleted: true }], [3, { deleted: true }], 1, 2, 3]);
      const deletedBefore = (await all(shape, ep)).slice(0, 2);
      expect((await del(reg(), ids[2])).status).toBe(200);
      expect(await live(shape, ep)).toEqual([[ids[3], 1], [ids[4], 2]]);
      expect((await all(shape, ep)).slice(0, 2)).toEqual(deletedBefore);
    });

    it('numbers with gaps and numbers in the thousands end 1..n in the same order', async () => {
      const ep = await episode();
      const ids = await seed(shape, ep, [5, 1000, 1001, 2000, 2147480000]);
      expect((await del(reg(), ids[1])).status).toBe(200);
      expect(await live(shape, ep)).toEqual([[ids[0], 1], [ids[2], 2], [ids[3], 3], [ids[4], 4]]);
      // And when the numbers in use are lower than the count of scenes left over.
      const low = await episode();
      const lowIds = await seed(shape, low, [2, 3, 4, 5]);
      expect((await del(reg(), lowIds[0])).status).toBe(200);
      expect(await live(shape, low)).toEqual([[lowIds[1], 1], [lowIds[2], 2], [lowIds[3], 3]]);
    });

    it('an id that is no scene: 404 as before, nothing begun that writes', async () => {
      const ep = await episode();
      await seed(shape, ep, [1, 2]);
      const before = await all(shape, ep);
      const trace = lockTrace.install(reg().sequelize);
      let res;
      try { res = await del(reg(), uuid()); } finally { trace.uninstall(); }
      expect(res).toEqual({ status: 404, body: { success: false, error: 'Scene not found' } });
      expect(trace.records.filter((r) => r.kind === 'write' || r.kind === 'insert' || r.kind === 'lock')).toEqual([]);
      expect(await all(shape, ep)).toEqual(before);
    });

    it('a locked scene: 400 as before, and the scene and every number are as they were', async () => {
      const ep = await episode();
      const ids = await seed(shape, ep, [1, [2, { locked: true }], 3]);
      const before = await all(shape, ep);
      const trace = lockTrace.install(reg().sequelize);
      let res;
      try { res = await del(reg(), ids[1]); } finally { trace.uninstall(); }
      expect(res).toEqual({ status: 400, body: { success: false, error: 'Cannot delete locked scene', message: 'This scene is locked for editing' } });
      expect(trace.records.filter((r) => r.kind === 'write' || r.kind === 'insert')).toEqual([]);
      expect(await all(shape, ep)).toEqual(before);
    });

    it.each([['the first renumbering statement', 1], ['the second renumbering statement', 2]])(
      'a failure at %s: 500, and the delete rolls back with the numbering (no scene deleted, no number moved)', async (_name, failAt) => {
        const ep = await episode();
        const ids = await seed(shape, ep, [1, 2, 3, 4]);
        const before = await all(shape, ep);
        const indexesBefore = await indexes(shape);
        const sequelize = reg().sequelize;
        const real = sequelize.query.bind(sequelize);
        let seen = 0;
        const statements = [];
        jest.spyOn(sequelize, 'query').mockImplementation(async (sql, options) => {
          const text = String(typeof sql === 'object' && sql !== null && sql.query ? sql.query : sql);
          statements.push(text.replace(/\s+/g, ' ').trim());
          if (/UPDATE scenes AS s SET scene_number/.test(text)) {
            seen += 1;
            if (seen === failAt) {
              if (failAt === 2) await real(sql, options); // the statement ran, then the connection reports a failure
              throw new Error('renumbering interrupted');
            }
          }
          return real(sql, options);
        });
        jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await del(reg(), ids[1]);

        expect(res).toEqual({ status: 500, body: { success: false, error: 'Failed to delete scene', message: 'renumbering interrupted' } });
        expect(statements.some((s) => /^ROLLBACK/i.test(s))).toBe(true);
        expect(statements.some((s) => /^COMMIT/i.test(s))).toBe(false);
        jest.restoreAllMocks();
        // The scene is still there, live; every row is as it was, updated_at included.
        expect(await all(shape, ep)).toEqual(before);
        expect((await one(shape, ids[1])).deleted_at).toBeNull();
        expect(await indexes(shape)).toEqual(indexesBefore);
        // And the same delete, tried again, works.
        expect((await del(reg(), ids[1])).status).toBe(200);
        expect(await live(shape, ep)).toEqual([[ids[0], 1], [ids[2], 2], [ids[3], 3]]);
      });

    it('two deletes in one episode at the same moment: both succeed, one after the other, and the numbers end 1..n', async () => {
      const ep = await episode();
      const ids = await seed(shape, ep, [1, 2, 3, 4, 5]);
      const trace = lockTrace.install(reg().sequelize);
      try {
        // The first is held just after it took the episode's lock.
        const gate = trace.gate((r) => r.kind === 'lock' && r.table === 'episodes');
        const first = del(reg(), ids[1]);
        await gate.reached;
        const second = del(reg(), ids[3]);
        expect(await settledWithin(second, 400)).toBe('pending'); // it waits for the episode
        expect((await one(shape, ids[3])).deleted_at).toBeNull();
        gate.open();
        const [a, b] = await Promise.all([first, second]);
        expect([a.status, b.status]).toEqual([200, 200]);
      } finally { trace.uninstall(); }
      expect(await live(shape, ep)).toEqual([[ids[0], 1], [ids[2], 2], [ids[4], 3]]);
      expect(trace.records.filter((r) => r.error)).toEqual([]);

      // Unheld, several at once, and the same scene twice.
      const many = await episode();
      const manyIds = await seed(shape, many, [1, 2, 3, 4, 5, 6]);
      const results = await Promise.all([del(reg(), manyIds[0]), del(reg(), manyIds[2]), del(reg(), manyIds[2]), del(reg(), manyIds[5])]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 404]);
      expect(await live(shape, many)).toEqual([[manyIds[1], 1], [manyIds[3], 2], [manyIds[4], 3]]);
    });

    it('a delete and a reorder of one episode at the same moment, in either order: both succeed and the numbers end 1..n with no gap', async () => {
      // The delete holds the episode; the reorder (which lists the scene being deleted) waits, then orders what is left.
      const ep = await episode();
      const ids = await seed(shape, ep, [1, 2, 3, 4]);
      const wanted = [ids[3], ids[2], ids[1], ids[0]];
      let trace = lockTrace.install(reg().sequelize);
      try {
        const gate = trace.gate((r) => r.kind === 'lock' && r.table === 'episodes');
        const deleting = del(reg(), ids[1]);
        await gate.reached;
        const reordering = reorder(reg(), ep, wanted);
        expect(await settledWithin(reordering, 400)).toBe('pending');
        gate.open();
        const [d, r] = await Promise.all([deleting, reordering]);
        expect([d.status, r.status]).toEqual([200, 200]);
        expect(r.body.data.map((s) => s.id)).toEqual([ids[3], ids[2], ids[0]]);
      } finally { trace.uninstall(); }
      expect(await live(shape, ep)).toEqual([[ids[3], 1], [ids[2], 2], [ids[0], 3]]);
      expect((await one(shape, ids[1])).deleted_at).not.toBeNull();
      expect(trace.records.filter((rec) => rec.error)).toEqual([]);

      // The reorder holds the episode; the delete waits, then closes the gap in the new order.
      const ep2 = await episode();
      const ids2 = await seed(shape, ep2, [1, 2, 3, 4]);
      trace = lockTrace.install(reg().sequelize);
      try {
        const gate = trace.gate((r) => r.kind === 'lock' && r.table === 'episodes');
        const reordering = reorder(reg(), ep2, [ids2[3], ids2[2], ids2[1], ids2[0]]);
        await gate.reached;
        const deleting = del(reg(), ids2[2]);
        expect(await settledWithin(deleting, 400)).toBe('pending');
        gate.open();
        const [r, d] = await Promise.all([reordering, deleting]);
        expect([r.status, d.status]).toEqual([200, 200]);
      } finally { trace.uninstall(); }
      expect(await live(shape, ep2)).toEqual([[ids2[3], 1], [ids2[1], 2], [ids2[0], 3]]);
      expect(trace.records.filter((rec) => rec.error)).toEqual([]);

      // Unheld, at once: whichever goes first, the result has no gap and no repeat.
      const ep3 = await episode();
      const ids3 = await seed(shape, ep3, [1, 2, 3, 4, 5]);
      const both = await Promise.all([del(reg(), ids3[0]), reorder(reg(), ep3, [...ids3].reverse()), del(reg(), ids3[4])]);
      expect(both.map((x) => x.status)).toEqual([200, 200, 200]);
      const left = await live(shape, ep3);
      expect(left.map(([, n]) => n)).toEqual([1, 2, 3]);
      expect(left.map(([id]) => id).sort()).toEqual([ids3[1], ids3[2], ids3[3]].sort());
    });

    it('another episode is not held up: while a delete is part-way, the other episode deletes, reorders, reads and gains a scene', async () => {
      const epA = await episode();
      const epB = await episode();
      const a = await seed(shape, epA, [1, 2, 3]);
      const b = await seed(shape, epB, [1, 2, 3, 4]);
      const trace = lockTrace.install(reg().sequelize);
      try {
        // Episode A's delete is held after its first renumbering statement: it holds A's lock and A's scene rows.
        const gate = trace.gate((r) => r.kind === 'write' && /SET scene_number/.test(r.sql || ''));
        const deletingA = del(reg(), a[0]);
        await gate.reached;

        const started = Date.now();
        const read = await reg().models.Scene.findAll({ where: { episode_id: epB }, order: [['scene_number', 'ASC']] });
        expect(read.map((s) => s.id)).toEqual(b);
        expect((await del(reg(), b[1])).status).toBe(200);
        expect((await reorder(reg(), epB, [b[3], b[2], b[0]])).status).toBe(200);
        await reg().sequelize.query(
          `INSERT INTO scenes (id, episode_id, scene_number, title, created_at, updated_at) VALUES (:id, :ep, 4, 'Added', NOW(), NOW())`,
          { replacements: { id: uuid(), ep: epB } });
        expect(Date.now() - started).toBeLessThan(5000); // none of it waited for A (the lock wait alone is 10 s)
        expect(await settledWithin(deletingA, 50)).toBe('pending'); // A is still part-way

        gate.open();
        expect((await deletingA).status).toBe(200);
      } finally { trace.uninstall(); }
      expect(await live(shape, epA)).toEqual([[a[1], 1], [a[2], 2]]);
      expect((await live(shape, epB)).map(([, n]) => n)).toEqual([1, 2, 3, 4]);
    });

    // ── reorderScenes: the same numbering, so the same lock (Evoni, 2026-11-22) ──

    it('a reorder: the answer is as it was, in one transaction that locks the episode before it reads a scene, with no DDL and the indexes untouched', async () => {
      const ep = await episode();
      const ids = await seed(shape, ep, [1, 2, 3, 4]);
      const wanted = [ids[2], ids[0], ids[3], ids[1]];
      const before = await indexes(shape);
      // Every statement in full (the tracer keeps only the start of a long SELECT), with its transaction.
      const sequelize = reg().sequelize;
      const real = sequelize.query.bind(sequelize);
      const sent0 = [];
      jest.spyOn(sequelize, 'query').mockImplementation(async (sql, options) => {
        const text = String(typeof sql === 'object' && sql !== null && sql.query ? sql.query : sql).replace(/\s+/g, ' ').trim();
        sent0.push({ text, txId: options?.transaction?.id || null });
        return real(sql, options);
      });
      const res = await reorder(reg(), ep, wanted);
      jest.restoreAllMocks();

      // The body main's handler sends: success, the reordered scenes, the message; nothing added.
      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toEqual(['success', 'data', 'message']);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Scenes reordered successfully');
      const sent = JSON.parse(JSON.stringify(res.body.data));
      expect(sent.map((s) => [s.id, s.sceneNumber])).toEqual(wanted.map((id, i) => [id, i + 1])); // the model's own JSON names it sceneNumber
      const stored = JSON.parse(JSON.stringify(await reg().models.Scene.findAll({ where: { episode_id: ep }, order: [['scene_number', 'ASC']] })));
      expect(sent).toEqual(stored); // each scene as the model serializes it, as before
      expect(await live(shape, ep)).toEqual(wanted.map((id, i) => [id, i + 1]));
      expect(await indexes(shape)).toEqual(before);

      const texts = sent0.map((s) => s.text);
      expect(texts.filter((s) => DDL.test(s))).toEqual([]);
      expect(texts.join('\n')).not.toMatch(/idx_scenes_episode_scene_number|\bINDEX\b/i);
      expect(texts.filter((s) => /^START TRANSACTION|^BEGIN/i.test(s))).toHaveLength(1);
      expect(texts.filter((s) => /^COMMIT/i.test(s))).toHaveLength(1);
      expect(texts.filter((s) => /^ROLLBACK/i.test(s))).toEqual([]);
      // Every statement on scenes (the reads of the rows to reorder, and both passes) is in the one transaction...
      const onScenes = sent0.filter((s) => /\b(?:FROM|UPDATE|INTO)\s+"?scenes"?\b/i.test(s.text));
      const reads = onScenes.filter((s) => /^SELECT/i.test(s.text));
      const writes = onScenes.filter((s) => /^UPDATE/i.test(s.text));
      // One locked read of the episode's live scenes (the numbers in use), the four reads of the listed scenes, then
      // the two passes of four, as before.
      expect([reads.length, writes.length]).toEqual([5, 8]);
      expect(reads[0].text).toMatch(/^SELECT id, scene_number FROM scenes WHERE episode_id = .* AND deleted_at IS NULL ORDER BY .* FOR UPDATE$/);
      const tx = new Set(onScenes.map((s) => s.txId));
      expect(tx.size).toBe(1);
      expect([...tx][0]).toBeTruthy();
      // ...and the episode's lock, in that transaction, comes before the first of them.
      const episodeLock = sent0.findIndex((s) => /FROM episodes WHERE id IN .* FOR UPDATE/i.test(s.text));
      expect(episodeLock).toBeGreaterThanOrEqual(0);
      expect(sent0[episodeLock].txId).toBe([...tx][0]);
      expect(episodeLock).toBeLessThan(sent0.indexOf(onScenes[0]));
      // The only statement outside the transaction is the episode's existence check, as before.
      expect(sent0.filter((s) => !s.txId && !/^START TRANSACTION|^BEGIN|^COMMIT/i.test(s.text)).every((s) => /FROM "?episodes"?/i.test(s.text))).toBe(true);
    });

    it('a reorder asked wrongly answers as it did: 400 for no list, 404 for no such episode, nothing begun', async () => {
      const ep = await episode();
      const ids = await seed(shape, ep, [1, 2]);
      const before = await all(shape, ep);
      const trace = lockTrace.install(reg().sequelize);
      try {
        for (const sceneIds of [undefined, null, 'x', {}, []]) {
          expect(await call(reg().controller.reorderScenes, { params: { episodeId: ep }, body: { sceneIds } }))
            .toEqual({ status: 400, body: { success: false, error: 'sceneIds must be a non-empty array' } });
        }
        expect(await reorder(reg(), uuid(), ids)).toEqual({ status: 404, body: { success: false, error: 'Episode not found' } });
      } finally { trace.uninstall(); }
      expect(trace.records.filter((r) => r.kind === 'begin' || r.kind === 'write' || r.kind === 'lock')).toEqual([]);
      expect(await all(shape, ep)).toEqual(before);
      // Ids of another episode, and ids that are no scene, are passed over as before.
      const other = await episode();
      const [foreign] = await seed(shape, other, [1]);
      const res = await reorder(reg(), ep, [ids[1], foreign, uuid(), ids[0]]);
      expect(res.status).toBe(200);
      expect(res.body.data.map((s) => s.id)).toEqual([ids[1], ids[0]]);
      expect(await live(shape, ep)).toEqual([[ids[1], 1], [ids[0], 2]]);
      expect(await live(shape, other)).toEqual([[foreign, 1]]);
    });

    it.each([
      ['between the two passes (the first statement of the second pass never runs)', 5, false],
      ['during the second pass (its second statement runs, then fails)', 6, true],
      ['during the first pass', 2, true],
    ])('a reorder that fails %s: 500, and every number and updated_at is as it was', async (_name, failAt, runFirst) => {
      const ep = await episode();
      const ids = await seed(shape, ep, [1, 2, 3, 4]);
      const before = await all(shape, ep);
      const indexesBefore = await indexes(shape);
      const sequelize = reg().sequelize;
      const real = sequelize.query.bind(sequelize);
      let seen = 0;
      const statements = [];
      jest.spyOn(sequelize, 'query').mockImplementation(async (sql, options) => {
        const text = String(typeof sql === 'object' && sql !== null && sql.query ? sql.query : sql).replace(/\s+/g, ' ').trim();
        statements.push(text);
        if (/^UPDATE "?scenes"?/i.test(text)) {
          seen += 1;
          if (seen === failAt) {
            if (runFirst) await real(sql, options);
            throw new Error('reorder interrupted');
          }
        }
        return real(sql, options);
      });
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await reorder(reg(), ep, [ids[3], ids[2], ids[1], ids[0]]);

      expect(res).toEqual({ status: 500, body: { success: false, error: 'Failed to reorder scenes', message: 'reorder interrupted' } });
      expect(seen).toBe(failAt);
      expect(statements.some((s) => /^ROLLBACK/i.test(s))).toBe(true);
      expect(statements.some((s) => /^COMMIT/i.test(s))).toBe(false);
      jest.restoreAllMocks();
      expect(await all(shape, ep)).toEqual(before); // scene_number and updated_at of every row
      expect(await indexes(shape)).toEqual(indexesBefore);
      // The same reorder, tried again, works.
      expect((await reorder(reg(), ep, [ids[3], ids[2], ids[1], ids[0]])).status).toBe(200);
      expect(await live(shape, ep)).toEqual([[ids[3], 1], [ids[2], 2], [ids[1], 3], [ids[0], 4]]);
    });

    it('two reorders of one episode at the same moment: the second waits for the first, both succeed, and the second order stands', async () => {
      const ep = await episode();
      const ids = await seed(shape, ep, [1, 2, 3, 4]);
      const trace = lockTrace.install(reg().sequelize);
      try {
        const gate = trace.gate((r) => r.kind === 'lock' && r.table === 'episodes');
        const first = reorder(reg(), ep, [ids[3], ids[2], ids[1], ids[0]]);
        await gate.reached;
        const second = reorder(reg(), ep, [ids[1], ids[0], ids[3], ids[2]]);
        expect(await settledWithin(second, 400)).toBe('pending');
        expect(await live(shape, ep)).toEqual(ids.map((id, i) => [id, i + 1])); // nothing committed yet
        gate.open();
        const [a, b] = await Promise.all([first, second]);
        expect([a.status, b.status]).toEqual([200, 200]);
      } finally { trace.uninstall(); }
      expect(await live(shape, ep)).toEqual([[ids[1], 1], [ids[0], 2], [ids[3], 3], [ids[2], 4]]);
      expect(trace.records.filter((r) => r.error)).toEqual([]);
    });

    it('another episode is not held up while a reorder is part-way: it reads, reorders, deletes and gains a scene', async () => {
      const epA = await episode();
      const epB = await episode();
      const a = await seed(shape, epA, [1, 2, 3]);
      const b = await seed(shape, epB, [1, 2, 3, 4]);
      const trace = lockTrace.install(reg().sequelize);
      try {
        // Episode A's reorder is held after the first statement of its first pass: it holds A's lock and one of A's rows.
        const gate = trace.gate((r) => r.kind === 'write' && r.table === 'scenes');
        const reorderingA = reorder(reg(), epA, [a[2], a[1], a[0]]);
        await gate.reached;

        const started = Date.now();
        const read = await reg().models.Scene.findAll({ where: { episode_id: epB }, order: [['scene_number', 'ASC']] });
        expect(read.map((s) => s.id)).toEqual(b);
        expect((await reorder(reg(), epB, [b[3], b[2], b[1], b[0]])).status).toBe(200);
        expect((await del(reg(), b[1])).status).toBe(200);
        await reg().sequelize.query(
          `INSERT INTO scenes (id, episode_id, scene_number, title, created_at, updated_at) VALUES (:id, :ep, 4, 'Added', NOW(), NOW())`,
          { replacements: { id: uuid(), ep: epB } });
        expect(Date.now() - started).toBeLessThan(5000);
        expect(await settledWithin(reorderingA, 50)).toBe('pending');
        // A's own readers are not blocked either: its committed numbers are still the old ones.
        expect(await live(shape, epA)).toEqual(a.map((id, i) => [id, i + 1]));

        gate.open();
        expect((await reorderingA).status).toBe(200);
      } finally { trace.uninstall(); }
      expect(await live(shape, epA)).toEqual([[a[2], 1], [a[1], 2], [a[0], 3]]);
      expect((await live(shape, epB)).map(([, n]) => n)).toEqual([1, 2, 3, 4]);
      expect(trace.records.filter((r) => r.error)).toEqual([]);
    });

    // ── a reorder's waiting numbers sit above every number in use (Evoni, 2026-11-22) ──
    //
    // reorderScenes used to park the listed scenes at 1000, 1001, ... while it renumbered them. A live scene of the
    // episode already numbered there (listed or not) met those numbers: with the unique index, as in production,
    // the first pass was a unique violation and the reorder a 500; without it, two scenes shared a number mid-way.
    // The waiting numbers now start above the highest number any live scene of the episode holds.

    it('live scenes numbered 1000, 1001, 1003 and 1005 outside the list: the reorder succeeds and they are not touched', async () => {
      const ep = await episode();
      const listed = await seed(shape, ep, [1, 2, 3, 4, 5, 6]);
      const outside = await seed(shape, ep, [1000, 1001, 1003, 1005]); // 1000..1005 is where six listed scenes used to wait
      const outsideBefore = (await all(shape, ep)).filter((r) => outside.includes(r.id));
      const before = await indexes(shape);
      const wanted = [...listed].reverse();
      const sequelize = reg().sequelize;
      const real = sequelize.query.bind(sequelize);
      const sent0 = [];
      jest.spyOn(sequelize, 'query').mockImplementation(async (sql, options) => {
        const text = String(typeof sql === 'object' && sql !== null && sql.query ? sql.query : sql).replace(/\s+/g, ' ').trim();
        const values = (typeof sql === 'object' && sql !== null && (sql.bind || sql.values)) || options?.bind || [];
        sent0.push({ text, values });
        return real(sql, options);
      });
      const res = await reorder(reg(), ep, wanted);
      jest.restoreAllMocks();
      expect(res.status).toBe(200);
      expect(res.body.data.map((s) => s.id)).toEqual(wanted);
      expect(await live(shape, ep)).toEqual([...wanted.map((id, i) => [id, i + 1]),
        [outside[0], 1000], [outside[1], 1001], [outside[2], 1003], [outside[3], 1005]]);
      expect((await all(shape, ep)).filter((r) => outside.includes(r.id))).toEqual(outsideBefore); // updated_at included
      expect(await indexes(shape)).toEqual(before);
      expect(sent0.map((s) => s.text).filter((s) => DDL.test(s))).toEqual([]);
      // The two passes, six statements each: the first went above 1005 (not to 1000+), the second to 1..6.
      const updates = sent0.filter((s) => /^UPDATE "?scenes"?/i.test(s.text));
      expect(updates).toHaveLength(12);
      const numberSet = (u) => u.values.find((v) => typeof v === 'number');
      expect(updates.slice(0, 6).map(numberSet)).toEqual([1006, 1007, 1008, 1009, 1010, 1011]);
      expect(updates.slice(6).map(numberSet)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('listed scenes that are themselves numbered 1000 and up, and numbers far higher, reorder to 1..n', async () => {
      const ep = await episode();
      const ids = await seed(shape, ep, [1000, 1001, 1002]);
      expect((await reorder(reg(), ep, [ids[2], ids[0], ids[1]])).status).toBe(200);
      expect(await live(shape, ep)).toEqual([[ids[2], 1], [ids[0], 2], [ids[1], 3]]);

      const high = await episode();
      const some = await seed(shape, high, [7, 50000, 8]);
      const [far] = await seed(shape, high, [2000000000]);
      expect((await reorder(reg(), high, [some[1], some[2], some[0]])).status).toBe(200);
      expect(await live(shape, high)).toEqual([[some[1], 1], [some[2], 2], [some[0], 3], [far, 2000000000]]);

      // Right up to the column's limit: two scenes wait at 2147483646 and 2147483647.
      const edge = await episode();
      const two = await seed(shape, edge, [1, 2147483645]);
      expect((await reorder(reg(), edge, [two[1], two[0]])).status).toBe(200);
      expect(await live(shape, edge)).toEqual([[two[1], 1], [two[0], 2]]);
    });

    it('soft-deleted scenes numbered where the listed ones wait are not read and not written', async () => {
      const ep = await episode();
      const ids = await seed(shape, ep, [1, 2, 3, [4, { deleted: true }], [5, { deleted: true }], [1000, { deleted: true }]]);
      const deletedBefore = (await all(shape, ep)).slice(3);
      expect((await reorder(reg(), ep, [ids[2], ids[1], ids[0]])).status).toBe(200);
      expect(await live(shape, ep)).toEqual([[ids[2], 1], [ids[1], 2], [ids[0], 3]]);
      expect((await all(shape, ep)).slice(3)).toEqual(deletedBefore);
    });

    it('numbers too high to leave room: the reorder and the delete are refused (409) before anything is written', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      const refusal = { status: 409, body: { success: false, error: "This episode's scene numbers are too large to renumber. Nothing was changed.", code: 'SCENE_NUMBER_RANGE' } };
      const ep = await episode();
      const ids = await seed(shape, ep, [1, 2, 2147483646]); // three would wait at 2147483647, ...8, ...9
      const before = await all(shape, ep);
      const trace = lockTrace.install(reg().sequelize);
      try {
        expect(await reorder(reg(), ep, [ids[2], ids[1], ids[0]])).toEqual(refusal);
        // A delete that would have to renumber (the first scene goes, the other two must close up) is refused whole.
        expect(await del(reg(), ids[0])).toEqual(refusal);
      } finally { trace.uninstall(); }
      // The reorder wrote nothing at all; the delete's soft delete was rolled back with its transaction.
      expect(trace.records.filter((r) => r.kind === 'commit')).toEqual([]);
      expect(trace.records.filter((r) => r.kind === 'rollback')).toHaveLength(2);
      expect(trace.records.filter((r) => r.kind === 'write').map((r) => r.sql)).toHaveLength(1); // the delete's own, undone
      expect(await all(shape, ep)).toEqual(before);
      expect((await one(shape, ids[0])).deleted_at).toBeNull();
      // A delete that needs no renumbering (the last scene) is not in the way of anything.
      expect((await del(reg(), ids[2])).status).toBe(200);
      expect(await live(shape, ep)).toEqual([[ids[0], 1], [ids[1], 2]]);
    });

    it('a scene added by a route that takes no episode lock, numbered just above the highest, while a reorder is part-way', async () => {
      const ep = await episode();
      const ids = await seed(shape, ep, [1, 2, 3]);
      const before = await all(shape, ep);
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const trace = lockTrace.install(reg().sequelize);
      let res;
      let added;
      try {
        // Held after it read the numbers in use (highest: 3), before its first pass.
        const gate = trace.gate((r) => r.kind === 'lock' && r.table === 'scenes');
        const reordering = reorder(reg(), ep, [ids[2], ids[1], ids[0]]);
        await gate.reached;
        [added] = await seed(shape, ep, [4]); // what createScene and scene duplicate do: highest + 1, no episode lock
        gate.open();
        res = await reordering;
      } finally { trace.uninstall(); }
      jest.restoreAllMocks();
      if (shape === 'present') {
        // The first waiting number (4) is now taken: the index refuses it, the whole reorder rolls back, and it says so.
        expect(res).toEqual({ status: 500, body: { success: false, error: 'Failed to reorder scenes', message: 'Validation error' } });
        expect((await all(shape, ep)).filter((r) => r.id !== added)).toEqual(before);
        expect(await live(shape, ep)).toEqual([[ids[0], 1], [ids[1], 2], [ids[2], 3], [added, 4]]);
        // Tried again, it sees the new scene's number and goes above it.
        expect((await reorder(reg(), ep, [ids[2], ids[1], ids[0]])).status).toBe(200);
      } else {
        // No index: nothing forbids the shared number mid-way, as before; the end state has no repeat.
        expect(res.status).toBe(200);
      }
      expect(await live(shape, ep)).toEqual([[ids[2], 1], [ids[1], 2], [ids[0], 3], [added, 4]]);
    });

    it('a list that leaves a scene out whose number the listed ones would take: unchanged from before this change', async () => {
      // Listing two of three scenes asks for numbers 1 and 2 while the unlisted scene holds 1. With the index that is
      // refused in the second pass and everything rolls back (500, as on main); without it the numbers repeat (as on main).
      const ep = await episode();
      const ids = await seed(shape, ep, [1, 2, 3]);
      const before = await all(shape, ep);
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await reorder(reg(), ep, [ids[2], ids[1]]);
      jest.restoreAllMocks();
      if (shape === 'present') {
        expect(res).toEqual({ status: 500, body: { success: false, error: 'Failed to reorder scenes', message: 'Validation error' } });
        expect(await all(shape, ep)).toEqual(before);
      } else {
        expect(res.status).toBe(200);
        expect(await live(shape, ep)).toEqual([[ids[0], 1], [ids[2], 1], [ids[1], 2]]);
      }
    });
  });

  it('where the numbers repeat or are missing (no index to forbid it), the delete still leaves 1..n', async () => {
    const ep = await episode();
    const ids = await seed('absent', ep, [1, 1, 2, null, 7]);
    expect((await del(regs.absent, ids[2])).status).toBe(200);
    // Repeats keep the order they were made in; a scene with no number goes last.
    expect(await live('absent', ep)).toEqual([[ids[0], 1], [ids[1], 2], [ids[4], 3], [ids[3], 4]]);
  });

  it('the episode is held by someone else past the lock wait: 409 to try again, and nothing is deleted or renumbered', async () => {
    const ep = await episode();
    const ids = await seed('present', ep, [1, 2, 3]);
    const before = await all('present', ep);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const holder = await admin.transaction();
    try {
      await admin.query('SELECT id FROM episodes WHERE id = :ep FOR UPDATE', { replacements: { ep }, transaction: holder });
      const res = await del(regs.present, ids[0]); // waits lock_timeout (10 s), then gives up
      expect(res).toEqual({
        status: 409,
        body: { success: false, error: 'Someone else changed this at the same moment. Nothing was saved: try again.', code: 'RETRY' },
      });
      const reordered = await reorder(regs.present, ep, [ids[2], ids[1], ids[0]]);
      expect(reordered.status).toBe(409);
      expect(reordered.body.code).toBe('RETRY');
    } finally {
      await holder.rollback();
    }
    expect(await all('present', ep)).toEqual(before);
    expect((await del(regs.present, ids[0])).status).toBe(200);
    expect(await live('present', ep)).toEqual([[ids[1], 1], [ids[2], 2]]);
  });

  describe('the index present and owned by another role (the application in production)', () => {
    it('the connection is that role, it does not own the table, and it cannot take the index away', async () => {
      const [[who]] = await asRole.sequelize.query('SELECT current_user AS me');
      expect(who.me).toBe(ROLE);
      const owned = await indexes('present');
      expect(owned.find((i) => i.name === INDEX).owner).not.toBe(ROLE);
      // What the old handler's first statement met in production (inventory D9): refused, so its renumbering
      // rolled back after the soft delete had already committed.
      await expect(asRole.sequelize.query(`DROP INDEX IF EXISTS ${INDEX}`)).rejects.toThrow(/must be owner of index/);
      expect(await indexes('present')).toEqual(owned);
    });

    it('a delete succeeds: the scene is gone, the rest read 1..n, the index is the same object and no DDL was sent', async () => {
      const ep = await episode();
      const ids = await seed('present', ep, [1, 2, 3, 4]);
      const before = await indexes('present');
      const trace = lockTrace.install(asRole.sequelize);
      let res;
      try { res = await del(asRole, ids[0]); } finally { trace.uninstall(); }
      expect(res).toEqual({ status: 200, body: { success: true, message: 'Scene deleted successfully', data: { deletedSceneId: ids[0], episode_id: ep } } });
      expect(await live('present', ep)).toEqual([[ids[1], 1], [ids[2], 2], [ids[3], 3]]);
      expect(await indexes('present')).toEqual(before);
      expect(trace.records.map((r) => r.sql || r.kind).filter((s) => DDL.test(s))).toEqual([]);
      expect(trace.records.filter((r) => r.error)).toEqual([]);
    });

    it('a reorder succeeds for that role: the order is saved, the index is the same object and no DDL was sent', async () => {
      const ep = await episode();
      const ids = await seed('present', ep, [1, 2, 3, 1000, 1001]); // the last two are not listed, and sit where the old range began
      const before = await indexes('present');
      const trace = lockTrace.install(asRole.sequelize);
      let res;
      try { res = await reorder(asRole, ep, [ids[2], ids[0], ids[1]]); } finally { trace.uninstall(); }
      expect(res.status).toBe(200);
      expect(res.body.data.map((s) => [s.id, s.scene_number])).toEqual([[ids[2], 1], [ids[0], 2], [ids[1], 3]]);
      expect(await live('present', ep)).toEqual([[ids[2], 1], [ids[0], 2], [ids[1], 3], [ids[3], 1000], [ids[4], 1001]]);
      expect(await indexes('present')).toEqual(before);
      expect(trace.records.map((r) => r.sql || r.kind).filter((s) => DDL.test(s))).toEqual([]);
      expect(trace.records.filter((r) => r.error)).toEqual([]);
    });

    it('a failure part-way rolls the delete back for that role too', async () => {
      const ep = await episode();
      const ids = await seed('present', ep, [1, 2, 3]);
      const before = await all('present', ep);
      const sequelize = asRole.sequelize;
      const real = sequelize.query.bind(sequelize);
      jest.spyOn(sequelize, 'query').mockImplementation(async (sql, options) => {
        const text = String(typeof sql === 'object' && sql !== null && sql.query ? sql.query : sql);
        if (/UPDATE scenes AS s SET scene_number = :offset/.test(text) && options?.replacements?.offset === 0) throw new Error('renumbering interrupted');
        return real(sql, options);
      });
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await del(asRole, ids[0]);
      expect(res.status).toBe(500);
      jest.restoreAllMocks();
      expect(await all('present', ep)).toEqual(before);
    });
  });
});

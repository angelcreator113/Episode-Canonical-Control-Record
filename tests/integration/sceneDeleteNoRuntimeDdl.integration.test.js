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

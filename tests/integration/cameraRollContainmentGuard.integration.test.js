/**
 * Camera Roll rollback containment (#3714 Tier 1): the deletion guard's
 * ordering, concurrency, interrupted execution and retries
 * (scripts/maintenance/cameraRollContainment.js). Synthetic rows only.
 * Correction-log rows are labelled TEST-synthetic-cr-guard-* /
 * SYNTHETIC-LOCAL-TEST; the log is append-only.
 */
jest.unmock('uuid');
const crypto = require('crypto');
const models = require('../../src/models');
const { contain, restore, status, PARENTS, GUARD_TRIGGER, GUARD_FN } = require('../../scripts/maintenance/cameraRollContainment');

const { sequelize } = models;
const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const LABEL = { by: 'SYNTHETIC-LOCAL-TEST', approvalRef: 'SYNTHETIC LOCAL TEST DATA - not a real correction', dryRun: false };
const BY = { by: 'SYNTHETIC-LOCAL-TEST', dryRun: false };
const guardCount = async () => (await q('SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = :n', { n: GUARD_TRIGGER }))[0].n;
const HIDE = /^\s*UPDATE camera_roll_moments\s+SET deleted_at = CAST/;
const UNHIDE = /^\s*UPDATE camera_roll_moments\s+SET deleted_at = NULL/;

describe('containment deletion guard: ordering, concurrency, interruption, retries', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), maren: uuid() };
  const op = (s) => `TEST-synthetic-cr-guard-${tag}-${s}`;
  const events = [];
  const event = async () => {
    const id = uuid();
    await run("INSERT INTO world_events (id, show_id, name, created_at, updated_at) VALUES (:id, :show, 'CG guard event', NOW(), NOW())", { id, show: ids.show });
    events.push(id);
    return id;
  };
  const uncertain = async (eventId) => {
    const id = uuid();
    await run(`INSERT INTO camera_roll_moments (id, character_id, status, moment, purpose, taken_by, shows_face, outfit, album, people, created_at, updated_at)
               VALUES (:id, :c, 'kept', :m, 'private', 'friend', false, 'none', 'everyday', '[]'::jsonb, NOW(), NOW())`, { id, c: ids.maren, m: `guard ${tag}` });
    await run("UPDATE camera_roll_moments SET status = 'uncertain', make_attempted_at = NOW() - INTERVAL '1 hour', event_id = :e WHERE id = :id", { id, e: eventId });
    return id;
  };
  const hidden = async (id) => (await q('SELECT deleted_at FROM camera_roll_moments WHERE id = :id', { id }))[0].deleted_at !== null;
  // Pauses the first SQL statement matching `re`, runs `during` meanwhile on
  // another connection, then lets the statement go.
  const pauseAt = (re, during, wait = 300) => {
    const real = sequelize.query.bind(sequelize);
    const order = [];
    let pending = null;
    const spy = jest.spyOn(sequelize, 'query').mockImplementation(async (sql, opts) => {
      if (typeof sql === 'string') order.push(sql.trim().split(/\s+/).slice(0, 4).join(' '));
      if (!pending && typeof sql === 'string' && re.test(sql)) {
        pending = Promise.resolve().then(during).then((value) => ({ value }), (error) => ({ error }));
        await sleep(wait);
      }
      return real(sql, opts);
    });
    return { order, done: async () => { const out = pending ? await pending : null; spy.mockRestore(); return out; } };
  };
  const crashAt = (re) => {
    const real = sequelize.query.bind(sequelize);
    return jest.spyOn(sequelize, 'query').mockImplementation(async (sql, opts) => {
      if (typeof sql === 'string' && re.test(sql)) throw new Error('simulated crash');
      return real(sql, opts);
    });
  };

  beforeAll(async () => {
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n, :s, NOW(), NOW())', { show: ids.show, n: `CG ${tag}`, s: `cg-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'CG reg', :show, NOW(), NOW())", ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world, extra_fields, created_at, updated_at)
               VALUES (:maren, :reg, :key, 'CG Maren', 'lalaverse', '{}'::jsonb, NOW(), NOW())`, { ...ids, key: `cg-maren-${tag}` });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await run("UPDATE camera_roll_moments SET make_resolution = make_resolution - 'containment', deleted_at = NULL WHERE character_id = :maren AND make_resolution ? 'containment'", ids);
    await run('DELETE FROM camera_roll_moments WHERE character_id = :maren', ids);
    for (const { table } of PARENTS) await run(`DROP TRIGGER IF EXISTS ${GUARD_TRIGGER} ON public.${table}`);
    await run(`DROP FUNCTION IF EXISTS ${GUARD_FN}()`);
  });

  afterAll(async () => {
    if (events.length) await run('DELETE FROM world_events WHERE id IN (:events)', { events });
    await run('DELETE FROM registry_characters WHERE id = :maren', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('A. every parent table is guarded, and the guard is verified, before any photo is hidden', async () => {
    await uncertain(await event());
    const probe = pauseAt(HIDE, async () => {}, 0);
    await contain(sequelize, { opId: op('a'), ...LABEL });
    await probe.done();
    const iLastTrigger = probe.order.map((s, i) => (/^CREATE TRIGGER/.test(s) ? i : -1)).filter((i) => i >= 0);
    const iCheck = probe.order.findIndex((s) => /^SELECT c\.relname AS t/.test(s));
    const iHide = probe.order.findIndex((s) => /^UPDATE camera_roll_moments SET/.test(s));
    expect(iLastTrigger).toHaveLength(PARENTS.length);
    expect(Math.max(...iLastTrigger)).toBeLessThan(iCheck);
    expect(iCheck).toBeLessThan(iHide);
    expect(await guardCount()).toBe(PARENTS.length);
  });

  test('B. a parent deletion attempted while containment runs waits, then is refused; none slips through', async () => {
    const e = await event();
    const photo = await uncertain(e);
    const probe = pauseAt(HIDE, () => Promise.all([
      run('UPDATE world_events SET deleted_at = NOW() WHERE id = :e', { e }).then(() => 'deleted', (err) => err.message),
      run('UPDATE registry_characters SET deleted_at = NOW() WHERE id = :maren', ids).then(() => 'deleted', (err) => err.message),
    ]));
    await contain(sequelize, { opId: op('b'), ...LABEL });
    const { value } = await probe.done();
    expect(value).toEqual([expect.stringMatching(/rollback containment/), expect.stringMatching(/rollback containment/)]);
    expect((await q('SELECT deleted_at FROM world_events WHERE id = :e', { e }))[0].deleted_at).toBeNull();
    expect((await q('SELECT deleted_at FROM registry_characters WHERE id = :maren', ids))[0].deleted_at).toBeNull();
    expect(await hidden(photo)).toBe(true);
  });

  test('B2. a parent deletion committed just before containment is not lost: the photo is fenced and reported', async () => {
    const e = await event();
    const photo = await uncertain(e);
    await run('UPDATE world_events SET deleted_at = NOW() WHERE id = :e', { e });
    const r = await contain(sequelize, { opId: op('b2'), ...LABEL });
    expect(r.fenced.map((x) => x.id)).toEqual([photo]);
    expect(r.parentsAlreadyGone).toEqual([{ id: photo, missing: ['event_gone'] }]);
    await run(`ALTER TABLE world_events DISABLE TRIGGER ${GUARD_TRIGGER}`);
    await run('UPDATE world_events SET deleted_at = NULL WHERE id = :e', { e });
    await run(`ALTER TABLE world_events ENABLE TRIGGER ${GUARD_TRIGGER}`);
  });

  test('C. interrupted containment leaves nothing hidden, no guard and no log rows; a retry completes', async () => {
    const photo = await uncertain(await event());
    const spy = crashAt(HIDE);
    await expect(contain(sequelize, { opId: op('c'), ...LABEL })).rejects.toThrow(/simulated crash/);
    spy.mockRestore();
    expect(await q('SELECT deleted_at, make_resolution FROM camera_roll_moments WHERE id = :id', { id: photo })).toEqual([{ deleted_at: null, make_resolution: null }]);
    expect(await guardCount()).toBe(0);
    expect(await q('SELECT id FROM data_correction_log WHERE correction_key = :k', { k: op('c') })).toEqual([]);
    const r = await contain(sequelize, { opId: op('c'), ...LABEL });
    expect(r.fenced.map((x) => x.id)).toEqual([photo]);
    expect(await status(sequelize)).toMatchObject({ contained: 1, guardComplete: true, unsafe: false });
  });

  test('C2. interrupted restoration changes nothing: the photo stays contained, the log not undone, the guard in place', async () => {
    const photo = await uncertain(await event());
    await contain(sequelize, { opId: op('c2'), ...LABEL });
    const spy = crashAt(/^\s*UPDATE data_correction_log SET undone_at/);
    await expect(restore(sequelize, { opId: op('c2'), ...BY })).rejects.toThrow(/simulated crash/);
    spy.mockRestore();
    expect(await hidden(photo)).toBe(true);
    expect((await q('SELECT undone_at FROM data_correction_log WHERE correction_key = :k', { k: op('c2') }))[0].undone_at).toBeNull();
    expect(await guardCount()).toBe(PARENTS.length);
    expect(await status(sequelize)).toMatchObject({ contained: 1, unsafe: false });
    const r = await restore(sequelize, { opId: op('c2'), ...BY });
    expect(r.restored.map((x) => x.id)).toEqual([photo]);
    expect(await guardCount()).toBe(0);
  });

  test('D. restore removes the guard only when no photo is contained, even if a containment commits concurrently', async () => {
    const p1 = await uncertain(await event());
    await contain(sequelize, { opId: op('d1'), ...LABEL });
    const e2 = await event();
    const p2 = await uncertain(e2);
    let restoring;
    const probe = pauseAt(HIDE, () => { restoring = restore(sequelize, { opId: op('d1'), ...BY }); return sleep(50); });
    await contain(sequelize, { opId: op('d2'), ...LABEL });
    await probe.done();
    const r = await restoring;
    expect(r.restored.map((x) => x.id)).toEqual([p1]);
    expect(r).toMatchObject({ stillContained: 1, guardRemoved: false });
    expect(await status(sequelize)).toMatchObject({ contained: 1, guardComplete: true, unsafe: false });
    await expect(run('UPDATE world_events SET deleted_at = NOW() WHERE id = :e', { e: e2 })).rejects.toThrow(/rollback containment/);
    const last = await restore(sequelize, { opId: op('d2'), ...BY });
    expect(last.restored.map((x) => x.id)).toEqual([p2]);
    expect(await guardCount()).toBe(0);
  });

  test('D2. a containment started while a restore holds its locks waits; neither deadlocks and the guard survives', async () => {
    const p1 = await uncertain(await event());
    await contain(sequelize, { opId: op('d3'), ...LABEL });
    const p2 = await uncertain(await event());
    let containing;
    const probe = pauseAt(UNHIDE, () => { containing = contain(sequelize, { opId: op('d4'), ...LABEL }); return sleep(50); });
    const r = await restore(sequelize, { opId: op('d3'), ...BY });
    await probe.done();
    const c = await containing;
    expect(r.restored.map((x) => x.id)).toEqual([p1]);
    // The containment ran after the restore committed: p1 is uncertain again,
    // so it is at risk again and is fenced with p2.
    expect(c.fenced.map((x) => x.id).sort()).toEqual([p1, p2].sort());
    // The restore saw no other contained photo and removed the guard; the
    // containment that waited for it then re-installed it before hiding.
    expect(await status(sequelize)).toMatchObject({ contained: 2, guardComplete: true, unsafe: false });
  });

  test('F. two containments at once (same or different id) fence and log each photo exactly once', async () => {
    const p1 = await uncertain(await event());
    const p2 = await uncertain(await event());
    const [a, b] = await Promise.all([contain(sequelize, { opId: op('f'), ...LABEL }), contain(sequelize, { opId: op('f'), ...LABEL })]);
    expect([...a.fenced, ...b.fenced].map((x) => x.id).sort()).toEqual([p1, p2].sort());
    expect((await q('SELECT record_id FROM data_correction_log WHERE correction_key = :k', { k: op('f') })).map((x) => x.record_id).sort()).toEqual([p1, p2].sort());
    await restore(sequelize, { opId: op('f'), ...BY });
    const p3 = await uncertain(await event());
    const [c, d] = await Promise.all([contain(sequelize, { opId: op('f2'), ...LABEL }), contain(sequelize, { opId: op('f3'), ...LABEL })]);
    const fenced = [...c.fenced, ...d.fenced].map((x) => x.id).sort();
    expect(fenced).toEqual([p1, p2, p3].sort()); // each once, under whichever operation took it
    const marks = await q("SELECT id, make_resolution->'containment'->>'id' AS op FROM camera_roll_moments WHERE id IN (:ids)", { ids: [p1, p2, p3] });
    for (const m of marks) expect([op('f2'), op('f3')]).toContain(m.op);
  });

  test('E. installation and removal are safe to retry; a guard missing on any one table is unsafe, and a retry puts it back', async () => {
    await uncertain(await event());
    await contain(sequelize, { opId: op('e'), ...LABEL });
    await contain(sequelize, { opId: op('e'), ...LABEL });
    expect(await guardCount()).toBe(PARENTS.length);
    for (const { table } of PARENTS) {
      await run(`DROP TRIGGER ${GUARD_TRIGGER} ON public.${table}`);
      expect(await status(sequelize)).toMatchObject({ contained: 1, guardComplete: false, unsafe: true });
      await contain(sequelize, { opId: op('e'), ...LABEL });
      expect(await status(sequelize)).toMatchObject({ contained: 1, guardComplete: true, unsafe: false });
    }
    // A disabled trigger counts as missing.
    await run(`ALTER TABLE episodes DISABLE TRIGGER ${GUARD_TRIGGER}`);
    expect(await status(sequelize)).toMatchObject({ unsafe: true });
    await contain(sequelize, { opId: op('e'), ...LABEL });
    expect(await status(sequelize)).toMatchObject({ unsafe: false });
    await restore(sequelize, { opId: op('e'), ...BY });
    await restore(sequelize, { opId: op('e'), ...BY });
    expect(await guardCount()).toBe(0);
  });

  test('G. status is read-only and reports the privileges a write needs', async () => {
    const s = await status(sequelize);
    expect(s).toMatchObject({ contained: 0, guardComplete: false, unsafe: false });
    for (const key of ['data_correction_log.INSERT', 'camera_roll_moments.UPDATE', 'world_events.TRIGGER', 'registry_characters.TRIGGER', 'episodes.TRIGGER', 'feed_posts.TRIGGER', 'world_events.OWNER', 'registry_characters.OWNER', 'episodes.OWNER', 'feed_posts.OWNER', 'schema public.CREATE']) {
      expect(typeof s.privileges[key]).toBe('boolean');
    }
  });
});

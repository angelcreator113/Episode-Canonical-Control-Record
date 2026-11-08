/**
 * Camera Roll rollback containment (#3714 Tier 1; scripts/maintenance/
 * cameraRollContainment.js): the at-risk set, fencing, the correction log,
 * invisibility to the application, the deletion guard on every parent, and
 * exact per-photo restoration. Synthetic rows only; image calls are faked
 * and must never happen.
 *
 * The accepted rev 2.1 prototype was also run against the real pre-#3739
 * code (main 6861e6f0) with this schema; that code cannot be loaded here.
 * Both rely on the same property tested below: every read of a camera-roll
 * photo skips rows with deleted_at set (paranoid model, raw queries filter it).
 *
 * Correction-log rows written here are labelled as test data
 * (correction_key TEST-synthetic-cr-containment-*, approved_by
 * SYNTHETIC-LOCAL-TEST); the log is append-only.
 */
jest.unmock('uuid');
process.env.AI_RATE_LIMIT_PER_IP = '100000';
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const axios = require('axios');
const models = require('../../src/models');
const cameraRoll = require('../../src/services/cameraRoll');
const { contain, restore, status, PARENTS, GUARD_TRIGGER } = require('../../scripts/maintenance/cameraRollContainment');

const { sequelize } = models;
const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const OK_IMAGE = async () => ({ data: { data: [{ b64_json: 'iVBORw0KGgo=' }] } });
const LABEL = { by: 'SYNTHETIC-LOCAL-TEST', approvalRef: 'SYNTHETIC LOCAL TEST DATA - not a real correction', dryRun: false };
const BY = { by: 'SYNTHETIC-LOCAL-TEST', dryRun: false };
const guardTables = async () => (await q(`SELECT c.relname AS t FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
  WHERE tg.tgname = :n ORDER BY 1`, { n: GUARD_TRIGGER })).map((r) => r.t);
const ALL_PARENTS = PARENTS.map((p) => p.table).sort();

describe('camera-roll containment: fence, guard every parent, restore exactly', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), maren: uuid(), kai: uuid(), event: uuid(), otherEvent: uuid(), episode: uuid(), post: uuid(), otherPost: uuid() };
  const opId = `TEST-synthetic-cr-containment-${tag}`;
  const row = {};
  const imageCalls = () => axios.post.mock.calls.map((c) => c[0]).filter((u) => /images\/(edits|generations)/.test(String(u)));
  const insert = async (name, status, extra = '', character = ids.maren) => {
    const id = uuid();
    await run(`INSERT INTO camera_roll_moments (id, character_id, status, moment, purpose, taken_by, shows_face, outfit, album, people, created_at, updated_at)
               VALUES (:id, :c, 'kept', :m, 'private', 'friend', false, 'none', 'everyday', '[]'::jsonb, NOW(), NOW())`, { id, c: character, m: `${name} ${tag}` });
    if (status !== 'kept' || extra) await run(`UPDATE camera_roll_moments SET status = :status${extra ? `, ${extra}` : ''} WHERE id = :id`, { id, status });
    row[name] = id;
    return id;
  };
  const state = async (id) => (await q('SELECT status, deleted_at, make_resolution FROM camera_roll_moments WHERE id = :id', { id }))[0];
  const attempt = async (fn) => { try { await fn(); return 'ok'; } catch (err) { return err.status || err.statusCode || 500; } };
  const FENCED = () => [row.uncertain, row.making, row.abandoned, row.kept_marker, row.kai_uncertain].sort();

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n, :s, NOW(), NOW())', { show: ids.show, n: `CT ${tag}`, s: `ct-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'CT reg', :show, NOW(), NOW())", ids);
    for (const [who, key] of [[ids.maren, 'maren'], [ids.kai, 'kai']]) {
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world, extra_fields, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, 'lalaverse', '{}'::jsonb, NOW(), NOW())`, { id: who, reg: ids.reg, key: `ct-${key}-${tag}`, name: `CT ${key}` });
    }
    await run("INSERT INTO world_events (id, show_id, name, created_at, updated_at) VALUES (:event, :show, 'CT event', NOW(), NOW())", ids);
    await run("INSERT INTO world_events (id, show_id, name, created_at, updated_at) VALUES (:otherEvent, :show, 'CT other event', NOW(), NOW())", ids);
    await run('INSERT INTO episodes (id, title, created_at, updated_at) VALUES (:episode, :t, NOW(), NOW())', { episode: ids.episode, t: `CT episode ${tag}` });
    for (const p of [ids.post, ids.otherPost]) {
      await run("INSERT INTO feed_posts (id, show_id, poster_handle, created_at, updated_at) VALUES (:p, :show, 'ct', NOW(), NOW())", { p, show: ids.show });
    }
    jest.spyOn(axios, 'post').mockImplementation(OK_IMAGE);

    await insert('kept_plain', 'kept');
    await insert('failed_plain', 'failed');
    await insert('made', 'made');
    await insert('dropped_plain', 'dropped');
    await insert('uncertain', 'uncertain', `make_attempted_at = NOW() - INTERVAL '1 hour', event_id = '${ids.event}', episode_id = '${ids.episode}', post_id = '${ids.post}'`);
    await insert('making', 'making', "make_claim_token = gen_random_uuid(), make_claimed_at = NOW(), make_previous_status = 'kept', make_attempted_at = NOW()");
    await insert('abandoned', 'dropped', `make_resolution = '{"abandoned":{"action":"abandon"},"attempts":[{"claim_token":"t1"}]}'::jsonb, make_attempted_at = NOW() - INTERVAL '2 hours'`);
    await insert('kept_marker', 'kept', "make_attempted_at = NOW() - INTERVAL '1 hour'");
    await insert('kai_uncertain', 'uncertain', "make_attempted_at = NOW() - INTERVAL '1 hour'", ids.kai);
    await insert('legit_deleted', 'uncertain', "make_attempted_at = NOW() - INTERVAL '3 hours', deleted_at = NOW() - INTERVAL '1 day'");
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await run("UPDATE camera_roll_moments SET make_resolution = make_resolution - 'containment' WHERE character_id IN (:maren, :kai)", ids);
    for (const { table } of PARENTS) await run(`DROP TRIGGER IF EXISTS ${GUARD_TRIGGER} ON public.${table}`);
    await run('DROP FUNCTION IF EXISTS public.camera_roll_containment_event_guard()');
    await run('DELETE FROM camera_roll_moments WHERE character_id IN (:maren, :kai)', ids);
    await run('DELETE FROM feed_posts WHERE id IN (:post, :otherPost)', ids);
    await run('DELETE FROM episodes WHERE id = :episode', ids);
    await run('DELETE FROM world_events WHERE id IN (:event, :otherEvent)', ids);
    await run('DELETE FROM registry_characters WHERE id IN (:maren, :kai)', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('1. a dry run is the default: it lists exactly the at-risk photos and changes nothing', async () => {
    const before = await Promise.all(FENCED().map(state));
    const dry = await contain(sequelize, { opId, by: 'x', approvalRef: 'y' });
    expect(dry.dryRun).toBe(true);
    expect(dry.fenced.map((x) => x.id).sort()).toEqual(FENCED());
    expect(dry.fenced.map((x) => x.id)).not.toContain(row.legit_deleted);
    expect(await Promise.all(FENCED().map(state))).toEqual(before);
    expect(await guardTables()).toEqual([]);
    expect(await q('SELECT id FROM data_correction_log WHERE correction_key = :opId', { opId })).toEqual([]);
    // restore's dry run of an unknown operation also changes nothing
    expect(await restore(sequelize, { opId })).toMatchObject({ dryRun: true, restored: [], stillContained: 0 });
  });

  test('2. a write needs by and an approval reference; contain fences, logs and is idempotent', async () => {
    await expect(contain(sequelize, { opId, by: 'x', dryRun: false })).rejects.toThrow(/by and approvalRef/);
    await expect(contain(sequelize, { opId: 'no spaces allowed', ...LABEL })).rejects.toThrow(/correction_key format/);
    const r = await contain(sequelize, { opId, ...LABEL });
    expect(r.fenced.map((x) => x.id).sort()).toEqual(FENCED());
    expect((await state(row.legit_deleted)).make_resolution).toBeNull();
    const logs = await q('SELECT record_id, approved_by, approval_ref, undone_at FROM data_correction_log WHERE correction_key = :opId', { opId });
    expect(logs.map((l) => l.record_id).sort()).toEqual(FENCED());
    for (const l of logs) expect(l).toMatchObject({ approved_by: 'SYNTHETIC-LOCAL-TEST', approval_ref: expect.stringMatching(/^SYNTHETIC LOCAL TEST DATA/), undone_at: null });
    // The #3740 attempt history is kept next to the marker.
    expect((await state(row.abandoned)).make_resolution).toMatchObject({ attempts: [{ claim_token: 't1' }], containment: { id: opId } });
    expect(await guardTables()).toEqual(ALL_PARENTS);
    expect((await contain(sequelize, { opId, ...LABEL })).fenced).toEqual([]);
    expect(await status(sequelize)).toMatchObject({ contained: 5, atRisk: 0, guardComplete: true, unsafe: false, operations: [{ id: opId, n: 5 }] });
  });

  test('3. the application cannot reach a contained photo, and pays for nothing', async () => {
    const before = await Promise.all(FENCED().map(state));
    axios.post.mockClear();
    for (const id of FENCED()) {
      expect(await attempt(() => cameraRoll.make(models, id, { by: 't' }))).toBe(404);
      expect(await attempt(() => cameraRoll.keep(models, id))).toBe(404);
      expect(await attempt(() => cameraRoll.drop(models, id))).toBe(404);
      expect(await attempt(() => cameraRoll.updateMoment(models, id, { album: 'work' }))).toBe(404);
    }
    const roll = await cameraRoll.rollFor(models, ids.maren, { audience: 'admin' });
    for (const id of FENCED()) expect(roll.moments.map((m) => m.id)).not.toContain(id);
    expect(imageCalls()).toEqual([]);
    expect(await Promise.all(FENCED().map(state))).toEqual(before);
  });

  test('4. while contained, no parent of a contained photo can be deleted, soft or hard; unrelated rows can', async () => {
    const refused = /rollback containment/;
    // world event (soft, bulk, hard)
    await expect(run('UPDATE world_events SET deleted_at = NOW() WHERE id = :event', ids)).rejects.toThrow(refused);
    await expect(run('UPDATE world_events SET deleted_at = NOW() WHERE id IN (:event, :otherEvent) AND deleted_at IS NULL', ids)).rejects.toThrow(refused);
    await expect(run('DELETE FROM world_events WHERE id = :event', ids)).rejects.toThrow(refused);
    // character (soft, and hard: its foreign key would cascade-delete the photos)
    await expect(run('UPDATE registry_characters SET deleted_at = NOW() WHERE id = :maren', ids)).rejects.toThrow(refused);
    await expect(run('DELETE FROM registry_characters WHERE id = :maren', ids)).rejects.toThrow(refused);
    // episode
    await expect(run('UPDATE episodes SET deleted_at = NOW() WHERE id = :episode', ids)).rejects.toThrow(refused);
    await expect(run('DELETE FROM episodes WHERE id = :episode', ids)).rejects.toThrow(refused);
    // feed post (hard delete would SET NULL the photo's post_id)
    await expect(run('UPDATE feed_posts SET deleted_at = NOW() WHERE id = :post', ids)).rejects.toThrow(refused);
    await expect(run('DELETE FROM feed_posts WHERE id = :post', ids)).rejects.toThrow(refused);
    for (const [t, id] of [['world_events', ids.event], ['registry_characters', ids.maren], ['episodes', ids.episode], ['feed_posts', ids.post]]) {
      expect((await q(`SELECT deleted_at FROM ${t} WHERE id = :id`, { id }))[0]).toEqual({ deleted_at: null });
    }
    expect((await state(row.uncertain)).deleted_at).not.toBeNull();
    // Unrelated rows are unaffected, and other edits to a parent still work.
    await run('UPDATE world_events SET deleted_at = NOW() WHERE id = :otherEvent', ids);
    await run('UPDATE world_events SET deleted_at = NULL WHERE id = :otherEvent', ids);
    await run('UPDATE feed_posts SET deleted_at = NOW() WHERE id = :otherPost', ids);
    await run('UPDATE feed_posts SET deleted_at = NULL WHERE id = :otherPost', ids);
    await run("UPDATE episodes SET title = :t WHERE id = :episode", { ...ids, t: `CT episode renamed ${tag}` });
  });

  test('5. restore is per photo: a photo whose parent is gone stays contained and is reported; the rest come back exactly', async () => {
    // A parent removed before containment started (or by privileged SQL) blocks only that photo.
    await run('ALTER TABLE registry_characters DISABLE TRIGGER camera_roll_containment_event_guard');
    await run('UPDATE registry_characters SET deleted_at = NOW() WHERE id = :kai', ids);
    await run('ALTER TABLE registry_characters ENABLE TRIGGER camera_roll_containment_event_guard');
    const dry = await restore(sequelize, { opId });
    expect(dry).toMatchObject({ dryRun: true, stillContained: 1 });
    expect(await status(sequelize)).toMatchObject({ contained: 5 }); // the dry run changed nothing
    const r = await restore(sequelize, { opId, ...BY });
    expect(r.restored.map((x) => x.id).sort()).toEqual([row.uncertain, row.making, row.abandoned, row.kept_marker].sort());
    expect(r.blocked).toEqual([{ id: row.kai_uncertain, missing: ['character_gone'] }]);
    expect(r).toMatchObject({ stillContained: 1, guardRemoved: false });
    expect(await state(row.uncertain)).toMatchObject({ status: 'uncertain', deleted_at: null, make_resolution: {} });
    expect(await state(row.abandoned)).toMatchObject({ status: 'dropped', deleted_at: null, make_resolution: { abandoned: { action: 'abandon' }, attempts: [{ claim_token: 't1' }] } });
    expect((await state(row.kai_uncertain)).make_resolution.containment.id).toBe(opId);
    expect((await state(row.legit_deleted)).deleted_at).not.toBeNull();
    const undone = await q('SELECT record_id FROM data_correction_log WHERE correction_key = :opId AND undone_at IS NOT NULL', { opId });
    expect(undone.map((u) => u.record_id).sort()).toEqual([row.uncertain, row.making, row.abandoned, row.kept_marker].sort());
    expect(await guardTables()).toEqual(ALL_PARENTS); // stays while a photo is contained
    await run('ALTER TABLE registry_characters DISABLE TRIGGER camera_roll_containment_event_guard');
    await run('UPDATE registry_characters SET deleted_at = NULL WHERE id = :kai', ids);
    await run('ALTER TABLE registry_characters ENABLE TRIGGER camera_roll_containment_event_guard');
    const r2 = await restore(sequelize, { opId, ...BY });
    expect(r2.restored.map((x) => x.id)).toEqual([row.kai_uncertain]);
    expect(r2).toMatchObject({ stillContained: 0, guardRemoved: true });
    expect(await guardTables()).toEqual([]);
    expect((await restore(sequelize, { opId, ...BY })).restored).toEqual([]); // idempotent
  });

  test('6. concurrency: two restores at once restore each photo once; a photo deleted again meanwhile is never revived', async () => {
    const op2 = `${opId}-b`;
    const c = await contain(sequelize, { opId: op2, ...LABEL });
    expect(c.fenced.map((x) => x.id).sort()).toEqual(FENCED());
    await run("UPDATE camera_roll_moments SET deleted_at = NOW() + INTERVAL '1 minute' WHERE id = :id", { id: row.kept_marker });
    const [a, b] = await Promise.all([restore(sequelize, { opId: op2, ...BY }), restore(sequelize, { opId: op2, ...BY })]);
    const all = [...a.restored, ...b.restored].map((x) => x.id).sort();
    expect(all).toEqual([row.uncertain, row.making, row.abandoned, row.kai_uncertain].sort());
    expect([...a.deletedAgain, ...b.deletedAgain]).toContain(row.kept_marker);
    expect((await state(row.kept_marker)).deleted_at).not.toBeNull();
    expect((await state(row.legit_deleted)).deleted_at).not.toBeNull();
    // kept_marker is still marked (deleted again), so the guard stays and status is safe.
    expect(await status(sequelize)).toMatchObject({ contained: 1, guardComplete: true, unsafe: false });
  });
});

/**
 * Fact-update safety (F0; Evoni, 2026-11-22). A change to a character's
 * facts is made under row locks taken in one order (the Pulse profile, the
 * character, the profile's accepted follower rows), names the facts it was
 * made from (facts_version / expected_version), and writes the facts, the
 * profile, the ledger and the fact history in one transaction.
 *
 * Covered here, on the local migrated test database: a save without a
 * version; a stale tab after a fact, a handle and a follower change; two
 * saves at once; a history that cannot be written; one key saved, the rest
 * kept; a checker mark and a save at once; undo of a follower fix and a save
 * at once; the lock order; two characters on one profile; a follower change
 * accepted twice at once; and the old direct API paths.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const lockTrace = require('../helpers/lockTrace');
const storyClock = require('../../src/services/storyClock');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const FLAG = 'abcdef012345';

(shouldSkip ? describe.skip : describe)('fact-update safety', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID() };
  const profiles = [];
  let admin;

  const addProfile = async (approx = '1.2M') => {
    const [[row]] = await run(
      `INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, follower_count_approx, current_state, created_at, updated_at)
       VALUES (:handle, 'pulse', 'test', 'lalaverse', :approx, 'rising', NOW(), NOW()) RETURNING id`,
      { handle: `@f0${crypto.randomUUID().slice(0, 10)}`, approx });
    profiles.push(row.id);
    return row.id;
  };
  const addCharacter = async (profileId = null, facts = null) => {
    const id = crypto.randomUUID();
    await run(
      `INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, feed_profile_id, canon_facts, created_at, updated_at)
       VALUES (:id, :reg, :key, :name, 'support', 'accepted', :pid, CAST(:facts AS jsonb), NOW(), NOW())`,
      { id, reg: ids.reg, key: `f0-${crypto.randomUUID().slice(0, 8)}`, name: `F0 ${TAG}`, pid: profileId, facts: facts ? JSON.stringify(facts) : null });
    return id;
  };
  /** A character with their own profile. */
  const person = async (facts = null) => {
    const profile = await addProfile();
    return { id: await addCharacter(profile, facts), profile };
  };

  const auth = (req) => req.set('Authorization', `Bearer ${admin}`);
  const get = (id) => auth(request(app).get(`/api/v1/cast/characters/${id}/facts`));
  const put = (id, body) => auth(request(app).put(`/api/v1/cast/characters/${id}/facts`)).send(body);
  const versionOf = async (id) => (await get(id)).body.facts_version;
  const stored = async (id) => (await rows('SELECT canon_facts, feed_profile_id FROM registry_characters WHERE id = :id', { id }))[0];
  const profileRow = async (pid) => (await rows('SELECT handle, current_state, follower_count_approx, follower_tier FROM social_profiles WHERE id = :pid', { pid }))[0];
  const ledger = (pid) => rows(
    `SELECT id, cause, change, count_after, status FROM pulse_followers WHERE social_profile_id = :pid AND deleted_at IS NULL ORDER BY created_at, id`, { pid });
  const history = (id) => rows('SELECT fact_key FROM character_fact_changes WHERE registry_character_id = :id ORDER BY created_at, id', { id });

  /**
   * Runs first() until the statement gateOn picks has run (its locks held),
   * then starts second(), holds, and lets first() go. Both results.
   */
  async function race(first, second, gateOn, holdMs = 500) {
    const trace = lockTrace.install(sequelize);
    const g = trace.gate(gateOn);
    try {
      const a = first();
      await Promise.race([g.reached, a]);
      const b = second();
      await wait(holdMs);
      g.open();
      return await Promise.all([a, b]);
    } finally {
      g.open();
      trace.uninstall();
    }
  }
  const locksCharacter = (r) => Boolean(r.txId) && r.kind === 'lock' && r.table === 'registry_characters';
  const locksProfile = (r) => Boolean(r.txId) && r.kind === 'lock' && r.table === 'social_profiles';

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-f0', email: 'evoni@f0.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `F0 ${TAG}`, slug: `f0-${TAG}` });
    await run('INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :t, :show, NOW(), NOW())', { ...ids, t: `F0 ${TAG}` });
  });

  afterAll(async () => {
    await run('DELETE FROM character_fact_changes WHERE registry_character_id IN (SELECT id FROM registry_characters WHERE registry_id = :reg)', ids);
    await run('DELETE FROM pulse_followers WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    if (profiles.length) await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: profiles });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  afterEach(() => jest.restoreAllMocks());

  it('the read gives the facts a version; the same facts read twice give the same one', async () => {
    const { id } = await person({ occupation: 'Stylist', undecided: ['income'] });
    const a = await get(id);
    expect(a.status).toBe(200);
    expect(a.body.facts_version).toMatch(/^f1-[0-9a-f]{40}$/);
    expect(a.body.facts.version).toBeUndefined();
    expect((await get(id)).body.facts_version).toBe(a.body.facts_version);
  });

  it('a save that names no version is refused with a reload message, and writes nothing (an old client\'s full-object save)', async () => {
    const { id, profile } = await person({ occupation: 'Stylist' });
    const res = await put(id, { occupation: 'Overwritten', income: null, major_possessions: [], home_price_range: null, undecided: [], followers: { count: 5 } });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('FACTS_VERSION_REQUIRED');
    expect(res.body.error).toMatch(/Reload/);
    expect((await stored(id)).canon_facts).toEqual({ occupation: 'Stylist' });
    expect(await ledger(profile)).toEqual([]);
    expect(await history(id)).toEqual([]);
  });

  it('a stale tab is refused after a fact, a handle or a follower change, and the newer state stays', async () => {
    const { id, profile } = await person({ occupation: 'Stylist' });
    const tab = await versionOf(id);

    // Another tab saves a fact.
    expect((await put(id, { occupation: 'Designer', expected_version: tab })).status).toBe(200);
    const stale = await put(id, { occupation: 'Stylist again', expected_version: tab });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('FACTS_CHANGED');
    expect((await stored(id)).canon_facts.occupation).toBe('Designer');

    // The handle is edited on the Pulse profile's own page (a one-column write).
    const beforeHandle = await versionOf(id);
    await run('UPDATE social_profiles SET handle = :h WHERE id = :pid', { h: `@moved${crypto.randomUUID().slice(0, 8)}`, pid: profile });
    expect((await put(id, { income: { amount: 10, cadence: 'per_year' }, expected_version: beforeHandle })).status).toBe(409);
    expect((await stored(id)).canon_facts.income).toBeUndefined();

    // A follower change is accepted in the ledger.
    const start = await put(id, { followers: { count: 1000, reason: 'start' }, expected_version: await versionOf(id) });
    expect(start.status).toBe(200);
    const beforeOverride = start.body.facts_version;
    const over = await auth(request(app).post('/api/v1/pulse-followers/override')).send({ show_id: ids.show, profile_id: profile, change: 500, reason: 'a good week' });
    expect(over.status).toBe(201);
    const late = await put(id, { followers: { count: 7, reason: 'stale' }, expected_version: beforeOverride });
    expect(late.status).toBe(409);
    expect((await get(id)).body.facts.followers.count).toBe(1500);
    expect((await profileRow(profile)).follower_count_approx).toBe('1,500');
  });

  it('two saves made from the same facts at once: one is saved, the other is refused', async () => {
    const { id } = await person({ occupation: 'Stylist' });
    const v = await versionOf(id);
    const [a, b] = await race(
      () => put(id, { occupation: 'First', expected_version: v }),
      () => put(id, { occupation: 'Second', expected_version: v }),
      locksCharacter);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const lost = a.status === 409 ? a : b;
    expect(lost.body.code).toBe('FACTS_CHANGED');
    expect((await stored(id)).canon_facts.occupation).toBe(a.status === 200 ? 'First' : 'Second');
    expect((await history(id)).map((h) => h.fact_key)).toEqual(['occupation']);
  });

  it('a history that cannot be written undoes the facts, the profile and the ledger', async () => {
    const { id, profile } = await person({ occupation: 'Stylist' });
    const before = { character: await stored(id), profile: await profileRow(profile) };
    jest.spyOn(storyClock, 'presentOrder').mockRejectedValue(new Error('the story clock is down'));
    const res = await put(id, {
      occupation: 'Designer', account_status: 'peaking', followers: { count: 9000, reason: 'test' }, expected_version: await versionOf(id),
    });
    expect(res.status).toBe(500);
    jest.restoreAllMocks();
    expect(await stored(id)).toEqual(before.character);
    expect(await profileRow(profile)).toEqual(before.profile);
    expect(await ledger(profile)).toEqual([]);
    expect(await history(id)).toEqual([]);
    // And the same save goes through once the history can be written.
    const again = await put(id, { occupation: 'Designer', account_status: 'peaking', followers: { count: 9000, reason: 'test' }, expected_version: await versionOf(id) });
    expect(again.status).toBe(200);
    expect((await history(id)).map((h) => h.fact_key).sort()).toEqual(['account_status', 'occupation']);
    expect((await ledger(profile)).map((r) => Number(r.count_after))).toEqual([9000]);
  });

  it('a save changes only the facts it names: the others, and the checker\'s marks, are kept', async () => {
    const mark = { id: FLAG, note: 'meant', at: '2026-11-01T00:00:00.000Z' };
    const { id } = await person({
      occupation: 'Stylist', income: { amount: 60000, cadence: 'per_year', source: 'brand deals' }, major_possessions: ['A loft'],
      home_price_range: 'upscale', undecided: ['followers'], intentional: [mark],
    });
    const res = await put(id, { occupation: 'Designer', expected_version: await versionOf(id) });
    expect(res.status).toBe(200);
    expect((await stored(id)).canon_facts).toEqual({
      occupation: 'Designer', income: { amount: 60000, cadence: 'per_year', source: 'brand deals' }, major_possessions: ['A loft'],
      home_price_range: 'upscale', undecided: ['followers'], intentional: [mark],
    });
    expect((await history(id)).map((h) => h.fact_key)).toEqual(['occupation']);
  });

  it('marking a finding intentional writes only the marks, does not make an open fact sheet stale, and survives a save made at the same moment', async () => {
    const { id } = await person({ occupation: 'Stylist' });
    const v = await versionOf(id);
    const marked = await auth(request(app).post(`/api/v1/cast/characters/${id}/check/intentional`)).send({ flag_id: FLAG, note: 'meant' });
    expect(marked.status).toBe(200);
    expect((await stored(id)).canon_facts.occupation).toBe('Stylist');
    // The fact sheet opened before the mark still saves.
    expect((await put(id, { occupation: 'Designer', expected_version: v })).status).toBe(200);
    expect((await stored(id)).canon_facts.intentional.map((m) => m.id)).toEqual([FLAG]);

    // At the same moment: the save holds the character's lock while the unmark arrives.
    const v2 = await versionOf(id);
    const [save, unmark] = await race(
      () => put(id, { occupation: 'Tailor', expected_version: v2 }),
      () => auth(request(app).delete(`/api/v1/cast/characters/${id}/check/intentional/${FLAG}`)),
      locksCharacter);
    expect(save.status).toBe(200);
    expect(unmark.status).toBe(200);
    const after = (await stored(id)).canon_facts;
    expect(after.occupation).toBe('Tailor');
    expect(after.intentional).toEqual([]);
  });

  it('a mark made while a save waits is not put back by it', async () => {
    const { id } = await person({ occupation: 'Stylist' });
    const v = await versionOf(id);
    const [mark, save] = await race(
      () => auth(request(app).post(`/api/v1/cast/characters/${id}/check/intentional`)).send({ flag_id: FLAG }),
      () => put(id, { occupation: 'Designer', expected_version: v }),
      locksCharacter);
    expect(mark.status).toBe(200);
    expect(save.status).toBe(200);
    const after = (await stored(id)).canon_facts;
    expect(after.occupation).toBe('Designer');
    expect(after.intentional.map((m) => m.id)).toEqual([FLAG]);
  });

  it('a save locks the profile, then the character, then the accepted follower rows', async () => {
    const { id } = await person({ occupation: 'Stylist' });
    expect((await put(id, { followers: { count: 100, reason: 'start' }, expected_version: await versionOf(id) })).status).toBe(200);
    const v = await versionOf(id);
    const trace = lockTrace.install(sequelize);
    let res;
    try {
      res = await put(id, { followers: { count: 200, reason: 'more' }, occupation: 'Designer', expected_version: v });
    } finally {
      trace.uninstall();
    }
    expect(res.status).toBe(200);
    const saves = [...trace.byTransaction().values()].filter((recs) => recs.some((r) => r.kind === 'lock'));
    expect(saves).toHaveLength(1);
    const locks = saves[0].filter((r) => r.kind === 'lock');
    expect(locks.map((r) => r.table)).toEqual(['social_profiles', 'registry_characters', 'pulse_followers']);
    expect(locks[2].ordered).toBe(true);
    // Every write of the save follows its last lock.
    const lastLock = saves[0].lastIndexOf(locks[2]);
    const firstWrite = saves[0].findIndex((r) => r.kind === 'write' || r.kind === 'insert');
    expect(firstWrite).toBeGreaterThan(lastLock);
  });

  it('two characters on one Pulse profile: their follower saves take turns, and one count is kept', async () => {
    const profile = await addProfile();
    const one = await addCharacter(profile);
    const two = await addCharacter(profile);
    const [v1, v2] = [await versionOf(one), await versionOf(two)];
    const [a, b] = await race(
      () => put(one, { followers: { count: 1000, reason: 'from one' }, expected_version: v1 }),
      () => put(two, { followers: { count: 2000, reason: 'from two' }, expected_version: v2 }),
      locksProfile);
    // The second was made from the profile before the first changed it.
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const book = await ledger(profile);
    expect(book).toHaveLength(1);
    expect(book[0]).toMatchObject({ cause: 'start', status: 'accepted' });
    const kept = Number(book[0].count_after);
    expect(kept).toBe(a.status === 200 ? 1000 : 2000);
    // Both characters read the one count, and the profile's copy agrees with it.
    expect((await get(one)).body.facts.followers.count).toBe(kept);
    expect((await get(two)).body.facts.followers.count).toBe(kept);
    expect((await profileRow(profile)).follower_count_approx).toBe(kept.toLocaleString('en-US'));
  });

  it('a proposed follower change accepted twice at once is accepted once, and the copies follow in the same transaction', async () => {
    const { id, profile } = await person();
    expect((await put(id, { followers: { count: 1000, reason: 'start' }, expected_version: await versionOf(id) })).status).toBe(200);
    const [[proposed]] = await run(
      `INSERT INTO pulse_followers (show_id, social_profile_id, story_order, change, count_after, cause, reason, status, created_at, updated_at)
       VALUES (:show, :pid, 0, 250, 1250, 'override', 'proposed in a test', 'proposed', NOW(), NOW()) RETURNING id`, { show: ids.show, pid: profile });
    const stale = await versionOf(id);
    const accept = () => auth(request(app).put(`/api/v1/pulse-followers/${proposed.id}/accept`)).send({});
    const [a, b] = await race(accept, accept, locksProfile);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await get(id)).body.facts.followers.count).toBe(1250);
    expect((await profileRow(profile)).follower_count_approx).toBe('1,250');
    // A fact sheet opened before the accept is stale.
    expect((await put(id, { followers: { count: 1, reason: 'stale' }, expected_version: stale })).status).toBe(409);
  });

  it('undoing a confirmed follower count and saving the facts at once: no deadlock, and whichever lost is refused cleanly', async () => {
    const { id, profile } = await person();
    const beforeRow = (await rows('SELECT follower_count_approx, follower_tier, full_profile, platform_presences FROM social_profiles WHERE id = :pid', { pid: profile }))[0];
    expect((await put(id, { followers: { count: 1200000, reason: 'confirmed' }, expected_version: await versionOf(id) })).status).toBe(200);
    const afterRow = (await rows('SELECT follower_count_approx, follower_tier, full_profile, platform_presences FROM social_profiles WHERE id = :pid', { pid: profile }))[0];
    const [row] = await ledger(profile);
    const change = { kind: 'followers', character_id: id, ledger_id: row.id, show_id: ids.show, count: 1200000, before: beforeRow, after: afterRow };
    const v = await versionOf(id);
    const [undo, save] = await race(
      () => auth(request(app).post('/api/v1/cast/consistency/undo')).send({ change }),
      () => put(id, { followers: { count: 1300000, reason: 'at the same moment' }, expected_version: v }),
      locksProfile);
    for (const r of [undo, save]) expect([200, 409]).toContain(r.status);
    expect(undo.status).toBe(200);
    // The save was made from the count the undo removed.
    expect(save.status).toBe(409);
    expect(await ledger(profile)).toEqual([]);
    expect((await profileRow(profile)).follower_count_approx).toBe(beforeRow.follower_count_approx);
  });

  it('the old way onto an existing character cannot replace their facts', async () => {
    const { id } = await person({ occupation: 'Stylist' });
    const res = await auth(request(app).post('/api/v1/character-generation/confirm')).send({
      character_id: id, proposed: { canon_facts: { occupation: 'Replaced' }, description: 'also this' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fact sheet/);
    const row = (await rows('SELECT canon_facts, description FROM registry_characters WHERE id = :id', { id }))[0];
    expect(row.canon_facts).toEqual({ occupation: 'Stylist' });
    expect(row.description).toBeNull();
    expect(await history(id)).toEqual([]);
  });

  it('a character with no Pulse profile saves their own facts, and legacy facts read as before', async () => {
    const id = await addCharacter(null, { occupation: 'Teacher', some_old_key: 'kept' });
    const read = await get(id);
    expect(read.body.facts).toMatchObject({ feed_linked: false, occupation: 'Teacher', followers: null });
    const res = await put(id, { income: { amount: 3000, cadence: 'per_month' }, expected_version: read.body.facts_version });
    expect(res.status).toBe(200);
    expect(res.body.facts_version).not.toBe(read.body.facts_version);
    expect((await stored(id)).canon_facts).toEqual({ occupation: 'Teacher', some_old_key: 'kept', income: { amount: 3000, cadence: 'per_month', source: null } });
    expect((await put(id, { followers: { count: 5 }, expected_version: res.body.facts_version })).status).toBe(409);
  });
});

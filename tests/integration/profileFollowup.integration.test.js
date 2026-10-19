/**
 * The profile follow-up (Evoni, 2026-10-19: "yes start 1 and 2 with your
 * recommendations"):
 *
 *   - the rest of the character writes are ADMIN only ("this whole part of
 *     the site is admin only"): the registry's plot threads, bulk tools,
 *     clone and deep profile, the character generator, relationships,
 *     entanglements and crossing a feed profile refuse a signed-in non-admin
 *     and change nothing; the reads stay open
 *   - the one-time follower label backfill (migration 20261019200000) brings
 *     a disagreeing label to the ledger count, changes nothing on a second
 *     run, gives a profile with ledger rows in two shows the main show's
 *     count ("Styling Adventures with Lala is the main show; any other show
 *     is bouncing off it"), leaves one in two shows neither of them the main
 *     show alone, and down() gives the old label back
 *   - created_from (migration 20261019200001): crossing a feed profile and
 *     The Cast's New character record how the character was made, and the
 *     backfill marks an older crossed character
 *
 * The database is the local migrated test DB.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const Sequelize = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const db = require('../../src/models');
const labels = require('../../src/migrations/20261019200000-backfill-follower-labels');
const createdFrom = require('../../src/migrations/20261019200001-registry-created-from');

const { sequelize } = db;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const one = async (sql, replacements = {}) => (await run(sql, replacements))[0][0];

(shouldSkip ? describe.skip : describe)('the profile follow-up', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = {
    show: crypto.randomUUID(), show2: crypto.randomUUID(), reg: crypto.randomUUID(),
    maren: crypto.randomUUID(), noor: crypto.randomUUID(), older: crypto.randomUUID(),
  };
  const profiles = {};
  // The main show: the test database's own, else one made here and removed after.
  let mainShow;
  let madeMainShow = false;
  let adminToken;
  let editorToken;
  const asAdmin = (r) => r.set('Authorization', `Bearer ${adminToken}`);
  const asEditor = (r) => r.set('Authorization', `Bearer ${editorToken}`);
  const qi = () => sequelize.getQueryInterface();

  const addProfile = async (key, { label = '900K', tier = 'macro', status = 'finalized' } = {}) => {
    const [[row]] = await run(
      `INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, follower_count_approx, follower_tier, status, created_at, updated_at)
       VALUES (:handle, 'instagram', 'test', 'lalaverse', :label, CAST(:tier AS enum_social_profiles_follower_tier), :status, NOW(), NOW()) RETURNING id`,
      { handle: `${key}${TAG}`, label, tier, status });
    profiles[key] = row.id;
  };
  const ledger = (show, pid, count) => run(
    `INSERT INTO pulse_followers (show_id, social_profile_id, story_order, change, count_after, cause, reason, status, decided_by, decided_at, created_at, updated_at)
     VALUES (:show, :pid, 0, :n, :n, 'start', 'test', 'accepted', 'auto', NOW(), NOW(), NOW())`, { show, pid, n: count });
  const addCharacter = (id, name, feed = null) => run(
    `INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, feed_profile_id, created_at, updated_at)
     VALUES (:id, :reg, :key, :name, 'support', 'accepted', :feed, NOW(), NOW())`,
    { id, reg: ids.reg, key: `followup-${crypto.randomUUID().slice(0, 8)}`, name: `${name} ${TAG}`, feed });

  beforeAll(async () => {
    adminToken = TokenService.generateTokenPair({ id: 'test-admin-followup', email: 'a@followup.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editorToken = TokenService.generateTokenPair({ id: 'test-user-followup', email: 'u@followup.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    for (const [show, n] of [[ids.show, 1], [ids.show2, 2]]) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
        { show, name: `Followup ${TAG} ${n}`, slug: `followup-${TAG}-${n}` });
    }
    const [found] = await run(
      `SELECT id FROM shows WHERE deleted_at IS NULL
         AND (slug IN ('styling-adventures-with-lala', 'styling-adventure-lala') OR name ILIKE 'Styling Adventures with Lala')`);
    if (found.length === 1) mainShow = found[0].id;
    else if (found.length === 0) {
      mainShow = crypto.randomUUID();
      madeMainShow = true;
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, 'Styling Adventures with Lala', 'styling-adventures-with-lala', NOW(), NOW())`, { id: mainShow });
    } else throw new Error('the test database has more than one main show');
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :title, :show, NOW(), NOW())`,
      { ...ids, title: `Followup ${TAG}` });
    await addProfile('maren');
    await addProfile('twoShows', { label: '10k', tier: 'micro' });
    await addProfile('agreed', { label: '2M', tier: 'mega' });
    await addProfile('withMain', { label: '40K', tier: 'micro' });
    await addProfile('toCross');
    await addProfile('crossedBefore', { status: 'crossed' });
    await addCharacter(ids.maren, 'Maren', profiles.maren);
    await addCharacter(ids.noor, 'Noor');
    await addCharacter(ids.older, 'Older', profiles.crossedBefore);
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await run('DELETE FROM pulse_followers WHERE social_profile_id IN (:p)', { p: Object.values(profiles) });
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:maren, :noor) OR character_id_b IN (:maren, :noor)', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(profiles) });
    await run('DELETE FROM shows WHERE id IN (:show, :show2)', ids);
    if (madeMainShow) await run('DELETE FROM shows WHERE id = :id', { id: mainShow });
  });

  it('a signed-in non-admin is refused on the remaining character writes, nothing changes, and reads stay open', async () => {
    const base = '/api/v1/character-registry';
    const writes = [
      request(app).post(`${base}/registries/${ids.reg}/characters`).send({ display_name: 'Not allowed', character_key: `no-${TAG}` }),
      request(app).post(`${base}/characters/${ids.maren}/plot-threads`).send({ title: 'Not allowed' }),
      request(app).post(`${base}/characters/bulk-status`).send({ ids: [ids.maren], status: 'finalized' }),
      request(app).post(`${base}/characters/${ids.maren}/clone`),
      request(app).post(`${base}/characters/${ids.maren}/deep-profile/accept`).send({}),
      request(app).post(`${base}/characters/${ids.maren}/sync-social`),
      request(app).post('/api/v1/character-generation/confirm').send({ registry_id: ids.reg, proposed: { display_name: 'Not allowed' } }),
      request(app).patch(`/api/v1/character-generation/depth/${ids.maren}`).send({ depth_level: 'alive' }),
      request(app).post('/api/v1/relationships').send({ character_id_a: ids.maren, character_id_b: ids.noor, relationship_type: 'friend' }),
      request(app).post(`/api/v1/social-profiles/${profiles.toCross}/cross`).send({ registry_id: ids.reg }),
      request(app).post('/api/v1/social-profiles/bulk/cross').send({ ids: [profiles.toCross] }),
      request(app).post(`/api/v1/entanglements/characters/${ids.maren}/entanglements`).send({ profile_id: profiles.maren, dimension: 'career' }),
      request(app).post(`/api/v1/entanglements/characters/${ids.maren}/unfollows`).send({ profile_id: profiles.maren }),
    ];
    for (const w of writes) expect((await asEditor(w)).status).toBe(403);
    const count = await one('SELECT COUNT(*)::int AS n FROM registry_characters WHERE registry_id = :reg', ids);
    expect(count.n).toBe(3);
    const maren = await one('SELECT status, depth_level FROM registry_characters WHERE id = :maren', ids);
    expect(maren.status).toBe('accepted');
    expect(maren.depth_level).not.toBe('alive');
    const rel = await one('SELECT COUNT(*)::int AS n FROM character_relationships WHERE character_id_a = :maren', ids);
    expect(rel.n).toBe(0);
    const ent = await one('SELECT COUNT(*)::int AS n FROM character_entanglements WHERE character_id = :maren', ids);
    expect(ent.n).toBe(0);
    const crossed = await one('SELECT status FROM social_profiles WHERE id = :id', { id: profiles.toCross });
    expect(crossed.status).toBe('finalized');
    expect((await asEditor(request(app).get(`${base}/characters/${ids.maren}`))).status).toBe(200);
    expect((await asEditor(request(app).get(`${base}/registries/${ids.reg}`))).status).toBe(200);
  });

  it('a signed-in non-admin is refused on the Pulse people tools, no profile changes, and reads stay open', async () => {
    const sp = '/api/v1/social-profiles';
    const id = profiles.agreed;
    const writes = [
      request(app).post(`${sp}/generate`).send({ handle: `@no${TAG}`, platform: 'instagram', vibe_sentence: 'not allowed' }),
      request(app).post(`${sp}/autofill-draft`).send({ handle: `@no${TAG}` }),
      request(app).post(`${sp}/bulk/finalize`).send({ ids: [id] }),
      request(app).post(`${sp}/bulk/archive`).send({ ids: [id] }),
      request(app).post(`${sp}/bulk/delete`).send({ ids: [id] }),
      request(app).post(`${sp}/${id}/finalize`),
      request(app).post(`${sp}/${id}/regenerate`).send({}),
      request(app).delete(`${sp}/${id}`),
      request(app).post(`${sp}/${id}/add-moment`).send({ moment: 'not allowed' }),
      request(app).post(`${sp}/follow-engine/run`).send({}),
      request(app).post(`${sp}/${id}/relationships`).send({ target_profile_id: profiles.maren, relationship_type: 'friend' }),
      request(app).post(`${sp}/templates`).send({ name: `No ${TAG}`, template_data: {} }),
      request(app).post(`${sp}/relationships/suggestions/accept`).send({ profile_a_id: id, profile_b_id: profiles.maren, relationship_type: 'friend' }),
      request(app).post(`${sp}/bulk/parse-paste`).send({ text: '@nobody' }),
      request(app).post(`${sp}/bulk/generate`).send({ profiles: [{ handle: `@no${TAG}` }] }),
      request(app).post(`${sp}/bulk/generate-job`).send({ profiles: [{ handle: `@no${TAG}` }] }),
    ];
    for (const w of writes) expect((await asEditor(w)).status).toBe(403);
    const profile = await one('SELECT status, deleted_at, follower_count_approx FROM social_profiles WHERE id = :id', { id });
    expect(profile).toEqual({ status: 'finalized', deleted_at: null, follower_count_approx: '2M' });
    const made = await one('SELECT COUNT(*)::int AS n FROM social_profiles WHERE handle ILIKE :h', { h: `%no${TAG}%` });
    expect(made.n).toBe(0);
    expect((await asEditor(request(app).get(`${sp}/${id}`))).status).toBe(200);
    expect((await asEditor(request(app).get(`${sp}/templates`))).status).toBe(200);
  });

  it('created_from: crossing a feed profile and The Cast\'s New character record how the character was made', async () => {
    const crossed = await asAdmin(request(app).post(`/api/v1/social-profiles/${profiles.toCross}/cross`).send({ registry_id: ids.reg }));
    expect(crossed.status).toBe(200);
    const fromFeed = await one('SELECT created_from FROM registry_characters WHERE feed_profile_id = :id', { id: profiles.toCross });
    expect(fromFeed.created_from).toBe('feed_cross');

    const made = await asAdmin(request(app).post(`/api/v1/character-registry/registries/${ids.reg}/characters`)
      .send({ display_name: `Manual ${TAG}`, character_key: `manual-${TAG}` }));
    expect(made.status).toBe(201);
    const manual = await one('SELECT created_from FROM registry_characters WHERE character_key = :key', { key: `manual-${TAG}` });
    expect(manual.created_from).toBe('manual');
  });

  it('created_from backfill: an older crossed character is marked made from the feed; a second run changes nothing', async () => {
    await run('UPDATE registry_characters SET created_from = NULL WHERE id IN (:older, :noor)', ids);
    await createdFrom.up(qi(), Sequelize);
    const older = await one('SELECT created_from FROM registry_characters WHERE id = :older', ids);
    expect(older.created_from).toBe('feed_cross');
    const noor = await one('SELECT created_from FROM registry_characters WHERE id = :noor', ids);
    expect(noor.created_from).toBeNull();
    await createdFrom.up(qi(), Sequelize);
    expect((await one('SELECT created_from FROM registry_characters WHERE id = :older', ids)).created_from).toBe('feed_cross');
  });

  it('the follower label backfill fixes a disagreeing label, is idempotent, takes the main show\'s count, and down restores', async () => {
    await ledger(ids.show, profiles.maren, 1500000);
    await ledger(ids.show, profiles.twoShows, 40000);
    await ledger(ids.show2, profiles.twoShows, 60000);
    await ledger(ids.show, profiles.agreed, 2000000);
    await ledger(ids.show2, profiles.withMain, 40000);
    await ledger(mainShow, profiles.withMain, 2000000);

    await labels.up(qi(), Sequelize);
    let maren = await one('SELECT follower_count_approx, follower_tier::text AS tier FROM social_profiles WHERE id = :id', { id: profiles.maren });
    expect(maren).toEqual({ follower_count_approx: '1.5M', tier: 'mega' });
    // Two shows, neither the main show: left alone.
    const two = await one('SELECT follower_count_approx FROM social_profiles WHERE id = :id', { id: profiles.twoShows });
    expect(two.follower_count_approx).toBe('10k');
    expect(await one('SELECT COUNT(*)::int AS n FROM follower_label_backups WHERE social_profile_id = :id', { id: profiles.twoShows })).toEqual({ n: 0 });
    // Two shows, one of them the main show: the main show's count wins.
    const withMain = await one('SELECT follower_count_approx, follower_tier::text AS tier FROM social_profiles WHERE id = :id', { id: profiles.withMain });
    expect(withMain).toEqual({ follower_count_approx: '2M', tier: 'mega' });
    expect(await one('SELECT ledger_count FROM follower_label_backups WHERE social_profile_id = :id AND deleted_at IS NULL', { id: profiles.withMain }))
      .toEqual({ ledger_count: '2000000' });
    const agreed = await one('SELECT follower_count_approx FROM social_profiles WHERE id = :id', { id: profiles.agreed });
    expect(agreed.follower_count_approx).toBe('2M');
    const backup = await one('SELECT follower_count_approx, follower_tier, ledger_count FROM follower_label_backups WHERE social_profile_id = :id AND deleted_at IS NULL', { id: profiles.maren });
    expect(backup).toMatchObject({ follower_count_approx: '900K', follower_tier: 'macro', ledger_count: '1500000' });
    expect(await one('SELECT COUNT(*)::int AS n FROM follower_label_backups WHERE social_profile_id = :id', { id: profiles.agreed })).toEqual({ n: 0 });

    // A second run finds them in agreement and keeps the first backup.
    await labels.up(qi(), Sequelize);
    expect(await one('SELECT COUNT(*)::int AS n FROM follower_label_backups WHERE social_profile_id = :id', { id: profiles.maren })).toEqual({ n: 1 });

    await labels.down(qi());
    maren = await one('SELECT follower_count_approx, follower_tier::text AS tier FROM social_profiles WHERE id = :id', { id: profiles.maren });
    expect(maren).toEqual({ follower_count_approx: '900K', tier: 'macro' });
    expect(await one('SELECT follower_count_approx, follower_tier::text AS tier FROM social_profiles WHERE id = :id', { id: profiles.withMain }))
      .toEqual({ follower_count_approx: '40K', tier: 'micro' });
    expect((await one("SELECT to_regclass('public.follower_label_backups') AS reg")).reg).toBeNull();

    // Leave the database migrated, as the suite found it.
    await run('DELETE FROM pulse_followers WHERE social_profile_id IN (:p)', { p: Object.values(profiles) });
    await labels.up(qi(), Sequelize);
    expect((await one("SELECT to_regclass('public.follower_label_backups') AS reg")).reg).not.toBeNull();
  });
});

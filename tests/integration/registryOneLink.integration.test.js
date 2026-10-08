/**
 * One link between a Feed profile and its registry character, on the
 * registry entry: registry_characters.feed_profile_id (Evoni's ruling C3,
 * docs/navigation-architecture.md; 2026-10-08, "One link, per C3").
 *
 * social_profiles.registry_character_id is INTEGER in the migrations and in
 * canon, while every writer wrote a registry id (a UUID): confirming a Feed
 * proposal and Promote to registry returned 500, and every read through the
 * column (the Feed post generator's include, the script writer's and the
 * story generator's joins, story evaluation's lookups) failed and found
 * nothing. Nothing reads or writes that column now. Creating a character
 * on the Registry page makes no Feed profile ("Only by proposal").
 *
 * The database is the local migrated test DB; the rows are this test's own.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const db = require('../../src/models');
const { LINKED_CHARACTER_JOIN } = require('../../src/utils/registryLink');

const { sequelize } = db;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

const TAG = crypto.randomUUID().slice(0, 8);
const handle = (n) => `@onelink${TAG}${n}`;
const NAME = `One Link ${TAG}`;

(shouldSkip ? describe.skip : describe)('one link between a Feed profile and its registry character (C3)', () => {
  let token;
  const reg = crypto.randomUUID();
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  const character = async (key, { profileId = null, updatedAt = 'NOW()' } = {}) => {
    const id = crypto.randomUUID();
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, created_at, updated_at)
               VALUES (:id, :reg, :key, :name, :profileId, NOW(), ${updatedAt})`,
    { id, reg, key: `${key}-${TAG}`, name: `${NAME} ${key}`, profileId });
    return id;
  };
  const profile = (h, extra = {}) => db.SocialProfile.create({
    handle: h, platform: 'instagram', vibe_sentence: 'One link test creator', status: 'finalized', feed_layer: 'lalaverse', display_name: `${NAME} ${h}`, ...extra,
  });
  const linkOf = async (characterId) => (await q('SELECT feed_profile_id FROM registry_characters WHERE id = :characterId', { characterId }))[0]?.feed_profile_id;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-one-link', email: 'test@one-link.dev', name: 'One Link Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'One link registry', NOW(), NOW())`, { reg });
  });

  afterAll(async () => {
    const like = `@onelink${TAG}%`;
    const mine = 'SELECT id FROM social_profiles WHERE handle LIKE :like';
    await run(`DELETE FROM character_entanglements WHERE profile_id IN (${mine})`, { like });
    await run(`DELETE FROM social_profile_followers WHERE social_profile_id IN (${mine})`, { like });
    await run(`DELETE FROM world_timeline_events WHERE event_name LIKE :name`, { name: `%${NAME}%` });
    await run('DELETE FROM social_profiles WHERE handle LIKE :like', { like });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', { reg });
    await run('DELETE FROM character_registries WHERE id = :reg', { reg });
  });

  it('confirming a Feed proposal creates the profile and links the character to it', async () => {
    const rc = await character('proposal');
    const res = await auth(request(app).post('/api/v1/character-generation/confirm-feed'))
      .send({ character_id: rc, feed_layer: 'lalaverse', feed_proposal: { handle: handle('prop'), platform: 'tiktok', display_name: `${NAME} proposal` } });
    expect(res.status).toBe(201);
    expect(await linkOf(rc)).toBe(res.body.profile.id);

    const one = await auth(request(app).get(`/api/v1/social-profiles/${res.body.profile.id}`));
    expect(one.status).toBe(200);
    expect(one.body.profile.registry_character_id).toBe(rc);
  });

  it('Promote to registry links the new character to the profile; the Feed list carries the link', async () => {
    const p = await profile(handle('cross'));
    const res = await auth(request(app).post(`/api/v1/social-profiles/${p.id}/cross`)).send({ registry_id: reg });
    expect(res.status).toBe(200);
    expect(res.body.crossed).toBe(true);
    const rc = res.body.registry_character.id;
    expect(await linkOf(rc)).toBe(p.id);
    // The crossing's sync reached the character through the link, and its
    // update saved (it wrote the platform into platform_primary, which
    // failed every sync).
    const [synced] = await q('SELECT social_presence, social_synced_at, platform_primary FROM registry_characters WHERE id = :rc', { rc });
    expect(synced.social_presence).toBe(true);
    expect(synced.social_synced_at).not.toBeNull();
    expect(synced.platform_primary).toBeNull();

    const list = await auth(request(app).get('/api/v1/social-profiles').query({ search: `onelink${TAG}cross` }));
    expect(list.status).toBe(200);
    const row = list.body.profiles.find((x) => x.id === p.id);
    expect(row.registry_character_id).toBe(rc);

    // A profile already linked keeps its character.
    await run('UPDATE social_profiles SET status = :s WHERE id = :id', { s: 'finalized', id: p.id });
    const again = await auth(request(app).post(`/api/v1/social-profiles/${p.id}/cross`)).send({ registry_id: reg });
    expect(again.status).toBe(200);
    expect(again.body.registry_character.id).toBe(rc);
    expect((await q('SELECT COUNT(*)::int AS n FROM registry_characters WHERE feed_profile_id = :id', { id: p.id }))[0].n).toBe(1);
  });

  it('the profile\'s registry character loads through the model association, as the Feed post generator reads it', async () => {
    const p = await profile(handle('assoc'));
    const rc = await character('assoc', { profileId: p.id });
    const rows = await db.SocialProfile.findAll({
      where: { id: p.id },
      include: [{ model: db.RegistryCharacter, as: 'registryCharacter', attributes: ['id', 'display_name'], required: false }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].registryCharacter.id).toBe(rc);
  });

  it('the raw SQL join: the live entry, the newest should two claim one profile', async () => {
    const p = await profile(handle('join'));
    const older = await character('join-old', { profileId: p.id, updatedAt: "NOW() - INTERVAL '1 day'" });
    const newer = await character('join-new', { profileId: p.id });
    const unlinked = await profile(handle('none'));
    const read = async () => q(
      `SELECT sp.id, rc.id AS rc_id FROM social_profiles sp ${LINKED_CHARACTER_JOIN} WHERE sp.id IN (:ids) ORDER BY sp.id`,
      { ids: [p.id, unlinked.id] });
    expect(await read()).toEqual([{ id: p.id, rc_id: newer }, { id: unlinked.id, rc_id: null }]);
    await run('UPDATE registry_characters SET deleted_at = NOW() WHERE id = :newer', { newer });
    expect((await read())[0].rc_id).toBe(older);
  });

  it('creating a character on the Registry page makes no Feed profile', async () => {
    const res = await auth(request(app).post(`/api/v1/character-registry/registries/${reg}/characters`))
      .send({ display_name: `${NAME} Registry Made`, character_key: `registry-made-${TAG}`, feed_layer: 'lalaverse' });
    expect(res.status).toBe(201);
    expect(await linkOf(res.body.character.id)).toBeNull();
    const base = `one_link_${TAG}_registry_made`;
    expect((await q('SELECT COUNT(*)::int AS n FROM social_profiles WHERE handle LIKE :like', { like: `${base}%` }))[0].n).toBe(0);
    expect(res.body).not.toHaveProperty('feedProfile');
  });
});

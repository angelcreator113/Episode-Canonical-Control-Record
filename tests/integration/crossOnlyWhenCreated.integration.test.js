/**
 * The Feed's Cross (POST /social-profiles/:id/cross) marks a profile crossed
 * only when it has a character, in one transaction, and a profile whose
 * character was archived can be crossed again (Task #3209), against the test
 * database.
 *
 * Before: a Cross that made no character (no registry, or the key held by
 * another profile) still marked the profile crossed, and the next Cross was
 * refused. Re-crossing a profile whose character was archived tried to create
 * a second row under the same (registry_id, character_key), which the unique
 * index refuses, archived rows included: a 500. Archiving is a soft delete
 * that keeps the character's data, so it is restored.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const db = require('../../src/models');

const { sequelize } = db;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

const TAG = crypto.randomUUID().slice(0, 8);
const handle = (n) => `@crossonce${TAG}${n}`;
const keyOf = (h) => h.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
const NAME = `Cross Once ${TAG}`;

(shouldSkip ? describe.skip : describe)('Cross marks a profile crossed only with a character (Task #3209)', () => {
  let token;
  const reg = crypto.randomUUID();
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const cross = (id) => auth(request(app).post(`/api/v1/social-profiles/${id}/cross`)).send({ registry_id: reg });
  const profile = (h) => db.SocialProfile.create({
    handle: h, platform: 'instagram', vibe_sentence: 'Cross once test creator', status: 'finalized', feed_layer: 'lalaverse', display_name: `${NAME} ${h}`,
  });
  const profileRow = async (id) => (await q('SELECT status, crossed_at, world_exists FROM social_profiles WHERE id = :id', { id }))[0];

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-cross-once', email: 'test@cross-once.dev', name: 'Cross Once Test', groups: ['ADMIN'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'Cross once registry', NOW(), NOW())`, { reg });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    const like = `@crossonce${TAG}%`;
    const mine = 'SELECT id FROM social_profiles WHERE handle LIKE :like';
    await run(`DELETE FROM social_profile_followers WHERE social_profile_id IN (${mine})`, { like });
    await run('DELETE FROM world_timeline_events WHERE event_name LIKE :name', { name: `%${NAME}%` });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', { reg });
    await run('DELETE FROM social_profiles WHERE handle LIKE :like', { like });
    await run('DELETE FROM character_registries WHERE id = :reg', { reg });
  });

  it('crosses and links a new character together', async () => {
    const p = await profile(handle('ok'));
    const res = await cross(p.id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ crossed: true, restored: false });
    const [rc] = await q('SELECT id, feed_profile_id FROM registry_characters WHERE registry_id = :reg AND character_key = :key', { reg, key: keyOf(handle('ok')) });
    expect(rc.feed_profile_id).toBe(p.id);
    expect(res.body.registry_character.id).toBe(rc.id);
    expect(await profileRow(p.id)).toMatchObject({ status: 'crossed', world_exists: true });
  });

  it('leaves the profile uncrossed when no character is made, says why, and can be tried again', async () => {
    const other = await profile(handle('holder'));
    const p = await profile(handle('blocked'));
    // The key this profile would get is held by another profile.
    const held = crypto.randomUUID();
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, created_at, updated_at)
               VALUES (:held, :reg, :key, :name, :other, NOW(), NOW())`, { held, reg, key: keyOf(handle('blocked')), name: `${NAME} holder`, other: other.id });

    const res = await cross(p.id);
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ crossed: false, code: 'NO_CHARACTER_CREATED' });
    expect(res.body.error).toMatch(/linked to another profile/);
    expect(await profileRow(p.id)).toMatchObject({ status: 'finalized', crossed_at: null });

    // Once the key is free, the same Cross goes through (no "Already crossed").
    await run('UPDATE registry_characters SET character_key = :k WHERE id = :held', { held, k: `${keyOf(handle('blocked'))}_moved` });
    const again = await cross(p.id);
    expect(again.status).toBe(200);
    expect(again.body.crossed).toBe(true);
  });

  it('crosses a profile again after its character is archived, restoring that character', async () => {
    const p = await profile(handle('arch'));
    const first = await cross(p.id);
    expect(first.status).toBe(200);
    const characterId = first.body.registry_character.id;

    const archived = await auth(request(app).delete(`/api/v1/character-registry/characters/${characterId}`));
    expect(archived.status).toBe(200);
    const shown = await auth(request(app).get(`/api/v1/social-profiles/${p.id}`));
    expect(shown.body.profile.registry_character_id).toBeNull(); // "No character yet"

    const again = await cross(p.id);
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ crossed: true, restored: true });
    expect(again.body.registry_character.id).toBe(characterId);
    const [rc] = await q('SELECT deleted_at, feed_profile_id FROM registry_characters WHERE id = :characterId', { characterId });
    expect(rc).toMatchObject({ deleted_at: null, feed_profile_id: p.id });
    const count = await q('SELECT COUNT(*)::int AS n FROM registry_characters WHERE feed_profile_id = :id', { id: p.id });
    expect(count[0].n).toBe(1);

    const third = await cross(p.id);
    expect(third.status).toBe(409);
  });
});

/**
 * A character's Places tab (Evoni, 2026-10-17), on the migrated database
 * through the real routes:
 * - a place of work is a role of its own, beside home and closet;
 * - a character hosts an event (its host is their feed profile), and stops;
 *   an event hosted by someone else is not taken; no feed profile, no host.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261015160000-create-character-places');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Character places tab: place of work and hosted events', () => {
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const tag = uuid().slice(0, 8);

  async function cast() {
    const showId = uuid();
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
      { id: showId, name: `Hosting ${showId.slice(0, 8)}`, slug: `hosting-${showId.slice(0, 8)}` });
    const registry = uuid();
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:registry, 'Cast', :showId, NOW(), NOW())`, { registry, showId });
    const profile = async (name) => (await rows(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', :name, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${name.toLowerCase()}-${tag}-${uuid().slice(0, 4)}`, name }))[0].id;
    const character = async (name, withProfile = true) => {
      const id = uuid();
      const pid = withProfile ? await profile(name) : null;
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, created_at, updated_at)
                 VALUES (:id, :registry, :key, :name, :pid, NOW(), NOW())`, { id, registry, key: `${name.toLowerCase()}-${id.slice(0, 6)}`, name, pid });
      return { id, pid };
    };
    const event = async (name, hostPid = null) => {
      const id = uuid();
      await run(`INSERT INTO world_events (id, show_id, name, event_type, status, source_profile_id, created_at, updated_at)
                 VALUES (:id, :showId, :name, 'invite', 'ready', :hostPid, NOW(), NOW())`, { id, showId, name, hostPid });
      return id;
    };
    return { showId, character, event, profile };
  }
  const hostOf = async (id) => (await rows('SELECT source_profile_id FROM world_events WHERE id = :id', { id }))[0].source_profile_id;
  const host = (cid, eventId) => auth(request(app).post(`/api/v1/cast/characters/${cid}/hosted-events`)).send({ event_id: eventId });
  const unhost = (cid, eventId) => auth(request(app).delete(`/api/v1/cast/characters/${cid}/hosted-events/${eventId}`));

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({ id: 'test-user-hosting', email: 'u@hosting.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('a place of work is its own role; a character may have more than one', async () => {
    const { showId, character } = await cast();
    const sable = await character('Sable');
    const sets = [];
    for (const name of ['Studio', 'Gallery']) {
      const sid = uuid();
      await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, generation_status, created_at, updated_at) VALUES (:sid, :name, 'EVENT_LOCATION', :showId, 'pending', NOW(), NOW())`, { sid, name, showId });
      sets.push(sid);
      const res = await auth(request(app).post(`/api/v1/shows/${showId}/character-places`)).send({ character_id: sable.id, scene_set_id: sid, role: 'work' });
      expect(res.status).toBe(200);
    }
    const mine = await auth(request(app).get(`/api/v1/cast/characters/${sable.id}/places`));
    expect(mine.body.places.map((p) => [p.role, p.scene_set_name]).sort()).toEqual([['work', 'Gallery'], ['work', 'Studio']]);
  });

  it('hosting an event writes their feed profile as its host; stopping clears it', async () => {
    const { character, event } = await cast();
    const sable = await character('Sable');
    const ev = await event('Wearable Experiments');
    expect((await host(sable.id, ev)).status).toBe(200);
    expect(await hostOf(ev)).toBe(sable.pid);
    const appearances = await auth(request(app).get(`/api/v1/cast/characters/${sable.id}/appearances`));
    expect(appearances.body.events.find((e) => e.id === ev)).toMatchObject({ role: 'host', name: 'Wearable Experiments' });
    expect((await unhost(sable.id, ev)).status).toBe(200);
    expect(await hostOf(ev)).toBeNull();
  });

  it('an event hosted by someone else is not taken; no feed profile, no hosting; another show\'s event is refused', async () => {
    const { character, event } = await cast();
    const sable = await character('Sable');
    const lala = await character('Lala');
    const theirs = await event('Lala\'s brunch', lala.pid);
    const taken = await host(sable.id, theirs);
    expect(taken.status).toBe(409);
    expect(taken.body).toMatchObject({ code: 'HOSTED_BY_ANOTHER' });
    expect(taken.body.error).toMatch(/hosted by Lala/);
    expect(await hostOf(theirs)).toBe(lala.pid);
    expect((await unhost(sable.id, theirs)).status).toBe(409);

    const nobody = await character('Ghost', false);
    expect((await host(nobody.id, await event('Open house'))).body.code).toBe('NO_FEED_PROFILE');

    const other = await cast();
    expect((await host(sable.id, await other.event('Elsewhere'))).status).toBe(404);
    expect((await host(sable.id, 'not-an-id')).status).toBe(400);
  });

  // Fifth audit: a brand host, an automation host and a character with no
  // show were not respected.
  it('a brand host or an automation copy host is not replaced; a character in no show hosts nothing', async () => {
    const { character, event } = await cast();
    const sable = await character('Sable');
    const branded = await event('Maison Belle launch');
    await run(`UPDATE world_events SET host_brand = 'Maison Belle' WHERE id = :id`, { id: branded });
    const brand = await host(sable.id, branded);
    expect(brand.status).toBe(409);
    expect(brand.body).toMatchObject({ code: 'HOSTED_BY_BRAND' });
    expect(brand.body.error).toMatch(/Maison Belle/);

    const copied = await event('Feed brunch');
    await run(`UPDATE world_events SET canon_consequences = '{"automation":{"host_profile_id":"legacy-7"}}'::jsonb WHERE id = :id`, { id: copied });
    expect((await host(sable.id, copied)).body.code).toBe('HOSTED_BY_ANOTHER');
    expect(await hostOf(copied)).toBeNull();

    // A cast registry that names no show.
    const registry = uuid();
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:registry, 'Loose', NULL, NOW(), NOW())`, { registry });
    const loneId = uuid();
    const pid = (await rows(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:h, 'instagram', 'test', 'Lone', 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `lone-${tag}` }))[0].id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, created_at, updated_at)
               VALUES (:id, :registry, :key, 'Lone', :pid, NOW(), NOW())`, { id: loneId, registry, key: `lone-${loneId.slice(0, 6)}`, pid });
    expect((await host(loneId, await event('Open house'))).body.code).toBe('NO_SHOW');
  });

  // 2026-10-17: the Places tab adds an event's photos and angles to its set,
  // so each hosted event carries its scene set and whether it is a version.
  it('a hosted event carries its scene set, its name, and the everyday set it is a version of', async () => {
    const { showId, character, event } = await cast();
    const sable = await character('Sable');
    const ev = await event('Gala');
    const everyday = uuid();
    const dressed = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, generation_status, created_at, updated_at) VALUES (:id, 'Studio', 'EVENT_LOCATION', :showId, 'complete', NOW(), NOW())`, { id: everyday, showId });
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, version_of_set_id, generation_status, created_at, updated_at) VALUES (:id, 'Gala photos', 'EVENT_LOCATION', :showId, :everyday, 'complete', NOW(), NOW())`, { id: dressed, showId, everyday });
    await run('UPDATE world_events SET scene_set_id = :dressed WHERE id = :ev', { dressed, ev });
    expect((await host(sable.id, ev)).status).toBe(200);
    const res = await auth(request(app).get(`/api/v1/cast/characters/${sable.id}/appearances`));
    expect(res.body.events.find((e) => e.id === ev)).toMatchObject({ scene_set_id: dressed, scene_set_name: 'Gala photos', scene_set_version_of: everyday });
  });
});

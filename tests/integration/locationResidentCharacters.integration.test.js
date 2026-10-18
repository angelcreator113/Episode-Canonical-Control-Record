/**
 * Universe › Locations (Evoni, 2026-10-18: "start a studio's photos from
 * its card"): GET /world/locations gives each resident their character, so
 * the card can add the studio's photos as their place of work; a resident
 * with no character has null. (The list is the first 200 by name: the test
 * studio's name sorts first.)
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const db = require('../../src/models');

const { sequelize } = db;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('location residents carry their character', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID() };
  const p = {};
  let loc;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n, :s, NOW(), NOW())', { show: ids.show, n: `Res ${tag}`, s: `res-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Res', :show, NOW(), NOW())", ids);
    loc = (await db.WorldLocation.create({ name: `AAA Res${tag}'s Studio`, slug: `res-${tag}`, location_type: 'venue', venue_type: 'studio', city: 'Echo Park' })).id;
    for (const key of ['cast', 'loose']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, home_location_id, created_at, updated_at)
        VALUES (:h, 'pulse', 'x', :h, 'lalaverse', :loc, NOW(), NOW()) RETURNING id`, { h: `${key}${tag}`, loc });
      p[key] = row.id;
    }
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, created_at, updated_at)
      VALUES (:char, :reg, :k, 'Cast', :pid, NOW(), NOW())`, { ...ids, k: `res-${tag}`, pid: p.cast });
  });

  afterAll(async () => {
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:ids)', { ids: Object.values(p) });
    await run('DELETE FROM world_locations WHERE id = :loc', { loc });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('each resident has their character id, or null', async () => {
    const res = await request(app).get('/api/v1/world/locations');
    expect(res.status).toBe(200);
    const studio = res.body.locations.find((l) => l.id === loc);
    const byId = new Map(studio.residents.map((r) => [Number(r.id), r.character_id]));
    expect(byId.get(Number(p.cast))).toBe(ids.char);
    expect(byId.get(Number(p.loose))).toBeNull();
  });
});

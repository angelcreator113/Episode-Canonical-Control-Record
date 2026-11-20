/**
 * World Studio and Show Bible reads are an ADMIN's (Evoni, 2026-11-16),
 * against the test database.
 *
 * Eighteen world reads (world characters, intimate scenes and their
 * continuations, ecosystem previews and batches, world state, tensions, the
 * context summary, locations, the map) and five show-bible reads (the
 * franchise knowledge entries, Amber's activity, the documents, the writing
 * plan) were open reads: optionalAuth, so a request with no token got the
 * rows. They are production material. Each now asks for a sign-in (401) and
 * an ADMIN (403), by the existing requireAuth and authorize(['ADMIN']).
 * (The writing plan, /multi-product/all, is answered by an earlier router,
 * routes/upgradeRoutes, which asked for a sign-in only; it is an ADMIN's too.)
 *
 * A world character, an intimate scene, a location and a show-bible entry are
 * seeded with a marker; no refusal may carry it, and an ADMIN still reads it.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('World Studio and Show Bible reads are an ADMIN\'s', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const MARK = `ZZWORLD-${tag}`;
  const ids = { character: crypto.randomUUID(), scene: crypto.randomUUID() };
  let location; let entry;
  let ipN = 0;
  const tokens = {};
  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const get = (who, path) => {
    ipN += 1;
    const r = request(app).get(path).set('X-Forwarded-For', `198.51.${150 + Math.floor(ipN / 200)}.${(ipN % 200) + 1}`);
    return tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r;
  };

  // Every one of the 23 reads, at an address that exists.
  const world = () => [
    '/api/v1/world/characters',
    `/api/v1/world/characters/${ids.character}`,
    '/api/v1/world/batches',
    '/api/v1/world/tension-check',
    '/api/v1/world/scenes',
    `/api/v1/world/scenes/${ids.scene}`,
    `/api/v1/world/scenes/${ids.scene}/continuations`,
    `/api/v1/world/preview/${crypto.randomUUID()}`,
    '/api/v1/world/previews',
    `/api/v1/world/characters/${ids.character}/export`,
    `/api/v1/world/characters/${ids.character}/relationships`,
    '/api/v1/world/locations',
    '/api/v1/world/state/snapshots',
    '/api/v1/world/state/timeline',
    '/api/v1/world/tension-scanner',
    '/api/v1/world/context-summary',
    '/api/v1/world/map',
    '/api/v1/world/map/positions',
  ];
  const bible = () => [
    '/api/v1/franchise-brain/entries',
    '/api/v1/franchise-brain/amber-activity',
    '/api/v1/franchise-brain/documents',
    `/api/v1/franchise-brain/documents/${crypto.randomUUID()}`,
    '/api/v1/multi-product/all',
  ];
  const all = () => [...world(), ...bible()];

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@world.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    await run(`INSERT INTO world_characters (id, name, character_type, status, created_at, updated_at) VALUES (:id, :name, 'love_interest', 'draft', NOW(), NOW())`,
      { id: ids.character, name: `${MARK} character` });
    await run(`INSERT INTO intimate_scenes (id, character_a_id, character_a_name, scene_type, created_at, updated_at) VALUES (:id, :a, :name, 'first_encounter', NOW(), NOW())`,
      { id: ids.scene, a: ids.character, name: `${MARK} scene` });
    // The list is the first 200 by name: the seeded one sorts first.
    location = await models.WorldLocation.create({ name: `000 ${MARK} location`, slug: `zzworld-${tag}`, location_type: 'interior' });
    entry = await models.FranchiseKnowledge.create({
      title: `${MARK} entry`, content: `${MARK} law of the franchise`, category: 'narrative', severity: 'important',
      always_inject: false, applies_to: [], extracted_by: 'direct_entry', status: 'active', scope: 'franchise',
    });
  });

  afterAll(async () => {
    await run('DELETE FROM intimate_scenes WHERE id = :id', { id: ids.scene });
    await run('DELETE FROM world_characters WHERE id = :id', { id: ids.character });
    if (location) await run('DELETE FROM world_locations WHERE id = :id', { id: location.id });
    if (entry) await run('DELETE FROM franchise_knowledge WHERE id = :id', { id: entry.id });
  });

  test('there are 18 world reads and 5 show-bible reads, and the route files hold no open read', () => {
    expect(world()).toHaveLength(18);
    expect(bible()).toHaveLength(5);
    const fs = require('fs');
    const path = require('path');
    for (const file of ['worldStudio.js', 'franchiseBrainRoutes.js']) {
      const src = fs.readFileSync(path.join(__dirname, '../../src/routes', file), 'utf8');
      expect([file, /\boptionalAuth\b/.test(src)]).toEqual([file, false]);
      // Every GET in the file names a sign-in on its own line.
      for (const line of src.split('\n').filter((l) => /^router\.get\(/.test(l))) expect(line).toMatch(/requireAuth/);
    }
  });

  test('no token: 401 on every one, and nothing of the rows in the refusal', async () => {
    for (const path of all()) {
      const res = await get('anon', path);
      expect([path, res.status]).toEqual([path, 401]);
      expect(JSON.stringify(res.body)).not.toContain(MARK);
      for (const key of ['characters', 'character', 'scenes', 'scene', 'locations', 'entries', 'documents', 'snapshots', 'timeline', 'previews', 'batches', 'positions', 'data']) {
        expect([path, key, key in (res.body || {})]).toEqual([path, key, false]);
      }
    }
  });

  test.each(['viewer', 'editor'])('%s: 403 on every one, and nothing of the rows in the refusal', async (who) => {
    for (const path of all()) {
      const res = await get(who, path);
      expect([path, res.status]).toEqual([path, 403]);
      expect(JSON.stringify(res.body)).not.toContain(MARK);
      expect(Object.keys(res.body || {}).sort()).toEqual(expect.arrayContaining(['error']));
    }
  });

  test('an ADMIN is let through on every one (never 401 or 403)', async () => {
    for (const path of all()) {
      const res = await get('admin', path);
      expect([path, [401, 403].includes(res.status)]).toEqual([path, false]);
    }
  });

  test('an ADMIN still reads the material itself', async () => {
    const characters = await get('admin', '/api/v1/world/characters');
    expect(characters.status).toBe(200);
    expect(JSON.stringify(characters.body)).toContain(`${MARK} character`);
    const one = await get('admin', `/api/v1/world/characters/${ids.character}`);
    expect(one.status).toBe(200);
    expect(JSON.stringify(one.body)).toContain(`${MARK} character`);
    const scenes = await get('admin', '/api/v1/world/scenes');
    expect(scenes.status).toBe(200);
    expect(JSON.stringify(scenes.body)).toContain(`${MARK} scene`);
    const locations = await get('admin', '/api/v1/world/locations');
    expect(locations.status).toBe(200);
    expect(JSON.stringify(locations.body)).toContain(`${MARK} location`);
    const entries = await get('admin', '/api/v1/franchise-brain/entries?limit=5000');
    expect(entries.status).toBe(200);
    expect(JSON.stringify(entries.body)).toContain(`${MARK} entry`);
  });

  test('the public site and its looks, recaps and polls are not these reads, and still answer with no token', async () => {
    for (const path of ['/api/v1/public/site-content', '/api/v1/public/looks', '/api/v1/public/recaps']) {
      const res = await get('anon', path);
      expect([path, [401, 403].includes(res.status)]).toEqual([path, false]);
      expect(JSON.stringify(res.body)).not.toContain(MARK);
    }
  });
});

/**
 * The Property Manager's four writes are an ADMIN's (Evoni, 2026-11-22),
 * against the test database.
 *
 *   POST  /api/v1/properties                    makes a property
 *   PATCH /api/v1/properties/:id                edits one
 *   POST  /api/v1/properties/:id/rooms          adds a room and its scene set
 *   PATCH /api/v1/properties/:id/rooms/:roomId  edits a room
 *
 * All four asked for a sign-in only, and the three that take an id looked
 * the location up with no test of what it was: any signed-in account could
 * rename any World Location, hang a room and a scene set under any, and
 * replace the metadata of any location that had a parent. world_locations
 * has no owner column, so every row is shared production data.
 *
 * Now: no token 401; a signed-in account outside the admin group 403, before
 * the handler, nothing written; an ADMIN as before, on a property (a row
 * whose location_type is 'property', the test GET /:id makes) and on a room
 * that is that property's child. Any other id is refused and nothing is
 * written. No provider or storage is called by any of them.
 */
jest.unmock('uuid');

const mockAnthropic = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockAnthropic } })));
const mockReplicateRun = jest.fn();
jest.mock('replicate', () => jest.fn(() => ({ run: mockReplicateRun, predictions: { create: mockReplicateRun, get: mockReplicateRun } })));
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { ...actual, post: jest.fn(), get: jest.fn(), put: jest.fn(), delete: jest.fn(), request: jest.fn(), create: actual.create };
});
const mockS3Send = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: mockS3Send })) };
});

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const request = require('supertest');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');
const { readOnlyTokens } = require('../helpers/writeGuard');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'routes', 'propertyRoutes.js'), 'utf8');

describe('src/routes/propertyRoutes.js: the four writes carry the admin check, the reads do not', () => {
  test.each([
    ['post', '/'],
    ['patch', '/:id'],
    ['post', '/:id/rooms'],
    ['patch', '/:id/rooms/:roomId'],
  ])('%s %s is requireAuth, authorize([\'ADMIN\']), then the handler', (method, route) => {
    expect(SRC).toContain(`router.${method}('${route}', requireAuth, authorize(['ADMIN']), async (req, res) => {`);
  });

  test('those four are the only routes of the file that carry authorize', () => {
    expect(SRC.match(/authorize\(\['ADMIN'\]\)/g) || []).toHaveLength(4);
  });

  test('the four GETs and generate-empty stay a sign-in', () => {
    expect(SRC).toContain('router.get(\'/templates\', requireAuth, (req, res) => {');
    expect(SRC).toContain('router.get(\'/style-presets\', requireAuth, (req, res) => {');
    expect(SRC).toContain('router.get(\'/\', requireAuth, async (req, res) => {');
    expect(SRC).toContain('router.get(\'/:id\', requireAuth, async (req, res) => {');
    expect(SRC).toContain('router.post(\'/:id/rooms/:roomId/generate-empty\', requireAuth, async (req, res) => {');
  });

  test('the file declares nine routes and no delete', () => {
    expect(SRC.match(/^router\.(get|post|put|patch|delete)\(/gm) || []).toHaveLength(9);
    expect(SRC).not.toMatch(/^router\.delete\(/m);
  });
});

(shouldSkip ? describe.skip : describe)('The Property Manager\'s writes are an ADMIN\'s', () => {
  const tag = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  const universe = crypto.randomUUID();
  const ids = {
    property: crypto.randomUUID(), // a property, with a room
    room: crypto.randomUUID(),
    other: crypto.randomUUID(), // another property, with a room
    otherRoom: crypto.randomUUID(),
    venue: crypto.randomUUID(),
    city: crypto.randomUUID(), // a row as the DREAM seed writes a city
    district: crypto.randomUUID(), // a child of the city: has a parent, and the parent is not a property
    house: crypto.randomUUID(), // a home as "Fill in Lala's home" writes it: an 'interior' with a room
    houseRoom: crypto.randomUUID(),
  };
  const NON_ADMINS = ['viewer', 'editor', 'nogroup'];
  const NOT_PROPERTIES = [['a venue', 'venue'], ['a city', 'city'], ['a room', 'room'], ['a home that is an \'interior\'', 'house']];
  const NOT_A_PROPERTY = { success: false, error: 'This location is not a property' };
  const NO_PROPERTY = { success: false, error: 'Property not found' };
  const NO_ROOM = { success: false, error: 'Room not found in this property' };
  const tokens = {};
  const made = [];

  const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const send = (who, method, url, body) => {
    const r = request(app)[method](url);
    return (tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r).send(body);
  };
  // Every location and every scene set of the test database, every column.
  const everything = async () => ({
    locations: await rows('SELECT * FROM world_locations ORDER BY id'),
    sets: await rows('SELECT * FROM scene_sets ORDER BY id'),
  });
  const location = async (id) => (await rows('SELECT * FROM world_locations WHERE id = :id', { id }))[0];
  const providersCalled = () => [
    mockAnthropic, mockReplicateRun, axios.post, axios.get, axios.put, axios.delete, axios.request, mockS3Send,
  ].reduce((n, fn) => n + fn.mock.calls.length, 0);
  let fetchSpy;

  const insert = (id, name, type, extra = {}) => run(
    `INSERT INTO world_locations (id, universe_id, name, description, location_type, parent_location_id, city, metadata, created_at, updated_at)
     VALUES (:id, :universe, :name, :description, :type, :parent, :city, CAST(:metadata AS jsonb), NOW(), NOW())`,
    {
      id, universe, name: `${name} ${tag}`, description: `${name} as seeded`, type,
      parent: extra.parent || null, city: extra.city || null, metadata: JSON.stringify(extra.metadata || {}),
    });
  const seed = async () => {
    await run('DELETE FROM scene_sets WHERE world_location_id IN (SELECT id FROM world_locations WHERE universe_id = :universe)', { universe });
    await run('DELETE FROM world_locations WHERE universe_id = :universe AND parent_location_id IS NOT NULL', { universe });
    await run('DELETE FROM world_locations WHERE universe_id = :universe', { universe });
    await insert(ids.property, 'Property', 'property', { city: 'Echo Park', metadata: { property_type: 'penthouse', style_guide: { label: 'Modern Glam' }, kept: 'yes' } });
    await insert(ids.room, 'Room', 'interior', { parent: ids.property, city: 'Echo Park', metadata: { a: 1, b: 2 } });
    await insert(ids.other, 'Other property', 'property', { metadata: { property_type: 'villa' } });
    await insert(ids.otherRoom, 'Other room', 'interior', { parent: ids.other, metadata: { theirs: true } });
    await insert(ids.venue, 'Venue', 'venue', { city: 'Radiance Row', metadata: { venue: 'kept' } });
    await insert(ids.city, 'City', 'city', { city: 'Echo Park', metadata: { seed: 'dream' } });
    await insert(ids.district, 'District', 'district', { parent: ids.city, city: 'Echo Park', metadata: { district: 'kept' } });
    await insert(ids.house, 'Home', 'interior', { parent: ids.city, city: 'Echo Park', metadata: { source: 'lala_home' } });
    await insert(ids.houseRoom, 'Home room', 'interior', { parent: ids.house, city: 'Echo Park', metadata: { source: 'lala_home' } });
  };

  // The four writes, each on a target that an ADMIN's request would change.
  const WRITES = [
    ['POST /properties', 'post', () => '/api/v1/properties', { name: `Refused ${tag}`, property_type: 'loft' }],
    ['PATCH /properties/:id', 'patch', () => `/api/v1/properties/${ids.property}`, { name: `Renamed ${tag}`, metadata: { hacked: true } }],
    ['POST /properties/:id/rooms', 'post', () => `/api/v1/properties/${ids.property}/rooms`, { name: `Refused room ${tag}`, room_type: 'closet' }],
    ['PATCH /properties/:id/rooms/:roomId', 'patch', () => `/api/v1/properties/${ids.property}/rooms/${ids.room}`, { name: `Renamed room ${tag}`, metadata: { hacked: true } }],
  ];

  beforeAll(async () => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@property.dev`, name: id, groups, role }).accessToken;
    Object.assign(tokens, readOnlyTokens(`property-${tag}`));
    tokens.nogroup = token(`nogroup-${tag}`, [], undefined);
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    await run('INSERT INTO universes (id, name, slug, created_at, updated_at) VALUES (:universe, :n, :n, NOW(), NOW())', { universe, n: `property-${tag}` });
  });

  beforeEach(async () => {
    await seed();
    jest.clearAllMocks();
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () => { throw new Error('no network in this test'); });
  });

  afterEach(() => {
    expect(providersCalled()).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  afterAll(async () => {
    const log = (what) => (err) => console.error(`[cleanup] ${what}:`, err.message);
    if (made.length) {
      await run('DELETE FROM scene_sets WHERE world_location_id IN (:made)', { made }).catch(log('made scene sets'));
      await run('DELETE FROM world_locations WHERE id IN (:made) AND parent_location_id IS NOT NULL', { made }).catch(log('made rooms'));
      await run('DELETE FROM world_locations WHERE id IN (:made)', { made }).catch(log('made locations'));
    }
    await run('DELETE FROM scene_sets WHERE universe_id = :universe', { universe }).catch(log('scene sets'));
    await run('DELETE FROM world_locations WHERE universe_id = :universe AND parent_location_id IN (SELECT id FROM world_locations WHERE parent_location_id IS NOT NULL)', { universe }).catch(log('grandchildren'));
    await run('DELETE FROM world_locations WHERE universe_id = :universe AND parent_location_id IS NOT NULL', { universe }).catch(log('children'));
    await run('DELETE FROM world_locations WHERE universe_id = :universe', { universe }).catch(log('locations'));
    await run('DELETE FROM universes WHERE id = :universe', { universe }).catch(log('universe'));
  });

  describe.each(WRITES)('%s', (_name, method, url, body) => {
    test('signed out: a 401 and nothing written', async () => {
      const before = await everything();
      const res = await send(null, method, url(), body);
      expect(res.status).toBe(401);
      expect(await everything()).toEqual(before);
    });

    test('a viewer, an editor and an account in no group: a 403 and nothing written', async () => {
      const before = await everything();
      for (const who of NON_ADMINS) {
        // eslint-disable-next-line no-await-in-loop
        const res = await send(who, method, url(), body);
        expect({ who, status: res.status, code: res.body.code }).toEqual({ who, status: 403, code: 'AUTH_GROUP_REQUIRED' });
        expect(res.body.data).toBeUndefined();
        // eslint-disable-next-line no-await-in-loop
        expect(await everything()).toEqual(before);
      }
    });
  });

  describe('an ADMIN, on a property and its room', () => {
    test('POST /properties makes a property, as before', async () => {
      const res = await send('admin', 'post', '/api/v1/properties', {
        name: `Made ${tag}`, property_type: 'loft', style_preset_id: 'modern-glam', universe_id: universe, city: 'echo_park',
      });
      expect(res.status).toBe(201);
      made.push(res.body.data.id);
      expect(res.body).toMatchObject({
        success: true,
        data: { name: `Made ${tag}`, location_type: 'property', universe_id: universe, city: 'Echo Park', metadata: { property_type: 'loft' } },
      });
      expect(res.body.data.metadata.style_guide).toBeTruthy();
      expect(await location(res.body.data.id)).toMatchObject({ location_type: 'property', parent_location_id: null, name: `Made ${tag}` });
    });

    test('POST /properties with no name is still a 400', async () => {
      const before = await everything();
      const res = await send('admin', 'post', '/api/v1/properties', { property_type: 'loft' });
      expect([res.status, res.body]).toEqual([400, { success: false, error: 'name is required' }]);
      expect(await everything()).toEqual(before);
    });

    test('PATCH /properties/:id merges metadata and maps property_type, style_guide and floor_plan into it', async () => {
      const res = await send('admin', 'patch', `/api/v1/properties/${ids.property}`, {
        name: `Renamed ${tag}`, description: 'new words', metadata: { added: 1 },
        property_type: 'mansion', style_guide: { label: 'Coastal' }, floor_plan: { rooms: 3 }, location_type: 'venue',
      });
      expect(res.status).toBe(200);
      const metadata = { kept: 'yes', added: 1, property_type: 'mansion', style_guide: { label: 'Coastal' }, floor_plan: { rooms: 3 } };
      expect(res.body).toMatchObject({ success: true, data: { id: ids.property, name: `Renamed ${tag}`, description: 'new words', metadata } });
      const row = await location(ids.property);
      expect(row.metadata).toEqual(metadata);
      // Outside the handler's allowed fields: unchanged.
      expect(row).toMatchObject({ location_type: 'property', city: 'Echo Park', property_type: null, style_guide: null, floor_plan: null });
    });

    test('POST /properties/:id/rooms adds a room in the property\'s universe and city, and its scene set', async () => {
      const before = await everything();
      const res = await send('admin', 'post', `/api/v1/properties/${ids.property}/rooms`, { name: `Closet ${tag}`, room_type: 'closet' });
      expect(res.status).toBe(201);
      const { room, sceneSet, template } = res.body.data;
      made.push(room.id);
      expect(res.body.success).toBe(true);
      expect(template).toBeNull();
      expect(await location(room.id)).toMatchObject({
        name: `Closet ${tag}`, location_type: 'interior', parent_location_id: ids.property, universe_id: universe, city: 'Echo Park',
        description: `Closet ${tag} in Property ${tag}`,
      });
      const sets = await rows('SELECT * FROM scene_sets WHERE world_location_id = :id', { id: room.id });
      expect(sets).toHaveLength(1);
      expect(sets[0]).toMatchObject({
        id: sceneSet.id, name: `Closet ${tag}`, scene_type: 'CLOSET', universe_id: universe, generation_status: 'pending',
        canvas_settings: { room_type: 'closet', room_layout_template: null },
      });
      const after = await everything();
      expect(after.locations).toHaveLength(before.locations.length + 1);
      expect(after.sets).toHaveLength(before.sets.length + 1);
    });

    test('POST /properties/:id/rooms with no name is still a 400', async () => {
      const before = await everything();
      const res = await send('admin', 'post', `/api/v1/properties/${ids.property}/rooms`, { room_type: 'closet' });
      expect([res.status, res.body]).toEqual([400, { success: false, error: 'name is required' }]);
      expect(await everything()).toEqual(before);
    });

    test('PATCH /properties/:id/rooms/:roomId replaces the room\'s metadata whole, as before', async () => {
      const res = await send('admin', 'patch', `/api/v1/properties/${ids.property}/rooms/${ids.room}`, {
        name: `Room renamed ${tag}`, description: 'room words', style_guide: { label: 'Room guide' }, metadata: { only: 'this' },
        location_type: 'venue', parent_location_id: ids.other,
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, data: { id: ids.room, name: `Room renamed ${tag}`, metadata: { only: 'this' } } });
      const row = await location(ids.room);
      expect(row.metadata).toEqual({ only: 'this' });
      expect(row).toMatchObject({
        name: `Room renamed ${tag}`, description: 'room words', style_guide: { label: 'Room guide' },
        location_type: 'interior', parent_location_id: ids.property,
      });
    });

    test('GET /properties and GET /properties/:id still answer an editor', async () => {
      const list = await send('editor', 'get', '/api/v1/properties');
      expect(list.status).toBe(200);
      expect(list.body.data.map((p) => p.id)).toEqual(expect.arrayContaining([ids.property, ids.other]));
      expect(list.body.data.map((p) => p.id)).not.toContain(ids.house);
      const one = await send('editor', 'get', `/api/v1/properties/${ids.property}`);
      expect(one.status).toBe(200);
      expect(one.body.data.childLocations.map((r) => r.id)).toEqual([ids.room]);
      const notOne = await send('editor', 'get', `/api/v1/properties/${ids.venue}`);
      expect([notOne.status, notOne.body]).toEqual([400, NOT_A_PROPERTY]);
    });
  });

  describe('an ADMIN, on a location that is not a property', () => {
    test.each(NOT_PROPERTIES)('PATCH /properties/:id with %s as :id: GET /:id\'s 400 and nothing written', async (_what, key) => {
      const before = await everything();
      const res = await send('admin', 'patch', `/api/v1/properties/${ids[key]}`, {
        name: `Renamed ${tag}`, description: 'x', metadata: { hacked: true }, property_type: 'loft', style_guide: { a: 1 }, floor_plan: { b: 2 },
      });
      expect([res.status, res.body]).toEqual([400, NOT_A_PROPERTY]);
      expect(await everything()).toEqual(before);
    });

    test.each(NOT_PROPERTIES)('POST /properties/:id/rooms with %s as :id: the same 400, no room and no scene set', async (_what, key) => {
      const before = await everything();
      const res = await send('admin', 'post', `/api/v1/properties/${ids[key]}/rooms`, { name: `Stray room ${tag}`, room_type: 'closet' });
      expect([res.status, res.body]).toEqual([400, NOT_A_PROPERTY]);
      expect(await everything()).toEqual(before);
    });

    test.each([
      ['a city as :id and its district as :roomId', 'city', 'district'],
      ['a home that is an \'interior\' as :id and its room as :roomId', 'house', 'houseRoom'],
      ['a room as :id and itself as :roomId', 'room', 'room'],
      ['a venue as :id and a property\'s room as :roomId', 'venue', 'room'],
    ])('PATCH /properties/:id/rooms/:roomId with %s: a 404 and nothing written', async (_what, parent, child) => {
      const before = await everything();
      const res = await send('admin', 'patch', `/api/v1/properties/${ids[parent]}/rooms/${ids[child]}`, { name: `Renamed ${tag}`, metadata: { hacked: true } });
      expect([res.status, res.body]).toEqual([404, NO_ROOM]);
      expect(await everything()).toEqual(before);
    });

    test.each([
      ['the room of another property', 'otherRoom'],
      ['a venue', 'venue'],
      ['a district of a city', 'district'],
      ['another property', 'other'],
      ['the property itself', 'property'],
    ])('PATCH /properties/:id/rooms/:roomId on a property, with %s as :roomId: a 404 and nothing written', async (_what, child) => {
      const before = await everything();
      const res = await send('admin', 'patch', `/api/v1/properties/${ids.property}/rooms/${ids[child]}`, { name: `Renamed ${tag}`, metadata: { hacked: true } });
      expect([res.status, res.body]).toEqual([404, NO_ROOM]);
      expect(await everything()).toEqual(before);
    });
  });

  describe('an ADMIN, on an id that names nothing', () => {
    const unknown = crypto.randomUUID();
    test.each([['a UUID no location has', unknown], ['text that is not a UUID', 'not-a-uuid'], ['a number', '42']])(
      'PATCH /properties/:id and POST /properties/:id/rooms with %s: a 404 and nothing written', async (_what, id) => {
        const before = await everything();
        const patch = await send('admin', 'patch', `/api/v1/properties/${id}`, { name: `Renamed ${tag}` });
        expect([patch.status, patch.body]).toEqual([404, NO_PROPERTY]);
        const post = await send('admin', 'post', `/api/v1/properties/${id}/rooms`, { name: `Stray room ${tag}` });
        expect([post.status, post.body]).toEqual([404, NO_PROPERTY]);
        expect(await everything()).toEqual(before);
      });

    test.each([['a UUID no location has', unknown], ['text that is not a UUID', 'not-a-uuid'], ['a number', '42']])(
      'PATCH /properties/:id/rooms/:roomId with %s as either id: a 404 and nothing written', async (_what, id) => {
        const before = await everything();
        const asRoom = await send('admin', 'patch', `/api/v1/properties/${ids.property}/rooms/${id}`, { name: `Renamed ${tag}` });
        expect([asRoom.status, asRoom.body]).toEqual([404, NO_ROOM]);
        const asProperty = await send('admin', 'patch', `/api/v1/properties/${id}/rooms/${ids.room}`, { name: `Renamed ${tag}` });
        expect([asProperty.status, asProperty.body]).toEqual([404, NO_ROOM]);
        expect(await everything()).toEqual(before);
      });
  });
});

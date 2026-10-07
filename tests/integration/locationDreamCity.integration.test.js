/**
 * Locations get a DREAM city (wiring map, docs/reads/2026-10-06-lalaverse-
 * wiring-map.md, fix-list item 18): a property takes one, a room inherits
 * its property's, and POST/PUT /world/locations store a DREAM city as
 * DREAM_CITIES spells it so the World tab's map counts it.
 */
jest.unmock('uuid');

const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Locations get a DREAM city', () => {
  const made = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const cityOf = async (id) => (await q('SELECT city FROM world_locations WHERE id = :id', { id }))[0].city;

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-dream-city', email: 'test@dream-city.dev', name: 'Dream City Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    if (!made.length) return;
    await run('DELETE FROM scene_sets WHERE world_location_id IN (:ids)', { ids: made });
    await run('DELETE FROM world_locations WHERE id IN (:ids)', { ids: made });
  });

  it('a property takes a DREAM city and its room inherits it', async () => {
    const prop = await auth(request(app).post('/api/v1/properties')).send({ name: 'Dream City Test Penthouse', city: 'echo_park' });
    expect(prop.status).toBe(201);
    made.push(prop.body.data.id);
    expect(await cityOf(prop.body.data.id)).toBe('Echo Park');

    const room = await auth(request(app).post(`/api/v1/properties/${prop.body.data.id}/rooms`)).send({ name: 'Dream City Test Closet', room_type: 'closet' });
    expect(room.status).toBeLessThan(300);
    const roomId = room.body.data?.room?.id || room.body.data?.id || room.body.room?.id;
    made.push(roomId);
    expect(await cityOf(roomId)).toBe('Echo Park');
  });

  it('a property given a city outside the five gets none', async () => {
    const prop = await auth(request(app).post('/api/v1/properties')).send({ name: 'Dream City Test Nova', city: 'Nova Prime' });
    made.push(prop.body.data.id);
    expect(await cityOf(prop.body.data.id)).toBeNull();
  });

  it('POST and PUT /world/locations store a DREAM city canonically and keep another city as written', async () => {
    const a = await auth(request(app).post('/api/v1/world/locations')).send({ name: 'Dream City Test Bar', location_type: 'venue', city: ' radiance row ' });
    expect(a.status).toBe(200);
    made.push(a.body.location.id);
    expect(await cityOf(a.body.location.id)).toBe('Radiance Row');

    const put = await auth(request(app).put(`/api/v1/world/locations/${a.body.location.id}`)).send({ city: 'ascent_tower' });
    expect(put.status).toBe(200);
    expect(await cityOf(a.body.location.id)).toBe('Ascent Tower');

    const b = await auth(request(app).post('/api/v1/world/locations')).send({ name: 'Dream City Test Far', location_type: 'venue', city: 'Port Sable' });
    made.push(b.body.location.id);
    expect(await cityOf(b.body.location.id)).toBe('Port Sable');
  });
});

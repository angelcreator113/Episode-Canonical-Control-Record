/**
 * A venue's own photo (Evoni, 2026-10-17: "the main photo and the venue
 * photo maybe different ... the venue has its own photo"), on the migrated
 * database through the real routes: kept on the World Location, apart from
 * the set's main photo; on the set list and a character's place of work.
 */
jest.unmock('uuid');

const mockS3Send = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: mockS3Send })) };
});

const request = require('supertest');
const crypto = require('crypto');
const sharp = require('sharp');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261017043106-world-location-venue-photo');
const placesMigration = require('../../src/migrations/20261015160000-create-character-places');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('A venue\'s own photo', () => {
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const photo = () => sharp({ create: { width: 900, height: 1200, channels: 3, background: '#a87' } }).png().toBuffer();

  async function venue({ location = true } = {}) {
    const showId = uuid();
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :n, :n, '{}', NOW(), NOW())`, { id: showId, n: `venue-${showId.slice(0, 8)}` });
    const loc = location ? uuid() : null;
    if (loc) await run(`INSERT INTO world_locations (id, name, created_at, updated_at) VALUES (:loc, 'Studio by Sable', NOW(), NOW())`, { loc });
    const set = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, base_still_url, generation_status, created_at, updated_at)
               VALUES (:set, 'Studio', 'EVENT_LOCATION', :showId, :loc, 'https://x/inside.jpg', 'complete', NOW(), NOW())`, { set, showId, loc });
    return { showId, loc, set };
  }

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    await placesMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({ id: 'test-user-venue', email: 'u@venue.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });
  beforeEach(() => {
    mockS3Send.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('the migration is re-runnable, and down drops only its own column', async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    const has = async () => (await rows(`SELECT 1 FROM information_schema.columns WHERE table_name = 'world_locations' AND column_name = 'venue_photo_url'`)).length;
    expect(await has()).toBe(1);
    await migration.down(sequelize.getQueryInterface(), Sequelize);
    expect(await has()).toBe(0);
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    expect(await has()).toBe(1);
  });

  it('upload keeps the photo whole on the World Location; the set list carries it; the main photo is untouched; remove clears it', async () => {
    const { showId, loc, set } = await venue();
    const res = await auth(request(app).post(`/api/v1/scene-sets/${set}/venue-photo`)).attach('image', await photo(), 'street.png');
    expect(res.status).toBe(200);
    expect(res.body.data.venue_photo_url).toMatch(new RegExp(`world-locations/${loc}/venue-photo-\\d+\\.jpg$`));
    const sent = mockS3Send.mock.calls[0][0].input;
    expect(sent.ContentType).toBe('image/jpeg');
    expect(await sharp(sent.Body).metadata()).toMatchObject({ width: 900, height: 1200 });
    expect((await rows('SELECT venue_photo_url FROM world_locations WHERE id = :loc', { loc }))[0].venue_photo_url).toBe(res.body.data.venue_photo_url);
    const list = await auth(request(app).get('/api/v1/scene-sets').query({ show_id: showId }));
    const mine = list.body.data.find((s) => s.id === set);
    expect(mine).toMatchObject({ venue_photo_url: res.body.data.venue_photo_url, base_still_url: 'https://x/inside.jpg' });

    expect((await auth(request(app).delete(`/api/v1/scene-sets/${set}/venue-photo`))).status).toBe(200);
    expect((await rows('SELECT venue_photo_url FROM world_locations WHERE id = :loc', { loc }))[0].venue_photo_url).toBeNull();
  });

  it('a set with no World Location is refused; so is a file that is not an image', async () => {
    const none = await venue({ location: false });
    const refused = await auth(request(app).post(`/api/v1/scene-sets/${none.set}/venue-photo`)).attach('image', await photo(), 'street.png');
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('NO_LOCATION');
    const { set } = await venue();
    const junk = await auth(request(app).post(`/api/v1/scene-sets/${set}/venue-photo`)).attach('image', Buffer.from('nope'), { filename: 'x.png', contentType: 'image/png' });
    expect(junk.status).toBe(400);
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  it("a character's place of work carries its venue's photo", async () => {
    const { showId, loc, set } = await venue();
    await run(`UPDATE world_locations SET venue_photo_url = 'https://x/street.jpg' WHERE id = :loc`, { loc });
    const registry = uuid();
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:registry, 'Cast', :showId, NOW(), NOW())`, { registry, showId });
    const cid = uuid();
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, created_at, updated_at) VALUES (:cid, :registry, :key, 'Sable', NOW(), NOW())`,
      { cid, registry, key: `sable-${cid.slice(0, 6)}` });
    expect((await auth(request(app).post(`/api/v1/shows/${showId}/character-places`)).send({ character_id: cid, scene_set_id: set, role: 'work' })).status).toBe(200);
    const places = await auth(request(app).get(`/api/v1/cast/characters/${cid}/places`));
    expect(places.body.places).toEqual([expect.objectContaining({ role: 'work', scene_set_id: set, venue_photo_url: 'https://x/street.jpg' })]);
  });

  // Fifth audit: a replaced or removed photo stayed in the bucket; the
  // upload took 20 files for one.
  it('a replaced or removed photo is deleted from storage; one file per upload', async () => {
    const { loc, set } = await venue();
    const first = await auth(request(app).post(`/api/v1/scene-sets/${set}/venue-photo`)).attach('image', await photo(), 'a.png');
    mockS3Send.mockClear();
    const second = await auth(request(app).post(`/api/v1/scene-sets/${set}/venue-photo`)).attach('image', await photo(), 'b.png');
    expect(second.status).toBe(200);
    const deleted = mockS3Send.mock.calls.map((c) => c[0]).filter((c) => c.constructor.name === 'DeleteObjectCommand');
    expect(deleted.map((c) => c.input.Key)).toEqual([first.body.data.venue_photo_url.split('.amazonaws.com/')[1]]);
    mockS3Send.mockClear();
    expect((await auth(request(app).delete(`/api/v1/scene-sets/${set}/venue-photo`))).status).toBe(200);
    expect(mockS3Send.mock.calls.map((c) => c[0].input.Key)).toEqual([second.body.data.venue_photo_url.split('.amazonaws.com/')[1]]);
    expect((await rows('SELECT venue_photo_url FROM world_locations WHERE id = :loc', { loc }))[0].venue_photo_url).toBeNull();

    const many = await auth(request(app).post(`/api/v1/scene-sets/${set}/venue-photo`))
      .attach('images', await photo(), 'x.png').attach('images', await photo(), 'y.png');
    expect(many.status).toBe(400);
  });
});

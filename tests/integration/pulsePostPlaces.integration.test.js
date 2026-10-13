/**
 * A post's location (Task #3090; Evoni, 2026-10-13: "Allow a Dream City or a
 * canonical venue. Selecting a venue automatically supplies its city.
 * Published posts appear in that city's feed"), against the test database:
 * - POST /feed-posts takes place_city or place_location_id; a venue fills in
 *   its city (its own, else a parent's); an unknown city or venue is a 400;
 * - the list returns each post's place with its venue's name;
 * - ?city= keeps the posts tagged there and the untagged posts of its
 *   profiles, but not a poster's post tagged elsewhere;
 * - a tag never moves the poster's city;
 * - PUT changes or clears a draft's (a live post is locked, as before); GET /feed-posts/places lists cities and venues.
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

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The Pulse post locations (Task #3090)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), district: uuid(), room: uuid(), lounge: uuid(), nowhere: uuid() };
  const p = {};
  let token;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);
  const create = (key, text, extra = {}) => as(request(app).post('/api/v1/feed-posts')).send({
    show_id: ids.show, social_profile_id: p[key], poster_handle: `${key}${tag}`, poster_display_name: key,
    poster_platform: 'lalaverse', content_text: text, status: 'live', ...extra,
  });
  const texts = (res) => res.body.data.map((x) => x.content_text).sort();

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-places', email: 'evoni@places.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Places ${tag}`, slug: `places-${tag}` });
    for (const [key, city] of [['nia', 'echo_park'], ['marcus', 'dazzle_district']]) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, city, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', :city, NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: key, city });
      p[key] = row.id;
    }
    // Dazzle District (a location named for the city) > Velvet Room (no city of its own);
    // Neon Lounge says Echo Park itself; Nowhere has no city at all.
    const loc = (id, name, city, parent = null) => run(`INSERT INTO world_locations (id, name, city, parent_location_id, location_type, created_at, updated_at)
      VALUES (:id, :name, :city, :parent, 'interior', NOW(), NOW())`, { id, name, city, parent });
    await loc(ids.district, 'Dazzle District', null);
    await loc(ids.room, `Velvet Room ${tag}`, null, ids.district);
    await loc(ids.lounge, `Neon Lounge ${tag}`, 'Echo Park');
    await loc(ids.nowhere, `Nowhere ${tag}`, null);
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM world_locations WHERE id IN (:a)', { a: [ids.room, ids.lounge, ids.nowhere, ids.district] });
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('a venue supplies its city; a city alone is kept; bad input is a 400', async () => {
    const venue = await create('nia', 'velvet night', { place_location_id: ids.room, place_city: 'echo_park' });
    expect(venue.status).toBe(200);
    expect(venue.body.data).toMatchObject({ place_location_id: ids.room, place_city: 'dazzle_district' });   // from its parent, not the sent city
    const lounge = await create('marcus', 'neon night', { place_location_id: ids.lounge });
    expect(lounge.body.data.place_city).toBe('echo_park');
    const city = await create('marcus', 'radiance day', { place_city: 'Radiance Row' });
    expect(city.body.data).toMatchObject({ place_city: 'radiance_row', place_location_id: null });
    const none = await create('nia', 'home again');
    expect(none.body.data).toMatchObject({ place_city: null, place_location_id: null });
    expect((await create('nia', 'x', { place_city: 'atlantis' })).status).toBe(400);
    expect((await create('nia', 'x', { place_location_id: 'not-a-uuid' })).status).toBe(400);
    expect((await create('nia', 'x', { place_location_id: uuid() })).status).toBe(400);
    // A tag is a label only: the poster's city stays.
    const [[nia]] = await run('SELECT city FROM social_profiles WHERE id = :id', { id: p.nia });
    expect(nia.city).toBe('echo_park');
  });

  test("a city's feed: posts tagged there, and its profiles' untagged posts", async () => {
    const dazzle = await request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&city=dazzle_district`);
    expect(dazzle.status).toBe(200);
    // Nia's Velvet Room post is here; Marcus's posts tagged Echo Park and Radiance Row are not.
    expect(texts(dazzle)).toEqual(['velvet night']);
    const echo = await request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&city=echo_park`);
    expect(texts(echo)).toEqual(['home again', 'neon night']);
    const radiance = await request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&city=radiance_row`);
    expect(texts(radiance)).toEqual(['radiance day']);
    const all = await request(app).get(`/api/v1/feed-posts?show_id=${ids.show}`);
    const byText = Object.fromEntries(all.body.data.map((x) => [x.content_text, x.place]));
    expect(byText['velvet night']).toEqual({ city: 'dazzle_district', city_name: 'Dazzle District', location_id: ids.room, name: `Velvet Room ${tag}` });
    expect(byText['radiance day']).toEqual({ city: 'radiance_row', city_name: 'Radiance Row', location_id: null, name: null });
    expect(byText['home again']).toBeNull();
  });

  test("PUT changes or clears a draft's place; GET /places lists cities and venues with their cities", async () => {
    const draft = await create('nia', 'a draft', { status: 'draft' });
    const row = draft.body.data;
    const moved = await as(request(app).put(`/api/v1/feed-posts/${row.id}`)).send({ place_location_id: ids.lounge });
    expect(moved.status).toBe(200);
    expect(moved.body.data).toMatchObject({ place_location_id: ids.lounge, place_city: 'echo_park' });
    expect((await as(request(app).put(`/api/v1/feed-posts/${row.id}`)).send({ place_city: 'nowhere' })).status).toBe(400);
    const cleared = await as(request(app).put(`/api/v1/feed-posts/${row.id}`)).send({ place_location_id: null, place_city: null });
    expect(cleared.body.data).toMatchObject({ place_location_id: null, place_city: null });

    expect((await request(app).get('/api/v1/feed-posts/places')).status).toBe(401);
    const places = await as(request(app).get('/api/v1/feed-posts/places'));
    expect(places.status).toBe(200);
    expect(places.body.cities.map((c) => c.key)).toEqual(['dazzle_district', 'radiance_row', 'echo_park', 'ascent_tower', 'maverick_harbor']);
    const mine = Object.fromEntries(places.body.venues.filter((v) => v.name.endsWith(tag)).map((v) => [v.name, v.city]));
    expect(mine).toEqual({ [`Velvet Room ${tag}`]: 'dazzle_district', [`Neon Lounge ${tag}`]: 'echo_park', [`Nowhere ${tag}`]: null });
    expect(places.body.venues.some((v) => v.id === ids.district)).toBe(false);   // a city, not a venue
  });
});

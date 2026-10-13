/**
 * The Dream Cities as Lala sees them (Task #3041; follow-up to #3034):
 * GET /api/v1/pulse-reveals/cities sends a city's image or story bubble as
 * its teaser before its moment, none when hidden, and the full image from
 * its moment on; with no moment (Director view) nothing is held back; with
 * no saved list, none. The full image URL never appears before its moment.
 *
 * The saved list is one shared row (page_content world_infrastructure ›
 * DREAM_CITIES): this suite saves it and puts it back as it was.
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

const CITIES = [
  { key: 'dazzle_district', name: 'Dazzle District', image_url: 'https://cdn/full/dazzle.jpg', image_alt: 'The runway at night', bubble_image_url: 'https://cdn/full/dazzle-bubble.jpg' },
  { key: 'echo_park', name: 'Echo Park', image_url: 'https://cdn/full/echo.jpg', bubble_image_url: 'https://cdn/full/echo-bubble.jpg' },
  { key: 'ascent_tower', name: 'Ascent Tower', image_url: 'https://cdn/full/ascent.jpg' },
];

(shouldSkip ? describe.skip : describe)('The Pulse city teasers (Task #3041)', () => {
  const ids = { show: uuid() };
  let token;
  let saved;
  const get = (q) => request(app).get(`/api/v1/pulse-reveals/cities?show_id=${ids.show}${q}`).set('Authorization', `Bearer ${token}`);
  const setList = (data) => run(
    `INSERT INTO page_content (id, page_name, constant_key, data, created_at, updated_at)
     VALUES (:id, 'world_infrastructure', 'DREAM_CITIES', CAST(:data AS jsonb), NOW(), NOW())
     ON CONFLICT (page_name, constant_key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    { id: uuid(), data: JSON.stringify(data) });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-city-teasers', email: 'evoni@cities.dev', name: 'Cities', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    const [[row]] = await run(`SELECT data FROM page_content WHERE page_name = 'world_infrastructure' AND constant_key = 'DREAM_CITIES'`);
    saved = row ? row.data : undefined;
    await setList(CITIES);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Cities ${ids.show.slice(0, 8)}`, slug: `cities-${ids.show.slice(0, 8)}` });
    const reveal = (fields) => models.PulseReveal.create({ show_id: ids.show, source: 'set', item_type: 'image', moment: 'story_time', story_order: 27, mode: 'teaser', ...fields });
    await reveal({ image_kind: 'city', item_id: 'dazzle_district', teaser_url: 'https://cdn/teasers/dazzle.jpg' });
    await reveal({ image_kind: 'city_bubble', item_id: 'dazzle_district', teaser_style: 'blur', teaser_url: 'https://cdn/teasers/dazzle-bubble.jpg' });
    await reveal({ image_kind: 'city', item_id: 'echo_park', mode: 'hidden' });
    await reveal({ image_kind: 'city_bubble', item_id: 'echo_park' });   // a first look with no teaser image yet
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    if (saved === undefined) await run(`DELETE FROM page_content WHERE page_name = 'world_infrastructure' AND constant_key = 'DREAM_CITIES'`);
    else await setList(saved);
  });

  test('before the moment: teasers in place of the images, none when hidden or with no teaser; never a full URL', async () => {
    const res = await get('&at=17');
    expect(res.status).toBe(200);
    const byKey = Object.fromEntries(res.body.cities.map((c) => [c.key, c]));
    expect(byKey.dazzle_district).toMatchObject({
      image_url: 'https://cdn/teasers/dazzle.jpg', teaser_style: 'crop', image_alt: '',
      bubble_image_url: 'https://cdn/teasers/dazzle-bubble.jpg', bubble_teaser_style: 'blur', name: 'Dazzle District',
    });
    expect(byKey.echo_park).toMatchObject({ image_url: null, bubble_image_url: null });
    expect(byKey.ascent_tower).toEqual(CITIES[2]);
    expect(res.body.states).toEqual({
      'city:dazzle_district': 'teaser', 'city_bubble:dazzle_district': 'teaser', 'city:echo_park': 'hidden', 'city_bubble:echo_park': 'teaser',
    });
    const body = JSON.stringify(res.body);
    for (const url of ['dazzle.jpg', 'dazzle-bubble.jpg', 'echo.jpg', 'echo-bubble.jpg']) expect(body).not.toContain(`https://cdn/full/${url}`);
    expect(body).not.toContain('The runway at night');
  });

  test('from the moment, and in Director view (no moment), the full list', async () => {
    const after = await get('&at=27');
    expect(after.body.cities).toEqual(CITIES);
    expect(after.body.states).toEqual({});
    const director = await get('');
    expect(director.body).toMatchObject({ at: null, cities: CITIES, states: {} });
  });

  test('checks the show and the moment; no saved list sends none', async () => {
    expect((await request(app).get(`/api/v1/pulse-reveals/cities?show_id=${ids.show}`)).status).toBe(401);
    expect((await get('&at=soon')).status).toBe(400);
    expect((await request(app).get('/api/v1/pulse-reveals/cities?show_id=nope').set('Authorization', `Bearer ${token}`)).status).toBe(400);
    await run(`DELETE FROM page_content WHERE page_name = 'world_infrastructure' AND constant_key = 'DREAM_CITIES'`);
    try {
      expect((await get('&at=17')).body).toMatchObject({ cities: null });
    } finally {
      await setList(CITIES);
    }
  });
});

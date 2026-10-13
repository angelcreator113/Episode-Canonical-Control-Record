/**
 * Teasers follow their image (Task #3052; phase 11 read §2 item 6): when an
 * item's image changes, its teaser is cut again from the new one, against
 * the test database with uploads as data URLs:
 * - a draft post's new photo, the show's new cover, a Dream City's new
 *   image each re-cut their teaser reveals; an unchanged city keeps its own;
 * - a reveal saved before its post had a photo gets a teaser when it arrives;
 * - a new image that cannot be read clears the teaser (no image shows, never
 *   the full one) and the save still succeeds.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const sharp = require('sharp');
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
const RED = { r: 220, g: 20, b: 20 };
const BLUE = { r: 20, g: 20, b: 220 };
const GREEN = { r: 20, g: 200, b: 20 };
const png = (background, width = 600, height = 400) => sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();
const dataUrl = async (colour) => `data:image/png;base64,${(await png(colour)).toString('base64')}`;
/** The main colour of a teaser data URL: 'red', 'green' or 'blue'. */
const colourOf = async (url) => {
  const [r, g, b] = (await sharp(Buffer.from(url.split(',')[1], 'base64')).stats()).channels.slice(0, 3).map((c) => c.mean);
  return r > g && r > b ? 'red' : g > b ? 'green' : 'blue';
};

(shouldSkip ? describe.skip : describe)('The Pulse teasers follow their image (Task #3052)', () => {
  const ids = { show: uuid(), post: uuid(), bare: uuid() };
  const savedBuckets = {};
  let admin;
  let savedCities;
  const as = (req) => req.set('Authorization', `Bearer ${admin}`);
  const reveal = (body) => as(request(app).put('/api/v1/pulse-reveals')).send({ show_id: ids.show, moment: 'story_time', at: 'ep:9:after_episode', item_type: 'image', ...body });
  const teaserOf = async (where) => (await models.PulseReveal.findOne({ where: { show_id: ids.show, ...where } })).teaser_url;
  const putCities = (data) => as(request(app).put('/api/v1/page-content/world_infrastructure/DREAM_CITIES')).send({ data });

  beforeAll(async () => {
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET']) { savedBuckets[k] = process.env[k]; delete process.env[k]; }
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-recut', email: 'evoni@recut.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Recut ${ids.show.slice(0, 8)}`, slug: `recut-${ids.show.slice(0, 8)}` });
    for (const [id, img] of [[ids.post, await dataUrl(RED)], [ids.bare, null]]) {
      await run(`INSERT INTO feed_posts (id, show_id, poster_handle, content_text, image_url, status, story_order, created_at, updated_at)
                 VALUES (:id, :show, 'mayaxo', 'the dress', :img, 'draft', 1, NOW(), NOW())`, { id, show: ids.show, img });
    }
    const [[row]] = await run(`SELECT data FROM page_content WHERE page_name = 'world_infrastructure' AND constant_key = 'DREAM_CITIES'`);
    savedCities = row ? row.data : undefined;
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(savedBuckets)) if (v !== undefined) process.env[k] = v;
    await run('DELETE FROM pulse_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    if (savedCities === undefined) await run(`DELETE FROM page_content WHERE page_name = 'world_infrastructure' AND constant_key = 'DREAM_CITIES'`);
    else await putCities(savedCities);
  });

  test("a draft post's new photo re-cuts its teaser; an unreadable one clears it and still saves", async () => {
    expect((await reveal({ image_kind: 'post_photo', item_id: ids.post })).status).toBe(201);
    expect(await colourOf(await teaserOf({ item_id: ids.post }))).toBe('red');
    const swapped = await as(request(app).put(`/api/v1/feed-posts/${ids.post}`)).send({ image_url: await dataUrl(BLUE) });
    expect(swapped.status).toBe(200);
    expect(await colourOf(await teaserOf({ item_id: ids.post }))).toBe('blue');
    // Editing the words alone leaves the teaser as it is.
    const before = await teaserOf({ item_id: ids.post });
    await as(request(app).put(`/api/v1/feed-posts/${ids.post}`)).send({ content_text: 'the dress, again' });
    expect(await teaserOf({ item_id: ids.post })).toBe(before);

    jest.spyOn(console, 'error').mockImplementation(() => {});
    const broken = await as(request(app).put(`/api/v1/feed-posts/${ids.post}`)).send({ image_url: 'data:image/jpeg;base64,bm90IGFuIGltYWdl' });
    expect(broken.status).toBe(200);
    expect(await teaserOf({ item_id: ids.post })).toBeNull();
  });

  test('a reveal saved before its post had a photo gets a teaser when the photo arrives', async () => {
    expect((await reveal({ image_kind: 'post_photo', item_id: ids.bare })).status).toBe(201);
    expect(await teaserOf({ item_id: ids.bare })).toBeNull();
    await as(request(app).put(`/api/v1/feed-posts/${ids.bare}`)).send({ image_url: await dataUrl(GREEN) });
    expect(await colourOf(await teaserOf({ item_id: ids.bare }))).toBe('green');
  });

  test("the show's new cover re-cuts the cover teaser", async () => {
    const upload = async (colour) => as(request(app).post(`/api/v1/shows/${ids.show}/pulse-cover`))
      .attach('image', await png(colour, 1200, 400), { filename: 'cover.png', contentType: 'image/png' });
    expect((await upload(RED)).status).toBe(200);
    expect((await reveal({ image_kind: 'cover', item_id: ids.show, teaser_style: 'blur' })).status).toBe(201);
    expect(await colourOf(await teaserOf({ image_kind: 'cover' }))).toBe('red');
    expect((await upload(GREEN)).status).toBe(200);
    expect(await colourOf(await teaserOf({ image_kind: 'cover' }))).toBe('green');
  });

  test("a Dream City's new image re-cuts its teaser; an unchanged city keeps its own", async () => {
    const red = await dataUrl(RED);
    const cities = [{ key: 'dazzle_district', name: 'Dazzle District', image_url: red }, { key: 'echo_park', name: 'Echo Park', image_url: red }];
    expect((await putCities(cities)).status).toBe(200);
    await reveal({ image_kind: 'city', item_id: 'dazzle_district' });
    await reveal({ image_kind: 'city', item_id: 'echo_park' });
    const echoBefore = await teaserOf({ image_kind: 'city', item_id: 'echo_park' });
    expect(await colourOf(await teaserOf({ image_kind: 'city', item_id: 'dazzle_district' }))).toBe('red');
    expect((await putCities([{ ...cities[0], image_url: await dataUrl(BLUE) }, cities[1]])).status).toBe(200);
    expect(await colourOf(await teaserOf({ image_kind: 'city', item_id: 'dazzle_district' }))).toBe('blue');
    expect(await teaserOf({ image_kind: 'city', item_id: 'echo_park' })).toBe(echoBefore);
  });

  test('changedCityKeys: an image or bubble that differs, a city added or removed', () => {
    const { changedCityKeys } = require('../../src/services/pulseTeasers');
    const a = [{ key: 'x', image_url: '1' }, { key: 'y', image_url: '2', bubble_image_url: 'b' }, { key: 'z', image_url: '3' }];
    const b = [{ key: 'x', image_url: '1', name: 'renamed' }, { key: 'y', image_url: '2', bubble_image_url: 'c' }, { key: 'w', image_url: '4' }];
    expect(changedCityKeys(a, b).sort()).toEqual(['w', 'y', 'z']);
    expect(changedCityKeys(null, [{ key: 'x', image_url: '1' }])).toEqual(['x']);
    expect(changedCityKeys(a, a)).toEqual([]);
  });
});

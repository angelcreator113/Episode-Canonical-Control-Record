/**
 * The Pulse's cover (Admin › The Pulse › Uploads; Task #2919):
 * GET, POST, PATCH and DELETE /api/v1/shows/:id/pulse-cover.
 * - every route needs a signed-in caller;
 * - the upload is stored as a JPEG at most 2400px on its long side, on
 *   Show.metadata.pulse_cover with its alt text, and every other metadata
 *   key is kept;
 * - PATCH sets the alt text; DELETE clears the cover;
 * - SVG, unreadable files, tiny images and over-long alt text are refused.
 * No bucket is set, so uploads are stored as data URLs: nothing leaves the test.
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

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)("The Pulse's cover", () => {
  let token;
  const ids = { show: crypto.randomUUID() };
  const savedBuckets = {};
  let bigPng;

  beforeAll(async () => {
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET']) { savedBuckets[k] = process.env[k]; delete process.env[k]; }
    token = TokenService.generateTokenPair({
      id: 'test-user-pulse-cover', email: 'evoni@pulse.dev', name: 'Pulse Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    bigPng = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: { r: 184, g: 150, b: 46 } } }).png().toBuffer();
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST(:meta AS json), NOW(), NOW())`,
    { show: ids.show, name: `Pulse ${ids.show.slice(0, 8)}`, slug: `pulse-${ids.show.slice(0, 8)}`, meta: JSON.stringify({ era: 'Season 1', lala_home: { city: 'Los Angeles' }, logo: { url: 'data:image/png;base64,AA==' } }) });
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(savedBuckets)) if (v !== undefined) process.env[k] = v;
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  const url = `/api/v1/shows/${ids.show}/pulse-cover`;
  const metadata = async () => {
    const [[row]] = await run('SELECT metadata FROM shows WHERE id = :show', ids);
    return typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
  };
  const keepsOthers = (meta) => {
    expect(meta.era).toBe('Season 1');
    expect(meta.lala_home).toEqual({ city: 'Los Angeles' });
    expect(meta.logo).toEqual({ url: 'data:image/png;base64,AA==' });
  };

  it('needs a signed-in caller', async () => {
    for (const res of await Promise.all([
      request(app).get(url),
      request(app).post(url).attach('image', bigPng, { filename: 'cover.png', contentType: 'image/png' }),
      request(app).patch(url).send({ alt: 'x' }),
      request(app).delete(url),
    ])) expect(res.status).toBe(401);
  });

  it('starts empty, stores a resized JPEG with its alt text, edits the alt, keeps other metadata, and removes it', async () => {
    let res = await auth(request(app).get(url));
    expect(res.status).toBe(200);
    expect(res.body.cover).toBeNull();

    res = await auth(request(app).patch(url)).send({ alt: 'Too early' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NO_COVER');

    res = await auth(request(app).post(url)).field('alt', '  Dazzle District at dusk  ').attach('image', bigPng, { filename: 'cover.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.cover).toMatchObject({ width: 2400, height: 800, alt: 'Dazzle District at dusk' });
    expect(res.body.cover.url).toMatch(/^data:image\/jpeg;base64,/);
    const stored = await sharp(Buffer.from(res.body.cover.url.split(',')[1], 'base64')).metadata();
    expect(stored).toMatchObject({ format: 'jpeg', width: 2400, height: 800 });

    let meta = await metadata();
    keepsOthers(meta);
    expect(meta.pulse_cover.url).toBe(res.body.cover.url);

    res = await auth(request(app).patch(url)).send({ alt: 'The five Dream Cities at night' });
    expect(res.status).toBe(200);
    expect(res.body.cover.alt).toBe('The five Dream Cities at night');
    expect((await auth(request(app).get(url))).body.cover).toMatchObject({ alt: 'The five Dream Cities at night', width: 2400 });
    keepsOthers(await metadata());

    res = await auth(request(app).delete(url));
    expect(res.status).toBe(200);
    expect(res.body.cover).toBeNull();
    meta = await metadata();
    expect(meta.pulse_cover).toBeUndefined();
    keepsOthers(meta);
  });

  it('refuses SVG, unreadable files, tiny images, over-long alt text and no file', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    let res = await auth(request(app).post(url)).attach('image', svg, { filename: 'cover.svg', contentType: 'image/svg+xml' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WRONG_TYPE');

    res = await auth(request(app).post(url)).attach('image', Buffer.from('not an image'), { filename: 'cover.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNREADABLE');

    const tiny = await sharp({ create: { width: 100, height: 60, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
    res = await auth(request(app).post(url)).attach('image', tiny, { filename: 'cover.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOO_SMALL');

    res = await auth(request(app).post(url)).field('alt', 'x'.repeat(301)).attach('image', bigPng, { filename: 'cover.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_ALT');

    res = await auth(request(app).post(url));
    expect(res.status).toBe(400);
    expect((await metadata()).pulse_cover).toBeUndefined();
  });

  it('a show that does not exist is a 404', async () => {
    const res = await auth(request(app).get(`/api/v1/shows/${crypto.randomUUID()}/pulse-cover`));
    expect(res.status).toBe(404);
  });
});

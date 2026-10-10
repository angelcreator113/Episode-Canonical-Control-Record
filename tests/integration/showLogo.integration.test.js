/**
 * The show's logo (Show Settings): GET, POST and DELETE /api/v1/shows/:id/logo.
 * - every route needs a signed-in caller;
 * - the upload is stored as a PNG at most 1024px on its long side, on
 *   Show.metadata.logo, and every other metadata key is kept;
 * - SVG and other types, unreadable files and tiny images are refused;
 * - the episode style sheet prints the logo, and changing it marks an
 *   approved sheet out of date.
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

(shouldSkip ? describe.skip : describe)("The show's logo", () => {
  let token;
  const ids = { show: crypto.randomUUID(), ep: crypto.randomUUID() };
  const savedBuckets = {};
  let bigPng;

  beforeAll(async () => {
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET']) { savedBuckets[k] = process.env[k]; delete process.env[k]; }
    token = TokenService.generateTokenPair({
      id: 'test-user-logo', email: 'evoni@logo.dev', name: 'Logo Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    bigPng = await sharp({ create: { width: 2000, height: 500, channels: 4, background: { r: 184, g: 150, b: 46, alpha: 0.5 } } }).png().toBuffer();
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST(:meta AS json), NOW(), NOW())`,
    { show: ids.show, name: `Logo ${ids.show.slice(0, 8)}`, slug: `logo-${ids.show.slice(0, 8)}`, meta: JSON.stringify({ era: 'Season 1', lala_home: { city: 'Los Angeles' } }) });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Logo Episode', 1, 'draft', NOW(), NOW())`, ids);
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(savedBuckets)) if (v !== undefined) process.env[k] = v;
    await run('DELETE FROM episode_lookbook_images WHERE episode_id = :ep', ids);
    await run('DELETE FROM episode_lookbooks WHERE episode_id = :ep', ids);
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  const url = `/api/v1/shows/${ids.show}/logo`;
  const metadata = async () => {
    const [[row]] = await run('SELECT metadata FROM shows WHERE id = :show', ids);
    return typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
  };

  it('needs a signed-in caller', async () => {
    for (const res of await Promise.all([
      request(app).get(url),
      request(app).post(url).attach('image', bigPng, { filename: 'logo.png', contentType: 'image/png' }),
      request(app).delete(url),
    ])) expect(res.status).toBe(401);
  });

  it('starts empty, stores a resized PNG, keeps other metadata, and removes it', async () => {
    let res = await auth(request(app).get(url));
    expect(res.status).toBe(200);
    expect(res.body.logo).toBeNull();

    res = await auth(request(app).post(url)).attach('image', bigPng, { filename: 'logo.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.logo).toMatchObject({ width: 1024, height: 256 });
    expect(res.body.logo.url).toMatch(/^data:image\/png;base64,/);
    const stored = await sharp(Buffer.from(res.body.logo.url.split(',')[1], 'base64')).metadata();
    expect(stored).toMatchObject({ format: 'png', width: 1024, height: 256, hasAlpha: true });

    let meta = await metadata();
    expect(meta.era).toBe('Season 1');
    expect(meta.lala_home).toEqual({ city: 'Los Angeles' });
    expect(meta.logo.url).toBe(res.body.logo.url);
    expect((await auth(request(app).get(url))).body.logo.url).toBe(res.body.logo.url);

    res = await auth(request(app).delete(url));
    expect(res.status).toBe(200);
    expect(res.body.logo).toBeNull();
    meta = await metadata();
    expect(meta.logo).toBeUndefined();
    expect(meta.era).toBe('Season 1');
    expect(meta.lala_home).toEqual({ city: 'Los Angeles' });
  });

  it('refuses SVG, unreadable files, tiny images and no file', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    let res = await auth(request(app).post(url)).attach('image', svg, { filename: 'logo.svg', contentType: 'image/svg+xml' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WRONG_TYPE');

    res = await auth(request(app).post(url)).attach('image', Buffer.from('not an image'), { filename: 'logo.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNREADABLE');

    const tiny = await sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
    res = await auth(request(app).post(url)).attach('image', tiny, { filename: 'logo.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOO_SMALL');

    res = await auth(request(app).post(url));
    expect(res.status).toBe(400);
    expect((await metadata()).logo).toBeUndefined();
  });

  it('a show that does not exist is a 404', async () => {
    const res = await auth(request(app).get(`/api/v1/shows/${crypto.randomUUID()}/logo`));
    expect(res.status).toBe(404);
  });

  it('the style sheet prints the logo, and a new logo marks an approved sheet out of date', async () => {
    const sheetUrl = `/api/v1/episodes/${ids.ep}/style-sheet`;
    let sheet = (await auth(request(app).get(sheetUrl))).body.data;
    expect(sheet.logo).toBeNull();

    await auth(request(app).post(url)).attach('image', bigPng, { filename: 'logo.png', contentType: 'image/png' });
    sheet = (await auth(request(app).get(sheetUrl))).body.data;
    expect(sheet.logo).toMatch(/^data:image\/png;base64,/);

    expect((await auth(request(app).post(`${sheetUrl}/approve`))).status).toBe(200);
    sheet = (await auth(request(app).get(sheetUrl))).body.data;
    expect(sheet.status).toBe('approved');
    expect(sheet.stale).toBe(false);

    await auth(request(app).delete(url));
    sheet = (await auth(request(app).get(sheetUrl))).body.data;
    expect(sheet.logo).toBeNull();
    expect(sheet.stale).toBe(true);
  });
});

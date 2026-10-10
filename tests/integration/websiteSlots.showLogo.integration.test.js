/**
 * The site's logo from a show's logo (Show Settings):
 * POST /api/v1/website-slots/logo/from-show { show_id }.
 * - admins only, and refused until SITE_PUBLIC_BUCKET is set;
 * - copies the show's PNG into the public site location as the logo slot's
 *   image, as a draft (publishing stays a separate step);
 * - a show with no logo, or one whose stored address is not the studio
 *   bucket, is refused without fetching anything.
 * S3 is mocked and the studio bucket read is stubbed: nothing leaves the test.
 */
jest.unmock('uuid');

const mockSend = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send(cmd) { return mockSend(cmd); } },
  PutObjectCommand: class { constructor(input) { this.input = input; } },
}));

const request = require('supertest');
const crypto = require('crypto');
const sharp = require('sharp');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const URL_ = '/api/v1/website-slots/logo/from-show';

(shouldSkip ? describe.skip : describe)("Website logo from a show's logo", () => {
  let adminToken;
  let userToken;
  let png;
  const show = crypto.randomUUID();
  const ENV_KEYS = ['SITE_PUBLIC_BUCKET', 'SITE_PUBLIC_PREFIX', 'SITE_PUBLIC_CDN', 'S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET', 'AWS_REGION'];
  const savedEnv = {};

  const setLogo = (logo) => run('UPDATE shows SET metadata = CAST(:meta AS json) WHERE id = :show',
    { show, meta: JSON.stringify({ era: 'Season 1', ...(logo ? { logo } : {}) }) });

  beforeAll(async () => {
    for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
    adminToken = TokenService.generateTokenPair({ id: 'test-admin-logo', email: 'evoni@logo.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    userToken = TokenService.generateTokenPair({ id: 'test-user-logo2', email: 'user@logo.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    png = await sharp({ create: { width: 200, height: 80, channels: 4, background: { r: 184, g: 150, b: 46, alpha: 0.6 } } }).png().toBuffer();
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Logo site ${show.slice(0, 8)}`, slug: `logo-site-${show.slice(0, 8)}` });
  });

  beforeEach(async () => {
    await run('DELETE FROM website_slots');
    mockSend.mockClear();
    process.env.SITE_PUBLIC_BUCKET = 'site-test-bucket';
    process.env.SITE_PUBLIC_PREFIX = 'site-public';
    process.env.SITE_PUBLIC_CDN = 'cdn.example.test';
    process.env.S3_PRIMARY_BUCKET = 'studio-test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    await setLogo(null);
  });

  afterAll(async () => {
    for (const k of ENV_KEYS) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
    await run('DELETE FROM website_slots');
    await run('DELETE FROM shows WHERE id = :show', { show });
  });

  const asAdmin = (req) => req.set('Authorization', `Bearer ${adminToken}`);

  it('admins only', async () => {
    expect((await request(app).post(URL_).send({ show_id: show })).status).toBe(401);
    expect((await request(app).post(URL_).set('Authorization', `Bearer ${userToken}`).send({ show_id: show })).status).toBe(403);
  });

  it('is refused until the public site storage is set up', async () => {
    delete process.env.SITE_PUBLIC_BUCKET;
    await setLogo({ url: `data:image/png;base64,${png.toString('base64')}` });
    const res = await asAdmin(request(app).post(URL_)).send({ show_id: show });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SITE_STORAGE_NOT_CONFIGURED');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('a show with no logo, and no show, are refused', async () => {
    let res = await asAdmin(request(app).post(URL_)).send({ show_id: show });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NO_SHOW_LOGO');
    res = await asAdmin(request(app).post(URL_)).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NO_SHOW');
    res = await asAdmin(request(app).post(URL_)).send({ show_id: crypto.randomUUID() });
    expect(res.status).toBe(404);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('copies a stored logo into the public location as a draft image', async () => {
    await setLogo({ url: `data:image/png;base64,${png.toString('base64')}`, width: 200, height: 80 });
    const res = await asAdmin(request(app).post(URL_)).send({ show_id: show });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ slot_key: 'logo', media_type: 'image', status: 'draft' });
    expect(res.body.data.url).toMatch(/^https:\/\/cdn\.example\.test\/site-public\/logo\/[0-9a-f-]+\.png$/);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const put = mockSend.mock.calls[0][0].input;
    expect(put).toMatchObject({ Bucket: 'site-test-bucket', ContentType: 'image/png' });
    expect(Buffer.compare(put.Body, png)).toBe(0);
    // Not on the public site until published.
    const pub = await request(app).get('/api/v1/public/site-content');
    expect(pub.body.slots.logo).toBeUndefined();
  });

  it('reads a logo from the studio bucket, and refuses any other address without fetching it', async () => {
    const get = jest.spyOn(axios, 'get').mockResolvedValue({ data: png });
    try {
      await setLogo({ url: 'https://studio-test-bucket.s3.us-east-1.amazonaws.com/shows/logos/x/a.png' });
      let res = await asAdmin(request(app).post(URL_)).send({ show_id: show });
      expect(res.status).toBe(200);
      expect(get).toHaveBeenCalledWith('https://studio-test-bucket.s3.us-east-1.amazonaws.com/shows/logos/x/a.png', expect.objectContaining({ maxRedirects: 0 }));

      get.mockClear();
      for (const url of ['http://169.254.169.254/latest/meta-data/', 'https://example.com/logo.png', 'http://studio-test-bucket.s3.us-east-1.amazonaws.com/a.png', 'file:///etc/passwd']) {
        await setLogo({ url });
        res = await asAdmin(request(app).post(URL_)).send({ show_id: show });
        expect({ url, status: res.status, code: res.body.code }).toEqual({ url, status: 400, code: 'LOGO_UNREADABLE' });
      }
      expect(get).not.toHaveBeenCalled();
    } finally {
      get.mockRestore();
    }
  });
});

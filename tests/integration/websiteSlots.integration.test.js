/**
 * Website slots and the public content endpoint (Task #2821; contract in
 * docs/reads/2026-10-10-website-content-read.md §3–§4):
 * - unauthenticated GET /api/v1/public/site-content returns published slots
 *   only, with whitelisted fields only; drafts never appear;
 * - every admin route rejects unauthenticated and non-admin callers;
 * - uploads are refused until SITE_PUBLIC_BUCKET is set;
 * - YouTube links must be youtube.com or youtu.be and are stored as the id;
 * - clips over 30 seconds or over the size cap are refused;
 * - publishing needs media, alt text, a poster for a clip, and captions for
 *   a clip with speech.
 * S3 is mocked: nothing leaves the test. The app's write limiter (60 per
 * minute per IP) is per test file, so the media rules (YouTube, clips,
 * image limits) live in websiteSlots.media.integration.test.js.
 */
jest.unmock('uuid');

const mockSend = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send(cmd) { return mockSend(cmd); } },
  PutObjectCommand: class { constructor(input) { this.input = input; } },
}));

const request = require('supertest');
const sharp = require('sharp');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const slotService = require('../../src/services/websiteSlotService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const PUBLIC = '/api/v1/public/site-content';
const ADMIN = '/api/v1/website-slots';

(shouldSkip ? describe.skip : describe)('Website slots and the public content endpoint', () => {
  let adminToken;
  let userToken;
  let png;
  const savedEnv = {};
  const ENV_KEYS = ['SITE_PUBLIC_BUCKET', 'SITE_PUBLIC_PREFIX', 'SITE_PUBLIC_CDN'];

  beforeAll(async () => {
    for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
    adminToken = TokenService.generateTokenPair({ id: 'test-admin-site', email: 'evoni@site.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    userToken = TokenService.generateTokenPair({ id: 'test-user-site', email: 'user@site.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    png = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 200, g: 100, b: 150 } } }).png().toBuffer();
  });

  beforeEach(async () => {
    await sequelize.query('DELETE FROM website_slots');
    mockSend.mockClear();
    process.env.SITE_PUBLIC_BUCKET = 'site-test-bucket';
    process.env.SITE_PUBLIC_PREFIX = 'site-public';
    process.env.SITE_PUBLIC_CDN = 'cdn.example.test';
  });

  afterAll(async () => {
    for (const k of ENV_KEYS) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
    await sequelize.query('DELETE FROM website_slots');
  });

  const asAdmin = (req) => req.set('Authorization', `Bearer ${adminToken}`);
  const uploadImage = (slot, buf = png, type = 'image/png') => asAdmin(request(app).post(`${ADMIN}/${slot}/media`)).attach('file', buf, { filename: 'x.png', contentType: type });
  const publish = (slot) => asAdmin(request(app).post(`${ADMIN}/${slot}/publish`));

  it('the public endpoint needs no sign-in and, with nothing published, returns no slots', async () => {
    const res = await request(app).get(PUBLIC);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ slots: {}, updated_at: null });
    expect(res.headers['cache-control']).toBe('public, max-age=300, stale-while-revalidate=3600');
    expect(res.headers.etag).toBeTruthy();
    const again = await request(app).get(PUBLIC).set('If-None-Match', res.headers.etag);
    expect(again.status).toBe(304);
  });

  it('every admin route rejects a caller with no token, and a non-admin', async () => {
    const calls = [
      (r) => r.get(ADMIN), (r) => r.post(`${ADMIN}/hero/media`), (r) => r.put(`${ADMIN}/featured_video/youtube`).send({ url: 'https://youtu.be/dQw4w9WgXcQ' }),
      (r) => r.patch(`${ADMIN}/hero`).send({ alt_text: 'x' }), (r) => r.post(`${ADMIN}/hero/poster`), (r) => r.post(`${ADMIN}/hero/captions`),
      (r) => r.post(`${ADMIN}/hero/publish`), (r) => r.post(`${ADMIN}/hero/unpublish`),
    ];
    for (const call of calls) {
      expect((await call(request(app))).status).toBe(401);
      expect((await call(request(app)).set('Authorization', `Bearer ${userToken}`)).status).toBe(403);
    }
    // The public path takes no writes at all.
    for (const verb of ['post', 'put', 'patch', 'delete']) expect((await request(app)[verb](PUBLIC)).status).toBe(404);
  });

  it('uploads are refused until SITE_PUBLIC_BUCKET is set; nothing is stored', async () => {
    delete process.env.SITE_PUBLIC_BUCKET;
    const res = await uploadImage('hero');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SITE_STORAGE_NOT_CONFIGURED');
    expect(mockSend).not.toHaveBeenCalled();
    // A YouTube link needs no storage.
    expect((await asAdmin(request(app).put(`${ADMIN}/featured_video/youtube`)).send({ url: 'https://youtu.be/dQw4w9WgXcQ' })).status).toBe(200);
    const list = await asAdmin(request(app).get(ADMIN));
    expect(list.body.data.storage_ready).toBe(false);
  });

  it('only published slots appear publicly, with whitelisted fields only; drafts never', async () => {
    expect((await uploadImage('hero')).status).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].input).toMatchObject({ Bucket: 'site-test-bucket', ContentType: 'image/png', CacheControl: 'public, max-age=31536000, immutable' });
    expect(mockSend.mock.calls[0][0].input.Key).toMatch(/^site-public\/hero\/[0-9a-f-]{36}\.png$/);
    await asAdmin(request(app).patch(`${ADMIN}/hero`)).send({ alt_text: 'Lala on the LalaVerse map' });
    await uploadImage('logo');
    await asAdmin(request(app).patch(`${ADMIN}/logo`)).send({ alt_text: 'Prime Studios' });

    // Drafts: nothing public yet.
    expect((await request(app).get(PUBLIC)).body.slots).toEqual({});

    expect((await publish('hero')).status).toBe(200);
    const res = await request(app).get(PUBLIC);
    expect(Object.keys(res.body.slots)).toEqual(['hero']);
    expect(res.body.slots.hero).toEqual({
      media_type: 'image',
      alt_text: 'Lala on the LalaVerse map',
      url: expect.stringMatching(/^https:\/\/cdn\.example\.test\/site-public\/hero\/[0-9a-f-]{36}\.png$/),
    });
    expect(Object.keys(res.body)).toEqual(['slots', 'updated_at']);
    expect(JSON.stringify(res.body)).not.toMatch(/"id"|file_key|status|slot_key|created_at|deleted_at|file_size/);

    // Unpublish takes it off the public page; replacing media sends it back to draft.
    await asAdmin(request(app).post(`${ADMIN}/hero/unpublish`));
    expect((await request(app).get(PUBLIC)).body.slots).toEqual({});
    await publish('hero');
    await uploadImage('hero');
    expect((await request(app).get(PUBLIC)).body.slots).toEqual({});
  });

  it('publishing needs media and alt text', async () => {
    expect((await publish('flagship_lala')).body.code).toBe('NO_MEDIA');
    await uploadImage('flagship_lala');
    const noAlt = await publish('flagship_lala');
    expect([noAlt.status, noAlt.body.code]).toEqual([409, 'ALT_TEXT_REQUIRED']);
  });

  it('the admin list shows all eleven slots, drafts included', async () => {
    const up = await uploadImage('pillar_places');
    expect([up.status, up.body.code]).toEqual([200, undefined]);
    const res = await asAdmin(request(app).get(ADMIN));
    expect(res.body.data.storage_ready).toBe(true);
    expect(res.body.data.slots.map((s) => s.slot_key)).toEqual(slotService.SLOT_KEYS);
    expect(res.body.data.slots.find((s) => s.slot_key === 'pillar_places')).toMatchObject({ media_type: 'image', status: 'draft' });
  });
});

/**
 * Website slots: media rules (Task #2821; contract in
 * docs/reads/2026-10-10-website-content-read.md §3–§4):
 * - unauthenticated GET /api/v1/public/site-content returns published slots
 *   only, with whitelisted fields only; drafts never appear;
 * - every admin route rejects unauthenticated and non-admin callers;
 * - uploads are refused until SITE_PUBLIC_BUCKET is set;
 * - YouTube links must be youtube.com or youtu.be and are stored as the id;
 * - clips over 30 seconds or over the size cap are refused;
 * - publishing needs media, alt text, a poster for a clip, and captions for
 *   a clip with speech.
 * S3 is mocked: nothing leaves the test.
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

(shouldSkip ? describe.skip : describe)('Website slots: YouTube, clips and image limits', () => {
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

  it('YouTube: youtube.com or youtu.be only, stored as the id; only the video slot takes it', async () => {
    for (const url of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10']) {
      const res = await asAdmin(request(app).put(`${ADMIN}/featured_video/youtube`)).send({ url });
      expect([url, res.status, res.body.data?.youtube_id]).toEqual([url, 200, 'dQw4w9WgXcQ']);
    }
    for (const url of ['https://vimeo.com/123', 'https://evil.example/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'https://youtu.be/short', 'not a url']) {
      const res = await asAdmin(request(app).put(`${ADMIN}/featured_video/youtube`)).send({ url });
      expect([url, res.status, res.body.code]).toEqual([url, 400, 'INVALID_YOUTUBE_URL']);
    }
    expect((await asAdmin(request(app).put(`${ADMIN}/hero/youtube`)).send({ url: 'https://youtu.be/dQw4w9WgXcQ' })).body.code).toBe('MEDIA_NOT_ALLOWED');

    await asAdmin(request(app).put(`${ADMIN}/featured_video/youtube`)).send({ url: 'https://youtu.be/dQw4w9WgXcQ' });
    await asAdmin(request(app).patch(`${ADMIN}/featured_video`)).send({ alt_text: 'A first look at Styling Adventures' });
    expect((await publish('featured_video')).status).toBe(200);
    expect((await request(app).get(PUBLIC)).body.slots.featured_video).toEqual({
      media_type: 'youtube', alt_text: 'A first look at Styling Adventures', youtube_id: 'dQw4w9WgXcQ', poster_url: null, captions_url: null, duration_seconds: null,
    });
  });

  it('clips: 30 seconds and 25 MB at most; a poster, and captions when there is speech', async () => {
    const clip = Buffer.from('not really an mp4, ffprobe is stood in for');
    const spy = jest.spyOn(slotService, 'clipSeconds');
    const uploadClip = (slot) => asAdmin(request(app).post(`${ADMIN}/${slot}/media`)).attach('file', clip, { filename: 'c.mp4', contentType: 'video/mp4' });
    try {
      spy.mockResolvedValueOnce(31.2);
      const long = await uploadClip('featured_video');
      expect([long.status, long.body.code]).toEqual([400, 'CLIP_TOO_LONG']);
      spy.mockResolvedValueOnce(null);
      expect((await uploadClip('featured_video')).body.code).toBe('CLIP_UNREADABLE');
      expect((await uploadClip('hero')).body.code).toBe('MEDIA_NOT_ALLOWED');
      const big = Buffer.alloc(26 * 1024 * 1024, 1);
      const tooBig = await asAdmin(request(app).post(`${ADMIN}/featured_video/media`)).attach('file', big, { filename: 'b.mp4', contentType: 'video/mp4' });
      expect(tooBig.status).toBe(400);

      spy.mockResolvedValueOnce(28.4);
      const ok = await uploadClip('featured_video');
      expect([ok.status, ok.body.data.media_type, ok.body.data.duration_seconds]).toEqual([200, 'video_clip', 28.4]);
      await asAdmin(request(app).patch(`${ADMIN}/featured_video`)).send({ alt_text: 'Lala arrives at the studio', has_speech: true });
      expect((await publish('featured_video')).body.code).toBe('POSTER_REQUIRED');
      await asAdmin(request(app).post(`${ADMIN}/featured_video/poster`)).attach('file', png, { filename: 'p.png', contentType: 'image/png' });
      expect((await publish('featured_video')).body.code).toBe('CAPTIONS_REQUIRED');
      const badVtt = await asAdmin(request(app).post(`${ADMIN}/featured_video/captions`)).attach('file', Buffer.from('1\n00:00 --> 00:01\nhi'), { filename: 'c.vtt', contentType: 'text/vtt' });
      expect(badVtt.body.code).toBe('INVALID_TYPE');
      await asAdmin(request(app).post(`${ADMIN}/featured_video/captions`)).attach('file', Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\nHello\n'), { filename: 'c.vtt', contentType: 'text/vtt' });
      expect((await publish('featured_video')).status).toBe(200);
      const pub = (await request(app).get(PUBLIC)).body.slots.featured_video;
      expect(pub).toMatchObject({ media_type: 'video_clip', alt_text: 'Lala arrives at the studio', duration_seconds: 28.4 });
      expect(pub.url).toMatch(/^https:\/\/cdn\.example\.test\/site-public\/featured_video\/.+\.mp4$/);
      expect(pub.poster_url).toMatch(/poster-.+\.png$/);
      expect(pub.captions_url).toMatch(/captions-.+\.vtt$/);
    } finally {
      spy.mockRestore();
    }
  });

  it('an image larger than 5 MB, or of another type, is refused', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 1);
    expect((await uploadImage('hero', big)).body.code).toBe('TOO_LARGE');
    expect((await uploadImage('hero', Buffer.from('GIF89a'), 'image/gif')).body.code).toBe('INVALID_TYPE');
    expect((await asAdmin(request(app).post(`${ADMIN}/not_a_slot/media`)).attach('file', png, { filename: 'x.png', contentType: 'image/png' })).status).toBe(404);
  });
});

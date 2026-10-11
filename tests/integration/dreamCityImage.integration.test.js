/**
 * A Dream City's image or story-bubble image (Admin › The Pulse › Uploads;
 * Task #2920): POST /api/v1/world/dream-cities/:key/image?kind=image|bubble.
 * - needs a signed-in caller;
 * - stores a JPEG (the city image at most 2400px, the bubble at most 800px)
 *   and returns { url, width, height }; it saves nothing itself;
 * - refuses an unknown kind, a malformed city key, SVG and tiny images.
 * No bucket is set, so uploads are stored as data URLs: nothing leaves the test.
 */
jest.unmock('uuid');

const request = require('supertest');
const sharp = require('sharp');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)("A Dream City's images", () => {
  let token;
  let png;
  const savedBuckets = {};
  const url = (kind) => `/api/v1/world/dream-cities/dazzle_district/image${kind ? `?kind=${kind}` : ''}`;

  beforeAll(async () => {
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET']) { savedBuckets[k] = process.env[k]; delete process.env[k]; }
    token = TokenService.generateTokenPair({
      id: 'test-user-cities', email: 'evoni@cities.dev', name: 'Cities Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    png = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: { r: 212, g: 120, b: 154 } } }).png().toBuffer();
  });

  afterAll(() => {
    for (const [k, v] of Object.entries(savedBuckets)) if (v !== undefined) process.env[k] = v;
  });

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);

  it('needs a signed-in caller', async () => {
    const res = await request(app).post(url()).attach('image', png, { filename: 'city.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });

  it('stores the city image at most 2400px and the bubble at most 800px', async () => {
    let res = await auth(request(app).post(url())).attach('image', png, { filename: 'city.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, width: 2400, height: 1200 });
    expect(res.body.url).toMatch(/^data:image\/jpeg;base64,/);

    res = await auth(request(app).post(url('bubble'))).attach('image', png, { filename: 'bubble.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ width: 800, height: 400 });
  });

  it('refuses an unknown kind, a malformed city key, SVG and tiny images', async () => {
    let res = await auth(request(app).post(url('poster'))).attach('image', png, { filename: 'city.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_KIND');

    res = await auth(request(app).post('/api/v1/world/dream-cities/Bad-Key!/image')).attach('image', png, { filename: 'city.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_CITY');

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    res = await auth(request(app).post(url())).attach('image', svg, { filename: 'city.svg', contentType: 'image/svg+xml' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WRONG_TYPE');

    const tiny = await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
    res = await auth(request(app).post(url('bubble'))).attach('image', tiny, { filename: 'b.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOO_SMALL');
  });
});

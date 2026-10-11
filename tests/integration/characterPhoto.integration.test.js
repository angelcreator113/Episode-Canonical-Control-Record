/**
 * A character's profile and cover photo (Admin › The Pulse › Uploads ›
 * Characters; Task #2921):
 * POST and DELETE /api/v1/character-registry/characters/:id/photo?kind=portrait|cover.
 * - needs a signed-in caller;
 * - stores a JPEG (profile at most 1200px, cover at most 2400px) in the
 *   studio's storage and sets portrait_url or cover_url; DELETE clears one
 *   and leaves the other;
 * - the registry list returns both, for the Uploads tab;
 * - refuses an unknown kind, an unknown character and SVG.
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

(shouldSkip ? describe.skip : describe)("A character's photos", () => {
  let token;
  let png;
  const ids = { reg: crypto.randomUUID(), rc: crypto.randomUUID() };
  const savedBuckets = {};
  const url = (kind, id = ids.rc) => `/api/v1/character-registry/characters/${id}/photo${kind ? `?kind=${kind}` : ''}`;
  const row = async () => {
    const [[r]] = await run('SELECT portrait_url, cover_url FROM registry_characters WHERE id = :rc', ids);
    return r;
  };

  beforeAll(async () => {
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET']) { savedBuckets[k] = process.env[k]; delete process.env[k]; }
    token = TokenService.generateTokenPair({
      id: 'test-user-char-photo', email: 'evoni@photo.dev', name: 'Photo Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    png = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 168, g: 137, b: 200 } } }).png().toBuffer();
    await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'Photo registry', NOW(), NOW())`, ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, portrait_url, created_at, updated_at)
               VALUES (:rc, :reg, :key, 'Photo Character', '/uploads/portraits/old.png', NOW(), NOW())`,
    { ...ids, key: `photo-${ids.rc.slice(0, 8)}` });
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(savedBuckets)) if (v !== undefined) process.env[k] = v;
    await run('DELETE FROM registry_characters WHERE id = :rc', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
  });

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);

  it('needs a signed-in caller', async () => {
    expect((await request(app).post(url('cover')).attach('image', png, { filename: 'c.png', contentType: 'image/png' })).status).toBe(401);
    expect((await request(app).delete(url('cover'))).status).toBe(401);
  });

  it('sets the profile and cover photos, lists them, and clears one without the other', async () => {
    let res = await auth(request(app).post(url('portrait'))).attach('image', png, { filename: 'p.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.portrait_url).toMatch(/^data:image\/jpeg;base64,/);
    expect((await sharp(Buffer.from(res.body.portrait_url.split(',')[1], 'base64')).metadata()).width).toBe(1200);

    res = await auth(request(app).post(url('cover'))).attach('image', png, { filename: 'c.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect((await sharp(Buffer.from(res.body.cover_url.split(',')[1], 'base64')).metadata()).width).toBe(2400);

    let r = await row();
    expect(r.portrait_url).toMatch(/^data:image\/jpeg/);
    expect(r.cover_url).toBe(res.body.cover_url);

    const list = await auth(request(app).get('/api/v1/character-registry/registries?limit=100'));
    const listed = list.body.registries.flatMap((g) => g.characters).find((c) => c.id === ids.rc);
    expect(listed.portrait_url).toBe(r.portrait_url);
    expect(listed.cover_url).toBe(r.cover_url);

    res = await auth(request(app).delete(url('cover')));
    expect(res.status).toBe(200);
    r = await row();
    expect(r.cover_url).toBeNull();
    expect(r.portrait_url).toMatch(/^data:image\/jpeg/);
  });

  it('refuses an unknown kind, an unknown character and SVG', async () => {
    let res = await auth(request(app).post(url('banner'))).attach('image', png, { filename: 'c.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_KIND');

    res = await auth(request(app).post(url('cover', crypto.randomUUID()))).attach('image', png, { filename: 'c.png', contentType: 'image/png' });
    expect(res.status).toBe(404);

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    res = await auth(request(app).post(url('cover'))).attach('image', svg, { filename: 'c.svg', contentType: 'image/svg+xml' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WRONG_TYPE');
  });
});

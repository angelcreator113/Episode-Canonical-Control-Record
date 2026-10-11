/**
 * Lala's everyday fits (Admin › The Pulse › Uploads; Task #2922):
 * GET, POST, PATCH and DELETE /api/v1/pulse-fits.
 * - every route needs a signed-in caller;
 * - POST stores the photo (a JPEG at most 2000px) with its caption, alt text
 *   and story date; GET lists a show's fits newest story date first, undated
 *   last; PATCH edits; DELETE soft-deletes (the row stays, with deleted_at);
 * - bad show ids, dates and SVG are refused.
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

(shouldSkip ? describe.skip : describe)("Lala's everyday fits", () => {
  let token;
  let png;
  const ids = { show: crypto.randomUUID(), other: crypto.randomUUID() };
  const savedBuckets = {};

  beforeAll(async () => {
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET']) { savedBuckets[k] = process.env[k]; delete process.env[k]; }
    token = TokenService.generateTokenPair({
      id: 'test-user-fits', email: 'evoni@fits.dev', name: 'Fits Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    png = await sharp({ create: { width: 1600, height: 2400, channels: 3, background: { r: 212, g: 120, b: 154 } } }).png().toBuffer();
    for (const id of [ids.show, ids.other]) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`,
        { id, name: `Fits ${id.slice(0, 8)}`, slug: `fits-${id.slice(0, 8)}` });
    }
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(savedBuckets)) if (v !== undefined) process.env[k] = v;
    await run('DELETE FROM pulse_fits WHERE show_id IN (:show, :other)', ids);
    await run('DELETE FROM shows WHERE id IN (:show, :other)', ids);
  });

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  const post = (fields) => {
    let req = auth(request(app).post('/api/v1/pulse-fits'));
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    return req.attach('image', png, { filename: 'fit.png', contentType: 'image/png' });
  };

  it('needs a signed-in caller', async () => {
    for (const res of await Promise.all([
      request(app).get(`/api/v1/pulse-fits?show_id=${ids.show}`),
      request(app).post('/api/v1/pulse-fits').field('show_id', ids.show).attach('image', png, { filename: 'f.png', contentType: 'image/png' }),
      request(app).patch(`/api/v1/pulse-fits/${crypto.randomUUID()}`).send({ caption: 'x' }),
      request(app).delete(`/api/v1/pulse-fits/${crypto.randomUUID()}`),
    ])) expect(res.status).toBe(401);
  });

  it('creates, lists newest story date first, edits and soft-deletes', async () => {
    let res = await post({ show_id: ids.show, caption: '  Coffee run  ', image_alt: 'Lala in a pink trench', story_date: '2026-03-01' });
    expect(res.status).toBe(201);
    const early = res.body.fit;
    expect(early).toMatchObject({ caption: 'Coffee run', image_alt: 'Lala in a pink trench', story_date: '2026-03-01', width: 1333, height: 2000 });
    expect(early.image_url).toMatch(/^data:image\/jpeg;base64,/);
    expect(Number.isNaN(Date.parse(early.created_at))).toBe(false);
    // Stamped with the story time it was uploaded at: the backstory, no episode published (Task #2937).
    expect(early.story_order).toBe(7);

    const late = (await post({ show_id: ids.show, story_date: '2026-04-15' })).body.fit;
    const undated = (await post({ show_id: ids.show })).body.fit;
    await post({ show_id: ids.other, story_date: '2026-05-01' });

    res = await auth(request(app).get(`/api/v1/pulse-fits?show_id=${ids.show}`));
    expect(res.status).toBe(200);
    expect(res.body.fits.map((f) => f.id)).toEqual([late.id, early.id, undated.id]);

    res = await auth(request(app).patch(`/api/v1/pulse-fits/${undated.id}`)).send({ caption: 'Gallery opening', story_date: '2026-05-02' });
    expect(res.status).toBe(200);
    expect(res.body.fit).toMatchObject({ caption: 'Gallery opening', story_date: '2026-05-02' });
    res = await auth(request(app).get(`/api/v1/pulse-fits?show_id=${ids.show}`));
    expect(res.body.fits[0].id).toBe(undated.id);

    res = await auth(request(app).delete(`/api/v1/pulse-fits/${early.id}`));
    expect(res.status).toBe(200);
    res = await auth(request(app).get(`/api/v1/pulse-fits?show_id=${ids.show}`));
    expect(res.body.fits.map((f) => f.id)).not.toContain(early.id);
    const [[row]] = await run('SELECT deleted_at FROM pulse_fits WHERE id = :id', { id: early.id });
    expect(row.deleted_at).not.toBeNull();
  });

  it('refuses bad show ids, bad dates, unknown shows, unknown fits and SVG', async () => {
    expect((await auth(request(app).get('/api/v1/pulse-fits?show_id=nope'))).status).toBe(400);
    expect((await post({ show_id: 'nope' })).status).toBe(400);
    expect((await post({ show_id: crypto.randomUUID() })).status).toBe(404);

    let res = await post({ show_id: ids.show, story_date: '11/10/2026' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_FIELD');

    res = await auth(request(app).patch(`/api/v1/pulse-fits/${crypto.randomUUID()}`)).send({ caption: 'x' });
    expect(res.status).toBe(404);

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    res = await auth(request(app).post('/api/v1/pulse-fits')).field('show_id', ids.show).attach('image', svg, { filename: 'f.svg', contentType: 'image/svg+xml' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WRONG_TYPE');
  });
});

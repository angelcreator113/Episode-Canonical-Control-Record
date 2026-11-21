/**
 * POST /api/v1/wardrobe/:id/add-shadow on an RGBA image (Task #2334).
 *
 * The route downloads the item's image, runs addDropShadow and stores the
 * result as the processed version. For any image with an alpha channel it
 * used to answer 500 ("Image to composite must have same dimensions or
 * smaller"). The download (axios) and the S3 upload are stubbed; the route,
 * the controller, sharp and the database are real.
 */
jest.unmock('uuid');
jest.mock('axios');

const request = require('supertest');
const crypto = require('crypto');
const sharp = require('sharp');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const wardrobeImageService = require('../../src/services/wardrobeImageService');
const { enforcing, readOnlyTokens, expectWriteRefused } = require('../helpers/writeGuard');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
// The refusal tests need the ADMIN write guard enforcing; with it off they are skipped.
const guardIt = enforcing() ? it : it.skip;

(shouldSkip ? describe.skip : describe)('POST /wardrobe/:id/add-shadow (Task #2334)', () => {
  // Production writes are an ADMIN's (Evoni, 2026-11-15); an editor and a viewer are refused them (the last test here).
  let token;
  const readOnly = readOnlyTokens('add-shadow');
  const ids = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-admin-add-shadow', email: 'admin@add-shadow.dev', name: 'Add Shadow Admin',
      groups: ['ADMIN'], role: 'ADMIN',
    }).accessToken;
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(async () => {
    for (const id of ids) await run('DELETE FROM wardrobe WHERE id = :id', { id });
    jest.restoreAllMocks();
  });

  async function rgbaPng() {
    const w = 60; const h = 40;
    const px = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const inside = x >= 15 && x < 45 && y >= 10 && y < 30;
        px.set([120, 30, 200, inside ? 255 : 0], (y * w + x) * 4);
      }
    }
    return sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  }

  it('adds the shadow and stores the processed image', async () => {
    const id = crypto.randomUUID();
    ids.push(id);
    await run(`INSERT INTO wardrobe (id, name, clothing_category, character, s3_url, created_at, updated_at)
               VALUES (:id, 'Cut-out coat', 'outerwear', 'lala', 'https://example.test/coat.png', NOW(), NOW())`, { id });

    axios.get.mockResolvedValue({ data: await rgbaPng() });
    let uploaded = null;
    jest.spyOn(wardrobeImageService, 'uploadWardrobeImage').mockImplementation(async (buffer, character, suffix, contentType) => {
      uploaded = { buffer, character, suffix, contentType };
      return { s3Url: 'https://example.test/coat-shadow.png', s3Key: 'wardrobe/coat-shadow.png' };
    });

    const res = await request(app)
      .post(`/api/v1/wardrobe/${id}/add-shadow`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { id, s3_url_processed: 'https://example.test/coat-shadow.png' } });

    // The uploaded image is the padded canvas (default padding 40), with alpha.
    const meta = await sharp(uploaded.buffer).metadata();
    expect({ width: meta.width, height: meta.height, channels: meta.channels }).toEqual({ width: 140, height: 120, channels: 4 });
    expect(uploaded).toMatchObject({ character: 'lala', suffix: '-shadow', contentType: 'image/png' });

    const [[row]] = await run('SELECT s3_url_processed, s3_key_processed FROM wardrobe WHERE id = :id', { id });
    expect(row).toEqual({ s3_url_processed: 'https://example.test/coat-shadow.png', s3_key_processed: 'wardrobe/coat-shadow.png' });
  });

  guardIt('signed out, a viewer and an editor cannot add a shadow: the item is as it was, nothing is downloaded or uploaded', async () => {
    const id = crypto.randomUUID();
    ids.push(id);
    await run(`INSERT INTO wardrobe (id, name, clothing_category, character, s3_url, created_at, updated_at)
               VALUES (:id, 'Cut-out coat', 'outerwear', 'lala', 'https://example.test/coat.png', NOW(), NOW())`, { id });
    axios.get.mockReset();
    axios.get.mockResolvedValue({ data: await rgbaPng() });
    const upload = jest.spyOn(wardrobeImageService, 'uploadWardrobeImage').mockReset()
      .mockResolvedValue({ s3Url: 'https://example.test/never.png', s3Key: 'wardrobe/never.png' });
    const state = async () => JSON.stringify((await run('SELECT s3_url, s3_url_processed, s3_key_processed, updated_at FROM wardrobe WHERE id = :id', { id }))[0]);
    const before = await state();
    await expectWriteRefused(() => request(app).post(`/api/v1/wardrobe/${id}/add-shadow`).send({}), readOnly);
    expect(await state()).toBe(before);
    expect(JSON.parse(before)).toMatchObject([{ s3_url_processed: null }]);
    expect(axios.get).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
});

/**
 * The episode title overlay (ruling P11 as amended, Evoni 2026-09-30;
 * migration 20261001200000). Against the test database, through the app:
 *   - the lettering variants need the approved title and cost nothing (no
 *     image call), each a real-typeface PNG preview;
 *   - saving writes a transparent 1920×1080 PNG overlay asset that belongs
 *     to the episode, with the chosen style and band, and the overlay
 *     fields; a new save replaces the earlier overlay;
 *   - the band's opacity is held to 20–40%;
 *   - the AI flourish is the one image call, keyed to transparency;
 *   - a changed title marks the overlay outdated; the framed card stays.
 * The image provider is mocked; with no S3 bucket the PNG is a data URL.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const imageGen = require('../../src/services/imageGenerationService');
const migration = require('../../src/migrations/20261001200000-add-episode-title-overlay');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const one = async (sql, replacements = {}) =>
  (await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT }))[0];

async function pngInfo(dataUrl) {
  const { loadImage, createCanvas } = require('canvas');
  const img = await loadImage(Buffer.from(dataUrl.split(',')[1], 'base64'));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const corner = ctx.getImageData(0, 0, 1, 1).data[3];
  const centre = ctx.getImageData(0, Math.floor(img.height / 2) - 40, img.width, 80).data;
  let opaque = 0;
  for (let i = 3; i < centre.length; i += 4) if (centre[i] > 200) opaque += 1;
  return { width: img.width, height: img.height, cornerAlpha: corner, opaqueCentre: opaque };
}

(shouldSkip ? describe.skip : describe)('Episode title overlay (P11 as amended)', () => {
  const shows = [];
  const savedEnv = {};
  let token;

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    await migration.up(sequelize.getQueryInterface(), Sequelize); // guarded: a re-run is a no-op
    token = TokenService.generateTokenPair({
      id: 'test-user-title-overlay', email: 'test@title-overlay.dev', name: 'Title Overlay',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET']) { savedEnv[k] = process.env[k]; delete process.env[k]; }
  });

  async function seed() {
    const ids = { show: uuid(), ep: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Overlay ${ids.show.slice(0, 8)}`, slug: `overlay-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', 3, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, prestige, theme, color_palette, created_at, updated_at)
               VALUES (:event, :show, 'Velvet Gala', 'used', :ep, 9, 'soft glam', CAST('["blush","rose gold"]' AS jsonb), NOW(), NOW())`, ids);
    return ids;
  }

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const approve = (ids) => auth(request(app).post(`/api/v1/episodes/${ids.ep}/title/approve`)).send({ title: 'Gala Night' });
  const variants = (ids) => auth(request(app).get(`/api/v1/episodes/${ids.ep}/title-overlay/variants`));
  const save = (ids, body) => auth(request(app).post(`/api/v1/episodes/${ids.ep}/title-overlay`)).send(body);
  const state = (ids) => auth(request(app).get(`/api/v1/episodes/${ids.ep}/title-card`));
  const liveOverlays = (ids) => sequelize.query(
    `SELECT id, metadata, s3_url_processed FROM assets
      WHERE episode_id = :ep AND asset_role = 'UI.OVERLAY.EPISODE_TITLE_TEXT' AND deleted_at IS NULL`,
    { replacements: ids, type: sequelize.QueryTypes.SELECT },
  );

  let genSpy;
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    genSpy = jest.spyOn(imageGen, 'generateImageUrl').mockImplementation(async () => `https://img.test/${uuid()}.png`);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const k of Object.keys(savedEnv)) { if (savedEnv[k] !== undefined) process.env[k] = savedEnv[k]; }
    for (const show of shows) {
      await run(`DELETE FROM assets WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
    await sequelize.close();
  });

  it('the three columns exist and are nullable', async () => {
    const cols = await sequelize.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_name = 'episodes' AND column_name LIKE 'title_overlay_%' ORDER BY column_name`,
      { type: sequelize.QueryTypes.SELECT },
    );
    expect(cols).toEqual([
      { column_name: 'title_overlay_asset_id', data_type: 'uuid', is_nullable: 'YES' },
      { column_name: 'title_overlay_style', data_type: 'jsonb', is_nullable: 'YES' },
      { column_name: 'title_overlay_title', data_type: 'text', is_nullable: 'YES' },
    ]);
  });

  it('the variants need the approved title, and cost nothing', async () => {
    const ids = await seed();
    expect((await variants(ids)).status).toBe(409);
    await approve(ids);
    const res = await variants(ids);
    expect(res.status).toBe(200);
    expect(res.body.data.variants.map((v) => v.key)).toEqual(['classic', 'italic', 'engraved']);
    expect(res.body.data.look).toMatchObject({ theme: 'soft glam', finish: 'rose_foil' });
    const preview = await pngInfo(res.body.data.variants[0].preview);
    expect(preview).toMatchObject({ width: 960, height: 540, cornerAlpha: 0 });
    expect(preview.opaqueCentre).toBeGreaterThan(100);
    expect(genSpy).not.toHaveBeenCalled();
    // The title card state offers the overlay, with the flourish estimate.
    const st = (await state(ids)).body.data;
    expect(st.overlay_offer).toMatchObject({ offered: true, variants: expect.any(Array) });
    expect(st.overlay_offer.flourish_estimate).toHaveProperty('usd');
  });

  it('saving writes a transparent overlay that belongs to the episode; a new save replaces it', async () => {
    const ids = await seed();
    await approve(ids);
    const first = await save(ids, { variant: 'italic', band: { enabled: true, opacity: 0.3 } });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ designed_for: 'Gala Night', outdated: false, style: { variant: 'italic', band: { enabled: true, opacity: 0.3 }, flourish: null } });
    const info = await pngInfo(first.body.data.image_url);
    expect(info).toMatchObject({ width: 1920, height: 1080, cornerAlpha: 0 });
    expect(genSpy).not.toHaveBeenCalled();
    const ep = await one('SELECT title_overlay_asset_id, title_overlay_title FROM episodes WHERE id = :ep', ids);
    expect(ep).toEqual({ title_overlay_asset_id: first.body.data.asset_id, title_overlay_title: 'Gala Night' });
    const [asset] = await liveOverlays(ids);
    expect(asset.metadata).toMatchObject({ source: 'episode-title-overlay', transparent: true, theme: 'soft glam' });

    const second = await save(ids, { variant: 'engraved', band: { enabled: false } });
    expect(second.status).toBe(200);
    expect((await liveOverlays(ids)).map((a) => a.id)).toEqual([second.body.data.asset_id]);
  });

  it('the band is held to 20–40%, and the variant to the offered ones', async () => {
    const ids = await seed();
    await approve(ids);
    expect((await save(ids, { variant: 'classic', band: { enabled: true, opacity: 0.6 } })).body.code).toBe('INVALID_BAND');
    expect((await save(ids, { variant: 'comic', band: { enabled: false } })).body.code).toBe('INVALID_VARIANT');
    expect((await save(ids, { variant: 'classic', band: { enabled: true, opacity: 25 } })).body.data.style.band).toEqual({ enabled: true, opacity: 0.25 });
  });

  it('the AI flourish is the one image call, drawn behind the letters; it can be removed', async () => {
    const ids = await seed();
    await approve(ids);
    expect((await auth(request(app).post(`/api/v1/episodes/${ids.ep}/title-overlay/flourish`))).body.code).toBe('NO_TITLE_OVERLAY');
    await save(ids, { variant: 'classic', band: { enabled: false } });
    const { createCanvas } = require('canvas');
    const ornament = createCanvas(400, 225);
    const octx = ornament.getContext('2d');
    octx.fillStyle = '#000'; octx.fillRect(0, 0, 400, 225);
    octx.fillStyle = '#E8C766'; octx.fillRect(20, 100, 360, 25);
    jest.spyOn(axios, 'get').mockResolvedValue({ data: ornament.toBuffer('image/png') });
    const res = await auth(request(app).post(`/api/v1/episodes/${ids.ep}/title-overlay/flourish`));
    expect(res.status).toBe(200);
    expect(genSpy).toHaveBeenCalledTimes(1);
    expect(genSpy.mock.calls[0][0]).toMatch(/flourish ornament.*pure solid black background.*No text/);
    expect(res.body.data.style.flourish).toMatchObject({ asset_id: expect.any(String) });
    expect((await pngInfo(res.body.data.image_url)).cornerAlpha).toBe(0);
    const removed = await save(ids, { flourish: false });
    expect(removed.body.data.style.flourish).toBeNull();
    expect(removed.body.data.style.variant).toBe('classic');
  });

  it('a changed title marks the overlay outdated; the framed card stays available', async () => {
    const ids = await seed();
    await approve(ids);
    await save(ids, { variant: 'classic', band: { enabled: false } });
    await run(`UPDATE episodes SET title = 'Gala Night Two', title_approved_at = NULL WHERE id = :ep`, ids);
    const st = (await state(ids)).body.data;
    expect(st.overlay).toMatchObject({ outdated: true, designed_for: 'Gala Night' });
    expect(st.overlay_offer).toEqual({ offered: false });
    expect((await variants(ids)).status).toBe(409);
    // The framed card is still its own offer once the title is approved again.
    await auth(request(app).post(`/api/v1/episodes/${ids.ep}/title/approve`)).send({ title: 'Gala Night Two' });
    expect((await state(ids)).body.data.offer).toMatchObject({ offered: true, kind: 'design' });
  });

  // Evoni, 2026-10-07: "i need to be able to edit/delete episode title" (the
  // Title overlay).
  it('changing the words renames and approves the title, and redraws the overlay in its style, with no image call', async () => {
    const ids = await seed();
    await approve(ids);
    await save(ids, { variant: 'classic', band: { enabled: true, opacity: 0.25 } });
    const before = (await liveOverlays(ids))[0];
    const res = await auth(request(app).put(`/api/v1/episodes/${ids.ep}/title-overlay/words`)).send({ title: '  Velvet   Night ' });
    expect(res.status).toBe(200);
    expect(res.body.data.approved).toBe(true);
    expect(res.body.data.overlay).toMatchObject({ outdated: false, designed_for: 'Velvet Night', style: { variant: 'classic', band: { enabled: true, opacity: 0.25 } } });
    expect(genSpy).not.toHaveBeenCalled();
    const ep = await one(`SELECT title, title_approved_value FROM episodes WHERE id = :ep`, ids);
    expect(ep).toEqual({ title: 'Velvet Night', title_approved_value: 'Velvet Night' });
    const live = await liveOverlays(ids);
    expect(live).toHaveLength(1);
    expect(live[0].id).not.toBe(before.id);
    expect((await auth(request(app).put(`/api/v1/episodes/${ids.ep}/title-overlay/words`)).send({ title: '   ' })).status).toBe(400);
  });

  it('changing the words with no overlay yet only renames and approves', async () => {
    const ids = await seed();
    const res = await auth(request(app).put(`/api/v1/episodes/${ids.ep}/title-overlay/words`)).send({ title: 'Rose Gold Hour' });
    expect(res.status).toBe(200);
    expect(res.body.data.approved).toBe(true);
    expect(res.body.data.overlay).toBeNull();
    expect(await liveOverlays(ids)).toHaveLength(0);
  });

  it('deleting the overlay removes its image and flourish; the title stays', async () => {
    const ids = await seed();
    await approve(ids);
    await save(ids, { variant: 'classic', band: { enabled: false } });
    await auth(request(app).post(`/api/v1/episodes/${ids.ep}/title-overlay/flourish`));
    const res = await auth(request(app).delete(`/api/v1/episodes/${ids.ep}/title-overlay`));
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBeGreaterThanOrEqual(1);
    expect(await liveOverlays(ids)).toHaveLength(0);
    const flourishes = await sequelize.query(
      `SELECT id FROM assets WHERE episode_id = :ep AND asset_role = 'UI.OVERLAY.EPISODE_TITLE_FLOURISH' AND deleted_at IS NULL`,
      { replacements: ids, type: sequelize.QueryTypes.SELECT });
    expect(flourishes).toHaveLength(0);
    const st = (await state(ids)).body.data;
    expect(st.overlay).toBeNull();
    expect(st.approved).toBe(true);
    const ep = await one(`SELECT title, title_overlay_asset_id FROM episodes WHERE id = :ep`, ids);
    expect(ep).toEqual({ title: 'Gala Night', title_overlay_asset_id: null });
  });
});

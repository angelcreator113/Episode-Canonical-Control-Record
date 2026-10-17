/**
 * A venue's everyday look at each time of day and in each season
 * (2026-10-15; docs/VENUE_EVERYDAY_AND_EVENT_LOOKS_PLAN.md step 2), on the
 * migrated database through the real routes. The paid edit and S3 are
 * stubbed.
 * - Only the location's everyday set (its approved base) has variants.
 * - A time is a re-light of the everyday look; a season, of the Front view,
 *   and is refused without one (season shows outside).
 * - Generate answers 202 and stores the image and its cost; upload stores
 *   Evoni's image, no cost; remove empties the slot; a run stuck for 10
 *   minutes reads as failed.
 */
jest.unmock('uuid');

const mockS3Send = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn((input) => ({ input })),
  DeleteObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
}));

process.env.FAL_KEY = process.env.FAL_KEY || 'test-fal-key';

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const sceneGen = require('../../src/services/sceneGenerationService');
const migration = require('../../src/migrations/20261015150000-create-location-look-variants');
const perSetMigration = require('../../src/migrations/20261015170000-location-look-variants-per-set');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

(shouldSkip ? describe.skip : describe)('Times & seasons of the everyday look', () => {
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const url = (setId, tail = '') => `/api/v1/scene-sets/${setId}/look-variants${tail}`;

  // A location whose everyday look is a set; front: a Front zone image.
  async function everyday({ approved = true, front = false } = {}) {
    const loc = uuid();
    const set = uuid();
    await run(`INSERT INTO world_locations (id, name, description, created_at, updated_at) VALUES (:loc, 'Lala''s Loft', 'A loft.', NOW(), NOW())`, { loc });
    await run(`INSERT INTO scene_sets (id, name, scene_type, world_location_id, base_still_url, generation_status, created_at, updated_at)
               VALUES (:set, 'Loft', 'HOME_BASE', :loc, 'https://x/everyday.jpg', 'complete', NOW(), NOW())`, { set, loc });
    if (approved) {
      await run(`UPDATE world_locations SET approved_base_scene_set_id = :set, approved_base_image_url = 'https://x/everyday.jpg' WHERE id = :loc`, { set, loc });
    }
    if (front) {
      await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, angle_kind, generation_status, still_image_url, beat_affinity, sort_order, created_at, updated_at)
                 VALUES (:id, :set, 'Front steps', 'ESTABLISHING', 'front', 'complete', 'https://x/front.jpg', '[]', 0, NOW(), NOW())`, { id: uuid(), set });
    }
    return { loc, set };
  }
  const variant = async (loc, kind, value) => (await rows(
    `SELECT * FROM location_look_variants WHERE world_location_id = :loc AND kind = :kind AND value = :value AND deleted_at IS NULL`,
    { loc, kind, value }))[0];

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    await perSetMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-variants', email: 'user@variants.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    mockS3Send.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('the migration is re-runnable', async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    await perSetMigration.up(sequelize.getQueryInterface(), Sequelize);
    const cols = await rows(`SELECT column_name FROM information_schema.columns WHERE table_name = 'location_look_variants'`);
    expect(cols.map((c) => c.column_name)).toEqual(expect.arrayContaining(['world_location_id', 'scene_set_id', 'source_angle_id', 'kind', 'value', 'status', 'source', 'image_url', 'deleted_at']));
  });

  it('a set that is not the everyday look has no variants', async () => {
    const { set } = await everyday({ approved: false });
    const res = await auth(request(app).get(url(set)));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NOT_EVERYDAY_LOOK');
  });

  it('lists every slot empty; a time is a re-light of the everyday look; a season needs the Front view', async () => {
    const { set } = await everyday();
    const list = await auth(request(app).get(url(set)));
    expect(list.status).toBe(200);
    // Evoni, 2026-10-17: Morning, Golden hour, Night; the weather Winter and Rain.
    expect(list.body.data.time.map((s) => s.value)).toEqual(['morning', 'golden_hour', 'night']);
    expect(list.body.data.season.map((s) => s.label)).toEqual(['Winter', 'Rain']);
    expect(list.body.data.time.every((s) => s.variant === null)).toBe(true);
    expect(list.body.data.front_view_url).toBeNull();

    const est = await auth(request(app).post(url(set, '/time/night/estimate'))).send({});
    expect(est.status).toBe(200);
    expect(est.body.data).toMatchObject({ source_image_url: 'https://x/everyday.jpg', estimate: { model: 'flux-kontext' } });
    expect(est.body.data.prompt).toMatch(/^Night/);

    const season = await auth(request(app).post(url(set, '/season/winter/estimate'))).send({});
    expect(season.status).toBe(409);
    expect(season.body.code).toBe('NO_FRONT_VIEW');
    expect((await auth(request(app).post(url(set, '/time/noon/estimate'))).send({})).status).toBe(400);
  });

  it('generate answers 202, then stores the image and its cost; a season is made from the Front view', async () => {
    const { loc, set } = await everyday({ front: true });
    const dressed = jest.spyOn(sceneGen, 'generateDressedStill').mockResolvedValue({ stillUrl: 'https://x/winter.jpg', cost: 0.04 });
    const res = await auth(request(app).post(url(set, '/season/winter/generate'))).send({});
    expect(res.status).toBe(202);
    const end = Date.now() + 5000;
    while ((await variant(loc, 'season', 'winter'))?.status === 'generating' && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
    expect(dressed).toHaveBeenCalledWith(expect.objectContaining({ id: set }), expect.stringMatching(/^Winter/), 'https://x/front.jpg', { suffix: 'variant-season-winter' });
    expect(await variant(loc, 'season', 'winter')).toMatchObject({ status: 'complete', source: 'generated', image_url: 'https://x/winter.jpg', source_image_url: 'https://x/front.jpg', scene_set_id: set });
    // The season remembers the Front angle it shows.
    const [front] = await rows(`SELECT id FROM scene_angles WHERE scene_set_id = :set AND angle_kind = 'front'`, { set });
    expect((await variant(loc, 'season', 'winter')).source_angle_id).toBe(front.id);
    expect(Number((await variant(loc, 'season', 'winter')).cost_usd)).toBe(0.04);
  });

  it('a failed generation is recorded with its reason', async () => {
    const { loc, set } = await everyday();
    jest.spyOn(sceneGen, 'generateDressedStill').mockRejectedValue(new Error('Kontext refused'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await auth(request(app).post(url(set, '/time/night/generate'))).send({});
    const end = Date.now() + 5000;
    while ((await variant(loc, 'time', 'night'))?.status === 'generating' && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
    expect(await variant(loc, 'time', 'night')).toMatchObject({ status: 'failed', error: 'Kontext refused' });
  });

  it('upload stores her image, no cost, a season without a Front view included; remove empties the slot', async () => {
    const { loc, set } = await everyday();
    const res = await auth(request(app).post(url(set, '/season/rain/upload'))).attach('image', PNG, { filename: 's.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ kind: 'season', value: 'rain', status: 'complete', source: 'uploaded' });
    expect(res.body.data.image_url).toMatch(new RegExp(`scene-sets/${set}/variants/season-rain-\\d+\\.png$`));
    expect(mockS3Send).toHaveBeenCalledTimes(1);
    expect(Number((await variant(loc, 'season', 'rain')).cost_usd)).toBe(0);

    const list = await auth(request(app).get(url(set)));
    expect(list.body.data.season.find((s) => s.value === 'rain').variant).toMatchObject({ source: 'uploaded', status: 'complete' });

    const del = await auth(request(app).delete(url(set, '/season/rain')));
    expect(del.body.data).toEqual({ removed: true });
    expect(await variant(loc, 'season', 'rain')).toBeUndefined();
    expect((await auth(request(app).post(url(set, '/time/morning/upload')))).status).toBe(400);
  });

  it('a run stuck for 10 minutes reads as failed', async () => {
    const { loc, set } = await everyday();
    await run(`INSERT INTO location_look_variants (world_location_id, scene_set_id, kind, value, status, created_at, updated_at)
               VALUES (:loc, :set, 'time', 'morning', 'generating', NOW(), NOW() - INTERVAL '11 minutes')`, { loc, set });
    const list = await auth(request(app).get(url(set)));
    expect(list.body.data.time.find((s) => s.value === 'morning').variant).toMatchObject({ status: 'failed', error: 'Timed out: no image after 10 minutes' });
    expect((await variant(loc, 'time', 'morning')).status).toBe('failed');
  });

  it('a failed re-run keeps the previous image in use, with the error; a stuck one too', async () => {
    const { loc, set } = await everyday();
    await run(`INSERT INTO location_look_variants (world_location_id, scene_set_id, kind, value, status, source, source_image_url, image_url, created_at, updated_at)
               VALUES (:loc, :set, 'time', 'night', 'complete', 'generated', 'https://x/everyday.jpg', 'https://x/night.jpg', NOW(), NOW())`, { loc, set });
    jest.spyOn(sceneGen, 'generateDressedStill').mockRejectedValue(new Error('Kontext refused'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await auth(request(app).post(url(set, '/time/night/generate'))).send({});
    const end = Date.now() + 5000;
    while ((await variant(loc, 'time', 'night'))?.status === 'generating' && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
    expect(await variant(loc, 'time', 'night')).toMatchObject({ status: 'complete', image_url: 'https://x/night.jpg', error: 'Kontext refused' });

    await run(`UPDATE location_look_variants SET status = 'generating', updated_at = NOW() - INTERVAL '11 minutes'
                WHERE world_location_id = :loc AND kind = 'time' AND value = 'night'`, { loc });
    const list = await auth(request(app).get(url(set)));
    expect(list.body.data.time.find((s) => s.value === 'night').variant).toMatchObject({ status: 'complete', image_url: 'https://x/night.jpg' });
  });

  it('a failed re-run keeps an uploaded variant uploaded, and a stale one stale', async () => {
    // Fourth audit (2026-10-15): the claim rewrote source and source image first.
    const { loc, set } = await everyday();
    await run(`INSERT INTO location_look_variants (world_location_id, scene_set_id, kind, value, status, source, image_url, created_at, updated_at)
               VALUES (:loc, :set, 'time', 'morning', 'complete', 'uploaded', 'https://x/mine.jpg', NOW(), NOW())`, { loc, set });
    await run(`INSERT INTO location_look_variants (world_location_id, scene_set_id, kind, value, status, source, source_image_url, image_url, created_at, updated_at)
               VALUES (:loc, :set, 'time', 'golden_hour', 'complete', 'generated', 'https://x/older-everyday.jpg', 'https://x/gold.jpg', NOW(), NOW())`, { loc, set });
    jest.spyOn(sceneGen, 'generateDressedStill').mockRejectedValue(new Error('Kontext refused'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    for (const value of ['morning', 'golden_hour']) {
      await auth(request(app).post(url(set, `/time/${value}/generate`))).send({});
      const end = Date.now() + 5000;
      while ((await variant(loc, 'time', value))?.status === 'generating' && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
    }
    expect(await variant(loc, 'time', 'morning')).toMatchObject({ status: 'complete', source: 'uploaded', image_url: 'https://x/mine.jpg' });
    expect(await variant(loc, 'time', 'golden_hour')).toMatchObject({ source_image_url: 'https://x/older-everyday.jpg' });
    const slot = (await auth(request(app).get(url(set)))).body.data.time.find((s) => s.value === 'golden_hour').variant;
    expect(slot.stale).toBe(true);
  });

  it('a generated time variant of an everyday look since replaced is listed as stale', async () => {
    const { loc, set } = await everyday();
    await run(`INSERT INTO location_look_variants (world_location_id, scene_set_id, kind, value, status, source, source_image_url, image_url, created_at, updated_at)
               VALUES (:loc, :set, 'time', 'night', 'complete', 'generated', 'https://x/everyday.jpg', 'https://x/night.jpg', NOW(), NOW())`, { loc, set });
    const slot = async () => (await auth(request(app).get(url(set)))).body.data.time.find((s) => s.value === 'night').variant;
    expect((await slot()).stale).toBe(false);
    await run(`UPDATE world_locations SET approved_base_image_url = 'https://x/new-everyday.jpg' WHERE id = :loc`, { loc });
    await run(`UPDATE scene_sets SET base_still_url = 'https://x/new-everyday.jpg' WHERE id = :set`, { set });
    expect((await slot()).stale).toBe(true);
  });

  it('a second Generate while one runs is refused; an upload made meanwhile is never overwritten', async () => {
    const { loc, set } = await everyday();
    let finish;
    jest.spyOn(sceneGen, 'generateDressedStill').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    expect((await auth(request(app).post(url(set, '/time/night/generate'))).send({})).status).toBe(202);
    const again = await auth(request(app).post(url(set, '/time/night/generate'))).send({});
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('VARIANT_GENERATING');

    const up = await auth(request(app).post(url(set, '/time/night/upload'))).attach('image', PNG, { filename: 'e.png', contentType: 'image/png' });
    expect(up.status).toBe(200);
    finish({ stillUrl: 'https://x/late.jpg', cost: 0.04 });
    await new Promise((r) => setTimeout(r, 50));
    expect(await variant(loc, 'time', 'night')).toMatchObject({ status: 'complete', source: 'uploaded', image_url: up.body.data.image_url });
  });

  it('a new everyday look starts with none of the old one\'s variants', async () => {
    const { loc, set } = await everyday();
    await auth(request(app).post(url(set, '/time/night/upload'))).attach('image', PNG, { filename: 'n.png', contentType: 'image/png' });
    const other = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, world_location_id, base_still_url, generation_status, created_at, updated_at)
               VALUES (:other, 'Loft 2', 'HOME_BASE', :loc, 'https://x/everyday2.jpg', 'complete', NOW(), NOW())`, { other, loc });
    await run(`UPDATE world_locations SET approved_base_scene_set_id = :other, approved_base_image_url = 'https://x/everyday2.jpg' WHERE id = :loc`, { other, loc });
    const list = await auth(request(app).get(url(other)));
    expect(list.status).toBe(200);
    expect(list.body.data.time.every((s) => s.variant === null)).toBe(true);
  });

  // Evoni, 2026-10-17: Afternoon, Evening, Spring, Summer and Fall are no
  // longer offered. A picture made before is hidden, not deleted, and not made.
  it('an old Afternoon or Spring picture is kept but not listed, made or used', async () => {
    const { loc, set } = await everyday();
    await run(`INSERT INTO location_look_variants (id, world_location_id, scene_set_id, kind, value, status, source, image_url, created_at, updated_at)
               VALUES (gen_random_uuid(), :loc, :set, 'time', 'afternoon', 'complete', 'uploaded', 'https://x/afternoon.jpg', NOW(), NOW()),
                      (gen_random_uuid(), :loc, :set, 'season', 'spring', 'complete', 'uploaded', 'https://x/spring.jpg', NOW(), NOW())`, { loc, set });
    const list = await auth(request(app).get(url(set)));
    expect(list.body.data.time.map((s) => s.value)).not.toContain('afternoon');
    expect(list.body.data.season.map((s) => s.value)).not.toContain('spring');
    expect((await auth(request(app).post(url(set, '/time/afternoon/estimate'))).send({})).status).toBe(400);
    expect((await variant(loc, 'time', 'afternoon')).image_url).toBe('https://x/afternoon.jpg');
    const { variantsForSets } = require('../../src/services/lookVariantPicking');
    const picked = (await variantsForSets(sequelize, [set])).get(set);
    expect(picked?.time.has('afternoon') || false).toBe(false);
    expect(picked?.season.has('spring') || false).toBe(false);
  });

  it('a refused file answers 400 with its reason', async () => {
    const { set } = await everyday();
    const res = await auth(request(app).post(url(set, '/time/morning/upload'))).attach('image', Buffer.from('hi'), { filename: 'n.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'BAD_FILE', error: 'Only JPEG, PNG, and WebP images are allowed' });
  });

  it('the follow-up migration gives older rows their everyday set, and drops rows with none', async () => {
    const { loc, set } = await everyday();
    const orphanLoc = (await everyday({ approved: false })).loc;
    await run(`INSERT INTO location_look_variants (world_location_id, kind, value, status, source, image_url, created_at, updated_at)
               VALUES (:loc, 'time', 'afternoon', 'complete', 'uploaded', 'https://x/a.jpg', NOW(), NOW()),
                      (:orphanLoc, 'time', 'afternoon', 'complete', 'uploaded', 'https://x/b.jpg', NOW(), NOW())`, { loc, orphanLoc });
    await perSetMigration.up(sequelize.getQueryInterface(), Sequelize);
    expect((await variant(loc, 'time', 'afternoon')).scene_set_id).toBe(set);
    expect(await variant(orphanLoc, 'time', 'afternoon')).toBeUndefined();
  });
});


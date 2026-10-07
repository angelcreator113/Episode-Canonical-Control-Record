/**
 * Lala's Phone, step 1 (Evoni, 2026-10-07: "fix the data-loss bugs"),
 * against real Postgres:
 *   - replacing a screen's image (upload or generate) keeps its tap zones,
 *     content areas, fit and chosen category;
 *   - generate replaces the main image only; a variant stays;
 *   - a failed generation leaves the old image in place;
 *   - a save to an image that is no longer live is a 404, not a success.
 * S3 and the image model are mocked; the route, transaction and SQL are real.
 */
jest.unmock('uuid');
jest.mock('../../src/services/uiOverlayService', () => ({
  ...jest.requireActual('../../src/services/uiOverlayService'),
  uploadOverlayToS3: jest.fn(async () => 'https://bucket/new-upload.png'),
  generateOverlay: jest.fn(async () => ({ url: 'https://bucket/new-generated.png', bg_removed: false, prompt_used: 'p' })),
}));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const overlayService = require('../../src/services/uiOverlayService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

(shouldSkip ? describe.skip : describe)("Lala's Phone: replacing an image keeps its work", () => {
  const show = uuid();
  let token;
  const ZONES = [{ id: 'z1', x: 10, y: 20, w: 14, h: 7, target: 'scr-camera' }];
  const CONTENT = [{ id: 'c1', type: 'feed', x: 0, y: 10, w: 100, h: 50 }];
  const FIT = { mode: 'cover', x: 50, y: 40, scale: 1.1 };

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-phone', email: 'p@phone.dev', name: 'Phone', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n, :n, NOW(), NOW())`, { show, n: `phone-${show.slice(0, 8)}` });
    await run(`INSERT INTO ui_overlay_types (id, show_id, type_key, name, category, prompt, created_at, updated_at)
               VALUES (:id, :show, 'scr_home', 'Home', 'phone', 'A phone home screen', NOW(), NOW())`, { id: uuid(), show });
  });

  afterAll(async () => {
    await run(`DELETE FROM assets WHERE show_id = :show`, { show });
    await run(`DELETE FROM ui_overlay_types WHERE show_id = :show`, { show });
    await run(`DELETE FROM shows WHERE id = :show`, { show });
  });

  beforeEach(async () => {
    await run(`DELETE FROM assets WHERE show_id = :show`, { show });
    overlayService.generateOverlay.mockClear();
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const asset = async (meta, { id = uuid() } = {}) => {
    await run(`INSERT INTO assets (id, name, asset_type, show_id, s3_url_processed, metadata, created_at, updated_at)
               VALUES (:id, 'UI Overlay: Home', 'UI_OVERLAY', :show, 'https://bucket/old.png', CAST(:meta AS jsonb), NOW() - interval '1 minute', NOW())`,
      { id, show, meta: JSON.stringify({ overlay_type: 'scr_home', overlay_category: 'phone', ...meta }) });
    return id;
  };
  const live = () => q(`SELECT id, metadata, s3_url_processed FROM assets WHERE show_id = :show AND deleted_at IS NULL ORDER BY created_at`, { show });

  it('uploading a new image keeps the tap zones, content areas, fit and chosen category', async () => {
    const old = await asset({ screen_links: ZONES, content_zones: CONTENT, image_fit: FIT, overlay_category: 'phone_app' });
    const res = await auth(request(app).post(`/api/v1/ui-overlays/${show}/upload/scr_home`)).attach('image', Buffer.from('png'), 'home.png');
    expect(res.status).toBe(200);
    expect(res.body.data.carried.sort()).toEqual(['content_zones', 'image_fit', 'overlay_category', 'screen_links']);
    const rows = await live();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toBe(old);
    expect(rows[0].s3_url_processed).toBe('https://bucket/new-upload.png');
    expect(rows[0].metadata).toMatchObject({ screen_links: ZONES, content_zones: CONTENT, image_fit: FIT, overlay_category: 'phone_app', source: 'custom-upload' });
  });

  it('generating replaces the main image only: its work carries, a variant stays', async () => {
    await asset({ screen_links: ZONES });
    const variant = await asset({ variant_label: 'Locked', screen_links: [] });
    const res = await auth(request(app).post(`/api/v1/ui-overlays/${show}/generate/scr_home`)).send({});
    expect(res.status).toBe(200);
    const rows = await live();
    expect(rows.map((r) => r.id)).toContain(variant);
    const main = rows.find((r) => !r.metadata.variant_label);
    expect(main.s3_url_processed).toBe('https://bucket/new-generated.png');
    expect(main.metadata.screen_links).toEqual(ZONES);
  });

  it('a failed generation leaves the old image in place', async () => {
    const old = await asset({ screen_links: ZONES });
    overlayService.generateOverlay.mockRejectedValueOnce(new Error('image model down'));
    const res = await auth(request(app).post(`/api/v1/ui-overlays/${show}/generate/scr_home`)).send({});
    expect(res.status).toBe(500);
    expect((await live()).map((r) => r.id)).toEqual([old]);
  });

  it('a save to an image that is no longer live is a 404 with a reason, not a success', async () => {
    const gone = await asset({});
    await run(`UPDATE assets SET deleted_at = NOW() WHERE id = :gone`, { gone });
    for (const [path, body] of [
      ['screen-links', { screen_links: ZONES }],
      ['content-zones', { content_zones: CONTENT }],
      ['image-fit', { image_fit: FIT }],
      ['category', { category: 'phone' }],
    ]) {
      const res = await auth(request(app).put(`/api/v1/ui-overlays/${show}/${path}/${gone}`)).send(body);
      expect([path, res.status]).toEqual([path, 404]);
      expect(res.body.error).toMatch(/replaced or removed/);
    }
    const ok = await asset({});
    expect((await auth(request(app).put(`/api/v1/ui-overlays/${show}/screen-links/${ok}`)).send({ screen_links: ZONES })).status).toBe(200);
  });
});

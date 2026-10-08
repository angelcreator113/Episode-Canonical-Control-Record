/**
 * Lala's Phone audit, batch 2 — lost work (Evoni, 2026-10-07).
 *   - A custom icon upload drops the zone's library icon key, so it does not
 *     revert to the library icon on reload; a zone not saved yet is a 404.
 *   - Replacing a screen's show-wide image leaves an episode's own version.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const uiOverlayService = require('../../src/services/uiOverlayService');
const { replaceOverlayAsset } = require('../../src/services/uiOverlayAssetReplace');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const metaOf = async (id) => {
  const [[row]] = await run(`SELECT metadata::text AS m, deleted_at FROM assets WHERE id = :id`, { id });
  return { meta: JSON.parse(row.m), deleted: !!row.deleted_at };
};

(shouldSkip ? describe.skip : describe)("Lala's Phone audit: lost work", () => {
  const show = uuid();
  const ep = uuid();
  const home = uuid();
  const epVersion = uuid();
  let token;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-lost', email: 'l@lost.dev', name: 'Lost', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n, :n, NOW(), NOW())`, { show, n: `lost-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Gala', 1, 'draft', NOW(), NOW())`, { ep, show });
    const meta = { overlay_type: 'home', overlay_category: 'phone', screen_links: [
      { id: 'z1', x: 1, y: 1, w: 5, h: 5, target: 'dms', icon_overlay_id: 'icon_chat', icon_url: 'https://x/lib.png', icon_urls: ['https://x/lib.png'] },
    ] };
    await run(`INSERT INTO assets (id, name, asset_type, show_id, s3_url_processed, metadata, created_at, updated_at)
               VALUES (:home, 'UI Overlay: Home', 'UI_OVERLAY', :show, 'https://x/home.png', CAST(:meta AS jsonb), NOW(), NOW())`,
    { home, show, meta: JSON.stringify(meta) });
    await run(`INSERT INTO assets (id, name, asset_type, show_id, episode_id, s3_url_processed, metadata, created_at, updated_at)
               VALUES (:epVersion, 'UI Overlay: Home', 'UI_OVERLAY', :show, :ep, 'https://x/home-ep.png', CAST(:meta AS jsonb), NOW(), NOW())`,
    { epVersion, show, ep, meta: JSON.stringify({ overlay_type: 'home', overlay_category: 'phone' }) });
  });

  afterAll(async () => {
    await run(`DELETE FROM assets WHERE show_id = :show`, { show });
    await run(`DELETE FROM episodes WHERE id = :ep`, { ep });
    await run(`DELETE FROM shows WHERE id = :show`, { show });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const uploadIcon = (linkId) => auth(request(app).post(`/api/v1/ui-overlays/${show}/screen-links/${home}/icon`))
    .field('link_id', linkId)
    .attach('icon', Buffer.from([0x89, 0x50, 0x4e, 0x47]), { filename: 'star.png', contentType: 'image/png' });

  test('a custom icon replaces the library icon for good', async () => {
    const spy = jest.spyOn(uiOverlayService, 'uploadOverlayToS3').mockResolvedValue('https://x/star.png');
    try {
      const res = await uploadIcon('z1');
      expect(res.status).toBe(200);
      const [zone] = (await metaOf(home)).meta.screen_links;
      expect(zone.icon_overlay_id).toBeUndefined();
      expect(zone).toMatchObject({ icon_url: 'https://x/star.png', icon_urls: ['https://x/star.png'], target: 'dms' });

      const missing = await uploadIcon('z-not-saved');
      expect(missing.status).toBe(404);
    } finally { spy.mockRestore(); }
  });

  test("replacing the show's image leaves the episode's own version", async () => {
    const next = uuid();
    const { carried } = await replaceOverlayAsset(sequelize, {
      showId: show, overlayId: 'home', assetId: next, name: 'UI Overlay: Home', url: 'https://x/home2.png',
      metadata: { overlay_type: 'home', overlay_category: 'phone' },
    });
    expect(carried).toContain('screen_links');
    expect((await metaOf(home)).deleted).toBe(true);
    expect((await metaOf(epVersion)).deleted).toBe(false);
    expect((await metaOf(next)).meta.screen_links[0].icon_url).toBe('https://x/star.png');
  });
});

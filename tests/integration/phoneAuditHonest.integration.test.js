/**
 * Lala's Phone audit, batch 3 — the phone says what is true (Evoni,
 * 2026-10-07).
 *   - Deleting a screen removes its images and the zones that led to it.
 *   - A refused duplicate never unsets the show's home screen.
 *   - Content areas are checked on save.
 *   - The AI context reads the show's characters (a filter on a column the
 *     table doesn't have emptied them, silently).
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { buildPhoneContext } = require('../../src/services/phoneContextBuilder');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)("Lala's Phone audit: honest", () => {
  const show = uuid();
  const home = uuid();
  const feedImg = uuid();
  const feedType = uuid();
  let token;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-honest', email: 'h@honest.dev', name: 'Honest', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n, :n, NOW(), NOW())`, { show, n: `honest-${show.slice(0, 8)}` });
    const type = (id, key, name, isHome) => run(
      `INSERT INTO ui_overlay_types (id, show_id, type_key, name, category, beat, description, prompt, sort_order, is_home, created_at, updated_at)
       VALUES (:id, :show, :key, :name, 'phone', '', '', '', 1, :isHome, NOW(), NOW())`, { id, show, key, name, isHome });
    await type(uuid(), 'home', 'Home', true);
    await type(feedType, 'feed', 'Feed', false);
    const asset = (id, meta) => run(
      `INSERT INTO assets (id, name, asset_type, show_id, s3_url_processed, metadata, created_at, updated_at)
       VALUES (:id, 'UI Overlay', 'UI_OVERLAY', :show, 'https://x/a.png', CAST(:meta AS jsonb), NOW(), NOW())`,
      { id, show, meta: JSON.stringify(meta) });
    await asset(home, { overlay_type: 'home', overlay_category: 'phone', screen_links: [
      { id: 'z-feed', x: 1, y: 1, w: 5, h: 5, target: 'feed' },
      { id: 'z-stay', x: 10, y: 1, w: 5, h: 5, target: 'home' },
    ] });
    await asset(feedImg, { overlay_type: 'feed', overlay_category: 'phone' });
    await run(`INSERT INTO characters (id, show_id, name, role, created_at, updated_at) VALUES (:id, :show, 'Lala', 'protagonist', NOW(), NOW())`, { id: uuid(), show });
  });

  afterAll(async () => {
    await run(`DELETE FROM characters WHERE show_id = :show`, { show });
    await run(`DELETE FROM assets WHERE show_id = :show`, { show });
    await run(`DELETE FROM ui_overlay_types WHERE show_id = :show`, { show });
    await run(`DELETE FROM shows WHERE id = :show`, { show });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  test("a refused duplicate keeps the show's home", async () => {
    const res = await auth(request(app).post(`/api/v1/ui-overlays/${show}/types`)).send({ name: 'Feed', type_key: 'feed', is_home: true });
    expect(res.status).toBe(409);
    const [[row]] = await run(`SELECT is_home FROM ui_overlay_types WHERE show_id = :show AND type_key = 'home'`, { show });
    expect(row.is_home).toBe(true);
  });

  test('content areas are checked on save', async () => {
    const put = (zones) => auth(request(app).put(`/api/v1/ui-overlays/${show}/content-zones/${home}`)).send({ content_zones: zones });
    const bad = await put([{ id: 'c1', x: 0, y: 0, w: 'wide', h: 10 }]);
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('Content area 1: w must be a number from 0 to 100.');
    const noKey = await put([{ id: 'c1', x: 0, y: 0, w: 50, h: 10, conditions: [{ key: '', op: 'eq', value: true }] }]);
    expect(noKey.status).toBe(400);
    expect(noKey.body.error).toBe('Content area 1: a condition needs a key (or remove it)');
    const ok = await put([{ id: 'c1', x: 0, y: 0, w: 50, h: 10, content_type: 'feed_posts', conditions: [{ key: 'visited:feed', op: 'eq', value: true }] }]);
    expect(ok.status).toBe(200);
  });

  test("the AI context reads the show's characters", async () => {
    const ctx = await buildPhoneContext({ showId: show, assetId: home });
    expect(ctx.characters.map((c) => c.name)).toEqual(['Lala']);
  });

  test('deleting a screen removes its images and the zones that led to it', async () => {
    const res = await auth(request(app).delete(`/api/v1/ui-overlays/${show}/types/${feedType}`));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ deletedKey: 'feed', zonesRemoved: 1 });
    const [[img]] = await run(`SELECT deleted_at FROM assets WHERE id = :feedImg`, { feedImg });
    expect(img.deleted_at).not.toBeNull();
    const [[h]] = await run(`SELECT metadata::text AS m FROM assets WHERE id = :home`, { home });
    expect(JSON.parse(h.m).screen_links.map((z) => z.id)).toEqual(['z-stay']);
  });
});

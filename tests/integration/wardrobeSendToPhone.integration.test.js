/**
 * Wardrobe → Send to phone (Evoni, 2026-10-07: "start the rest of lalas
 * phone"). The screen was saved with overlay_type 'wardrobe_detail' and no
 * ui_overlay_types row, so GET /ui-overlays/:showId, which lists a show's
 * screens from its type rows, never showed it. Now each piece and backdrop
 * gets its own screen, listed in Lala's Phone; sending it again replaces the
 * image and keeps the zones drawn on it.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

(shouldSkip ? describe.skip : describe)('Wardrobe → Send to phone', () => {
  const show = uuid();
  const piece = uuid();
  const loose = uuid();
  let token;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-send', email: 's@send.dev', name: 'Send', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n, :n, NOW(), NOW())`, { show, n: `send-${show.slice(0, 8)}` });
    await run(`INSERT INTO wardrobe (id, name, clothing_category, show_id, brand, price, s3_url_bg_pink, s3_key_bg_pink, created_at, updated_at)
               VALUES (:id, 'Gold Slip', 'dress', :show, 'Maison Reve', 450, 'https://bucket/pink.jpg', 'pink.jpg', NOW(), NOW())`, { id: piece, show });
    await run(`INSERT INTO wardrobe (id, name, clothing_category, s3_url_bg_pink, created_at, updated_at)
               VALUES (:id, 'No Show', 'top', 'https://bucket/p2.jpg', NOW(), NOW())`, { id: loose });
  });

  afterAll(async () => {
    await run(`DELETE FROM assets WHERE show_id = :show`, { show });
    await run(`DELETE FROM ui_overlay_types WHERE show_id = :show`, { show });
    await run(`DELETE FROM wardrobe WHERE id IN (:ids)`, { ids: [piece, loose] });
    await run(`DELETE FROM shows WHERE id = :show`, { show });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const send = (id, body) => auth(request(app).post(`/api/v1/wardrobe/${id}/send-to-phone`)).send(body);
  const phone = async () => (await auth(request(app).get(`/api/v1/ui-overlays/${show}`))).body.data;

  it("the sent screen is listed in Lala's Phone, as a screen with its Equip zone", async () => {
    const res = await send(piece, { variant: 'pink', showId: show });
    expect(res.status).toBe(200);
    const listed = (await phone()).find((o) => o.id === res.body.data.type_key);
    expect(listed).toBeTruthy();
    expect(listed).toMatchObject({ name: 'Gold Slip — pink detail', category: 'phone', generated: true, url: 'https://bucket/pink.jpg' });
    expect(listed.screen_links?.[0]?.label).toBe('Equip');
  });

  it('sending it again replaces the image and keeps the zones drawn on it', async () => {
    const first = await send(piece, { variant: 'pink', showId: show });
    const ZONES = [{ id: 'z-mine', x: 1, y: 2, w: 3, h: 4, label: 'Mine' }];
    await run(`UPDATE assets SET metadata = jsonb_set(metadata, '{screen_links}', CAST(:z AS jsonb)) WHERE id = :id`,
      { z: JSON.stringify(ZONES), id: first.body.data.asset_id });
    const again = await send(piece, { variant: 'pink', showId: show });
    expect(again.status).toBe(200);
    const live = await q(`SELECT id, metadata FROM assets WHERE show_id = :show AND metadata->>'overlay_type' = :key AND deleted_at IS NULL`,
      { show, key: again.body.data.type_key });
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe(again.body.data.asset_id);
    expect(live[0].metadata.screen_links).toEqual(ZONES);
    const types = await q(`SELECT id FROM ui_overlay_types WHERE show_id = :show AND type_key = :key AND deleted_at IS NULL`,
      { show, key: again.body.data.type_key });
    expect(types).toHaveLength(1);
  });

  it('a piece in no show is refused with a reason, not saved where no phone shows it', async () => {
    const res = await send(loose, { variant: 'pink' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/isn't in a show/);
  });
});

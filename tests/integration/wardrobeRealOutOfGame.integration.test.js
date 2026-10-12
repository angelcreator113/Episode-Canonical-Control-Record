/**
 * A piece's real-world source stays out of the game (Task #3020; The Pulse
 * spec §10; docs/reads/2026-10-12-pulse-shop-the-look-read.md §3), against
 * the test database:
 * - every game route that read whole wardrobe rows answers without the
 *   eleven real-world fields: the episode's outfit and its attachment
 *   pieces, the closet browse pool, purchase, a piece's pieces, the event
 *   filter, lock-outfit, and the world browse pool;
 * - the world browse pool stored on the episode has none;
 * - the migration takes them out of a pool stored before, and leaves the
 *   rest of it;
 * - the Studio's GET of a piece, where they are edited, still returns them.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { REAL_WORLD_FIELDS } = require('../../src/utils/wardrobeInWorld');
const migration = require('../../src/migrations/20261012120000-strip-real-fields-from-browse-pools');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

/** Every real-world key found at any depth of a response body. */
function realKeysIn(value, found = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => realKeysIn(v, found));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (REAL_WORLD_FIELDS.includes(k)) found.add(k);
      realKeysIn(v, found);
    }
  }
  return [...found];
}

const REAL = {
  real_brand: 'Reformation', real_retailer: 'Nordstrom', real_product_name: 'Juliette Dress',
  real_price_paid: 128, real_list_price: 248, real_product_url: 'https://www.example.com/dress',
  affiliate_url: 'https://shop.example/dress?ref=lala', real_source: 'manual',
};

(shouldSkip ? describe.skip : describe)('real-world fields stay out of the game (Task #3020)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep: uuid(), dress: uuid(), belt: uuid() };
  let token;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);
  const clean = (res) => {
    expect(res.status).toBe(200);
    expect(realKeysIn(res.body)).toEqual([]);
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-real-out', email: 'evoni@real.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Real ${tag}`, slug: `real-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'One', 1, 'draft', NOW(), NOW())`, ids);
    await models.Wardrobe.create({ id: ids.dress, name: `Slip dress ${tag}`, clothing_category: 'dress', character: 'Lala',
      show_id: ids.show, is_owned: true, is_visible: true, brand: 'Maison Belle', price: 420, ...REAL });
    await models.Wardrobe.create({ id: ids.belt, name: `Belt ${tag}`, clothing_category: 'accessories', character: 'Lala',
      show_id: ids.show, parent_item_id: ids.dress, attachment_type: 'belt', ...REAL });
  });

  afterAll(async () => {
    await run('DELETE FROM episode_wardrobe WHERE episode_id = :ep', ids);
    await run('DELETE FROM wardrobe WHERE id IN (:belt, :dress)', ids);
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('lock-outfit, then the episode outfit with its attachment pieces', async () => {
    const locked = await as(request(app).post(`/api/v1/wardrobe-events/${ids.ep}/lock-outfit`)).send({ wardrobe_ids: [ids.dress] });
    clean(locked);
    expect(locked.body.data[0].item.name).toBe(`Slip dress ${tag}`);
    const outfit = await as(request(app).get(`/api/v1/wardrobe/outfit/${ids.ep}`));
    clean(outfit);
    expect(outfit.body.items).toHaveLength(1);
    expect(outfit.body.items[0].brand).toBe('Maison Belle');
    expect(outfit.body.items[0].attachment_pieces.map((p) => p.id)).toEqual([ids.belt]);
  });

  test("a piece's pieces, purchase and the event filter", async () => {
    clean(await as(request(app).get(`/api/v1/wardrobe/${ids.dress}/pieces`)));
    const bought = await as(request(app).post('/api/v1/wardrobe/purchase')).send({ wardrobe_id: ids.dress, show_id: ids.show });
    clean(bought);
    expect(bought.body.already_owned).toBe(true);
    const filtered = await as(request(app).get(`/api/v1/wardrobe-events/${ids.show}/filter`));
    clean(filtered);
    expect(filtered.body.data.map((i) => i.id)).toContain(ids.dress);
  });

  test('the closet browse pool', async () => {
    const res = await as(request(app).post('/api/v1/wardrobe/browse-pool')).send({ show_id: ids.show, event_name: 'Gala' });
    clean(res);
    expect(res.body.pool.map((i) => i.id)).toContain(ids.dress);
  });

  test('the world browse pool, and the copy stored on the episode', async () => {
    clean(await as(request(app).post(`/api/v1/world/${ids.show}/browse-pool`)).send({ episode_id: ids.ep }));
    const [[row]] = await run('SELECT browse_pool_json FROM episodes WHERE id = :ep', ids);
    expect(row.browse_pool_json).not.toBeNull();
    expect(realKeysIn(row.browse_pool_json)).toEqual([]);
  });

  test('the migration takes them out of a pool stored before, and keeps the rest', async () => {
    const old = { pool: [{ id: ids.dress, name: 'Slip dress', brand: 'Maison Belle', ...REAL, nested: { real_price_paid: 128, keep: 1 } }], sequence: [{ action: 'open' }] };
    await run('UPDATE episodes SET browse_pool_json = CAST(:pool AS jsonb) WHERE id = :ep', { ep: ids.ep, pool: JSON.stringify(old) });
    await migration.up(sequelize.getQueryInterface());
    const [[row]] = await run('SELECT browse_pool_json FROM episodes WHERE id = :ep', ids);
    expect(row.browse_pool_json).toEqual({
      pool: [{ id: ids.dress, name: 'Slip dress', brand: 'Maison Belle', nested: { keep: 1 } }], sequence: [{ action: 'open' }],
    });
  });

  test('the Studio GET of a piece, where they are edited, still returns them', async () => {
    const res = await as(request(app).get(`/api/v1/wardrobe/${ids.dress}`));
    expect(res.status).toBe(200);
    const piece = res.body.data || res.body;
    expect(piece.real_brand).toBe('Reformation');
    expect(piece.affiliate_url).toBe('https://shop.example/dress?ref=lala');
  });
});

/**
 * Matching sets (W1, Evoni 2026-10-01; EVENT_EPISODE_FLOW.md §8(ee)):
 * POST/PUT/DELETE /api/v1/wardrobe/matching-sets on the test database.
 * Linking stamps outfit_set_id and outfit_set_name on the pieces; the closet
 * list returns them; replacing the members unlinks the ones left out; a piece
 * moves when linked into another set; deleting a set leaves its pieces.
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

(shouldSkip ? describe.skip : describe)('Wardrobe matching sets (W1)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-w1', email: 'test@w1.dev', name: 'W1', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      await run('DELETE FROM wardrobe WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  async function seed() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`, { show, name: `W1 ${show.slice(0, 8)}`, slug: `w1-${show.slice(0, 8)}` });
    const pieces = {};
    for (const [key, name, category] of [['top', 'Floral Corset', 'top'], ['skirt', 'Floral Skirt', 'bottom'], ['ear', 'Floral Earrings', 'earrings'], ['bag', 'Rattan Bag', 'bag']]) {
      pieces[key] = uuid();
      await run(`INSERT INTO wardrobe (id, name, clothing_category, show_id, created_at, updated_at) VALUES (:id, :name, :category, :show, NOW(), NOW())`,
        { id: pieces[key], name, category, show });
    }
    return { show, pieces };
  }

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const stamps = (ids) => q('SELECT id, outfit_set_id, outfit_set_name FROM wardrobe WHERE id IN (:ids) ORDER BY name', { ids });

  it('links pieces as a named set; the closet list returns the link', async () => {
    const { show, pieces } = await seed();
    const res = await auth(request(app).post('/api/v1/wardrobe/matching-sets'))
      .send({ show_id: show, name: 'Floral Corset Set', wardrobe_ids: [pieces.top, pieces.skirt, pieces.ear] });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Floral Corset Set');
    expect(res.body.data.pieces.map((p) => p.name)).toEqual(['Floral Corset', 'Floral Earrings', 'Floral Skirt']);
    const setId = res.body.data.id;

    const list = await auth(request(app).get(`/api/v1/wardrobe?show_id=${show}&limit=50`));
    const linked = list.body.data.filter((w) => w.outfit_set_id === setId);
    expect(linked).toHaveLength(3);
    expect(linked.every((w) => w.outfit_set_name === 'Floral Corset Set')).toBe(true);
    expect(list.body.data.find((w) => w.id === pieces.bag).outfit_set_id).toBeNull();
  });

  it('replacing the members unlinks the ones left out; renaming renames every piece', async () => {
    const { show, pieces } = await seed();
    const { body } = await auth(request(app).post('/api/v1/wardrobe/matching-sets'))
      .send({ show_id: show, name: 'Floral', wardrobe_ids: [pieces.top, pieces.skirt, pieces.ear] });
    const setId = body.data.id;
    const res = await auth(request(app).put(`/api/v1/wardrobe/matching-sets/${setId}`))
      .send({ show_id: show, name: 'Garden Party', wardrobe_ids: [pieces.top, pieces.skirt, pieces.bag] });
    expect(res.status).toBe(200);
    const rows = await stamps([pieces.top, pieces.skirt, pieces.ear, pieces.bag]);
    expect(rows.map((r) => [r.outfit_set_id === setId, r.outfit_set_name])).toEqual([
      [true, 'Garden Party'], [false, null], [true, 'Garden Party'], [true, 'Garden Party'],
    ]); // by name: Floral Corset, Floral Earrings, Floral Skirt, Rattan Bag
    expect((await auth(request(app).put(`/api/v1/wardrobe/matching-sets/${setId}`)).send({ name: 'Renamed' })).status).toBe(200);
    expect((await stamps([pieces.top]))[0].outfit_set_name).toBe('Renamed');
  });

  it('a piece linked into another set moves; deleting a set leaves its pieces', async () => {
    const { show, pieces } = await seed();
    const a = (await auth(request(app).post('/api/v1/wardrobe/matching-sets')).send({ show_id: show, name: 'A', wardrobe_ids: [pieces.top, pieces.skirt] })).body.data.id;
    const b = (await auth(request(app).post('/api/v1/wardrobe/matching-sets')).send({ show_id: show, name: 'B', wardrobe_ids: [pieces.skirt, pieces.ear] })).body.data.id;
    expect((await stamps([pieces.skirt]))[0].outfit_set_id).toBe(b);
    expect((await stamps([pieces.top]))[0].outfit_set_id).toBe(a);

    const del = await auth(request(app).delete(`/api/v1/wardrobe/matching-sets/${b}`));
    expect(del.status).toBe(200);
    expect(del.body.data.unlinked).toBe(2);
    const rows = await q('SELECT COUNT(*)::int AS n FROM wardrobe WHERE id IN (:ids) AND deleted_at IS NULL', { ids: [pieces.skirt, pieces.ear] });
    expect(rows[0].n).toBe(2);
    expect((await stamps([pieces.skirt]))[0].outfit_set_id).toBeNull();
    expect((await auth(request(app).delete(`/api/v1/wardrobe/matching-sets/${b}`))).status).toBe(404);
  });

  it('refuses a set of one, a missing or another show\'s piece, and no name; needs a login', async () => {
    const { show, pieces } = await seed();
    const other = await seed();
    const post = (body) => auth(request(app).post('/api/v1/wardrobe/matching-sets')).send(body);
    expect((await post({ show_id: show, name: 'One', wardrobe_ids: [pieces.top] })).status).toBe(400);
    expect((await post({ show_id: show, name: '', wardrobe_ids: [pieces.top, pieces.skirt] })).status).toBe(400);
    expect((await post({ show_id: show, name: 'X', wardrobe_ids: [pieces.top, uuid()] })).status).toBe(400);
    expect((await post({ show_id: show, name: 'X', wardrobe_ids: [pieces.top, other.pieces.top] })).status).toBe(400);
    expect((await stamps([pieces.top]))[0].outfit_set_id).toBeNull();
    expect((await request(app).post('/api/v1/wardrobe/matching-sets').send({})).status).toBe(401);
  });
});

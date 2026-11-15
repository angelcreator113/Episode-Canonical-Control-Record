/**
 * The production wardrobe is the studio's to read (Evoni's decisions of
 * 2026-11-15: "ADMIN-only read access for production wardrobe pieces, outfit
 * sets, episode styling, style sheets and Distribution data", the To-Do and
 * My Little List reads included), against the test database.
 *
 * These reads asked for a signed-in account and nothing more. Three of them
 * gave the whole wardrobe row (what a piece really is, where it was bought,
 * what was paid, its affiliate link) and the Distribution read gave the
 * real-world shop links. Every caller is a production screen.
 *
 * One piece is seeded with a marker in each real-world field. Nobody but an
 * ADMIN gets an answer from any of these reads, and no refusal carries the
 * marker. The services that read the wardrobe themselves (the Shop the Look
 * links) are not behind these routes and still read it.
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

const MARK = 'ZZWARDROBE';

(shouldSkip ? describe.skip : describe)('the production wardrobe: who reads it', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), episode: crypto.randomUUID(), piece: crypto.randomUUID(), event: crypto.randomUUID() };
  const none = '00000000-0000-4000-8000-000000000000';
  const tokens = {};
  let ipN = 0;
  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const get = (who, path) => {
    ipN += 1;
    const r = request(app).get(path).set('X-Forwarded-For', `198.51.111.${(ipN % 200) + 1}`);
    return tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r;
  };

  // Every read this ruling covers, by the path a production screen asks for.
  const reads = () => [
    // the pieces
    `/api/v1/wardrobe?show_id=${ids.show}`,
    `/api/v1/wardrobe/${ids.piece}`,
    '/api/v1/wardrobe/staging',
    `/api/v1/wardrobe/${ids.piece}/usage`,
    `/api/v1/wardrobe/${ids.piece}/pieces`,
    `/api/v1/wardrobe/categories-audit?show_id=${ids.show}`,
    `/api/v1/wardrobe/outfit/${ids.episode}`,
    `/api/v1/wardrobe/outfit-score/${ids.episode}`,
    `/api/v1/wardrobe/slot-coverage?episode_id=${ids.episode}`,
    `/api/v1/wardrobe/outfit-history/${ids.show}`,
    `/api/v1/wardrobe-events/${ids.show}/filter`,
    '/api/v1/wardrobe-brands/pieces/uncovered',
    `/api/v1/shows/${ids.show}/wardrobe`,
    // the library and outfit sets
    '/api/v1/wardrobe-library',
    '/api/v1/wardrobe-library/stats',
    '/api/v1/wardrobe-library/advanced-search',
    '/api/v1/wardrobe-library/suggestions',
    '/api/v1/wardrobe-library/check-duplicates',
    '/api/v1/wardrobe-library/analytics/most-used',
    '/api/v1/wardrobe-library/analytics/never-used',
    `/api/v1/wardrobe-library/for-chapter/${none}`,
    '/api/v1/wardrobe-library/1',
    '/api/v1/wardrobe-library/1/items',
    '/api/v1/wardrobe-library/1/usage',
    '/api/v1/wardrobe-library/1/usage/shows',
    '/api/v1/wardrobe-library/1/usage/timeline',
    '/api/v1/wardrobe-library/1/assignments',
    '/api/v1/outfit-sets',
    '/api/v1/outfit-sets/1',
    // an episode's styling, style sheet and Distribution
    `/api/v1/episodes/${ids.episode}/wardrobe`,
    `/api/v1/episodes/${ids.episode}/outfits`,
    `/api/v1/episodes/${ids.episode}/lookbook`,
    `/api/v1/episodes/${ids.episode}/style-sheet`,
    `/api/v1/episodes/${ids.episode}/style-sheet/export/look`,
    `/api/v1/episodes/${ids.episode}/style-sheet/design/classic/square`,
    `/api/v1/episodes/${ids.episode}/style-sheet/designs-zip/square`,
    `/api/v1/episodes/${ids.episode}/style-sheet/distribution`,
    `/api/v1/episodes/${ids.episode}/wardrobe-defaults`,
    `/api/v1/episodes/${ids.episode}/timeline/wardrobe/current`,
    `/api/v1/shows/${ids.show}/style-designs`,
    // an event's outfit, and a set's matching pieces
    `/api/v1/world/${ids.show}/events/${ids.event}/outfit`,
    `/api/v1/world/${ids.show}/events/${ids.event}/wardrobe-options`,
    `/api/v1/scene-sets/${none}/wardrobe-match`,
    // the lists made from the look
    `/api/v1/episodes/${ids.episode}/todo`,
    `/api/v1/episodes/${ids.episode}/todo/at`,
    `/api/v1/episodes/${ids.episode}/todo/social`,
    `/api/v1/episodes/${ids.episode}/my-little-list`,
    `/api/v1/episodes/${ids.episode}/my-little-list/review`,
  ];

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@wardrobe.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { ...ids, name: `Wardrobe ${tag}`, slug: `wardrobe-${tag}` });
    await models.Episode.create({ id: ids.episode, show_id: ids.show, title: `Wardrobe ${tag}`, episode_number: 1, status: 'draft' });
    await models.Wardrobe.create({
      id: ids.piece, show_id: ids.show, name: `Silk dress ${tag}`, character: 'lala', clothing_category: 'dress',
      brand: 'Maison Belle', coin_cost: 250,
      real_brand: `${MARK}-brand`, real_retailer: `${MARK}-retailer`, real_product_name: `${MARK}-product`,
      real_product_url: `https://shop.test/${MARK}-product`, affiliate_url: `https://aff.test/${MARK}-affiliate`,
      real_price_paid: 4321.09, real_list_price: 5432.1, real_source: 'manual',
    });
  });

  afterAll(async () => {
    await run('DELETE FROM wardrobe WHERE id = :piece', ids);
    await run('DELETE FROM episodes WHERE id = :episode', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    jest.restoreAllMocks();
  });

  const leaks = (res) => {
    const text = JSON.stringify(res.body || {}) + (res.text || '');
    return text.includes(MARK) || text.includes('4321.09') || text.includes('5432.1');
  };

  it('covers every read of the ruling', () => {
    expect(reads()).toHaveLength(48);
  });

  it('nobody signed out reads any of it: 401, and nothing of the piece', async () => {
    for (const path of reads()) {
      const res = await get(null, path);
      expect([path, res.status]).toEqual([path, 401]);
      expect([path, leaks(res)]).toEqual([path, false]);
    }
  });

  it.each(['viewer', 'editor'])('a %s reads none of it: 403, and nothing of the piece', async (who) => {
    for (const path of reads()) {
      const res = await get(who, path);
      expect([path, res.status]).toEqual([path, 403]);
      expect([path, leaks(res)]).toEqual([path, false]);
    }
  });

  it('an ADMIN is refused by none of them', async () => {
    for (const path of reads()) {
      const res = await get('admin', path);
      expect([path, [401, 403].includes(res.status)]).toEqual([path, false]);
    }
  });

  it("an ADMIN reads the piece whole: the list and the piece carry what it really is", async () => {
    const list = await get('admin', `/api/v1/wardrobe?show_id=${ids.show}`);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).toContain(`${MARK}-product`);
    const one = await get('admin', `/api/v1/wardrobe/${ids.piece}`);
    expect(one.status).toBe(200);
    expect(JSON.stringify(one.body)).toContain(`${MARK}-affiliate`);
  });

  it('an ADMIN reads the episode\'s outfit, style sheet and lists', async () => {
    for (const path of [
      `/api/v1/wardrobe/outfit/${ids.episode}`,
      `/api/v1/episodes/${ids.episode}/wardrobe`,
      `/api/v1/episodes/${ids.episode}/lookbook`,
      `/api/v1/episodes/${ids.episode}/style-sheet`,
      `/api/v1/episodes/${ids.episode}/todo`,
    ]) {
      const res = await get('admin', path);
      expect(`${path} ${res.status}`).toBe(`${path} 200`);
    }
  });

  it('the fictional brand list stays a signed-in read: it is not the wardrobe', async () => {
    expect((await get(null, '/api/v1/wardrobe-brands/brands')).status).toBe(401);
    expect([401, 403]).not.toContain((await get('viewer', '/api/v1/wardrobe-brands/brands')).status);
  });

  it('a refused read changes nothing: the piece is as it was', async () => {
    const before = (await models.Wardrobe.findByPk(ids.piece)).toJSON();
    await get('viewer', `/api/v1/wardrobe/${ids.piece}`);
    await get('editor', `/api/v1/wardrobe/outfit/${ids.episode}`);
    expect((await models.Wardrobe.findByPk(ids.piece)).toJSON()).toEqual(before);
    const [[{ n }]] = await run('SELECT COUNT(*)::int AS n FROM episode_wardrobe WHERE episode_id = :episode', ids);
    expect(n).toBe(0);
  });
});

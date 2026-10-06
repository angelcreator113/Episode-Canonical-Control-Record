/**
 * The Event Package's Lala's Look once the event has started an episode
 * (Evoni, 2026-10-06: "wardrobe pieces are not showing"). GET
 * /world/:showId/events/:eventId returns episodeLook: the look locked in the
 * episode's Wardrobe (the one Finalize charges), else pieces chosen there
 * but not locked yet, else the event's own outfit; null before Start Episode.
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

(shouldSkip ? describe.skip : describe)("Event Package: Lala's look from the episode", () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-look', email: 'test@look.dev', name: 'Look Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  async function seed({ started = true, eventOutfit = [] } = {}) {
    const ids = { show: uuid(), ep: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Look ${ids.show.slice(0, 8)}`, slug: `look-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Look episode', 1, 'draft', NOW(), NOW())`, ids);
    const dress = await models.Wardrobe.create({ name: 'Sculpted Linen Dress', clothing_category: 'dress', show_id: ids.show, lock_type: 'coin', coin_cost: 420, is_owned: false });
    const flats = await models.Wardrobe.create({ name: 'Polished Flats', clothing_category: 'shoes', show_id: ids.show, coin_cost: 180, is_owned: true });
    Object.assign(ids, { dress: dress.id, flats: flats.id });
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, prestige, outfit_pieces, created_at, updated_at)
               VALUES (:event, :show, 'Studio Session', :status, :used, 3, CAST(:outfit AS jsonb), NOW(), NOW())`,
      { ...ids, status: started ? 'used' : 'ready', used: started ? ids.ep : null, outfit: JSON.stringify(eventOutfit) });
    return ids;
  }
  const link = (ids, wardrobeId, status) => run(
    `INSERT INTO episode_wardrobe (id, episode_id, wardrobe_id, approval_status, created_at, updated_at)
     VALUES (:id, :ep, :w, :status, NOW(), NOW())`, { id: uuid(), ep: ids.ep, w: wardrobeId, status });
  const getLook = async (ids) => {
    const res = await request(app).get(`/api/v1/world/${ids.show}/events/${ids.event}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body.episodeLook;
  };

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM episode_wardrobe WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show });
      await run(`DELETE FROM wardrobe WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it("the look locked in the episode's Wardrobe, each piece owned or with its cost", async () => {
    const ids = await seed();
    await link(ids, ids.dress, 'approved');
    await link(ids, ids.flats, 'approved');
    const look = await getLook(ids);
    expect(look.state).toBe('locked');
    expect(look.episode_id).toBe(ids.ep);
    expect(look.pieces.map((p) => [p.name, p.is_owned, p.coin_cost])).toEqual([
      ['Sculpted Linen Dress', false, 420],
      ['Polished Flats', true, 180],
    ]);
  });

  it('pieces linked but not locked are "chosen"; a rejected link is left out', async () => {
    const ids = await seed();
    await link(ids, ids.dress, 'pending');
    await link(ids, ids.flats, 'rejected');
    const look = await getLook(ids);
    expect(look.state).toBe('chosen');
    expect(look.pieces.map((p) => p.name)).toEqual(['Sculpted Linen Dress']);
  });

  it("no links: the event's own outfit; nothing anywhere: none", async () => {
    const withOutfit = await seed({ eventOutfit: [{ id: 'snap-1', name: 'Saved Gown', coin_cost: 300, is_owned: false }] });
    expect(await getLook(withOutfit)).toMatchObject({ state: 'event', pieces: [{ name: 'Saved Gown', coin_cost: 300 }] });
    expect(await getLook(await seed())).toMatchObject({ state: 'none', pieces: [] });
  });

  it('before Start Episode there is no episode look', async () => {
    expect(await getLook(await seed({ started: false }))).toBeNull();
  });
});

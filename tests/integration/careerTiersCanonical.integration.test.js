/**
 * Career tiers follow the canonical five (Task #2317): Emerging, Rising,
 * Established, Influential, Elite = 1–5, with reputation bands 0–2, 3–4,
 * 5–6, 7–8 and 9–10 (frontend/src/utils/eventStakes.js CAREER_TIERS).
 *
 * Before: the event PUT mapped elite→4 and an unknown "icon"→5, and had no
 * "influential". Lala's tier used min(5, floor(rep/2)+1), one tier high at
 * reputation 2, 4, 6 and 8.
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
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('career tiers follow the canonical five (#2317)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-career-tiers', email: 'test@career-tiers.dev', name: 'Career Tiers', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  async function seedShow({ reputation = 0 } = {}) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Tiers ${show.slice(0, 8)}`, slug: `tiers-${show.slice(0, 8)}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 0, :reputation, 0, 0, 0, NOW(), NOW())`, { id: uuid(), show, reputation });
    return show;
  }

  async function seedEvent(show) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, status, career_tier, created_at, updated_at)
               VALUES (:id, :show, 'Gala', 'ready', 1, NOW(), NOW())`, { id, show });
    return id;
  }

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const tierOf = async (id) => (await q(`SELECT career_tier FROM world_events WHERE id = :id`, { id }))[0].career_tier;

  it.each([
    ['Emerging', 1], ['rising', 2], ['Established', 3], ['Influential', 4], ['ELITE', 5],
  ])('the event PUT stores "%s" as tier %i', async (label, tier) => {
    const show = await seedShow();
    const id = await seedEvent(show);
    const res = await request(app).put(`/api/v1/world/${show}/events/${id}`).set(auth()).send({ career_tier: label });
    expect(res.status).toBe(200);
    expect(await tierOf(id)).toBe(tier);
  });

  it('"icon" is not a tier: refused, and the stored tier is unchanged', async () => {
    const show = await seedShow();
    const id = await seedEvent(show);
    const res = await request(app).put(`/api/v1/world/${show}/events/${id}`).set(auth()).send({ career_tier: 'icon' });
    expect(res.status).toBe(400);
    expect(await tierOf(id)).toBe(1);
  });

  it.each([
    [0, 1], [1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [6, 3], [7, 4], [8, 4], [9, 5], [10, 5],
  ])('reputation %i gives accessible tier %i', async (reputation, tier) => {
    const show = await seedShow({ reputation });
    const res = await request(app).get(`/api/v1/opportunities/${show}/career-tier`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.career_tier).toBe(tier);
  });
});

/**
 * POST /api/v1/memories/generate-events with replace_existing
 * (eventGeneratorRoute, 2026-11-04).
 *
 * replace_existing used to hard DELETE every world_events row of the show,
 * events already used in episodes and events other tables point at
 * included. Through the real route, with Claude mocked:
 *   - a used event survives, live;
 *   - an unused event an opportunity or an event cost points at survives;
 *   - an unused, unlinked event is soft-deleted (deleted_at set, row kept);
 *   - the generated events are inserted, and the response counts both.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-not-real';

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

const GENERATED = [
  { name: 'Velour Night Salon', event_type: 'gala', event_category: 'industry', description: 'A salon.', prestige: 7, cost_coins: 120, strictness: 6, dress_code: 'black tie', dress_code_keywords: ['satin'] },
  { name: 'Sunday Family Lunch', event_type: 'family_obligation', event_category: 'family', description: 'Lunch.', prestige: 2, cost_coins: 0, strictness: 2, dress_code: 'smart casual', dress_code_keywords: [] },
];

(shouldSkip ? describe.skip : describe)('generate-events replace_existing keeps used and linked events', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-evgen', email: 'test@evgen.dev', name: 'EvGen Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(GENERATED) }] });
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM event_costs WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`DELETE FROM opportunities WHERE show_id = :show`, { show });
      await run(`UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  async function seedEvent(ids, key, name, extra = {}) {
    ids[key] = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, cost_coins, status, times_used, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', 5, 0, :status, :times_used, NOW(), NOW())`,
    { id: ids[key], show: ids.show, name, status: extra.status || 'ready', times_used: extra.times_used ?? 0 });
  }

  async function seed() {
    const ids = { show: uuid(), ep: uuid(), opp: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `EvGen ${ids.show.slice(0, 8)}`, slug: `evgen-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Used episode', 1, 'draft', NOW(), NOW())`, ids);

    await seedEvent(ids, 'used', 'Used Gala');
    await run(`UPDATE world_events SET used_in_episode_id = :ep, status = 'used', times_used = 1 WHERE id = :used`, ids);
    await seedEvent(ids, 'oppLinked', 'Opportunity Event');
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, event_id, created_at, updated_at)
               VALUES (:opp, :show, 'Linked opp', 'brand_deal', :oppLinked, NOW(), NOW())`, ids);
    await seedEvent(ids, 'costLinked', 'Costed Event');
    await run(`INSERT INTO event_costs (event_id, kind) VALUES (:costLinked, 'travel')`, ids);
    await seedEvent(ids, 'free1', 'Spare Event One');
    await seedEvent(ids, 'free2', 'Spare Event Two');
    return ids;
  }

  const generate = (body) => request(app).post('/api/v1/memories/generate-events')
    .set('Authorization', `Bearer ${token}`).send(body);

  it('soft-deletes only unused, unlinked events and inserts the new ones', async () => {
    const ids = await seed();

    const res = await generate({ show_id: ids.show, replace_existing: true });
    expect(res.status).toBe(201);
    expect(res.body.generated).toBe(2);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    expect(res.body.replaced.soft_deleted).toBe(2);
    expect(res.body.replaced.soft_deleted_ids.sort()).toEqual([ids.free1, ids.free2].sort());
    expect(res.body.replaced.kept).toBe(3);
    const kept = Object.fromEntries(res.body.replaced.kept_events.map(e => [e.id, e]));
    expect(kept[ids.used]).toMatchObject({ name: 'Used Gala', used: true });
    expect(kept[ids.oppLinked]).toMatchObject({ used: false, linked_by: ['opportunities'] });
    expect(kept[ids.costLinked]).toMatchObject({ used: false, linked_by: ['event_costs'] });

    const rows = await q(`SELECT id, name, deleted_at, used_in_episode_id FROM world_events WHERE show_id = :show`, ids);
    const byId = Object.fromEntries(rows.map(r => [r.id, r]));

    // The used and the linked events are live and untouched.
    expect(byId[ids.used].deleted_at).toBeNull();
    expect(byId[ids.used].used_in_episode_id).toBe(ids.ep);
    expect(byId[ids.oppLinked].deleted_at).toBeNull();
    expect(byId[ids.costLinked].deleted_at).toBeNull();
    const [opp] = await q(`SELECT event_id FROM opportunities WHERE id = :opp`, ids);
    expect(opp.event_id).toBe(ids.oppLinked);
    expect(await q(`SELECT id FROM event_costs WHERE event_id = :costLinked`, ids)).toHaveLength(1);

    // The spare events are soft-deleted: the rows are still there.
    expect(byId[ids.free1]).toBeDefined();
    expect(byId[ids.free1].deleted_at).not.toBeNull();
    expect(byId[ids.free2].deleted_at).not.toBeNull();

    // The generated events are inserted, live.
    const fresh = rows.filter(r => GENERATED.some(g => g.name === r.name));
    expect(fresh).toHaveLength(2);
    expect(fresh.every(r => r.deleted_at === null)).toBe(true);
    expect(rows).toHaveLength(7);
  });

  it('without replace_existing removes nothing and reports no replacement', async () => {
    const ids = await seed();

    const res = await generate({ show_id: ids.show });
    expect(res.status).toBe(201);
    expect(res.body.replaced).toBeUndefined();

    const [{ live, gone }] = await q(
      `SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS live,
              COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS gone
         FROM world_events WHERE show_id = :show`, ids);
    expect(live).toBe(7);
    expect(gone).toBe(0);
  });

  it('rolls back the soft-delete when an insert fails', async () => {
    const ids = await seed();
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify([{ ...GENERATED[0], prestige: 'not-a-number' }]) }] });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await generate({ show_id: ids.show, replace_existing: true });
    expect(res.status).toBe(500);

    const [{ gone }] = await q(
      `SELECT COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS gone FROM world_events WHERE show_id = :show`, ids);
    expect(gone).toBe(0);
  });
});

/**
 * Episode completion writes the episode's outcome (Cultural memory) and
 * Lala's state snapshot to franchise_knowledge. They carried no show_id, so
 * every show's Culture tab listed every show's moments, and one show's
 * snapshot superseded another's (wiring map,
 * docs/reads/2026-10-06-lalaverse-wiring-map.md, fix-list item 15).
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { completeEpisode } = require('../../src/services/episodeCompletionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Episode completion memory is the show\'s', () => {
  const shows = [];
  let token;

  async function seed(name) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST(:metadata AS jsonb), NOW(), NOW())`,
    { show, name, slug: `mem-${show.slice(0, 8)}`, metadata: JSON.stringify({ starting_balance: 1000 }) });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, :title, 1, 'draft', NOW(), NOW())`, { ep, show, title: `${name} Pilot` });
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, prestige, created_at, updated_at)
               VALUES (:id, :show, 'Gala', 'used', :ep, 0, 5, NOW(), NOW())`, { id: uuid(), show, ep });
    return { show, ep };
  }

  const entries = (show) => q(`SELECT category, scope, show_id, status FROM franchise_knowledge
                                WHERE source_document = 'episode-completion' AND show_id = :show`, { show });

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-memory-show', email: 'test@memory-show.dev', name: 'Memory Show Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const show of shows) {
      await run(`DELETE FROM franchise_knowledge WHERE show_id = :show`, { show });
      for (const t of ['feed_posts', 'financial_transactions', 'character_state_history', 'character_state', 'world_events', 'episodes']) {
        await run(`DELETE FROM ${t} WHERE show_id = :show`, { show });
      }
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('each show\'s entries carry its show_id, and one show\'s snapshot does not retire another\'s', async () => {
    const a = await seed('Show A');
    const b = await seed('Show B');

    await completeEpisode(a.ep, a.show, sequelize);
    await completeEpisode(b.ep, b.show, sequelize);

    const rowsA = await entries(a.show);
    const rowsB = await entries(b.show);
    for (const rows of [rowsA, rowsB]) {
      expect(rows.map((r) => r.category).sort()).toEqual(['character', 'narrative']);
      expect(rows.every((r) => r.scope === 'show')).toBe(true);
    }
    // Show B's completion superseded no snapshot of Show A's.
    expect(rowsA.find((r) => r.category === 'character').status).toBe('active');
    expect(rowsB.find((r) => r.category === 'character').status).toBe('active');
  });

  it('the Culture tab\'s read for one show lists its moments and not the other show\'s', async () => {
    const [a, b] = shows;
    const res = await request(app)
      .get(`/api/v1/franchise-brain/entries?category=narrative&status=active&show_id=${a}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const mine = res.body.entries.filter((e) => e.source_document === 'episode-completion');
    expect(mine.some((e) => e.show_id === a)).toBe(true);
    expect(mine.some((e) => e.show_id === b)).toBe(false);
  });
});

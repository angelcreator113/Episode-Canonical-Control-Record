/**
 * B1 (Evoni, 2026-10-02): Start Episode's home set is "only this show's
 * HOME_BASE sets, in a defined order (until L3 replaces it)". Before, it was
 * `SELECT … WHERE scene_type = 'HOME_BASE' … LIMIT 1`: any show's, in no
 * order. Now: this show's, oldest first.
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
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Start Episode: the home set is this show\'s (B1)', () => {
  const show = uuid(); const other = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const homeSet = async (showId, name, ageDays) => {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, created_at, updated_at)
               VALUES (:id, :name, 'HOME_BASE', :showId, NOW() - (:ageDays || ' days')::interval, NOW())`,
    { id, name, showId, ageDays: String(ageDays) });
    return id;
  };

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-home-b1', email: 'user@home-b1.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const id of [show, other]) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`,
        { id, name: `B1 ${id.slice(0, 8)}`, slug: `b1-${id.slice(0, 8)}` });
    }
    await models.CharacterState.create({ show_id: show, character_key: 'lala', coins: 1000, reputation: 3 });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const shows = [show, other];
    const q = (sql) => sequelize.query(sql, { replacements: { shows } });
    await q('DELETE FROM scene_plans WHERE episode_id IN (SELECT id FROM episodes WHERE show_id IN (:shows))').catch(() => {});
    await q('DELETE FROM scene_set_episodes WHERE episode_id IN (SELECT id FROM episodes WHERE show_id IN (:shows))').catch(() => {});
    for (const t of ['episode_spending_lines', 'episode_briefs', 'episode_todo_lists']) {
      await q(`DELETE FROM ${t} WHERE episode_id IN (SELECT id FROM episodes WHERE show_id IN (:shows))`).catch(() => {});
    }
    for (const t of ['feed_posts', 'financial_transactions', 'character_state_history', 'character_state']) {
      await q(`DELETE FROM ${t} WHERE show_id IN (:shows)`).catch(() => {});
    }
    await q('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id IN (:shows)');
    await q('DELETE FROM episodes WHERE show_id IN (:shows)');
    await q('DELETE FROM world_events WHERE show_id IN (:shows)');
    await q('DELETE FROM scene_sets WHERE show_id IN (:shows)');
    await q('DELETE FROM shows WHERE id IN (:shows)');
    await sequelize.close();
  });

  it('takes this show\'s oldest HOME_BASE set, never another show\'s', async () => {
    await homeSet(other, 'Another show\'s flat', 30); // the oldest of all
    const mine = await homeSet(show, 'Lala\'s apartment', 10);
    await homeSet(show, 'Lala\'s new place', 1);
    const event = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, created_at, updated_at)
               VALUES (:event, :show, 'Gala', 'invite', 'ready', 5, NOW(), NOW())`, { event, show });

    const res = await auth(request(app).post(`/api/v1/world/${show}/events/${event}/generate-episode`)).send({ draft_script: false });

    expect(res.status).toBe(201);
    const ep = res.body.data?.episode?.id || res.body.episode?.id;
    const homes = await rows(`SELECT DISTINCT scene_set_id FROM scene_plans WHERE episode_id = :ep AND scene_set_id IS NOT NULL`, { ep });
    expect(homes.map((r) => r.scene_set_id)).toEqual([mine]);
  });
});

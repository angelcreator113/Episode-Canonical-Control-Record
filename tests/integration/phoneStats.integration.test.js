/**
 * The stats panel on Lala's Phone home screen (Task #3164), against the test
 * database: coins, reputation and influence as of a beat, and followers once
 * The Pulse has her numbers.
 * - An episode counts once it completes (its "after", n × 10 + 7): a beat
 *   during episode N sees the episodes before N, never N's or a later one's.
 * - Coins: the ledger balance less the episodes that don't count yet; rows
 *   on no episode count from the start (Evoni, 2026-10-14); a deleted
 *   episode's rows never count.
 * - Reputation and influence: the latest snapshot of an episode that counts,
 *   else the value before the first one that doesn't, else the state now.
 * - Followers: her accepted count at the beat; null with none.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { statsAt } = require('../../src/services/phoneStats');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Phone stats panel (Task #3164)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), bare: uuid(), ep1: uuid(), ep2: uuid(), ep3: uuid(), gone: uuid() };
  let lala;
  let token;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-phone-stats', email: 'ed@phone-stats.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    for (const [id, name] of [[ids.show, 'Stats'], [ids.bare, 'Bare']]) {
      await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())',
        { id, name: `${name} ${tag}`, slug: `${name.toLowerCase()}-${tag}` });
    }
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
      (:ep1, :show, 'One', 1, 'published', NOW(), NOW()), (:ep2, :show, 'Two', 2, 'published', NOW(), NOW()),
      (:ep3, :show, 'Three', 3, 'published', NOW(), NOW())`, ids);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, deleted_at, created_at, updated_at)
               VALUES (:gone, :show, 'Gone', 4, 'draft', NOW(), NOW(), NOW())`, ids);

    // The ledger: a seed and a purchase on no episode, then each episode's rows; a deleted episode's row.
    const tx = (episode, type, amount) => run(
      `INSERT INTO financial_transactions (id, show_id, episode_id, type, category, amount, status)
       VALUES (:id, :show, :episode, :type, 'test', :amount, 'executed')`,
      { id: uuid(), show: ids.show, episode, type, amount });
    await tx(null, 'income', 500);
    await tx(null, 'expense', 50);
    await tx(ids.ep1, 'income', 200);
    await tx(ids.ep2, 'expense', 100);
    await tx(ids.ep3, 'reward', 1000);
    await tx(ids.gone, 'income', 999);

    // Reputation and influence: the state now and each episode's snapshot.
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1550, 7, 3, 6, 0, NOW(), NOW())`, { id: uuid(), show: ids.show });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 0, 4, 3, 9, 0, NOW(), NOW())`, { id: uuid(), show: ids.bare });
    const history = (episode, deltas, after, minutes) => run(
      `INSERT INTO character_state_history (id, show_id, character_key, episode_id, source, deltas_json, state_after_json, created_at)
       VALUES (:id, :show, 'lala', :episode, 'computed', CAST(:deltas AS jsonb), CAST(:after AS jsonb), NOW() + make_interval(mins => :minutes))`,
      { id: uuid(), show: ids.show, episode, deltas: JSON.stringify(deltas), after: after === null ? null : JSON.stringify(after), minutes });
    await history(ids.ep1, { reputation: 1, influence: 1 }, { reputation: 3, influence: 2 }, 1);
    await history(ids.ep2, { reputation: 2, influence: 2 }, { reputation: 5, influence: 4 }, 2);
    await history(ids.ep2, { followers: 900 }, null, 3);              // no snapshot: never read
    await history(ids.ep3, { reputation: 2, influence: 2 }, { reputation: 7, influence: 6 }, 4);

    // Followers: her accepted counts in story order; a proposed one never counts.
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', 'Lala', NOW(), NOW()) RETURNING id`, { handle: `lala-stats-${tag}` });
    lala = row.id;
    await models.PulseFollower.bulkCreate([
      { show_id: ids.show, social_profile_id: lala, story_order: 0, change: 50000, count_after: 50000, cause: 'start', status: 'accepted', decided_at: new Date() },
      { show_id: ids.show, social_profile_id: lala, story_order: 27, change: 12500, count_after: 62500, cause: 'episode', cause_id: ids.ep2, status: 'accepted', decided_at: new Date() },
      { show_id: ids.show, social_profile_id: lala, story_order: 37, change: 2500, count_after: 65000, cause: 'episode', cause_id: ids.ep3, status: 'proposed' },
    ]);
  });

  afterAll(async () => {
    for (const show of [ids.show, ids.bare]) {
      await run('DELETE FROM pulse_followers WHERE show_id = :show', { show });
      await run('DELETE FROM character_state_history WHERE show_id = :show', { show });
      await run('DELETE FROM character_state WHERE show_id = :show', { show });
      await run('DELETE FROM financial_transactions WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    if (lala) await run('DELETE FROM social_profiles WHERE id = :id', { id: lala });
  });

  const at = (s) => statsAt(models, ids.show, s, { lalaProfileId: lala });

  test('coins: the episodes before the beat, with rows on no episode from the start; never a later or deleted episode', async () => {
    expect((await at(15)).coins).toBe(450);    // during Ep 1: the seed less the purchase outside an episode
    expect((await at(25)).coins).toBe(650);    // during Ep 2: + Ep 1
    expect((await at(27)).coins).toBe(550);    // after Ep 2: + Ep 2
    expect((await at(35)).coins).toBe(550);    // during Ep 3: not Ep 3's reward yet
    expect((await at(undefined)).coins).toBe(1550);
  });

  test('reputation and influence: the last snapshot before the beat, else before the first episode, else now', async () => {
    expect(await at(15)).toMatchObject({ reputation: 2, influence: 1, scale: 10 });   // before Ep 1: its snapshot less its change
    expect(await at(25)).toMatchObject({ reputation: 3, influence: 2 });
    expect(await at(35)).toMatchObject({ reputation: 5, influence: 4 });
    expect(await at(undefined)).toMatchObject({ reputation: 7, influence: 6 });
    // No history: the state now, at any beat.
    expect(await statsAt(models, ids.bare, 15, { lalaProfileId: null })).toMatchObject({ reputation: 4, influence: 9, followers: null });
  });

  test('followers: her accepted count at the beat; null before her numbers exist', async () => {
    expect((await at(15)).followers).toEqual(expect.objectContaining({ count: 50000 }));
    expect((await at(35)).followers).toEqual(expect.objectContaining({ count: 62500 }));   // the proposed 65000 never shows
    expect((await at(undefined)).followers.count).toBe(62500);
    expect((await statsAt(models, ids.bare, 15, { lalaProfileId: lala })).followers).toBeNull();
  });

  test('the route: auth, the beat as a story order or ep:<n>:<phase>, and a bad `at` is a 400', async () => {
    const url = `/api/v1/shows/${ids.show}/phone-stats`;
    expect((await request(app).get(url)).status).toBe(401);
    const auth = (q) => request(app).get(`${url}${q}`).set('Authorization', `Bearer ${token}`);
    const byOrder = await auth('?at=25');
    expect(byOrder.status).toBe(200);
    expect(byOrder.body.data).toMatchObject({ at: 25, coins: 650, reputation: 3, influence: 2, scale: 10 });
    expect((await auth('?at=ep:2:during_episode')).body.data).toMatchObject({ at: 25, coins: 650 });
    expect((await auth('')).body.data).toMatchObject({ at: null, coins: 1550, reputation: 7, influence: 6 });
    expect((await auth('?at=soon')).status).toBe(400);
  });
});

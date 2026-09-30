/**
 * Complete and Finalize recompute character_state.coins from the ledger
 * inside D2's transaction, and refuse to take Lala below zero
 * (docs/EVENT_EPISODE_FLOW.md §8(x) D1–D2, §8(y) Q6, Q8;
 * docs/COINS_LEDGER_CACHE_DESIGN.md §6.3; Task #2247).
 *
 * Before: Complete moved coins by its own delta, which left out milestone
 * payouts and the event reward, and a Finalize run alone booked the ledger
 * without touching coins, so the two balances drifted apart.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { completeEpisode } = require('../../src/services/episodeCompletionService');
const { finalizeEpisodeFinancials, getCurrentBalance } = require('../../src/services/financialTransactionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Complete and Finalize sync coins from the ledger (D1)', () => {
  const shows = [];
  let token;

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-coin-sync', email: 'test@coin-sync.dev', name: 'Coin Sync Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  /**
   * A show with Lala's 'lala' row (coins 500, the old default, so a sync is
   * visible) and `episodes` draft episodes, each started from its own event.
   */
  async function seed({ startingBalance = 1000, goals, episodes = 1, cost = 100, isPaid = false, payment = 0 } = {}) {
    const show = uuid();
    shows.push(show);
    const metadata = { starting_balance: startingBalance, ...(goals ? { financial_goals: goals } : {}) };
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST(:metadata AS jsonb), NOW(), NOW())`,
      { show, name: `Sync ${show.slice(0, 8)}`, slug: `sync-${show.slice(0, 8)}`, metadata: JSON.stringify(metadata) });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 500, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    const eps = [];
    for (let n = 1; n <= episodes; n += 1) {
      const ep = uuid();
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
                 VALUES (:ep, :show, :title, :n, 'draft', NOW(), NOW())`, { ep, show, title: `Episode ${n}`, n });
      await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, payment_amount,
                   prestige, created_at, updated_at)
                 VALUES (:id, :show, :name, 'used', :ep, :cost, :isPaid, :payment, 5, NOW(), NOW())`,
        { id: uuid(), show, ep, name: `Gala ${n}`, cost, isPaid, payment });
      eps.push(ep);
    }
    return { show, eps };
  }

  const coins = async (show) => (await q(`SELECT coins FROM character_state WHERE show_id = :show AND character_key = 'lala'`, { show }))[0].coins;
  const ledgerRows = (show) => q(`SELECT category FROM financial_transactions WHERE show_id = :show AND deleted_at IS NULL`, { show });
  const count = (rows, category) => rows.filter((r) => r.category === category).length;
  const expectCoinsMatchLedger = async (show) => expect(await coins(show)).toBe(await getCurrentBalance(sequelize, show));

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    // Feed posts run after commit, without being awaited (Task #2252).
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const show of shows) {
      await run(`DELETE FROM feed_posts WHERE show_id = :show`, { show });
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM character_state_history WHERE show_id = :show`, { show });
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('a Finalize run alone moves coins with the ledger, and the later Complete keeps them equal', async () => {
    const { show, eps: [ep] } = await seed();

    const finalized = await finalizeEpisodeFinancials(ep, show, sequelize);
    await expectCoinsMatchLedger(show);
    expect(finalized.coins_after).toBe(await coins(show));
    expect(await coins(show)).toBeLessThan(1000); // entry cost and extras booked

    const completed = await completeEpisode(ep, show, sequelize);
    await expectCoinsMatchLedger(show);
    expect(completed.new_state.coins).toBe(await coins(show));
    expect(count(await ledgerRows(show), 'event_entry')).toBe(1);
    expect(count(await ledgerRows(show), 'seed')).toBe(1);
  });

  it('Finalize twice and Complete twice: every row is booked once and coins move once', async () => {
    const { show, eps: [ep] } = await seed();

    await finalizeEpisodeFinancials(ep, show, sequelize);
    const again = await finalizeEpisodeFinancials(ep, show, sequelize);
    await completeEpisode(ep, show, sequelize);
    const afterFirstComplete = await coins(show);
    const second = await completeEpisode(ep, show, sequelize);

    expect(again.already_finalized).toBe(true);
    expect(second.already_completed).toBe(true);
    const rows = await ledgerRows(show);
    expect(count(rows, 'event_entry')).toBe(1);
    // The tier reward is retired for every completion (Q12; deal build PR 5).
    expect(count(rows, 'tier_reward')).toBe(0);
    expect(await coins(show)).toBe(afterFirstComplete);
    await expectCoinsMatchLedger(show);
  });

  it('a milestone payout reaches the coins, not only the ledger', async () => {
    // Paid 600, so finalize's running balance crosses 1200 from 1000.
    const goals = [{ id: 'g1', threshold: 1200, reward_coins: 60, label: 'Test milestone', triggered_at: null }];
    const { show, eps: [ep] } = await seed({ goals, cost: 0, isPaid: true, payment: 600 });

    await completeEpisode(ep, show, sequelize);

    expect(count(await ledgerRows(show), 'milestone')).toBe(1);
    await expectCoinsMatchLedger(show);
  });

  it('a Complete that would take Lala below zero is refused, and every row rolls back', async () => {
    const { show, eps: [ep] } = await seed({ startingBalance: 50, cost: 400 });

    await expect(completeEpisode(ep, show, sequelize)).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS', have: 50 });

    expect(await ledgerRows(show)).toEqual([]); // the seed rolled back too
    expect(await coins(show)).toBe(500);
    const [{ evaluation_status: status }] = await q(`SELECT evaluation_status FROM episodes WHERE id = :ep`, { ep });
    expect(status).not.toBe('accepted');
  });

  it('a Finalize that would take Lala below zero is refused with the same 400 (§8(y) Q6), and writes nothing', async () => {
    const { show, eps: [ep] } = await seed({ startingBalance: 50, cost: 400 });

    const res = await request(app)
      .post(`/api/v1/world/${show}/episodes/${ep}/finalize-financials`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 'INSUFFICIENT_COINS', have: 50 });
    expect(await ledgerRows(show)).toEqual([]);
    expect(await coins(show)).toBe(500);
  });

  it("the next episode starts from the last one's ending balance; nothing resets or refills (§8(y) Q8)", async () => {
    const { show, eps: [ep1, ep2] } = await seed({ episodes: 2 });

    await completeEpisode(ep1, show, sequelize);
    const endOfEpisode1 = await coins(show);
    const second = await completeEpisode(ep2, show, sequelize);

    expect(await coins(show)).toBe(endOfEpisode1 + second.stat_deltas.coins);
    expect(count(await ledgerRows(show), 'seed')).toBe(1);
    await expectCoinsMatchLedger(show);
  });
});

/**
 * Finalize's milestone and feed tail inside D2's transaction (Task #2252).
 *
 * 1. checkMilestones wrote the goal's slug id ('rising-star') into
 *    financial_transactions.source_id, a UUID column. Outside a transaction
 *    the insert failed silently and the payout was never booked; inside
 *    Finalize's transaction (§8(x) D2) it failed the whole finalize.
 * 2. The feed posts (milestone reached, big spend >= 2000) ran in a savepoint
 *    of that transaction. resolveLalaProfile's query fails on this schema
 *    (social_profiles has no show_id) and the feed writers swallow the
 *    error, so the transaction was left aborted: a standalone Finalize's
 *    COMMIT silently rolled every row back while reporting success, and
 *    Complete failed on its next statement. The posts now run after commit.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { finalizeEpisodeFinancials } = require('../../src/services/financialTransactionService');
const { completeEpisode } = require('../../src/services/episodeCompletionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)("finalize's milestone and feed tail (Task #2252)", () => {
  const shows = [];

  async function seed({ metadata, cost = 0, isPaid = false, payment = 0 }) {
    const ids = { show: uuid(), ep: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST(:metadata AS jsonb), NOW(), NOW())`,
      { ...ids, name: `Tail ${ids.show.slice(0, 8)}`, slug: `tail-${ids.show.slice(0, 8)}`, metadata: JSON.stringify(metadata) });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Tail episode', 1, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, payment_amount,
                 prestige, created_at, updated_at)
               VALUES (:event, :show, 'Gala', 'used', :ep, :cost, :isPaid, :payment, 5, NOW(), NOW())`,
      { ...ids, cost, isPaid, payment });
    return ids;
  }

  const rows = (ids) => q(
    `SELECT category, type, amount::float AS amount, source_id, metadata FROM financial_transactions WHERE show_id = :show`, ids);
  // Posts run after commit, without being awaited by the caller.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await settle();
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

  it('a finalize that crosses a slug-id goal books the payout, with the id in metadata', async () => {
    // Starts at 1000; a paid 600 event crosses the 1200 goal.
    const ids = await seed({
      metadata: {
        starting_balance: 1000,
        financial_goals: [{ id: 'first-big-week', threshold: 1200, reward_coins: 60, label: 'First big week', triggered_at: null }],
      },
      isPaid: true,
      payment: 600,
    });

    const result = await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);

    expect(result.milestones_triggered).toHaveLength(1);
    const booked = await rows(ids);
    expect(booked.filter((r) => r.category === 'event_payment')).toHaveLength(1);
    const milestone = booked.filter((r) => r.category === 'milestone');
    expect(milestone).toHaveLength(1);
    expect(milestone[0]).toMatchObject({ type: 'reward', amount: 60, source_id: null });
    expect(milestone[0].metadata.goal_id).toBe('first-big-week');
  });

  it('a standalone finalize with a big spend commits its rows (it used to roll back while reporting success)', async () => {
    const ids = await seed({ metadata: { starting_balance: 5000 }, cost: 2500 });

    await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);

    expect((await rows(ids)).filter((r) => r.category === 'event_entry')).toHaveLength(1);
  });

  it('a Complete with a big spend completes (it used to fail on the aborted transaction)', async () => {
    const ids = await seed({ metadata: { starting_balance: 5000 }, cost: 2500 });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 5000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show: ids.show });

    const result = await completeEpisode(ids.ep, ids.show, sequelize);

    expect(result.already_completed).toBeUndefined();
    expect((await rows(ids)).filter((r) => r.category === 'event_entry')).toHaveLength(1);
    const [{ evaluation_status: status }] = await q(`SELECT evaluation_status FROM episodes WHERE id = :ep`, ids);
    expect(status).toBe('accepted');
  });
});

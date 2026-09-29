/**
 * Finalize and Complete run in one database transaction and are idempotent:
 * a retry never doubles rewards and never leaves a half-finished state
 * (docs/EVENT_EPISODE_FLOW.md §8(x) D2; Task #2228).
 *
 * Before: neither ran in a transaction. A completion that failed after
 * finalize left its ledger rows and coin change behind; the retry then found
 * the episode "already finalized" and inserted the tier reward again. Two
 * concurrent calls could both pass the checks and book everything twice.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { completeEpisode } = require('../../src/services/episodeCompletionService');
const { finalizeEpisodeFinancials } = require('../../src/services/financialTransactionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('finalize and complete are transactional and idempotent (§8(x) D2)', () => {
  const shows = [];

  // A draft episode started from an unpaid event (entry 100), and Lala with
  // 1000 coins.
  async function seed() {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), state: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Tx show ${ids.show.slice(0, 8)}`, slug: `txf-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Tx episode', 1, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, payment_amount,
                 prestige, created_at, updated_at)
               VALUES (:event, :show, 'Tx Gala', 'used', :ep, 100, false, 0, 5, NOW(), NOW())`, ids);
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:state, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, ids);
    return ids;
  }

  const ledger = (ids) => q(
    `SELECT category, amount::float AS amount FROM financial_transactions
      WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY category`, ids);
  const coins = async (ids) => (await q(`SELECT coins FROM character_state WHERE id = :state`, ids))[0].coins;
  const status = async (ids) => (await q(`SELECT evaluation_status FROM episodes WHERE id = :ep`, ids))[0].evaluation_status;
  const count = (rows, category) => rows.filter((r) => r.category === category).length;

  // Makes the first statement matching `re` fail, once.
  function failOnce(re, message) {
    const original = sequelize.query.bind(sequelize);
    let failed = false;
    return jest.spyOn(sequelize, 'query').mockImplementation((sql, ...rest) => {
      const text = typeof sql === 'string' ? sql : sql?.query || '';
      if (!failed && re.test(text)) {
        failed = true;
        return Promise.reject(new Error(message));
      }
      return original(sql, ...rest);
    });
  }

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM character_state_history WHERE show_id = :show`, { show }).catch((err) => console.error('cleanup history:', err.message));
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('a completion that fails after finalize leaves nothing behind, and the retry books everything once', async () => {
    const ids = await seed();
    const spy = failOnce(/UPDATE episodes SET evaluation_json/, 'injected failure saving the evaluation');

    await expect(completeEpisode(ids.ep, ids.show, sequelize)).rejects.toThrow('injected failure saving the evaluation');
    spy.mockRestore();

    // Nothing from the failed attempt survives.
    expect(await ledger(ids)).toEqual([]);
    expect(await coins(ids)).toBe(1000);
    expect(await status(ids)).not.toBe('accepted');

    const result = await completeEpisode(ids.ep, ids.show, sequelize);

    const rows = await ledger(ids);
    expect(count(rows, 'event_entry')).toBe(1);
    expect(count(rows, 'tier_reward')).toBe(1);
    expect(await status(ids)).toBe('accepted');
    expect(await coins(ids)).toBe(1000 + result.stat_deltas.coins);
  });

  it('two completes at once: one completes, the other finds it done, and nothing is booked twice', async () => {
    const ids = await seed();

    const results = await Promise.all([
      completeEpisode(ids.ep, ids.show, sequelize),
      completeEpisode(ids.ep, ids.show, sequelize),
    ]);

    const done = results.filter((r) => !r.already_completed);
    expect(done).toHaveLength(1);
    expect(results.filter((r) => r.already_completed)).toHaveLength(1);
    const rows = await ledger(ids);
    expect(count(rows, 'event_entry')).toBe(1);
    expect(count(rows, 'tier_reward')).toBe(1);
    expect(await coins(ids)).toBe(1000 + done[0].stat_deltas.coins);
  });

  it('two standalone finalizes at once book the episode once', async () => {
    const ids = await seed();

    const results = await Promise.all([
      finalizeEpisodeFinancials(ids.ep, ids.show, sequelize),
      finalizeEpisodeFinancials(ids.ep, ids.show, sequelize),
    ]);

    expect(results.filter((r) => r.already_finalized)).toHaveLength(1);
    expect(count(await ledger(ids), 'event_entry')).toBe(1);
  });

  it('a finalize that fails part-way writes no ledger rows', async () => {
    const ids = await seed();
    const spy = failOnce(/UPDATE episodes SET total_income/, 'injected failure saving the totals');

    await expect(finalizeEpisodeFinancials(ids.ep, ids.show, sequelize)).rejects.toThrow('injected failure saving the totals');
    spy.mockRestore();

    expect(await ledger(ids)).toEqual([]);
    const retry = await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
    expect(retry.already_finalized).toBeUndefined();
    expect(count(await ledger(ids), 'event_entry')).toBe(1);
  });
});

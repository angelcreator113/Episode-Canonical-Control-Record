/**
 * Complete gates the paid bonus (tier_paid_bonus, slay 50 / pass 25) on the
 * normalised entry cost, the rule the financial forecast uses, not on raw
 * cost_coins (Task #2313; docs/DEAL_DESIGN.md §1.1).
 *
 * A paid event is never charged its entry cost (normalizePaidFreeFlags), so
 * it earns no paid bonus even when cost_coins > 0. The tier is forced to
 * SLAY by wrapping the real evaluate(); the ledger path is real.
 */
jest.unmock('uuid');

jest.mock('../../src/utils/evaluationFormula', () => {
  const actual = jest.requireActual('../../src/utils/evaluationFormula');
  return { ...actual, evaluate: (...args) => ({ ...actual.evaluate(...args), tier_final: 'slay' }) };
});

const crypto = require('crypto');
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

(shouldSkip ? describe.skip : describe)('Complete: the paid bonus follows the normalised entry cost (#2313)', () => {
  const shows = [];

  async function seed({ cost, isPaid, payment }) {
    const show = uuid();
    const ep = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST(:metadata AS jsonb), NOW(), NOW())`,
      { show, name: `Bonus ${show.slice(0, 8)}`, slug: `bonus-${show.slice(0, 8)}`, metadata: JSON.stringify({ starting_balance: 1000 }) });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', 1, 'draft', NOW(), NOW())`, { ep, show });
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, payment_amount,
                 prestige, created_at, updated_at)
               VALUES (:id, :show, 'Gala', 'used', :ep, :cost, :isPaid, :payment, 5, NOW(), NOW())`,
      { id: uuid(), show, ep, cost, isPaid, payment });
    return { show, ep };
  }

  const bonusRows = (show) => q(
    `SELECT amount FROM financial_transactions WHERE show_id = :show AND category = 'tier_paid_bonus' AND deleted_at IS NULL`,
    { show }
  );

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200)); // feed posts run after commit
    for (const show of shows) {
      for (const t of ['feed_posts', 'financial_transactions', 'character_state_history', 'character_state', 'world_events', 'episodes']) {
        await run(`DELETE FROM ${t} WHERE show_id = :show`, { show }).catch((err) => console.warn(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('a paid event with cost_coins > 0 gets no paid bonus (its entry cost is not charged)', async () => {
    const { show, ep } = await seed({ cost: 300, isPaid: true, payment: 800 });
    await completeEpisode(ep, show, sequelize);
    const [tier] = await q(`SELECT amount FROM financial_transactions WHERE show_id = :show AND category = 'tier_reward'`, { show });
    expect(Number(tier.amount)).toBe(150); // SLAY
    expect(await bonusRows(show)).toEqual([]);
  });

  it('an unpaid event with an entry cost still gets the slay bonus of 50', async () => {
    const { show, ep } = await seed({ cost: 300, isPaid: false, payment: 0 });
    await completeEpisode(ep, show, sequelize);
    expect((await bonusRows(show)).map((r) => Number(r.amount))).toEqual([50]);
  });

  it('an unpaid event with no entry cost gets no paid bonus', async () => {
    const { show, ep } = await seed({ cost: 0, isPaid: false, payment: 0 });
    await completeEpisode(ep, show, sequelize);
    expect(await bonusRows(show)).toEqual([]);
  });
});

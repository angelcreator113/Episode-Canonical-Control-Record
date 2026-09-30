/**
 * A SLAY pays no generic coins (deal build PR 5). The tier reward, the paid
 * bonus (tier_paid_bonus, which Task #2313 had gated on the normalised
 * entry cost) and the event reward are retired for every completion: Q12,
 * EVENT_EPISODE_FLOW.md §8(cc), "A SLAY does not automatically create Prime
 * Coins … The generic tier reward (+150/+75/+25/−25) is retired for all
 * completions", with "tier_paid_bonus retires too (Q12)" and "event_reward
 * retires with the tier reward". A deal's contractual bonus is paid only
 * when its terms name the tier reached.
 *
 * The tier is forced to SLAY by wrapping the real evaluate(); the ledger
 * path is real.
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

(shouldSkip ? describe.skip : describe)('Complete at SLAY: no generic coins; a deal bonus only by its terms (deal build PR 5)', () => {
  const shows = [];

  async function seed({ cost, isPaid, payment, rewards = null, dealType = null, bonusTerms = null, appearanceFee = null }) {
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
                 rewards, deal_type, bonus_terms, appearance_fee, prestige, created_at, updated_at)
               VALUES (:id, :show, 'Gala', 'used', :ep, :cost, :isPaid, :payment,
                 CAST(:rewards AS jsonb), :dealType, CAST(:bonusTerms AS jsonb), :appearanceFee, 5, NOW(), NOW())`,
      { id: uuid(), show, ep, cost, isPaid, payment, dealType, appearanceFee,
        rewards: rewards ? JSON.stringify(rewards) : null, bonusTerms: bonusTerms ? JSON.stringify(bonusTerms) : null });
    return { show, ep };
  }

  const rowsOf = (show, category) => q(
    `SELECT amount FROM financial_transactions WHERE show_id = :show AND category = :category AND deleted_at IS NULL`,
    { show, category }
  ).then((rows) => rows.map((r) => Number(r.amount)));
  const RETIRED = ['tier_reward', 'tier_paid_bonus', 'event_reward'];

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

  it.each([
    ['a paid event with an entry cost', { cost: 300, isPaid: true, payment: 800 }],
    ['an unpaid event with an entry cost (the old paid-bonus case)', { cost: 300, isPaid: false, payment: 0 }],
    ['an unpaid event with no entry cost and a coin reward', { cost: 0, isPaid: false, payment: 0, rewards: { coins: 100 } }],
  ])('%s: no tier reward, paid bonus or event reward at SLAY', async (_label, event) => {
    const { show, ep } = await seed(event);
    await completeEpisode(ep, show, sequelize);
    for (const category of RETIRED) expect(await rowsOf(show, category)).toEqual([]);
  });

  it('a deal whose terms name SLAY is paid that bonus; one without terms is not', async () => {
    const withBonus = await seed({ cost: 0, isPaid: false, payment: 0, dealType: 'paid_appearance', appearanceFee: 450, bonusTerms: { slay: 250, pass: 100 } });
    await completeEpisode(withBonus.ep, withBonus.show, sequelize);
    expect(await rowsOf(withBonus.show, 'deal_bonus')).toEqual([250]);
    expect(await rowsOf(withBonus.show, 'appearance_fee')).toEqual([450]);

    const without = await seed({ cost: 0, isPaid: false, payment: 0, dealType: 'paid_appearance', appearanceFee: 450 });
    await completeEpisode(without.ep, without.show, sequelize);
    expect(await rowsOf(without.show, 'deal_bonus')).toEqual([]);
    for (const category of RETIRED) expect(await rowsOf(without.show, category)).toEqual([]);
  });
});

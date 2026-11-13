/**
 * Finalize first, Complete later (Evoni, 2026-11-13).
 *
 * Completion runs finalize as its money step. When finalize had already run
 * on its own, completion got "already finalized" with no summary and stored
 * the episode's income and expenses as 0, a financial score of 7, no
 * financial summary, and mood inputs of 0. The money itself was always
 * right: the ledger is the source of truth and nothing was booked twice.
 *
 * Now the finalize that already ran is read back from its own ledger rows,
 * so an episode finalized first and completed later stores what an
 * identical episode completed directly stores. Each case below is a pair of
 * identical shows: one completed directly, one finalized and then completed.
 *
 * A milestone reward now records the episode whose finalize crossed the
 * goal (metadata.episode_id). A reward booked before that carries no
 * episode: it is reported as unknown, never guessed and never counted as none.
 */
jest.unmock('uuid');

jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: async () => { throw new Error('the model must not be asked'); } } })));

const crypto = require('crypto');
const models = require('../../src/models');
const { finalizeEpisodeFinancials, FINALIZE_CATEGORIES } = require('../../src/services/financialTransactionService');
const { completeEpisode } = require('../../src/services/episodeCompletionService');
const { PAYOUT_CATEGORIES } = require('../../src/services/dealPayoutService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

(shouldSkip ? describe.skip : describe)('Finalize first, then Complete, stores what a direct Complete stores', () => {
  const shows = [];

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const del = (sql) => sequelize.query(sql, { replacements: { shows } }).catch(() => {});
    if (shows.length) {
      for (const t of ['financial_transactions', 'character_state_history', 'character_state']) await del(`DELETE FROM ${t} WHERE show_id IN (:shows)`);
      await del('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id IN (:shows)');
      await del('DELETE FROM episodes WHERE show_id IN (:shows)');
      await del('DELETE FROM world_events WHERE show_id IN (:shows)');
      await del('DELETE FROM shows WHERE id IN (:shows)');
    }
    await sequelize.close();
  });

  /** A show starting at 1000 coins with one draft episode started from the event. */
  async function seed(event = {}, goals = null) {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), state: uuid() };
    shows.push(ids.show);
    const meta = { starting_balance: 1000, ...(goals ? { financial_goals: goals } : {}) };
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :name, CAST(:meta AS jsonb), NOW(), NOW())`,
      { ...ids, name: `ftc-${ids.show.slice(0, 8)}`, meta: JSON.stringify(meta) });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Gala Night', 1, 'draft', NOW(), NOW())`, ids);
    const e = { deal_type: null, event_type: 'invite', cost_coins: 0, is_paid: false, payment_amount: 0, appearance_fee: null, bonus_terms: null, host_brand: null, ...event };
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, event_type, deal_type, cost_coins, is_paid, payment_amount,
                 appearance_fee, appearance_required, bonus_terms, host, host_brand, prestige, created_at, updated_at)
               VALUES (:event, :show, 'Velour Night', 'used', :ep, :event_type, :deal_type, :cost_coins, :is_paid, :payment_amount,
                 :appearance_fee, false, :bonus_terms, 'Nia Vale', :host_brand, 5, NOW(), NOW())`,
    { ...ids, ...e, bonus_terms: e.bonus_terms ? JSON.stringify(e.bonus_terms) : null });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:state, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, ids);
    return ids;
  }
  const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
  const ledger = (ids) => q(`SELECT category, type, amount::float AS amount FROM financial_transactions WHERE show_id = :show AND deleted_at IS NULL ORDER BY category, amount`, ids);

  /** What completion stores about the episode's money, and where the money ended up. */
  async function stored(ids) {
    const [ep] = await q(`SELECT evaluation_status, total_income::float AS total_income, total_expenses::float AS total_expenses, financial_score, evaluation_json FROM episodes WHERE id = :ep`, ids);
    const ev = asJson(ep.evaluation_json) || {};
    const [lala] = await q(`SELECT coins, stress, reputation, brand_trust, influence FROM character_state WHERE show_id = :show AND character_key = 'lala'`, ids);
    return {
      status: ep.evaluation_status,
      total_income: ep.total_income,
      total_expenses: ep.total_expenses,
      financial_score: ep.financial_score,
      financial_summary: ev.financial_summary,
      tier: ev.tier_final,
      mood_inputs: ev.stat_deltas?._financial_context,
      financial_mood_delta: ev.stat_deltas?.financial_mood_delta,
      lala,
      ledger: await ledger(ids),
    };
  }
  /** The pair: a direct completion, and a finalize followed by a completion, of identical shows. */
  async function pair(event, goals) {
    const direct = await seed(event, goals);
    await completeEpisode(direct.ep, direct.show, sequelize);
    const later = await seed(event, goals);
    const finalized = await finalizeEpisodeFinancials(later.ep, later.show, sequelize);
    await completeEpisode(later.ep, later.show, sequelize);
    return { direct, later, finalized, a: await stored(direct), b: await stored(later) };
  }

  const BONUS = { slay: 300, pass: 200, safe: 100 };
  const SHAPES = [
    ['an entry cost', { cost_coins: 300 }],
    ['a large entry cost', { cost_coins: 800 }],
    ['a legacy paid event', { is_paid: true, payment_amount: 800 }],
    ['a legacy paid brand deal (payment and content revenue)', { event_type: 'brand_deal', is_paid: true, payment_amount: 800, host_brand: 'Maison Belle' }],
    ['a cost and a payment', { cost_coins: 250, is_paid: true, payment_amount: 100 }],
    ['a deal paid at completion (appearance fee and tier bonus)', { deal_type: 'paid_appearance', appearance_fee: 450, bonus_terms: BONUS }],
  ];

  test.each(SHAPES)('%s: the stored totals, summary, score, mood inputs, stats, coins and ledger are the same', async (_name, event) => {
    const { a, b } = await pair(event);
    expect(a.status).toBe('accepted');
    expect(b).toEqual(a);
    // And they are the ledger's: finalize's rows, not the payouts booked beside them.
    const own = a.ledger.filter((r) => FINALIZE_CATEGORIES.includes(r.category));
    const sum = (rows, types) => rows.filter((r) => types.includes(r.type)).reduce((s, r) => s + r.amount, 0);
    expect(a.total_income).toBe(sum(own, ['income', 'reward']));
    expect(a.total_expenses).toBe(sum(own, ['expense', 'deduction']));
  });

  test('the bug this fixes: the totals are not 0, and the summary is there', async () => {
    const { b } = await pair({ cost_coins: 800 });
    expect(b.total_expenses).toBeGreaterThanOrEqual(800);
    expect(b.financial_score).toBe(3);
    expect(b.financial_summary).toMatchObject({ total_income: 0, event_cost: 800 });
    expect(b.financial_summary.net_profit).toBe(-b.total_expenses);
    expect(b.mood_inputs).toMatchObject({ balance_before: 1000, balance_after: 1000 - b.total_expenses, episode_net: -b.total_expenses, milestones_hit: 0 });
  });

  test('a deal is paid once: its payouts are booked by completion only, and are not in the episode totals either way', async () => {
    const { a, b } = await pair({ deal_type: 'paid_appearance', appearance_fee: 450, bonus_terms: BONUS });
    for (const s of [a, b]) {
      const payouts = s.ledger.filter((r) => PAYOUT_CATEGORIES.includes(r.category));
      expect(payouts.filter((r) => r.category === 'appearance_fee')).toEqual([{ category: 'appearance_fee', type: 'income', amount: 450 }]);
      expect(payouts.filter((r) => r.category === 'deal_bonus').length).toBeLessThanOrEqual(1);
      expect(s.total_income).toBe(0);
    }
  });

  describe('repeats and races', () => {
    test('Finalize, Complete, then both again: nothing more is booked and nothing stored changes', async () => {
      const { later, b } = await pair({ cost_coins: 250, is_paid: true, payment_amount: 100 });
      const again = await finalizeEpisodeFinancials(later.ep, later.show, sequelize);
      expect(again.already_finalized).toBe(true);
      await completeEpisode(later.ep, later.show, sequelize);
      expect(await stored(later)).toEqual(b);
    });

    test('a repeated Finalize answers with the summary it booked, and books nothing', async () => {
      const ids = await seed({ cost_coins: 250, is_paid: true, payment_amount: 100 });
      const first = await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
      const before = await ledger(ids);
      const again = await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
      expect(again.already_finalized).toBe(true);
      expect(again.summary).toEqual(first.summary);
      expect(again.balance_before).toBe(first.balance_before);
      expect(again.balance_after).toBe(first.balance_after);
      expect(await ledger(ids)).toEqual(before);
    });

    test('two completions at once after a Finalize: one result, booked once', async () => {
      const event = { cost_coins: 300 };
      const control = await seed(event);
      await completeEpisode(control.ep, control.show, sequelize);
      const ids = await seed(event);
      await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
      await Promise.allSettled([completeEpisode(ids.ep, ids.show, sequelize), completeEpisode(ids.ep, ids.show, sequelize)]);
      expect(await stored(ids)).toEqual(await stored(control));
    });

    test('a Finalize and a Complete at once: whichever goes first, the money is booked once and the totals are the direct ones', async () => {
      const event = { cost_coins: 300, is_paid: true, payment_amount: 100 };
      const control = await seed(event);
      await completeEpisode(control.ep, control.show, sequelize);
      const ids = await seed(event);
      await Promise.allSettled([finalizeEpisodeFinancials(ids.ep, ids.show, sequelize), completeEpisode(ids.ep, ids.show, sequelize)]);
      // A completion that lost the race to a lock is asked again, as the API's retryable 409 asks.
      if ((await stored(ids)).status !== 'accepted') await completeEpisode(ids.ep, ids.show, sequelize);
      expect(await stored(ids)).toEqual(await stored(control));
    });
  });

  describe('milestone rewards', () => {
    const GOAL = [{ id: 'rising-star', threshold: 1500, reward_coins: 200, label: 'Rising Star', triggered_at: null }];
    const PAID = { is_paid: true, payment_amount: 800 };
    const rewards = (ids) => q(`SELECT episode_id, metadata, amount::float AS amount FROM financial_transactions WHERE show_id = :show AND category = 'milestone' AND deleted_at IS NULL`, ids);

    test('a reward records the episode whose finalize crossed the goal, in its metadata; it stays out of the episode\'s own rows', async () => {
      const ids = await seed(PAID, GOAL);
      const result = await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
      expect(result.milestones_triggered).toHaveLength(1);
      const rows = await rewards(ids);
      expect(rows).toHaveLength(1);
      expect(asJson(rows[0].metadata)).toEqual({ goal_id: 'rising-star', threshold: 1500, episode_id: ids.ep });
      expect(rows[0].episode_id).toBeNull();
      expect(rows[0].amount).toBe(200);
    });

    test('a goal crossed by the earlier Finalize counts once: same stored result as a direct Complete, one reward', async () => {
      const { a, b, later, finalized } = await pair(PAID, GOAL);
      expect(finalized.milestones_triggered).toHaveLength(1);
      expect(b).toEqual(a);
      expect(b.mood_inputs.milestones_hit).toBe(1);
      expect(await rewards(later)).toHaveLength(1);
      // The reward is the show's money, not the episode's income.
      expect(b.total_income).toBe(800);
    });

    test('a reward booked before rewards recorded their episode is unknown: said so, not guessed and not counted as none', async () => {
      const ids = await seed(PAID, GOAL);
      await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
      // As a row booked before this change: the goal and threshold, no episode.
      await run(`UPDATE financial_transactions SET metadata = metadata - 'episode_id' WHERE show_id = :show AND category = 'milestone'`, ids);
      const again = await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
      expect(again.milestones_attribution).toBe('unknown');
      expect(again.milestones_triggered).toEqual([]);
      await completeEpisode(ids.ep, ids.show, sequelize);
      const s = await stored(ids);
      expect(s.mood_inputs.milestones_hit).toBeNull();
      expect(s.mood_inputs.milestones_unknown).toBe(true);
      // The money is still booked once and the totals are still the ledger's.
      expect(await rewards(ids)).toHaveLength(1);
      expect(s.total_income).toBe(800);
      expect(s.lala.coins).toBe(1000 + 800 - s.total_expenses + 200);
    });

    test('an older reward for a goal this episode did not cross is not this episode\'s: attribution stays recorded', async () => {
      const ids = await seed({ cost_coins: 300 }, [{ id: 'far', threshold: 5000, reward_coins: 100, label: 'Far', triggered_at: null }]);
      await run(`INSERT INTO financial_transactions (id, show_id, type, category, amount, description, source_type, metadata, status, created_at, updated_at)
                 VALUES (:id, :show, 'reward', 'milestone', 50, 'An older reward', 'milestone', '{"goal_id":"old","threshold":400}'::jsonb, 'executed', NOW(), NOW())`, { id: uuid(), ...ids });
      await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
      const again = await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
      // 400 is below where this finalize started, so it cannot be this episode's.
      expect(again.milestones_attribution).toBe('recorded');
      expect(again.milestones_triggered).toEqual([]);
    });
  });
});

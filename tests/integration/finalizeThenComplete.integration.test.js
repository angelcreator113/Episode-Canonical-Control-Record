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
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
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
      await del(`DELETE FROM activity_logs WHERE resource_type = 'episode' AND resource_id IN (SELECT id::text FROM episodes WHERE show_id IN (:shows))`);
      await del('DELETE FROM event_costs WHERE event_id IN (SELECT id FROM world_events WHERE show_id IN (:shows))');
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

  // A reward booked before rewards recorded their episode (Evoni, 2026-11-13):
  // never counted as none, never attributed by a timestamp. What completion
  // stores is worked out with none and with all of the candidates; the same
  // either way completes UNVERIFIED, different is refused until an admin decides.
  describe('milestone rewards whose episode the ledger does not say', () => {
    const GOAL = [{ id: 'rising-star', threshold: 1500, reward_coins: 200, label: 'Rising Star', triggered_at: null }];
    const PAID = { is_paid: true, payment_amount: 800 };
    const ADMIN = { id: 'test-admin-milestones', name: 'Evoni', email: 'admin@milestones.dev' };
    const THIS = 'this_episode';
    const NOT = 'not_this_episode';
    let token;
    beforeAll(() => {
      token = TokenService.generateTokenPair({ ...ADMIN, groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    });

    const finalize = (ids) => finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
    const complete = (ids, decisions, by = ADMIN) => completeEpisode(ids.ep, ids.show, sequelize, decisions ? { milestoneDecisions: decisions, decidedBy: by } : {});
    const refusal = (promise) => promise.then(() => { throw new Error('the completion was not refused'); }, (err) => err);
    /** As rows booked before rewards recorded their episode: the goal and threshold, no episode. */
    const forget = (ids) => run(`UPDATE financial_transactions SET metadata = metadata - 'episode_id' WHERE show_id = :show AND category = 'milestone'`, ids);
    /** A reward row with no recorded episode, as an older one; returns its id. */
    async function olderReward(ids, { threshold, amount = 50, episode = null }) {
      const id = uuid();
      const metadata = { goal_id: `old-${id.slice(0, 6)}`, ...(threshold === undefined ? {} : { threshold }), ...(episode ? { episode_id: episode } : {}) };
      await run(`INSERT INTO financial_transactions (id, show_id, type, category, amount, description, source_type, source_name, metadata, status, created_at, updated_at)
                 VALUES (:id, :show, 'reward', 'milestone', :amount, 'An older reward', 'milestone', 'Older goal', CAST(:metadata AS jsonb), 'executed', NOW(), NOW())`,
      { id, ...ids, amount, metadata: JSON.stringify(metadata) });
      return id;
    }
    const candidateIds = async (ids) => (await finalize(ids)).milestone_candidates.map((c) => c.tx_id);
    const audits = (ids) => q(`SELECT user_id, action, changes FROM activity_logs WHERE resource_type = 'episode' AND resource_id = :ep ORDER BY id`, ids);
    /** Everything a completion could write. */
    const everything = async (ids) => ({
      ledger: await q(`SELECT id, category, amount::float AS amount, metadata, deleted_at FROM financial_transactions WHERE show_id = :show ORDER BY id`, ids),
      lala: await q(`SELECT coins, stress, reputation, brand_trust, influence, last_applied_episode_id FROM character_state WHERE show_id = :show`, ids),
      history: await q(`SELECT id FROM character_state_history WHERE show_id = :show ORDER BY id`, ids),
      episode: await q(`SELECT status, evaluation_status, evaluation_json, total_income, total_expenses, financial_score FROM episodes WHERE id = :ep`, ids),
      event: await q(`SELECT status FROM world_events WHERE id = :event`, ids),
      show: await q(`SELECT metadata FROM shows WHERE id = :show`, ids),
      audits: await audits(ids),
    });
    /** stored(), without the attribution record itself, to compare with a completion that had nothing to attribute. */
    const comparable = (st) => {
      const { milestone_attribution: _a, ...mood } = st.mood_inputs || {};
      return { ...st, mood_inputs: mood };
    };
    const evaluation = async (ids) => asJson((await q(`SELECT evaluation_json FROM episodes WHERE id = :ep`, ids))[0].evaluation_json);
    const historyContext = async (ids) => {
      const rows = await q(`SELECT deltas_json FROM character_state_history WHERE episode_id = :ep AND evaluation_id IS NOT NULL`, ids);
      return rows.map((r) => asJson(r.deltas_json)._financial_context);
    };
    /** A finalized episode whose one reward (200, at 1500) has lost its episode. Stress differs with it; the score does not. */
    async function stressCase() {
      const ids = await seed(PAID, GOAL);
      await finalize(ids);
      await forget(ids);
      return ids;
    }

    describe('the candidates are every reward this finalize could have paid (old balance < threshold <= new balance)', () => {
      test('thresholds at the starting and ending balances: the start is not a candidate, the end is', async () => {
        const ids = await seed(PAID);
        const done = await finalize(ids);
        expect(done.balance_before).toBe(1000);
        expect(done.balance_after).toBeGreaterThan(done.balance_before);
        const atStart = await olderReward(ids, { threshold: done.balance_before });
        const justAfterStart = await olderReward(ids, { threshold: done.balance_before + 1 });
        const atEnd = await olderReward(ids, { threshold: done.balance_after });
        const pastEnd = await olderReward(ids, { threshold: done.balance_after + 1 });
        const again = await finalize(ids);
        const found = again.milestone_candidates.map((c) => c.tx_id);
        expect(found).toEqual(expect.arrayContaining([justAfterStart, atEnd]));
        expect(found).toHaveLength(2);
        expect(found).not.toContain(atStart);
        expect(found).not.toContain(pastEnd);
        expect(again.milestone_candidates.every((c) => c.reason === 'in_range')).toBe(true);
        expect(again.milestones_attribution).toBe('unknown');
      });

      test('a finalize that did not raise the balance paid no reward: no candidate, even for a row with no threshold', async () => {
        const ids = await seed({ cost_coins: 300 });
        const done = await finalize(ids);
        expect(done.balance_after).toBeLessThan(done.balance_before);
        await olderReward(ids, { threshold: 900 });
        await olderReward(ids, {});
        const again = await finalize(ids);
        expect(again.milestone_candidates).toEqual([]);
        expect(again.milestones_attribution).toBe('recorded');
      });

      test('a reward row with no threshold cannot be ruled out: it is a candidate', async () => {
        const ids = await seed(PAID);
        await finalize(ids);
        const none = await olderReward(ids, {});
        const notANumber = await olderReward(ids, { threshold: 'soon' });
        const again = await finalize(ids);
        expect(again.milestone_candidates.map((c) => [c.tx_id, c.reason, c.threshold]).sort())
          .toEqual([[none, 'no_threshold', null], [notANumber, 'no_threshold', null]].sort());
      });

      test('when the finalize\'s balance movement cannot be rebuilt from its rows, every unrecorded reward is a candidate', async () => {
        const ids = await seed({ cost_coins: 300 });
        await finalize(ids);
        const far = await olderReward(ids, { threshold: 99999 });
        const recordedElsewhere = await olderReward(ids, { threshold: 900, episode: uuid() });
        await run(`UPDATE financial_transactions SET balance_before = NULL WHERE episode_id = :ep AND category = 'event_entry'`, ids);
        const again = await finalize(ids);
        expect(again.milestone_candidates.map((c) => [c.tx_id, c.reason])).toEqual([[far, 'range_unknown']]);
        expect(again.milestone_candidates.map((c) => c.tx_id)).not.toContain(recordedElsewhere);
      });

      test('a reward recorded against another episode is never a candidate', async () => {
        const ids = await seed(PAID);
        const done = await finalize(ids);
        await olderReward(ids, { threshold: done.balance_after, episode: uuid() });
        expect((await finalize(ids)).milestone_candidates).toEqual([]);
      });
    });

    describe('different either way: refused before anything is written', () => {
      test('the stress differs and the score does not: refused, naming the reward; every table is as it was', async () => {
        const ids = await stressCase();
        const before = await everything(ids);
        const err = await refusal(complete(ids));
        expect(err).toMatchObject({ name: 'MilestoneAttributionError', code: 'MILESTONE_ATTRIBUTION_REQUIRED', status: 409 });
        expect(err.candidates).toHaveLength(1);
        expect(err.candidates[0]).toMatchObject({ goal_id: 'rising-star', threshold: 1500, amount: 200, reason: 'in_range' });
        expect(err.undecided).toEqual([err.candidates[0].tx_id]);
        expect(await everything(ids)).toEqual(before);
        expect(before.episode[0].evaluation_status).not.toBe('accepted');
        // Asked again, it answers the same, and still writes nothing.
        const second = await refusal(complete(ids));
        expect(second.code).toBe('MILESTONE_ATTRIBUTION_REQUIRED');
        expect(second.undecided).toEqual(err.undecided);
        expect(await everything(ids)).toEqual(before);
      });

      test('the score differs and the stress does not: refused too', async () => {
        // A deal with one cost of 300: the finalize's net is -300, the score band 3.
        const ids = await seed({ deal_type: 'paid_deliverables', host_brand: 'Maison Belle' });
        await run(`INSERT INTO event_costs (id, event_id, kind, label, amount, paid_by, created_at, updated_at) VALUES (:id, :event, 'travel', 'Car', 300, 'lala', NOW(), NOW())`, { id: uuid(), ...ids });
        const done = await finalize(ids);
        expect(done.summary.net_profit).toBe(-300);
        // Six rewards recorded as this episode's hold the stress at its floor (-5) either way.
        for (let i = 0; i < 6; i += 1) await olderReward(ids, { threshold: 10 + i, amount: 1, episode: ids.ep });
        // One more, 150, with no episode; the movement cannot be rebuilt, so it is a candidate.
        const candidate = await olderReward(ids, { threshold: 99999, amount: 150 });
        await run(`UPDATE financial_transactions SET balance_before = NULL WHERE episode_id = :ep AND category = 'event_cost'`, ids);
        expect(await candidateIds(ids)).toEqual([candidate]);

        const before = await everything(ids);
        const err = await refusal(complete(ids));
        expect(err.code).toBe('MILESTONE_ATTRIBUTION_REQUIRED');
        expect(await everything(ids)).toEqual(before);

        // Each answer stores its own score; the stress is the same in both.
        const twin = await seed({ deal_type: 'paid_deliverables', host_brand: 'Maison Belle' });
        await run(`INSERT INTO event_costs (id, event_id, kind, label, amount, paid_by, created_at, updated_at) VALUES (:id, :event, 'travel', 'Car', 300, 'lala', NOW(), NOW())`, { id: uuid(), ...twin });
        await finalize(twin);
        for (let i = 0; i < 6; i += 1) await olderReward(twin, { threshold: 10 + i, amount: 1, episode: twin.ep });
        const twinCandidate = await olderReward(twin, { threshold: 99999, amount: 150 });
        await run(`UPDATE financial_transactions SET balance_before = NULL WHERE episode_id = :ep AND category = 'event_cost'`, twin);

        await complete(ids, { [candidate]: THIS });
        await complete(twin, { [twinCandidate]: NOT });
        const yes = await stored(ids);
        const no = await stored(twin);
        expect(yes.financial_score).toBe(5);   // -300 + 6 + 150
        expect(no.financial_score).toBe(3);    // -300 + 6
        expect(yes.financial_mood_delta).toBe(-5);
        expect(no.financial_mood_delta).toBe(-5);
        expect(yes.lala.stress).toBe(no.lala.stress);
        // The verified totals do not depend on the answer.
        expect([yes.total_income, yes.total_expenses]).toEqual([0, 300]);
        expect([no.total_income, no.total_expenses]).toEqual([0, 300]);
      });
    });

    describe('an admin decides', () => {
      test('"this episode\'s": what a direct Complete stores, and the decision is recorded three times over', async () => {
        const direct = await seed(PAID, GOAL);
        await completeEpisode(direct.ep, direct.show, sequelize);
        const ids = await stressCase();
        const [candidate] = await candidateIds(ids);
        const result = await complete(ids, { [candidate]: THIS });

        const a = await stored(direct);
        const b = await stored(ids);
        expect(comparable(b)).toEqual(comparable(a));
        expect(b.mood_inputs.milestones_hit).toBe(1);
        expect(b.mood_inputs.milestones_unknown).toBeUndefined();

        const record = {
          status: 'DECIDED',
          candidates: [{
            tx_id: candidate, goal_id: 'rising-star', label: 'Rising Star', threshold: 1500, amount: 200, reason: 'in_range',
            decision: THIS, decided_by: { id: ADMIN.id, name: ADMIN.name }, decided_at: expect.any(String),
          }],
        };
        expect(result.milestone_attribution).toEqual(record);
        expect((await evaluation(ids)).milestone_attribution).toEqual(record);
        expect((await historyContext(ids)).map((c) => c.milestone_attribution)).toEqual([record]);
        const log = await audits(ids);
        expect(log).toHaveLength(1);
        expect(log[0]).toMatchObject({ user_id: ADMIN.id, action: 'milestone_attribution' });
        expect(asJson(log[0].changes).meta).toMatchObject({
          status: 'DECIDED', decided_by: { id: ADMIN.id, name: ADMIN.name }, left_undecided: [],
          decisions: [{ tx_id: candidate, decision: THIS, goal_id: 'rising-star', threshold: 1500, amount: 200 }],
        });
        expect(asJson(log[0].changes).meta.decided_at).toBe((await evaluation(ids)).milestone_attribution.candidates[0].decided_at);
        // The reward row itself is not rewritten.
        const [row] = await q(`SELECT metadata FROM financial_transactions WHERE id = :id`, { id: candidate });
        expect(asJson(row.metadata).episode_id).toBeUndefined();
      });

      test('"not this episode\'s": no relief and no reward in the score; the money is the ledger\'s either way', async () => {
        const ids = await stressCase();
        const [candidate] = await candidateIds(ids);
        await complete(ids, { [candidate]: NOT });
        const twin = await stressCase();
        const [twinCandidate] = await candidateIds(twin);
        await complete(twin, { [twinCandidate]: THIS });
        const no = await stored(ids);
        const yes = await stored(twin);
        expect(no.mood_inputs.milestones_hit).toBe(0);
        expect(yes.mood_inputs.milestones_hit).toBe(1);
        expect(no.financial_mood_delta - yes.financial_mood_delta).toBe(2);
        expect(no.lala.stress).toBeGreaterThanOrEqual(yes.lala.stress);
        for (const st of [no, yes]) {
          expect(st.total_income).toBe(800);
          expect(st.lala.coins).toBe(1000 + 800 - st.total_expenses + 200);
        }
        expect(no.total_expenses).toBe(yes.total_expenses);
        expect(no.ledger).toEqual(yes.ledger);
      });

      test('a decision for a row that is not a candidate now is stale: refused, nothing written', async () => {
        const ids = await stressCase();
        const [candidate] = await candidateIds(ids);
        const before = await everything(ids);
        const stale = uuid();
        const err = await refusal(complete(ids, { [candidate]: THIS, [stale]: THIS }));
        expect(err).toMatchObject({ code: 'MILESTONE_DECISION_STALE', status: 409, unknown: [stale] });
        expect(err.candidates.map((c) => c.tx_id)).toEqual([candidate]);
        expect(await everything(ids)).toEqual(before);
        // A direct completion has no candidates: a decision sent with it is stale too.
        const direct = await seed(PAID, GOAL);
        const untouched = await everything(direct);
        expect((await refusal(complete(direct, { [stale]: NOT }))).code).toBe('MILESTONE_DECISION_STALE');
        expect(await everything(direct)).toEqual(untouched);
      });

      test('a decision that cannot be read, or with no admin to record it against, is refused; nothing written', async () => {
        const ids = await stressCase();
        const [candidate] = await candidateIds(ids);
        const before = await everything(ids);
        for (const attempt of [
          () => complete(ids, { [candidate]: 'probably' }),
          () => complete(ids, [candidate]),
          () => complete(ids, { [candidate]: THIS }, null),
          () => complete(ids, { [candidate]: THIS }, { name: 'No id' }),
        ]) {
          expect(await refusal(attempt())).toMatchObject({ code: 'MILESTONE_DECISION_INVALID', status: 400 });
        }
        expect(await everything(ids)).toEqual(before);
      });

      test('a candidate left undecided is not guessed: still refused while it matters', async () => {
        const ids = await stressCase();
        const [candidate] = await candidateIds(ids);
        const before = await everything(ids);
        for (const left of [{}, { [candidate]: null }, { [candidate]: '' }]) {
          const err = await refusal(complete(ids, left));
          expect(err.code).toBe('MILESTONE_ATTRIBUTION_REQUIRED');
          expect(err.undecided).toEqual([candidate]);
        }
        expect(await everything(ids)).toEqual(before);
      });

      test('through the API: 409 with the candidates, then the admin\'s decision completes it and is recorded as theirs', async () => {
        const ids = await stressCase();
        const post = (body) => request(app).post(`/api/v1/world/${ids.show}/episodes/${ids.ep}/complete`).set('Authorization', `Bearer ${token}`).send(body);
        const refused = await post({});
        expect(refused.status).toBe(409);
        expect(refused.body).toMatchObject({ success: false, code: 'MILESTONE_ATTRIBUTION_REQUIRED', decisions: [THIS, NOT] });
        expect(refused.body.candidates).toHaveLength(1);
        const [{ tx_id: candidate }] = refused.body.candidates;
        expect(refused.body.undecided).toEqual([candidate]);
        expect((await post({ milestone_decisions: { [uuid()]: THIS } })).body.code).toBe('MILESTONE_DECISION_STALE');
        expect((await audits(ids))).toEqual([]);

        const done = await post({ milestone_decisions: { [candidate]: THIS } });
        expect(done.status).toBe(200);
        expect(done.body.data.milestone_attribution).toMatchObject({ status: 'DECIDED', candidates: [{ tx_id: candidate, decision: THIS, decided_by: { id: ADMIN.id } }] });
        expect((await audits(ids)).map((r) => r.user_id)).toEqual([ADMIN.id]);
        // Completed is completed: a later, different decision changes nothing.
        const after = await everything(ids);
        const again = await post({ milestone_decisions: { [candidate]: NOT } });
        expect(again.status).toBe(200);
        expect(again.body.data.already_completed).toBe(true);
        expect(await everything(ids)).toEqual(after);
      });
    });

    describe('the same either way: completes, and says UNVERIFIED', () => {
      /** A big win (+3000) whose stress reaches its floor (-5) once one reward is counted; three older rewards in range. */
      async function floorCase() {
        const ids = await seed({ is_paid: true, payment_amount: 3000 });
        const done = await finalize(ids);
        const rows = [];
        for (let i = 1; i <= 3; i += 1) rows.push(await olderReward(ids, { threshold: done.balance_before + i, amount: 10 * i }));
        return { ids, rows };
      }

      test('several candidates, none decided, and they matter: refused, all of them named', async () => {
        const { ids, rows } = await floorCase();
        const before = await everything(ids);
        const err = await refusal(complete(ids));
        expect(err.code).toBe('MILESTONE_ATTRIBUTION_REQUIRED');
        expect([...err.undecided].sort()).toEqual([...rows].sort());
        expect(await everything(ids)).toEqual(before);
      });

      test('one decided, two left undecided that can no longer change anything: completes UNVERIFIED, with the decision recorded', async () => {
        const { ids, rows } = await floorCase();
        const [one, two, three] = rows;
        // Deciding one is not this episode's leaves the other two mattering.
        expect((await refusal(complete(ids, { [one]: NOT }))).undecided.sort()).toEqual([two, three].sort());

        const result = await complete(ids, { [one]: THIS });
        const st = await stored(ids);
        expect(st.status).toBe('accepted');
        expect(result.milestone_attribution.status).toBe('UNVERIFIED');
        const byId = Object.fromEntries(result.milestone_attribution.candidates.map((c) => [c.tx_id, c]));
        expect(byId[one]).toMatchObject({ decision: THIS, decided_by: { id: ADMIN.id, name: ADMIN.name } });
        expect(byId[two]).toMatchObject({ decision: null, amount: 20, reason: 'in_range' });
        expect(byId[three]).toMatchObject({ decision: null, amount: 30, reason: 'in_range' });
        expect(byId[three].decided_by).toBeUndefined();
        // The count is not said while any is unknown; it is not counted as none.
        expect(st.mood_inputs.milestones_hit).toBeNull();
        expect(st.mood_inputs.milestones_unknown).toBe(true);
        expect(st.financial_mood_delta).toBe(-5);
        expect(st.financial_score).toBe(7);
        expect((await evaluation(ids)).milestone_attribution.status).toBe('UNVERIFIED');
        expect((await historyContext(ids))[0].milestone_attribution.status).toBe('UNVERIFIED');
        const log = await audits(ids);
        expect(log).toHaveLength(1);
        expect(asJson(log[0].changes).meta.status).toBe('UNVERIFIED');
        expect(asJson(log[0].changes).meta.decisions.map((d) => d.tx_id)).toEqual([one]);
        expect([...asJson(log[0].changes).meta.left_undecided].sort()).toEqual([two, three].sort());

        // The same stored result however the other two would have been decided.
        for (const [second, third] of [[THIS, THIS], [THIS, NOT], [NOT, THIS], [NOT, NOT]]) {
          const twin = await floorCase();
          await complete(twin.ids, { [twin.rows[0]]: THIS, [twin.rows[1]]: second, [twin.rows[2]]: third });
          const other = await stored(twin.ids);
          expect(other.financial_mood_delta).toBe(st.financial_mood_delta);
          expect(other.financial_score).toBe(st.financial_score);
          expect(other.lala).toEqual(st.lala);
          expect([other.total_income, other.total_expenses]).toEqual([st.total_income, st.total_expenses]);
        }
      });

      test('no decision at all is needed when nothing depends on it: UNVERIFIED, and no audit entry is invented', async () => {
        // Three recorded rewards already hold the stress at its floor; the score is 7 either way.
        const ids = await seed({ is_paid: true, payment_amount: 3000 });
        const done = await finalize(ids);
        for (let i = 0; i < 3; i += 1) await olderReward(ids, { threshold: 10 + i, amount: 1, episode: ids.ep });
        const candidate = await olderReward(ids, { threshold: done.balance_after, amount: 40 });
        const result = await complete(ids);
        expect(result.milestone_attribution).toEqual({
          status: 'UNVERIFIED',
          candidates: [{ tx_id: candidate, goal_id: expect.any(String), label: 'Older goal', threshold: done.balance_after, amount: 40, reason: 'in_range', decision: null }],
        });
        const st = await stored(ids);
        expect(st.status).toBe('accepted');
        expect(st.mood_inputs.milestones_hit).toBeNull();
        expect(await audits(ids)).toEqual([]);
      });
    });

    describe('repeats and races keep their protections', () => {
      test('two completions at once with the same decision: one completes, one finds it done, one audit entry', async () => {
        const ids = await stressCase();
        const [candidate] = await candidateIds(ids);
        const results = await Promise.all([complete(ids, { [candidate]: THIS }), complete(ids, { [candidate]: THIS })]);
        expect(results.filter((r) => r.already_completed)).toHaveLength(1);
        expect(await audits(ids)).toHaveLength(1);
        expect(await q(`SELECT id FROM character_state_history WHERE episode_id = :ep AND evaluation_id IS NOT NULL`, ids)).toHaveLength(1);
        expect(await q(`SELECT id FROM financial_transactions WHERE show_id = :show AND category = 'milestone' AND deleted_at IS NULL`, ids)).toHaveLength(1);
      });

      test('two completions at once with different decisions: the first to take the lock is stored, whole; the other is discarded', async () => {
        const ids = await stressCase();
        const [candidate] = await candidateIds(ids);
        const results = await Promise.all([complete(ids, { [candidate]: THIS }), complete(ids, { [candidate]: NOT })]);
        const done = results.filter((r) => !r.already_completed);
        expect(done).toHaveLength(1);
        const kept = done[0].milestone_attribution.candidates[0].decision;
        expect([THIS, NOT]).toContain(kept);
        const log = await audits(ids);
        expect(log).toHaveLength(1);
        expect(asJson(log[0].changes).meta.decisions).toEqual([expect.objectContaining({ tx_id: candidate, decision: kept })]);
        expect((await evaluation(ids)).milestone_attribution.candidates[0].decision).toBe(kept);
        expect((await stored(ids)).mood_inputs.milestones_hit).toBe(kept === THIS ? 1 : 0);
      });

      test('a refused completion and a decided one at once: the decided one completes, and nothing is booked twice', async () => {
        const ids = await stressCase();
        const [candidate] = await candidateIds(ids);
        const settled = await Promise.allSettled([complete(ids), complete(ids, { [candidate]: NOT })]);
        expect(settled[1].status).toBe('fulfilled');
        const st = await stored(ids);
        expect(st.status).toBe('accepted');
        expect(await audits(ids)).toHaveLength(1);
        expect(st.ledger.filter((r) => r.category === 'event_payment')).toHaveLength(1);
        expect(st.ledger.filter((r) => r.category === 'milestone')).toHaveLength(1);
      });

      test('after a completion, Finalize and Complete again change nothing', async () => {
        const ids = await stressCase();
        const [candidate] = await candidateIds(ids);
        await complete(ids, { [candidate]: THIS });
        const after = await everything(ids);
        expect((await finalize(ids)).already_finalized).toBe(true);
        expect((await complete(ids, { [candidate]: NOT })).already_completed).toBe(true);
        expect((await complete(ids)).already_completed).toBe(true);
        expect(await everything(ids)).toEqual(after);
      });
    });
  });
});

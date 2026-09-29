/**
 * Every display of Lala's coins reads the ledger (§8(z) Law 0, D1; §8(aa)
 * M6; Task #2273).
 *
 * One show with a known ledger: a 1900 seed, a 285 purchase outside any
 * episode, a voided 385 purchase, a 385 purchase on a deleted episode, and a
 * live episode that earned 100 and spent 50. The ledger balance is
 * 1900 − 285 + 100 − 50 = 1665. The cached character_state.coins is a stale
 * 560. Every endpoint a balance display reads must report 1665.
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

const BALANCE = 1665;

(shouldSkip ? describe.skip : describe)('every balance display reads the ledger (Task #2273)', () => {
  const ids = { show: uuid(), liveEp: uuid(), deletedEp: uuid() };
  const rowIds = { voided: uuid(), onDeleted: uuid(), income: uuid() };
  let token;

  const get = (url) => request(app).get(url).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-balance', email: 'test@balance.dev', name: 'Balance Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;

    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1900}' AS jsonb), NOW(), NOW())`,
      { ...ids, name: `Balance ${ids.show.slice(0, 8)}`, slug: `balance-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:liveEp, :show, 'Live episode', 1, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at, deleted_at)
               VALUES (:deletedEp, :show, 'Deleted episode', 2, 'draft', NOW(), NOW(), NOW())`, ids);
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, created_at, updated_at)
               VALUES (:id, :show, 'lala', 560, NOW(), NOW())`, { id: uuid(), show: ids.show });

    const rows = [
      [uuid(), 'income', 'seed', 1900, 'executed', null],
      [uuid(), 'expense', 'wardrobe_purchase', 285, 'executed', null],
      [rowIds.voided, 'expense', 'wardrobe_purchase', 385, 'voided', null],
      [rowIds.onDeleted, 'expense', 'wardrobe_purchase', 385, 'executed', ids.deletedEp],
      [rowIds.income, 'income', 'event_payment', 100, 'executed', ids.liveEp],
      [uuid(), 'expense', 'event_entry', 50, 'executed', ids.liveEp],
    ];
    for (const [id, type, category, amount, status, episodeId] of rows) {
      await run(`INSERT INTO financial_transactions (id, show_id, episode_id, type, category, amount, status, created_at, updated_at)
                 VALUES (:id, :show, :episodeId, :type, :category, :amount, :status, NOW(), NOW())`,
        { id, show: ids.show, episodeId, type, category, amount, status });
    }
  });

  afterAll(async () => {
    await run(`DELETE FROM financial_transactions WHERE show_id = :show`, ids);
    await run(`DELETE FROM character_state WHERE show_id = :show`, ids);
    await run(`DELETE FROM episodes WHERE show_id = :show`, ids);
    await run(`DELETE FROM shows WHERE id = :show`, ids);
  });

  it('Dashboard "Balance" and Insights "Coins": GET /world/:showId/balance', async () => {
    const res = await get(`/api/v1/world/${ids.show}/balance`);
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(BALANCE);
  });

  it('Producer Mode Overview, Characters, Wardrobe, Production, Evaluate: GET /characters/lala/state', async () => {
    const res = await get(`/api/v1/characters/lala/state?show_id=${ids.show}`);
    expect(res.status).toBe(200);
    expect(res.body.state.coins).toBe(BALANCE);
  });

  it('finance button, Phone Hub balance and goals: GET /shows/:id/financial-config', async () => {
    const res = await get(`/api/v1/shows/${ids.show}/financial-config`);
    expect(res.status).toBe(200);
    expect(Number(res.body.current_balance)).toBe(BALANCE);
  });

  it('finance modal: GET /shows/:id/financial-summary agrees throughout', async () => {
    const res = await get(`/api/v1/shows/${ids.show}/financial-summary`);
    expect(res.status).toBe(200);
    const { totals, trend, by_episode: byEpisode } = res.body;
    expect(totals.current_balance).toBe(BALANCE);
    // Lifetime income less expenses, over the rows that count, is the balance.
    expect(totals.lifetime_income).toBe(2000);
    expect(totals.lifetime_expenses).toBe(335);
    expect(totals.net).toBe(BALANCE);
    // The deleted episode is not listed; the live one nets +50 and its
    // running balance lands on Lala's balance.
    expect(byEpisode.map((e) => e.episode_id)).toEqual([ids.liveEp]);
    expect(byEpisode[0]).toMatchObject({ income: 100, expenses: 50, net: 50, balance_after: BALANCE });
    expect(trend[trend.length - 1].balance_after).toBe(BALANCE);
  });

  it('Phone Hub income/expense bars: GET /shows/:id/financial-breakdowns', async () => {
    const res = await get(`/api/v1/shows/${ids.show}/financial-breakdowns`);
    expect(res.status).toBe(200);
    expect(res.body.income.total - res.body.expenses.total).toBe(BALANCE);
  });

  it('Insights Financial Summary and Per Episode: GET /world/:showId/financial-ledger', async () => {
    const res = await get(`/api/v1/world/${ids.show}/financial-ledger?limit=200`);
    expect(res.status).toBe(200);
    const ledger = res.body.data;
    expect(ledger.balance).toBe(BALANCE);
    expect(ledger.totals).toEqual({ income: 2000, expenses: 335, net: BALANCE });
    // Every row stays listed as history; the voided and deleted-episode rows
    // are marked as not counted.
    expect(ledger.transactions).toHaveLength(6);
    const counted = Object.fromEntries(ledger.transactions.map((t) => [t.id, t.counted]));
    expect(counted[rowIds.voided]).toBe(false);
    expect(counted[rowIds.onDeleted]).toBe(false);
    expect(counted[rowIds.income]).toBe(true);
    expect(ledger.episode_summary).toHaveLength(1);
    expect(ledger.episode_summary[0]).toMatchObject({ id: ids.liveEp });
    expect(Number(ledger.episode_summary[0].total_income)).toBe(100);
    expect(Number(ledger.episode_summary[0].total_expenses)).toBe(50);
  });

  it('Episode Overview P&L: an episode-scoped ledger marks what counts', async () => {
    const res = await get(`/api/v1/world/${ids.show}/financial-ledger?episode_id=${ids.liveEp}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totals).toEqual({ income: 100, expenses: 50, net: 50 });
  });

  it('next-event suggestions weigh the ledger balance', async () => {
    const res = await get(`/api/v1/world/${ids.show}/events/next-suggestions`);
    expect(res.status).toBe(200);
    expect(res.body.data.state.coins).toBe(BALANCE);
  });
});

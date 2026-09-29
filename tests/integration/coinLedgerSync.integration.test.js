/**
 * character_state.coins recomputed from the ledger
 * (docs/EVENT_EPISODE_FLOW.md §8(x) D1, §8(y) Q1–Q4, Q7;
 * docs/COINS_LEDGER_CACHE_DESIGN.md §6.1–§6.2; Task #2246).
 *
 * syncCoinsFromLedger and spendFromLedger are not called by any route yet;
 * these tests pin their behaviour before D1's later PRs wire them in.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { syncCoinsFromLedger, spendFromLedger } = require('../../src/services/coinLedgerSync');
const { logTransaction, getCurrentBalance } = require('../../src/services/financialTransactionService');
const { DEFAULT_STARTING_BALANCE } = require('../../src/utils/financialRates');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('coinLedgerSync (§8(x) D1, §8(y))', () => {
  const shows = [];

  async function seedShow({ metadata = {}, lalaRows = 1, otherKey = false } = {}) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST(:metadata AS jsonb), NOW(), NOW())`,
      { show, name: `Coins ${show.slice(0, 8)}`, slug: `coins-${show.slice(0, 8)}`, metadata: JSON.stringify(metadata) });
    for (let i = 0; i < lalaRows; i += 1) {
      await run(`INSERT INTO character_state (id, show_id, character_key, coins, created_at, updated_at)
                 VALUES (:id, :show, 'lala', 500, NOW(), NOW())`, { id: uuid(), show });
    }
    if (otherKey) {
      await run(`INSERT INTO character_state (id, show_id, character_key, coins, created_at, updated_at)
                 VALUES (:id, :show, 'prime', 80, NOW(), NOW())`, { id: uuid(), show });
    }
    return show;
  }

  const ledgerRow = (show, type, amount, category = 'test') => run(
    `INSERT INTO financial_transactions (id, show_id, type, category, amount, status, created_at, updated_at)
     VALUES (:id, :show, :type, :category, :amount, 'executed', NOW(), NOW())`,
    { id: uuid(), show, type, category, amount }
  );
  const coinsByKey = async (show) => (await q(
    `SELECT character_key, coins FROM character_state WHERE show_id = :show ORDER BY character_key`, { show }
  )).map((r) => [r.character_key, r.coins]);
  const seedCount = async (show) => (await q(
    `SELECT COUNT(*)::int AS n FROM financial_transactions WHERE show_id = :show AND category = 'seed' AND deleted_at IS NULL`, { show }
  ))[0].n;
  const sync = (show) => sequelize.transaction((transaction) => syncCoinsFromLedger(sequelize, show, { transaction }));

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('seeds an unseeded ledger once, then writes the balance to every lala row and no other key', async () => {
    const show = await seedShow({ lalaRows: 2, otherKey: true });
    await ledgerRow(show, 'expense', 100);

    const first = await sync(show);
    const second = await sync(show);

    expect(first).toEqual({ balance: DEFAULT_STARTING_BALANCE - 100, rows_updated: 2 });
    expect(second.balance).toBe(DEFAULT_STARTING_BALANCE - 100);
    expect(await seedCount(show)).toBe(1);
    expect(await coinsByKey(show)).toEqual([
      ['lala', DEFAULT_STARTING_BALANCE - 100],
      ['lala', DEFAULT_STARTING_BALANCE - 100],
      ['prime', 80],
    ]);
  });

  it("seeds from the show's starting_balance setting (Q1)", async () => {
    const show = await seedShow({ metadata: { starting_balance: 700 } });

    const { balance } = await sync(show);

    expect(balance).toBe(700);
    expect(await coinsByKey(show)).toEqual([['lala', 700]]);
  });

  it('rounds a fractional ledger half away from zero (Q7)', async () => {
    const show = await seedShow({ metadata: { starting_balance: 1000 } });
    await ledgerRow(show, 'income', 1000, 'seed');
    await ledgerRow(show, 'expense', 120.5);

    const { balance } = await sync(show);

    expect(balance).toBe(880); // 879.5 rounds away from zero
  });

  it('counts neither refunds nor non-executed or deleted rows, as getCurrentBalance does', async () => {
    const show = await seedShow({ metadata: { starting_balance: 500 } });
    await ledgerRow(show, 'income', 500, 'seed');
    await ledgerRow(show, 'refund', 70);
    await run(`INSERT INTO financial_transactions (id, show_id, type, category, amount, status, deleted_at, created_at, updated_at)
               VALUES (:a, :show, 'income', 'x', 40, 'executed', NOW(), NOW(), NOW()),
                      (:b, :show, 'income', 'x', 30, 'pending', NULL, NOW(), NOW())`, { a: uuid(), b: uuid(), show });

    expect((await sync(show)).balance).toBe(500);
  });

  it("leaves out a deleted episode's rows, in the sync and in getCurrentBalance (§8(aa) M6)", async () => {
    const show = await seedShow({ metadata: { starting_balance: 1000 } });
    const live = uuid();
    const gone = uuid();
    const vanished = uuid(); // an episode_id that names no episode at all
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, deleted_at, created_at, updated_at)
               VALUES (:live, :show, 'Live', 1, 'draft', NULL, NOW(), NOW()),
                      (:gone, :show, 'Deleted', 2, 'draft', NOW(), NOW(), NOW())`, { live, gone, show });
    const episodeRow = (episodeId, type, amount) => run(
      `INSERT INTO financial_transactions (id, show_id, episode_id, type, category, amount, status, created_at, updated_at)
       VALUES (:id, :show, :episodeId, :type, 'test', :amount, 'executed', NOW(), NOW())`,
      { id: uuid(), show, episodeId, type, amount });
    await ledgerRow(show, 'income', 1000, 'seed');
    await episodeRow(live, 'expense', 100);
    await episodeRow(gone, 'expense', 400);
    await episodeRow(vanished, 'income', 50);

    const { balance } = await sync(show);

    expect(balance).toBe(900); // 1000 − 100; the deleted and vanished episodes' rows are history only
    expect(await getCurrentBalance(sequelize, show)).toBe(900);
    const [{ n }] = await q(`SELECT COUNT(*)::int AS n FROM financial_transactions WHERE show_id = :show`, { show });
    expect(n).toBe(4); // nothing is deleted
    await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
    await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
  });

  it('a rollback takes the seed and the coin write with it', async () => {
    const show = await seedShow();

    await expect(sequelize.transaction(async (transaction) => {
      await syncCoinsFromLedger(sequelize, show, { transaction });
      throw new Error('caller failed');
    })).rejects.toThrow('caller failed');

    expect(await seedCount(show)).toBe(0);
    expect(await coinsByKey(show)).toEqual([['lala', 500]]);
  });

  it('throws for a show that does not exist', async () => {
    await expect(sync(uuid())).rejects.toThrow('not found');
  });

  describe('spendFromLedger', () => {
    it('allows a spend of the whole balance and refuses one coin more, writing nothing', async () => {
      const show = await seedShow({ metadata: { starting_balance: 300 } });

      const ok = await sequelize.transaction((transaction) =>
        spendFromLedger(sequelize, { showId: show, cost: 300, transaction }));
      const refused = sequelize.transaction((transaction) =>
        spendFromLedger(sequelize, { showId: show, cost: 301, transaction, action: 'wardrobe_purchase' }));

      expect(ok).toEqual({ balance: 300, cost: 300 });
      await expect(refused).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS', needed: 301, have: 300, action: 'wardrobe_purchase' });
      expect(await coinsByKey(show)).toEqual([['lala', 500]]);
    });

    it('two concurrent spends that together exceed the balance: exactly one books', async () => {
      const show = await seedShow({ metadata: { starting_balance: 300 } });
      const spend = () => sequelize.transaction(async (transaction) => {
        const { cost } = await spendFromLedger(sequelize, { showId: show, cost: 200, transaction });
        await logTransaction(sequelize, show, { type: 'expense', category: 'wardrobe_purchase', amount: cost, transaction });
        return syncCoinsFromLedger(sequelize, show, { transaction });
      });

      const results = await Promise.allSettled([spend(), spend()]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((r) => r.status === 'rejected').reason.code).toBe('INSUFFICIENT_COINS');
      expect(await coinsByKey(show)).toEqual([['lala', 100]]);
      expect(await seedCount(show)).toBe(1);
    });
  });

  it('logTransaction books whole coins (Q7)', async () => {
    const show = await seedShow();

    const logged = await logTransaction(sequelize, show, { type: 'expense', category: 'test', amount: 10.5 });

    expect(logged.amount).toBe(11);
    const [row] = await q(`SELECT amount FROM financial_transactions WHERE id = :id`, { id: logged.id });
    expect(Number(row.amount)).toBe(11);
  });
});

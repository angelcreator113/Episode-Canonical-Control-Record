/**
 * The script writer's money context reads the ledger and says Prime Coins
 * (docs/EVENT_EPISODE_FLOW.md §8(z) Law 0 and Law 14; §8(aa) M4; Task #2288).
 *
 * It printed "Income: $… | Expenses: $… | Balance: $…", with the "balance"
 * being one episode's net from episodes.total_income/total_expenses.
 *
 * The show starts at 1900. Its episode carries a 300 purchase (counted), a
 * voided 500 (not counted), and stale columns (income 999, expenses 1640).
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { loadScriptContext, buildFullPrompt } = require('../../src/services/episodeScriptWriterService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)("script writer's money context reads the ledger (#2288)", () => {
  const ids = { show: uuid(), ep: uuid(), event: uuid() };

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1900}' AS jsonb), NOW(), NOW())`,
      { ...ids, name: `Script money ${ids.show.slice(0, 8)}`, slug: `smoney-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, total_income, total_expenses, created_at, updated_at)
               VALUES (:ep, :show, 'Script money episode', 1, 'draft', 999, 1640, NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, payment_amount,
                 prestige, created_at, updated_at)
               VALUES (:event, :show, 'Script Gala', 'used', :ep, 250, false, 0, 5, NOW(), NOW())`, ids);
    await run(`INSERT INTO financial_transactions (id, show_id, episode_id, type, category, amount, status, created_at, updated_at)
               VALUES (:a, :show, NULL, 'income', 'seed', 1900, 'executed', NOW(), NOW()),
                      (:b, :show, :ep, 'expense', 'wardrobe_purchase', 300, 'executed', NOW(), NOW()),
                      (:c, :show, :ep, 'expense', 'wardrobe_purchase', 500, 'voided', NOW(), NOW())`,
      { ...ids, a: uuid(), b: uuid(), c: uuid() });
  });

  afterAll(async () => {
    await run(`DELETE FROM financial_transactions WHERE show_id = :show`, ids);
    await run(`DELETE FROM world_events WHERE show_id = :show`, ids);
    await run(`DELETE FROM episodes WHERE show_id = :show`, ids);
    await run(`DELETE FROM shows WHERE id = :show`, ids);
  });

  it("the context carries Lala's ledger balance and the episode's counted rows", async () => {
    const context = await loadScriptContext(ids.ep, ids.show, models);

    expect(context.financial).toMatchObject({
      balance: 1600, // 1900 − 300; the voided 500 does not count
      total_income: 0,
      total_expenses: 300,
      pressure_level: 'comfortable',
      event_cost: 250,
      can_afford: true,
    });
  });

  it('the prompt states the balance in Prime Coins, with no $', async () => {
    const context = await loadScriptContext(ids.ep, ids.show, models);
    const prompt = buildFullPrompt(context);

    expect(prompt).toContain("Lala's balance: 1600 Prime Coins");
    expect(prompt).toContain('This episode so far: income 0 Prime Coins | expenses 300 Prime Coins');
    expect(prompt).not.toMatch(/Balance: \$/);
    expect(prompt).not.toMatch(/Income: \$/);
    expect(prompt).not.toContain('999');
    expect(prompt).not.toContain('1640');
  });
});

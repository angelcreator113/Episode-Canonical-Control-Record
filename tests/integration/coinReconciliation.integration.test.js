/**
 * D1's one-time reconciliation, applied per approved show (§8(y) Q2, Q9;
 * §8(aa) M6; Task #2250). The scenario mirrors Evoni's approval for the
 * live show: a 1900 seed plus four test wardrobe purchases (1,440), approved
 * at 1900 with the four purchases voided.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { applyReconciliation } = require('../../src/services/coinReconciliation');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('D1 reconciliation apply (§8(y) Q9)', () => {
  const shows = [];

  async function seedShow({ purchases = [360, 360, 360, 360], coins = 460 } = {}) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Recon ${show.slice(0, 8)}`, slug: `recon-${show.slice(0, 8)}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, created_at, updated_at)
               VALUES (:id, :show, 'lala', :coins, NOW(), NOW())`, { id: uuid(), show, coins });
    await run(`INSERT INTO financial_transactions (id, show_id, type, category, amount, status, created_at, updated_at)
               VALUES (:id, :show, 'income', 'seed', 1900, 'executed', NOW(), NOW())`, { id: uuid(), show });
    const purchaseIds = [];
    for (const amount of purchases) {
      const id = uuid();
      purchaseIds.push(id);
      await run(`INSERT INTO financial_transactions (id, show_id, type, category, amount, status, metadata, created_at, updated_at)
                 VALUES (:id, :show, 'expense', 'wardrobe_purchase', :amount, 'executed', '{"flow":"purchase"}'::jsonb, NOW(), NOW())`,
        { id, show, amount });
    }
    return { show, purchaseIds };
  }

  const coinsOf = async (show) => (await q(`SELECT coins FROM character_state WHERE show_id = :show`, { show }))[0].coins;
  const rowsOf = (show) => q(
    `SELECT id, category, status, metadata FROM financial_transactions WHERE show_id = :show ORDER BY category, id`, { show });
  const approval = (show, purchaseIds, approvedBalance = 1900) => ({
    show_id: show,
    approved_balance: approvedBalance,
    void_transaction_ids: purchaseIds,
    void_reason: 'Test data, not story purchases (Evoni, 2026-09-29)',
    approved_on: '2026-09-29',
  });

  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('a dry run reports the outcome and changes nothing', async () => {
    const { show, purchaseIds } = await seedShow();
    const before = await rowsOf(show);

    const outcome = await applyReconciliation(sequelize, [approval(show, purchaseIds)], { dryRun: true });

    expect(outcome.refused).toEqual([]);
    expect(outcome.results[0]).toMatchObject({ show_id: show, coins_before: 460, coins_after: 1900, applied: false });
    expect(outcome.results[0].voided).toHaveLength(4);
    expect(await rowsOf(show)).toEqual(before);
    expect(await coinsOf(show)).toBe(460);
  });

  it('applies: voids the approved rows (kept, marked, with the reason) and sets coins to the approved balance', async () => {
    const { show, purchaseIds } = await seedShow();

    const outcome = await applyReconciliation(sequelize, [approval(show, purchaseIds)], { dryRun: false, actor: 'evoni' });

    expect(outcome.results[0]).toMatchObject({ coins_after: 1900, applied: true, lala_rows_updated: 1 });
    expect(await coinsOf(show)).toBe(1900);
    const rows = await rowsOf(show);
    expect(rows).toHaveLength(5); // nothing deleted
    const purchases = rows.filter((r) => r.category === 'wardrobe_purchase');
    expect(purchases.map((r) => r.status)).toEqual(['voided', 'voided', 'voided', 'voided']);
    expect(purchases[0].metadata).toMatchObject({
      voided: true, void_reason: 'Test data, not story purchases (Evoni, 2026-09-29)', voided_by: 'evoni', flow: 'purchase',
    });
    expect(rows.find((r) => r.category === 'seed').status).toBe('executed');
  });

  it('refuses, and rolls back, when the ledger does not sum to the approved balance', async () => {
    const { show, purchaseIds } = await seedShow();

    // Only three of the four voided: 1900 − 360 = 1540, not the approved 1900.
    const outcome = await applyReconciliation(sequelize, [approval(show, purchaseIds.slice(0, 3))], { dryRun: false });

    expect(outcome.results).toEqual([]);
    expect(outcome.refused[0].reason).toMatch(/sums to 1540 after the voids, not the approved 1900/);
    expect((await rowsOf(show)).every((r) => r.status === 'executed')).toBe(true);
    expect(await coinsOf(show)).toBe(460);
  });

  it("refuses a void of another show's row, and does not stop the other approvals", async () => {
    const a = await seedShow();
    const b = await seedShow();

    const outcome = await applyReconciliation(sequelize, [
      approval(a.show, [b.purchaseIds[0], ...a.purchaseIds.slice(1)]),
      approval(b.show, b.purchaseIds),
    ], { dryRun: false });

    expect(outcome.refused).toEqual([{ show_id: a.show, reason: expect.stringMatching(/belongs to another show/) }]);
    expect(outcome.results.map((r) => r.show_id)).toEqual([b.show]);
    expect(await coinsOf(a.show)).toBe(460);
    expect(await coinsOf(b.show)).toBe(1900);
  });

  describe('POST /api/v1/admin/coins/reconcile', () => {
    const token = (groups) => TokenService.generateTokenPair({
      id: `test-recon-${groups.join('-')}`, email: 'recon@test.dev', name: 'Recon', groups, role: groups[0],
    }).accessToken;
    const post = (groups, body) => request(app)
      .post('/api/v1/admin/coins/reconcile')
      .set('Authorization', `Bearer ${token(groups)}`)
      .send(body);

    it('is ADMIN only', async () => {
      const res = await post(['USER', 'EDITOR'], {});
      expect(res.status).toBe(403);
    });

    it('dry-runs by default, applying only the checked-in approvals', async () => {
      const res = await post(['ADMIN'], {});
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, dry_run: true, approvals: 0, results: [], refused: [] });
    });

    it('a real apply needs the confirmation string', async () => {
      const res = await post(['ADMIN'], { dry_run: false });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CONFIRMATION_REQUIRED');
    });
  });
});

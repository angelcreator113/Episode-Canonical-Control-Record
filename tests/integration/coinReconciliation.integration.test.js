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

  it("the checked-in approval, run against the live show's rows as Evoni's query showed them, lands on 1900", async () => {
    const { D1_RECONCILIATION_APPROVALS } = require('../../src/config/d1ReconciliationApprovals');
    const show = '9bd0655f-0426-4da4-95b8-44cdfd608b2b';
    const cleanup = async () => {
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    };
    await cleanup();
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, 'Live show replay', 'live-show-replay', NOW(), NOW())`, { show });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, created_at, updated_at)
               VALUES ('5fd6a9df-4c2c-4a6e-957e-665ae2092b2f', :show, 'lala', 560, NOW(), NOW())`, { show });
    // Evoni's production read of the show's ledger, 2026-09-29.
    const rows = [
      ['305eed68-5689-4961-8ce6-ca6d1dd613a8', 'seed', 'income', 1900, null],
      ['1e9da9a3-e7fc-48a7-850e-295c1ae7945d', 'wardrobe_purchase', 'expense', 285, null],
      ['d7b34f33-b51d-4d3f-8659-3f2dd2516575', 'wardrobe_purchase', 'expense', 385, null],
      ['b008d849-f3f1-4306-a32f-31ae18d844ac', 'wardrobe_purchase', 'expense', 385, null],
      ['3408a459-f230-48e5-8c80-11fd1c173588', 'wardrobe_purchase', 'expense', 385, 'be95953c-8965-4953-b20b-951ee12ea807'],
    ];
    for (const [id, category, type, amount, episodeId] of rows) {
      await run(`INSERT INTO financial_transactions (id, show_id, episode_id, type, category, amount, status, created_at, updated_at)
                 VALUES (:id, :show, :episodeId, :type, :category, :amount, 'executed', NOW(), NOW())`,
        { id, show, episodeId, type, category, amount });
    }
    const voids = D1_RECONCILIATION_APPROVALS[0].void_transaction_ids;
    const voidTotal = rows.filter(([id]) => voids.includes(id)).reduce((sum, r) => sum + r[3], 0);

    try {
      expect(voidTotal).toBe(1440);
      const dry = await applyReconciliation(sequelize, D1_RECONCILIATION_APPROVALS, { dryRun: true });
      expect(dry.refused).toEqual([]);
      expect(dry.results[0]).toMatchObject({ coins_before: 560, coins_after: 1900, applied: false });
      const applied = await applyReconciliation(sequelize, D1_RECONCILIATION_APPROVALS, { dryRun: false, actor: 'test' });
      expect(applied.results[0]).toMatchObject({ coins_after: 1900, applied: true });
      expect(await coinsOf(show)).toBe(1900);
      const statuses = await q(`SELECT category, status FROM financial_transactions WHERE show_id = :show ORDER BY category`, { show });
      expect(statuses).toEqual([
        { category: 'seed', status: 'executed' },
        ...Array(4).fill({ category: 'wardrobe_purchase', status: 'voided' }),
      ]);
      // A second run is refused: the rows are already voided, so nothing is applied twice.
      const again = await applyReconciliation(sequelize, D1_RECONCILIATION_APPROVALS, { dryRun: true });
      expect(again.refused[0].reason).toMatch(/not a live executed row \(status voided\)/);
    } finally {
      await cleanup();
    }
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
      // The checked-in approval names the production show, which this test
      // database does not have: it is reported refused and nothing changes.
      expect(res.body).toMatchObject({ success: false, dry_run: true, approvals: 1, results: [] });
      expect(res.body.refused).toEqual([{
        show_id: '9bd0655f-0426-4da4-95b8-44cdfd608b2b',
        reason: expect.stringMatching(/show not found/),
      }]);
    });

    it('a real apply needs the confirmation string', async () => {
      const res = await post(['ADMIN'], { dry_run: false });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CONFIRMATION_REQUIRED');
    });
  });
});

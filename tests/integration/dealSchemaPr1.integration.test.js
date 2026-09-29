/**
 * Integration Tests - deal build PR 1, the schema (docs/DEAL_DESIGN.md §8;
 * Task #2319). Migrations 20260929200000–20260929200004:
 *
 *   M-1 world_events deal terms   M-2 event_deliverables.fee
 *   M-3 deal_rate_anchors + deal_rate_premiums, version 1 seeded from
 *       Evoni's QUESTION 4 answer (docs/EVENT_EPISODE_FLOW.md §8(cc))
 *   M-4 event_costs               M-5 one executed ledger row per deal payout
 *
 * The test database is built by the migration tree (CI runs `npm run
 * migrate:up` first), so what is read here is what these migrations made.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const models = require('../../src/models');

const { sequelize } = models;
const FILES = [
  '20260929200000-add-world-events-deal-terms',
  '20260929200001-add-event-deliverables-fee',
  '20260929200002-create-deal-rate-anchors',
  '20260929200003-create-event-costs',
  '20260929200004-add-ledger-deal-payout-unique',
];
const migrations = FILES.map((f) => require(`../../src/migrations/${f}`));

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

// Evoni's starting anchors (Prime Coins), Emerging … Elite; "—" is null.
const RULED_ANCHORS = {
  paid_appearance: [150, 250, 450, 650, 900],
  reel: [75, 125, 225, 325, 450],
  stories_3: [35, 60, 110, 160, 225],
  brand_partnership_base: [null, 500, 900, 1300, 1800],
  performance_booking: [100, 200, 400, 600, 850],
};
const RULED_PREMIUMS = {
  'rush 48h': 10, 'rush 24h': 20,
  'usage 30d': 15, 'usage 90d': 25,
  'exclusivity 7d': 10, 'exclusivity 30d': 25, 'exclusivity 90d': 40,
  'paid_ad whitelisting': null,
};

const readAnchors = async () => {
  const rows = await q(`SELECT component, career_tier, amount FROM deal_rate_anchors WHERE version = 1 AND deleted_at IS NULL ORDER BY component, career_tier`);
  const out = {};
  for (const r of rows) (out[r.component] ||= []).push(r.amount);
  return out;
};
const readPremiums = async () => Object.fromEntries(
  (await q(`SELECT kind, key, percent FROM deal_rate_premiums WHERE version = 1 AND deleted_at IS NULL`))
    .map((r) => [`${r.kind} ${r.key}`, r.percent])
);
const readSchema = async () => ({
  columns: await q(
    `SELECT table_name, column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ((table_name = 'world_events' AND column_name IN ('deal_type','appearance_fee','bonus_terms','gifted_value','pricing_version'))
          OR (table_name = 'event_deliverables' AND column_name = 'fee'))
      ORDER BY table_name, column_name`),
  tables: (await q(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'
                     AND tablename IN ('deal_rate_anchors','deal_rate_premiums','event_costs') ORDER BY tablename`)).map((r) => r.tablename),
  index: (await q(`SELECT indexname FROM pg_indexes WHERE indexname = 'financial_transactions_deal_payout_once'`)).length,
});

(shouldSkip ? describe.skip : describe)('Deal build PR 1: schema (Task #2319)', () => {
  const shows = [];
  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM event_costs WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  async function makeEvent() {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Deal PR1 ${ids.show.slice(0, 8)}`, slug: `deal-pr1-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, created_at, updated_at)
               VALUES (:event, :show, 'Deal schema event', 'invite', 'ready', NOW(), NOW())`, ids);
    return ids;
  }

  it('M-1 and M-2 add six nullable columns', async () => {
    expect((await readSchema()).columns).toEqual([
      { table_name: 'event_deliverables', column_name: 'fee', data_type: 'integer', is_nullable: 'YES' },
      { table_name: 'world_events', column_name: 'appearance_fee', data_type: 'integer', is_nullable: 'YES' },
      { table_name: 'world_events', column_name: 'bonus_terms', data_type: 'jsonb', is_nullable: 'YES' },
      { table_name: 'world_events', column_name: 'deal_type', data_type: 'character varying', is_nullable: 'YES' },
      { table_name: 'world_events', column_name: 'gifted_value', data_type: 'integer', is_nullable: 'YES' },
      { table_name: 'world_events', column_name: 'pricing_version', data_type: 'integer', is_nullable: 'YES' },
    ]);
  });

  it('M-3 seeds version 1 with the ruled anchors and premiums', async () => {
    expect(await readAnchors()).toEqual(RULED_ANCHORS);
    expect(await readPremiums()).toEqual(RULED_PREMIUMS);
  });

  it('running every up again changes nothing (guards hold, seed not duplicated)', async () => {
    const before = { schema: await readSchema(), anchors: await readAnchors(), premiums: await readPremiums() };
    for (const m of migrations) await m.up(sequelize.getQueryInterface(), Sequelize);
    expect({ schema: await readSchema(), anchors: await readAnchors(), premiums: await readPremiums() }).toEqual(before);
    const [{ n }] = await q(`SELECT COUNT(*)::int AS n FROM deal_rate_anchors`);
    expect(n).toBe(25);
  });

  it('down removes exactly what up added; up restores it', async () => {
    const before = await readSchema();
    for (const m of [...migrations].reverse()) await m.down(sequelize.getQueryInterface(), Sequelize);
    expect(await readSchema()).toEqual({ columns: [], tables: [], index: 0 });
    for (const m of migrations) await m.up(sequelize.getQueryInterface(), Sequelize);
    expect(await readSchema()).toEqual(before);
    expect(await readAnchors()).toEqual(RULED_ANCHORS);
  });

  it('M-5 refuses a second executed payout row for the same source, and nothing else', async () => {
    const ids = await makeEvent();
    const row = (category, status = 'executed') => run(
      `INSERT INTO financial_transactions (id, show_id, event_id, type, category, amount, source_type, source_id, status, created_at, updated_at)
       VALUES (:id, :show, :event, 'income', :category, 100, 'event', :event, :status, NOW(), NOW())`,
      { ...ids, id: uuid(), category, status });

    await row('appearance_fee');
    await expect(row('appearance_fee')).rejects.toMatchObject({
      name: 'SequelizeUniqueConstraintError',
      parent: { constraint: 'financial_transactions_deal_payout_once' },
    });
    await row('appearance_fee', 'reversed'); // a reversed row is not a payout
    await row('deal_bonus'); // another category, same source
    await row('event_payment'); // legacy categories are untouched
    await row('event_payment');
  });

  it('models accept the new fields and check them with isIn', async () => {
    const { WorldEvent, EventDeliverable, EventCost, DealRateAnchor, DealRatePremium } = models;
    expect(WorldEvent.DEAL_TYPES).toEqual(['self_funded', 'invited_comped', 'gifted', 'paid_appearance',
      'paid_deliverables', 'appearance_plus_deliverables', 'performance_booking', 'brand_partnership']);

    const only = (field) => ({ fields: [field] });
    await expect(WorldEvent.build({ deal_type: 'paid_appearance' }).validate(only('deal_type'))).resolves.toBeDefined();
    await expect(WorldEvent.build({ deal_type: null }).validate(only('deal_type'))).resolves.toBeDefined();
    await expect(WorldEvent.build({ deal_type: 'sponsorship' }).validate(only('deal_type'))).rejects.toThrow();
    await expect(EventCost.build({ kind: 'lunch' }).validate(only('kind'))).rejects.toThrow();
    await expect(EventCost.build({ paid_by: 'agent' }).validate(only('paid_by'))).rejects.toThrow();
    await expect(DealRateAnchor.build({ component: 'tiktok' }).validate(only('component'))).rejects.toThrow();
    await expect(DealRatePremium.build({ kind: 'prestige' }).validate(only('kind'))).rejects.toThrow();

    // Model reads and writes against the migrated tables.
    const ids = await makeEvent();
    const event = await WorldEvent.findByPk(ids.event);
    expect(event.deal_type).toBeNull();
    const cost = await EventCost.create({ event_id: ids.event, kind: 'travel', amount: 120, paid_by: 'host' });
    expect(cost.paid_by).toBe('host');
    expect(await DealRateAnchor.count({ where: { version: 1 } })).toBe(25);
    expect(await DealRatePremium.count({ where: { version: 1 } })).toBe(8);
    expect(EventDeliverable.rawAttributes.fee).toBeDefined();
  });
});

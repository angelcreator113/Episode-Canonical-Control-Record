/**
 * Integration Tests - image generation cost in ai_usage_logs (Task #2387;
 * 20261001100000-add-image-cost-columns-to-ai-usage-logs).
 *
 * Against the test database: the migration is re-runnable; an image call's
 * row is written with its cost (or NULL for an unpriced model); a freshly
 * loaded service (a restarted process) reads today's persisted spend and
 * refuses a call over the image budget before the provider runs.
 */
const { Sequelize } = require('sequelize');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261001100000-add-image-cost-columns-to-ai-usage-logs');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const ROUTE = 'itest-image-cost-2387';

function loadFresh() {
  let imageCost;
  jest.isolateModules(() => {
    imageCost = require('../../src/services/imageCostService');
  });
  return imageCost;
}

(shouldSkip ? describe.skip : describe)('Image cost tracking (Task #2387)', () => {
  let savedBudget;

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    await migration.up(sequelize.getQueryInterface(), Sequelize);   // guarded: a re-run is a no-op
  });

  beforeEach(async () => {
    savedBudget = process.env.AI_DAILY_IMAGE_BUDGET_USD;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await sequelize.query('DELETE FROM ai_usage_logs WHERE billing_unit IS NOT NULL');
  });

  afterEach(() => {
    if (savedBudget === undefined) delete process.env.AI_DAILY_IMAGE_BUDGET_USD;
    else process.env.AI_DAILY_IMAGE_BUDGET_USD = savedBudget;
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await sequelize.query('DELETE FROM ai_usage_logs WHERE route_name = :r', { replacements: { r: ROUTE } });
    await sequelize.close();
  });

  it('the three columns exist and are nullable', async () => {
    const cols = await sequelize.query(
      `SELECT column_name, is_nullable FROM information_schema.columns
        WHERE table_name = 'ai_usage_logs' AND column_name IN ('provider','billing_unit','billed_units','cost_usd')
        ORDER BY column_name`,
      { type: sequelize.QueryTypes.SELECT },
    );
    expect(cols).toEqual([
      { column_name: 'billed_units', is_nullable: 'YES' },
      { column_name: 'billing_unit', is_nullable: 'YES' },
      { column_name: 'cost_usd', is_nullable: 'YES' },
      { column_name: 'provider', is_nullable: 'YES' },
    ]);
  });

  it('logs priced and unpriced calls; a restarted process sees the persisted spend and refuses over budget', async () => {
    const first = loadFresh();
    const provider = jest.fn(async () => 'ok');
    await first.runImageCall({ model: 'fal-ai/flux-pro/v1.1', width: 1024, height: 576, routeName: ROUTE }, provider);
    await first.runImageCall({ model: 'nightmareai/real-esrgan', provider: 'replicate', routeName: ROUTE }, provider);
    expect(provider).toHaveBeenCalledTimes(2);

    const rows = await sequelize.query(
      `SELECT model_name, cost_usd, provider, billing_unit, billed_units
         FROM ai_usage_logs WHERE route_name = :r ORDER BY id`,
      { replacements: { r: ROUTE }, type: sequelize.QueryTypes.SELECT },
    );
    expect(rows).toEqual([
      { model_name: 'fal-ai/flux-pro/v1.1', cost_usd: '0.040000', provider: 'fal', billing_unit: 'megapixel', billed_units: '1.0000' },
      { model_name: 'nightmareai/real-esrgan', cost_usd: null, provider: 'replicate', billing_unit: 'image', billed_units: '1.0000' },
    ]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/no price for nightmareai\/real-esrgan/));

    // A new process: nothing in memory, only the table.
    const second = loadFresh();
    const status = await second.getImageBudgetStatus();
    expect(status.spend).toBeCloseTo(0.04, 6);
    expect(status.calls).toBe(2);

    process.env.AI_DAILY_IMAGE_BUDGET_USD = '0.05';   // 0.04 spent + 0.04 would pass it
    const blocked = jest.fn(async () => 'never');
    await expect(
      second.runImageCall({ model: 'fal-ai/flux-pro/v1.1', width: 1024, height: 576, routeName: ROUTE }, blocked),
    ).rejects.toMatchObject({
      status: 429,
      code: 'AI_BUDGET_EXCEEDED',
      message: 'Daily image budget reached ($0.04 of $0.05). Image generation is paused until tomorrow (UTC).',
    });
    expect(blocked).not.toHaveBeenCalled();
  });
});

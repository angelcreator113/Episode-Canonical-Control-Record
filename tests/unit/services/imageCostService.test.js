// ============================================================================
// imageCostService — image generation cost logged and budget-gated (#2387)
// ============================================================================
// ai_usage_logs is an in-memory array behind a mocked AIUsageLog (sum / count
// / create honour the created_at and billing_unit filters the services use).
// Provider HTTP (axios) and the Replicate client are mocked. Each test loads
// the services fresh, as a restarted process would. No network, no database.

const mockRows = [];

// Evaluate the where clauses these services build: { created_at: { [Op.gte]: d } }
// and { billing_unit: { [Op.ne]: null } }. Op keys are Symbols.
function mockMatches(row, where = {}) {
  for (const [col, cond] of Object.entries(where)) {
    const syms = Object.getOwnPropertySymbols(cond || {});
    for (const sym of syms) {
      const v = cond[sym];
      const name = sym.toString();
      if (name.includes('gte') && !(new Date(row[col]) >= v)) return false;
      if (name.includes('ne') && !name.includes('gte') && row[col] === v) return false;
    }
  }
  return true;
}

jest.mock('../../../src/models', () => ({
  AIUsageLog: {
    sum: jest.fn(async (col, { where } = {}) => mockRows
      .filter((r) => mockMatches(r, where))
      .reduce((acc, r) => acc + (r[col] == null ? 0 : Number(r[col])), 0)),
    count: jest.fn(async ({ where } = {}) => mockRows.filter((r) => mockMatches(r, where)).length),
    create: jest.fn(async (row) => {
      const stored = { ...row, billing_unit: row.billing_unit ?? null, created_at: new Date() };
      mockRows.push(stored);
      return stored;
    }),
  },
}));

jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
const axios = require('axios');

const FLUX_OK = { status: 200, data: { images: [{ url: 'https://fal.media/x.jpg', seed: 7 }] } };

function loadFresh() {
  let imageGen;
  let imageCost;
  jest.isolateModules(() => {
    imageCost = require('../../../src/services/imageCostService');
    imageGen = require('../../../src/services/imageGenerationService');
  });
  return { imageGen, imageCost };
}

const imageRow = (cost, extra = {}) => ({
  route_name: 'seed', model_name: 'fal-ai/flux-pro/v1.1', cost_usd: cost,
  provider: 'fal', billing_unit: 'megapixel', billed_units: 1, created_at: new Date(), ...extra,
});
const anthropicRow = (cost) => ({
  route_name: 'seed', model_name: 'claude-sonnet-4-6', cost_usd: cost, billing_unit: null, created_at: new Date(),
});

let savedEnv;
beforeEach(() => {
  mockRows.length = 0;
  axios.post.mockReset();
  savedEnv = { ...process.env };
  process.env.FAL_KEY = 'test-fal';
  process.env.OPENAI_API_KEY = 'test-openai';
  delete process.env.AI_DAILY_BUDGET_USD;
  delete process.env.AI_DAILY_IMAGE_BUDGET_USD;
  delete process.env.IMAGE_PROVIDER;
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  jest.setSystemTime(new Date('2026-09-30T12:00:00.000Z'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
// Let the tracker's start-up read (scheduled with setImmediate) finish inside the test.
const settle = () => new Promise((r) => setImmediate(r)).then(() => new Promise((r) => setImmediate(r)));
afterEach(async () => {
  await settle();
  process.env = savedEnv;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('rate table and estimate', () => {
  test('Evoni\'s published rates, each with a source note; unpriced models are null, never 0', () => {
    const { imageCost } = loadFresh();
    const T = imageCost.RATE_TABLE;
    expect(T['fal-ai/flux-pro/v1.1']).toMatchObject({ unit: 'megapixel', usd: 0.04 });
    expect(T['fal-ai/flux/dev']).toMatchObject({ unit: 'megapixel', usd: 0.025 });
    expect(T['fal-ai/flux-pro/kontext']).toMatchObject({ unit: 'image', usd: 0.04 });
    for (const rate of Object.values(T)) {
      expect(typeof rate.source).toBe('string');
      expect(rate.source.length).toBeGreaterThan(0);
      expect(rate.usd === null || rate.usd > 0).toBe(true);
    }
    expect(T['dall-e-3'].usd).toBeNull();
    expect(T['gpt-image-1'].usd).toBeNull();
  });

  test('megapixels are rounded up per image; per-image models bill the count', () => {
    const { imageCost } = loadFresh();
    expect(imageCost.estimateImageCost({ model: 'fal-ai/flux-pro/v1.1', width: 1024, height: 576 }))
      .toMatchObject({ unit: 'megapixel', units: 1, usd: 0.04, priced: true });
    expect(imageCost.estimateImageCost({ model: 'fal-ai/flux/dev', width: 2048, height: 2048, count: 2 }))
      .toMatchObject({ units: 10, usd: 0.25 });   // 4.19 MP -> 5, x2
    expect(imageCost.estimateImageCost({ model: 'fal-ai/flux-pro/kontext', count: 3 }))
      .toMatchObject({ unit: 'image', units: 3, usd: 0.12 });
    expect(imageCost.estimateImageCost({ model: 'someone/new-model:abc' }))
      .toMatchObject({ model: 'someone/new-model', usd: null, priced: false });
  });

  test('imageGenerationService estimates a planned generation from the same table', () => {
    const { imageGen } = loadFresh();
    expect(imageGen.estimateGenerationCost({ size: 'landscape', quality: 'hd' }))
      .toMatchObject({ model: 'fal-ai/flux-pro/v1.1', usd: 0.04, priced: true });
    expect(imageGen.estimateGenerationCost({ size: 'square', quality: 'standard' }))
      .toMatchObject({ model: 'fal-ai/flux/dev', usd: 0.025 });
    expect(imageGen.estimateImageFromImageCost()).toMatchObject({ model: 'fal-ai/flux-pro/kontext', usd: 0.04 });
  });
});

describe('logging', () => {
  test('a Flux generation writes its cost to ai_usage_logs', async () => {
    axios.post.mockResolvedValue(FLUX_OK);
    const { imageGen } = loadFresh();
    const result = await imageGen.generateImage('a gold frame', { size: 'landscape', quality: 'hd', useCase: 'overlay' });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(result.cost_estimate).toBe(0.04);
    const logged = mockRows.filter((r) => r.billing_unit);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      model_name: 'fal-ai/flux-pro/v1.1', cost_usd: 0.04, provider: 'fal',
      billing_unit: 'megapixel', billed_units: 1, is_error: false,
    });
  });

  test('a Kontext call logs the per-image price', async () => {
    axios.post.mockResolvedValue(FLUX_OK);
    const { imageGen } = loadFresh();
    await imageGen.generateImageFromImage('https://ref/x.jpg', 'studio shot');
    expect(mockRows.at(-1)).toMatchObject({ model_name: 'fal-ai/flux-pro/kontext', cost_usd: 0.04, billing_unit: 'image' });
  });

  test('an unpriced model is logged with cost NULL and a warning, never 0', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { data: [{ url: 'https://openai/x.png' }] } });
    const { imageGen } = loadFresh();
    const result = await imageGen.generateDallE('an invitation', { size: 'portrait' });
    expect(result.cost_estimate).toBeNull();
    expect(mockRows.at(-1)).toMatchObject({ model_name: 'dall-e-3', cost_usd: null, provider: 'openai', billing_unit: 'image' });
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/no price for dall-e-3.*cost_usd NULL/));
  });

  test('Replicate runs and predictions through trackReplicate are logged (unpriced: NULL)', async () => {
    const { imageCost } = loadFresh();
    const client = {
      run: jest.fn(async () => 'https://replicate.delivery/out.png'),
      predictions: { create: jest.fn(async () => ({ id: 'p1' })), get: jest.fn(async () => ({ status: 'succeeded' })) },
    };
    const tracked = imageCost.trackReplicate(client);
    await tracked.run('nightmareai/real-esrgan:f121d640', { input: { scale: 4 } });
    await tracked.predictions.create({ version: 'cdac78a1bec5b23c07fd29692fb70baa513ea403a39e643c48ec5edadb15fe72', input: {} });
    await tracked.predictions.get('p1');
    expect(client.run).toHaveBeenCalledTimes(1);
    expect(client.predictions.get).toHaveBeenCalledWith('p1');
    const rows = mockRows.filter((r) => r.provider === 'replicate');
    expect(rows.map((r) => [r.model_name, r.cost_usd])).toEqual([
      ['nightmareai/real-esrgan', null],
      ['lama', null],
    ]);
  });

  test('a failed provider call is logged as an error row', async () => {
    axios.post.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500, data: {} } }));
    const { imageGen } = loadFresh();
    await expect(imageGen.generateImage('x', { quality: 'hd' })).rejects.toThrow('boom');
    expect(mockRows.at(-1)).toMatchObject({ is_error: true, error_type: '500', cost_usd: 0 });
  });
});

describe('budget', () => {
  test('a restart (fresh process) still sees today\'s persisted image spend', async () => {
    axios.post.mockResolvedValue(FLUX_OK);
    const first = loadFresh();
    await first.imageGen.generateImage('one', { quality: 'hd' });
    await first.imageGen.generateImage('two', { quality: 'hd' });

    const second = loadFresh();   // nothing in memory
    const status = await second.imageGen.getImageBudgetStatus();
    expect(status.spend).toBeCloseTo(0.08, 6);
    expect(status.calls).toBe(2);
    expect(status.budget).toBe(10);
  });

  test('over the image budget: refused before the provider is called, with a clear 429', async () => {
    mockRows.push(imageRow(9.99));                // AI_DAILY_IMAGE_BUDGET_USD defaults to $10
    const { imageGen, imageCost } = loadFresh();
    const err = await imageGen.generateImage('x', { quality: 'hd' }).catch((e) => e);
    expect(axios.post).not.toHaveBeenCalled();
    expect(err).toMatchObject({ status: 429, code: 'AI_BUDGET_EXCEEDED' });
    expect(imageCost.isBudgetError(err)).toBe(true);
    expect(err.message).toBe('Daily image budget reached ($9.99 of $10.00). Image generation is paused until tomorrow (UTC).');
  });

  test('image spend counts against the shared AI budget too (AI_DAILY_BUDGET_USD)', async () => {
    process.env.AI_DAILY_BUDGET_USD = '5';
    mockRows.push(anthropicRow(4.98));
    const { imageGen } = loadFresh();
    const err = await imageGen.generateImageFromImage('https://ref', 'p').catch((e) => e);
    expect(axios.post).not.toHaveBeenCalled();
    expect(err.message).toMatch(/^Daily AI budget reached \(\$4\.98 of \$5\.00\)\./);
  });

  test('yesterday\'s spend does not count', async () => {
    mockRows.push(imageRow(50, { created_at: new Date('2026-09-29T23:59:00.000Z') }));
    axios.post.mockResolvedValue(FLUX_OK);
    const { imageGen } = loadFresh();
    await expect(imageGen.generateImage('x', { quality: 'hd' })).resolves.toMatchObject({ url: FLUX_OK.data.images[0].url });
  });

  test('an unpriced call is allowed under the cap and refused once the cap is reached', async () => {
    const { imageCost } = loadFresh();
    const client = { run: jest.fn(async () => 'u'), predictions: {} };
    const tracked = imageCost.trackReplicate(client);
    mockRows.push(imageRow(9.5));
    await tracked.run('meta/sam-2-large', { input: {} });
    expect(client.run).toHaveBeenCalledTimes(1);
    mockRows.push(imageRow(0.5));
    await expect(tracked.run('meta/sam-2-large', { input: {} })).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
    expect(client.run).toHaveBeenCalledTimes(1);
  });

  test('if the log cannot be read the call is allowed with a warning (fail open)', async () => {
    const models = require('../../../src/models');
    models.AIUsageLog.sum.mockRejectedValueOnce(new Error('db down'));
    axios.post.mockResolvedValue(FLUX_OK);
    const { imageGen } = loadFresh();
    await expect(imageGen.generateImage('x', { quality: 'hd' })).resolves.toBeTruthy();
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/could not read today's spend/));
  });
});

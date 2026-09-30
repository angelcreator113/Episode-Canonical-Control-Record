// ============================================================================
// Scene base still model choice, gpt-image-1.5 rate entry, recorded costs
// (Task #2396). ai_usage_logs is an in-memory array behind a mocked
// AIUsageLog; provider HTTP (axios), S3 and sharp are mocked. No network, no
// database, no provider keys.
// ============================================================================

const mockRows = [];

jest.mock('../../../src/models', () => ({
  AIUsageLog: {
    sum: jest.fn(async () => 0),
    count: jest.fn(async () => 0),
    create: jest.fn(async (row) => {
      const stored = { ...row, id: mockRows.length + 1 };
      mockRows.push(stored);
      return stored;
    }),
  },
}));

jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));

const mockS3Send = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: (...args) => mockS3Send(...args) })),
  PutObjectCommand: jest.fn((input) => ({ input })),
  DeleteObjectCommand: jest.fn((input) => ({ input })),
}));

jest.mock('sharp', () => {
  const chain = () => {
    const c = {};
    for (const m of ['resize', 'jpeg', 'png', 'extract', 'composite', 'grayscale', 'blur', 'normalize']) c[m] = () => c;
    c.toBuffer = async () => Buffer.from('img');
    c.metadata = async () => ({ width: 1920, height: 1080 });
    return c;
  };
  return jest.fn(() => chain());
});

jest.mock('child_process', () => ({ execFile: jest.fn() }));
jest.mock('../../../src/services/artifactDetectionService', () => ({
  analyzeImageQuality: jest.fn(),
  buildRefinedPrompt: jest.fn(),
}));

const axios = require('axios');
const FormData = require('form-data');
const imageCost = require('../../../src/services/imageCostService');
const sceneGen = require('../../../src/services/sceneGenerationService');
const comparison = require('../../../src/services/sceneModelComparisonService');

const B64 = Buffer.from('png-bytes').toString('base64');

function sceneModels() {
  const updates = [];
  return {
    updates,
    SceneSet: { update: jest.fn(async (values) => { updates.push(values); return [1]; }) },
    sequelize: { query: jest.fn(async () => [[]]) },
  };
}

const saved = {};
beforeEach(() => {
  mockRows.length = 0;
  axios.post.mockReset();
  axios.get.mockReset();
  mockS3Send.mockClear();
  for (const k of ['SCENE_BASE_MODEL_DEFAULT', 'FAL_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']) saved[k] = process.env[k];
  delete process.env.SCENE_BASE_MODEL_DEFAULT;
  delete process.env.ANTHROPIC_API_KEY;
  process.env.FAL_KEY = 'test-fal';
  process.env.OPENAI_API_KEY = 'test-openai';
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  jest.restoreAllMocks();
});

describe('base model resolution', () => {
  it('null base_model uses flux-dev (today\'s behaviour)', () => {
    expect(sceneGen.resolveBaseModel({ id: 's', base_model: null })).toBe('flux-dev');
    expect(sceneGen.defaultBaseModel()).toBe('flux-dev');
  });

  it('SCENE_BASE_MODEL_DEFAULT sets the default; an unknown value warns and falls back', () => {
    process.env.SCENE_BASE_MODEL_DEFAULT = 'gpt-image-1.5';
    expect(sceneGen.resolveBaseModel({ id: 's' })).toBe('gpt-image-1.5');
    process.env.SCENE_BASE_MODEL_DEFAULT = 'dall-e-9';
    expect(sceneGen.resolveBaseModel({ id: 's' })).toBe('flux-dev');
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/SCENE_BASE_MODEL_DEFAULT="dall-e-9"/));
  });

  it('the set\'s own choice wins; an unknown stored value warns and uses the default', () => {
    process.env.SCENE_BASE_MODEL_DEFAULT = 'flux-pro-1.1';
    expect(sceneGen.resolveBaseModel({ id: 's', base_model: 'gpt-image-1.5' })).toBe('gpt-image-1.5');
    expect(sceneGen.resolveBaseModel({ id: 's', base_model: 'bogus' })).toBe('flux-pro-1.1');
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/unknown base_model "bogus"/));
  });

  it('the three models and their sizes', () => {
    expect(Object.keys(sceneGen.SCENE_BASE_MODELS)).toEqual(['flux-dev', 'flux-pro-1.1', 'gpt-image-1.5']);
    expect(sceneGen.SCENE_BASE_MODELS['flux-dev']).toMatchObject({ model: 'fal-ai/flux/dev', width: 1024, height: 576 });
    expect(sceneGen.SCENE_BASE_MODELS['flux-pro-1.1']).toMatchObject({ model: 'fal-ai/flux-pro/v1.1', width: 1024, height: 576 });
    expect(sceneGen.SCENE_BASE_MODELS['gpt-image-1.5']).toMatchObject({ model: 'gpt-image-1.5', width: 1536, height: 1024, quality: 'high' });
  });
});

describe('gpt-image-1.5 rate entry', () => {
  it('$0.20 at high 1536x1024; other sizes unpriced; input image tokens unpriced (null, not 0)', () => {
    expect(imageCost.RATE_TABLE['gpt-image-1.5']).toMatchObject({
      provider: 'openai', model: 'gpt-image-1.5', unit: 'image', usd: null,
      bySizeQuality: { 'high:1536x1024': 0.20 }, inputImageTokenUsdPerMillion: null,
    });
    const est = imageCost.estimateImageCost({ model: 'gpt-image-1.5', width: 1536, height: 1024, quality: 'high' });
    expect(est).toMatchObject({ usd: 0.2, priced: true, inputImageTokensUnpriced: true });
    expect(imageCost.estimateImageCost({ model: 'gpt-image-1.5', width: 1024, height: 1024, quality: 'high' }).usd).toBeNull();
    // gpt-image-1 keeps its priced input-token rate
    expect(imageCost.estimateImageCost({ model: 'gpt-image-1', width: 1536, height: 1024, quality: 'high' }).inputImageTokensUnpriced).toBe(false);
  });

  it('base still estimates: flux-dev $0.025, flux-pro-1.1 $0.04, gpt-image-1.5 $0.20; comparison of 2 each = $0.53', () => {
    expect(sceneGen.estimateBaseStillCost('flux-dev').usd).toBe(0.025);
    expect(sceneGen.estimateBaseStillCost('flux-pro-1.1').usd).toBe(0.04);
    expect(sceneGen.estimateBaseStillCost('gpt-image-1.5').usd).toBe(0.2);
    const est = comparison.estimateComparison(['flux-dev', 'flux-pro-1.1', 'gpt-image-1.5']);
    expect(est.total_usd).toBe(0.53);
    expect(est.unpriced).toEqual([comparison.UNPRICED_NOTES['gpt-image-1.5']]);
  });
});

describe('inputImageTokenCost with a null input-token rate', () => {
  const est = () => imageCost.estimateImageCost({ model: 'gpt-image-1.5', width: 1536, height: 1024, quality: 'high' });

  it('warns and marks unpriced when the response reports input image tokens', () => {
    const out = imageCost.inputImageTokenCost(est(), { data: { usage: { input_tokens_details: { image_tokens: 1200 } } } });
    expect(out).toEqual({ tokens: 1200, usd: 0, unpriced: true });
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/input-image-token cost for gpt-image-1.5 edits is not priced/));
  });

  it('warns for an edit that sent images even when no usage is reported', () => {
    expect(imageCost.inputImageTokenCost(est(), { data: {} }, { inputImages: true })).toEqual({ tokens: 0, usd: 0, unpriced: true });
    expect(console.warn).toHaveBeenCalled();
  });

  it('text-to-image with no input images: no warning', () => {
    expect(imageCost.inputImageTokenCost(est(), { data: {} })).toEqual({ tokens: 0, usd: 0 });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('gpt-image-1 still prices input tokens at $10 per 1M', () => {
    const e1 = imageCost.estimateImageCost({ model: 'gpt-image-1', width: 1536, height: 1024, quality: 'high' });
    expect(imageCost.inputImageTokenCost(e1, { data: { usage: { input_tokens_details: { image_tokens: 1000 } } } }))
      .toEqual({ tokens: 1000, usd: 0.01 });
  });

  it('runImageCall logs the output price and reports it through onLogged', async () => {
    const onLogged = jest.fn();
    await imageCost.runImageCall(
      { model: 'gpt-image-1.5', width: 1536, height: 1024, quality: 'high', inputImages: true, routeName: 't', onLogged },
      async () => ({ data: { usage: { input_tokens_details: { image_tokens: 500 } } } }),
    );
    expect(mockRows).toHaveLength(1);
    expect(mockRows[0]).toMatchObject({ model_name: 'gpt-image-1.5', cost_usd: 0.2, input_tokens: 500 });
    expect(onLogged).toHaveBeenCalledWith(expect.objectContaining({
      usageLogId: 1, costUsd: 0.2, estimateUsd: 0.2, inputTokens: 500, inputTokensUnpriced: true,
    }));
  });
});

describe('createCostCollector', () => {
  it('0 with no calls, the sum when priced, null (with a warning) when every call is unpriced', () => {
    const none = sceneGen.createCostCollector('none');
    expect(none.value()).toBe(0);
    const priced = sceneGen.createCostCollector('priced');
    priced.onLogged({ usageLogId: 1, costUsd: 0.04 });
    priced.onLogged({ usageLogId: 2, costUsd: 0.04 });
    expect(priced.value()).toBe(0.08);
    expect(priced.usageLogIds).toEqual([1, 2]);
    const unpriced = sceneGen.createCostCollector('unpriced');
    unpriced.onLogged({ usageLogId: 3, costUsd: null });
    expect(unpriced.value()).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/no priced cost/));
  });
});

describe('generateBaseScene records the logged cost per model', () => {
  const baseSet = (over = {}) => ({
    id: '11111111-1111-4111-8111-111111111111', name: 'Test Room', canonical_description: 'A cream bedroom.',
    generation_cost: '0', base_still_url: null, base_generation: { comparison_group: 'g1' }, ...over,
  });

  it('gpt-image-1.5: /v1/images/generations at 1536x1024 high, b64 saved to S3, cost $0.20', async () => {
    axios.post.mockResolvedValue({ data: { data: [{ b64_json: B64 }] } });
    const models = sceneModels();
    const out = await sceneGen.generateBaseScene(baseSet({ base_model: 'gpt-image-1.5' }), models, { skipAnalysis: true });

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body] = axios.post.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/images/generations');
    expect(body).toMatchObject({ model: 'gpt-image-1.5', size: '1536x1024', quality: 'high', n: 1 });
    expect(mockS3Send).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ model: 'gpt-image-1.5', cost: 0.2 });

    const final = models.updates[models.updates.length - 1];
    expect(final.generation_status).toBe('complete');
    expect(final.generation_cost).toBe(0.2);
    expect(final.base_generation).toMatchObject({
      comparison_group: 'g1', model_key: 'gpt-image-1.5', model: 'gpt-image-1.5',
      width: 1536, height: 1024, quality: 'high', estimate_usd: 0.2, cost_usd: 0.2, usage_log_ids: [1],
    });
  });

  it('gpt-image-1.5 with a style reference uses /v1/images/edits and warns the input tokens are unpriced', async () => {
    axios.get.mockResolvedValue({ data: Buffer.from('ref') });
    axios.post.mockResolvedValue({ data: { data: [{ b64_json: B64 }], usage: { input_tokens_details: { image_tokens: 800 } } } });
    const appended = [];
    jest.spyOn(FormData.prototype, 'append').mockImplementation(function (k, v) { appended.push([k, typeof v === 'string' ? v : '<buf>']); });
    jest.spyOn(FormData.prototype, 'getHeaders').mockReturnValue({});
    const models = sceneModels();
    await sceneGen.generateBaseScene(baseSet({ base_model: 'gpt-image-1.5', style_reference_url: 'https://ref/x.png' }), models, { skipAnalysis: true });

    expect(axios.post.mock.calls[0][0]).toBe('https://api.openai.com/v1/images/edits');
    expect(appended).toEqual(expect.arrayContaining([['model', 'gpt-image-1.5'], ['size', '1536x1024'], ['quality', 'high']]));
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/input-image-token cost for gpt-image-1.5 edits is not priced/));
    const final = models.updates[models.updates.length - 1];
    expect(final.generation_cost).toBe(0.2);
    expect(final.base_generation.input_tokens_unpriced).toBe(true);
  });

  it.each([
    ['flux-dev', 'fal-ai/flux/dev', 0.025],
    ['flux-pro-1.1', 'fal-ai/flux-pro/v1.1', 0.04],
    [null, 'fal-ai/flux/dev', 0.025],
  ])('%s: calls %s at landscape_16_9 and records $%s (not a literal 0.04)', async (choice, falModel, cost) => {
    axios.post.mockResolvedValue({ status: 200, data: { images: [{ url: 'https://fal.media/x.jpg' }] } });
    axios.get.mockResolvedValue({ data: Buffer.from('jpg') });
    const models = sceneModels();
    await sceneGen.generateBaseScene(baseSet({ base_model: choice, generation_cost: '0.5' }), models, { skipAnalysis: true });

    const [url, body] = axios.post.mock.calls[0];
    expect(url).toBe(`https://fal.run/${falModel}`);
    expect(body.image_size).toBe('landscape_16_9');
    const final = models.updates[models.updates.length - 1];
    expect(final.generation_cost).toBeCloseTo(0.5 + cost, 6);
    expect(final.base_generation).toMatchObject({ model: falModel, width: 1024, height: 576, cost_usd: cost });
  });
});

describe('outpaint angles use gpt-image-1.5 and report their cost', () => {
  it('cropAndOutpaint sends model gpt-image-1.5 at 1536x1024 high and logs $0.20', async () => {
    axios.get.mockResolvedValue({ data: Buffer.from('base') });
    axios.post.mockResolvedValue({ data: { data: [{ b64_json: B64 }] } });
    const appended = [];
    jest.spyOn(FormData.prototype, 'append').mockImplementation(function (k, v) { appended.push([k, typeof v === 'string' ? v : '<buf>']); });
    jest.spyOn(FormData.prototype, 'getHeaders').mockReturnValue({});
    const costs = sceneGen.createCostCollector('angle');

    const url = await sceneGen.cropAndOutpaint('https://s3/base.jpg', 'VANITY', 'set-1', 'angle-1', 'p', { onLogged: costs.onLogged });

    expect(url).toMatch(/outpaint-/);
    expect(sceneGen.OUTPAINT_MODEL).toBe('gpt-image-1.5');
    expect(appended).toEqual(expect.arrayContaining([['model', 'gpt-image-1.5'], ['size', '1536x1024'], ['quality', 'high']]));
    expect(mockRows[0]).toMatchObject({ model_name: 'gpt-image-1.5', cost_usd: 0.2 });
    expect(costs.value()).toBe(0.2);
    expect(costs.inputTokensUnpriced).toBe(true);
  });

  it('a pure crop makes no provider call and records 0', async () => {
    axios.get.mockResolvedValue({ data: Buffer.from('base') });
    const costs = sceneGen.createCostCollector('crop');
    await sceneGen.cropAndOutpaint('https://s3/base.jpg', 'DETAIL', 'set-1', 'angle-1', 'p', { onLogged: costs.onLogged });
    expect(axios.post).not.toHaveBeenCalled();
    expect(costs.value()).toBe(0);
  });
});

describe('comparison request validation', () => {
  it('needs exactly two prompts and known models', async () => {
    await expect(comparison.planComparison({ prompts: ['one'] }, {})).rejects.toMatchObject({ status: 400 });
    await expect(comparison.planComparison({ prompts: ['a', ' '] }, {})).rejects.toMatchObject({ status: 400 });
    await expect(comparison.planComparison({ prompts: ['a', 'b'], models: ['flux-dev', 'midjourney'] }, {}))
      .rejects.toMatchObject({ status: 400 });
    const plan = await comparison.planComparison({ prompts: ['a', 'b'], models: ['flux-dev', 'flux-dev'] }, {});
    expect(plan.modelKeys).toEqual(['flux-dev']);
    expect(plan.estimate.total_usd).toBe(0.05);
  });
});

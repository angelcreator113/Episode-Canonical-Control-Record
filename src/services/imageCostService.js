'use strict';

/**
 * imageCostService.js — price, budget-gate and log every image generation call
 * (Task #2387).
 *
 * One rate table (RATE_TABLE) prices each image model per billed unit
 * ('megapixel' or 'image'). Every image call in the app goes through
 * runImageCall() (or a Replicate client wrapped by trackReplicate()), which:
 *
 *   1. estimates the call's cost from the rate table (estimateImageCost);
 *   2. refuses it before the provider is called when today's persisted spend
 *      plus the estimate would pass either cap (assertImageBudget):
 *        - AI_DAILY_BUDGET_USD (default $50), the budget aiCostTracker
 *          enforces for Anthropic calls, summed over every ai_usage_logs row;
 *        - AI_DAILY_IMAGE_BUDGET_USD (default $10), the existing image cap,
 *          summed over today's image rows (billing_unit IS NOT NULL);
 *   3. writes one ai_usage_logs row with the cost (logImageUsage), and tells
 *      aiCostTracker so its cached figure counts the spend at once.
 *
 * Spend is read from ai_usage_logs on every image call, never from an
 * in-memory counter, so a restart does not reset it and every process sees
 * the same figure. If the read fails the call is allowed with a warning (fail
 * open, as aiCostTracker does): a logging fault must not become an outage.
 *
 * A model with no price in the table (usd: null) is still gated on the spend
 * already recorded (refused once a cap is reached) but its own cost cannot be
 * estimated; its row is written with cost_usd NULL — never 0 — and a warning.
 *
 * Refusals are Errors with status 429 and code 'AI_BUDGET_EXCEEDED', the
 * status aiCostTracker uses for its own budget refusal.
 */

/* eslint-disable no-console */

const EVONI_2026_09_30 = 'Evoni, published rates as given 2026-09-30 (Task #2387)';
const PRICE_NEEDED = 'price needed from Evoni (Task #2387); logged with cost_usd NULL';
const EVONI_OPENAI_2026_09_30 = "Evoni, 2026-09-30, from OpenAI's published pricing (Task #2387)";

// Keyed by the model id each call site sends. usd is per unit; null = no price yet.
const RATE_TABLE = {
  // ── fal.ai ────────────────────────────────────────────────────────────────
  'fal-ai/flux-pro/v1.1': {
    provider: 'fal', model: 'fal-ai/flux-pro/v1.1', unit: 'megapixel', usd: 0.04, source: EVONI_2026_09_30,
  },
  'fal-ai/flux/dev': {
    provider: 'fal', model: 'fal-ai/flux/dev', unit: 'megapixel', usd: 0.025, source: EVONI_2026_09_30,
  },
  'fal-ai/flux-pro/kontext': {
    provider: 'fal', model: 'fal-ai/flux-pro/kontext', unit: 'image', usd: 0.04, source: EVONI_2026_09_30,
  },
  // ── OpenAI ────────────────────────────────────────────────────────────────
  // Priced per image by quality and size ('<quality>:<w>x<h>'); a
  // combination not listed is unpriced (logged NULL with a warning).
  'dall-e-3': {
    provider: 'openai', model: 'dall-e-3', unit: 'image', usd: null,
    bySizeQuality: { 'hd:1024x1024': 0.08, 'hd:1792x1024': 0.12, 'hd:1024x1792': 0.12 },
    source: `${EVONI_OPENAI_2026_09_30}: hd $0.08 at 1024x1024, $0.12 at 1792x1024 or 1024x1792. Standard quality: ${PRICE_NEEDED}. Used by imageGenerationService.generateDallE`,
  },
  // Output priced per image by quality and size, plus input image tokens at
  // $10 per 1M, added from the response's usage when it reports them.
  'gpt-image-1': {
    provider: 'openai', model: 'gpt-image-1', unit: 'image', usd: null,
    bySizeQuality: { 'high:1536x1024': 0.25 },
    inputImageTokenUsdPerMillion: 10,
    source: `${EVONI_OPENAI_2026_09_30}: high quality 1536x1024 $0.25 per image output, plus input image tokens at $10 per 1M for edits. Used by sceneGenerationService images/edits (generateDallEStill)`,
  },
  // Task #2396. Output priced per image; the input-image-token rate for
  // edits is not given yet (null, not 0): runImageCall logs the output price
  // and warns that the input tokens are unpriced.
  // Sizes: 1024x1024, 1536x1024, 1024x1536 (and auto), quality low|medium|high,
  // on /v1/images/generations and /v1/images/edits — per search-result
  // summaries of developers.openai.com (models/gpt-image-1.5, images API
  // reference) on 2026-09-30; the pages themselves were not reachable from
  // the agent session, so these sizes are UNCONFIRMED against the primary doc.
  'gpt-image-1.5': {
    provider: 'openai', model: 'gpt-image-1.5', unit: 'image', usd: null,
    bySizeQuality: { 'high:1536x1024': 0.20 },
    inputImageTokenUsdPerMillion: null,
    source: `Evoni, 2026-09-30 (Task #2396): high quality 1536x1024 $0.20 per image output. Input image tokens for edits: ${PRICE_NEEDED}. Used by sceneGenerationService (base still choice 'gpt-image-1.5', cropAndOutpaint)`,
  },
  // ── Replicate ─────────────────────────────────────────────────────────────
  'meta/sam-2-large': {
    provider: 'replicate', model: 'meta/sam-2-large', unit: 'image', usd: null,
    source: `${PRICE_NEEDED}. segmentationService: one mask at the input image's size`,
  },
  'schananas/grounded_sam': {
    provider: 'replicate', model: 'schananas/grounded_sam', unit: 'image', usd: null,
    source: `${PRICE_NEEDED}. segmentationService: one mask at the input image's size`,
  },
  'chenxwh/depth-anything-v2': {
    provider: 'replicate', model: 'chenxwh/depth-anything-v2', unit: 'image', usd: null,
    source: `${PRICE_NEEDED}. depthEstimationService: model_size Large, depth map at the input image's size`,
  },
  'lucataco/sdxl-inpainting': {
    provider: 'replicate', model: 'lucataco/sdxl-inpainting', unit: 'image', usd: null,
    source: `${PRICE_NEEDED}. inpaintingService.runSdxlInpainting: 1 output at the input image's size, 40 steps`,
  },
  'lama': {
    provider: 'replicate', model: 'lama', unit: 'image', usd: null,
    source: `${PRICE_NEEDED}. inpaintingService.runLamaRemoval: version cdac78a1bec5…, hd_strategy Resize (limit 2048px)`,
  },
  'black-forest-labs/flux-fill-pro': {
    provider: 'replicate', model: 'black-forest-labs/flux-fill-pro', unit: 'image', usd: null,
    source: `${PRICE_NEEDED}. inpaintingService.runFluxFillProRemoval: 1 output at the input image's size`,
  },
  'cjwbw/rembg': {
    provider: 'replicate', model: 'cjwbw/rembg', unit: 'image', usd: null,
    source: `${PRICE_NEEDED}. inpaintingService.removeImageBackground: cutout at the input image's size`,
  },
  'nightmareai/real-esrgan': {
    provider: 'replicate', model: 'nightmareai/real-esrgan', unit: 'image', usd: null,
    source: `${PRICE_NEEDED}. wardrobeImageService.aiUpscaleImage: scale 4 (default; wardrobeController passes a scale)`,
  },
  'stability-ai/sdxl': {
    provider: 'replicate', model: 'stability-ai/sdxl', unit: 'image', usd: null,
    source: `${PRICE_NEEDED}. imageRestyleService.runImgToImg: 1024x1024, 1 output, 30 steps, expert_ensemble_refiner`,
  },
};

// Replicate calls made by version hash only (predictions.create({ version })).
const REPLICATE_VERSION_MODELS = {
  b239ea33cff32bb7abb5db39ffe9a09c14cbc2894331d1ef66fe096eed88ebd4: 'chenxwh/depth-anything-v2',
  a5b13068cc81a89a4fbeefeccc774869fcb34df4dbc92c1555e0f2771d49dde7: 'lucataco/sdxl-inpainting',
  cdac78a1bec5b23c07fd29692fb70baa513ea403a39e643c48ec5edadb15fe72: 'lama',
};

// fal.ai image_size presets (fal docs) → output pixels.
const FAL_PRESET_SIZES = {
  square_hd: [1024, 1024],
  square: [512, 512],
  portrait_4_3: [768, 1024],
  portrait_16_9: [576, 1024],
  landscape_4_3: [1024, 768],
  landscape_16_9: [1024, 576],
};

const BUDGET_ERROR_CODE = 'AI_BUDGET_EXCEEDED';

function dailyBudget() {
  return parseFloat(process.env.AI_DAILY_BUDGET_USD) || 50;
}
function dailyImageBudget() {
  return parseFloat(process.env.AI_DAILY_IMAGE_BUDGET_USD) || 10;
}

// 'owner/name:versionhash' → 'owner/name'
function modelKey(model) {
  if (!model) return 'unknown';
  return String(model).split(':')[0];
}

function lookupRate(model) {
  return RATE_TABLE[modelKey(model)] || null;
}

/**
 * Estimated cost of a planned generation.
 *
 * Megapixel models bill each output image's width*height/1e6 rounded UP to
 * a whole megapixel (at least 1), times count. Per-image models bill count.
 *
 * @param {object} p
 * @param {string} p.model   — model id as sent to the provider (RATE_TABLE key)
 * @param {number} [p.width]  — output width in px (megapixel models)
 * @param {number} [p.height] — output height in px (megapixel models)
 * @param {number} [p.count=1] — number of output images
 * @param {string} [p.provider] — provider to record when the model is not in the table
 * @returns {{ model, provider, unit, units, usd: number|null, priced: boolean, source }}
 */
function estimateImageCost({ model, width, height, count = 1, provider = null, quality = null } = {}) {
  const rate = lookupRate(model);
  const n = Math.max(1, Number(count) || 1);
  if (!rate) {
    return {
      model: modelKey(model), provider, unit: 'image', units: n, usd: null, priced: false,
      source: 'model not in RATE_TABLE',
    };
  }
  let units = n;
  if (rate.unit === 'megapixel') {
    const w = Number(width) || 1024;
    const h = Number(height) || 1024;
    units = Math.max(1, Math.ceil((w * h) / 1e6)) * n;
  }
  let perUnit = rate.usd;
  if (rate.bySizeQuality) {
    const key = `${quality || ''}:${Number(width) || 0}x${Number(height) || 0}`;
    perUnit = typeof rate.bySizeQuality[key] === 'number' ? rate.bySizeQuality[key] : null;
  }
  const priced = typeof perUnit === 'number';
  const usd = priced ? Math.round(perUnit * units * 1e6) / 1e6 : null;
  return {
    model: rate.model, provider: rate.provider, unit: rate.unit, units, usd, priced, source: rate.source,
    inputImageTokenUsdPerMillion: rate.inputImageTokenUsdPerMillion || null,
    // The model bills input image tokens but the table has no rate for them.
    inputImageTokensUnpriced: Object.prototype.hasOwnProperty.call(rate, 'inputImageTokenUsdPerMillion')
      && typeof rate.inputImageTokenUsdPerMillion !== 'number',
  };
}

function falPresetSize(preset) {
  return FAL_PRESET_SIZES[preset] || FAL_PRESET_SIZES.landscape_16_9;
}

function utcDayStart(now = new Date()) {
  return new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

// Loaded once, with this module (app.js has already loaded it at startup).
let tracker = null;
try {
  tracker = require('./aiCostTracker');
} catch (err) {
  console.warn(`[ImageCost] aiCostTracker unavailable: ${err.message}`);
}
function loadTracker() {
  return tracker;
}

/**
 * Today's (UTC) spend from ai_usage_logs: { total, image, imageCalls }.
 * total counts every row (Anthropic + image), image counts image rows only.
 * Returns null when the log cannot be read.
 */
async function readTodaySpend() {
  try {
    const db = require('../models');
    if (!db.AIUsageLog) throw new Error('AIUsageLog model not loaded');
    const { Op } = require('sequelize');
    const since = utcDayStart();
    const imageWhere = { created_at: { [Op.gte]: since }, billing_unit: { [Op.ne]: null } };
    const [total, image, imageCalls] = await Promise.all([
      db.AIUsageLog.sum('cost_usd', { where: { created_at: { [Op.gte]: since } } }),
      db.AIUsageLog.sum('cost_usd', { where: imageWhere }),
      db.AIUsageLog.count({ where: imageWhere }),
    ]);
    let totalSpend = Number(total) || 0;
    // aiCostTracker also counts Anthropic spend whose row is not written yet.
    const t = loadTracker();
    if (t && typeof t.getFreshDailySpend === 'function') {
      totalSpend = Math.max(totalSpend, await t.getFreshDailySpend());
    }
    return { total: totalSpend, image: Number(image) || 0, imageCalls: Number(imageCalls) || 0 };
  } catch (err) {
    console.warn(`[ImageCost] could not read today's spend from ai_usage_logs; allowing the call: ${err.message}`);
    return null;
  }
}

function budgetError(label, spent, cap) {
  const err = new Error(
    `Daily ${label} reached ($${spent.toFixed(2)} of $${cap.toFixed(2)}). ` +
    'Image generation is paused until tomorrow (UTC).',
  );
  err.status = 429;
  err.statusCode = 429;
  err.code = BUDGET_ERROR_CODE;
  return err;
}

function isBudgetError(err) {
  return Boolean(err && err.code === BUDGET_ERROR_CODE);
}

/**
 * Throw a budget refusal (status 429, code AI_BUDGET_EXCEEDED) when today's
 * persisted spend plus this estimate would pass AI_DAILY_BUDGET_USD or
 * AI_DAILY_IMAGE_BUDGET_USD. An unpriced estimate adds nothing but is still
 * refused once a cap has been reached.
 */
async function assertImageBudget(estimate) {
  const add = estimate && typeof estimate.usd === 'number' ? estimate.usd : 0;
  const spend = await readTodaySpend();
  if (!spend) return;
  const over = (spent, cap) => (add > 0 ? spent + add > cap : spent >= cap);
  const cap = dailyBudget();
  if (over(spend.total, cap)) {
    console.error(`[ImageCost] BLOCKED ${estimate?.model} — daily AI budget $${spend.total.toFixed(2)} / $${cap}`);
    throw budgetError('AI budget', spend.total, cap);
  }
  const imageCap = dailyImageBudget();
  if (over(spend.image, imageCap)) {
    console.error(`[ImageCost] BLOCKED ${estimate?.model} — daily image budget $${spend.image.toFixed(2)} / $${imageCap}`);
    throw budgetError('image budget', spend.image, imageCap);
  }
  if (spend.image + add >= imageCap * 0.8) {
    console.warn(`[ImageCost] Daily image spend $${spend.image.toFixed(2)} / $${imageCap} (${Math.round(spend.image / imageCap * 100)}%) — ${spend.imageCalls} calls`);
  }
}

/**
 * Write one ai_usage_logs row for an image call. Never throws.
 * cost_usd is the estimate's usd for a priced model, NULL (with a warning)
 * for an unpriced one; a failed call on a priced model logs 0 (INFERRED:
 * providers do not bill a request that returned no image).
 */
async function logImageUsage({
  estimate, routeName, durationMs = null, isError = false, errorType = null, inputTokens = 0, extraUsd = 0,
}) {
  let cost;
  if (!estimate.priced) {
    cost = null;
    console.warn(`[ImageCost] no price for ${estimate.model} (${estimate.provider || 'unknown provider'}) — logging cost_usd NULL; price needed (Task #2387)`);
  } else {
    cost = isError ? 0 : Math.round((estimate.usd + (extraUsd || 0)) * 1e6) / 1e6;
  }
  const t = loadTracker();
  const markPersisted = cost > 0 && t && typeof t.recordSpend === 'function'
    ? t.recordSpend(cost)
    : null;
  try {
    const db = require('../models');
    if (!db.AIUsageLog) throw new Error('AIUsageLog model not loaded');
    const row = await db.AIUsageLog.create({
      route_name: routeName || 'unknown',
      model_name: String(estimate.model || 'unknown').slice(0, 100),
      input_tokens: inputTokens || 0,
      output_tokens: 0,
      cost_usd: cost,
      duration_ms: durationMs,
      is_error: isError,
      error_type: errorType ? String(errorType).slice(0, 100) : null,
      provider: estimate.provider,
      billing_unit: estimate.unit,
      billed_units: estimate.units,
    });
    if (markPersisted) markPersisted();
    return { id: row && row.id != null ? row.id : null, cost };
  } catch (err) {
    console.error(`[ImageCost] could not write ai_usage_logs row for ${estimate.model}: ${err.message}`);
    return { id: null, cost };
  }
}

function errorTypeOf(err) {
  return err?.response?.status?.toString() || err?.status?.toString() || err?.code || err?.constructor?.name || 'unknown';
}

function inferRoute() {
  const t = loadTracker();
  return t && typeof t.inferRouteName === 'function' ? t.inferRouteName() : 'unknown';
}

/**
 * Budget-gate, run and log one image call.
 *
 * @param {object} plan — { model, width?, height?, count?, provider?, routeName?,
 *   inputImages?, onLogged? }
 *   inputImages: true for an edit that sends input images (so an unpriced
 *     input-token rate is warned about even when the response reports none).
 *   onLogged: called after a successful call is logged, with
 *     { usageLogId, costUsd, estimateUsd, inputTokens, inputTokensUnpriced,
 *       model, provider } — costUsd is what the ai_usage_logs row records
 *     (null for an unpriced model). Used to record a call's true cost on the
 *     record it produced (Task #2396).
 * @param {Function} fn — async () => provider result
 */
async function runImageCall(plan, fn) {
  const routeName = plan.routeName || inferRoute();
  const estimate = estimateImageCost(plan);
  await assertImageBudget(estimate);
  const startedAt = Date.now();
  let result;
  try {
    result = await fn();
  } catch (err) {
    await logImageUsage({
      estimate, routeName, durationMs: Date.now() - startedAt, isError: true, errorType: errorTypeOf(err),
    });
    throw err;
  }
  const input = inputImageTokenCost(estimate, result, { inputImages: Boolean(plan.inputImages) });
  const logged = await logImageUsage({
    estimate, routeName, durationMs: Date.now() - startedAt, inputTokens: input.tokens, extraUsd: input.usd,
  });
  if (typeof plan.onLogged === 'function') {
    try {
      plan.onLogged({
        usageLogId: logged ? logged.id : null,
        costUsd: logged ? logged.cost : null,
        estimateUsd: estimate.usd,
        inputTokens: input.tokens,
        inputTokensUnpriced: Boolean(input.unpriced),
        model: estimate.model,
        provider: estimate.provider,
      });
    } catch (err) {
      console.error(`[ImageCost] onLogged callback failed for ${estimate.model}: ${err.message}`);
    }
  }
  return result;
}

/**
 * The input image tokens a response reports (OpenAI images: usage.
 * input_tokens_details.image_tokens) and their cost at the model's
 * per-1M rate. { tokens: 0, usd: 0 } when the model has no such rate or the
 * response reports no usage.
 *
 * A model that bills input image tokens but has no rate in the table
 * (inputImageTokenUsdPerMillion: null, e.g. gpt-image-1.5) returns
 * { tokens, usd: 0, unpriced: true } and logs a warning whenever the response
 * reports input image tokens or the call sent input images — the output price
 * is still logged, but the input-token part is never silently counted as $0.
 */
function inputImageTokenCost(estimate, result, { inputImages = false } = {}) {
  const rate = estimate && estimate.inputImageTokenUsdPerMillion;
  const usage = result && result.data && result.data.usage;
  const tokens = Number(usage && usage.input_tokens_details && usage.input_tokens_details.image_tokens) || 0;
  if (estimate && estimate.inputImageTokensUnpriced && (tokens > 0 || inputImages)) {
    console.warn(
      `[ImageCost] input-image-token cost for ${estimate.model} edits is not priced ` +
      `(${tokens} input image tokens reported) — logging the output price only; price needed from Evoni (Task #2396)`,
    );
    return { tokens, usd: 0, unpriced: true };
  }
  if (!rate || tokens <= 0) return { tokens: 0, usd: 0 };
  return { tokens, usd: (tokens * rate) / 1e6 };
}

/**
 * Wrap a Replicate client so run() and predictions.create() are budget-gated
 * and logged (one row per prediction started; Replicate models are all
 * unpriced today, so the row's cost is NULL). predictions.get() and anything
 * else pass through.
 */
function trackReplicate(client) {
  const modelOf = (params = {}) => params.model
    || REPLICATE_VERSION_MODELS[params.version]
    || (params.version ? `replicate-version:${String(params.version).slice(0, 12)}` : 'unknown');
  const predictions = new Proxy(client.predictions, {
    get(target, prop) {
      if (prop === 'create') {
        return (params, ...rest) => runImageCall({ model: modelOf(params), provider: 'replicate' }, () => target.create(params, ...rest));
      }
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return new Proxy(client, {
    get(target, prop) {
      if (prop === 'run') {
        return (model, ...rest) => runImageCall({ model, provider: 'replicate' }, () => target.run(model, ...rest));
      }
      if (prop === 'predictions') return predictions;
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * Persisted image spend for today: { spend, calls, budget, remaining }.
 */
async function getImageBudgetStatus() {
  const spend = await readTodaySpend();
  const budget = dailyImageBudget();
  const image = spend ? spend.image : 0;
  return {
    spend: image,
    calls: spend ? spend.imageCalls : 0,
    budget,
    remaining: Math.max(0, budget - image),
    ...(spend ? {} : { unavailable: true }),
  };
}

module.exports = {
  RATE_TABLE,
  REPLICATE_VERSION_MODELS,
  FAL_PRESET_SIZES,
  BUDGET_ERROR_CODE,
  estimateImageCost,
  falPresetSize,
  assertImageBudget,
  logImageUsage,
  runImageCall,
  trackReplicate,
  getImageBudgetStatus,
  isBudgetError,
  readTodaySpend,
  inputImageTokenCost,
};

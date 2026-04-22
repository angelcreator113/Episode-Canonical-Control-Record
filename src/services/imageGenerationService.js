'use strict';

/**
 * Unified Image Generation Service — Hybrid Provider Routing
 *
 * Routes image generation to the best provider per use case:
 *
 *   DALL-E 3 (quality matters, text rendering):
 *     - Invitations (text rendering required)
 *     - Scene sets / venue images (photorealistic, atmospheric)
 *     - Character hero shots
 *
 *   Flux Pro (90% cheaper, great for non-text assets):
 *     - UI overlays (icons, frames — no text needed)
 *     - Wardrobe item images
 *     - Object generation
 *
 * Cost model:
 *   Flux Dev:  $0.003/image
 *   Flux Pro:  $0.005/image
 *   DALL-E 3:  $0.04 (standard) / $0.08 (HD)
 *
 * Caps:
 *   IMAGE_CALLS_PER_OPERATION (env, default: 3) — max calls per batch
 *   AI_DAILY_IMAGE_BUDGET_USD (env, default: 10) — daily spend cap
 *
 * Environment variables:
 *   FAL_KEY              — fal.ai API key (for Flux)
 *   OPENAI_API_KEY       — OpenAI key (for DALL-E)
 *   IMAGE_PROVIDER       — force a provider globally: 'flux' | 'dalle'
 *   IMAGE_CALLS_PER_OPERATION — max calls per batch (default: 3)
 *   AI_DAILY_IMAGE_BUDGET_USD — daily image budget in USD (default: 10)
 */

const axios = require('axios');

// ── USE-CASE → PROVIDER ROUTING ─────────────────────────────────────────────
// Maps use case tags to preferred provider

const USE_CASE_PROVIDERS = {
  // All use cases route to Flux Pro
  invitation:    'flux',
  scene:         'flux',
  venue:         'flux',
  character:     'flux',
  hero:          'flux',
  overlay:       'flux',
  icon:          'flux',
  frame:         'flux',
  wardrobe:      'flux',
  object:        'flux',
  thumbnail:     'flux',
};

// ── PROVIDER DETECTION ───────────────────────────────────────────────────────

function getProvider(useCase) {
  // IMAGE_PROVIDER env can still force a specific provider if needed
  if (process.env.IMAGE_PROVIDER) return process.env.IMAGE_PROVIDER.toLowerCase();
  return USE_CASE_PROVIDERS[useCase] || 'flux';
}

// ── DAILY IMAGE BUDGET TRACKING ─────────────────────────────────────────────

let dailyImageSpend = 0;
let dailyImageDate = new Date().toISOString().slice(0, 10);
let dailyImageCalls = 0;
const DAILY_IMAGE_BUDGET = parseFloat(process.env.AI_DAILY_IMAGE_BUDGET_USD) || 10;
const MAX_CALLS_PER_OP = parseInt(process.env.IMAGE_CALLS_PER_OPERATION) || 3;

function checkImageBudget(estimatedCost) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyImageDate) {
    dailyImageSpend = 0;
    dailyImageCalls = 0;
    dailyImageDate = today;
  }
  return (dailyImageSpend + estimatedCost) <= DAILY_IMAGE_BUDGET;
}

function recordImageSpend(cost) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyImageDate) {
    dailyImageSpend = 0;
    dailyImageCalls = 0;
    dailyImageDate = today;
  }
  dailyImageSpend += cost;
  dailyImageCalls += 1;
  if (dailyImageSpend >= DAILY_IMAGE_BUDGET * 0.8) {
    console.warn(`[ImageGen] Daily image spend $${dailyImageSpend.toFixed(2)} / $${DAILY_IMAGE_BUDGET} (${Math.round(dailyImageSpend / DAILY_IMAGE_BUDGET * 100)}%) — ${dailyImageCalls} calls`);
  }
}

function getImageBudgetStatus() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyImageDate) return { spend: 0, calls: 0, budget: DAILY_IMAGE_BUDGET, remaining: DAILY_IMAGE_BUDGET };
  return {
    spend: dailyImageSpend,
    calls: dailyImageCalls,
    budget: DAILY_IMAGE_BUDGET,
    remaining: Math.max(0, DAILY_IMAGE_BUDGET - dailyImageSpend),
  };
}

// ── SIZE MAPPING ─────────────────────────────────────────────────────────────

const FLUX_SIZES = {
  landscape:  'landscape_16_9',
  portrait:   'portrait_16_9',
  square:     'square',
  wide:       'landscape_16_9',
};

const DALLE_SIZES = {
  landscape:  '1792x1024',
  portrait:   '1024x1792',
  square:     '1024x1024',
  wide:       '1792x1024',
};

function normalizeSize(size) {
  if (!size) return 'landscape';
  if (typeof size === 'string' && size.includes('x')) {
    const [w, h] = size.split('x').map(Number);
    if (w > h) return 'landscape';
    if (h > w) return 'portrait';
    return 'square';
  }
  return size;
}

// ── FLUX (fal.ai) ────────────────────────────────────────────────────────────

async function generateFlux(prompt, options = {}) {
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) throw new Error('FAL_KEY not configured');

  const size = normalizeSize(options.size);
  const imageSize = FLUX_SIZES[size] || FLUX_SIZES.landscape;

  // Use flux-pro for HD quality, flux-dev for standard
  const model = options.quality === 'standard'
    ? 'fal-ai/flux/dev'
    : 'fal-ai/flux-pro/v1.1';

  console.log(`[ImageGen] Flux ${options.quality === 'standard' ? 'dev' : 'pro'} | ${imageSize} | use: ${options.useCase || 'default'} | prompt: ${prompt.slice(0, 80)}...`);

  const response = await axios.post(
    `https://fal.run/${model}`,
    {
      prompt: prompt.slice(0, 4000),
      image_size: imageSize,
      num_images: 1,
      enable_safety_checker: false,
      output_format: 'jpeg',
      ...(options.seed ? { seed: options.seed } : {}),
    },
    {
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    }
  );

  const imageUrl = response.data?.images?.[0]?.url;
  if (!imageUrl) {
    console.error('[ImageGen] Flux full response:', JSON.stringify(response.data).slice(0, 500));
    throw new Error(`Flux returned no image. Status: ${response.status}. Keys: ${Object.keys(response.data || {}).join(',')}`);
  }

  const cost = options.quality === 'standard' ? 0.003 : 0.005;
  recordImageSpend(cost);

  console.log(`[ImageGen] Flux success: ${imageUrl.slice(0, 80)}...`);
  return {
    url: imageUrl,
    provider: 'flux',
    model,
    seed: response.data?.images?.[0]?.seed || null,
    cost_estimate: cost,
  };
}

// ── FLUX KONTEXT (image-to-image via fal.ai) ─────────────────────────────────

/**
 * Image-to-image regeneration via Flux Pro Kontext.
 *
 * Takes a reference image (e.g. an amateur wardrobe photo on a hanger) plus a
 * prompt (e.g. "studio product photograph, neutral backdrop, invisible
 * mannequin") and returns a polished variant. Kontext preserves the subject's
 * identity — silhouette, color, pattern — much better than text-to-image
 * regenerated from a Claude Vision description.
 *
 * Cost: $0.04/image at the time of writing (same tier as DALL-E standard).
 * The reference image can be passed as a publicly-reachable URL OR a base64
 * data URI — the caller chooses based on whether the S3 object is public.
 */
async function generateImageFromImage(referenceImageUrl, prompt, options = {}) {
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) throw new Error('FAL_KEY not configured');
  if (!referenceImageUrl) throw new Error('referenceImageUrl required');

  const KONTEXT_COST = 0.04;
  if (!checkImageBudget(KONTEXT_COST)) {
    throw new Error(
      `Daily image budget exceeded ($${dailyImageSpend.toFixed(2)} / $${DAILY_IMAGE_BUDGET}). ` +
      `Try again tomorrow or increase AI_DAILY_IMAGE_BUDGET_USD.`
    );
  }

  const size = normalizeSize(options.size);
  const imageSize = FLUX_SIZES[size] || FLUX_SIZES.portrait || 'portrait_16_9';

  console.log(`[ImageGen] Flux Kontext | ${imageSize} | prompt: ${prompt.slice(0, 80)}...`);

  const response = await axios.post(
    'https://fal.run/fal-ai/flux-pro/kontext',
    {
      prompt: prompt.slice(0, 4000),
      image_url: referenceImageUrl,
      num_images: 1,
      output_format: 'jpeg',
      ...(options.seed ? { seed: options.seed } : {}),
      ...(options.guidanceScale ? { guidance_scale: options.guidanceScale } : {}),
    },
    {
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 180000, // Kontext is slower than flux-pro text-to-image
    }
  );

  const imageUrl = response.data?.images?.[0]?.url;
  if (!imageUrl) {
    console.error('[ImageGen] Flux Kontext full response:', JSON.stringify(response.data).slice(0, 500));
    throw new Error(`Flux Kontext returned no image. Status: ${response.status}. Keys: ${Object.keys(response.data || {}).join(',')}`);
  }

  recordImageSpend(KONTEXT_COST);
  console.log(`[ImageGen] Flux Kontext success: ${imageUrl.slice(0, 80)}...`);

  return {
    url: imageUrl,
    provider: 'flux-kontext',
    model: 'fal-ai/flux-pro/kontext',
    seed: response.data?.images?.[0]?.seed || null,
    cost_estimate: KONTEXT_COST,
  };
}

// ── DALL-E 3 (OpenAI) ────────────────────────────────────────────────────────

async function generateDallE(prompt, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const size = normalizeSize(options.size);
  const dalleSize = DALLE_SIZES[size] || DALLE_SIZES.landscape;
  const quality = options.quality === 'standard' ? 'standard' : 'hd';

  console.log(`[ImageGen] DALL-E 3 ${quality} | ${dalleSize} | use: ${options.useCase || 'default'} | prompt: ${prompt.slice(0, 80)}...`);

  const response = await axios.post(
    'https://api.openai.com/v1/images/generations',
    {
      model: 'dall-e-3',
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: dalleSize,
      quality,
      style: options.style || 'natural',
      response_format: 'url',
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    }
  );

  const imageUrl = response.data?.data?.[0]?.url;
  if (!imageUrl) throw new Error('DALL-E 3 returned no image');

  const cost = quality === 'hd' ? 0.08 : 0.04;
  recordImageSpend(cost);

  console.log(`[ImageGen] DALL-E success (URL expires in ~1hr)`);
  return {
    url: imageUrl,
    provider: 'dalle',
    model: 'dall-e-3',
    seed: null,
    cost_estimate: cost,
    expires: true, // DALL-E URLs expire — caller must persist to S3
  };
}

// ── UNIFIED ENTRY POINT ──────────────────────────────────────────────────────

/**
 * Generate an image from a text prompt.
 *
 * @param {string} prompt — Image generation prompt
 * @param {object} options
 * @param {string} options.size — 'landscape' | 'portrait' | 'square' | 'wide'
 * @param {string} options.quality — 'hd' (default) | 'standard'
 * @param {string} options.style — DALL-E only: 'natural' | 'vivid'
 * @param {number} options.seed — Flux only: reproducibility seed
 * @param {string} options.provider — Force provider: 'flux' | 'dalle'
 * @param {string} options.useCase — Route to best provider: 'invitation' | 'scene' | 'venue' | 'overlay' | 'icon' | 'wardrobe' | 'object'
 * @returns {{ url, provider, model, seed, cost_estimate, expires? }}
 */
async function generateImage(prompt, options = {}) {
  // Budget check — Flux Pro cost
  const estimatedCost = 0.005;
  if (!checkImageBudget(estimatedCost)) {
    throw new Error(`Daily image budget exceeded ($${dailyImageSpend.toFixed(2)} / $${DAILY_IMAGE_BUDGET}). Try again tomorrow or increase AI_DAILY_IMAGE_BUDGET_USD.`);
  }

  const provider = options.provider || getProvider(options.useCase);

  console.log(`[ImageGen] ${options.useCase || 'default'} → ${provider} | ${prompt.slice(0, 60)}...`);

  // All routes go to Flux Pro
  return generateFlux(prompt, options);
}

/**
 * Quick helper — generate and return just the URL.
 */
async function generateImageUrl(prompt, options = {}) {
  const result = await generateImage(prompt, options);
  return result.url;
}

module.exports = {
  generateImage,
  generateImageUrl,
  generateImageFromImage,
  generateFlux,
  generateDallE,
  getProvider,
  getImageBudgetStatus,
  MAX_CALLS_PER_OP,
  USE_CASE_PROVIDERS,
};

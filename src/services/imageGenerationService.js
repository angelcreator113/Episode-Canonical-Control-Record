'use strict';

/**
 * Unified Image Generation Service
 *
 * Single entry point for all AI image generation across the platform.
 * Primary: Flux Pro via fal.ai (~$0.005/image — 90% cheaper than DALL-E)
 * Fallback: DALL-E 3 via OpenAI (if FAL_KEY not configured)
 *
 * Usage:
 *   const { generateImage } = require('./imageGenerationService');
 *   const url = await generateImage(prompt, { size: 'landscape', quality: 'hd' });
 *
 * Environment variables:
 *   FAL_KEY         — fal.ai API key (primary)
 *   OPENAI_API_KEY  — OpenAI key (fallback only)
 *   IMAGE_PROVIDER  — force a provider: 'flux' | 'dalle' (auto-detects by default)
 */

const axios = require('axios');

// ── PROVIDER DETECTION ───────────────────────────────────────────────────────

function getProvider() {
  const forced = process.env.IMAGE_PROVIDER?.toLowerCase();
  if (forced === 'dalle') return 'dalle';
  if (forced === 'flux') return 'flux';
  // Auto-detect: prefer Flux if FAL_KEY exists
  if (process.env.FAL_KEY) return 'flux';
  if (process.env.OPENAI_API_KEY) return 'dalle';
  return null;
}

// ── SIZE MAPPING ─────────────────────────────────────────────────────────────
// Normalize size names to provider-specific dimensions

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

  console.log(`[ImageGen] Flux ${options.quality === 'standard' ? 'dev' : 'pro'} | ${imageSize} | prompt: ${prompt.slice(0, 80)}...`);

  // fal.ai synchronous endpoint — returns result directly
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

  console.log(`[ImageGen] Flux success: ${imageUrl.slice(0, 80)}...`);
  return {
    url: imageUrl,
    provider: 'flux',
    model,
    seed: response.data?.images?.[0]?.seed || null,
    cost_estimate: options.quality === 'standard' ? 0.003 : 0.005,
  };
}

// ── DALL-E 3 (OpenAI) ────────────────────────────────────────────────────────

async function generateDallE(prompt, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const size = normalizeSize(options.size);
  const dalleSize = DALLE_SIZES[size] || DALLE_SIZES.landscape;
  const quality = options.quality === 'standard' ? 'standard' : 'hd';

  console.log(`[ImageGen] DALL-E 3 ${quality} | ${dalleSize} | prompt: ${prompt.slice(0, 80)}...`);

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

  console.log(`[ImageGen] DALL-E success (URL expires in ~1hr)`);
  return {
    url: imageUrl,
    provider: 'dalle',
    model: 'dall-e-3',
    seed: null,
    cost_estimate: quality === 'hd' ? 0.08 : 0.04,
    expires: true, // DALL-E URLs expire — caller must persist to S3
  };
}

// ── UNIFIED ENTRY POINT ──────────────────────────────────────────────────────

/**
 * Generate an image from a text prompt.
 *
 * @param {string} prompt — Image generation prompt
 * @param {object} options
 * @param {string} options.size — 'landscape' | 'portrait' | 'square' | 'wide' | '1024x1024'
 * @param {string} options.quality — 'hd' (default) | 'standard'
 * @param {string} options.style — DALL-E only: 'natural' | 'vivid'
 * @param {number} options.seed — Flux only: reproducibility seed
 * @param {string} options.provider — Force provider: 'flux' | 'dalle'
 * @returns {{ url, provider, model, seed, cost_estimate, expires? }}
 */
async function generateImage(prompt, options = {}) {
  const provider = options.provider || getProvider();

  if (!provider) {
    throw new Error('No image generation API configured. Set FAL_KEY (for Flux) or OPENAI_API_KEY (for DALL-E).');
  }

  // Try primary provider, fall back to the other
  if (provider === 'flux') {
    try {
      return await generateFlux(prompt, options);
    } catch (fluxErr) {
      const detail = fluxErr.response?.data ? JSON.stringify(fluxErr.response.data).slice(0, 300) : fluxErr.message;
      console.warn(`[ImageGen] Flux failed: ${detail}`);
      if (process.env.OPENAI_API_KEY) {
        console.log('[ImageGen] Falling back to DALL-E...');
        return await generateDallE(prompt, options);
      }
      throw fluxErr;
    }
  }

  // DALL-E primary
  try {
    return await generateDallE(prompt, options);
  } catch (dalleErr) {
    console.warn(`[ImageGen] DALL-E failed: ${dalleErr.message}`);
    if (process.env.FAL_KEY) {
      console.log('[ImageGen] Falling back to Flux...');
      return await generateFlux(prompt, options);
    }
    throw dalleErr;
  }
}

/**
 * Quick helper — generate and return just the URL (matches old DALL-E function signatures).
 */
async function generateImageUrl(prompt, options = {}) {
  const result = await generateImage(prompt, options);
  return result.url;
}

module.exports = {
  generateImage,
  generateImageUrl,
  generateFlux,
  generateDallE,
  getProvider,
};

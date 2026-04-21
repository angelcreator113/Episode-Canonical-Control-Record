'use strict';

/**
 * Financial Frame Generator Service
 *
 * Builds AI-generated decorative "frames" for the 5 Finance phone apps
 * (Wallet, Insights, Breakdowns, Closet Value, Goals). Same pattern as
 * invitationGeneratorService: prompts an image API, uploads to S3,
 * creates / updates a UI_OVERLAY Asset row.
 *
 * Key difference from invites: the frame is pure chrome/background —
 * NOT the data. The live content zones (balance_trend_sparkline,
 * income_expense_bars, etc.) render ON TOP of the frame at runtime.
 * That's the "hybrid" design: expensive AI image stays static across
 * gameplay, cheap live data updates per transaction.
 *
 * Palette is locked to the show's wardrobe backdrop pink/teal pairing
 * (#FBCFE8 + #14B8A6) so finance apps visually harmonise with outfits.
 */

const { generateImageUrl } = require('./imageGenerationService');
const { v4: uuidv4 } = require('uuid');

const BRAND_PALETTE = {
  pink:  '#FBCFE8',
  teal:  '#14B8A6',
  gold:  '#B8962E',
  paper: '#FAF7F0',
  ink:   '#2C2C2C',
};

// App-specific prompt snippets. Each one keeps the palette consistent but
// gives the image gen a distinct chrome/aesthetic so the 5 screens feel
// like different apps, not repainted wallpapers.
const APP_PROMPTS = {
  wallet: {
    label: 'Wallet',
    icon: '💰',
    bg: 'Minimalist wallet app background. Soft light-pink gradient fading into teal at the bottom. Delicate gold hairlines framing a blank centre area for balance numerics. Glossy card-like surface with subtle inner shadow. No text, no numbers, no icons — just the chrome.',
    icon_prompt: 'App icon: stylized coin purse in light pink and teal gradient on a clean pastel square, subtle gold rim, modern mobile app icon style. Centred, 1024x1024 square.',
  },
  insights: {
    label: 'Insights',
    icon: '📊',
    bg: 'Premium financial dashboard app background. Light-pink paper-textured panel with a teal header strip at the top (2/10ths height) and a wide empty centre for a trend chart. Art-deco gold border detailing on the corners. No text, no data, no chart lines — empty chrome only.',
    icon_prompt: 'App icon: a rising line-chart silhouette over a pink-teal gradient square, small gold spark at the peak, modern mobile app icon style. Centred, 1024x1024 square.',
  },
  breakdowns: {
    label: 'Breakdowns',
    icon: '📉',
    bg: 'Finance breakdown app background. Split panel: top third light pink labeled INCOME in a quiet sans-serif (leave area blank), bottom two-thirds teal labeled EXPENSES. Soft inner shadow, gold divider line across the middle. No bars, no numbers — empty panels only.',
    icon_prompt: 'App icon: stacked pie-chart wedges in pink and teal on a pastel square, tiny gold accent in centre, modern mobile app icon style. Centred, 1024x1024 square.',
  },
  closet: {
    label: 'Closet Value',
    icon: '👗',
    bg: 'Luxury shopping app background. Pink-gold gradient header at top (1/5 height) with subtle boutique signage style hairline accents, large empty teal-tinted grid area below for product thumbnails. Soft drop shadow, premium department store feel. No products, no text, no prices.',
    icon_prompt: 'App icon: a minimalist dress silhouette in pink on a teal gradient square, with a small gold price tag in corner, modern mobile app icon style. Centred, 1024x1024 square.',
  },
  goals: {
    label: 'Goals',
    icon: '🎯',
    bg: 'Achievements / trophy case app background. Glossy pink background with 5 empty pedestal-shaped slots arranged vertically, each slot outlined in thin teal with gold trim. Soft spotlight overhead. Motivational but minimal. No text, no icons in the slots, no progress bars.',
    icon_prompt: 'App icon: a stylized trophy with pink body and teal accents on a pastel square, tiny gold ribbon, modern mobile app icon style. Centred, 1024x1024 square.',
  },
};

// ── S3 upload (same approach as invitationGeneratorService) ─────────────────

async function uploadToS3(buffer, showId, suffix, contentType = 'image/png') {
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const BUCKET = process.env.AWS_BUCKET || process.env.S3_BUCKET;
  if (!BUCKET) return null;
  const client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  const key = `finance-apps/${showId}/${suffix}-${Date.now()}.${contentType === 'image/png' ? 'png' : 'jpg'}`;
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read',
  }));
  return `https://${BUCKET}.s3.amazonaws.com/${key}`;
}

async function downloadImage(url) {
  const axios = require('axios');
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
  return Buffer.from(res.data);
}

// ── Frame + icon generation ─────────────────────────────────────────────────

/**
 * Generate both the screen-background "frame" and the home-screen icon image
 * for a single finance app (wallet / insights / breakdowns / closet / goals).
 * Returns { frame_url, icon_url, app_key }.
 *
 * Non-blocking errors: if image generation fails mid-flight we return the
 * partial result (e.g. frame only, icon null). Caller can retry the missing
 * piece via the Redecorate button later.
 */
async function generateAppAssets(appKey, showId) {
  const prompts = APP_PROMPTS[appKey];
  if (!prompts) throw new Error(`Unknown finance app key: ${appKey}`);
  if (!process.env.FAL_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error('No image generation API configured. Set FAL_KEY or OPENAI_API_KEY.');
  }

  const result = { app_key: appKey, frame_url: null, icon_url: null };

  // Screen frame — portrait to match phone screens.
  try {
    const rawUrl = await generateImageUrl(prompts.bg, { size: 'portrait', quality: 'hd', useCase: 'finance_frame' });
    if (rawUrl) {
      const buf = await downloadImage(rawUrl);
      result.frame_url = (await uploadToS3(buf, showId, `${appKey}-frame`)) || rawUrl;
    }
  } catch (err) {
    console.warn(`[financialFrame] frame gen failed for ${appKey}:`, err.message);
  }

  // App icon — square. Runs in sequence so we don't hammer the image API.
  try {
    const rawIconUrl = await generateImageUrl(prompts.icon_prompt, { size: 'square', quality: 'standard', useCase: 'finance_icon' });
    if (rawIconUrl) {
      const buf = await downloadImage(rawIconUrl);
      result.icon_url = (await uploadToS3(buf, showId, `${appKey}-icon`)) || rawIconUrl;
    }
  } catch (err) {
    console.warn(`[financialFrame] icon gen failed for ${appKey}:`, err.message);
  }

  return result;
}

module.exports = {
  BRAND_PALETTE,
  APP_PROMPTS,
  generateAppAssets,
};

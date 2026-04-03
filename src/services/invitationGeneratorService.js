'use strict';

/**
 * Invitation Generator Service v2
 *
 * Full pipeline:
 *   Event record
 *     -> DALL-E 3 generates luxury background (no text)
 *     -> Canvas renders invitation text layout
 *     -> Sharp composites text onto background
 *     -> Final readable invitation PNG -> S3 -> Asset record
 *
 * The DALL-E prompt explicitly asks for NO TEXT on the background
 * so the Canvas layer has a clean surface to write on.
 *
 * Asset starts as pending_review — not linked to event until approved
 * via the approve-invitation endpoint.
 */

const axios = require('axios');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const { compositeInvitation } = require('./invitationCompositingService');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

// ─── THEME PRESETS ────────────────────────────────────────────────────────────

const THEME_PRESETS = {
  'honey luxe': {
    background: 'warm honey cream with golden silk texture, subtle amber glow emanating from center',
    border: 'delicate ornamental gold foil border with honey-toned curved corners and fine filigree',
    florals: 'soft honey-toned peonies and cream roses scattered in corners, light and delicate',
    atmosphere: 'warm candlelight glow, golden hour warmth',
  },
  'avant-garde': {
    background: 'ivory with subtle black marble veining, cool and precise',
    border: 'thin asymmetric black border with single gold corner accent',
    florals: 'single sculptural black orchid silhouette, minimal',
    atmosphere: 'crisp studio lighting, high contrast',
  },
  'soft glam': {
    background: 'blush pink with delicate silk sheen, rose gold undertones and gentle shimmer',
    border: 'rose gold foil border with soft curved ornamental edges and small floral details',
    florals: 'soft pink roses and white peonies, ethereal and romantic, corners and sides',
    atmosphere: 'soft warm pink glow, dreamy and aspirational',
  },
  'romantic garden': {
    background: 'soft sage green with ivory overlay, garden party elegance',
    border: 'delicate floral wreath border in blush, ivory, and sage green',
    florals: 'lush garden roses, ranunculus, eucalyptus, full bloom abundance',
    atmosphere: 'dappled golden sunlight, outdoor warmth',
  },
  'luxury intimate': {
    background: 'deep champagne with velvet texture suggestion, warm and enveloping',
    border: 'thin double-line gold border, understated luxury',
    florals: 'single camellia or gardenia, centered and minimal',
    atmosphere: 'intimate candlelight glow, evening warmth, soft shadows',
  },
  'formal glamour': {
    background: 'cream white with subtle pearl sheen, pristine and elevated',
    border: 'ornate classical gold filigree border with corner medallions',
    florals: 'white orchids and gold-tipped leaves, architectural placement',
    atmosphere: 'crisp bright light with gold accents, formal and polished',
  },
  'chic minimal': {
    background: 'pure cream, hairline texture, clean and breathable',
    border: 'single thin black line border, architectural precision',
    florals: 'single thin botanical line drawing, one corner only',
    atmosphere: 'clean studio light, maximum negative space',
  },
  'power fashion': {
    background: 'ivory with subtle black marble veining, statement material',
    border: 'bold black border with gold corner accents, commanding',
    florals: 'architectural black florals or none',
    atmosphere: 'high-contrast editorial lighting, bold and confident',
  },
};

const DEFAULT_THEME = {
  background: 'soft cream ivory with subtle silk texture and marble undertone',
  border: 'elegant gold foil border with ornamental curved edges and fine filigree details',
  florals: 'soft blush roses and ivory peonies, delicately placed in corners',
  atmosphere: 'warm golden light from center, luxurious and aspirational',
};

// ─── DALL-E PROMPT (background only — no text) ────────────────────────────────

function buildBackgroundPrompt(event) {
  const themeName = (event.theme || '').toLowerCase();
  const themeConfig = THEME_PRESETS[themeName] || DEFAULT_THEME;

  const prestige = event.prestige || 5;
  const richness = prestige >= 8
    ? 'Maximum luxury — gold accents are rich and opulent'
    : prestige >= 5
      ? 'Refined elegance — gold accents are tasteful and considered'
      : 'Understated — minimal decoration, clean and simple';

  const colorText = event.color_palette?.length > 0
    ? `Color palette emphasis: ${event.color_palette.join(', ')}.`
    : '';

  return `Create a luxury invitation card BACKGROUND as a flat graphic design, portrait orientation.

CRITICAL RULES:
- NO TEXT anywhere on the image. Zero text. No words. No letters. No numbers.
- This is a BACKGROUND ONLY — text will be added separately
- Leave a large clear central area (approximately 60% of card) completely empty for text overlay
- The design elements (border, florals, texture) should frame the edges only

CARD DESIGN:
Background: ${themeConfig.background}
Border/Frame: ${themeConfig.border}
Floral elements: ${themeConfig.florals} — EDGES AND CORNERS ONLY, not center
${colorText}
Richness: ${richness}

COMPOSITION:
- Portrait card format (taller than wide)
- Decorative elements concentrated at top and bottom edges
- Large empty cream/ivory center zone — this is where text will appear
- Soft vignette effect toward center (lighter in middle, slightly darker at edges)
- ${themeConfig.atmosphere}
- The card should feel like a premium physical invitation stationery item
- Soft neutral background behind the card (cream or very light gray)

Style: High-end fashion editorial stationery. Think luxury wedding stationery meets fashion house invite.
Output: Clean background suitable for text overlay compositing.`;
}

// ─── DALL-E 3 API (raw axios — matches objectGenerationService pattern) ──────

async function callDallE3(prompt) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured. Add it to your .env file.');

  const response = await axios.post(
    'https://api.openai.com/v1/images/generations',
    {
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1792',
      quality: 'hd',
      style: 'vivid',
      response_format: 'url',
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    }
  );

  return response.data.data[0]?.url;
}

// ─── S3 HELPERS ───────────────────────────────────────────────────────────────

async function uploadToS3(buffer, eventId, suffix, contentType = 'image/png') {
  const s3Key = `invitations/${eventId}/${uuidv4()}-${suffix}.png`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'max-age=31536000',
    Metadata: { source: 'invitation-generator-v2', event_id: eventId },
  }));
  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

async function deleteOldS3Asset(url) {
  if (!url || !S3_BUCKET) return;
  try {
    const bucketHost = `${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/`;
    const idx = url.indexOf(bucketHost);
    if (idx === -1) return;
    const key = decodeURIComponent(url.slice(idx + bucketHost.length));
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    console.log(`[InviteGen] Cleaned up old S3 asset: ${key}`);
  } catch (err) {
    console.warn(`[InviteGen] S3 cleanup failed (non-blocking): ${err.message}`);
  }
}

// ─── ASSET RECORD ─────────────────────────────────────────────────────────────

async function createInvitationAsset(models, event, s3Url, showId) {
  const { Asset } = models;

  const asset = await Asset.create({
    id: uuidv4(),
    name: `${event.name} — Invitation`,
    asset_type: 'INVITATION_LETTER',
    asset_role: 'UI.OVERLAY.INVITATION',
    asset_group: 'SHOW',
    asset_scope: 'SHOW',
    purpose: 'MAIN',
    category: 'overlay',
    entity_type: 'prop',
    s3_url_raw: s3Url,
    s3_url_processed: s3Url,
    processing_status: 'none',
    mood_tags: [
      event.mood,
      event.theme,
      ...(event.dress_code_keywords || []).slice(0, 2),
    ].filter(Boolean),
    color_palette: event.color_palette || [],
    show_id: showId || null,
    metadata: {
      source: 'invitation-generator-v2',
      event_id: event.id,
      event_name: event.name,
      theme: event.theme,
      prestige: event.prestige,
      generated_at: new Date().toISOString(),
    },
    approval_status: 'pending_review',
  });

  return asset;
}

// ─── MAIN SERVICE ─────────────────────────────────────────────────────────────

/**
 * Generate a LalaVerse invitation letter for an event.
 *
 * Pipeline: DALL-E background -> Canvas text -> Sharp composite -> S3 -> Asset
 * Asset starts as pending_review — not linked to event until approved.
 *
 * @param {string} eventId
 * @param {object} models - Sequelize models
 * @param {string} showId
 * @returns {{ asset, imageUrl, eventName, theme }}
 */
async function generateInvitation(eventId, models, showId) {
  const { sequelize } = models;

  // Load the event (world_events has no deleted_at column)
  const [event] = await sequelize.query(
    'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',
    { replacements: { eventId }, type: sequelize.QueryTypes.SELECT }
  );

  if (!event) throw new Error(`Event ${eventId} not found`);

  console.log(`[InviteGen] Generating for: ${event.name} | Theme: ${event.theme || 'default'} | Prestige: ${event.prestige}`);

  // Clean up old invitation asset if regenerating
  let oldAssetUrl = null;
  if (event.invitation_asset_id) {
    try {
      const [oldAsset] = await sequelize.query(
        'SELECT s3_url_raw FROM assets WHERE id = :assetId LIMIT 1',
        { replacements: { assetId: event.invitation_asset_id }, type: sequelize.QueryTypes.SELECT }
      );
      oldAssetUrl = oldAsset?.s3_url_raw;

      // Soft-delete the old asset record
      await sequelize.query(
        'UPDATE assets SET deleted_at = NOW() WHERE id = :assetId AND deleted_at IS NULL',
        { replacements: { assetId: event.invitation_asset_id } }
      );
    } catch (err) {
      console.warn('[InviteGen] Old asset cleanup warning:', err.message);
    }
  }

  // Step 1: Generate background (no text) via DALL-E 3
  const bgPrompt = buildBackgroundPrompt(event);
  console.log('[InviteGen] Calling DALL-E 3 for background...');
  const bgUrl = await callDallE3(bgPrompt);

  if (!bgUrl) throw new Error('DALL-E 3 did not return an image URL');

  // Download background
  const bgResponse = await axios.get(bgUrl, {
    responseType: 'arraybuffer',
    timeout: 60000,
  });
  const bgBuffer = Buffer.from(bgResponse.data);

  // Step 2: Composite real text onto background via Canvas + Sharp
  console.log('[InviteGen] Compositing invitation text...');
  const finalBuffer = await compositeInvitation(bgBuffer, event);

  // Step 3: Upload final to S3
  const s3Url = await uploadToS3(finalBuffer, eventId, 'final');
  console.log(`[InviteGen] Final invitation stored: ${s3Url}`);

  // Clean up old S3 object (best-effort, after new one is safely stored)
  if (oldAssetUrl) {
    await deleteOldS3Asset(oldAssetUrl);
  }

  // Step 4: Create Asset record (pending_review — not linked to event until approved)
  const asset = await createInvitationAsset(models, event, s3Url, showId);

  return {
    success: true,
    asset,
    imageUrl: s3Url,
    eventName: event.name,
    theme: event.theme || 'default',
  };
}

module.exports = { generateInvitation, buildBackgroundPrompt };

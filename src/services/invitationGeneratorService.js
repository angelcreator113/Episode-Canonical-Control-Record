'use strict';

/**
 * Invitation Generator Service
 *
 * Turns a world_events record into a beautiful LalaVerse invitation image.
 * Each event gets its own visual personality based on theme, mood, dress code.
 *
 * Flow:
 *   Event record -> build DALL-E 3 prompt -> generate image -> S3 -> Asset record
 *
 * The generated asset:
 *   category: 'overlay'
 *   asset_type: 'INVITATION_LETTER'
 *   asset_role: 'UI.OVERLAY.INVITATION'
 *   asset_group: 'SHOW'
 *   purpose: 'MAIN'
 *   Linked back to event via world_events.invitation_asset_id
 *
 * Uses raw axios for DALL-E 3 calls (same pattern as objectGenerationService).
 */

const axios = require('axios');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

// ─── THEME MAPPINGS ───────────────────────────────────────────────────────────

const THEME_PRESETS = {
  'honey luxe': {
    background: 'warm honey cream with golden silk texture, subtle amber glow',
    border: 'delicate gold foil border with honey-toned ornamental corners',
    florals: 'soft honey-toned peonies and baby\'s breath, scattered lightly',
    typography: 'elegant champagne gold script header, warm cream serif body text',
    glow: 'warm golden light emanating from center, like candlelight',
  },
  'avant-garde': {
    background: 'soft ivory with minimal geometric marble texture',
    border: 'thin sleek black or deep charcoal border, asymmetric',
    florals: 'single sculptural black lily or abstract floral silhouette',
    typography: 'bold modern serif in deep charcoal, editorial spacing',
    glow: 'cool silver sheen, studio lighting',
  },
  'soft glam': {
    background: 'blush pink with delicate silk sheen, rose gold undertones',
    border: 'rose gold foil border with soft curved ornamental edges',
    florals: 'soft pink roses and peonies, ethereal and romantic',
    typography: 'flowing rose gold script header, blush pink serif body',
    glow: 'soft warm pink glow, dreamy and aspirational',
  },
  'romantic garden': {
    background: 'soft sage green with ivory overlay, garden party elegance',
    border: 'delicate floral wreath border in blush and green',
    florals: 'lush garden roses, ranunculus, eucalyptus in full bloom',
    typography: 'handwritten-style script in forest green, clean ivory serif body',
    glow: 'dappled sunlight effect, outdoor warmth',
  },
  'luxury intimate': {
    background: 'deep champagne with velvet texture suggestion',
    border: 'thin gold double-line border, understated luxury',
    florals: 'single camellia or gardenia, centered, minimal',
    typography: 'refined thin-weight serif in warm champagne gold, generous spacing',
    glow: 'intimate candlelight glow, evening warmth',
  },
  'formal glamour': {
    background: 'cream white with subtle pearl sheen',
    border: 'ornate gold foil border with classical filigree corners',
    florals: 'white orchids and gold-tipped leaves, architectural',
    typography: 'classic black or deep navy script header, ivory serif body',
    glow: 'crisp bright light with gold accents',
  },
  'chic minimal': {
    background: 'pure cream with hairline texture, no pattern',
    border: 'single thin black line border, architectural precision',
    florals: 'none, or single thin botanical line drawing',
    typography: 'geometric sans-serif in black, maximum white space',
    glow: 'clean studio light, no warmth',
  },
  'power fashion': {
    background: 'ivory with subtle black marble veining',
    border: 'bold black border with gold corner accents',
    florals: 'architectural black florals or none',
    typography: 'strong bold serif in black, gold accent color',
    glow: 'high-contrast editorial lighting',
  },
};

const DEFAULT_THEME = {
  background: 'soft cream ivory with subtle silk texture and marble undertone',
  border: 'elegant gold foil border with ornamental curved edges',
  florals: 'soft blush roses and ivory peonies, delicately placed',
  typography: 'elegant champagne gold script header, warm cream serif body text',
  glow: 'warm golden light from center, luxurious and aspirational',
};

// ─── PROMPT BUILDER ───────────────────────────────────────────────────────────

function buildInvitationPrompt(event) {
  const themeName = (event.theme || '').toLowerCase();
  const themeConfig = THEME_PRESETS[themeName] || DEFAULT_THEME;

  const floralText = event.floral_style === 'none'
    ? 'no florals, clean and minimal'
    : event.floral_style
      ? `${event.floral_style} in soft tones, delicately placed`
      : themeConfig.florals;

  const borderText = event.border_style === 'none'
    ? 'no border, clean edge'
    : event.border_style === 'gold_foil'
      ? 'elegant gold foil border with ornamental corners'
      : event.border_style === 'ornate'
        ? 'ornate classical filigree gold border'
        : event.border_style === 'minimal'
          ? 'single thin gold line border'
          : themeConfig.border;

  const colorText = event.color_palette?.length > 0
    ? `Color palette: ${event.color_palette.join(', ')}.`
    : '';

  const dressKeywords = event.dress_code_keywords?.slice(0, 3).join(', ') || '';

  const prestige = event.prestige || 5;
  const richnessText = prestige >= 8
    ? 'Maximum luxury — gold accents are rich and opulent'
    : prestige >= 5
      ? 'Refined elegance — gold accents are tasteful and considered'
      : 'Understated — minimal decoration, clean and simple';

  return `Create a luxury LalaVerse invitation card as a flat graphic design, portrait orientation (2:3 ratio).

CRITICAL: This is a FLAT GRAPHIC DESIGN of an invitation card. No hands holding it. No table surface. No 3D rendering. Just the card itself centered on a neutral background, like a product photo of stationery.

CARD DESIGN:

Background: ${themeConfig.background}
Border: ${borderText}
Florals: ${floralText}
${colorText}
Tone: ${dressKeywords ? `Visual tone reflects: ${dressKeywords}.` : ''}
Richness: ${richnessText}

TYPOGRAPHY LAYOUT (from top to bottom):
1. Small header at top center: "LalaVerse" in delicate refined lettering
2. Large center title: "${event.name}" in ${themeConfig.typography.split(',')[0]}
3. Invitation phrase below title: "You are cordially invited" in thin elegant serif
4. Details section:
   ${event.location_hint ? `Location: ${event.location_hint}` : ''}
   ${event.dress_code ? `Dress Code: ${event.dress_code}` : ''}
   ${event.cost_coins ? `Investment: ${event.cost_coins} coins` : ''}
5. Signature at bottom: "Curated by Lala" in flowing script

MOOD: ${event.mood || 'soft, luxurious, feminine, aspirational'}
${themeConfig.glow ? `LIGHTING EFFECT: ${themeConfig.glow}` : ''}

COMPOSITION RULES:
- Centered layout with strong visual hierarchy
- Generous negative space — do not crowd the card
- The card should look like a premium physical invitation
- Suitable to float as an overlay on a luxury lifestyle video
- Card takes up approximately 70% of the image frame
- Soft neutral background behind the card (cream or very light gray)

Style reference: High-end fashion editorial stationery. Think Vogue meets luxury wedding invitation meets fantasy game UI card.`;
}

// ─── DALL-E 3 API (axios — matches objectGenerationService pattern) ──────────

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

  return response.data.data[0];
}

// ─── S3 UPLOAD ────────────────────────────────────────────────────────────────

async function uploadToS3(imageBuffer, eventId, contentType = 'image/png') {
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const s3Key = `invitations/${eventId}/${uuidv4()}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: imageBuffer,
    ContentType: contentType,
    CacheControl: 'max-age=31536000',
    Metadata: { source: 'invitation-generator', event_id: eventId },
  }));

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

// ─── S3 CLEANUP ───────────────────────────────────────────────────────────────

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

async function createInvitationAsset(models, event, s3Url, prompt, showId) {
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
      source: 'invitation-generator',
      event_id: event.id,
      event_name: event.name,
      prompt_used: prompt.slice(0, 500),
      theme: event.theme,
      prestige: event.prestige,
      generated_at: new Date().toISOString(),
    },
    approval_status: 'approved',
  });

  return asset;
}

// ─── MAIN SERVICE ─────────────────────────────────────────────────────────────

/**
 * Generate a LalaVerse invitation letter for an event.
 *
 * @param {string} eventId
 * @param {object} models - Sequelize models
 * @param {string} showId
 * @returns {{ asset, imageUrl, prompt }}
 */
async function generateInvitation(eventId, models, showId) {
  const { sequelize } = models;

  // Load the event
  const [event] = await sequelize.query(
    'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',
    { replacements: { eventId }, type: sequelize.QueryTypes.SELECT }
  );

  if (!event) throw new Error(`Event ${eventId} not found`);

  // Build prompt
  const prompt = buildInvitationPrompt(event);

  console.log(`[InviteGen] Generating invitation for: ${event.name}`);
  console.log(`[InviteGen] Theme: ${event.theme || 'default'} | Prestige: ${event.prestige}`);

  // Clean up old invitation asset before generating new one
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

  // Call DALL-E 3
  const result = await callDallE3(prompt);
  const imageUrl = result?.url;
  const revisedPrompt = result?.revised_prompt;

  if (!imageUrl) throw new Error('DALL-E 3 did not return an image URL');

  // Download the image
  const imageResponse = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 60000,
  });
  const imageBuffer = Buffer.from(imageResponse.data);

  // Upload to S3
  const s3Url = await uploadToS3(imageBuffer, eventId, 'image/png');

  console.log(`[InviteGen] Stored at: ${s3Url}`);

  // Clean up old S3 object (best-effort, after new one is safely stored)
  if (oldAssetUrl) {
    await deleteOldS3Asset(oldAssetUrl);
  }

  // Create Asset record
  const asset = await createInvitationAsset(models, event, s3Url, prompt, showId);

  // Link back to event
  await sequelize.query(
    'UPDATE world_events SET invitation_asset_id = :assetId, updated_at = NOW() WHERE id = :eventId',
    { replacements: { assetId: asset.id, eventId } }
  );

  return {
    success: true,
    asset,
    imageUrl: s3Url,
    prompt: revisedPrompt || prompt,
    eventName: event.name,
    theme: event.theme || 'default',
  };
}

module.exports = { generateInvitation, buildInvitationPrompt };

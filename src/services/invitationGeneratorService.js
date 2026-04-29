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
const { detectTheme, buildInvitationContent, compositeInvitationPDF } = require('./invitationCompositingService');

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
  const themeName = detectTheme(event);
  const themeConfig = (themeName && THEME_PRESETS[themeName]) || DEFAULT_THEME;

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
- The card fills the ENTIRE image edge to edge — NO surrounding background, NO border gap, NO drop shadow
- Portrait card format (taller than wide), the card IS the image
- Decorative elements concentrated at top and bottom edges
- Large empty cream/ivory center zone — this is where text will appear
- Soft vignette effect toward center (lighter in middle, slightly darker at edges)
- ${themeConfig.atmosphere}
- The card surface extends to all four edges of the image

Style: High-end fashion editorial stationery. Think luxury wedding stationery meets fashion house invite.
Output: Edge-to-edge card surface, no outer background, suitable for text overlay compositing.`;
}

// ─── IMAGE GENERATION (via unified service) ────────────────────────────────

const { generateImageUrl } = require('./imageGenerationService');

async function callDallE3(prompt) {
  return generateImageUrl(prompt, { size: 'portrait', quality: 'hd', useCase: 'invitation' });
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

async function _deleteOldS3Asset(url) {
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

// ─── VERSION COUNTING ─────────────────────────────────────────────────────────

async function getNextVersion(sequelize, eventId) {
  const [result] = await sequelize.query(
    `SELECT COUNT(*) as count FROM assets
     WHERE metadata->>'event_id' = :eventId
       AND asset_type = 'INVITATION_LETTER'`,
    { replacements: { eventId }, type: sequelize.QueryTypes.SELECT }
  );
  return (parseInt(result?.count || 0, 10)) + 1;
}

// ─── STYLE REFERENCE (host_brand consistency) ─────────────────────────────────

async function findBrandStyleReference(sequelize, event) { // eslint-disable-line no-unused-vars
  if (!event.host_brand) return null;
  try {
    // Find the most recent invitation from the same host_brand
    const [prev] = await sequelize.query(
      `SELECT a.s3_url_processed FROM assets a
       JOIN world_events e ON a.metadata->>'event_id' = e.id::text
       WHERE e.host_brand = :brand
         AND e.id != :eventId
         AND a.asset_type = 'INVITATION_LETTER'
         AND a.deleted_at IS NULL
       ORDER BY a.created_at DESC LIMIT 1`,
      { replacements: { brand: event.host_brand, eventId: event.id }, type: sequelize.QueryTypes.SELECT }
    );
    return prev?.s3_url_processed || null;
  } catch {
    return null; // approval_status column may not exist yet
  }
}

// ─── ASSET RECORD ─────────────────────────────────────────────────────────────

async function createInvitationAsset(models, event, s3ProcessedUrl, showId, version, resolvedTheme, s3RawUrl = null) {
  const { Asset } = models;
  const rawUrl = s3RawUrl || s3ProcessedUrl;

  const asset = await Asset.create({
    id: uuidv4(),
    name: `${event.name} — Invitation v${version}`,
    asset_type: 'INVITATION_LETTER',
    asset_role: 'UI.OVERLAY.INVITATION',
    asset_group: 'SHOW',
    asset_scope: 'SHOW',
    purpose: 'MAIN',
    category: 'overlay',
    entity_type: 'prop',
    s3_url_raw: rawUrl,
    s3_url_processed: s3ProcessedUrl,
    processing_status: 'none',
    mood_tags: [
      event.mood,
      resolvedTheme,
      ...(event.dress_code_keywords || []).slice(0, 2),
    ].filter(Boolean),
    color_palette: event.color_palette || [],
    show_id: showId || null,
    metadata: {
      source: 'invitation-generator-v2',
      event_id: event.id,
      event_name: event.name,
      theme: resolvedTheme,
      theme_source: event.theme ? 'manual' : 'auto-detected',
      prestige: event.prestige,
      version,
      host_brand: event.host_brand || null,
      composited: true, // set to actual value by caller
      generated_at: new Date().toISOString(),
    },
    approval_status: 'pending_review',
  }).catch(async (err) => {
    // Retry without columns that may not exist
    console.warn('[InviteGen] Asset.create failed, retrying minimal:', err.message);
    return Asset.create({
      id: uuidv4(),
      name: `${event.name} — Invitation v${version}`,
      asset_type: 'INVITATION_LETTER',
      s3_url_raw: rawUrl,
      s3_url_processed: s3ProcessedUrl,
      show_id: showId || null,
      metadata: {
        source: 'invitation-generator-v2',
        event_id: event.id,
        event_name: event.name,
        theme: resolvedTheme,
        version,
        generated_at: new Date().toISOString(),
      },
    }).catch(async (err2) => {
      // Last resort: raw SQL with only guaranteed columns
      console.warn('[InviteGen] Asset.create minimal failed, using raw SQL:', err2.message);
      const assetId = uuidv4();
      await models.sequelize.query(
        `INSERT INTO assets (id, name, asset_type, s3_url_raw, s3_url_processed, show_id, metadata, created_at, updated_at)
         VALUES (:id, :name, 'INVITATION_LETTER', :url, :url, :showId, :metadata, NOW(), NOW())`,
        { replacements: {
          id: assetId, name: `${event.name} — Invitation v${version}`,
          url: s3ProcessedUrl, showId: showId || null,
          metadata: JSON.stringify({ source: 'invitation-generator-v2', event_id: event.id, theme: resolvedTheme, version }),
        } }
      );
      return { id: assetId, s3_url_processed: s3ProcessedUrl };
    });
  });

  return asset;
}

// ─── MAIN SERVICE ─────────────────────────────────────────────────────────────

/**
 * Generate a LalaVerse invitation letter for an event.
 *
 * Pipeline: DALL-E background -> Canvas text -> Sharp composite -> S3 -> Asset
 * Falls back to DALL-E-only if fonts are not installed.
 * Asset starts as pending_review — not linked to event until approved.
 * Previous versions are kept (soft-delete only on the event FK, not the assets).
 *
 * @param {string} eventId
 * @param {object} models - Sequelize models
 * @param {string} showId
 * @returns {{ asset, imageUrl, eventName, theme, version }}
 */
async function generateInvitation(eventId, models, showId) {
  const { sequelize } = models;

  // Load the event (world_events has no deleted_at column)
  const [event] = await sequelize.query(
    'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',
    { replacements: { eventId }, type: sequelize.QueryTypes.SELECT }
  );

  if (!event) throw new Error(`Event ${eventId} not found`);

  const resolvedTheme = detectTheme(event) || 'default';
  const version = await getNextVersion(sequelize, eventId);

  console.log(`[InviteGen] Generating v${version} for: ${event.name} | Theme: ${resolvedTheme} | Prestige: ${event.prestige}`);

  // Step 1: Claude writes the invitation prose (formal, elegant, personal)
  let invitationText = null;
  try {
    invitationText = await buildInvitationContent(event);
    console.log(`[InviteGen] Claude wrote prose: ${invitationText.opening?.slice(0, 50)}...`);
  } catch (proseErr) {
    console.warn('[InviteGen] Claude prose failed, using structured fallback:', proseErr.message);
  }

  // Build the text that goes on the card
  const automation = typeof event.canon_consequences === 'string'
    ? JSON.parse(event.canon_consequences) : (event.canon_consequences || {});
  const auto = automation.automation || {};
  const hostName = auto.host_display_name || event.host || 'A Special Host';
  const venueName = auto.venue_name || event.venue_name || event.location_hint || '';
  const eventDate = auto.event_date || event.event_date || '';
  const eventTime = auto.event_time || event.event_time || 'Evening';

  // Use Claude's prose if available, otherwise structured text. This object is
  // used for deterministic server-side compositing so invitation text is
  // always visible, regardless of model text-rendering quality.
  let invitationContent;
  if (invitationText?.opening && invitationText?.body) {
    invitationContent = {
      eventName: event.name?.split(' — ')[0]?.trim() || event.name || 'Invitation',
      eventSubtitle: event.name?.includes(' — ') ? event.name.split(' — ')[1].trim() : null,
      opening: invitationText.opening,
      body: invitationText.body,
      closing: invitationText.closing || 'We look forward to your presence.',
      hostName,
      hostBrand: event.host_brand || '',
      prestige: event.prestige || 5,
    };
  } else {
    invitationContent = {
      eventName: event.name?.split(' — ')[0]?.trim() || event.name || 'Invitation',
      eventSubtitle: event.name?.includes(' — ') ? event.name.split(' — ')[1].trim() : null,
      opening: 'You are invited to',
      body: [
        `Hosted by ${hostName}`,
        venueName ? `at ${venueName}` : '',
        eventDate ? `${eventDate} · ${eventTime}` : eventTime,
        event.dress_code ? `Dress Code: ${event.dress_code}` : '',
      ].filter(Boolean).join('. '),
      closing: 'We look forward to your presence.',
      hostName,
      hostBrand: event.host_brand || '',
      prestige: event.prestige || 5,
    };
  }

  // Step 2: Generate a text-free luxury background card.
  const backgroundPrompt = buildBackgroundPrompt(event);
  console.log('[InviteGen] Generating invitation background (text-free)...');
  const backgroundImageUrl = await callDallE3(backgroundPrompt);
  if (!backgroundImageUrl) throw new Error('Image generation did not return a URL');

  const bgResponse = await axios.get(backgroundImageUrl, { responseType: 'arraybuffer', timeout: 60000 });
  const backgroundBuffer = Buffer.from(bgResponse.data);

  // Keep raw background so edit/re-render can reliably composite new text.
  const rawBackgroundUrl = await uploadToS3(backgroundBuffer, eventId, `v${version}-bg`, 'image/jpeg');

  // Step 3: Composite invitation text server-side (guaranteed readability).
  let finalBuffer = await compositeInvitation(backgroundBuffer, event, invitationContent);
  if (!finalBuffer) {
    throw new Error('Invitation text compositing failed');
  }

  // Upload final invitation image.
  const s3Url = await uploadToS3(finalBuffer, eventId, `v${version}`, 'image/png');
  console.log(`[InviteGen] Invitation v${version} stored: ${s3Url}`);

  // Store invitation text on the event for reference/editing
  if (invitationContent) {
    try {
      await sequelize.query(
        `UPDATE world_events SET canon_consequences = jsonb_set(
          COALESCE(canon_consequences, '{}'),
          '{invitation_text}',
          :textJson::jsonb
        ), updated_at = NOW() WHERE id = :eventId`,
        { replacements: { textJson: JSON.stringify(invitationContent), eventId } }
      );
    } catch { /* non-blocking */ }
  }

  // Create Asset record (pending_review — not linked to event until approved)
  // Previous versions are NOT deleted — kept for history
  const asset = await createInvitationAsset(models, event, s3Url, showId, version, resolvedTheme, rawBackgroundUrl);

  // If event is already injected into an episode, link asset to it
  // so it appears in the episode's Assets tab once approved
  if (event.used_in_episode_id) {
    await sequelize.query(
      'UPDATE assets SET episode_id = :episodeId WHERE id = :assetId',
      { replacements: { episodeId: event.used_in_episode_id, assetId: asset.id } }
    );
  }

  return {
    success: true,
    asset,
    imageUrl: s3Url,
    eventName: event.name,
    theme: resolvedTheme,
    version,
    composited: true,
  };
}

/**
 * Export an existing invitation as a high-res print-ready PNG.
 */
async function exportInvitationPDF(eventId, models) {
  const { sequelize } = models;

  const [event] = await sequelize.query(
    'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',
    { replacements: { eventId }, type: sequelize.QueryTypes.SELECT }
  );
  if (!event) throw new Error(`Event ${eventId} not found`);
  if (!event.invitation_asset_id) throw new Error('No approved invitation for this event');

  const [asset] = await sequelize.query(
    'SELECT s3_url_raw FROM assets WHERE id = :id AND deleted_at IS NULL LIMIT 1',
    { replacements: { id: event.invitation_asset_id }, type: sequelize.QueryTypes.SELECT }
  );
  if (!asset?.s3_url_raw) throw new Error('Invitation asset not found');

  // Download the current invitation background
  const response = await axios.get(asset.s3_url_raw, {
    responseType: 'arraybuffer',
    timeout: 60000,
  });
  const bgBuffer = Buffer.from(response.data);

  // Re-composite at full quality for print
  const pdfBuffer = await compositeInvitationPDF(bgBuffer, event);
  if (!pdfBuffer) throw new Error('Fonts not available for PDF export');

  return pdfBuffer;
}

module.exports = { generateInvitation, exportInvitationPDF, buildBackgroundPrompt, uploadToS3 };

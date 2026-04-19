'use strict';

/**
 * UI Overlay Service — Dynamic (DB-only)
 *
 * All overlay/screen types are defined per-show in the ui_overlay_types table.
 * No hardcoded type lists — each show builds its own phone from scratch.
 * Icons link to screens via the opens_screen column.
 */

const { generateImageUrl } = require('./imageGenerationService');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const s3 = new S3Client({ region: AWS_REGION });

// ── DEFAULT STYLE PREFIX (fallback when show has no custom style_prefix) ────
const DEFAULT_STYLE_PREFIX = 'Luxury fashion app UI element. Gold (#B8962E) metallic finish, parchment (#FAF7F0) tones, dark ink (#2C2C2C) accents. Clean, minimal, high-end. Think Chanel meets Apple. ';

// Fetch show's custom style_prefix, falling back to default
async function getStylePrefix(showId, models) {
  try {
    const [rows] = await models.sequelize.query(
      `SELECT style_prefix FROM shows WHERE id = :showId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { showId } }
    );
    return (rows?.[0]?.style_prefix || DEFAULT_STYLE_PREFIX).trim() + ' ';
  } catch {
    return DEFAULT_STYLE_PREFIX;
  }
}

// ── GET ALL OVERLAY TYPES (DB-only) ─────────────────────────────────────────

async function getAllOverlayTypes(showId, models) {
  try {
    const [rows] = await models.sequelize.query(
      `SELECT id, type_key, name, category, beat, description, prompt, sort_order,
              lifecycle, opens_screen, is_home
       FROM ui_overlay_types WHERE show_id = :showId AND deleted_at IS NULL
       ORDER BY is_home DESC, sort_order ASC, name ASC`,
      { replacements: { showId } }
    );
    return (rows || []).map(r => ({
      id: r.type_key,
      name: r.name,
      category: r.category || 'phone',
      beat: r.beat || '',
      description: r.description || '',
      prompt: r.prompt,
      sort_order: r.sort_order,
      lifecycle: r.lifecycle || 'permanent',
      opens_screen: r.opens_screen || null,
      is_home: !!r.is_home,
      custom: true,
      custom_id: r.id,
    }));
  } catch (err) {
    console.error('[UIOverlay] getAllOverlayTypes failed:', err.message);
    return [];
  }
}

// Alias for backwards compatibility
async function getCustomOverlayTypes(showId, models) {
  return getAllOverlayTypes(showId, models);
}

// ── SUGGEST LINKED SCREENS FOR AN ICON ──────────────────────────────────────

async function suggestLinkedScreens(showId, iconName, models) {
  // Strip common suffixes from the icon name to find matching screens
  const stripped = (iconName || '')
    .replace(/\s*(icon|app icon|app)\s*$/i, '')
    .trim()
    .toLowerCase();

  if (!stripped) return [];

  const allTypes = await getAllOverlayTypes(showId, models);
  const screens = allTypes.filter(t => t.category === 'phone');

  // Popularity signal: count how many tap zones already target each screen.
  // Popular targets surface above rarely-linked peers at the same name score.
  const targetCounts = new Map();
  try {
    const [rows] = await models.sequelize.query(
      `SELECT metadata::text AS metadata_text FROM assets
       WHERE show_id = :showId AND asset_type = 'UI_OVERLAY' AND deleted_at IS NULL`,
      { replacements: { showId } }
    );
    for (const row of rows || []) {
      let meta = {};
      try { meta = JSON.parse(row.metadata_text || '{}'); } catch { /* noop */ }
      for (const link of meta.screen_links || []) {
        if (link.target) targetCounts.set(link.target, (targetCounts.get(link.target) || 0) + 1);
      }
    }
  } catch { /* popularity is a bonus, not a requirement */ }

  // Score each screen by relevance to the stripped icon name
  const scored = screens.map(s => {
    const sName = (s.name || '').toLowerCase();
    const sKey = (s.id || '').toLowerCase();
    let score = 0;
    if (sName === stripped || sKey === stripped) score = 100;
    else if (sName.includes(stripped) || stripped.includes(sName)) score = 80;
    else if (sKey.includes(stripped.replace(/\s+/g, '_'))) score = 70;
    else {
      // Word overlap
      const iconWords = stripped.split(/\s+/);
      const nameWords = sName.split(/\s+/);
      const overlap = iconWords.filter(w => nameWords.includes(w)).length;
      if (overlap > 0) score = 30 + (overlap * 20);
    }
    // Small popularity tiebreaker (caps at +10 so a name match still dominates)
    const popularityBonus = Math.min(targetCounts.get(s.id) || 0, 10);
    return { ...s, score: score + popularityBonus };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score, ...s }) => s);
}

// ── SUGGEST OVERLAYS FOR AN EVENT ───────────────────────────────────────────

function suggestOverlaysForEvent(event) {
  const suggestions = [];
  const type = event?.event_type || 'invite';
  const auto = event?.canon_consequences?.automation || {};

  if (['invite', 'upgrade', 'brand_deal'].includes(type)) {
    suggestions.push({ id: 'mail_panel', reason: 'Invitation scene' });
  }
  if (event?.outfit_pieces?.length > 0 || (event?.prestige || 5) >= 4) {
    suggestions.push({ id: 'wardrobe_list', reason: 'Outfit selection scene' });
  }
  if (event?.outfit_pieces?.length > 0 || (event?.prestige || 5) >= 5) {
    suggestions.push({ id: 'closet_ui', reason: 'Wardrobe browsing scene' });
  }
  if (['brand_deal', 'deliverable'].includes(type) || (event?.prestige || 5) >= 6) {
    suggestions.push({ id: 'career_list', reason: type === 'brand_deal' ? 'Brand deliverables' : 'Career tasks' });
  }
  if (auto.social_tasks?.length > 0) {
    suggestions.push({ id: 'social_tasks', reason: `${auto.social_tasks.length} social tasks` });
  }
  if (['brand_deal', 'upgrade'].includes(type) || event?.is_paid || (event?.prestige || 5) >= 7) {
    suggestions.push({ id: 'stats_panel', reason: event?.is_paid ? 'Financial reveal (paid event)' : 'Stats reveal' });
  }

  return suggestions;
}

// ── GENERATE SINGLE OVERLAY ─────────────────────────────────────────────────

async function generateOverlay(overlayType, showId, options = {}) {
  const customPrompt = options.customPrompt || overlayType.prompt;
  const stylePrefix = options.stylePrefix || DEFAULT_STYLE_PREFIX;
  const prompt = stylePrefix + customPrompt;
  const size = overlayType.size || (
    (overlayType.category === 'icon' || overlayType.category === 'phone_icon') ? 'square' :
    overlayType.category === 'production' ? 'landscape' : 'portrait'
  );
  const skipBgRemoval = options.skipBgRemoval || false;
  const useCase = (overlayType.category === 'icon' || overlayType.category === 'phone_icon') ? 'icon' : 'overlay';
  const imageUrl = await generateImageUrl(prompt, { size, quality: 'hd', useCase });

  if (!imageUrl) throw new Error(`Failed to generate ${overlayType.name}`);

  // Download and upload to S3
  const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 60000 });
  let buffer = Buffer.from(imgResponse.data);

  // Remove background → transparent PNG (unless skipped)
  let bgRemoved = false;
  if (!skipBgRemoval && process.env.REMOVEBG_API_KEY) {
    try {
      const bgRes = await axios.post(
        'https://api.remove.bg/v1.0/removebg',
        { image_url: imageUrl, size: 'auto', format: 'png' },
        { headers: { 'X-Api-Key': process.env.REMOVEBG_API_KEY }, responseType: 'arraybuffer', timeout: 45000 }
      );
      buffer = Buffer.from(bgRes.data);
      bgRemoved = true;
    } catch (bgErr) {
      console.warn(`[UIOverlay] Background removal failed for ${overlayType.name}:`, bgErr.message);
    }
  }

  const s3Key = `ui-overlays/${showId}/${overlayType.id}-${Date.now()}.png`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET, Key: s3Key, Body: buffer,
    ContentType: 'image/png', CacheControl: 'max-age=31536000',
  }));
  const s3Url = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

  return { url: s3Url, bg_removed: bgRemoved, prompt_used: customPrompt };
}

// ── REMOVE BACKGROUND FROM EXISTING ASSET ───────────────────────────────────

async function removeBackgroundFromAsset(assetId, models) {
  if (!process.env.REMOVEBG_API_KEY) {
    throw new Error('REMOVEBG_API_KEY not configured');
  }

  const [rows] = await models.sequelize.query(
    `SELECT id, s3_url_raw, s3_url_processed, metadata FROM assets WHERE id = :assetId AND deleted_at IS NULL`,
    { replacements: { assetId } }
  );
  if (!rows?.length) throw new Error('Asset not found');

  const asset = rows[0];
  const sourceUrl = asset.s3_url_processed || asset.s3_url_raw;
  if (!sourceUrl) throw new Error('Asset has no image URL');

  const bgRes = await axios.post(
    'https://api.remove.bg/v1.0/removebg',
    { image_url: sourceUrl, size: 'auto', format: 'png' },
    { headers: { 'X-Api-Key': process.env.REMOVEBG_API_KEY }, responseType: 'arraybuffer', timeout: 45000 }
  );
  const buffer = Buffer.from(bgRes.data);

  const meta = typeof asset.metadata === 'string' ? JSON.parse(asset.metadata) : (asset.metadata || {});
  const overlayType = meta.overlay_type || 'unknown';
  const showIdFromMeta = meta.show_id || 'unknown';
  const s3Key = `ui-overlays/${showIdFromMeta}/${overlayType}-nobg-${Date.now()}.png`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET, Key: s3Key, Body: buffer,
    ContentType: 'image/png', CacheControl: 'max-age=31536000',
  }));
  const newUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

  meta.bg_removed = true;
  meta.bg_removed_at = new Date().toISOString();
  await models.sequelize.query(
    `UPDATE assets SET s3_url_processed = :newUrl, metadata = CAST(:metadata AS jsonb), updated_at = NOW()
     WHERE id = :assetId`,
    { replacements: { newUrl, metadata: JSON.stringify(meta), assetId } }
  );

  return { url: newUrl, bg_removed: true };
}

// ── UPLOAD CUSTOM OVERLAY ───────────────────────────────────────────────────

async function uploadOverlayToS3(buffer, overlayTypeId, showId, contentType) {
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const s3Key = `ui-overlays/${showId}/${overlayTypeId}-custom-${Date.now()}.${ext}`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET, Key: s3Key, Body: buffer,
    ContentType: contentType, CacheControl: 'max-age=31536000',
  }));
  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

// ── GENERATE ALL OVERLAYS FOR SHOW ──────────────────────────────────────────

async function generateAllOverlays(showId, models, options = {}) {
  const { skipExisting = true, batchSize = 3, episodeId = null } = options;
  const results = [];

  // Fetch per-show style prefix
  const stylePrefix = await getStylePrefix(showId, models);

  // Check which overlays already exist
  let existingTypes = new Set();
  if (skipExisting) {
    const existing = await getShowOverlays(showId, models);
    existingTypes = new Set(existing.map(e => e.overlay_type));
  }

  // All types come from DB now
  const allTypes = await getAllOverlayTypes(showId, models);

  const toGenerate = allTypes.filter(ot => {
    const lifecycle = ot.lifecycle || 'permanent';
    if (existingTypes.has(ot.id)) {
      return lifecycle === 'per_episode' && episodeId;
    }
    if (lifecycle === 'per_episode') return !!episodeId;
    return true;
  });
  console.log(`[UIOverlay] Generating ${toGenerate.length} overlays (${existingTypes.size} already exist, batch size ${batchSize})`);

  for (let i = 0; i < toGenerate.length; i += batchSize) {
    const batch = toGenerate.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (overlayType) => {
        console.log(`[UIOverlay] Generating: ${overlayType.name}...`);
        const { url, bg_removed } = await generateOverlay(overlayType, showId, { stylePrefix });

        const lifecycle = overlayType.lifecycle || 'permanent';
        let assetId = null;
        // Wrap the soft-delete + insert in a transaction so a failed INSERT
        // doesn't leave the previous asset tombstoned with no replacement —
        // that was stranding the S3 URL and hiding the image from the UI.
        try {
          const assetUuid = uuidv4();
          await models.sequelize.transaction(async (t) => {
            if (lifecycle === 'per_episode' && episodeId) {
              await models.sequelize.query(
                `UPDATE assets SET deleted_at = NOW() WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId
                 AND episode_id = :episodeId AND metadata::text LIKE :typePattern AND deleted_at IS NULL`,
                { replacements: { showId, episodeId, typePattern: `%"overlay_type": "${overlayType.id}"%` }, transaction: t }
              );
            }
            await models.sequelize.query(
              `INSERT INTO assets (id, name, asset_type, s3_url_raw, s3_url_processed, show_id, episode_id, metadata, created_at, updated_at)
               VALUES (:id, :name, 'UI_OVERLAY', :url, :url, :showId, :episodeId, :metadata, NOW(), NOW())`,
              { replacements: {
                id: assetUuid,
                name: `UI Overlay: ${overlayType.name}`,
                url,
                showId,
                episodeId: (lifecycle === 'per_episode' ? episodeId : null),
                metadata: JSON.stringify({
                  source: 'ui-overlay-generator',
                  overlay_type: overlayType.id,
                  overlay_beat: overlayType.beat,
                  overlay_category: overlayType.category,
                  overlay_lifecycle: lifecycle,
                  episode_id: (lifecycle === 'per_episode' ? episodeId : null),
                  bg_removed,
                  generated_at: new Date().toISOString(),
                }),
              }, transaction: t }
            );
          });
          assetId = assetUuid;
          console.log(`[UIOverlay] Asset saved: ${overlayType.name} → ${assetUuid}`);
        } catch (assetErr) {
          console.error(`[UIOverlay] Asset save FAILED for ${overlayType.name}:`, assetErr.message);
        }

        return {
          overlay_type: overlayType.id,
          name: overlayType.name,
          beat: overlayType.beat,
          url,
          bg_removed,
          asset_id: assetId,
        };
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const failedType = batch[batchResults.indexOf(result)];
        console.error(`[UIOverlay] Failed: ${failedType?.name}:`, result.reason?.message);
        results.push({ overlay_type: failedType?.id, name: failedType?.name, error: result.reason?.message });
      }
    }

    if (typeof options.onProgress === 'function') {
      const successCount = results.filter(r => r.url).length;
      const failCount = results.filter(r => r.error).length;
      options.onProgress(successCount, failCount, toGenerate.length);
    }

    console.log(`[UIOverlay] Batch ${Math.floor(i / batchSize) + 1} complete (${results.filter(r => r.url).length} total generated)`);
  }

  console.log(`[UIOverlay] Done: ${results.filter(r => r.url).length}/${toGenerate.length} generated`);
  return results;
}

// ── GET EXISTING OVERLAYS FOR SHOW ──────────────────────────────────────────

async function getShowOverlays(showId, models) {
  try {
    const [rows] = await models.sequelize.query(
      `SELECT id, name, asset_type, asset_role,
              s3_url_processed, s3_url_raw,
              metadata::text as metadata_text,
              approval_status
       FROM assets
       WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId AND deleted_at IS NULL
       ORDER BY name ASC`,
      { replacements: { showId } }
    );

    if (!rows || rows.length === 0) {
      try {
        const [fb] = await models.sequelize.query(
          `SELECT id, name, asset_type, asset_role,
                  s3_url_processed, s3_url_raw,
                  metadata::text as metadata_text,
                  approval_status
           FROM assets
           WHERE show_id = :showId AND deleted_at IS NULL
           AND (
             asset_role LIKE 'UI.OVERLAY.%'
             OR LOWER(asset_type) = 'ui_overlay'
             OR name LIKE 'UI Overlay:%'
           )
           ORDER BY name ASC`,
          { replacements: { showId } }
        );
        if (fb && fb.length > 0) {
          console.log(`[UIOverlay] Found ${fb.length} overlays via fallback query`);
          return mapOverlayRows(fb);
        }
      } catch (fbErr) {
        console.error('[UIOverlay] Fallback query failed:', fbErr.message);
      }
      return [];
    }

    return mapOverlayRows(rows);
  } catch (err) {
    console.error('[UIOverlay] getShowOverlays failed:', err.message);
    return [];
  }
}

function mapOverlayRows(rows) {
  return rows.map(r => {
    let meta = {};
    try {
      meta = r.metadata_text ? JSON.parse(r.metadata_text) : {};
    } catch { /* malformed JSON — use empty */ }

    const overlayType = meta.overlay_type
      || (r.asset_role ? r.asset_role.replace('UI.OVERLAY.', '').toLowerCase() : null)
      || (r.name ? r.name.replace('UI Overlay: ', '').toLowerCase().replace(/\s+/g, '_') : null)
      || r.name;

    return {
      ...r,
      metadata: meta,
      overlay_type: overlayType,
      beat: meta.overlay_beat || '',
      url: r.s3_url_processed || r.s3_url_raw,
    };
  });
}

module.exports = {
  DEFAULT_STYLE_PREFIX,
  getStylePrefix,
  generateOverlay,
  generateAllOverlays,
  getAllOverlayTypes,
  getCustomOverlayTypes,
  getShowOverlays,
  removeBackgroundFromAsset,
  uploadOverlayToS3,
  suggestOverlaysForEvent,
  suggestLinkedScreens,
};

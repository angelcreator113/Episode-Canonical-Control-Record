'use strict';

/**
 * UI Overlay Generation Service
 *
 * Generates the 11 core UI overlay assets for "Styling Adventures with Lala."
 * Each overlay is a transparent PNG matching the show's design tokens:
 * parchment #FAF7F0, gold #B8962E, ink #2C2C2C
 *
 * Overlays are show-level assets (not per-scene-set) — consistent brand identity.
 */

const { generateImageUrl } = require('./imageGenerationService');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const s3 = new S3Client({ region: AWS_REGION });

// ── OVERLAY TYPE DEFINITIONS ─────────────────────────────────────────────────

const OVERLAY_TYPES = [
  // ── SCREEN FRAMES ──
  {
    id: 'login_screen',
    name: 'Login Screen',
    category: 'frame',
    beat: 'Beat 1-2',
    description: 'Login screen frame — no cursor, just the elegant entry portal',
    prompt: 'A luxury login screen UI frame. Dark elegant background with gold border. Center: an empty text input field with a golden line border. Below: a golden "Enter" button. Subtle gold particles around edges. The aesthetic of a luxury virtual world portal. Only the word "Enter" on the button. No cursor, no typing. Fashion tech aesthetic. Isolated on plain background.',
  },
  {
    id: 'mail_panel',
    name: 'Mail Panel',
    category: 'frame',
    beat: 'Beat 3-4',
    description: 'Opened mail panel frame — luxury letter display',
    prompt: 'A luxury opened mail panel UI frame, portrait orientation. Elegant parchment paper with gold borders and decorative corners. Empty center area for letter content. Thin gold line frame with ornate corner flourishes. Cream/ivory background with subtle texture. No text, no writing — empty frame only. Luxury stationery aesthetic. Isolated on plain background.',
  },
  {
    id: 'todo_checklist',
    name: 'Todo Checklist',
    category: 'frame',
    beat: 'Beat 5, 9',
    description: 'Luxury checklist panel — parchment with gold checkboxes',
    prompt: 'A luxury to-do list panel UI overlay. Parchment/cream background with gold border frame. 5 empty checkbox rows with thin gold lines. Each row has an empty square checkbox on the left and a horizontal line for text. Gold decorative header area at top. No actual text — empty template only. Luxury planner aesthetic. Isolated on plain background.',
  },
  {
    id: 'closet_ui',
    name: 'Closet UI',
    category: 'frame',
    beat: 'Beat 8',
    description: 'Wardrobe browser frame — clothing selection screen',
    prompt: 'A luxury wardrobe closet UI frame overlay. Elegant gold clothes hanger rack at the top with 4-5 empty hanger silhouettes. Below: a grid of 6 empty rounded rectangle slots for clothing items. Gold thin line borders. Cream/parchment background. Empty slots only — no actual clothes. Luxury fashion app aesthetic. Isolated on plain background.',
  },
  {
    id: 'stats_panel',
    name: 'Stats Panel',
    category: 'frame',
    beat: 'Beat 13',
    description: 'Prime Bank display — coins, credits, scores',
    prompt: 'A luxury stats/score panel UI overlay. Parchment background with gold border frame. 4 rows showing currency categories with empty value areas: a coin icon row, a star icon row, a diamond icon row, and a heart icon row. Each row has a small icon on left and space for number on right. Gold line separators. No numbers — empty template. Luxury banking aesthetic. Isolated on plain background.',
  },
  {
    id: 'phone_screen',
    name: 'Phone Screen',
    category: 'frame',
    beat: 'Feed moments',
    description: 'Phone mockup frame for rendering feed posts inside',
    prompt: 'A luxury smartphone frame mockup, front view. Thin gold bezels, rounded corners, notch at top. The screen area is completely empty white — blank canvas for content. Phone frame is elegant dark with gold edge accents. No UI inside screen — completely blank. Premium phone mockup. Isolated on plain background.',
  },
  {
    id: 'icon_holder',
    name: 'Icon Holder / Display',
    category: 'frame',
    beat: 'Various',
    description: 'Circular icon display mount — holds any icon',
    prompt: 'A luxury circular icon holder/mount. Elegant gold circle frame with soft inner glow, empty center for placing icons inside. Thin gold border ring with subtle ornate detailing. The center is transparent/empty. Think luxury app icon background. Isolated on plain background.',
  },

  // ── UI ICONS ──
  {
    id: 'cursor',
    name: 'Cursor',
    category: 'icon',
    beat: 'Beat 1-2',
    description: 'Elegant typing cursor — blinking line for login screen',
    prompt: 'A single elegant gold typing cursor line, vertical thin line with soft golden glow around it. Minimal, clean, just a blinking cursor indicator. Luxury tech aesthetic. Isolated on plain background.',
  },
  {
    id: 'mail_icon',
    name: 'Mail Icon',
    category: 'icon',
    beat: 'Beat 3',
    description: 'Gold mail envelope icon with glow',
    prompt: 'A single luxury gold mail envelope icon, elegant and minimal, with soft warm glow. Gold metallic finish with small wax seal detail. Luxury fashion notification icon. Isolated on plain background. No text.',
  },
  {
    id: 'voice_icon',
    name: 'Voice Icon',
    category: 'icon',
    beat: 'Beat 4',
    description: 'Voice activation microphone — Lala speaks',
    prompt: 'A luxury gold microphone icon with elegant soundwave lines. Minimal, modern, fashion-forward. Gold metallic finish. Smooth flowing soundwave lines, not jagged. Luxury tech meets fashion house. Isolated on plain background. No text.',
  },
  {
    id: 'perfume_icon',
    name: 'Perfume Icon',
    category: 'icon',
    beat: 'Beat 8',
    description: 'Perfume bottle icon — fragrance selection',
    prompt: 'A luxury gold perfume bottle icon, elegant and minimal. Classic fluted glass bottle silhouette with gold cap and subtle mist/spray detail. High-end fragrance aesthetic. Isolated on plain background. No text.',
  },
  {
    id: 'outfit_icon',
    name: 'Outfit Icon',
    category: 'icon',
    beat: 'Beat 8',
    description: 'Dress/outfit icon — clothing selection',
    prompt: 'A luxury gold dress silhouette icon, elegant cocktail dress shape. Minimal, clean lines, gold metallic finish. Fashion illustration style — not detailed, just the silhouette. Isolated on plain background. No text.',
  },
  {
    id: 'shoes_icon',
    name: 'Shoes Icon',
    category: 'icon',
    beat: 'Beat 8',
    description: 'High heel shoe icon — footwear selection',
    prompt: 'A luxury gold high heel stiletto shoe icon, elegant side profile silhouette. Minimal, clean lines, gold metallic finish. Fashion illustration style. Isolated on plain background. No text.',
  },
  {
    id: 'accessories_icon',
    name: 'Accessories Icon',
    category: 'icon',
    beat: 'Beat 8',
    description: 'Accessories icon — bag/jewelry selection',
    prompt: 'A luxury gold handbag icon, elegant clutch or designer bag silhouette. Minimal, clean lines, gold metallic finish with small clasp detail. Fashion illustration style. Isolated on plain background. No text.',
  },
  {
    id: 'location_icon',
    name: 'Location Icon',
    category: 'icon',
    beat: 'Beat 10',
    description: 'Map pin — event location / travel',
    prompt: 'A luxury gold map pin location icon, classic teardrop shape with small circle inside. Gold metallic finish with subtle motion lines suggesting travel. Minimal, clean. Isolated on plain background. No text.',
  },
  {
    id: 'reminder_icon',
    name: 'Reminder Icon',
    category: 'icon',
    beat: 'Beat 9',
    description: 'Clock/alarm — urgency notification',
    prompt: 'A luxury gold alarm clock icon, elegant round clock face with gold hands. Small urgency pulse rings emanating outward. Minimal, clean design. Luxury watch brand aesthetic. Isolated on plain background. No text.',
  },
  {
    id: 'dm_icon',
    name: 'DM Icon',
    category: 'icon',
    beat: 'Beat 14',
    description: 'Mysterious DM notification — dark intrigue',
    prompt: 'A dark mysterious chat bubble notification icon. Dark navy/charcoal rounded rectangle with subtle gold edge glow. Small anonymous silhouette avatar. Message area blurred suggesting mystery. Isolated on plain background. No text.',
  },
  {
    id: 'exit_icon',
    name: 'Exit Icon',
    category: 'icon',
    beat: 'Various',
    description: 'Exit/close button — X mark',
    prompt: 'A luxury gold X close button icon, elegant thin crossed lines forming an X. Gold metallic finish with subtle circle border. Minimal, clean, luxury app close button. Isolated on plain background.',
  },
  {
    id: 'minimize_icon',
    name: 'Minimize Icon',
    category: 'icon',
    beat: 'Various',
    description: 'Minimize/collapse button — dash mark',
    prompt: 'A luxury gold minimize button icon, elegant thin horizontal line (dash). Gold metallic finish with subtle circle border. Minimal, clean, luxury app minimize button. Isolated on plain background.',
  },
  {
    id: 'headphones_icon',
    name: 'Headphones Icon',
    category: 'icon',
    beat: 'Beat 1',
    description: 'Opening Ritual — headphones on, sacred moment',
    prompt: 'A luxury gold over-ear headphones icon, elegant silhouette with gold metallic finish. Premium audio headphones, sleek curves, minimal detail. The sacred opening ritual icon. Isolated on plain background. No text.',
  },
  {
    id: 'brand_deal_icon',
    name: 'Brand Deal Icon',
    category: 'icon',
    beat: 'Beat 7',
    description: 'Brand deal / partnership notification — handshake',
    prompt: 'A luxury gold handshake icon, two elegant hands meeting in a professional handshake. Gold metallic finish, minimal clean lines. Business partnership and brand collaboration aesthetic. Isolated on plain background. No text.',
  },
  {
    id: 'deadline_icon',
    name: 'Deadline Icon',
    category: 'icon',
    beat: 'Beat 9',
    description: 'Final countdown — red urgency, maximum pressure',
    prompt: 'A dramatic red and gold countdown timer icon, circular clock face with red accent glow and gold hands pointing to 12. Urgent pulse rings in red emanating outward. Maximum urgency aesthetic — the deadline is NOW. Isolated on plain background. No text.',
  },
];

// ── GENERATE SINGLE OVERLAY ──────────────────────────────────────────────────

async function generateOverlay(overlayType, showId) {
  const prompt = overlayType.prompt;
  const size = overlayType.size || (overlayType.category === 'icon' ? 'square' : 'portrait');
  const imageUrl = await generateImageUrl(prompt, { size, quality: 'hd' });

  if (!imageUrl) throw new Error(`Failed to generate ${overlayType.name}`);

  // Download and upload to S3
  const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 60000 });
  let buffer = Buffer.from(imgResponse.data);

  // Remove background → transparent PNG
  let bgRemoved = false;
  if (process.env.REMOVEBG_API_KEY) {
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

  return { url: s3Url, bg_removed: bgRemoved };
}

// ── GENERATE ALL OVERLAYS FOR SHOW ───────────────────────────────────────────

async function generateAllOverlays(showId, models) {
  const { Asset } = models;
  const results = [];

  for (const overlayType of OVERLAY_TYPES) {
    try {
      console.log(`[UIOverlay] Generating: ${overlayType.name} (${overlayType.beat})...`);
      const { url, bg_removed } = await generateOverlay(overlayType, showId);

      // Create Asset record
      let asset = null;
      if (Asset) {
        try {
          asset = await Asset.create({
            id: uuidv4(),
            name: `UI Overlay: ${overlayType.name}`,
            asset_type: 'UI_OVERLAY',
            asset_role: `UI.OVERLAY.${overlayType.id.toUpperCase()}`,
            asset_group: 'SHOW',
            asset_scope: 'SHOW',
            approval_status: 'approved',
            s3_url_raw: url,
            s3_url_processed: url,
            show_id: showId,
            metadata: {
              source: 'ui-overlay-generator',
              overlay_type: overlayType.id,
              overlay_beat: overlayType.beat,
              bg_removed,
              generated_at: new Date().toISOString(),
            },
          });
        } catch (assetErr) {
          console.warn(`[UIOverlay] Asset creation failed for ${overlayType.name}:`, assetErr.message);
        }
      }

      results.push({
        overlay_type: overlayType.id,
        name: overlayType.name,
        beat: overlayType.beat,
        url,
        bg_removed,
        asset_id: asset?.id || null,
      });
    } catch (err) {
      console.error(`[UIOverlay] Failed to generate ${overlayType.name}:`, err.message);
      results.push({ overlay_type: overlayType.id, name: overlayType.name, error: err.message });
    }
  }

  console.log(`[UIOverlay] Generated ${results.filter(r => r.url).length}/${OVERLAY_TYPES.length} overlays`);
  return results;
}

// ── GET EXISTING OVERLAYS FOR SHOW ───────────────────────────────────────────

async function getShowOverlays(showId, models) {
  try {
    const [rows] = await models.sequelize.query(
      `SELECT id, name, s3_url_processed, s3_url_raw, metadata, approval_status
       FROM assets WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId AND deleted_at IS NULL
       ORDER BY name ASC`,
      { replacements: { showId } }
    );
    return (rows || []).map(r => ({
      ...r,
      overlay_type: r.metadata?.overlay_type || r.name,
      beat: r.metadata?.overlay_beat || '',
      url: r.s3_url_processed || r.s3_url_raw,
    }));
  } catch {
    return [];
  }
}

module.exports = {
  OVERLAY_TYPES,
  generateOverlay,
  generateAllOverlays,
  getShowOverlays,
};

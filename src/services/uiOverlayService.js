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
  {
    id: 'mail_notification',
    name: 'Mail Notification',
    beat: 'Beat 3',
    description: 'Gold mail icon with subtle glow — the "you\'ve got mail" moment',
    prompt: 'A single luxury gold mail envelope icon, elegant and minimal, floating on transparent background. Gold metallic finish with soft warm glow around it. The envelope has a small wax seal. Luxury fashion aesthetic — think Chanel notification icon. Isolated object on plain background, no text.',
    size: 'square',
  },
  {
    id: 'mail_panel',
    name: 'Mail Panel',
    beat: 'Beat 3-4',
    description: 'Opened mail panel frame — luxury envelope/letter display',
    prompt: 'A luxury opened mail panel UI frame, portrait orientation. Elegant parchment paper with gold borders and decorative corners. Empty center area for letter content. Thin gold line frame with ornate corner flourishes. Cream/ivory background with subtle texture. No text, no writing — empty frame only. Luxury stationery aesthetic.',
    size: 'portrait',
  },
  {
    id: 'voice_activation',
    name: 'Voice Activation',
    beat: 'Beat 4',
    description: 'Lala\'s voice icon — microphone/soundwave in gold',
    prompt: 'A luxury gold microphone icon with elegant soundwave lines emanating from it. Minimal, modern, fashion-forward design. Gold metallic finish on plain background. The soundwave lines are smooth and flowing, not jagged. Isolated icon, no text. Think luxury tech brand meets fashion house.',
    size: 'square',
  },
  {
    id: 'todo_checklist',
    name: 'Todo Checklist',
    beat: 'Beat 5, 9',
    description: 'Luxury checklist panel — parchment with gold checkboxes',
    prompt: 'A luxury to-do list panel UI overlay. Parchment/cream background with gold border frame. 5 empty checkbox rows with thin gold lines. Each row has an empty square checkbox on the left and a horizontal line for text. Elegant serif typography spacing. Gold decorative header area at top. No actual text or writing — empty template only. Luxury planner aesthetic.',
    size: 'portrait',
  },
  {
    id: 'closet_ui',
    name: 'Closet UI',
    beat: 'Beat 8',
    description: 'Wardrobe browser frame — clothing rack/hangers silhouette',
    prompt: 'A luxury wardrobe closet UI frame overlay. Elegant gold clothes hanger rack at the top with 4-5 empty hanger silhouettes. Below: a grid of 6 empty rounded rectangle slots for clothing items. Gold thin line borders. Cream/parchment background. The frame for a fashion selection screen. No actual clothes — empty slots only. Luxury fashion app aesthetic.',
    size: 'portrait',
  },
  {
    id: 'event_reminder',
    name: 'Event Reminder',
    beat: 'Beat 9',
    description: 'Clock/alarm notification — urgency pulse',
    prompt: 'A luxury gold alarm clock icon with urgency indicators. Elegant round clock face with gold hands, small pulse rings emanating outward suggesting urgency. Minimal, clean design on plain background. Fashion-forward alarm/reminder icon. No text. Luxury watch brand aesthetic.',
    size: 'square',
  },
  {
    id: 'location_travel',
    name: 'Location Travel',
    beat: 'Beat 10',
    description: 'Map pin / car icon — transition overlay',
    prompt: 'A luxury gold map pin location icon with elegant motion lines suggesting travel/movement. The pin is teardrop-shaped with a gold metallic finish. Subtle speed lines or route path trailing behind it. Isolated on plain background. No text. Think luxury car brand meets navigation icon.',
    size: 'square',
  },
  {
    id: 'stats_panel',
    name: 'Stats Panel',
    beat: 'Beat 13',
    description: 'Prime Bank display — coins, credits, scores',
    prompt: 'A luxury stats/score panel UI overlay. Parchment background with gold border frame. 4 rows showing currency/score categories with empty value areas: a coin icon row, a star icon row, a diamond icon row, and a heart icon row. Each row has a small icon on the left and space for a number on the right. Gold thin line separators between rows. No actual numbers or text — empty template. Luxury banking app aesthetic.',
    size: 'portrait',
  },
  {
    id: 'mysterious_dm',
    name: 'Mysterious DM',
    beat: 'Beat 14',
    description: 'Phone DM notification — dark/intrigue style',
    prompt: 'A dark mysterious phone notification bubble icon. Dark navy/charcoal rounded rectangle with a subtle gold edge glow. Small anonymous avatar circle on the left (silhouette). Message preview area is blurred/obscured suggesting mystery. Isolated on plain background. No readable text. Luxury intrigue aesthetic — something secret has arrived.',
    size: 'square',
  },
  {
    id: 'login_overlay',
    name: 'Login Overlay',
    beat: 'Beat 1-2',
    description: 'Login screen frame — typing cursor animation frame',
    prompt: 'A luxury login screen UI frame overlay. Dark elegant background with gold border. Center: a username input field with a blinking cursor line. Below: a golden "Enter" button. Subtle gold particles or sparkles around the edges. The aesthetic of logging into a luxury virtual world. Minimal text — just the word "Enter" on the button. Fashion tech aesthetic.',
    size: 'landscape',
  },
  {
    id: 'phone_screen',
    name: 'Phone Screen',
    beat: 'Feed moments',
    description: 'Phone mockup frame — for rendering feed posts inside',
    prompt: 'A luxury smartphone frame mockup, front view. Thin gold bezels, rounded corners, notch at top. The screen area is completely empty/white — a blank canvas for content. The phone frame itself is elegant dark with gold accents on the edges. Isolated on plain background. No UI elements inside the screen — completely blank. Premium phone mockup aesthetic.',
    size: 'portrait',
  },
];

// ── GENERATE SINGLE OVERLAY ──────────────────────────────────────────────────

async function generateOverlay(overlayType, showId) {
  const prompt = overlayType.prompt;
  const imageUrl = await generateImageUrl(prompt, { size: overlayType.size, quality: 'hd' });

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

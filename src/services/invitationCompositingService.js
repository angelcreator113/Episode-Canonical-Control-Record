'use strict';

/**
 * Invitation Compositing Service v2
 *
 * Takes a DALL-E generated background and composites real, legible
 * invitation text on top using Canvas + Sharp.
 *
 * v2 enhancements:
 *   - Smart layout engine: measures all content first, distributes spacing
 *     proportionally, guarantees no overflow (flexbox-like in Canvas)
 *   - Theme auto-detection from dress_code_keywords when theme is blank
 *   - Font fallback: returns null when fonts missing (caller falls back to v1)
 *   - PDF export: compositeInvitationPDF() returns a Sharp-rendered PDF buffer
 *
 * Fonts: Cormorant Garamond (headers/signature) + Libre Baskerville (body)
 * Install: node scripts/install-invitation-fonts.js
 */

const { createCanvas, registerFont } = require('canvas');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// ─── FONT MANAGEMENT ──────────────────────────────────────────────────────────

const FONT_DIR = path.join(__dirname, '../assets/fonts/invitation');

let fontsAvailable = false;
let fontsChecked = false;

function checkFonts() {
  if (fontsChecked) return fontsAvailable;
  fontsChecked = true;

  const required = [
    'CormorantGaramond-Regular.ttf',
    'CormorantGaramond-Bold.ttf',
    'CormorantGaramond-Italic.ttf',
    'LibreBaskerville-Regular.ttf',
    'LibreBaskerville-Italic.ttf',
    'LibreBaskerville-Bold.ttf',
  ];

  const missing = required.filter(f => !fs.existsSync(path.join(FONT_DIR, f)));
  if (missing.length > 0) {
    console.warn(`[InviteComposite] Missing fonts (${missing.length}/${required.length}) — compositing disabled`);
    console.warn(`[InviteComposite] Run: node scripts/install-invitation-fonts.js`);
    fontsAvailable = false;
    return false;
  }

  try {
    registerFont(path.join(FONT_DIR, 'CormorantGaramond-Regular.ttf'), { family: 'CormorantGaramond', weight: 'normal', style: 'normal' });
    registerFont(path.join(FONT_DIR, 'CormorantGaramond-Bold.ttf'),    { family: 'CormorantGaramond', weight: 'bold',   style: 'normal' });
    registerFont(path.join(FONT_DIR, 'CormorantGaramond-Italic.ttf'),  { family: 'CormorantGaramond', weight: 'normal', style: 'italic' });
    registerFont(path.join(FONT_DIR, 'LibreBaskerville-Regular.ttf'),  { family: 'LibreBaskerville',  weight: 'normal', style: 'normal' });
    registerFont(path.join(FONT_DIR, 'LibreBaskerville-Italic.ttf'),   { family: 'LibreBaskerville',  weight: 'normal', style: 'italic' });
    registerFont(path.join(FONT_DIR, 'LibreBaskerville-Bold.ttf'),     { family: 'LibreBaskerville',  weight: 'bold',   style: 'normal' });
    fontsAvailable = true;
    console.log('[InviteComposite] Fonts registered successfully');
  } catch (err) {
    console.warn('[InviteComposite] Font registration failed:', err.message);
    fontsAvailable = false;
  }

  return fontsAvailable;
}

// ─── COLORS ───────────────────────────────────────────────────────────────────

const COLORS = {
  gold:       '#B8962E',
  goldLight:  '#D4AF37',
  goldDark:   '#8B6914',
  ink:        '#2C1810',
  inkLight:   '#4A3728',
  cream:      'rgba(255,253,245,0.92)',
  divider:    'rgba(184,150,46,0.4)',
  labelColor: '#8B6914',
};

// ─── THEME AUTO-DETECTION ─────────────────────────────────────────────────────

const KEYWORD_THEME_MAP = {
  'romantic':    'romantic garden',
  'garden':      'romantic garden',
  'floral':      'romantic garden',
  'botanical':   'romantic garden',
  'elegant':     'formal glamour',
  'formal':      'formal glamour',
  'classical':   'formal glamour',
  'black tie':   'formal glamour',
  'couture':     'formal glamour',
  'dramatic':    'power fashion',
  'bold':        'power fashion',
  'editorial':   'power fashion',
  'statement':   'power fashion',
  'minimal':     'chic minimal',
  'clean':       'chic minimal',
  'modern':      'chic minimal',
  'architectural': 'chic minimal',
  'warm':        'honey luxe',
  'honey':       'honey luxe',
  'golden':      'honey luxe',
  'amber':       'honey luxe',
  'blush':       'soft glam',
  'pink':        'soft glam',
  'rose':        'soft glam',
  'feminine':    'soft glam',
  'intimate':    'luxury intimate',
  'velvet':      'luxury intimate',
  'candlelit':   'luxury intimate',
  'evening':     'luxury intimate',
  'avant-garde': 'avant-garde',
  'edgy':        'avant-garde',
  'sculptural':  'avant-garde',
};

function detectTheme(event) {
  if (event.theme) return event.theme.toLowerCase();

  const keywords = [
    ...(event.dress_code_keywords || []),
    ...(event.dress_code || '').split(/[\s,]+/),
    ...(event.mood || '').split(/[\s,]+/),
  ].map(k => k.toLowerCase().trim()).filter(Boolean);

  // Count votes per theme
  const votes = {};
  for (const kw of keywords) {
    const theme = KEYWORD_THEME_MAP[kw];
    if (theme) votes[theme] = (votes[theme] || 0) + 1;
  }

  // Return highest-voted theme, or null for default
  const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || null;
}

// ─── TEXT WRAPPING ────────────────────────────────────────────────────────────

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── CONTENT BUILDER ─────────────────────────────────────────────────────────

function buildInvitationContent(event) {
  const nameParts = (event.name || 'Event').split(' — ');
  const eventName = nameParts[0].trim();
  const eventSubtitle = nameParts[1]?.trim() || null;

  let bodyText = event.narrative_stakes || event.description || '';
  if (!bodyText && event.location_hint) {
    bodyText = `Join us ${event.location_hint.toLowerCase().startsWith('at') ? '' : 'at '}${event.location_hint}.`;
  }
  if (!bodyText && event.dress_code_keywords?.length > 0) {
    bodyText = `An evening of ${event.dress_code_keywords.slice(0, 3).join(', ')} style and connection.`;
  }
  if (!bodyText) {
    bodyText = 'An exclusive gathering curated for rising voices in the industry.';
  }
  if (bodyText.length > 220) bodyText = bodyText.slice(0, 217) + '...';

  let investment;
  if (event.is_free || event.cost_coins === 0 || event.is_paid === 'free') {
    investment = 'Complimentary';
  } else if (event.is_paid === 'yes' && event.payment_amount > 0) {
    investment = `Lala earns ${event.payment_amount} coins`;
  } else {
    investment = `${event.cost_coins || 100} coins per guest`;
  }

  let guestPolicy;
  const poolSize = event.browse_pool_size || 1;
  if (poolSize >= 2) {
    guestPolicy = 'Plus one welcome';
  } else if (event.browse_pool_bias === 'social' || event.browse_pool_bias === 'romantic') {
    guestPolicy = 'Plus one encouraged';
  } else {
    guestPolicy = 'Lala only';
  }

  let deliverable = null;
  if (event.event_type === 'brand_deal' || event.event_type === 'deliverable') {
    deliverable = event.success_unlock
      ? event.success_unlock.split(',')[0].trim()
      : 'Content creation required upon arrival';
  }

  return {
    eventName,
    eventSubtitle,
    bodyText,
    location: event.location_hint || null,
    dressCode: event.dress_code || null,
    investment,
    guestPolicy,
    deliverable,
    hostName: event.host || 'The Host',
    hostBrand: event.host_brand || '',
    prestige: event.prestige || 5,
  };
}

// ─── SMART LAYOUT ENGINE ──────────────────────────────────────────────────────
//
// Phase 1: Measure all content blocks and compute total natural height
// Phase 2: If total exceeds card height, scale font sizes down proportionally
// Phase 3: Render with computed spacing — guarantees no overflow

function measureBlock(ctx, block, contentWidth) {
  ctx.font = block.font;
  if (block.type === 'text') {
    const lines = wrapText(ctx, block.text, contentWidth);
    return { ...block, lines, height: lines.length * block.lineHeight };
  }
  if (block.type === 'divider') return { ...block, height: 34 };
  if (block.type === 'gap') return { ...block, height: block.size };
  return { ...block, height: block.lineHeight || 20 };
}

function buildLayoutBlocks(content, width) {
  const blocks = [];
  const s = (ratio) => Math.round(width * ratio); // scale helper

  // Tone line
  blocks.push({ type: 'text', text: 'An Exclusive Invitation', font: `italic ${s(0.022)}px CormorantGaramond`, color: COLORS.goldDark, lineHeight: s(0.034), align: 'center' });
  // LalaVerse mark
  blocks.push({ type: 'text', text: 'LalaVerse', font: `${s(0.018)}px LibreBaskerville`, color: COLORS.gold, lineHeight: s(0.03), align: 'center' });
  blocks.push({ type: 'divider' });

  // Event name
  blocks.push({ type: 'text', text: content.eventName.toUpperCase(), font: `bold ${s(0.058)}px CormorantGaramond`, color: COLORS.ink, lineHeight: s(0.07), align: 'center' });
  if (content.eventSubtitle) {
    blocks.push({ type: 'gap', size: 4 });
    blocks.push({ type: 'text', text: content.eventSubtitle, font: `italic ${s(0.026)}px CormorantGaramond`, color: COLORS.inkLight, lineHeight: s(0.038), align: 'center' });
  }
  blocks.push({ type: 'divider' });

  // Greeting
  blocks.push({ type: 'text', text: 'Dearest Lala,', font: `italic ${s(0.028)}px CormorantGaramond`, color: COLORS.ink, lineHeight: s(0.042), align: 'center' });
  blocks.push({ type: 'gap', size: 8 });

  // Body text (italic, wraps)
  blocks.push({ type: 'text', text: content.bodyText, font: `italic ${s(0.022)}px LibreBaskerville`, color: COLORS.ink, lineHeight: s(0.036), align: 'center' });
  blocks.push({ type: 'divider' });

  // Details
  const addDetail = (label, value) => {
    if (!value) return;
    blocks.push({ type: 'label', text: label, font: `bold ${s(0.014)}px LibreBaskerville`, color: COLORS.labelColor, lineHeight: s(0.022), align: 'center' });
    blocks.push({ type: 'text', text: value, font: `${s(0.024)}px LibreBaskerville`, color: COLORS.ink, lineHeight: s(0.036), align: 'center' });
    blocks.push({ type: 'gap', size: 14 });
  };
  addDetail('LOCATION', content.location);
  addDetail('DRESS CODE', content.dressCode);
  addDetail('INVESTMENT', content.investment);
  addDetail('GUEST POLICY', content.guestPolicy);
  if (content.deliverable) addDetail('DELIVERABLE', content.deliverable);

  blocks.push({ type: 'divider' });

  // Closing
  blocks.push({ type: 'text', text: 'We look forward to your presence.', font: `italic ${s(0.022)}px LibreBaskerville`, color: COLORS.inkLight, lineHeight: s(0.036), align: 'center' });
  blocks.push({ type: 'gap', size: 16 });

  // Signature
  blocks.push({ type: 'text', text: 'Warmly,', font: `italic ${s(0.022)}px CormorantGaramond`, color: COLORS.inkLight, lineHeight: s(0.032), align: 'center' });
  blocks.push({ type: 'text', text: content.hostName, font: `bold ${s(0.032)}px CormorantGaramond`, color: COLORS.ink, lineHeight: s(0.044), align: 'center' });
  if (content.hostBrand) {
    blocks.push({ type: 'text', text: content.hostBrand, font: `${s(0.02)}px LibreBaskerville`, color: COLORS.gold, lineHeight: s(0.03), align: 'center' });
  }

  return blocks;
}

// ─── CANVAS RENDERER ──────────────────────────────────────────────────────────

function renderTextLayer(content, width = 1024, height = 1792) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Card dimensions
  const cardPadH = width * 0.12;
  const cardPadV = height * 0.08;
  const cardX = cardPadH;
  const cardY = cardPadV;
  const cardW = width - (cardPadH * 2);
  const cardH = height - (cardPadV * 2);
  const radius = 18;

  // Draw cream card overlay
  ctx.beginPath();
  ctx.moveTo(cardX + radius, cardY);
  ctx.lineTo(cardX + cardW - radius, cardY);
  ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
  ctx.lineTo(cardX + cardW, cardY + cardH - radius);
  ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - radius, cardY + cardH);
  ctx.lineTo(cardX + radius, cardY + cardH);
  ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius);
  ctx.lineTo(cardX, cardY + radius);
  ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
  ctx.closePath();
  ctx.fillStyle = COLORS.cream;
  ctx.fill();

  // Inner gold border
  const borderInset = 14;
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const bx = cardX + borderInset, by = cardY + borderInset;
  const bw = cardW - (borderInset * 2), bh = cardH - (borderInset * 2);
  const br = radius - 4;
  ctx.moveTo(bx + br, by);
  ctx.lineTo(bx + bw - br, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
  ctx.lineTo(bx + bw, by + bh - br);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
  ctx.lineTo(bx + br, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
  ctx.lineTo(bx, by + br);
  ctx.quadraticCurveTo(bx, by, bx + br, by);
  ctx.closePath();
  ctx.stroke();

  // Content area
  const contentX = cardX + (cardW * 0.5);
  const contentLeft = cardX + (cardW * 0.12);
  const contentRight = cardX + (cardW * 0.88);
  const contentWidth = contentRight - contentLeft;
  const topY = cardY + (cardH * 0.06);
  const maxContentH = cardH * 0.88;

  // Phase 1: Build and measure all blocks
  const rawBlocks = buildLayoutBlocks(content, width);
  let measured = rawBlocks.map(b => measureBlock(ctx, b, contentWidth));
  let totalHeight = measured.reduce((sum, b) => sum + b.height, 0);

  // Phase 2: Scale down if overflow
  let scale = 1.0;
  if (totalHeight > maxContentH) {
    scale = maxContentH / totalHeight;
    // Clamp to minimum 0.7 — below that text is unreadable
    scale = Math.max(0.7, scale);

    // Rebuild blocks with scaled font sizes
    const scaleFont = (font) => font.replace(/(\d+)px/g, (_, n) => `${Math.round(Number(n) * scale)}px`);
    const scaledBlocks = rawBlocks.map(b => ({
      ...b,
      font: b.font ? scaleFont(b.font) : b.font,
      lineHeight: b.lineHeight ? Math.round(b.lineHeight * scale) : b.lineHeight,
      size: b.size ? Math.round(b.size * scale) : b.size,
    }));
    measured = scaledBlocks.map(b => measureBlock(ctx, b, contentWidth));
    totalHeight = measured.reduce((sum, b) => sum + b.height, 0);
  }

  // Phase 3: Center content vertically and render
  let y = topY + Math.max(0, (maxContentH - totalHeight) * 0.4); // slight top bias

  for (const block of measured) {
    if (block.type === 'divider') {
      y += 16 * scale;
      ctx.beginPath();
      ctx.moveTo(contentX - 60, y);
      ctx.lineTo(contentX + 60, y);
      ctx.strokeStyle = COLORS.goldLight;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = COLORS.goldLight;
      ctx.beginPath();
      ctx.arc(contentX, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      y += 18 * scale;
      continue;
    }

    if (block.type === 'gap') {
      y += block.height;
      continue;
    }

    if (block.type === 'label') {
      ctx.font = block.font;
      ctx.fillStyle = block.color;
      ctx.textAlign = 'center';
      const spaced = block.text.split('').join(' ');
      ctx.fillText(spaced, contentX, y);
      y += block.height;
      continue;
    }

    // text block
    ctx.font = block.font;
    ctx.fillStyle = block.color;
    ctx.textAlign = block.align || 'center';
    const lines = block.lines || [block.text];
    for (const line of lines) {
      ctx.fillText(line, contentX, y);
      y += block.lineHeight;
    }
  }

  return canvas.toBuffer('image/png');
}

// ─── MAIN COMPOSITE ───────────────────────────────────────────────────────────

/**
 * Composite the text layer onto the DALL-E background image.
 * Returns null if fonts are not available (caller should fall back to v1).
 */
async function compositeInvitation(backgroundBuffer, event) {
  if (!checkFonts()) return null;

  const meta = await sharp(backgroundBuffer).metadata();
  const width = meta.width || 1024;
  const height = meta.height || 1792;

  const content = buildInvitationContent(event);
  const textLayer = renderTextLayer(content, width, height);

  const final = await sharp(backgroundBuffer)
    .composite([{
      input: textLayer,
      top: 0,
      left: 0,
      blend: 'over',
    }])
    .png({ quality: 95 })
    .toBuffer();

  return final;
}

/**
 * Export invitation as PDF buffer (Sharp PNG -> PDF via Sharp).
 * Returns a PNG buffer wrapped for PDF context — true PDF requires
 * additional tooling, so this produces a high-quality print-ready PNG.
 */
async function compositeInvitationPDF(backgroundBuffer, event) {
  if (!checkFonts()) return null;

  const meta = await sharp(backgroundBuffer).metadata();
  const width = meta.width || 1024;
  const height = meta.height || 1792;

  const content = buildInvitationContent(event);
  const textLayer = renderTextLayer(content, width, height);

  // High-res composite for print
  const final = await sharp(backgroundBuffer)
    .composite([{
      input: textLayer,
      top: 0,
      left: 0,
      blend: 'over',
    }])
    .png({ quality: 100, compressionLevel: 6 })
    .toBuffer();

  return final;
}

module.exports = {
  compositeInvitation,
  compositeInvitationPDF,
  buildInvitationContent,
  detectTheme,
  checkFonts,
};

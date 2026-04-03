'use strict';

/**
 * Invitation Compositing Service
 *
 * Takes a DALL-E generated background image and composites
 * real, legible invitation text on top using Canvas + Sharp.
 *
 * Fonts: Cormorant Garamond (headers/signature) + Libre Baskerville (body)
 * These must be present at FONT_DIR before this service runs.
 *
 * Font install (run once on EC2):
 *   node scripts/install-invitation-fonts.js
 *
 * Layout (top -> bottom):
 *   Tone line        "An Exclusive Invitation"
 *   LalaVerse        small brand mark
 *   Divider
 *   Event name       large, Cormorant Bold
 *   Subtitle         if name has " - " separator
 *   Divider
 *   Greeting         "Dearest Lala,"
 *   Body             what to expect (narrative_stakes -> description -> generated)
 *   Divider
 *   Details grid     Location / Dress Code / Investment / Guest Policy / Deliverable
 *   Divider
 *   Closing          "We look forward to your presence."
 *   Signature        Host name + brand
 */

const { createCanvas, registerFont, loadImage } = require('canvas');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// ─── FONT PATHS ───────────────────────────────────────────────────────────────
// Resolved from src/services/ -> src/assets/fonts/invitation/

const FONT_DIR = path.join(__dirname, '../assets/fonts/invitation');

function ensureFonts() {
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
    throw new Error(
      `Missing invitation fonts in ${FONT_DIR}:\n${missing.join('\n')}\n` +
      'Run: node scripts/install-invitation-fonts.js'
    );
  }

  registerFont(path.join(FONT_DIR, 'CormorantGaramond-Regular.ttf'), { family: 'CormorantGaramond', weight: 'normal', style: 'normal' });
  registerFont(path.join(FONT_DIR, 'CormorantGaramond-Bold.ttf'),    { family: 'CormorantGaramond', weight: 'bold',   style: 'normal' });
  registerFont(path.join(FONT_DIR, 'CormorantGaramond-Italic.ttf'),  { family: 'CormorantGaramond', weight: 'normal', style: 'italic' });
  registerFont(path.join(FONT_DIR, 'LibreBaskerville-Regular.ttf'),  { family: 'LibreBaskerville',  weight: 'normal', style: 'normal' });
  registerFont(path.join(FONT_DIR, 'LibreBaskerville-Italic.ttf'),   { family: 'LibreBaskerville',  weight: 'normal', style: 'italic' });
  registerFont(path.join(FONT_DIR, 'LibreBaskerville-Bold.ttf'),     { family: 'LibreBaskerville',  weight: 'bold',   style: 'normal' });
}

let fontsRegistered = false;
function initFonts() {
  if (!fontsRegistered) { ensureFonts(); fontsRegistered = true; }
}

// ─── COLORS ───────────────────────────────────────────────────────────────────

const COLORS = {
  gold:        '#B8962E',
  goldLight:   '#D4AF37',
  goldDark:    '#8B6914',
  ink:         '#2C1810',
  inkLight:    '#4A3728',
  cream:       'rgba(255,253,245,0.92)',
  divider:     'rgba(184,150,46,0.4)',
  labelColor:  '#8B6914',
};

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

  // Body text — what to expect
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

  // Investment
  let investment;
  if (event.is_free || event.cost_coins === 0 || event.is_paid === 'free') {
    investment = 'Complimentary';
  } else if (event.is_paid === 'yes' && event.payment_amount > 0) {
    investment = `Lala earns ${event.payment_amount} coins`;
  } else {
    investment = `${event.cost_coins || 100} coins per guest`;
  }

  // Guest policy
  let guestPolicy;
  const poolSize = event.browse_pool_size || 1;
  if (poolSize >= 2) {
    guestPolicy = 'Plus one welcome';
  } else if (event.browse_pool_bias === 'social' || event.browse_pool_bias === 'romantic') {
    guestPolicy = 'Plus one encouraged';
  } else {
    guestPolicy = 'Lala only';
  }

  // Deliverable — only for brand_deal / deliverable event types
  let deliverable = null;
  if (event.event_type === 'brand_deal' || event.event_type === 'deliverable') {
    deliverable = event.success_unlock
      ? event.success_unlock.split(',')[0].trim()
      : 'Content creation required upon arrival';
  }

  const hostName = event.host || 'The Host';
  const hostBrand = event.host_brand || '';

  return {
    eventName,
    eventSubtitle,
    bodyText,
    location: event.location_hint || null,
    dressCode: event.dress_code || null,
    investment,
    guestPolicy,
    deliverable,
    hostName,
    hostBrand,
    prestige: event.prestige || 5,
  };
}

// ─── CANVAS RENDERER ──────────────────────────────────────────────────────────

function renderTextLayer(content, width = 1024, height = 1792) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // ── Cream card overlay ─────────────────────────────────────────────────────
  const cardPadH = width * 0.12;
  const cardPadV = height * 0.08;
  const cardX = cardPadH;
  const cardY = cardPadV;
  const cardW = width - (cardPadH * 2);
  const cardH = height - (cardPadV * 2);
  const radius = 18;

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

  // ── Inner gold border ──────────────────────────────────────────────────────
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

  // ── Layout cursor ──────────────────────────────────────────────────────────
  const contentX = cardX + (cardW * 0.5);
  const contentLeft = cardX + (cardW * 0.12);
  const contentRight = cardX + (cardW * 0.88);
  const contentWidth = contentRight - contentLeft;
  let y = cardY + (cardH * 0.06);

  const lineGap = (n) => { y += n; };
  const drawDivider = () => {
    lineGap(16);
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
    lineGap(18);
  };

  const drawCentered = (text, font, color, lineHeight = 0) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, contentX, y);
    y += lineHeight || (parseInt(font) * 1.4);
  };

  const drawLabel = (label) => {
    const fontSize = Math.round(width * 0.014);
    ctx.font = `bold ${fontSize}px LibreBaskerville`;
    ctx.fillStyle = COLORS.labelColor;
    ctx.textAlign = 'center';
    // Simulate letter-spacing by inserting spaces (node-canvas has no letterSpacing)
    const spaced = label.split('').join(' ');
    ctx.fillText(spaced, contentX, y);
    y += Math.round(width * 0.022);
  };

  const drawBodyText = (text, fontSize, italic = false) => {
    ctx.font = `${italic ? 'italic ' : ''}${fontSize}px LibreBaskerville`;
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'center';
    const lines = wrapText(ctx, text, contentWidth);
    for (const line of lines) {
      ctx.fillText(line, contentX, y);
      y += fontSize * 1.65;
    }
  };

  // ── TONE LINE ──────────────────────────────────────────────────────────────
  drawCentered(
    'An Exclusive Invitation',
    `italic ${Math.round(width * 0.022)}px CormorantGaramond`,
    COLORS.goldDark,
    Math.round(width * 0.034)
  );

  // ── LALAVERSE MARK ────────────────────────────────────────────────────────
  drawCentered(
    'LalaVerse',
    `${Math.round(width * 0.018)}px LibreBaskerville`,
    COLORS.gold,
    Math.round(width * 0.03)
  );

  drawDivider();

  // ── EVENT NAME ─────────────────────────────────────────────────────────────
  const eventFontSize = Math.round(width * 0.058);
  ctx.font = `bold ${eventFontSize}px CormorantGaramond`;
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = 'center';
  const nameLines = wrapText(ctx, content.eventName.toUpperCase(), contentWidth);
  for (const line of nameLines) {
    ctx.fillText(line, contentX, y);
    y += eventFontSize * 1.2;
  }

  // ── SUBTITLE ───────────────────────────────────────────────────────────────
  if (content.eventSubtitle) {
    lineGap(4);
    drawCentered(
      content.eventSubtitle,
      `italic ${Math.round(width * 0.026)}px CormorantGaramond`,
      COLORS.inkLight,
      Math.round(width * 0.038)
    );
  }

  drawDivider();

  // ── GREETING ───────────────────────────────────────────────────────────────
  drawCentered(
    'Dearest Lala,',
    `italic ${Math.round(width * 0.028)}px CormorantGaramond`,
    COLORS.ink,
    Math.round(width * 0.042)
  );
  lineGap(8);

  // ── BODY TEXT ──────────────────────────────────────────────────────────────
  const bodyFontSize = Math.round(width * 0.022);
  drawBodyText(content.bodyText, bodyFontSize, true);

  drawDivider();

  // ── DETAILS ────────────────────────────────────────────────────────────────
  const detailValueSize = Math.round(width * 0.024);

  const drawDetail = (label, value) => {
    if (!value) return;
    drawLabel(label);
    ctx.font = `${detailValueSize}px LibreBaskerville`;
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'center';
    const vlines = wrapText(ctx, value, contentWidth);
    for (const vl of vlines) {
      ctx.fillText(vl, contentX, y);
      y += detailValueSize * 1.5;
    }
    lineGap(14);
  };

  drawDetail('LOCATION', content.location);
  drawDetail('DRESS CODE', content.dressCode);
  drawDetail('INVESTMENT', content.investment);
  drawDetail('GUEST POLICY', content.guestPolicy);
  if (content.deliverable) drawDetail('DELIVERABLE', content.deliverable);

  drawDivider();

  // ── CLOSING ────────────────────────────────────────────────────────────────
  drawCentered(
    'We look forward to your presence.',
    `italic ${Math.round(width * 0.022)}px LibreBaskerville`,
    COLORS.inkLight,
    Math.round(width * 0.036)
  );
  lineGap(16);

  // ── SIGNATURE ──────────────────────────────────────────────────────────────
  drawCentered(
    'Warmly,',
    `italic ${Math.round(width * 0.022)}px CormorantGaramond`,
    COLORS.inkLight,
    Math.round(width * 0.032)
  );
  drawCentered(
    content.hostName,
    `bold ${Math.round(width * 0.032)}px CormorantGaramond`,
    COLORS.ink,
    Math.round(width * 0.044)
  );
  if (content.hostBrand) {
    drawCentered(
      content.hostBrand,
      `${Math.round(width * 0.02)}px LibreBaskerville`,
      COLORS.gold,
      Math.round(width * 0.03)
    );
  }

  return canvas.toBuffer('image/png');
}

// ─── MAIN COMPOSITE ───────────────────────────────────────────────────────────

async function compositeInvitation(backgroundBuffer, event) {
  initFonts();

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

module.exports = { compositeInvitation, buildInvitationContent };

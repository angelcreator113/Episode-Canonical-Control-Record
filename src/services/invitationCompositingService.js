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
const https = require('https');
const Anthropic = require('@anthropic-ai/sdk');

// ─── FONT MANAGEMENT ──────────────────────────────────────────────────────────

const FONT_DIR = path.join(__dirname, '../assets/fonts/invitation');

const FONT_URLS = {
  'CormorantGaramond-Regular.ttf': 'https://github.com/google/fonts/raw/main/ofl/cormorantgaramond/CormorantGaramond-Regular.ttf',
  'CormorantGaramond-Bold.ttf':    'https://github.com/google/fonts/raw/main/ofl/cormorantgaramond/CormorantGaramond-Bold.ttf',
  'CormorantGaramond-Italic.ttf':  'https://github.com/google/fonts/raw/main/ofl/cormorantgaramond/CormorantGaramond-Italic.ttf',
  'LibreBaskerville-Regular.ttf':  'https://github.com/google/fonts/raw/main/ofl/librebaskerville/LibreBaskerville-Regular.ttf',
  'LibreBaskerville-Italic.ttf':   'https://github.com/google/fonts/raw/main/ofl/librebaskerville/LibreBaskerville-Italic.ttf',
  'LibreBaskerville-Bold.ttf':     'https://github.com/google/fonts/raw/main/ofl/librebaskerville/LibreBaskerville-Bold.ttf',
};

function downloadFont(url, dest) {
  return new Promise((resolve, reject) => {
    const get = (u, redirects = 0) => {
      if (redirects > 5) { reject(new Error('Too many redirects')); return; }
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          res.resume(); // drain the response
          return get(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', (err) => { file.close(); reject(err); });
      }).on('error', reject);
    };
    get(url);
  });
}

let fontsAvailable = false;
let fontsChecked = false;

async function autoInstallFonts() {
  if (!fs.existsSync(FONT_DIR)) {
    fs.mkdirSync(FONT_DIR, { recursive: true });
  }

  const missing = Object.keys(FONT_URLS).filter(f => {
    const p = path.join(FONT_DIR, f);
    return !fs.existsSync(p) || fs.statSync(p).size < 10000;
  });

  if (missing.length === 0) return true;

  console.log(`[InviteComposite] Auto-installing ${missing.length} fonts...`);
  for (const name of missing) {
    try {
      await downloadFont(FONT_URLS[name], path.join(FONT_DIR, name));
      console.log(`[InviteComposite]   Downloaded ${name}`);
    } catch (err) {
      console.error(`[InviteComposite]   Failed to download ${name}: ${err.message}`);
      return false;
    }
  }
  console.log('[InviteComposite] All fonts installed');
  return true;
}

// ─── FONT FAMILIES (resolved after init) ──────────────────────────────────────
// These get set to either the luxury fonts or system fallbacks
let HEADER_FONT = 'serif';
let BODY_FONT = 'serif';

function registerAllFonts() {
  try {
    registerFont(path.join(FONT_DIR, 'CormorantGaramond-Regular.ttf'), { family: 'CormorantGaramond', weight: 'normal', style: 'normal' });
    registerFont(path.join(FONT_DIR, 'CormorantGaramond-Bold.ttf'),    { family: 'CormorantGaramond', weight: 'bold',   style: 'normal' });
    registerFont(path.join(FONT_DIR, 'CormorantGaramond-Italic.ttf'),  { family: 'CormorantGaramond', weight: 'normal', style: 'italic' });
    registerFont(path.join(FONT_DIR, 'LibreBaskerville-Regular.ttf'),  { family: 'LibreBaskerville',  weight: 'normal', style: 'normal' });
    registerFont(path.join(FONT_DIR, 'LibreBaskerville-Italic.ttf'),   { family: 'LibreBaskerville',  weight: 'normal', style: 'italic' });
    registerFont(path.join(FONT_DIR, 'LibreBaskerville-Bold.ttf'),     { family: 'LibreBaskerville',  weight: 'bold',   style: 'normal' });
    HEADER_FONT = 'CormorantGaramond';
    BODY_FONT = 'LibreBaskerville';
    console.log('[InviteComposite] Custom fonts registered (Cormorant Garamond + Libre Baskerville)');
    return true;
  } catch (err) {
    console.warn('[InviteComposite] Custom font registration failed:', err.message);
    return false;
  }
}

function registerSystemFallback() {
  // Try common system serif fonts available on Linux
  const systemFonts = [
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf',
  ];

  const available = systemFonts.filter(f => fs.existsSync(f));
  if (available.length > 0) {
    try {
      if (fs.existsSync(systemFonts[0])) registerFont(systemFonts[0], { family: 'InvitationSerif', weight: 'normal', style: 'normal' });
      if (fs.existsSync(systemFonts[1])) registerFont(systemFonts[1], { family: 'InvitationSerif', weight: 'bold',   style: 'normal' });
      if (fs.existsSync(systemFonts[2])) registerFont(systemFonts[2], { family: 'InvitationSerif', weight: 'normal', style: 'italic' });
      if (fs.existsSync(systemFonts[3])) registerFont(systemFonts[3], { family: 'InvitationSerif', weight: 'bold',   style: 'italic' });
      HEADER_FONT = 'InvitationSerif';
      BODY_FONT = 'InvitationSerif';
      console.log('[InviteComposite] System fallback fonts registered (Liberation Serif)');
      return true;
    } catch (err) {
      console.warn('[InviteComposite] System font registration failed:', err.message);
    }
  }

  // Last resort — use Canvas built-in serif
  HEADER_FONT = 'serif';
  BODY_FONT = 'serif';
  console.log('[InviteComposite] Using Canvas built-in serif (no custom fonts available)');
  return true;
}

async function checkFonts() {
  if (fontsChecked) return fontsAvailable;
  fontsChecked = true;

  // Try auto-install custom fonts
  const installed = await autoInstallFonts();
  if (installed && registerAllFonts()) {
    fontsAvailable = true;
    return true;
  }

  // Fall back to system fonts — always succeed
  console.warn('[InviteComposite] Custom fonts unavailable — falling back to system fonts');
  registerSystemFallback();
  fontsAvailable = true;
  return true;
}

// ─── COLORS ───────────────────────────────────────────────────────────────────

const _COLORS = {
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

// ─── CONTENT BUILDER (Claude-powered prose) ──────────────────────────────────

async function buildInvitationContent(event) {
  const nameParts = (event.name || 'Event').split(' — ');
  const eventName = nameParts[0].trim();
  const eventSubtitle = nameParts[1]?.trim() || null;

  // Context for Claude
  const poolSize = event.browse_pool_size || 1;
  const allowsGuest = poolSize >= 2 ||
    event.browse_pool_bias === 'social' ||
    event.browse_pool_bias === 'romantic';

  let investmentText;
  if (event.is_free || event.cost_coins === 0 || event.is_paid === 'free') {
    investmentText = 'complimentary — no cost to attend';
  } else if (event.is_paid === 'yes' && event.payment_amount > 0) {
    investmentText = `Lala will earn ${event.payment_amount} coins for attending`;
  } else {
    investmentText = `${event.cost_coins || 100} coins per guest`;
  }

  const hasDeliverable = event.event_type === 'brand_deal' || event.event_type === 'deliverable';
  const deliverableText = hasDeliverable
    ? (event.success_unlock?.split(',')[0]?.trim() || 'content creation required')
    : null;

  // Claude writes the invitation prose
  // Pull automation data if available (from auto-spawn)
  const automation = event.canon_consequences?.automation || {};
  const hostHandle = automation.host_handle || '';
  const hostDisplayName = automation.host_display_name || event.host || 'The Host';
  const venueName = event.venue_name || automation.venue_name || '';
  const venueAddress = event.venue_address || automation.venue_address || event.location_hint || 'an exclusive venue';
  const eventDate = event.event_date || '';
  const eventTime = event.event_time || '';
  const guestProfiles = automation.guest_profiles || [];
  const guestNames = guestProfiles.slice(0, 3).map(g => g.display_name || g.handle).join(', ');

  const prompt = `You are writing a luxury invitation letter for a fashion life simulator show.

The invitation will be printed on a beautiful card and shown on screen. It must read like a real, elegant letter written by a person — not a form, not a template, not labeled fields.

EVENT DETAILS:
Name: ${event.name}
Host: ${hostDisplayName}${hostHandle ? ` (${hostHandle})` : ''}
Brand: ${event.host_brand || ''}
Venue: ${venueName || 'an exclusive venue'}
Address: ${venueAddress}
Date: ${eventDate || 'TBD'}
Time: ${eventTime || 'Evening'}
Dress Code: ${event.dress_code || 'elegant'}
Style Keywords: ${(event.dress_code_keywords || []).join(', ')}
Investment: ${investmentText}
Guest: ${allowsGuest ? 'Plus one is welcome' : 'Lala only — no guests'}
${deliverableText ? `Deliverable: ${deliverableText}` : ''}
Notable Guests: ${guestNames || 'select attendees'}
Atmosphere/Description: ${event.description || event.narrative_stakes || ''}
Prestige Level: ${event.prestige || 5}/10
Mood: ${event.mood || 'aspirational'}

Write the invitation as FOUR parts. Return ONLY these parts, nothing else:

PART 1 — OPENING (1-2 sentences, 20-35 words):
A beautiful, evocative opening that sets the scene and makes Lala feel chosen and special. No "You are cordially invited" cliché. Make it feel personal and specific to this event's atmosphere.

PART 2 — BODY (3-5 sentences, 50-80 words):
Written as flowing prose — weave in the venue name and address, the date and time, what to expect, the dress code, the investment, and the guest policy as natural sentences. Do NOT use labels or bullet points. It should read like a person wrote it. Mention the cost naturally. If a guest is allowed, mention it warmly. If there's a deliverable, hint at it elegantly. If notable guests are attending, mention 1-2 names casually.

PART 3 — SOCIAL CTA (1 sentence, under 20 words):
A social media call-to-action: what hashtag to use, tagging the host, sharing expectations. Keep it stylish.

PART 4 — CLOSING LINE (1 sentence, under 15 words):
An elegant closing that feels warm and anticipatory.

FORMAT YOUR RESPONSE EXACTLY LIKE THIS (include the labels so I can parse):
OPENING: [your opening text]
BODY: [your body text]
SOCIAL: [your social CTA]
CLOSING: [your closing line]`;

  let opening = '';
  let body = '';
  let closing = 'We look forward to your presence.';

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0]?.text || '';

    const openingMatch = text.match(/OPENING:\s*(.+?)(?=BODY:|$)/s);
    const bodyMatch    = text.match(/BODY:\s*(.+?)(?=SOCIAL:|CLOSING:|$)/s);
    const socialMatch  = text.match(/SOCIAL:\s*(.+?)(?=CLOSING:|$)/s);
    const closingMatch = text.match(/CLOSING:\s*(.+?)$/s);

    opening = openingMatch?.[1]?.trim() || '';
    body    = bodyMatch?.[1]?.trim()    || '';
    const socialCta = socialMatch?.[1]?.trim() || '';
    if (socialCta) body = body + '\n\n' + socialCta;
    closing = closingMatch?.[1]?.trim() || closing;

    console.log(`[InviteComposite] Claude wrote invitation prose for: ${event.name}`);
  } catch (err) {
    console.warn(`[InviteComposite] Claude call failed, using fallback prose: ${err.message}`);

    opening = 'You have been chosen.';
    body = [
      event.description || event.narrative_stakes ||
        `Join us ${event.location_hint ? `at ${event.location_hint}` : 'for an exclusive gathering'}.`,
      event.dress_code ? `Please come dressed in ${event.dress_code}.` : '',
      investmentText !== 'complimentary — no cost to attend'
        ? `Your investment is ${investmentText}.`
        : 'This gathering is complimentary.',
      allowsGuest ? 'You are welcome to bring a guest.' : '',
    ].filter(Boolean).join(' ');
    closing = 'We look forward to your presence.';
  }

  return {
    eventName,
    eventSubtitle,
    opening,
    body,
    closing,
    hostName: event.host || 'The Host',
    hostBrand: event.host_brand || '',
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
  ctx.fillStyle = 'rgba(255,253,245,0.93)';
  ctx.fill();

  // Inner gold border
  const bi = 14;
  ctx.strokeStyle = 'rgba(212,175,55,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const bx = cardX + bi, by = cardY + bi;
  const bw = cardW - (bi * 2), bh = cardH - (bi * 2);
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

  // ── Layout helpers ─────────────────────────────────────────────────────────
  const cx = cardX + cardW * 0.5;
  const contentW = cardW * 0.76;
  let y = cardY + cardH * 0.055;

  const gap = (n) => { y += n; };

  const drawDivider = () => {
    gap(14);
    ctx.beginPath();
    ctx.moveTo(cx - 50, y);
    ctx.lineTo(cx + 50, y);
    ctx.strokeStyle = 'rgba(212,175,55,0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = '#D4AF37';
    ctx.beginPath();
    ctx.arc(cx, y, 2, 0, Math.PI * 2);
    ctx.fill();
    gap(18);
  };

  const centered = (text, font, color, lh) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    const lines = wrapText(ctx, text, contentW);
    for (const line of lines) {
      ctx.fillText(line, cx, y);
      y += lh || (parseInt(font) * 1.5);
    }
  };

  const centeredItalic = (text, size, color, lh) =>
    centered(text, `italic ${size}px ${HEADER_FONT}`, color, lh || size * 1.5);

  const centeredBold = (text, size, color, lh) =>
    centered(text, `bold ${size}px ${HEADER_FONT}`, color, lh || size * 1.3);

  const bodyText = (text, size, italic = false) => {
    ctx.font = `${italic ? 'italic ' : ''}${size}px ${BODY_FONT}`;
    ctx.fillStyle = '#2C1810';
    ctx.textAlign = 'center';
    const lines = wrapText(ctx, text, contentW);
    for (const line of lines) {
      ctx.fillText(line, cx, y);
      y += size * 1.7;
    }
  };

  const S = {
    tone:      Math.round(width * 0.021),
    eventName: Math.round(width * 0.056),
    subtitle:  Math.round(width * 0.025),
    greeting:  Math.round(width * 0.026),
    opening:   Math.round(width * 0.021),
    bodySize:  Math.round(width * 0.020),
    closing:   Math.round(width * 0.020),
    warmly:    Math.round(width * 0.021),
    hostName:  Math.round(width * 0.030),
    hostBrand: Math.round(width * 0.019),
  };

  // ── TONE LINE ──────────────────────────────────────────────────────────────
  centeredItalic('An Exclusive Invitation', S.tone, '#8B6914', S.tone * 1.6);

  drawDivider();

  // ── EVENT NAME ─────────────────────────────────────────────────────────────
  centeredBold(content.eventName.toUpperCase(), S.eventName, '#2C1810', S.eventName * 1.15);

  if (content.eventSubtitle) {
    gap(6);
    centeredItalic(content.eventSubtitle, S.subtitle, '#4A3728', S.subtitle * 1.5);
  }

  drawDivider();

  // ── GREETING ───────────────────────────────────────────────────────────────
  centeredItalic('Dearest Lala,', S.greeting, '#2C1810', S.greeting * 1.6);
  gap(10);

  // ── OPENING (Claude's opening line) ────────────────────────────────────────
  if (content.opening) {
    centeredItalic(content.opening, S.opening, '#4A3728', S.opening * 1.7);
    gap(10);
  }

  // ── BODY (Claude's prose) ─────────────────────────────────────────────────
  if (content.body) {
    bodyText(content.body, S.bodySize, false);
  }

  drawDivider();

  // ── CLOSING ────────────────────────────────────────────────────────────────
  centeredItalic(content.closing, S.closing, '#4A3728', S.closing * 1.6);
  gap(18);

  // ── SIGNATURE ──────────────────────────────────────────────────────────────
  centeredItalic('Warmly,', S.warmly, '#4A3728', S.warmly * 1.5);
  gap(4);
  centeredBold(content.hostName, S.hostName, '#2C1810', S.hostName * 1.3);
  if (content.hostBrand) {
    gap(4);
    centered(content.hostBrand, `${S.hostBrand}px ${BODY_FONT}`, '#B8962E', S.hostBrand * 1.5);
  }

  return canvas.toBuffer('image/png');
}

// ─── MAIN COMPOSITE ───────────────────────────────────────────────────────────

/**
 * Composite the text layer onto the DALL-E background image.
 * Returns null if fonts are not available (caller should fall back to v1).
 */
async function compositeInvitation(backgroundBuffer, event, customContent = null) {
  if (!(await checkFonts())) return null;

  const meta = await sharp(backgroundBuffer).metadata();
  const width = meta.width || 1024;
  const height = meta.height || 1792;

  const content = customContent || await buildInvitationContent(event);
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
  if (!(await checkFonts())) return null;

  const meta = await sharp(backgroundBuffer).metadata();
  const width = meta.width || 1024;
  const height = meta.height || 1792;

  const content = await buildInvitationContent(event);
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

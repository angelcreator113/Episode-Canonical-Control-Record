/**
 * The style sheet drawn on the server (Task #2877; the S1 read's §3
 * recommendation, alongside the title overlay renderer). It draws the same
 * layout as the browser's StyleSheetTemplate (docs/design/2026-10-landing-
 * and-stylesheet.md Part 2, "Style sheet template") from the same sheet
 * object buildStyleSheet returns, with registered fonts, so every export is
 * deterministic and no browser or CORS is involved.
 *
 * One render at 2x (2048 x 3072); every export size is taken from it
 * without composing text again:
 *   sheet  1024 x 1536 PNG
 *   pin    1000 x 1500 PNG (Pinterest)
 *   story  1080 x 1920 PNG (Instagram story: the sheet, padded top and bottom)
 *   post   1080 x 1350 PNG (Instagram post: the top of the sheet, cropped)
 *   look   "The look only": the FRONT, SIDE, BACK strip, PNG
 *   pdf    one-page print PDF, 8 x 12 in
 *
 * Every value is the sheet's own (real data only): an empty one is left
 * quiet, as the template leaves it. Fonts: Cormorant Garamond, DM Sans,
 * Great Vibes (OFL; src/assets/fonts).
 */
const path = require('path');

const W = 1024;
const H = 1536;
const RENDER_SCALE = 2;

const C = {
  blush: '#E9C4D5', lilac: '#D9CBEB', ivory: '#FAF6F1', gold: '#B8962E', champagne: '#D6B77C',
  pink: '#C2668F', plum: '#30253D', white: '#FFFFFF',
  photoBg: 'rgba(250, 246, 241, 0.6)', panelBg: 'rgba(250, 246, 241, 0.75)', faint: 'rgba(48, 37, 61, 0.45)',
};
const SERIF = '"Cormorant Garamond"';
const SANS = '"DM Sans"';
const SCRIPT = '"Great Vibes"';

// The template's own measurements (StyleSheetTemplate.css), in sheet pixels.
const PAD_TOP = 32;
const PAD_X = 25;
const TOP = { y: PAD_TOP, h: 704 };
const COL = { left: { x: 25, w: 290 }, centre: { x: 340, w: 344 }, right: { x: 709, w: 290 } };
const WARDROBE = { y: TOP.y + TOP.h + 18, h: 290 };
const BOTTOM = { y: WARDROBE.y + WARDROBE.h + 18, h: 330 };
const FOOTER = { y: H - 140, h: 140 };
const PILL_H = 25;
const LOGO_H = 218; // the lettered title (or a logo image) and its margin

// Where "The look only" strip sits on the sheet: the THE LOOK grid and its captions.
const LOOK_STRIP = { x: COL.left.x - 6, y: TOP.y + LOGO_H + 12 + PILL_H + 12 - 6, w: COL.left.w + 12, h: 0 };
LOOK_STRIP.h = TOP.y + TOP.h - LOOK_STRIP.y + 6;

const EXPORTS = Object.freeze({
  sheet: { width: 1024, height: 1536, type: 'image/png', ext: 'png', label: 'Style sheet' },
  pin: { width: 1000, height: 1500, type: 'image/png', ext: 'png', label: 'Pinterest pin' },
  story: { width: 1080, height: 1920, type: 'image/png', ext: 'png', label: 'Instagram story' },
  post: { width: 1080, height: 1350, type: 'image/png', ext: 'png', label: 'Instagram post' },
  look: { width: Math.round(LOOK_STRIP.w * RENDER_SCALE), height: Math.round(LOOK_STRIP.h * RENDER_SCALE), type: 'image/png', ext: 'png', label: 'The look only' },
  pdf: { width: 576, height: 864, type: 'application/pdf', ext: 'pdf', label: 'Print PDF' },
});

let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  const { registerFont } = require('canvas');
  const fonts = path.join(__dirname, '..', 'assets', 'fonts');
  registerFont(path.join(fonts, 'invitation', 'CormorantGaramond-Regular.ttf'), { family: 'Cormorant Garamond' });
  registerFont(path.join(fonts, 'invitation', 'CormorantGaramond-Bold.ttf'), { family: 'Cormorant Garamond', weight: 'bold' });
  registerFont(path.join(fonts, 'invitation', 'CormorantGaramond-Italic.ttf'), { family: 'Cormorant Garamond', style: 'italic' });
  registerFont(path.join(fonts, 'stylesheet', 'DMSans-Regular.ttf'), { family: 'DM Sans' });
  registerFont(path.join(fonts, 'stylesheet', 'DMSans-Medium.ttf'), { family: 'DM Sans', weight: '500' });
  registerFont(path.join(fonts, 'stylesheet', 'DMSans-Bold.ttf'), { family: 'DM Sans', weight: 'bold' });
  registerFont(path.join(fonts, 'stylesheet', 'GreatVibes-Regular.ttf'), { family: 'Great Vibes' });
  fontsReady = true;
}

async function loadImage(src) {
  if (!src) return null;
  try {
    const { loadImage: load } = require('canvas');
    return await load(String(src).startsWith('data:') ? Buffer.from(String(src).split(',')[1], 'base64') : src);
  } catch (err) {
    console.error('[StyleSheetRender] an image could not be drawn:', String(src).slice(0, 60), err.message);
    return null;
  }
}

// ── Drawing helpers ──

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw an image to fill (cover) or fit (contain) a box, clipped to it. */
function drawImageIn(ctx, img, x, y, w, h, { fit = 'cover', radius = 0, zoom = 1 } = {}) {
  if (!img) return;
  const ir = img.width / img.height;
  const br = w / h;
  let dw;
  let dh;
  if ((fit === 'cover') === (ir > br)) { dh = h * zoom; dw = dh * ir; } else { dw = w * zoom; dh = dw / ir; }
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

/** Text with CSS letter-spacing (em), drawn left, centre or right of x. */
function spacedText(ctx, text, x, y, spacingEm, align = 'left') {
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(ctx.font)[1]);
  const gap = size * spacingEm;
  const chars = [...String(text)];
  const width = chars.reduce((s, ch) => s + ctx.measureText(ch).width, 0) + gap * Math.max(0, chars.length - 1);
  let cx = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of chars) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + gap; }
  ctx.textAlign = prev;
  return width;
}

/** Word-wrapped lines that fit a width (at most maxLines; the last is cut with an ellipsis). */
function wrap(ctx, text, width, maxLines = 3) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

function frame(ctx, x, y, w, h, { dashed = false, fill = C.photoBg, radius = 10 } = {}) {
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.champagne;
  ctx.setLineDash(dashed ? [6, 4] : []);
  ctx.stroke();
  ctx.setLineDash([]);
}

function pill(ctx, text, x, y, align = 'left') {
  ctx.font = `bold 12px ${SANS}`;
  const chars = [...text];
  const textW = chars.reduce((s, ch) => s + ctx.measureText(ch).width, 0) + 12 * 0.16 * (chars.length - 1);
  const w = textW + 28;
  const left = align === 'center' ? x - w / 2 : x;
  roundRect(ctx, left, y, w, PILL_H, PILL_H / 2);
  ctx.fillStyle = C.ivory;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = C.champagne;
  ctx.stroke();
  ctx.fillStyle = C.plum;
  ctx.textBaseline = 'middle';
  spacedText(ctx, text, left + 14, y + PILL_H / 2 + 0.5, 0.16);
  ctx.textBaseline = 'alphabetic';
}

function photo(ctx, img, x, y, w, h, { framed = true, fit = 'cover', inset = 0, dashed = false, fill } = {}) {
  if (framed) frame(ctx, x, y, w, h, { dashed, fill: fill || C.photoBg });
  else { ctx.fillStyle = fill || C.photoBg; ctx.fillRect(x, y, w, h); }
  if (img) drawImageIn(ctx, img, x + inset + (framed ? 2 : 0), y + inset + (framed ? 2 : 0), w - 2 * inset - (framed ? 4 : 0), h - 2 * inset - (framed ? 4 : 0), { fit, radius: framed ? 8 : 0 });
}

function caption(ctx, text, cx, y, { size = 11, color = C.plum, spacing = 0.14 } = {}) {
  ctx.font = `bold ${size}px ${SANS}`;
  ctx.fillStyle = color;
  spacedText(ctx, text, cx, y, spacing, 'center');
}

// ── The sheet ──

async function drawSheet(ctx, sheet, palette) {
  const ev = sheet.event || {};
  const venue = sheet.venue || {};
  const images = {};
  const want = {
    logo: sheet.logo, front: sheet.look?.front, side: sheet.look?.side, back: sheet.look?.back, hero: sheet.look?.hero,
    venue: venue.image, eyes: sheet.beauty?.eyes, lips: sheet.beauty?.lips, skin: sheet.beauty?.skin, nails: sheet.beauty?.nails,
    inspo0: sheet.inspo?.photos?.[0]?.image, inspo1: sheet.inspo?.photos?.[1]?.image,
    tex0: sheet.inspo?.textures?.[0]?.image, tex1: sheet.inspo?.textures?.[1]?.image,
  };
  (sheet.wardrobe?.columns || []).forEach((c) => { want[`col_${c.key}`] = c.image; });
  await Promise.all(Object.entries(want).map(async ([k, src]) => { images[k] = await loadImage(src); }));

  // Background: blush to lilac to ivory.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, C.blush);
  bg.addColorStop(0.45, C.lilac);
  bg.addColorStop(1, C.ivory);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Top left: the show's logo, or the lettered title; THE LOOK ──
  const L = COL.left;
  if (images.logo) {
    drawImageIn(ctx, images.logo, L.x, TOP.y, L.w, 206, { fit: 'contain' });
  } else {
    ctx.textBaseline = 'alphabetic';
    ctx.font = `bold 52px ${SERIF}`;
    ctx.fillStyle = C.gold;
    ctx.fillText('Styling', L.x, TOP.y + 48);
    ctx.font = `54px ${SCRIPT}`;
    ctx.fillStyle = C.pink;
    ctx.fillText('Adventures', L.x + 18, TOP.y + 114);
    ctx.font = `italic 20px ${SERIF}`;
    ctx.fillStyle = C.plum;
    ctx.fillText('with', L.x + 4, TOP.y + 146);
    ctx.font = `bold 46px ${SERIF}`;
    spacedText(ctx, 'LALA', L.x, TOP.y + 196, 0.24);
  }
  const pillY = TOP.y + LOGO_H + 12;
  pill(ctx, 'THE LOOK', L.x, pillY);
  const lookY = pillY + PILL_H + 12;
  const lookH = TOP.y + TOP.h - lookY;
  const lookW = (L.w - 16) / 3;
  ['front', 'side', 'back'].forEach((k, i) => {
    const x = L.x + i * (lookW + 8);
    const ph = lookH - 6 - 14;
    photo(ctx, images[k], x, lookY, lookW, ph);
    if (!images[k]) { ctx.font = `italic 15px ${SERIF}`; ctx.fillStyle = C.faint; ctx.textAlign = 'center'; ctx.fillText(k[0].toUpperCase() + k.slice(1), x + lookW / 2, lookY + ph / 2); ctx.textAlign = 'left'; }
    caption(ctx, k.toUpperCase(), x + lookW / 2, lookY + ph + 6 + 11);
  });

  // ── Centre: the hero, in a white frame tilted -2.5° ──
  const Cc = COL.centre;
  const heroH = 620;
  const heroY = TOP.y + (TOP.h - heroH) / 2;
  ctx.save();
  ctx.translate(Cc.x + Cc.w / 2, heroY + heroH / 2);
  ctx.rotate((-2.5 * Math.PI) / 180);
  ctx.shadowColor = 'rgba(48, 37, 61, 0.22)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = C.white;
  ctx.fillRect(-Cc.w / 2, -heroH / 2, Cc.w, heroH);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = C.photoBg;
  ctx.fillRect(-Cc.w / 2 + 14, -heroH / 2 + 14, Cc.w - 28, heroH - 54);
  if (images.hero) drawImageIn(ctx, images.hero, -Cc.w / 2 + 14, -heroH / 2 + 14, Cc.w - 28, heroH - 54);
  else { ctx.font = `italic 15px ${SERIF}`; ctx.fillStyle = C.faint; ctx.textAlign = 'center'; ctx.fillText('Hero', 0, 0); ctx.textAlign = 'left'; }
  ctx.restore();

  // ── Top right: episode, event, city chip, venue, event details ──
  const R = COL.right;
  let y = TOP.y;
  if (sheet.episode?.label) {
    ctx.font = `bold 14px ${SANS}`;
    ctx.fillStyle = C.gold;
    spacedText(ctx, sheet.episode.label, R.x, y + 12, 0.3);
    y += 14 + 12;
  }
  ctx.font = `bold 32px ${SERIF}`;
  ctx.fillStyle = C.plum;
  for (const line of wrap(ctx, ev.name || 'Event to come', R.w, 3)) { ctx.fillText(line, R.x, y + 29); y += 38.4; }
  y += 12;
  if (venue.chip) {
    ctx.font = `bold 12px ${SANS}`;
    const chipText = String(venue.chip);
    const tw = [...chipText].reduce((s, ch) => s + ctx.measureText(ch).width, 0) + 12 * 0.08 * (chipText.length - 1);
    roundRect(ctx, R.x, y, tw + 24, 23, 11.5);
    ctx.fillStyle = C.plum;
    ctx.fill();
    ctx.fillStyle = C.ivory;
    ctx.textBaseline = 'middle';
    spacedText(ctx, chipText, R.x + 12, y + 12, 0.08);
    ctx.textBaseline = 'alphabetic';
    y += 23 + 12;
  }
  photo(ctx, images.venue, R.x, y, R.w, 180);
  if (!images.venue) { ctx.font = `italic 15px ${SERIF}`; ctx.fillStyle = C.faint; ctx.textAlign = 'center'; ctx.fillText('Venue', R.x + R.w / 2, y + 95); ctx.textAlign = 'left'; }
  y += 180 + 6;
  caption(ctx, `THE VENUE${venue.name ? ` · ${venue.name}` : ''}`, R.x + R.w / 2, y + 11, { size: 11 });
  y += 14 + 12;
  pill(ctx, 'EVENT DETAILS', R.x, y);
  y += PILL_H + 12;
  for (const [label, value] of [['HOST', ev.host], ['TYPE', ev.type], ['DRESS CODE', ev.dress_code], ['WHEN', ev.when], ['VIBE', ev.vibe]]) {
    ctx.font = `bold 11px ${SANS}`;
    ctx.fillStyle = C.gold;
    spacedText(ctx, label, R.x, y + 14, 0.14);
    ctx.font = `500 17px ${SERIF}`;
    ctx.fillStyle = C.plum;
    const lines = wrap(ctx, value || '—', R.w - 100, 3);
    lines.forEach((ln, i) => ctx.fillText(ln, R.x + 100, y + 15 + i * 21.25));
    y += Math.max(1, lines.length) * 21.25 + 7;
  }

  // ── WARDROBE BREAKDOWN ──
  pill(ctx, 'WARDROBE BREAKDOWN', W / 2, WARDROBE.y, 'center');
  const cols = sheet.wardrobe?.columns || [];
  const colY = WARDROBE.y + PILL_H + 10;
  const colW = (W - 2 * PAD_X - 60) / 7;
  cols.slice(0, 7).forEach((c, i) => {
    const x = PAD_X + i * (colW + 10);
    ctx.font = `bold 12px ${SANS}`;
    ctx.fillStyle = C.plum;
    spacedText(ctx, c.label, x + colW / 2, colY + 11, 0.16, 'center');
    const ph = WARDROBE.y + WARDROBE.h - colY - 12 - 6 - 6 - 28;
    photo(ctx, images[`col_${c.key}`], x, colY + 18, colW, ph, { fit: 'contain', inset: 6, dashed: c.needed, fill: C.white });
    const nameY = colY + 18 + ph + 6;
    ctx.textAlign = 'center';
    if (c.needed) {
      ctx.font = `italic 15px ${SERIF}`;
      ctx.fillStyle = C.pink;
      ctx.fillText('Needed', x + colW / 2, colY + 18 + ph / 2);
      ctx.font = `italic bold 11px ${SANS}`;
      ctx.fillText('Needed', x + colW / 2, nameY + 11);
    } else if (c.name) {
      ctx.font = `bold 10px ${SANS}`;
      ctx.fillStyle = C.plum;
      wrap(ctx, String(c.name).toUpperCase(), colW, 2).forEach((ln, j) => ctx.fillText(ln, x + colW / 2, nameY + 11 + j * 13.75));
    }
    ctx.textAlign = 'left';
  });

  // ── Bottom: COLOR PALETTE · BEAUTY DETAILS · KEY INSPO ──
  const panelW = (W - 2 * PAD_X - 32) / 3;
  const panels = [0, 1, 2].map((i) => ({ x: PAD_X + i * (panelW + 16), y: BOTTOM.y, w: panelW, h: BOTTOM.h }));
  for (const p of panels) frame(ctx, p.x, p.y, p.w, p.h, { fill: C.panelBg, radius: 14 });

  // Palette
  {
    const p = panels[0];
    pill(ctx, 'COLOR PALETTE', p.x + p.w / 2, p.y + 14, 'center');
    const sw = (p.w - 28 - 32) / 5;
    const sy = p.y + 14 + PILL_H + 10;
    const colours = (palette || sheet.palette || []).slice(0, 5);
    for (let i = 0; i < 5; i++) {
      const cx = p.x + 14 + i * (sw + 8) + sw / 2;
      ctx.beginPath();
      ctx.arc(cx, sy + sw / 2, sw / 2 - 1.5, 0, Math.PI * 2);
      if (colours[i]?.hex) { ctx.fillStyle = colours[i].hex; ctx.fill(); }
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.champagne;
      ctx.setLineDash(colours[i]?.hex ? [] : [5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    let my = sy + sw + 10;
    ctx.font = `44px ${SCRIPT}`;
    ctx.fillStyle = C.pink;
    ctx.textAlign = 'center';
    ctx.fillText('Mood', p.x + p.w / 2, my + 44);
    my += 57 + 10;
    ctx.font = `italic 17px ${SERIF}`;
    ctx.fillStyle = C.plum;
    wrap(ctx, (sheet.mood_words || []).join(' · '), p.w - 28, 3).forEach((ln, j) => ctx.fillText(ln, p.x + p.w / 2, my + 15 + j * 23));
    ctx.textAlign = 'left';
  }

  // Beauty
  {
    const p = panels[1];
    pill(ctx, 'BEAUTY DETAILS', p.x + p.w / 2, p.y + 14, 'center');
    const gy = p.y + 14 + PILL_H + 10;
    const gh = p.y + p.h - 14 - gy;
    const cw = (p.w - 28 - 8) / 2;
    const ch = (gh - 8) / 2;
    [['eyes', 'EYES'], ['lips', 'LIPS'], ['skin', 'SKIN'], ['nails', 'NAILS']].forEach(([k, label], i) => {
      const x = p.x + 14 + (i % 2) * (cw + 8);
      const yy = gy + Math.floor(i / 2) * (ch + 8);
      const phh = ch - 4 - 13;
      photo(ctx, images[k], x, yy, cw, phh);
      if (!images[k]) { ctx.font = `italic 15px ${SERIF}`; ctx.fillStyle = C.faint; ctx.textAlign = 'center'; ctx.fillText(label[0] + label.slice(1).toLowerCase(), x + cw / 2, yy + phh / 2 + 5); ctx.textAlign = 'left'; }
      caption(ctx, k === 'nails' && sheet.nails_name ? `${label} · ${sheet.nails_name}` : label, x + cw / 2, yy + phh + 4 + 11);
    });
  }

  // Key inspo: two photos, two textures cut from the pieces
  {
    const p = panels[2];
    pill(ctx, 'KEY INSPO', p.x + p.w / 2, p.y + 14, 'center');
    const gy = p.y + 14 + PILL_H + 10;
    const gh = p.y + p.h - 14 - gy;
    const cw = (p.w - 28 - 8) / 2;
    const ch = (gh - 8) / 2;
    [['inspo0', 'Inspo'], ['inspo1', 'Inspo'], ['tex0', 'Texture'], ['tex1', 'Texture']].forEach(([k, label], i) => {
      const x = p.x + 14 + (i % 2) * (cw + 8);
      const yy = gy + Math.floor(i / 2) * (ch + 8);
      frame(ctx, x, yy, cw, ch);
      if (images[k]) drawImageIn(ctx, images[k], x + 2, yy + 2, cw - 4, ch - 4, { radius: 8, zoom: k.startsWith('tex') ? 3.2 : 1 });
      else { ctx.font = `italic 15px ${SERIF}`; ctx.fillStyle = C.faint; ctx.textAlign = 'center'; ctx.fillText(label, x + cw / 2, yy + ch / 2 + 5); ctx.textAlign = 'left'; }
    });
  }

  // ── Footer: the skyline, the tagline, the strapline ──
  ctx.fillStyle = C.plum;
  ctx.fillRect(0, FOOTER.y, W, FOOTER.h);
  ctx.save();
  const pts = [[0, 60], [6, 30], [12, 55], [20, 10], [27, 50], [35, 25], [44, 60], [52, 5], [60, 45], [68, 20], [76, 55], [84, 15], [92, 50], [100, 30]];
  ctx.beginPath();
  ctx.moveTo(0, FOOTER.y + 46);
  for (const [px, py] of pts) ctx.lineTo((px / 100) * W, FOOTER.y + (py / 100) * 46);
  ctx.lineTo(W, FOOTER.y + 46);
  ctx.closePath();
  ctx.clip();
  for (let x = 0; x < W; x += 84) {
    ctx.fillStyle = 'rgba(217, 203, 235, 0.45)';
    ctx.fillRect(x, FOOTER.y, 38, 46);
    ctx.fillStyle = 'rgba(217, 203, 235, 0.25)';
    ctx.fillRect(x + 38, FOOTER.y, 32, 46);
  }
  ctx.restore();
  ctx.textAlign = 'center';
  if (sheet.tagline) {
    ctx.font = `38px ${SCRIPT}`;
    ctx.fillStyle = C.blush;
    ctx.fillText(wrap(ctx, sheet.tagline, W - 80, 1)[0], W / 2, H - 16 - 18 - 8 - 12);
  }
  ctx.textAlign = 'left';
  ctx.font = `bold 13px ${SANS}`;
  ctx.fillStyle = C.ivory;
  spacedText(ctx, 'LALAVERSE · FASHION · ATTENTION · MONEY', W / 2, H - 16 - 4, 0.3, 'center');
}

/** The sheet drawn at 2x: a canvas of 2048 x 3072. */
async function renderSheetCanvas(sheet, palette = null) {
  registerFonts();
  const { createCanvas } = require('canvas');
  const canvas = createCanvas(W * RENDER_SCALE, H * RENDER_SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(RENDER_SCALE, RENDER_SCALE);
  await drawSheet(ctx, sheet, palette);
  return canvas;
}

/** One export size, taken from the 2x render without composing text again. */
async function renderExport(sheet, size) {
  const spec = EXPORTS[size];
  if (!spec) throw new Error(`Unknown export size: ${size}`);
  const { createCanvas } = require('canvas');
  const big = await renderSheetCanvas(sheet);
  const S = RENDER_SCALE;

  if (size === 'pdf') {
    const pdf = createCanvas(spec.width, spec.height, 'pdf');
    pdf.getContext('2d').drawImage(big, 0, 0, spec.width, spec.height);
    return { buffer: pdf.toBuffer('application/pdf'), ...spec };
  }

  const out = createCanvas(spec.width, spec.height);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (size === 'sheet' || size === 'pin') {
    ctx.drawImage(big, 0, 0, spec.width, spec.height);
  } else if (size === 'story') {
    // The sheet at full width, padded: blush above, the footer's plum below.
    const h = (spec.width / W) * H;
    const top = (spec.height - h) / 2;
    ctx.fillStyle = C.blush;
    ctx.fillRect(0, 0, spec.width, top + 1);
    ctx.fillStyle = C.plum;
    ctx.fillRect(0, top + h - 1, spec.width, spec.height - top - h + 1);
    ctx.drawImage(big, 0, top, spec.width, h);
  } else if (size === 'post') {
    // The top of the sheet at full width: logo, the look, the hero, the event and the wardrobe row.
    const srcH = (spec.height / spec.width) * W * S;
    ctx.drawImage(big, 0, 0, W * S, srcH, 0, 0, spec.width, spec.height);
  } else if (size === 'look') {
    ctx.drawImage(big, LOOK_STRIP.x * S, LOOK_STRIP.y * S, LOOK_STRIP.w * S, LOOK_STRIP.h * S, 0, 0, spec.width, spec.height);
  }
  return { buffer: out.toBuffer('image/png'), ...spec };
}

module.exports = { EXPORTS, renderSheetCanvas, renderExport, LOOK_STRIP };

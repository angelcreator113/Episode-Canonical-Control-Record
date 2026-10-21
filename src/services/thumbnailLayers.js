'use strict';

/**
 * The YouTube thumbnail as layers (Templates › YouTube thumbnails; Evoni,
 * 2026-10-21: "make my images bigger or smaller and move things so I can
 * have them at different angles"). A thumbnail is { version: 2, layers },
 * 1280×720, drawn bottom layer first. Every layer has a place and a size
 * (x, y, w, h), a rotation in degrees about its centre, and can be hidden:
 *
 *   image   a picture (src: an S3/CloudFront URL), cover-fitted (the
 *           background) or contained and standing on the box's bottom
 *           (a figure); frame 'polaroid' gives it a white card. Effects
 *           (Evoni, 2026-10-21): flipX, brightness and contrast change the
 *           picture's own pixels; outline (a sticker edge round a cut-out)
 *           and shadow are drawn round what the box shows (not on a card).
 *   shade   the darkening that keeps text readable: dim, a gradient from
 *           one side, and the accent stripe along the bottom. Whole canvas.
 *   text    words in one of FONTS, made smaller until they fit the box
 *           (size is the largest they may be); left, centre or right;
 *           letter spacing; optional outline (stroke) and a box behind
 *           them (bg, its see-through bgOpacity and rounded bgRadius).
 *   badge   a pill with a few words ("EP 1").
 *   checklist  rows of a tick box and a few words (Evoni's "Come Style Me":
 *           sweater dress, accessories, hair, vibe); each tick on or off.
 *
 * role names what a layer is for (background, lala, jaw, title, kicker,
 * badge, shade): the Studio's controls and the show's template find layers
 * by it. The browser editor (frontend/src/lib/thumbnailLayers.js) mirrors
 * fitText and the fonts, so what is dragged there is what is drawn here.
 */

const path = require('path');
const sharp = require('sharp');

let canvasLib = null;
try {
  canvasLib = require('canvas');
} catch (err) {
  console.error('[thumbnailLayers] node-canvas is not available:', err.message);
}

const WIDTH = 1280;
const HEIGHT = 720;
const MAX_LAYERS = 24;
const KINDS = Object.freeze(['image', 'shade', 'text', 'badge', 'checklist']);
const MAX_ROWS = 6;
const HEX = /^#[0-9a-f]{6}$/i;

const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
/** The thumbnail fonts: key → family, weight and file (OFL, bundled). */
const FONTS = Object.freeze({
  serif: { family: 'Thumb Serif', weight: 'bold', file: 'invitation/LibreBaskerville-Bold.ttf' },
  display: { family: 'Thumb Display', weight: 'bold', file: 'invitation/CormorantGaramond-Bold.ttf' },
  sans: { family: 'Thumb Sans', weight: 'bold', file: 'stylesheet/DMSans-Bold.ttf' },
  script: { family: 'Thumb Script', weight: 'normal', file: 'stylesheet/GreatVibes-Regular.ttf' },
  hand: { family: 'Thumb Hand', weight: 'bold', file: 'documents/Caveat-SemiBold.ttf' },
});

let fontsReady = false;
function registerFonts() {
  if (fontsReady || !canvasLib) return;
  for (const f of Object.values(FONTS)) {
    canvasLib.registerFont(path.join(FONT_DIR, f.file), { family: f.family, weight: f.weight });
  }
  fontsReady = true;
}

class LayerError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const num = (v, lo, hi, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const hex = (v, dflt) => (HEX.test(String(v || '')) ? String(v).toUpperCase() : dflt);
const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const pick = (v, list, dflt) => (list.includes(v) ? v : dflt);

/**
 * Checks one thumbnail: { version: 2, layers }. Numbers are kept in range,
 * colours and choices fall back to defaults, text is cut to length.
 * allowedUrl(url) decides which pictures may be used; any other src is a
 * 400. Throws LayerError(400) for a spec that is not layers at all.
 */
function readLayers(body, allowedUrl) {
  const b = body && typeof body === 'object' ? body : {};
  if (Number(b.version) !== 2 || !Array.isArray(b.layers)) throw new LayerError(400, 'spec must be { version: 2, layers: [...] }');
  if (b.layers.length > MAX_LAYERS) throw new LayerError(400, `At most ${MAX_LAYERS} layers`);
  const seen = new Set();
  const layers = b.layers.map((raw, i) => {
    const l = raw && typeof raw === 'object' ? raw : {};
    if (!KINDS.includes(l.kind)) throw new LayerError(400, `Layer ${i + 1}: kind must be one of ${KINDS.join(', ')}`);
    let id = str(l.id, 40) || `layer-${i + 1}`;
    while (seen.has(id)) id = `${id}-${i + 1}`;
    seen.add(id);
    const base = {
      id,
      kind: l.kind,
      role: str(l.role, 20) || null,
      name: str(l.name, 80) || null,
      visible: l.visible !== false,
      // Locked: not moved, resized or turned on the canvas (Evoni, 2026-10-21).
      locked: Boolean(l.locked),
      x: Math.round(num(l.x, -WIDTH, WIDTH * 2, 0)),
      y: Math.round(num(l.y, -HEIGHT, HEIGHT * 2, 0)),
      w: Math.round(num(l.w, 1, WIDTH * 3, WIDTH)),
      h: Math.round(num(l.h, 1, HEIGHT * 3, HEIGHT)),
      rotation: Math.round(num(l.rotation, -180, 180, 0) * 10) / 10,
      opacity: num(l.opacity, 0, 1, 1),
    };
    if (l.kind === 'image') {
      const src = typeof l.src === 'string' && l.src ? l.src : null;
      if (src && !allowedUrl(src)) throw new LayerError(400, `Layer ${i + 1}: that picture is not one of ours (only S3 pictures can be used)`);
      return {
        ...base,
        src,
        fit: pick(l.fit, ['cover', 'contain'], 'contain'),
        frame: pick(l.frame, ['none', 'polaroid'], 'none'),
        flipX: Boolean(l.flipX),
        brightness: Math.round(num(l.brightness, -0.5, 0.5, 0) * 100) / 100,
        contrast: Math.round(num(l.contrast, -0.5, 0.5, 0) * 100) / 100,
        outline: HEX.test(String(l.outline || '')) ? String(l.outline).toUpperCase() : null,
        outlineWidth: Math.round(num(l.outlineWidth, 2, 40, 12)),
        shadow: Boolean(l.shadow),
      };
    }
    if (l.kind === 'shade') {
      return { ...base, dim: num(l.dim, 0, 0.8, 0.35), accent: hex(l.accent, '#E0689F'), side: pick(l.side, ['left', 'right', 'center', 'none'], 'left') };
    }
    if (l.kind === 'checklist') {
      const items = (Array.isArray(l.items) ? l.items : []).slice(0, MAX_ROWS)
        .map((it) => ({ text: str(it?.text, 40), checked: it?.checked !== false }))
        .filter((it) => it.text);
      return { ...base, items, font: pick(l.font, Object.keys(FONTS), 'hand'), color: hex(l.color, '#FFFFFF') };
    }
    if (l.kind === 'badge') {
      return { ...base, text: str(l.text, 16), font: pick(l.font, Object.keys(FONTS), 'sans'), fill: hex(l.fill, '#E0689F'), color: hex(l.color, '#FFFFFF') };
    }
    return {
      ...base,
      text: str(l.text, 160),
      font: pick(l.font, Object.keys(FONTS), 'serif'),
      size: Math.round(num(l.size, 10, 220, 80)),
      color: hex(l.color, '#FFFFFF'),
      stroke: l.stroke === null ? null : hex(l.stroke, '#2A0A22'),
      bg: HEX.test(String(l.bg || '')) ? String(l.bg).toUpperCase() : null,
      bgOpacity: num(l.bgOpacity, 0, 1, 1),
      bgRadius: Math.round(num(l.bgRadius, 0, 60, 0)),
      align: pick(l.align, ['left', 'center', 'right'], 'left'),
      // Points between letters (Evoni, 2026-10-21: text tools).
      spacing: Math.round(num(l.spacing, -2, 20, 0)),
      upper: Boolean(l.upper),
    };
  });
  return { version: 2, layers };
}

const LINE_HEIGHT = 1.12;
const MIN_SIZE = 10;

/**
 * The words in lines that fit width w at size s. measure(text, s) gives a
 * line's width. A single word wider than the box stays on its own line.
 */
function wrapWords(words, s, w, measure) {
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || measure(next, s) <= w) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The largest size, from `size` down, at which the text fits the box: its
 * lines are no wider than w and stand no taller than h. { size, lines }.
 * Mirrored in frontend/src/lib/thumbnailLayers.js.
 */
function fitText(text, { w, h, size }, measure) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return { size, lines: [] };
  for (let s = Math.max(MIN_SIZE, size); s >= MIN_SIZE; s -= 2) {
    const lines = wrapWords(words, s, w, measure);
    const widest = Math.max(...lines.map((l) => measure(l, s)));
    if (lines.length * s * LINE_HEIGHT <= h && widest <= w) return { size: s, lines };
  }
  return { size: MIN_SIZE, lines: wrapWords(words, MIN_SIZE, w, measure) };
}

/**
 * measure with letter spacing: each letter's width plus the spacing after
 * it (how the editor's Konva draws spaced text). Mirrored in the editor.
 */
function spaced(measure, spacing) {
  if (!spacing) return measure;
  return (s, size) => [...String(s)].reduce((w, ch) => w + measure(ch, size) + spacing, 0);
}

/** A rounded rectangle's path, centred on the origin. */
function roundRectPath(ctx, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(-w / 2 + rr, -h / 2);
  ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, rr);
  ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, rr);
  ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, rr);
  ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, rr);
  ctx.closePath();
}

const fontCss = (key, size) => {
  const f = FONTS[key] || FONTS.serif;
  return `${f.weight === 'bold' ? 'bold ' : ''}${size}px "${f.family}"`;
};

/** A picture's bytes as something canvas can draw (any format sharp reads; at most 2560px). */
async function loadPicture(buffer, label) {
  try {
    const png = await sharp(buffer).rotate().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    return await canvasLib.loadImage(png);
  } catch (err) {
    console.error(`[thumbnailLayers] ${label} unreadable:`, err.message);
    throw new LayerError(400, `The ${label} is not a picture we can read`);
  }
}

function drawImage(ctx, img, l) {
  const { w, h } = l;
  if (l.frame === 'polaroid') {
    const pad = Math.round(Math.min(w, h) * 0.05);
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.shadowColor = 'transparent';
    // On the card: a product whole and centred (contain), or filling it (cover).
    drawFitted(ctx, img, { x: -w / 2 + pad, y: -h / 2 + pad, w: w - pad * 2, h: h - pad * 2, fit: l.fit, center: true });
    return;
  }
  drawFitted(ctx, img, { x: -w / 2, y: -h / 2, w, h, fit: l.fit });
}

/**
 * cover: fills the box, cropped from the centre. contain: whole, centred
 * across, standing on the bottom (a figure), or centred both ways (center).
 */
function drawFitted(ctx, img, { x, y, w, h, fit, center = false }) {
  const iw = img.width;
  const ih = img.height;
  if (fit === 'cover') {
    const scale = Math.max(w / iw, h / ih);
    const sw = w / scale;
    const sh = h / scale;
    ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
    return;
  }
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, center ? y + (h - dh) / 2 : y + h - dh, dw, dh);
}

// ── Picture effects (Evoni, 2026-10-21). Mirrored step for step in the
// editor (frontend/src/lib/thumbnailLayers.js), so both draw the same. ─────

/** brightness and contrast on one 0–255 value: contrast about the middle, then brightness. */
const toneValue = (v, brightness, contrast) => Math.max(0, Math.min(255, Math.round((v - 128) * (1 + contrast) + 128 + brightness * 255)));

/** The picture as it is drawn: turned left to right and toned when asked; else the picture itself. */
function adjustedPicture(img, l, makeCanvas) {
  if (!l.flipX && !l.brightness && !l.contrast) return img;
  const c = makeCanvas(img.width, img.height);
  const cx = c.getContext('2d');
  if (l.flipX) {
    cx.translate(img.width, 0);
    cx.scale(-1, 1);
  }
  cx.drawImage(img, 0, 0);
  if (l.brightness || l.contrast) {
    const data = cx.getImageData(0, 0, img.width, img.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = toneValue(d[i], l.brightness, l.contrast);
      d[i + 1] = toneValue(d[i + 1], l.brightness, l.contrast);
      d[i + 2] = toneValue(d[i + 2], l.brightness, l.contrast);
    }
    cx.putImageData(data, 0, 0);
  }
  return c;
}

const STICKER_SHADOW = { color: 'rgba(0,0,0,0.45)', blur: 24, offsetY: 10 };
/** The room round the box a sticker needs for its outline and shadow. */
const stickerMargin = (l) => Math.ceil((l.outline ? l.outlineWidth : 0) + (l.shadow ? STICKER_SHADOW.blur + STICKER_SHADOW.offsetY : 0));
const stickerRing = (r) => [...Array(24)].map((_, i) => [Math.cos((i * Math.PI) / 12) * r, Math.sin((i * Math.PI) / 12) * r]);

/**
 * A picture with a sticker edge and/or a drop shadow: what the box shows
 * (drawBox draws it into a w×h canvas), its silhouette in the outline
 * colour pushed out all round, and the shadow under both. A canvas of
 * (w + 2m) × (h + 2m), m = stickerMargin(l), to draw at (-m, -m) in the box.
 */
function stickerCanvas(l, drawBox, makeCanvas) {
  const m = stickerMargin(l);
  const box = makeCanvas(l.w, l.h);
  drawBox(box.getContext('2d'));
  const sticker = makeCanvas(l.w + m * 2, l.h + m * 2);
  const sx = sticker.getContext('2d');
  if (l.outline) {
    const sil = makeCanvas(l.w, l.h);
    const lx = sil.getContext('2d');
    lx.drawImage(box, 0, 0);
    lx.globalCompositeOperation = 'source-in';
    lx.fillStyle = l.outline;
    lx.fillRect(0, 0, l.w, l.h);
    for (const r of [l.outlineWidth, l.outlineWidth / 2]) {
      for (const [dx, dy] of stickerRing(r)) sx.drawImage(sil, m + dx, m + dy);
    }
  }
  sx.drawImage(box, m, m);
  if (!l.shadow) return sticker;
  const out = makeCanvas(l.w + m * 2, l.h + m * 2);
  const ox = out.getContext('2d');
  ox.shadowColor = STICKER_SHADOW.color;
  ox.shadowBlur = STICKER_SHADOW.blur;
  ox.shadowOffsetY = STICKER_SHADOW.offsetY;
  ox.drawImage(sticker, 0, 0);
  return out;
}

function drawShade(ctx, l) {
  ctx.fillStyle = `rgba(0,0,0,${l.dim})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  let g = null;
  if (l.side === 'left' || l.side === 'right') {
    // Darkest on the text's side: the side away from the figure.
    g = l.side === 'left' ? ctx.createLinearGradient(WIDTH, 0, 0, 0) : ctx.createLinearGradient(0, 0, WIDTH, 0);
    g.addColorStop(0, 'rgba(42,10,34,0.85)');
    g.addColorStop(0.55, 'rgba(42,10,34,0.35)');
    g.addColorStop(1, 'rgba(42,10,34,0)');
  } else if (l.side === 'center') {
    g = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 0, WIDTH / 2, HEIGHT / 2, WIDTH * 0.7);
    g.addColorStop(0, 'rgba(42,10,34,0.65)');
    g.addColorStop(1, 'rgba(42,10,34,0.2)');
  }
  if (g) {
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  ctx.fillStyle = l.accent;
  ctx.fillRect(0, HEIGHT - 14, WIDTH, 14);
}

function drawText(ctx, l) {
  const text = l.upper ? l.text.toUpperCase() : l.text;
  const plain = (s, size) => { ctx.font = fontCss(l.font, size); return ctx.measureText(s).width; };
  const measure = spaced(plain, l.spacing);
  const pad = l.bg ? Math.round(l.size * 0.25) : 0;
  const { size, lines } = fitText(text, { w: l.w - pad * 2, h: l.h - pad * 2, size: l.size }, measure);
  if (l.bg) {
    ctx.save();
    ctx.globalAlpha *= l.bgOpacity;
    ctx.fillStyle = l.bg;
    roundRectPath(ctx, l.w, l.h, l.bgRadius);
    ctx.fill();
    ctx.restore();
  }
  ctx.font = fontCss(l.font, size);
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, Math.round(size / 7));
  const lineH = size * LINE_HEIGHT;
  const paint = (s, x, y) => {
    if (l.stroke) {
      ctx.strokeStyle = l.stroke;
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = l.color;
    ctx.fillText(s, x, y);
  };
  let y = -((lines.length - 1) * lineH) / 2;
  for (const line of lines) {
    if (!l.spacing) {
      ctx.textAlign = l.align;
      paint(line, l.align === 'center' ? 0 : l.align === 'right' ? l.w / 2 - pad : -l.w / 2 + pad, y);
    } else {
      // Letter by letter, as the editor draws spaced words; the space after
      // the last letter is not part of where the line stands.
      const lineW = measure(line, size) - l.spacing;
      let x = l.align === 'center' ? -lineW / 2 : l.align === 'right' ? l.w / 2 - pad - lineW : -l.w / 2 + pad;
      ctx.textAlign = 'left';
      for (const ch of line) {
        paint(ch, x, y);
        x += plain(ch, size) + l.spacing;
      }
      ctx.font = fontCss(l.font, size);
    }
    y += lineH;
  }
}

function drawBadge(ctx, l) {
  const r = Math.min(l.h / 2, l.w / 2);
  ctx.beginPath();
  ctx.moveTo(-l.w / 2 + r, -l.h / 2);
  ctx.arcTo(l.w / 2, -l.h / 2, l.w / 2, l.h / 2, r);
  ctx.arcTo(l.w / 2, l.h / 2, -l.w / 2, l.h / 2, r);
  ctx.arcTo(-l.w / 2, l.h / 2, -l.w / 2, -l.h / 2, r);
  ctx.arcTo(-l.w / 2, -l.h / 2, l.w / 2, -l.h / 2, r);
  ctx.closePath();
  ctx.fillStyle = l.fill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  const measure = (s, size) => { ctx.font = fontCss(l.font, size); return ctx.measureText(s).width; };
  const { size, lines } = fitText(l.text.toUpperCase(), { w: l.w * 0.8, h: l.h * 0.7, size: Math.round(l.h * 0.55) }, measure);
  ctx.font = fontCss(l.font, size);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = l.color;
  ctx.fillText(lines.join(' '), 0, 0);
}

/**
 * The checklist's rows: each row's box (a square, its side) and the words'
 * size, the same for every row (the smallest that fits each). Mirrored in
 * the editor.
 */
function checklistRows(l, measure) {
  const n = Math.max(1, l.items.length);
  const rowH = l.h / n;
  const box = Math.round(rowH * 0.6);
  const textX = box * 1.5;
  // Each row is one line: the largest size at which every row fits beside its box.
  const start = Math.max(MIN_SIZE, Math.round(rowH * 0.8));
  let size = start;
  for (const it of l.items) {
    while (size > MIN_SIZE && measure(it.text, size) > l.w - textX) size -= 2;
  }
  return { rowH, box, textX, size };
}

function drawChecklist(ctx, l) {
  if (!l.items.length) return;
  const measure = (s, size) => { ctx.font = fontCss(l.font, size); return ctx.measureText(s).width; };
  const { rowH, box, textX, size } = checklistRows(l, measure);
  ctx.strokeStyle = l.color;
  ctx.fillStyle = l.color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  l.items.forEach((it, i) => {
    const cy = -l.h / 2 + rowH * (i + 0.5);
    const x0 = -l.w / 2;
    ctx.lineWidth = Math.max(2, Math.round(box * 0.09));
    ctx.strokeRect(x0, cy - box / 2, box, box);
    if (it.checked) {
      ctx.lineWidth = Math.max(3, Math.round(box * 0.14));
      ctx.beginPath();
      ctx.moveTo(x0 + box * 0.18, cy);
      ctx.lineTo(x0 + box * 0.42, cy + box * 0.28);
      ctx.lineTo(x0 + box * 0.95, cy - box * 0.45);
      ctx.stroke();
    }
    ctx.font = fontCss(l.font, size);
    ctx.fillText(it.text, x0 + textX, cy);
  });
}

/**
 * Draws the layers to a 1280×720 PNG. pictures maps each image layer's id
 * to its bytes (a missing one is skipped). A plain plum-to-accent gradient
 * sits under everything, so an empty canvas is never transparent.
 */
async function renderLayers(spec, pictures = {}) {
  if (!canvasLib) throw new LayerError(503, 'Drawing thumbnails is not set up on the server (node-canvas)');
  registerFonts();
  const canvas = canvasLib.createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const shade = spec.layers.find((l) => l.kind === 'shade');
  const base = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  base.addColorStop(0, '#4A1640');
  base.addColorStop(1, shade?.accent || '#E0689F');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const images = {};
  await Promise.all(spec.layers.filter((l) => l.kind === 'image' && l.visible && pictures[l.id]).map(async (l) => {
    images[l.id] = await loadPicture(pictures[l.id], l.role === 'background' ? 'background' : 'picture');
  }));
  for (const l of spec.layers) {
    if (!l.visible) continue;
    if (l.kind === 'image' && !images[l.id]) continue;
    ctx.save();
    ctx.globalAlpha = l.opacity;
    if (l.kind === 'shade') {
      drawShade(ctx, l);
    } else {
      ctx.translate(l.x + l.w / 2, l.y + l.h / 2);
      ctx.rotate((l.rotation * Math.PI) / 180);
      if (l.kind === 'image') {
        const pic = adjustedPicture(images[l.id], l, canvasLib.createCanvas);
        if (l.frame !== 'polaroid' && (l.outline || l.shadow)) {
          const m = stickerMargin(l);
          const sticker = stickerCanvas(l, (bx) => drawFitted(bx, pic, { x: 0, y: 0, w: l.w, h: l.h, fit: l.fit }), canvasLib.createCanvas);
          ctx.drawImage(sticker, -l.w / 2 - m, -l.h / 2 - m);
        } else {
          drawImage(ctx, pic, l);
        }
      }
      else if (l.kind === 'text') drawText(ctx, l);
      else if (l.kind === 'badge') drawBadge(ctx, l);
      else if (l.kind === 'checklist') drawChecklist(ctx, l);
    }
    ctx.restore();
  }
  return canvas.toBuffer('image/png', { compressionLevel: 9 });
}

/** The font file for a key, for the browser editor (FONTS only). */
function fontFile(key) {
  const f = FONTS[key];
  return f ? path.join(FONT_DIR, f.file) : null;
}

module.exports = {
  WIDTH, HEIGHT, MAX_LAYERS, MAX_ROWS, KINDS, FONTS, LINE_HEIGHT, LayerError,
  readLayers, wrapWords, fitText, spaced, checklistRows, renderLayers, fontFile, toneValue, stickerMargin,
};

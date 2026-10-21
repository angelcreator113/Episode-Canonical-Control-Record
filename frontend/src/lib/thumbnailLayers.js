/**
 * The YouTube thumbnail as layers, in the browser (Evoni, 2026-10-21: "make
 * my images bigger or smaller and move things so I can have them at
 * different angles"). A thumbnail is { version: 2, layers } on a 1280×720
 * canvas, drawn bottom layer first; the server draws the saved file from
 * the same layers (src/services/thumbnailLayers.js). FONTS and fitText
 * mirror the server's, so the editor shows what will be saved.
 *
 * Layers with a role are the ones the Studio's controls fill: background,
 * shade, jaw, lala, kicker, title, badge; and for "Come Style Me" (Evoni,
 * 2026-10-21) headline, checklist, outfit, piece-1..4, edition, logo.
 * The layouts (Lala left, Lala right, Title only, Come Style Me)
 * are presets: where those roles start.
 */
import api from '../services/api';

export const WIDTH = 1280;
export const HEIGHT = 720;
export const LINE_HEIGHT = 1.12;
const MIN_SIZE = 10;

/** The thumbnail fonts: key → family and weight (the server's FONTS). */
export const FONTS = {
  serif: { family: 'Thumb Serif', weight: 'bold', label: 'Serif' },
  display: { family: 'Thumb Display', weight: 'bold', label: 'Elegant' },
  sans: { family: 'Thumb Sans', weight: 'bold', label: 'Clean' },
  script: { family: 'Thumb Script', weight: 'normal', label: 'Script' },
  hand: { family: 'Thumb Hand', weight: 'bold', label: 'Handwritten' },
};

/** The outline round thumbnail words (dark plum; the server's default stroke). */
export const OUTLINE = '#2A0A22';
// The box behind words starts as the ink colour, half see-through (Evoni, 2026-10-21: text tools).
export const BOX_COLOR = '#2C2C2C';
export const BOX_OPACITY = 0.6;

export const fontCss = (key, size) => {
  const f = FONTS[key] || FONTS.serif;
  return `${f.weight === 'bold' ? 'bold ' : ''}${size}px "${f.family}"`;
};

let fontsLoading = null;
/**
 * Loads the thumbnail fonts from the server (signed in, so through api)
 * into the page. Resolves when all are in; a font that fails is skipped
 * (the editor then measures with a fallback; the saved file is still right).
 */
export function loadThumbnailFonts() {
  if (fontsLoading) return fontsLoading;
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  fontsLoading = Promise.all(Object.entries(FONTS).map(async ([key, f]) => {
    try {
      const res = await api.get(`/api/v1/youtube-thumbnails/fonts/${key}`, { responseType: 'arraybuffer' });
      const face = new FontFace(f.family, res.data, { weight: f.weight === 'bold' ? '700' : '400' });
      await face.load();
      document.fonts.add(face);
    } catch (err) {
      console.error(`[ThumbnailLayers] font ${key} not loaded:`, err);
    }
  }));
  return fontsLoading;
}

/** The words in lines that fit width w at size s (the server's wrapWords). */
export function wrapWords(words, s, w, measure) {
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

/** The largest size, from `size` down, at which the text fits the box (the server's fitText). */
export function fitText(text, { w, h, size }, measure) {
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
 * it, as Konva draws spaced text (the server's spaced).
 */
export function spaced(measure, spacing) {
  if (!spacing) return measure;
  return (s, size) => [...String(s)].reduce((w, ch) => w + measure(ch, size) + spacing, 0);
}

let measureCtx = null;
/** A measure(text, size) for a font, from a canvas the page never shows. */
export function measurer(font) {
  if (!measureCtx && typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d');
  return (s, size) => {
    if (!measureCtx) return String(s).length * size * 0.55;
    measureCtx.font = fontCss(font, size);
    return measureCtx.measureText(s).width;
  };
}

/** Where a picture is drawn in its box: cover fills (cropped), contain stands on the bottom (or, center, sits in the middle: on a photo card). */
export function fitPicture(iw, ih, { w, h, fit, center = false }) {
  if (!iw || !ih) return { crop: null, x: 0, y: 0, w, h };
  if (fit === 'cover') {
    const scale = Math.max(w / iw, h / ih);
    const cw = w / scale;
    const ch = h / scale;
    return { crop: { x: (iw - cw) / 2, y: (ih - ch) / 2, width: cw, height: ch }, x: 0, y: 0, w, h };
  }
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  return { crop: null, x: (w - dw) / 2, y: center ? (h - dh) / 2 : h - dh, w: dw, h: dh };
}

export const ROLE_LABELS = {
  background: 'Background', shade: 'Shade', jaw: 'JustAWoman', lala: 'Lala', kicker: 'Show name', title: 'Title', badge: 'Badge',
  headline: 'Headline', checklist: 'Checklist', outfit: 'Full outfit', edition: 'Edition label', logo: 'Logo',
  'piece-1': 'Piece 1', 'piece-2': 'Piece 2', 'piece-3': 'Piece 3', 'piece-4': 'Piece 4',
};

/**
 * The checklist's rows (the server's checklistRows): each row's height, the
 * tick box's side, where the words start, and one words size for all rows
 * (each row one line).
 */
export function checklistRows(l, measure) {
  const items = l.items || [];
  const n = Math.max(1, items.length);
  const rowH = l.h / n;
  const box = Math.round(rowH * 0.6);
  const textX = box * 1.5;
  // Each row is one line: the largest size at which every row fits beside its box.
  const start = Math.max(MIN_SIZE, Math.round(rowH * 0.8));
  let size = start;
  for (const it of items) {
    while (size > MIN_SIZE && measure(it.text, size) > l.w - textX) size -= 2;
  }
  return { rowH, box, textX, size };
}

/** "EP 3" as "EPISODE 3" when the layout spells it out. */
const longBadge = (badge) => String(badge || '').replace(/^EP\b/i, 'EPISODE');

const PIECES = ['piece-1', 'piece-2', 'piece-3', 'piece-4'];

/**
 * "Come Style Me" (Evoni's reference thumbnail, 2026-10-21): the scene set,
 * Lala large on the left, the checklist top left, the script headline top
 * right, the show's name and the edition label under it, the full outfit
 * in the middle, the pieces as photo cards down the right, the episode
 * ribbon bottom left. The scene set, Lala, the checklist and the headline
 * are the core; a layer with nothing for it is left out.
 */
function comeStyleMe(content, style) {
  const accent = style.accent || '#B8962E';
  const r = (role, kind, box, extra) => ({ id: role, role, kind, visible: true, rotation: 0, opacity: 1, ...box, ...extra });
  const layers = [
    r('background', 'image', { x: 0, y: 0, w: WIDTH, h: HEIGHT }, { src: content.backgroundUrl || null, fit: 'cover', frame: 'none' }),
    r('shade', 'shade', { x: 0, y: 0, w: WIDTH, h: HEIGHT }, { dim: style.dim ?? 0.2, accent, side: 'left' }),
  ];
  if (content.outfitUrl) layers.push(r('outfit', 'image', { x: 470, y: 90, w: 300, h: 630 }, { src: content.outfitUrl, fit: 'contain', frame: 'none' }));
  if (content.lalaUrl) layers.push(r('lala', 'image', { x: 0, y: 40, w: 520, h: 680 }, { src: content.lalaUrl, fit: 'contain', frame: 'none' }));
  (content.pieces || []).slice(0, 4).forEach((p, i) => {
    layers.push(r(PIECES[i], 'image', { x: 1090, y: 18 + i * 172, w: 172, h: 172, rotation: i % 2 ? 4 : -4 }, { src: p.url, name: p.label || null, fit: 'contain', frame: 'polaroid' }));
  });
  layers.push(
    r('checklist', 'checklist', { x: 36, y: 28, w: 300, h: 190, rotation: -4 }, {
      items: (content.checklist || []).slice(0, 6), font: 'hand', color: '#FFFFFF',
    }),
    r('headline', 'text', { x: 560, y: 10, w: 540, h: 330, rotation: -6 }, {
      text: content.headline || 'Come Style Me', font: 'script', size: 150, color: '#F3D27A', stroke: null, bg: null, align: 'center', upper: false,
    }),
    r('kicker', 'text', { x: 640, y: 350, w: 440, h: 170 }, {
      text: content.kicker || '', font: 'serif', size: 52, color: '#FFFFFF', stroke: OUTLINE, bg: null, align: 'center', upper: true,
    }),
  );
  if (content.edition) {
    layers.push(r('edition', 'text', { x: 660, y: 540, w: 400, h: 58, rotation: -2 }, {
      text: content.edition, font: 'serif', size: 28, color: '#5A1430', stroke: null, bg: '#F4ECDD', align: 'center', upper: true,
    }));
  }
  if (content.badge) layers.push(r('badge', 'badge', { x: 40, y: 610, w: 300, h: 74 }, { text: longBadge(content.badge), font: 'serif', fill: accent, color: '#FFFFFF' }));
  if (content.logoUrl) layers.push(r('logo', 'image', { x: 40, y: 520, w: 120, h: 80 }, { src: content.logoUrl, fit: 'contain', frame: 'none' }));
  return { version: 2, layers };
}

/** A layer's name in the layers list. */
export const layerName = (l) => ROLE_LABELS[l.role] || l.name || (l.kind === 'text' ? (l.text || 'Text').slice(0, 24) : 'Picture');

/** The starting boxes per layout (the earlier fixed layout, as layers). */
function presetBoxes(layout) {
  const right = layout === 'lala-right';
  const center = layout === 'center';
  const text = center ? { x: 110, w: 1060 } : right ? { x: 70, w: 620 } : { x: 590, w: 640 };
  return {
    side: center ? 'center' : right ? 'right' : 'left',
    align: center ? 'center' : 'left',
    kicker: { ...text, y: 190, h: 52 },
    title: { ...text, y: 250, h: 320 },
    badge: { x: right ? 56 : WIDTH - 170 - 56, y: 44, w: 170, h: 68 },
    // One figure alone, and the pair (JustAWoman by the edge, Lala in front).
    lala: center ? null : { x: right ? WIDTH - 30 - 560 : 30, y: 30, w: 560, h: 690 },
    lalaDuo: center ? null : { x: right ? WIDTH - 390 - 180 : 390 - 180, y: 30, w: 360, h: 690 },
    jaw: center ? null : { x: right ? WIDTH - 20 - 340 : 20, y: 80, w: 340, h: 640 },
  };
}

const roleLayer = (role, kind, box, extra) => ({ id: role, role, kind, visible: true, rotation: 0, opacity: 1, ...box, ...extra });

/**
 * A thumbnail from a layout: content { title, kicker, badge, backgroundUrl,
 * lalaUrl, jawUrl } and style { accent, textColor, dim }.
 */
export function presetLayers(layout, content = {}, style = {}) {
  if (layout === 'come-style-me') return comeStyleMe(content, style);
  const b = presetBoxes(layout);
  const accent = style.accent || '#E0689F';
  const duo = Boolean(content.lalaUrl && content.jawUrl);
  const layers = [
    roleLayer('background', 'image', { x: 0, y: 0, w: WIDTH, h: HEIGHT }, { src: content.backgroundUrl || null, fit: 'cover', frame: 'none' }),
    roleLayer('shade', 'shade', { x: 0, y: 0, w: WIDTH, h: HEIGHT }, { dim: style.dim ?? 0.35, accent, side: b.side }),
  ];
  if (b.jaw && content.jawUrl) layers.push(roleLayer('jaw', 'image', b.jaw, { src: content.jawUrl, fit: 'contain', frame: 'none' }));
  if (b.lala && content.lalaUrl) layers.push(roleLayer('lala', 'image', duo ? b.lalaDuo : b.lala, { src: content.lalaUrl, fit: 'contain', frame: 'none' }));
  layers.push(
    roleLayer('kicker', 'text', b.kicker, { text: content.kicker || '', font: 'sans', size: 34, color: accent, stroke: OUTLINE, bg: null, align: b.align, upper: true }),
    roleLayer('title', 'text', b.title, { text: content.title || '', font: 'serif', size: 96, color: style.textColor || '#FFFFFF', stroke: OUTLINE, bg: null, align: b.align, upper: false }),
    roleLayer('badge', 'badge', b.badge, { text: content.badge || '', font: 'sans', fill: accent, color: '#FFFFFF' }),
  );
  return { version: 2, layers: layers.filter((l) => l.kind !== 'badge' || l.text) };
}

export const layerOf = (spec, role) => (spec?.layers || []).find((l) => l.role === role) || null;

/** The spec with one layer changed (by id). */
export const updateLayer = (spec, id, patch) => ({ ...spec, layers: spec.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

/**
 * Sets what a role shows (a picture or words). A picture role with no
 * layer yet gets one where the layout puts it (the earlier layer order:
 * figures above the shade, below the words); null src hides nothing, it
 * removes the picture.
 */
export function setRoleContent(spec, role, value, layout = 'lala-left') {
  const existing = layerOf(spec, role);
  const isPicture = ['background', 'lala', 'jaw'].includes(role);
  if (existing) return updateLayer(spec, existing.id, isPicture ? { src: value || null } : { text: value || '' });
  if (!value) return spec;
  const b = presetBoxes(layout === 'center' ? 'lala-left' : layout);
  if (role === 'lala' || role === 'jaw') {
    const box = role === 'jaw' ? b.jaw : (layerOf(spec, 'jaw') ? b.lalaDuo : b.lala);
    const layer = roleLayer(role, 'image', box, { src: value, fit: 'contain', frame: 'none' });
    // Above the shade and any figure already there, below the words.
    const firstWords = spec.layers.findIndex((l) => l.kind === 'text' || l.kind === 'badge');
    const at = firstWords === -1 ? spec.layers.length : firstWords;
    return { ...spec, layers: [...spec.layers.slice(0, at), layer, ...spec.layers.slice(at)] };
  }
  if (role === 'badge') {
    const shade = layerOf(spec, 'shade');
    return { ...spec, layers: [...spec.layers, roleLayer('badge', 'badge', b.badge, { text: value, font: 'sans', fill: shade?.accent || '#E0689F', color: '#FFFFFF' })] };
  }
  return spec;
}

/** Applies the colours: the accent (shade stripe, badge, show name), the title colour, the dim. */
export function applyStyle(spec, { accent, textColor, dim } = {}) {
  return {
    ...spec,
    layers: spec.layers.map((l) => {
      if (l.role === 'shade') return { ...l, ...(accent ? { accent } : {}), ...(dim !== undefined ? { dim } : {}) };
      if (l.role === 'badge' && accent) return { ...l, fill: accent };
      if (l.role === 'kicker' && accent) return { ...l, color: accent };
      if (l.role === 'title' && textColor) return { ...l, color: textColor };
      return l;
    }),
  };
}

/**
 * The show's template with this episode's words and pictures: every role
 * layer keeps its place, size, turn and look and takes the episode's
 * content; layers without a role (added text, extra pictures) stay as they
 * are. A figure the episode has no picture for is left out.
 */
export function fillTemplate(template, content = {}) {
  const pictures = {
    background: content.backgroundUrl, lala: content.lalaUrl, jaw: content.jawUrl, outfit: content.outfitUrl, logo: content.logoUrl,
    ...Object.fromEntries(PIECES.map((k, i) => [k, content.pieces?.[i]?.url])),
  };
  const optional = new Set(['lala', 'jaw', 'outfit', 'logo', ...PIECES]);
  const words = { title: content.title, kicker: content.kicker, edition: content.edition };
  const layers = (template?.layers || []).flatMap((l) => {
    if (l.role in pictures) {
      const src = pictures[l.role] || null;
      if (!src && optional.has(l.role)) return [];
      const piece = PIECES.indexOf(l.role);
      return [{ ...l, src, ...(piece >= 0 ? { name: content.pieces[piece].label || null } : {}) }];
    }
    if (l.role === 'edition' && !content.edition) return [];
    if (l.role in words) return [{ ...l, text: words[l.role] || '' }];
    // The badge keeps the template's wording: "EP 3" or "EPISODE 3".
    if (l.role === 'badge') return [{ ...l, text: /^EPISODE\b/i.test(l.text || '') ? longBadge(content.badge) : (content.badge || '') }];
    if (l.role === 'checklist' && content.checklist?.length) return [{ ...l, items: content.checklist.slice(0, 6) }];
    return [l];
  });
  return { version: 2, layers };
}

/** Moves a layer one step up (toward the front) or down. */
export function moveLayer(spec, id, dir) {
  const i = spec.layers.findIndex((l) => l.id === id);
  const j = dir === 'up' ? i + 1 : i - 1;
  if (i < 0 || j < 0 || j >= spec.layers.length) return spec;
  const layers = [...spec.layers];
  [layers[i], layers[j]] = [layers[j], layers[i]];
  return { ...spec, layers };
}

export const removeLayer = (spec, id) => ({ ...spec, layers: spec.layers.filter((l) => l.id !== id) });

const newId = (spec, prefix) => {
  let n = 1;
  while (spec.layers.some((l) => l.id === `${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
};

/** Adds words (no role) in the middle, on top. */
export const addText = (spec, text = 'Your words') => ({
  ...spec,
  layers: [...spec.layers, {
    id: newId(spec, 'text'), role: null, kind: 'text', visible: true, x: 340, y: 300, w: 600, h: 120, rotation: 0, opacity: 1,
    text, font: 'script', size: 90, color: '#FFFFFF', stroke: OUTLINE, bg: null, align: 'center', upper: false,
  }],
});

/** Adds a picture (no role) in the middle, on top. */
export const addPicture = (spec, url, name) => ({
  ...spec,
  layers: [...spec.layers, {
    id: newId(spec, 'picture'), role: null, name: name || null, kind: 'image', visible: true, x: 490, y: 210, w: 300, h: 300, rotation: 0, opacity: 1,
    src: url, fit: 'contain', frame: 'none',
  }],
});

/**
 * A moved or transformed layer's new box. Konva turns a node about its
 * offset (the box's centre here), so its position is the centre; scale is
 * folded back into the size.
 */
export function boxFromNode({ x, y, scaleX = 1, scaleY = 1, rotation = 0 }, layer) {
  const w = Math.max(10, Math.round(layer.w * Math.abs(scaleX)));
  const h = Math.max(10, Math.round(layer.h * Math.abs(scaleY)));
  const r = ((Math.round(rotation * 10) / 10 + 540) % 360) - 180;
  return { x: Math.round(x - w / 2), y: Math.round(y - h / 2), w, h, rotation: r };
}

/**
 * A copy of a layer, just above it and a little down and right; the copy
 * has no role, so the Studio's controls keep filling the original.
 */
export function duplicateLayer(spec, id) {
  const i = spec.layers.findIndex((l) => l.id === id);
  if (i < 0) return spec;
  const src = spec.layers[i];
  const copy = { ...src, id: newId(spec, `${src.role || src.kind}-copy`), role: null, name: `${layerName(src)} copy`, locked: false, x: src.x + 24, y: src.y + 24 };
  return { ...spec, layers: [...spec.layers.slice(0, i + 1), copy, ...spec.layers.slice(i + 1)] };
}

export const SNAP = 8;

/**
 * Where a dragged box snaps: its left edge, centre or right edge to the
 * canvas's edges and centre and to the other layers' edges and centres
 * (likewise top, middle, bottom), when within SNAP. box: { cx, cy, w, h }
 * (the centre, as Konva reports it). Returns the snapped centre and the
 * guide lines to draw: { cx, cy, guides: [{ x } | { y }] }.
 */
export function snapBox(box, others = []) {
  const xs = [0, WIDTH / 2, WIDTH];
  const ys = [0, HEIGHT / 2, HEIGHT];
  for (const o of others) {
    xs.push(o.x, o.x + o.w / 2, o.x + o.w);
    ys.push(o.y, o.y + o.h / 2, o.y + o.h);
  }
  const axis = (c, half, targets) => {
    let best = null;
    for (const t of targets) {
      for (const off of [-half, 0, half]) {
        const d = t - (c + off);
        if (Math.abs(d) <= SNAP && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: t };
      }
    }
    return best;
  };
  const sx = axis(box.cx, box.w / 2, xs);
  const sy = axis(box.cy, box.h / 2, ys);
  return {
    cx: box.cx + (sx ? sx.d : 0),
    cy: box.cy + (sy ? sy.d : 0),
    guides: [...(sx ? [{ x: sx.at }] : []), ...(sy ? [{ y: sy.at }] : [])],
  };
}

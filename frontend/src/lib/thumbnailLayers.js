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
// A sticker edge starts white, as cut-out stickers are (Evoni, 2026-10-21: picture effects).
export const STICKER_EDGE = '#FFFFFF';

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
export const layerName = (l) => ROLE_LABELS[l.role] || l.name
  || (l.kind === 'text' ? (l.text || 'Text').slice(0, 24) : l.kind === 'shape' ? shapeLabel(l) : 'Picture');

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

// Stickers and shapes (Evoni, 2026-10-21): what each starts as. Each fills its box.
export const SHAPES = [
  { key: 'arrow', label: 'Arrow', w: 320, h: 140, look: { fill: '#FFD86B', stroke: OUTLINE, strokeWidth: 6 } },
  { key: 'ring', label: 'Circle', w: 300, h: 220, look: { fill: '#FF3B3B', stroke: null, strokeWidth: 6, thickness: 16 } },
  { key: 'burst', label: 'Burst', w: 260, h: 260, look: { fill: '#E0689F', stroke: '#FFFFFF', strokeWidth: 6, text: 'NEW', font: 'sans', color: '#FFFFFF' } },
  { key: 'sparkle', label: 'Sparkles', w: 220, h: 220, look: { fill: '#FFD86B', stroke: null, strokeWidth: 6 } },
  { key: 'tag', label: 'Price tag', w: 340, h: 140, look: { fill: '#FFFFFF', stroke: OUTLINE, strokeWidth: 4, text: '$29', font: 'sans', color: OUTLINE } },
];
const shapeLabel = (l) => {
  const label = (SHAPES.find((x) => x.key === l.shape) || SHAPES[0]).label;
  return (l.shape === 'burst' || l.shape === 'tag') && l.text ? `${label}: ${l.text}` : label;
};

/** Adds a sticker in the middle, on top. */
export const addShape = (spec, key) => {
  const sh = SHAPES.find((x) => x.key === key) || SHAPES[0];
  return {
    ...spec,
    layers: [...spec.layers, {
      id: newId(spec, sh.key), role: null, kind: 'shape', shape: sh.key, visible: true,
      x: Math.round((WIDTH - sh.w) / 2), y: Math.round((HEIGHT - sh.h) / 2), w: sh.w, h: sh.h, rotation: 0, opacity: 1, ...sh.look,
    }],
  };
};

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

/**
 * Lines layers up (Evoni, 2026-10-21: arranging tools). how: left, center,
 * right (across), top, middle, bottom (down). One layer lines up with the
 * canvas; several with the box round them all. Locked layers, the shade
 * and missing ids are left where they are. Boxes are the layers' own
 * (x, y, w, h), before any turn.
 */
export function alignLayers(spec, ids, how) {
  const moving = spec.layers.filter((l) => ids.includes(l.id) && !l.locked && l.kind !== 'shade');
  if (!moving.length) return spec;
  const area = moving.length === 1
    ? { left: 0, top: 0, right: WIDTH, bottom: HEIGHT }
    : {
      left: Math.min(...moving.map((l) => l.x)), top: Math.min(...moving.map((l) => l.y)),
      right: Math.max(...moving.map((l) => l.x + l.w)), bottom: Math.max(...moving.map((l) => l.y + l.h)),
    };
  const place = {
    left: () => ({ x: area.left }),
    center: (l) => ({ x: Math.round((area.left + area.right - l.w) / 2) }),
    right: (l) => ({ x: area.right - l.w }),
    top: () => ({ y: area.top }),
    middle: (l) => ({ y: Math.round((area.top + area.bottom - l.h) / 2) }),
    bottom: (l) => ({ y: area.bottom - l.h }),
  }[how];
  if (!place) return spec;
  const ids2 = new Set(moving.map((l) => l.id));
  return { ...spec, layers: spec.layers.map((l) => (ids2.has(l.id) ? { ...l, ...place(l) } : l)) };
}

/**
 * Spreads three or more layers evenly (axis 'x' across, 'y' down): the
 * first and last stay, the ones between get equal gaps. Locked layers and
 * the shade are left out.
 */
export function distributeLayers(spec, ids, axis) {
  const [pos, size] = axis === 'y' ? ['y', 'h'] : ['x', 'w'];
  const moving = spec.layers.filter((l) => ids.includes(l.id) && !l.locked && l.kind !== 'shade')
    .sort((a, b) => (a[pos] + a[size] / 2) - (b[pos] + b[size] / 2));
  if (moving.length < 3) return spec;
  const first = moving[0];
  const last = moving[moving.length - 1];
  const used = moving.reduce((n, l) => n + l[size], 0);
  const gap = (last[pos] + last[size] - first[pos] - used) / (moving.length - 1);
  const at = new Map();
  let cursor = first[pos];
  for (const l of moving) {
    at.set(l.id, Math.round(cursor));
    cursor += l[size] + gap;
  }
  at.set(last.id, last[pos]);
  return { ...spec, layers: spec.layers.map((l) => (at.has(l.id) ? { ...l, [pos]: at.get(l.id) } : l)) };
}

/** The layers a drag box from (x0, y0) to (x1, y1) touches, front first; not the shade, the background, or hidden ones. */
export function layersInBox(spec, { x0, y0, x1, y1 }) {
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);
  return [...spec.layers].reverse()
    .filter((l) => l.visible && l.kind !== 'shade' && l.role !== 'background')
    .filter((l) => l.x < right && l.x + l.w > left && l.y < bottom && l.y + l.h > top)
    .map((l) => l.id);
}

// How a thumbnail looks where YouTube shows it (Evoni, 2026-10-21): the
// smallest place is the sidebar's "Up next", 168 wide; the video's length
// sits over the bottom right corner.
export const YOUTUBE_SIZES = [
  { key: 'search', label: 'Search, on a computer', width: 360 },
  { key: 'phone', label: 'Home, on a phone', width: 343 },
  { key: 'sidebar', label: 'Up next, beside a video', width: 168 },
];
export const SMALLEST_WIDTH = 168;
// Words smaller than this many pixels in the sidebar are hard to read.
export const READABLE_PX = 8;
// Where YouTube's timestamp ("12:34") covers the thumbnail, in canvas points.
export const TIMESTAMP_ZONE = { x: 1090, y: 630, w: 190, h: 90 };

/** The size words are drawn at, after fitting their box (as both renderers draw them); null for layers without words. */
export function drawnSize(l, measureFor) {
  const measure = measureFor(l.font);
  if (l.kind === 'text') {
    const text = l.upper ? String(l.text || '').toUpperCase() : String(l.text || '');
    if (!text.trim()) return null;
    if (l.curve) return curveLayout(text, l, measure).size;
    const pad = l.bg ? Math.round(l.size * 0.25) : 0;
    return fitText(text, { w: l.w - pad * 2, h: l.h - pad * 2, size: l.size }, spaced(measure, l.spacing || 0)).size;
  }
  if (l.kind === 'badge') {
    if (!String(l.text || '').trim()) return null;
    return fitText(String(l.text).toUpperCase(), { w: l.w * 0.8, h: l.h * 0.7, size: Math.round(l.h * 0.55) }, measure).size;
  }
  if (l.kind === 'checklist') return (l.items || []).length ? checklistRows(l, measure).size : null;
  if (l.kind === 'shape') {
    if (!(l.shape === 'burst' || l.shape === 'tag') || !String(l.text || '').trim()) return null;
    const box = shapeWordsBox(l);
    return fitText(String(l.text), { w: box.w, h: box.h, size: Math.round(box.h * 0.8) }, measure).size;
  }
  return null;
}

const QUIET_SMALL = new Set(['kicker', 'badge']);

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * What would go wrong where YouTube shows the thumbnail: words too small to
 * read in the sidebar (not the show's name or the "EP" badge, small by
 * design), and any words under the timestamp. [{ id, kind:
 * 'small' | 'timestamp', text }], front layers first.
 */
export function youtubeWarnings(spec, measureFor) {
  const out = [];
  for (const l of [...(spec?.layers || [])].reverse()) {
    if (!l.visible) continue;
    const size = drawnSize(l, measureFor);
    if (size === null) continue;
    const name = layerName(l);
    const px = Math.round((size * SMALLEST_WIDTH) / WIDTH * 10) / 10;
    // The show's name and the "EP" badge are small by design; the words that carry the thumbnail must read.
    if (px < READABLE_PX && !QUIET_SMALL.has(l.role)) {
      out.push({ id: l.id, kind: 'small', text: `${name} is about ${px} pixels tall beside a video: too small to read. Make it bigger or use fewer words.` });
    }
    if (overlaps(l, TIMESTAMP_ZONE)) {
      out.push({ id: l.id, kind: 'timestamp', text: `${name} sits under YouTube's timestamp in the bottom right corner.` });
    }
  }
  return out;
}

/** "1.4 MB" or "860 KB". */
export const fileSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

// ── Picture effects (Evoni, 2026-10-21), step for step as the server draws
// them (src/services/thumbnailLayers.js), so the editor shows the saved file. ──

/** brightness and contrast on one 0–255 value: contrast about the middle, then brightness. */
export const toneValue = (v, brightness, contrast) => Math.max(0, Math.min(255, Math.round((v - 128) * (1 + contrast) + 128 + brightness * 255)));

export const makeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

/** The picture as it is drawn: turned left to right and toned when asked; else the picture itself. */
export function adjustedPicture(img, l, make = makeCanvas) {
  if (!img || (!l.flipX && !l.brightness && !l.contrast)) return img;
  const c = make(img.width, img.height);
  const cx = c.getContext('2d');
  if (l.flipX) {
    cx.translate(img.width, 0);
    cx.scale(-1, 1);
  }
  cx.drawImage(img, 0, 0);
  if (l.brightness || l.contrast) {
    try {
      const data = cx.getImageData(0, 0, img.width, img.height);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = toneValue(d[i], l.brightness || 0, l.contrast || 0);
        d[i + 1] = toneValue(d[i + 1], l.brightness || 0, l.contrast || 0);
        d[i + 2] = toneValue(d[i + 2], l.brightness || 0, l.contrast || 0);
      }
      cx.putImageData(data, 0, 0);
    } catch (err) {
      // A picture from another address cannot be read back; the saved file still has its tone.
      console.error('[thumbnailLayers] could not tone the picture here:', err?.message || err);
    }
  }
  return c;
}

/** The server's drawFitted: a picture into a box, cover (cropped) or contain (standing on the bottom, or centred). */
export function drawFitted(ctx, img, { x, y, w, h, fit, center = false }) {
  const at = fitPicture(img.width, img.height, { w, h, fit, center });
  if (at.crop) ctx.drawImage(img, at.crop.x, at.crop.y, at.crop.width, at.crop.height, x + at.x, y + at.y, at.w, at.h);
  else ctx.drawImage(img, x + at.x, y + at.y, at.w, at.h);
}

export const STICKER_SHADOW = { color: 'rgba(0,0,0,0.45)', blur: 24, offsetY: 10 };
/** The room round the box a sticker needs for its outline and shadow. */
export const stickerMargin = (l) => Math.ceil((l.outline ? (l.outlineWidth || 12) : 0) + (l.shadow ? STICKER_SHADOW.blur + STICKER_SHADOW.offsetY : 0));
const stickerRing = (r) => [...Array(24)].map((_, i) => [Math.cos((i * Math.PI) / 12) * r, Math.sin((i * Math.PI) / 12) * r]);

/** The server's stickerCanvas: what the box shows, a sticker edge round it, a drop shadow under both. */
export function stickerCanvas(l, drawBox, make = makeCanvas) {
  const m = stickerMargin(l);
  const width = l.outlineWidth || 12;
  const box = make(l.w, l.h);
  drawBox(box.getContext('2d'));
  const sticker = make(l.w + m * 2, l.h + m * 2);
  const sx = sticker.getContext('2d');
  if (l.outline) {
    const sil = make(l.w, l.h);
    const lx = sil.getContext('2d');
    lx.drawImage(box, 0, 0);
    lx.globalCompositeOperation = 'source-in';
    lx.fillStyle = l.outline;
    lx.fillRect(0, 0, l.w, l.h);
    for (const r of [width, width / 2]) {
      for (const [dx, dy] of stickerRing(r)) sx.drawImage(sil, m + dx, m + dy);
    }
  }
  sx.drawImage(box, m, m);
  if (!l.shadow) return sticker;
  const out = make(l.w + m * 2, l.h + m * 2);
  const ox = out.getContext('2d');
  ox.shadowColor = STICKER_SHADOW.color;
  ox.shadowBlur = STICKER_SHADOW.blur;
  ox.shadowOffsetY = STICKER_SHADOW.offsetY;
  ox.drawImage(sticker, 0, 0);
  return out;
}

// ── Text effects (Evoni, 2026-10-21): a shadow or a glow, a fade to a second
// colour, words on a curve; step for step as the server draws them. ──

// A glow starts gold; a fade starts at the show's pink.
export const GLOW_COLOR = '#FFD86B';
export const FADE_COLOR = '#E0689F';
export const EFFECT_SIZE = 16;
const TEXT_SHADOW = 'rgba(0,0,0,0.6)';

/** The canvas shadow for a text effect: { color, blur, offsetY }, or null. */
export function textEffect(l) {
  const blur = l.effectSize || EFFECT_SIZE;
  if (l.effect === 'glow') return { color: l.effectColor || GLOW_COLOR, blur, offsetY: 0 };
  if (l.effect === 'shadow') return { color: TEXT_SHADOW, blur, offsetY: Math.round(blur / 3) };
  return null;
}

/** Words have an effect, a fade or a curve: drawn on their own canvas (wordsCanvas). */
export const fancyWords = (l) => Boolean((l.effect && l.effect !== 'none') || l.gradient || l.curve);

/**
 * Words on an arc (the server's curveLayout): the largest size that fits the
 * box, and each letter's middle and turn about the box's centre.
 */
export function curveLayout(text, l, plain) {
  const chars = [...String(text)];
  const theta = (Math.abs(l.curve) * Math.PI) / 180;
  const spacing = l.spacing || 0;
  const pad = l.bg ? Math.round(l.size * 0.25) : 0;
  const fits = (s) => {
    const width = chars.reduce((n, ch) => n + plain(ch, s) + spacing, 0) - spacing;
    const R = width / theta;
    const chord = 2 * R * Math.sin(theta / 2);
    const rise = R * (1 - Math.cos(theta / 2));
    return { width, R, ok: chord + s <= l.w - pad * 2 && rise + s * LINE_HEIGHT <= l.h - pad * 2 };
  };
  let size = Math.max(MIN_SIZE, l.size);
  let f = fits(size);
  while (!f.ok && size > MIN_SIZE) { size -= 2; f = fits(size); }
  const up = l.curve > 0;
  const middle = (f.R * (1 + Math.cos(theta / 2))) / 2;
  let advance = -f.width / 2;
  const glyphs = chars.map((ch) => {
    const width = plain(ch, size);
    const a = (advance + width / 2) / f.R;
    advance += width + spacing;
    return {
      ch,
      width,
      x: f.R * Math.sin(a),
      y: up ? middle - f.R * Math.cos(a) : f.R * Math.cos(a) - middle,
      rotation: ((up ? a : -a) * 180) / Math.PI,
    };
  });
  return { size, glyphs };
}

/** The room round the box words need for their outline and their shadow or glow. */
export function wordsMargin(l) {
  const effect = textEffect(l);
  return Math.ceil(l.size / 7) + 2 + (effect ? Math.ceil(effect.blur * 1.5) + effect.offsetY : 0);
}

/**
 * Sets the baseline so words stand where the server's "middle" puts them:
 * the browser's "middle" sits a few points off, so as Konva does, the words
 * stand on their baseline half the font's ascent less descent below the
 * middle. Returns that lift (0 where the font cannot be measured).
 */
function baselineLift(ctx) {
  const em = ctx.measureText('M');
  const ascent = em.fontBoundingBoxAscent ?? em.actualBoundingBoxAscent;
  const descent = em.fontBoundingBoxDescent ?? em.actualBoundingBoxDescent;
  const known = ascent != null && descent != null;
  ctx.textBaseline = known ? 'alphabetic' : 'middle';
  return known ? (ascent - descent) / 2 : 0;
}

/** The server's paintWords: the words (not the box behind them), centred on the origin. */
export function paintWords(ctx, l) {
  const text = l.upper ? String(l.text || '').toUpperCase() : String(l.text || '');
  const spacing = l.spacing || 0;
  const plain = (s, size) => { ctx.font = fontCss(l.font, size); return ctx.measureText(s).width; };
  const measure = spaced(plain, spacing);
  const pad = l.bg ? Math.round(l.size * 0.25) : 0;
  const curved = l.curve ? curveLayout(text, l, plain) : null;
  const { size, lines } = curved ? { size: curved.size, lines: [] } : fitText(text, { w: l.w - pad * 2, h: l.h - pad * 2, size: l.size }, measure);
  ctx.font = fontCss(l.font, size);
  // The browser's "middle" sits a few points off the server's; as Konva does,
  // stand the words on their baseline half the font's ascent less descent below the middle.
  const lift = baselineLift(ctx);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, Math.round(size / 7));
  const lineH = size * LINE_HEIGHT;
  const fillFor = (y) => {
    if (!l.gradient) return l.color;
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, l.color);
    g.addColorStop(1, l.gradient);
    return g;
  };
  const paint = (s, x, y) => {
    const at = y + (lift || 0);
    if (l.stroke) {
      ctx.strokeStyle = l.stroke;
      ctx.strokeText(s, x, at);
    }
    ctx.fillStyle = fillFor(y);
    ctx.fillText(s, x, at);
  };
  if (curved) {
    ctx.textAlign = 'left';
    for (const g of curved.glyphs) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate((g.rotation * Math.PI) / 180);
      paint(g.ch, -g.width / 2, 0);
      ctx.restore();
    }
    return;
  }
  let y = -((lines.length - 1) * lineH) / 2;
  for (const line of lines) {
    if (!spacing) {
      ctx.textAlign = l.align || 'left';
      paint(line, l.align === 'center' ? 0 : l.align === 'right' ? l.w / 2 - pad : -l.w / 2 + pad, y);
    } else {
      const lineW = measure(line, size) - spacing;
      let x = l.align === 'center' ? -lineW / 2 : l.align === 'right' ? l.w / 2 - pad - lineW : -l.w / 2 + pad;
      ctx.textAlign = 'left';
      for (const ch of line) {
        paint(ch, x, y);
        x += plain(ch, size) + spacing;
      }
      ctx.font = fontCss(l.font, size);
    }
    y += lineH;
  }
}

/** The server's wordsCanvas: the words, then one shadow or glow under them all; drawn at (-m, -m) in the box. */
export function wordsCanvas(l, make = makeCanvas) {
  const m = wordsMargin(l);
  const words = make(l.w + m * 2, l.h + m * 2);
  const wx = words.getContext('2d');
  wx.translate(m + l.w / 2, m + l.h / 2);
  paintWords(wx, l);
  const effect = textEffect(l);
  if (!effect) return words;
  const out = make(l.w + m * 2, l.h + m * 2);
  const ox = out.getContext('2d');
  ox.shadowColor = effect.color;
  ox.shadowBlur = effect.blur;
  ox.shadowOffsetY = effect.offsetY;
  ox.drawImage(words, 0, 0);
  return out;
}

// ── Stickers and shapes (Evoni, 2026-10-21), step for step as the server draws them. ──

const polygon = (ctx, pts) => {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
};

const sparklePoints = (l, cx, cy, r) => [...Array(8)].map((_, i) => {
  const a = (i * Math.PI) / 4 - Math.PI / 2;
  const k = i % 2 ? r * 0.28 : r;
  return [(cx + Math.cos(a) * k) * (l.w / 2), (cy + Math.sin(a) * k) * (l.h / 2)];
});

const tagParts = (l) => ({
  hole: { x: -l.w / 2 + l.h * 0.32, r: l.h * 0.09 },
  words: { x0: -l.w / 2 + l.h * 0.5, x1: l.w / 2 - l.h * 0.15 },
});

/** The server's shapePath: the shape's outline, centred on the origin. */
export function shapePath(ctx, l) {
  const { w, h } = l;
  if (l.shape === 'ring') {
    const t = l.thickness || 16;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(1, w / 2 - t / 2), Math.max(1, h / 2 - t / 2), 0, 0, Math.PI * 2);
  } else if (l.shape === 'burst') {
    polygon(ctx, [...Array(32)].map((_, i) => {
      const a = (i * Math.PI) / 16 - Math.PI / 2;
      const k = i % 2 ? 0.78 : 1;
      return [Math.cos(a) * k * (w / 2), Math.sin(a) * k * (h / 2)];
    }));
  } else if (l.shape === 'sparkle') {
    ctx.beginPath();
    for (const [cx, cy, r] of [[-0.2, 0.1, 0.8], [0.55, -0.55, 0.4], [0.6, 0.55, 0.28]]) {
      sparklePoints(l, cx, cy, r).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    }
  } else if (l.shape === 'tag') {
    const notch = -w / 2 + h * 0.45;
    polygon(ctx, [[-w / 2, 0], [notch, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [notch, h / 2]]);
  } else {
    const head = Math.min(w * 0.4, h * 0.9);
    const shaft = h * 0.36;
    polygon(ctx, [[-w / 2, -shaft / 2], [w / 2 - head, -shaft / 2], [w / 2 - head, -h / 2], [w / 2, 0],
      [w / 2 - head, h / 2], [w / 2 - head, shaft / 2], [-w / 2, shaft / 2]]);
  }
}

const outlined = (l) => Boolean(l.stroke && (l.strokeWidth ?? 6));

/** The room round the box a shape needs for its outline. */
export const shapeMargin = (l) => Math.ceil(outlined(l) ? (l.strokeWidth ?? 6) : 0) + 2;

/** The box a burst's or a tag's words fit in: { x (its middle), w, h }. */
export function shapeWordsBox(l) {
  if (l.shape === 'tag') {
    const { words } = tagParts(l);
    return { x: (words.x0 + words.x1) / 2, w: words.x1 - words.x0, h: l.h * 0.7 };
  }
  return { x: 0, w: l.w * 0.62, h: l.h * 0.5 };
}

function shapeWords(ctx, l) {
  const box = shapeWordsBox(l);
  const measure = (s, size) => { ctx.font = fontCss(l.font || 'sans', size); return ctx.measureText(s).width; };
  const { size, lines } = fitText(String(l.text), { w: box.w, h: box.h, size: Math.round(box.h * 0.8) }, measure);
  ctx.font = fontCss(l.font || 'sans', size);
  const lift = baselineLift(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = l.color || '#FFFFFF';
  const lineH = size * LINE_HEIGHT;
  lines.forEach((line, i) => ctx.fillText(line, box.x, (i - (lines.length - 1) / 2) * lineH + lift));
}

/** The server's shapeCanvas: outline under fill, the tag's hole punched through, the words; drawn at (-m, -m) in the box. */
export function shapeCanvas(l, make = makeCanvas) {
  const m = shapeMargin(l);
  const width = l.strokeWidth ?? 6;
  const c = make(l.w + m * 2, l.h + m * 2);
  const ctx = c.getContext('2d');
  ctx.translate(m + l.w / 2, m + l.h / 2);
  ctx.lineJoin = 'round';
  shapePath(ctx, l);
  if (l.shape === 'ring') {
    const t = l.thickness || 16;
    if (outlined(l)) {
      ctx.strokeStyle = l.stroke;
      ctx.lineWidth = t + width * 2;
      ctx.stroke();
    }
    ctx.strokeStyle = l.fill;
    ctx.lineWidth = t;
    ctx.stroke();
    return c;
  }
  if (outlined(l)) {
    ctx.strokeStyle = l.stroke;
    ctx.lineWidth = width * 2;
    ctx.stroke();
  }
  ctx.fillStyle = l.fill;
  ctx.fill();
  if (l.shape === 'tag') {
    const { hole } = tagParts(l);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(hole.x, 0, hole.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (outlined(l)) {
      ctx.beginPath();
      ctx.arc(hole.x, 0, hole.r, 0, Math.PI * 2);
      ctx.strokeStyle = l.stroke;
      ctx.lineWidth = Math.max(1, width / 2);
      ctx.stroke();
    }
  }
  if ((l.shape === 'burst' || l.shape === 'tag') && l.text) shapeWords(ctx, l);
  return c;
}

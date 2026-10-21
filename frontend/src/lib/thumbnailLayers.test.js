/**
 * The thumbnail as layers in the browser (Evoni, 2026-10-21): the layouts
 * as starting arrangements, a show's template filled with an episode's
 * words and pictures, the controls' changes, the layers list's moves, a
 * moved or turned layer's new box, and text fitting (the server's rule).
 */
import { describe, test, expect } from 'vitest';
import {
  toneValue, stickerMargin, STICKER_SHADOW, clearWhiteEdges,
  textEffect, fancyWords, curveLayout, wordsMargin, paintWords, wordsCanvas, GLOW_COLOR, EFFECT_SIZE,
  SHAPES, addShape, shapeCanvas, shapeMargin, shapeWordsBox,
  spaced, alignLayers, distributeLayers, layersInBox, youtubeWarnings, drawnSize, fileSize, TIMESTAMP_ZONE,
  READABLE_SIZE, readablePatch, clearOfTimestamp, fixWarning, fixAllWarnings, finerCanvas, drawRes, WIDTH, HEIGHT,
  presetLayers, fillTemplate, applyStyle, setRoleContent, layerOf, updateLayer, moveLayer, removeLayer, addText, addPicture, addPieceCard,
  boxFromNode, fitText, fitPicture, layerName, LINE_HEIGHT, checklistRows, duplicateLayer, snapBox, SNAP, copyLayers, pasteLayers,
} from './thumbnailLayers';

const CONTENT = {
  title: 'I Designed My Outfit', kicker: 'Styling Adventures', badge: 'EP 1',
  backgroundUrl: 'https://b.s3.amazonaws.com/bg.jpg', lalaUrl: 'https://b.s3.amazonaws.com/lala.png', jawUrl: null,
};
const STYLE = { accent: '#B8962E', textColor: '#FDF4E3', dim: 0.3 };
const roles = (spec) => spec.layers.map((l) => l.role);

describe('presetLayers', () => {
  test('Lala left: background, shade, Lala, show name, title, badge; Lala on the left, the words on the right, the badge top right', () => {
    const spec = presetLayers('lala-left', CONTENT, STYLE);
    expect(spec.version).toBe(2);
    expect(roles(spec)).toEqual(['background', 'shade', 'lala', 'kicker', 'title', 'badge']);
    expect(layerOf(spec, 'lala')).toMatchObject({ x: 30, w: 560, src: CONTENT.lalaUrl, fit: 'contain' });
    expect(layerOf(spec, 'title')).toMatchObject({ x: 590, text: 'I Designed My Outfit', color: '#FDF4E3', align: 'left' });
    expect(layerOf(spec, 'shade')).toMatchObject({ side: 'left', dim: 0.3, accent: '#B8962E' });
    expect(layerOf(spec, 'badge')).toMatchObject({ x: 1054, fill: '#B8962E', text: 'EP 1' });
    expect(layerOf(spec, 'kicker')).toMatchObject({ color: '#B8962E', upper: true });
  });

  test('Lala right mirrors it; Title only has no figures and centres the words; with JustAWoman the two stand together', () => {
    const right = presetLayers('lala-right', CONTENT, STYLE);
    expect(layerOf(right, 'lala').x).toBe(1280 - 30 - 560);
    expect(layerOf(right, 'title').x).toBe(70);
    expect(layerOf(right, 'badge').x).toBe(56);
    const center = presetLayers('center', CONTENT, STYLE);
    expect(roles(center)).toEqual(['background', 'shade', 'kicker', 'title', 'badge']);
    expect(layerOf(center, 'title')).toMatchObject({ x: 110, w: 1060, align: 'center' });
    const duo = presetLayers('lala-left', { ...CONTENT, jawUrl: 'https://b.s3.amazonaws.com/jaw.jpg' }, STYLE);
    expect(roles(duo)).toEqual(['background', 'shade', 'jaw', 'lala', 'kicker', 'title', 'badge']);
    expect(layerOf(duo, 'jaw')).toMatchObject({ x: 20, w: 340 });
    expect(layerOf(duo, 'lala')).toMatchObject({ x: 210, w: 360 });
    // No badge words, no badge.
    expect(roles(presetLayers('lala-left', { ...CONTENT, badge: '' }, STYLE))).not.toContain('badge');
  });
});

describe('fillTemplate', () => {
  test('every role keeps its place and turn and takes the episode\'s words and pictures; other layers stay; a figure with no picture goes', () => {
    const template = presetLayers('lala-left', { ...CONTENT, jawUrl: 'https://b.s3.amazonaws.com/jaw-old.jpg' }, STYLE);
    const turned = updateLayer(addText(template, 'Come Style Me'), 'title', { x: 77, rotation: -8 });
    const filled = fillTemplate(turned, { title: 'Episode Two', kicker: 'S', badge: 'EP 2', backgroundUrl: 'https://b.s3.amazonaws.com/bg2.jpg', lalaUrl: 'https://b.s3.amazonaws.com/l2.png', jawUrl: null });
    expect(layerOf(filled, 'title')).toMatchObject({ text: 'Episode Two', x: 77, rotation: -8 });
    expect(layerOf(filled, 'background').src).toBe('https://b.s3.amazonaws.com/bg2.jpg');
    expect(layerOf(filled, 'lala').src).toBe('https://b.s3.amazonaws.com/l2.png');
    expect(layerOf(filled, 'jaw')).toBeNull();
    expect(filled.layers.find((l) => l.id === 'text-1').text).toBe('Come Style Me');
    expect(fillTemplate(null)).toEqual({ version: 2, layers: [] });
  });
});

describe('the controls and the layers list', () => {
  test('setRoleContent: words and pictures; a figure that is not there yet is added below the words; a badge is added', () => {
    let spec = presetLayers('center', { ...CONTENT, badge: '' }, STYLE);
    spec = setRoleContent(spec, 'title', 'New title');
    expect(layerOf(spec, 'title').text).toBe('New title');
    spec = setRoleContent(spec, 'lala', 'https://b.s3.amazonaws.com/l.png', 'center');
    expect(roles(spec)).toEqual(['background', 'shade', 'lala', 'kicker', 'title']);
    expect(layerOf(spec, 'lala')).toMatchObject({ x: 30, w: 560 });
    spec = setRoleContent(spec, 'badge', 'EP 9');
    expect(layerOf(spec, 'badge')).toMatchObject({ text: 'EP 9', fill: '#B8962E' });
    expect(setRoleContent(spec, 'jaw', null)).toBe(spec);
    spec = setRoleContent(spec, 'background', null);
    expect(layerOf(spec, 'background').src).toBeNull();
  });

  test('applyStyle: the accent goes to the shade, the badge and the show name; the title colour; the dim', () => {
    const spec = applyStyle(presetLayers('lala-left', CONTENT, STYLE), { accent: '#A46EE0', textColor: '#FFFFFF', dim: 0.5 });
    expect(layerOf(spec, 'shade')).toMatchObject({ accent: '#A46EE0', dim: 0.5 });
    expect(layerOf(spec, 'badge').fill).toBe('#A46EE0');
    expect(layerOf(spec, 'kicker').color).toBe('#A46EE0');
    expect(layerOf(spec, 'title').color).toBe('#FFFFFF');
  });

  test('move up and down, remove, add words and pictures with their own ids, and each layer\'s name', () => {
    let spec = presetLayers('lala-left', CONTENT, STYLE);
    spec = moveLayer(spec, 'lala', 'up');
    expect(roles(spec).slice(2, 4)).toEqual(['kicker', 'lala']);
    expect(moveLayer(spec, 'background', 'down')).toBe(spec);
    spec = removeLayer(spec, 'kicker');
    expect(roles(spec)).not.toContain('kicker');
    spec = addPicture(addPicture(spec, 'https://b.s3.amazonaws.com/d.png', 'Sweater dress'), 'https://b.s3.amazonaws.com/b.png');
    expect(spec.layers.slice(-2).map((l) => l.id)).toEqual(['picture-1', 'picture-2']);
    expect(layerName(spec.layers.at(-2))).toBe('Sweater dress');
    expect(layerName(spec.layers.at(-1))).toBe('Picture');
    expect(layerName(layerOf(spec, 'title'))).toBe('Title');
    expect(layerName(addText(spec, 'Come Style Me').layers.at(-1))).toBe('Come Style Me');
  });
});

describe('boxFromNode', () => {
  test('a dragged layer: its centre gives its box; a resized one folds the scale into its size; the turn stays in -180..180', () => {
    const layer = { x: 100, y: 100, w: 200, h: 100 };
    expect(boxFromNode({ x: 400, y: 300 }, layer)).toEqual({ x: 300, y: 250, w: 200, h: 100, rotation: 0 });
    expect(boxFromNode({ x: 200, y: 150, scaleX: 1.5, scaleY: 0.5, rotation: 270 }, layer)).toEqual({ x: 50, y: 125, w: 300, h: 50, rotation: -90 });
    expect(boxFromNode({ x: 0, y: 0, scaleX: 0.01 }, layer).w).toBe(10);
  });
});

describe('fitText and fitPicture (as the server draws)', () => {
  const measure = (s, size) => s.length * size * 0.5;
  test('the server\'s fitting: the largest size whose lines fit the box', () => {
    expect(fitText('Come Style Me', { w: 400, h: 200, size: 80 }, measure)).toEqual({ size: 80, lines: ['Come Style', 'Me'] });
    const small = fitText('I Designed My Outfit for a Fashion Studio Experiment', { w: 600, h: 120, size: 90 }, measure);
    expect(small.lines.length * small.size * LINE_HEIGHT).toBeLessThanOrEqual(120);
  });
  test('cover fills the box, cropped from the centre; contain stands on the bottom, centred across', () => {
    expect(fitPicture(1600, 900, { w: 1280, h: 720, fit: 'cover' })).toEqual({ crop: { x: 0, y: 0, width: 1600, height: 900 }, x: 0, y: 0, w: 1280, h: 720 });
    expect(fitPicture(1000, 1000, { w: 1280, h: 720, fit: 'cover' }).crop).toEqual({ x: 0, y: 218.75, width: 1000, height: 562.5 });
    expect(fitPicture(300, 600, { w: 600, h: 600, fit: 'contain' })).toEqual({ crop: null, x: 150, y: 0, w: 300, h: 600 });
    expect(fitPicture(600, 300, { w: 600, h: 600, fit: 'contain' })).toEqual({ crop: null, x: 0, y: 300, w: 600, h: 300 });
    // On a photo card the product sits in the middle.
    expect(fitPicture(600, 300, { w: 600, h: 600, fit: 'contain', center: true })).toEqual({ crop: null, x: 0, y: 150, w: 600, h: 300 });
  });
});

describe('Come Style Me (Evoni, 2026-10-21)', () => {
  const ALL = {
    ...CONTENT,
    outfitUrl: 'https://b.s3.amazonaws.com/back.png',
    checklist: ['Sweater dress', 'Accessories', 'Hair', 'Vibe'].map((text) => ({ text, checked: true })),
    edition: 'Sweater Dress Edition',
    pieces: [1, 2, 3, 4, 5].map((n) => ({ url: `https://b.s3.amazonaws.com/p${n}.png`, label: `Piece ${n}` })),
    logoUrl: 'https://b.s3.amazonaws.com/logo.png',
  };

  test('every layer: the scene set, the outfit behind Lala, four photo cards, the checklist, the headline, the show\'s name, the edition, the ribbon, the logo', () => {
    const spec = presetLayers('come-style-me', ALL, STYLE);
    expect(roles(spec)).toEqual(['background', 'shade', 'outfit', 'lala', 'piece-1', 'piece-2', 'piece-3', 'piece-4', 'checklist', 'headline', 'kicker', 'edition', 'badge', 'logo']);
    expect(layerOf(spec, 'piece-1')).toMatchObject({ frame: 'polaroid', name: 'Piece 1', rotation: -4 });
    expect(layerOf(spec, 'piece-2').rotation).toBe(4);
    expect(layerOf(spec, 'checklist')).toMatchObject({ kind: 'checklist', font: 'hand', items: ALL.checklist });
    expect(layerOf(spec, 'headline')).toMatchObject({ text: 'Come Style Me', font: 'script', rotation: -6 });
    expect(layerOf(spec, 'badge').text).toBe('EPISODE 1');
    expect(layerOf(spec, 'edition')).toMatchObject({ text: 'Sweater Dress Edition', bg: '#F4ECDD', upper: true });
  });

  test('only the core when the episode has nothing else: scene set, Lala, checklist, headline (and the show\'s name)', () => {
    const spec = presetLayers('come-style-me', { kicker: 'Styling Adventures', backgroundUrl: CONTENT.backgroundUrl, lalaUrl: CONTENT.lalaUrl, checklist: ALL.checklist }, STYLE);
    expect(roles(spec)).toEqual(['background', 'shade', 'lala', 'checklist', 'headline', 'kicker']);
  });

  test('its template fills each episode: the episode\'s pieces, edition, checklist and ribbon; a piece or edition it has none for goes; the headline stays', () => {
    const template = updateLayer(presetLayers('come-style-me', ALL, STYLE), 'headline', { text: 'Style Me Again', x: 600 });
    const next = fillTemplate(template, {
      ...CONTENT, badge: 'EP 2', checklist: [{ text: 'Gown', checked: false }], edition: null,
      pieces: [{ url: 'https://b.s3.amazonaws.com/q1.png', label: 'Clutch' }], outfitUrl: null, logoUrl: null,
    });
    expect(roles(next)).toEqual(['background', 'shade', 'lala', 'piece-1', 'checklist', 'headline', 'kicker', 'badge']);
    expect(layerOf(next, 'piece-1')).toMatchObject({ src: 'https://b.s3.amazonaws.com/q1.png', name: 'Clutch', frame: 'polaroid' });
    expect(layerOf(next, 'checklist').items).toEqual([{ text: 'Gown', checked: false }]);
    expect(layerOf(next, 'headline')).toMatchObject({ text: 'Style Me Again', x: 600 });
    expect(layerOf(next, 'badge').text).toBe('EPISODE 2');
  });

  test('the checklist\'s rows: one words size for all, the box beside them', () => {
    const measure = (s, size) => s.length * size * 0.5;
    const rows = checklistRows({ w: 300, h: 200, items: [{ text: 'Sweater dress' }, { text: 'Hair' }] }, measure);
    expect(rows).toMatchObject({ rowH: 100, box: 60, textX: 90 });
    expect('Sweater dress'.length * rows.size * 0.5).toBeLessThanOrEqual(210);
  });
});

describe('editor tools (Evoni, 2026-10-21)', () => {
  test('duplicateLayer: a copy just above, moved a little, with no role and unlocked; the original keeps its role', () => {
    const spec = updateLayer(presetLayers('lala-left', CONTENT, STYLE), 'lala', { locked: true });
    const next = duplicateLayer(duplicateLayer(spec, 'lala'), 'lala');
    const i = next.layers.findIndex((l) => l.id === 'lala');
    expect(next.layers[i + 1]).toMatchObject({ id: 'lala-copy-2', role: null, name: 'Lala copy', locked: false, x: 54, y: 54, src: CONTENT.lalaUrl });
    expect(next.layers[i + 2].id).toBe('lala-copy-1');
    expect(layerOf(next, 'lala').locked).toBe(true);
    expect(duplicateLayer(spec, 'nope')).toBe(spec);
  });

  test('snapBox: an edge or centre within reach snaps to the canvas or another layer, and says where the guide goes', () => {
    // The centre 5 from the canvas's middle: snaps there.
    expect(snapBox({ cx: 645, cy: 200, w: 100, h: 100 })).toEqual({ cx: 640, cy: 200, guides: [{ x: 640 }] });
    // Its left edge 3 from another layer's right edge (x 400 + w 200 = 600); its top on the canvas's top.
    expect(snapBox({ cx: 653, cy: 52, w: 100, h: 100 }, [{ x: 400, y: 300, w: 200, h: 100 }])).toEqual({ cx: 650, cy: 50, guides: [{ x: 600 }, { y: 0 }] });
    // Nothing within reach: stays.
    expect(snapBox({ cx: 300, cy: 200, w: 100, h: 100 })).toEqual({ cx: 300, cy: 200, guides: [] });
    expect(SNAP).toBe(8);
  });
});

describe('spaced (the server\'s spaced)', () => {
  test('each letter, then the spacing after it; no spacing is the plain measure', () => {
    const measure = (s, size) => String(s).length * size;
    expect(spaced(measure, 0)).toBe(measure);
    expect(spaced(measure, 5)('abc', 10)).toBe(3 * 10 + 3 * 5);
    expect(spaced(measure, -2)('ab', 10)).toBe(2 * 10 - 2 * 2);
  });
});

describe('arranging (Evoni, 2026-10-21)', () => {
  const box = (id, x, y, w, h, more = {}) => ({ id, kind: 'text', visible: true, x, y, w, h, ...more });
  const spec = { version: 2, layers: [
    { id: 'shade', kind: 'shade', role: 'shade', visible: true, x: 0, y: 0, w: 1280, h: 720 },
    box('a', 100, 50, 200, 100), box('b', 500, 300, 100, 50), box('c', 900, 600, 300, 80), box('lock', 10, 10, 50, 50, { locked: true }),
  ] };
  const at = (s, id) => s.layers.find((l) => l.id === id);

  test('one layer lines up with the canvas', () => {
    expect(at(alignLayers(spec, ['a'], 'center'), 'a').x).toBe(540);
    expect(at(alignLayers(spec, ['a'], 'right'), 'a').x).toBe(1080);
    expect(at(alignLayers(spec, ['a'], 'bottom'), 'a').y).toBe(620);
    expect(at(alignLayers(spec, ['a'], 'middle'), 'a').y).toBe(310);
  });

  test('several line up with the box round them; locked ones and the shade stay', () => {
    const left = alignLayers(spec, ['a', 'b', 'c', 'lock', 'shade'], 'left');
    expect(['a', 'b', 'c'].map((id) => at(left, id).x)).toEqual([100, 100, 100]);
    expect(at(left, 'lock').x).toBe(10);
    const top = alignLayers(spec, ['a', 'b'], 'top');
    expect([at(top, 'a').y, at(top, 'b').y]).toEqual([50, 50]);
    const centre = alignLayers(spec, ['a', 'b'], 'center');
    expect([at(centre, 'a').x + 100, at(centre, 'b').x + 50]).toEqual([350, 350]);
    expect(alignLayers(spec, ['lock'], 'left')).toBe(spec);
  });

  test('spread: the first and last stay, equal gaps between', () => {
    const across = distributeLayers(spec, ['c', 'a', 'b'], 'x');
    expect(at(across, 'a').x).toBe(100);
    expect(at(across, 'c').x).toBe(900);
    // gaps: (1200 - 100 - 600) / 2 = 250 → b at 100 + 200 + 250
    expect(at(across, 'b').x).toBe(550);
    expect(distributeLayers(spec, ['a', 'b'], 'x')).toBe(spec);
    // down: (680 - 50 - 230) / 2 = 200 → b at 50 + 100 + 200
    const down = distributeLayers(spec, ['a', 'b', 'c'], 'y');
    expect([at(down, 'a').y, at(down, 'b').y, at(down, 'c').y]).toEqual([50, 350, 600]);
  });

  test('a drag box picks what it touches, front first; not the shade, the background or hidden layers', () => {
    const withBg = { ...spec, layers: [{ id: 'bg', kind: 'image', role: 'background', visible: true, x: 0, y: 0, w: 1280, h: 720 }, ...spec.layers, box('hid', 120, 60, 10, 10, { visible: false })] };
    expect(layersInBox(withBg, { x0: 0, y0: 0, x1: 600, y1: 400 })).toEqual(['lock', 'b', 'a']);
    expect(layersInBox(withBg, { x0: 700, y0: 0, x1: 650, y1: 10 })).toEqual([]);
  });
});

describe('where YouTube shows it (Evoni, 2026-10-21)', () => {
  // 0.5 points per letter per point of size: easy sums.
  const measureFor = () => (s, size) => String(s).length * size * 0.5;
  const words = (id, text, more = {}) => ({ id, kind: 'text', role: null, name: id, visible: true, text, size: 120, font: 'sans', x: 100, y: 100, w: 600, h: 200, ...more });

  test('drawnSize: the size words are drawn at after fitting their box', () => {
    expect(drawnSize(words('t', 'Glam'), measureFor)).toBe(120);
    // 40 letters at 120 would be 2400 wide: made smaller until they fit 600 x 200.
    expect(drawnSize(words('t', 'x'.repeat(40)), measureFor)).toBeLessThan(40);
    expect(drawnSize({ id: 'p', kind: 'image', visible: true }, measureFor)).toBeNull();
    expect(drawnSize(words('t', '   '), measureFor)).toBeNull();
  });

  test('words too small to read beside a video, and words under the timestamp', () => {
    const spec = { version: 2, layers: [
      words('big', 'Glam'),
      words('tiny', 'x'.repeat(200), { name: 'Fine print' }),
      words('corner', 'EP 1', { x: TIMESTAMP_ZONE.x - 20, y: TIMESTAMP_ZONE.y + 10, w: 150, h: 90, name: 'Corner' }),
      words('hidden', 'x'.repeat(200), { visible: false }),
    ] };
    const out = youtubeWarnings(spec, measureFor);
    expect(out.map((w) => [w.id, w.kind])).toEqual([['corner', 'timestamp'], ['tiny', 'small']]);
    expect(out[1].text).toMatch(/^Fine print is about [\d.]+ pixels tall beside a video/);
    // The show's name and the badge are small by design: only the timestamp counts for them.
    const quiet = { version: 2, layers: [words('k', 'x'.repeat(200), { role: 'kicker' }), words('b', 'EP 1', { role: 'badge', ...TIMESTAMP_ZONE })] };
    expect(youtubeWarnings(quiet, measureFor).map((w) => [w.id, w.kind])).toEqual([['b', 'timestamp']]);
  });

  // Fixing the warnings (Evoni, 2026-10-21).
  test('READABLE_SIZE: 8 pixels in the 168-wide sidebar is 61 points on the 1280 canvas', () => {
    expect(READABLE_SIZE).toBe(61);
  });

  test('readablePatch: grows the box and the words about its centre just enough; {} when they read; null when they cannot', () => {
    const edition = words('edition', 'I DESIGNED MY OUTFIT', { size: 28, x: 660, y: 540, w: 400, h: 58 });
    expect(drawnSize(edition, measureFor)).toBe(28);
    const patch = readablePatch(edition, measureFor);
    const after = { ...edition, ...patch };
    expect(drawnSize(after, measureFor)).toBeGreaterThanOrEqual(READABLE_SIZE);
    expect(drawnSize(after, measureFor)).toBeLessThan(READABLE_SIZE + 6); // just enough
    // Centred where it was, but kept on the canvas: here the right edge holds it in.
    expect(after.x + after.w).toBe(WIDTH);
    expect(Math.abs(after.y + after.h / 2 - 569)).toBeLessThanOrEqual(1);
    expect(after.x).toBeGreaterThanOrEqual(0);
    expect(readablePatch(words('big', 'Glam'), measureFor)).toEqual({});
    expect(readablePatch(words('long', 'x'.repeat(200)), measureFor)).toBeNull();
  });

  test('clearOfTimestamp: up or left, the shorter move; null when neither fits', () => {
    const corner = { x: 1070, y: 640, w: 150, h: 90 };
    expect(clearOfTimestamp(corner)).toEqual({ y: TIMESTAMP_ZONE.y - 8 - 90 });
    // Too tall to sit above the timestamp: it moves left.
    expect(clearOfTimestamp({ x: 1000, y: 10, w: 200, h: 700 })).toEqual({ x: TIMESTAMP_ZONE.x - 8 - 200 });
    expect(clearOfTimestamp({ x: 0, y: 0, w: WIDTH, h: HEIGHT })).toBeNull();
  });

  test('fix one, fix all; small on purpose is not warned about; a locked layer is left as it is', () => {
    const spec = { version: 2, layers: [
      words('edition', 'I DESIGNED MY OUTFIT', { name: 'Edition label', size: 28, x: 660, y: 540, w: 400, h: 58 }),
      words('long', 'x'.repeat(200), { name: 'Fine print' }),
      words('corner', 'EP 1', { x: 1070, y: 640, w: 150, h: 90, name: 'Corner' }),
    ] };
    const small = youtubeWarnings(spec, measureFor).find((w) => w.id === 'edition');
    const one = fixWarning(spec, small, measureFor);
    expect(youtubeWarnings(one, measureFor).some((w) => w.id === 'edition' && w.kind === 'small')).toBe(false);
    expect(fixWarning(spec, { ...small, id: 'long' }, measureFor)).toBeNull();
    expect(fixWarning(updateLayer(spec, 'edition', { locked: true }), small, measureFor)).toBeNull();
    const { spec: all, left } = fixAllWarnings(spec, measureFor);
    // Grown into the corner, the label is then moved clear of the timestamp too.
    expect(left.map((w) => [w.id, w.kind])).toEqual([['long', 'small']]);
    const label = all.layers.find((l) => l.id === 'edition');
    expect(label.y + label.h).toBeLessThanOrEqual(TIMESTAMP_ZONE.y - 8);
    expect(layerOf({ layers: all.layers.map((l) => ({ ...l, role: l.id })) }, 'corner').y).toBe(TIMESTAMP_ZONE.y - 8 - 90);
    const quiet = updateLayer(spec, 'long', { smallOk: true });
    expect(youtubeWarnings(quiet, measureFor).map((w) => w.id)).not.toContain('long');
  });

  test('fileSize', () => {
    expect(fileSize(1.4 * 1024 * 1024)).toBe('1.4 MB');
    expect(fileSize(860 * 1024)).toBe('860 KB');
    expect(fileSize(10)).toBe('1 KB');
  });
});

describe('picture effects (the server\'s, Evoni 2026-10-21)', () => {
  test('toneValue: the same numbers as the server', () => {
    expect(toneValue(128, 0, 0.5)).toBe(128);
    expect(toneValue(200, 0, 0.5)).toBe(236);
    expect(toneValue(100, 0.1, 0)).toBe(126);
    expect(toneValue(250, 0.5, 0)).toBe(255);
    expect(toneValue(5, -0.5, 0)).toBe(0);
  });

  test('stickerMargin: room for the edge and the shadow', () => {
    expect(stickerMargin({})).toBe(0);
    expect(stickerMargin({ outline: '#FFFFFF', outlineWidth: 12 })).toBe(12);
    expect(stickerMargin({ shadow: true })).toBe(STICKER_SHADOW.blur + STICKER_SHADOW.offsetY);
    expect(stickerMargin({ outline: '#FFFFFF', outlineWidth: 20, shadow: true })).toBe(54);
  });
});

describe('text effects (the server\'s, Evoni 2026-10-21)', () => {
  test('textEffect: a glow in its colour, a shadow below the words, defaults for a layer that has none', () => {
    expect(textEffect({})).toBeNull();
    expect(textEffect({ effect: 'none' })).toBeNull();
    expect(textEffect({ effect: 'glow' })).toEqual({ color: GLOW_COLOR, blur: EFFECT_SIZE, offsetY: 0 });
    expect(textEffect({ effect: 'glow', effectColor: '#FF0000', effectSize: 30 })).toEqual({ color: '#FF0000', blur: 30, offsetY: 0 });
    expect(textEffect({ effect: 'shadow', effectSize: 18 })).toEqual({ color: 'rgba(0,0,0,0.6)', blur: 18, offsetY: 6 });
  });

  test('fancyWords and wordsMargin: room for the outline, plus the effect', () => {
    expect(fancyWords({ text: 'x' })).toBe(false);
    expect(fancyWords({ effect: 'shadow' })).toBe(true);
    expect(fancyWords({ gradient: '#000000' })).toBe(true);
    expect(fancyWords({ curve: -20 })).toBe(true);
    expect(wordsMargin({ size: 70 })).toBe(12);
    expect(wordsMargin({ size: 70, effect: 'shadow', effectSize: 18 })).toBe(12 + 27 + 6);
  });

  test('curveLayout: the same layout as the server', () => {
    const plain = (s, size) => String(s).length * size * 0.5;
    const l = { curve: 90, size: 100, w: 600, h: 300, spacing: 0, bg: null };
    const up = curveLayout('ABCDE', l, plain);
    expect(up.size).toBe(100);
    expect(up.glyphs[2].x).toBeCloseTo(0, 6);
    expect(up.glyphs[0].x).toBeCloseTo(-up.glyphs[4].x, 6);
    expect(up.glyphs[2].y).toBeLessThan(up.glyphs[0].y);
    expect(up.glyphs[0].rotation).toBeLessThan(0);
    const down = curveLayout('ABCDE', { ...l, curve: -90 }, plain);
    expect(down.glyphs[2].y).toBeGreaterThan(down.glyphs[0].y);
    expect(curveLayout('ABCDEFGHIJKLMNOP', l, plain).size).toBeLessThan(100);
  });

  test('drawnSize: curved words are sized as the curve fits them', () => {
    const measureFor = () => (s, size) => String(s).length * size * 0.5;
    const l = { kind: 'text', text: 'ABCDEFGHIJKLMNOP', size: 100, w: 600, h: 300, curve: 90 };
    expect(drawnSize(l, measureFor)).toBe(curveLayout(l.text, l, measureFor()).size);
  });

  /** A 2D context that writes down what is drawn. */
  const recorder = () => {
    const calls = [];
    const ctx = {
      calls,
      measureText: (s) => ({ width: String(s).length * 10 }),
      createLinearGradient: (...a) => { const g = { a, stops: [], addColorStop: (o, c) => g.stops.push([o, c]) }; calls.push(['gradient', g]); return g; },
      fillText: (s, x, y) => calls.push(['fill', s, x, y, ctx.fillStyle]),
      strokeText: (s) => calls.push(['stroke', s]),
      translate: (x, y) => calls.push(['translate', x, y]),
      rotate: (r) => calls.push(['rotate', r]),
      save: () => {}, restore: () => {},
      drawImage: (img) => calls.push(['image', img, ctx.shadowColor, ctx.shadowBlur, ctx.shadowOffsetY]),
    };
    return ctx;
  };

  test('paintWords: a fade from the colour to the second one down the line; a curve draws letter by letter, each turned', () => {
    const ctx = recorder();
    paintWords(ctx, { kind: 'text', text: 'Hi', font: 'sans', size: 40, w: 400, h: 100, align: 'center', color: '#FFFFFF', gradient: '#0000FF' });
    const [, g] = ctx.calls.find((c) => c[0] === 'gradient');
    expect(g.stops).toEqual([[0, '#FFFFFF'], [1, '#0000FF']]);
    expect(g.a[1]).toBeLessThan(g.a[3]); // top to bottom
    expect(ctx.calls.find((c) => c[0] === 'fill')[4]).toBe(g);
    const arc = recorder();
    paintWords(arc, { kind: 'text', text: 'ABC', font: 'sans', size: 40, w: 400, h: 200, color: '#FFFFFF', stroke: '#000000', curve: 60 });
    expect(arc.calls.filter((c) => c[0] === 'fill').map((c) => c[1])).toEqual(['A', 'B', 'C']);
    expect(arc.calls.filter((c) => c[0] === 'stroke').length).toBe(3);
    expect(arc.calls.filter((c) => c[0] === 'rotate').length).toBe(3);
  });

  test('wordsCanvas: the words, then one shadow or glow under them all', () => {
    const made = [];
    const make = (w, h) => { const c = { w, h, ctx: recorder() }; c.getContext = () => c.ctx; made.push(c); return c; };
    const l = { kind: 'text', text: 'Hi', font: 'sans', size: 70, w: 400, h: 100, color: '#FFFFFF', effect: 'glow', effectColor: '#FF0000', effectSize: 20 };
    const out = wordsCanvas(l, make);
    const m = wordsMargin(l);
    expect(made.map((c) => [c.w, c.h])).toEqual([[400 + m * 2, 100 + m * 2], [400 + m * 2, 100 + m * 2]]);
    expect(made[0].ctx.calls[0]).toEqual(['translate', m + 200, m + 50]);
    expect(out.ctx.calls).toEqual([['image', made[0], '#FF0000', 20, 0]]);
    const plain = wordsCanvas({ ...l, effect: 'none', curve: 30 }, make);
    expect(plain).toBe(made[2]);
  });
});

describe('finer canvases (Evoni, 2026-10-21: adjusted pictures must not lose quality)', () => {
  test('drawRes: the screen\'s pixels a point, 1 to 3, in halves', () => {
    expect(drawRes(0.64, 2)).toBe(1.5);
    expect(drawRes(0.64 * 3, 2)).toBe(3);
    expect(drawRes(0.3, 1)).toBe(1);
  });

  test('finerCanvas: res pixels a point, its res kept', () => {
    const c = finerCanvas(2.5)(100, 40);
    expect([c.width, c.height, c.res]).toEqual([250, 100, 2.5]);
  });

  test('a shadow or glow on a finer canvas is measured in its pixels; canvases are drawn at their size in points', () => {
    const made = [];
    const make = (w, h) => {
      const calls = [];
      const ctx = {
        calls, measureText: (s) => ({ width: String(s).length * 10 }), translate: () => {}, rotate: () => {}, save: () => {}, restore: () => {},
        fillText: () => {}, strokeText: () => {}, createLinearGradient: () => ({ addColorStop: () => {} }),
        drawImage: (...a) => calls.push(['image', a.slice(1), ctx.shadowBlur, ctx.shadowOffsetY]),
      };
      const c = { w, h, res: 2, getContext: () => ctx };
      made.push(c);
      return c;
    };
    const l = { kind: 'text', text: 'Hi', font: 'sans', size: 70, w: 400, h: 100, color: '#FFFFFF', effect: 'shadow', effectSize: 18 };
    const out = wordsCanvas(l, make);
    const m = wordsMargin(l);
    expect(out.getContext().calls).toEqual([['image', [0, 0, 400 + m * 2, 100 + m * 2], 36, 12]]);
  });
});

describe('addPieceCard (Evoni, 2026-10-21: an added outfit piece comes in on its card)', () => {
  test('like the pieces already there: their size, fit and card look; else 172 square; in the middle, on top', () => {
    const bare = addPieceCard({ version: 2, layers: [] }, 'https://b.s3.amazonaws.com/top.png', 'Silk top');
    expect(bare.layers[0]).toMatchObject({ id: 'piece-1', kind: 'image', frame: 'polaroid', fit: 'contain', w: 172, h: 172, x: 554, y: 274, name: 'Silk top' });
    const spec = { version: 2, layers: [
      { id: 'piece-1', role: 'piece-1', kind: 'image', frame: 'polaroid', fit: 'cover', w: 200, h: 180, cardColor: '#E6C98F', clearWhite: true },
    ] };
    const added = addPieceCard(spec, 'https://b.s3.amazonaws.com/skirt.png', 'Skirt').layers.at(-1);
    expect(added).toMatchObject({ id: 'piece-2', role: null, w: 200, h: 180, fit: 'cover', cardColor: '#E6C98F', clearWhite: true, src: 'https://b.s3.amazonaws.com/skirt.png' });
  });
});

describe('clearWhiteEdges (the server\'s, Evoni 2026-10-21: colour behind the wardrobe pieces)', () => {
  /** w×h RGBA pixels from rows of 'W' (white), 'R' (red), 'n' (near white, 220). */
  const pixels = (rows) => {
    const d = new Uint8ClampedArray(rows.length * rows[0].length * 4);
    rows.join('').split('').forEach((c, p) => {
      const [r, g, b] = c === 'W' ? [255, 255, 255] : c === 'n' ? [220, 220, 220] : [255, 0, 0];
      d.set([r, g, b, 255], p * 4);
    });
    return d;
  };
  const alphas = (d, w) => [...Array(d.length / 4)].map((_, p) => d[p * 4 + 3]).reduce((rows, a, p) => {
    if (p % w === 0) rows.push([]);
    rows.at(-1).push(a);
    return rows;
  }, []);

  test('the white joined to the edges is cleared; white inside the piece stays; a near-white fringe is part see-through', () => {
    const d = pixels([
      'WWWWWW',
      'WnRRRW',
      'WRWWRW',
      'WRRRRW',
      'WWWWWW',
    ]);
    clearWhiteEdges(d, 6, 5);
    expect(alphas(d, 6)).toEqual([
      [0, 0, 0, 0, 0, 0],
      [0, 109, 255, 255, 255, 0], // 220 is near white: 255 × (235 − 220) / (235 − 200)
      [0, 255, 255, 255, 255, 0],
      [0, 255, 255, 255, 255, 0],
      [0, 0, 0, 0, 0, 0],
    ]);
  });
});

describe('stickers and shapes (the server\'s, Evoni 2026-10-21)', () => {
  const empty = { version: 2, layers: [] };

  test('addShape: in the middle, on top, picked as its kind with its starting look; names read well', () => {
    const one = addShape(empty, 'burst');
    const [b] = one.layers;
    expect(b).toMatchObject({ id: 'burst-1', kind: 'shape', shape: 'burst', w: 260, h: 260, x: 510, y: 230, text: 'NEW', visible: true });
    expect(layerName(b)).toBe('Burst: NEW');
    expect(addShape(one, 'burst').layers[1].id).toBe('burst-2');
    expect(layerName(addShape(empty, 'ring').layers[0])).toBe('Circle');
    expect(addShape(empty, 'nope').layers[0].shape).toBe('arrow');
    expect(SHAPES.map((x) => x.key)).toEqual(['arrow', 'ring', 'burst', 'sparkle', 'tag']);
  });

  test('drawnSize: a tag\'s words, sized in their box; a shape without words has none', () => {
    const measureFor = () => (s, size) => String(s).length * size * 0.5;
    const tag = addShape(empty, 'tag').layers[0];
    const box = shapeWordsBox(tag);
    expect(drawnSize(tag, measureFor)).toBe(fitText('$29', { w: box.w, h: box.h, size: Math.round(box.h * 0.8) }, measureFor()).size);
    expect(drawnSize(addShape(empty, 'arrow').layers[0], measureFor)).toBeNull();
  });

  test('shapeCanvas: room for the outline; the outline drawn under the fill; a tag\'s hole punched; its words', () => {
    const calls = [];
    const ctx = {
      measureText: (s) => ({ width: String(s).length * 10 }),
      translate: (...a) => calls.push(['translate', ...a]), beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, closePath: () => {},
      arc: () => calls.push(['arc']), ellipse: () => calls.push(['ellipse']), save: () => {}, restore: () => {},
      stroke: () => calls.push(['stroke', ctx.strokeStyle, ctx.lineWidth]), fill: () => calls.push(['fill', ctx.fillStyle, ctx.globalCompositeOperation]),
      fillText: (t) => calls.push(['text', t]),
    };
    const made = [];
    const make = (w, h) => { made.push([w, h]); return { getContext: () => ctx }; };
    const tag = { ...addShape(empty, 'tag').layers[0], stroke: '#000000', strokeWidth: 5 };
    shapeCanvas(tag, make);
    const m = shapeMargin(tag);
    expect(m).toBe(7);
    expect(made).toEqual([[tag.w + 14, tag.h + 14]]);
    expect(calls[0]).toEqual(['translate', 7 + tag.w / 2, 7 + tag.h / 2]);
    const order = calls.filter((c) => c[0] === 'stroke' || c[0] === 'fill' || c[0] === 'text');
    expect(order[0]).toEqual(['stroke', '#000000', 10]);
    expect(order[1][0]).toBe('fill');
    expect(order[2]).toEqual(['fill', expect.anything(), 'destination-out']);
    expect(order.at(-1)).toEqual(['text', '$29']);
    expect(shapeMargin({ stroke: null })).toBe(2);
  });

  test('shapeCanvas: a ring is a line in its colour, its outline a wider line under it', () => {
    const strokes = [];
    const ctx = {
      translate: () => {}, beginPath: () => {}, ellipse: () => {},
      stroke: () => strokes.push([ctx.strokeStyle, ctx.lineWidth]), fill: () => { throw new Error('a ring is not filled'); },
    };
    shapeCanvas({ shape: 'ring', w: 300, h: 200, fill: '#FF3B3B', thickness: 16, stroke: '#FFFFFF', strokeWidth: 4 }, () => ({ getContext: () => ctx }));
    expect(strokes).toEqual([['#FFFFFF', 24], ['#FF3B3B', 16]]);
  });
});

describe('copy and paste between episodes (Evoni, 2026-10-21)', () => {
  const one = presetLayers('lala-left', { title: 'Red Dress Day', kicker: 'Styling Adventures', badge: 'EP 1', backgroundUrl: 'https://b.s3.amazonaws.com/bg.jpg', lalaUrl: 'https://b.s3.amazonaws.com/l.png' }, {});

  test('copyLayers: the picked ones, unlocked; not the shade; null when nothing is picked', () => {
    const locked = updateLayer(one, 'title', { locked: true });
    const c = copyLayers(locked, ['title', 'shade', 'badge'], { episodeId: 'ep-1', title: 'Red Dress Day' });
    expect(c.from).toEqual({ episodeId: 'ep-1', title: 'Red Dress Day' });
    expect(c.layers.map((l) => [l.id, l.locked])).toEqual([['title', false], ['badge', false]]);
    expect(copyLayers(one, ['shade'])).toBeNull();
    expect(copyLayers(one, [])).toBeNull();
  });

  test('pasteLayers: on top, where they were; a role already here comes in as a plain layer; nudged on the same episode', () => {
    const c = copyLayers(one, ['title', 'badge']);
    const { spec, ids } = pasteLayers(one, c, { nudge: true });
    expect(ids).toEqual(['title-1', 'badge-1']);
    const pasted = spec.layers.slice(-2);
    expect(pasted.map((l) => [l.role, l.name])).toEqual([[null, 'Title'], [null, 'Badge']]);
    expect(pasted[0]).toMatchObject({ text: 'Red Dress Day', x: layerOf(one, 'title').x + 24, y: layerOf(one, 'title').y + 24 });
    expect(layerOf(spec, 'title').text).toBe('Red Dress Day'); // this episode's own title is still the title
  });

  test('pasteLayers: on a thumbnail without that role, the layer keeps its role and id; a background goes to the back', () => {
    const bare = { version: 2, layers: [{ id: 'shade', role: 'shade', kind: 'shade', visible: true }] };
    const { spec, ids } = pasteLayers(bare, copyLayers(one, ['background', 'title']));
    expect(ids).toEqual(['background', 'title']);
    expect(spec.layers.map((l) => l.id)).toEqual(['background', 'shade', 'title']);
    expect(layerOf(spec, 'title').text).toBe('Red Dress Day');
    expect(pasteLayers(bare, null)).toEqual({ spec: bare, ids: [] });
  });
});

/**
 * The thumbnail as layers (thumbnailLayers; Evoni, 2026-10-21: move, resize
 * and turn anything). readLayers keeps numbers in range and refuses foreign
 * pictures; fitText makes words smaller until they fit their box; the
 * renderer draws real pixels (node-canvas), turned about each layer's centre.
 */

const sharp = require('sharp');
const L = require('../../../src/services/thumbnailLayers');

const s3 = (url) => /^https:\/\/b\.s3\.amazonaws\.com\//.test(url);

describe('readLayers', () => {
  test('keeps numbers in range, fills defaults, cuts text, and gives every layer its own id', () => {
    const spec = L.readLayers({
      version: 2,
      layers: [
        { id: 'bg', kind: 'image', role: 'background', src: 'https://b.s3.amazonaws.com/bg.jpg', fit: 'cover', x: -99999, y: 0, w: 0, h: 99999, rotation: 400 },
        { id: 'bg', kind: 'text', text: `  ${'word '.repeat(60)} `, size: 999, color: 'pink', align: 'sideways', visible: false },
        { kind: 'shade', dim: 5, side: 'up' },
        { kind: 'badge', text: 'EP 12345678901234567890', fill: '#b8962e' },
      ],
    }, s3);
    const [bg, text, shade, badge] = spec.layers;
    expect(bg).toMatchObject({ id: 'bg', role: 'background', fit: 'cover', frame: 'none', x: -1280, w: 1, h: 2160, rotation: 180, visible: true, opacity: 1 });
    expect(text).toMatchObject({ id: 'bg-2', size: 220, color: '#FFFFFF', stroke: '#2A0A22', bg: null, align: 'left', font: 'serif', visible: false });
    expect(text.text.length).toBe(160);
    expect(shade).toMatchObject({ id: 'layer-3', dim: 0.8, side: 'left', accent: '#E0689F' });
    expect(badge).toMatchObject({ text: 'EP 1234567890123', fill: '#B8962E' });
    expect(L.readLayers({ version: 2, layers: [{ kind: 'text', text: 'x', stroke: null }] }, s3).layers[0].stroke).toBeNull();
    // A locked layer stays locked; anything else is unlocked.
    const lk = L.readLayers({ version: 2, layers: [{ kind: 'text', text: 'x', locked: true }, { kind: 'text', text: 'y', locked: 'yes please' }, { kind: 'text', text: 'z' }] }, s3).layers;
    expect(lk.map((l) => l.locked)).toEqual([true, true, false]);
  });

  test('refuses what is not layers, unknown kinds, too many layers, and pictures that are not ours', () => {
    expect(() => L.readLayers({ layout: 'lala-left' }, s3)).toThrow(/version: 2/);
    expect(() => L.readLayers({ version: 2, layers: [{ kind: 'video' }] }, s3)).toThrow(/kind must be one of/);
    expect(() => L.readLayers({ version: 2, layers: Array.from({ length: 25 }, () => ({ kind: 'text' })) }, s3)).toThrow(/At most 24/);
    let err;
    try { L.readLayers({ version: 2, layers: [{ kind: 'image', src: 'https://evil.example.com/x.png' }] }, s3); } catch (e) { err = e; }
    expect(err).toMatchObject({ status: 400, message: expect.stringMatching(/not one of ours/) });
  });
});

describe('fitText', () => {
  // Every character is half the size wide: easy to reason about.
  const measure = (s, size) => s.length * size * 0.5;

  test('the largest size at which every line fits the width and the lines fit the height', () => {
    // 'Come Style Me' at 80 is 520 wide: too wide for 400, so two lines; 2 x 80 x 1.12 = 179 <= 200.
    expect(L.fitText('Come Style Me', { w: 400, h: 200, size: 80 }, measure)).toEqual({ size: 80, lines: ['Come Style', 'Me'] });
    // In a short box it gets smaller until the lines fit.
    const small = L.fitText('I Designed My Outfit for a Fashion Studio Experiment', { w: 600, h: 120, size: 90 }, measure);
    expect(small.lines.length * small.size * L.LINE_HEIGHT).toBeLessThanOrEqual(120);
    expect(Math.max(...small.lines.map((l) => measure(l, small.size)))).toBeLessThanOrEqual(600);
    expect(L.fitText('', { w: 100, h: 100, size: 40 }, measure)).toEqual({ size: 40, lines: [] });
    // Nothing fits: the smallest size, wrapped.
    expect(L.fitText('Supercalifragilistic', { w: 20, h: 5, size: 40 }, measure).size).toBe(10);
  });
});

describe('renderLayers', () => {
  const solid = (w, h, background) => sharp({ create: { width: w, height: h, channels: 3, background } }).png().toBuffer();
  const pixel = async (png, x, y) => {
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };

  test('a 1280x720 PNG; a cover background fills it; a turned layer is turned about its centre; hidden layers are not drawn', async () => {
    const spec = L.readLayers({
      version: 2,
      layers: [
        { id: 'bg', kind: 'image', src: 'https://b.s3.amazonaws.com/bg.png', fit: 'cover', x: 0, y: 0, w: 1280, h: 720 },
        // A 400x40 bar at the centre, turned 90 degrees: it stands upright.
        { id: 'bar', kind: 'image', src: 'https://b.s3.amazonaws.com/bar.png', fit: 'cover', x: 440, y: 340, w: 400, h: 40, rotation: 90 },
        { id: 'gone', kind: 'image', src: 'https://b.s3.amazonaws.com/bar.png', fit: 'cover', x: 0, y: 0, w: 200, h: 200, visible: false },
      ],
    }, s3);
    const png = await L.renderLayers(spec, {
      bg: await solid(1600, 900, '#0000FF'),
      bar: await solid(400, 40, '#FF0000'),
      gone: await solid(10, 10, '#00FF00'),
    });
    expect(await sharp(png).metadata()).toMatchObject({ width: 1280, height: 720, format: 'png' });
    expect(await pixel(png, 640, 200)).toEqual([255, 0, 0]); // above the centre: the upright bar
    expect(await pixel(png, 300, 360)).toEqual([0, 0, 255]); // left of the centre: background (unturned, the bar was here)
    expect(await pixel(png, 50, 50)).toEqual([0, 0, 255]); // the hidden layer is not drawn
  });

  test('text, a badge and the shade draw; a picture that does not read is a 400', async () => {
    const spec = L.readLayers({
      version: 2,
      layers: [
        { kind: 'shade', dim: 0, accent: '#B8962E', side: 'none' },
        { kind: 'text', text: 'Come Style Me', font: 'script', size: 120, color: '#FFFFFF', stroke: null, x: 100, y: 100, w: 800, h: 200 },
        { kind: 'badge', text: 'EP 1', x: 1000, y: 40, w: 180, h: 70 },
      ],
    }, s3);
    const png = await L.renderLayers(spec, {});
    expect(await pixel(png, 640, 715)).toEqual([0xB8, 0x96, 0x2E]); // the accent stripe
    expect(await pixel(png, 1000, 75)).toEqual([0xFF, 0xFF, 0xFF]); // the badge's white outline
    expect(await pixel(png, 1010, 75)).toEqual([0xE0, 0x68, 0x9F]); // inside it, the pill's colour
    const bad = L.readLayers({ version: 2, layers: [{ id: 'x', kind: 'image', src: 'https://b.s3.amazonaws.com/x.png' }] }, s3);
    await expect(L.renderLayers(bad, { x: Buffer.from('not a picture') })).rejects.toMatchObject({ status: 400 });
  });

  test('a checklist: at most six rows with words, ticked unless turned off; a ticked box is drawn ticked', async () => {
    const spec = L.readLayers({
      version: 2,
      layers: [{ kind: 'checklist', x: 100, y: 100, w: 400, h: 200, color: '#ffffff',
        items: [{ text: 'Sweater dress' }, { text: 'Hair', checked: false }, { text: '' }, ...Array.from({ length: 6 }, (_, i) => ({ text: `Row ${i}` }))] }],
    }, s3);
    const list = spec.layers[0];
    expect(list.items.slice(0, 2)).toEqual([{ text: 'Sweater dress', checked: true }, { text: 'Hair', checked: false }]);
    expect(list.items).toHaveLength(5); // six rows read, the empty one dropped
    expect(list).toMatchObject({ font: 'hand', color: '#FFFFFF' });
    const one = L.readLayers({ version: 2, layers: [
      { kind: 'shade', dim: 0, side: 'none', accent: '#000000' },
      { kind: 'checklist', x: 100, y: 100, w: 400, h: 100, items: [{ text: 'Vibe' }] },
    ] }, s3);
    const png = await L.renderLayers(one, {});
    // The row's box is 60 wide at the left of the layer; its tick runs up to the right corner.
    const rows = L.checklistRows(one.layers[1], (t, size) => t.length * size * 0.5);
    expect(rows).toMatchObject({ rowH: 100, box: 60 });
    expect(await pixel(png, 100, 150)).toEqual([255, 255, 255]); // the box's left side
    expect(await pixel(png, 130, 150)).not.toEqual([255, 255, 255]); // inside the box, left of the tick: empty
  });

  test('a photo card: a white card, the product whole and in the middle (contain), or filling it (cover)', async () => {
    const card = (fit) => L.readLayers({ version: 2, layers: [
      { kind: 'shade', dim: 0, side: 'none', accent: '#000000' },
      { id: 'p', kind: 'image', src: 'https://b.s3.amazonaws.com/p.png', frame: 'polaroid', fit, x: 100, y: 100, w: 200, h: 200 },
    ] }, s3);
    const wide = await solid(400, 100, '#00FF00'); // a wide product: 4 to 1
    const whole = await L.renderLayers(card('contain'), { p: wide });
    expect(await pixel(whole, 200, 200)).toEqual([0, 255, 0]); // the middle of the card: the product
    expect(await pixel(whole, 200, 125)).toEqual([255, 255, 255]); // above it: the white card
    const filled = await L.renderLayers(card('cover'), { p: wide });
    expect(await pixel(filled, 200, 125)).toEqual([0, 255, 0]); // filled: the product reaches the top
  });

  // Evoni, 2026-10-21: text tools. Where the white words reach, on a black background, in rows y0..y1.
  const ink = async (png, y0, y1) => {
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    let left = info.width;
    let right = -1;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const i = (y * info.width + x) * info.channels;
        if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) { left = Math.min(left, x); right = Math.max(right, x); }
      }
    }
    return { left, right };
  };
  const words = (extra) => ({
    version: 2,
    layers: [
      { id: 'bg', kind: 'image', role: 'background', src: 'https://b.s3.amazonaws.com/black.png', fit: 'cover', x: 0, y: 0, w: 1280, h: 720 },
      { id: 't', kind: 'text', text: 'Glam', font: 'sans', size: 80, stroke: null, x: 140, y: 300, w: 1000, h: 120, ...extra },
    ],
  });
  const draw = async (extra) => L.renderLayers(L.readLayers(words(extra), s3), { bg: await solid(1280, 720, '#000000') });

  test('text tools are kept in range: spacing -2..20, the box see-through 0..1 and rounded 0..60', () => {
    const [t] = L.readLayers({ version: 2, layers: [{ kind: 'text', text: 'x', spacing: 99, bg: '#123456', bgOpacity: 3, bgRadius: -5, align: 'right' }] }, s3).layers;
    expect(t).toMatchObject({ spacing: 20, bg: '#123456', bgOpacity: 1, bgRadius: 0, align: 'right' });
    const [d] = L.readLayers({ version: 2, layers: [{ kind: 'text', text: 'x', spacing: -9, bgRadius: 999 }] }, s3).layers;
    expect(d).toMatchObject({ spacing: -2, bg: null, bgOpacity: 1, bgRadius: 60 });
  });

  test('spaced: each letter, then the spacing after it; no spacing is the plain measure', () => {
    const measure = (s, size) => String(s).length * size; // 1 point per letter per size
    expect(L.spaced(measure, 0)).toBe(measure);
    expect(L.spaced(measure, 5)('abc', 10)).toBe(3 * 10 + 3 * 5);
  });

  test('left, centre and right line the words up inside their box', async () => {
    const left = await ink(await draw({ align: 'left' }), 330, 390);
    const centre = await ink(await draw({ align: 'center' }), 330, 390);
    const right = await ink(await draw({ align: 'right' }), 330, 390);
    expect(left.left).toBeLessThan(150);
    expect(right.right).toBeGreaterThan(1130);
    expect(Math.abs((centre.left + centre.right) / 2 - 640)).toBeLessThan(6);
  });

  test('letter spacing spreads the words; centred, they stay centred', async () => {
    const plain = await ink(await draw({ align: 'center' }), 330, 390);
    const wide = await ink(await draw({ align: 'center', spacing: 20 }), 330, 390);
    expect(wide.right - wide.left).toBeGreaterThan(plain.right - plain.left + 50);
    expect(Math.abs((wide.left + wide.right) / 2 - 640)).toBeLessThan(6);
  });

  test('a box behind the words: its colour, see-through over the background, its corners rounded', async () => {
    const png = await draw({ text: '', bg: '#FF0000', bgOpacity: 0.5, bgRadius: 40 });
    const [r, g, b] = await pixel(png, 640, 360);
    expect(r).toBeGreaterThan(120);
    expect(r).toBeLessThan(135); // half red over black
    expect([g, b]).toEqual([0, 0]);
    expect(await pixel(png, 141, 301)).toEqual([0, 0, 0]); // the rounded corner leaves the background
    const square = await draw({ text: '', bg: '#FF0000', bgOpacity: 1, bgRadius: 0 });
    expect(await pixel(square, 141, 301)).toEqual([255, 0, 0]);
  });

  // Picture effects (Evoni, 2026-10-21).
  const halves = () => sharp({ create: { width: 200, height: 100, channels: 3, background: '#FF0000' } })
    .composite([{ input: { create: { width: 100, height: 100, channels: 3, background: '#0000FF' } }, left: 100, top: 0 }]).png().toBuffer();
  const pictured = (extra, more = []) => L.readLayers({ version: 2, layers: [
    { id: 'bg', kind: 'image', role: 'background', src: 'https://b.s3.amazonaws.com/w.png', fit: 'cover', x: 0, y: 0, w: 1280, h: 720 },
    { id: 'p', kind: 'image', src: 'https://b.s3.amazonaws.com/p.png', fit: 'contain', x: 440, y: 160, w: 400, h: 400, ...extra },
    ...more,
  ] }, s3);

  test('picture effects are kept in range', () => {
    const [, p] = pictured({ brightness: 3, contrast: -3, outline: '#abcdef', outlineWidth: 99, shadow: 1, flipX: 'yes' }).layers;
    expect(p).toMatchObject({ brightness: 0.5, contrast: -0.5, outline: '#ABCDEF', outlineWidth: 40, shadow: true, flipX: true });
    const [, q] = pictured({ outline: 'pink' }).layers;
    expect(q).toMatchObject({ brightness: 0, contrast: 0, outline: null, outlineWidth: 12, shadow: false, flipX: false });
  });

  test('toneValue: contrast about the middle, then brightness; kept in 0..255', () => {
    expect(L.toneValue(128, 0, 0.5)).toBe(128);
    expect(L.toneValue(200, 0, 0.5)).toBe(236);
    expect(L.toneValue(100, 0.1, 0)).toBe(126);
    expect(L.toneValue(250, 0.5, 0)).toBe(255);
    expect(L.toneValue(5, -0.5, 0)).toBe(0);
  });

  test('flip turns the picture left to right; brightness lightens it', async () => {
    const white = await solid(1280, 720, '#FFFFFF');
    const pic = await halves();
    const plain = await L.renderLayers(pictured({ fit: 'cover' }), { bg: white, p: pic });
    expect(await pixel(plain, 500, 360)).toEqual([255, 0, 0]);
    const flipped = await L.renderLayers(pictured({ fit: 'cover', flipX: true }), { bg: white, p: pic });
    expect(await pixel(flipped, 500, 360)).toEqual([0, 0, 255]);
    expect(await pixel(flipped, 780, 360)).toEqual([255, 0, 0]);
    const lighter = await L.renderLayers(pictured({ fit: 'cover', brightness: 0.2 }), { bg: white, p: pic });
    expect(await pixel(lighter, 780, 360)).toEqual([51, 51, 255]);
  });

  test('a sticker edge round a cut-out, in its colour; a shadow under it; not on a photo card', async () => {
    const grey = await solid(1280, 720, '#808080');
    // A cut-out: a green square in the middle of a see-through picture.
    const cutout = await sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: { create: { width: 200, height: 200, channels: 4, background: '#00FF00' } }, left: 100, top: 100 }]).png().toBuffer();
    const plain = await L.renderLayers(pictured({}), { bg: grey, p: cutout });
    expect(await pixel(plain, 640, 360)).toEqual([0, 255, 0]);
    expect(await pixel(plain, 535, 360)).toEqual([128, 128, 128]); // just left of the square: the background
    const edged = await L.renderLayers(pictured({ outline: '#FFFFFF', outlineWidth: 12 }), { bg: grey, p: cutout });
    expect(await pixel(edged, 640, 360)).toEqual([0, 255, 0]);
    expect(await pixel(edged, 535, 360)).toEqual([255, 255, 255]); // the white edge
    expect(await pixel(edged, 520, 360)).toEqual([128, 128, 128]); // beyond it
    const shadowed = await L.renderLayers(pictured({ shadow: true }), { bg: grey, p: cutout });
    const [r] = await pixel(shadowed, 640, 470); // just below the square
    expect(r).toBeLessThan(110);
    const card = await L.renderLayers(pictured({ frame: 'polaroid', outline: '#FF0000' }), { bg: grey, p: cutout });
    expect(await pixel(card, 445, 360)).toEqual([255, 255, 255]); // the card's own edge, no red sticker edge
  });

  // Text effects (Evoni, 2026-10-21).
  const raw = async (png) => sharp(png).raw().toBuffer({ resolveWithObject: true });
  /** Over a box of the PNG: f(r, g, b) for each pixel, gathered by reduce. */
  const over = async (png, { x0, y0, x1, y1 }, f, start) => {
    const { data, info } = await raw(png);
    let acc = start;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const i = (y * info.width + x) * info.channels;
        acc = f(acc, data[i], data[i + 1], data[i + 2], x, y);
      }
    }
    return acc;
  };

  test('text effects are kept in range', () => {
    const [, t] = L.readLayers(words({ effect: 'glow', effectColor: '#abcdef', effectSize: 99, gradient: '#00ff00', curve: 999 }), s3).layers;
    expect(t).toMatchObject({ effect: 'glow', effectColor: '#ABCDEF', effectSize: 40, gradient: '#00FF00', curve: 180 });
    const [, d] = L.readLayers(words({ effect: 'sparkle', effectColor: 'gold', effectSize: 1, gradient: 'pink', curve: -999 }), s3).layers;
    expect(d).toMatchObject({ effect: 'none', effectColor: '#FFD86B', effectSize: 4, gradient: null, curve: -180 });
    expect(L.textEffect(d)).toBeNull();
    expect(L.textEffect({ effect: 'shadow', effectSize: 18 })).toEqual({ color: 'rgba(0,0,0,0.6)', blur: 18, offsetY: 6 });
    expect(L.fancyWords(d)).toBe(true); // curved
    expect(L.fancyWords({ effect: 'none', gradient: null, curve: 0 })).toBe(false);
  });

  test('curveLayout: letters spread evenly about the middle, rising to it (up) or falling (down); the line fits the box', () => {
    const plain = (s, size) => String(s).length * size * 0.5;
    const l = { curve: 90, size: 100, w: 600, h: 300, spacing: 0, bg: null };
    const up = L.curveLayout('ABCDE', l, plain);
    const xs = up.glyphs.map((g) => g.x);
    expect(xs[2]).toBeCloseTo(0, 6);
    expect(xs[0]).toBeCloseTo(-xs[4], 6);
    expect(up.glyphs[2].y).toBeLessThan(up.glyphs[0].y); // the middle letter is highest
    expect(up.glyphs[0].rotation).toBeLessThan(0);
    expect(up.glyphs[4].rotation).toBeGreaterThan(0);
    const down = L.curveLayout('ABCDE', { ...l, curve: -90 }, plain);
    expect(down.glyphs[2].y).toBeGreaterThan(down.glyphs[0].y);
    expect(down.glyphs[0].rotation).toBeGreaterThan(0);
    // Too long for the box at 100: it comes down until it fits.
    const long = L.curveLayout('ABCDEFGHIJKLMNOP', l, plain);
    expect(long.size).toBeLessThan(100);
    const R = (16 * long.size * 0.5) / (Math.PI / 2);
    expect(2 * R * Math.sin(Math.PI / 4) + long.size).toBeLessThanOrEqual(600);
  });

  test('a glow lights the background round the words in its colour; none leaves it dark', async () => {
    const above = { x0: 140, y0: 316, x1: 1139, y1: 326 }; // over the words, inside their box
    const maxRed = (png) => over(png, above, (m, r) => Math.max(m, r), 0);
    expect(await maxRed(await draw({ align: 'center' }))).toBe(0);
    const lit = await draw({ align: 'center', effect: 'glow', effectColor: '#FF0000', effectSize: 30 });
    expect(await maxRed(lit)).toBeGreaterThan(40);
    expect(await over(lit, above, (m, r, g, b) => Math.max(m, g, b), 0)).toBeLessThan(10); // red, not white
  });

  test('a shadow darkens under the words; the words stay their colour', async () => {
    const grey = await solid(1280, 720, '#808080');
    const spec = (extra) => L.readLayers(words({ align: 'center', ...extra }), s3);
    const below = { x0: 140, y0: 392, x1: 1139, y1: 402 };
    const darkest = (png) => over(png, below, (m, r) => Math.min(m, r), 255);
    expect(await darkest(await L.renderLayers(spec({}), { bg: grey }))).toBe(128);
    const shadowed = await L.renderLayers(spec({ effect: 'shadow', effectSize: 24 }), { bg: grey });
    expect(await darkest(shadowed)).toBeLessThan(110);
    expect((await ink(shadowed, 330, 390)).right).toBeGreaterThan(0);
  });

  test('a fade: the words\' colour at the top, the second colour at the bottom', async () => {
    const png = await draw({ text: 'HHHH', align: 'center', size: 110, color: '#FFFFFF', gradient: '#0000FF' });
    // Average red of the drawn letters (blue above 100) in a top band and a bottom band of the line.
    const band = (y0, y1) => over(png, { x0: 140, y0, x1: 1139, y1 }, (a, r, g, b) => (b > 100 ? { n: a.n + 1, r: a.r + r } : a), { n: 0, r: 0 });
    const top = await band(322, 332);
    const bottom = await band(388, 398);
    expect(top.n).toBeGreaterThan(50);
    expect(bottom.n).toBeGreaterThan(50);
    expect(top.r / top.n).toBeGreaterThan(170);
    expect(bottom.r / bottom.n).toBeLessThan(90);
  });

  test('curved words: up, the middle stands higher than the ends; down, lower', async () => {
    const curved = (curve) => draw({ text: 'GLAMOROUS', align: 'center', size: 90, y: 200, h: 320, curve });
    /** The topmost white pixel in a few columns about x. */
    const topAt = async (png, x) => over(png, { x0: x - 30, y0: 200, x1: x + 30, y1: 519 }, (m, r, g, b, _x, y) => (r > 200 && g > 200 && b > 200 ? Math.min(m, y) : m), 720);
    const { left, right } = await ink(await curved(150), 200, 519);
    const upPng = await curved(150);
    const mid = await topAt(upPng, 640);
    expect(mid).toBeLessThan(await topAt(upPng, left + 40) - 40);
    expect(mid).toBeLessThan(await topAt(upPng, right - 40) - 40);
    const downPng = await curved(-150);
    const d = await ink(downPng, 200, 519);
    expect(await topAt(downPng, 640)).toBeGreaterThan(await topAt(downPng, d.left + 40) + 40);
  });

  test('small on purpose is kept with the layer (the Studio stops warning about it)', () => {
    const [t, u] = L.readLayers({ version: 2, layers: [{ kind: 'text', text: 'fine print', smallOk: true }, { kind: 'badge', text: 'EP 1' }] }, s3).layers;
    expect([t.smallOk, u.smallOk]).toEqual([true, false]);
  });

  // Coloured cards and a cleared white background (Evoni, 2026-10-21: colour behind the wardrobe pieces).
  /** A product photo: a white background round a red square, with a white square (a white garment) inside it. */
  const productPhoto = () => sharp({ create: { width: 200, height: 200, channels: 3, background: '#FFFFFF' } })
    .composite([
      { input: { create: { width: 120, height: 120, channels: 3, background: '#FF0000' } }, left: 40, top: 40 },
      { input: { create: { width: 40, height: 40, channels: 3, background: '#FFFFFF' } }, left: 80, top: 80 },
    ]).png().toBuffer();

  test('a card is kept white unless a colour is chosen; clearWhite is kept', () => {
    const [, p] = pictured({ frame: 'polaroid', cardColor: '#e0689f', clearWhite: 1 }).layers;
    expect(p).toMatchObject({ cardColor: '#E0689F', clearWhite: true });
    const [, q] = pictured({ cardColor: 'pink' }).layers;
    expect(q).toMatchObject({ cardColor: '#FFFFFF', clearWhite: false });
  });

  test('a coloured card shows its colour; with the white cleared, the colour reaches the piece and a white garment stays white', async () => {
    const grey = await solid(1280, 720, '#808080');
    const photo = await productPhoto();
    // The card fills 440..840 × 160..560; the photo (cover) fills the card inside a 20-point edge.
    const plain = await L.renderLayers(pictured({ frame: 'polaroid', fit: 'cover', cardColor: '#00AA00' }), { bg: grey, p: photo });
    expect(await pixel(plain, 450, 360)).toEqual([0, 170, 0]); // the card's edge
    expect(await pixel(plain, 500, 360)).toEqual([255, 255, 255]); // the photo's own white
    const cleared = await L.renderLayers(pictured({ frame: 'polaroid', fit: 'cover', cardColor: '#00AA00', clearWhite: true }), { bg: grey, p: photo });
    expect(await pixel(cleared, 500, 360)).toEqual([0, 170, 0]); // the card shows through
    expect(await pixel(cleared, 580, 360)).toEqual([255, 0, 0]); // the piece
    expect(await pixel(cleared, 640, 360)).toEqual([255, 255, 255]); // the white inside it stays
  });

  test('without a card, clearing the white leaves what is behind the picture', async () => {
    const grey = await solid(1280, 720, '#808080');
    const png = await L.renderLayers(pictured({ fit: 'cover', clearWhite: true }), { bg: grey, p: await productPhoto() });
    expect(await pixel(png, 460, 360)).toEqual([128, 128, 128]);
    expect(await pixel(png, 640, 360)).toEqual([255, 255, 255]);
  });

  // Stickers and shapes (Evoni, 2026-10-21).
  const shaped = (extra) => L.readLayers({ version: 2, layers: [
    { id: 'bg', kind: 'image', role: 'background', src: 'https://b.s3.amazonaws.com/black.png', fit: 'cover', x: 0, y: 0, w: 1280, h: 720 },
    { id: 's', kind: 'shape', x: 440, y: 160, w: 400, h: 400, fill: '#FF0000', ...extra },
  ] }, s3);
  const drawShape = async (extra) => L.renderLayers(shaped(extra), { bg: await solid(1280, 720, '#000000') });

  test('shapes are kept in range; an unknown one is an arrow', () => {
    const [, a] = shaped({ shape: 'heart', fill: 'pink', stroke: '#abcdef', strokeWidth: 99, thickness: 1, text: 'x'.repeat(30) }).layers;
    expect(a).toMatchObject({ kind: 'shape', shape: 'arrow', fill: '#FFD86B', stroke: '#ABCDEF', strokeWidth: 24, thickness: 4, font: 'sans', color: '#FFFFFF' });
    expect(a.text).toHaveLength(16);
    const [, b] = shaped({ shape: 'tag', stroke: 'none', strokeWidth: -3 }).layers;
    expect(b).toMatchObject({ shape: 'tag', fill: '#FF0000', stroke: null, strokeWidth: 0, thickness: 16, text: '' });
    expect(L.SHAPES).toEqual(['arrow', 'ring', 'burst', 'sparkle', 'tag']);
  });

  test('an arrow points right: its head\'s tip at the right edge, the shaft thin at the left', async () => {
    const png = await drawShape({ shape: 'arrow', w: 400, h: 200, y: 260 });
    expect(await pixel(png, 835, 360)).toEqual([255, 0, 0]); // near the tip
    expect(await pixel(png, 830, 280)).toEqual([0, 0, 0]); // beside the tip
    expect(await pixel(png, 450, 360)).toEqual([255, 0, 0]); // the shaft
    expect(await pixel(png, 450, 290)).toEqual([0, 0, 0]); // above the shaft
    expect(await pixel(png, 690, 275)).toEqual([255, 0, 0]); // the head (from x 680) is nearly the full height
  });

  test('a ring: a line round the edge, the middle left clear; its outline outside and inside it', async () => {
    const png = await drawShape({ shape: 'ring', thickness: 20, stroke: '#FFFFFF', strokeWidth: 6 });
    expect(await pixel(png, 640, 360)).toEqual([0, 0, 0]);
    expect(await pixel(png, 450, 360)).toEqual([255, 0, 0]); // in the line, 10 in from the box
    expect(await pixel(png, 437, 360)).toEqual([255, 255, 255]); // the outline just outside it
    expect(await pixel(png, 463, 360)).toEqual([255, 255, 255]); // and just inside it
  });

  test('a burst: filled, its points reaching the box, its words in the middle', async () => {
    const png = await drawShape({ shape: 'burst', text: 'NEW', color: '#FFFFFF' });
    expect(await pixel(png, 640, 170)).toEqual([255, 0, 0]); // the top point
    expect(await pixel(png, 445, 165)).toEqual([0, 0, 0]); // the box's corner stays clear
    const lit = await over(png, { x0: 520, y0: 330, x1: 760, y1: 390 }, (n, r, g, b) => n + (g > 200 && b > 200 ? 1 : 0), 0);
    expect(lit).toBeGreaterThan(500); // white words
  });

  test('a price tag: its hole shows what is behind it; its words sit right of the hole', async () => {
    const png = await drawShape({ shape: 'tag', y: 280, h: 160, text: '$29', color: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 4 });
    const holeX = Math.round(440 + 160 * 0.32);
    expect(await pixel(png, holeX, 360)).toEqual([0, 0, 0]);
    expect(await pixel(png, holeX + 25, 360)).toEqual([255, 0, 0]);
    expect(await pixel(png, 830, 300)).toEqual([255, 0, 0]); // the square end
    expect(await pixel(png, 445, 290)).toEqual([0, 0, 0]); // the pointed end leaves its corner
    const box = L.shapeWordsBox({ shape: 'tag', w: 400, h: 160 });
    expect(box.x - box.w / 2).toBeGreaterThan(-200 + 160 * 0.32);
  });

  test('sparkles: three four-point stars; between their points stays clear', async () => {
    const png = await drawShape({ shape: 'sparkle' });
    // The big star's centre is at (-0.2, 0.1) of the halves: (600, 380).
    expect(await pixel(png, 600, 380)).toEqual([255, 0, 0]);
    expect(await pixel(png, 600, 225)).toEqual([255, 0, 0]); // its top point
    expect(await pixel(png, 690, 290)).toEqual([0, 0, 0]); // between points
    expect(await pixel(png, 750, 250)).toEqual([255, 0, 0]); // the small star's centre (0.55, -0.55)
  });

  test('fontFile: only the thumbnail fonts', () => {
    expect(L.fontFile('script')).toMatch(/GreatVibes-Regular\.ttf$/);
    expect(L.fontFile('../../etc/passwd')).toBeNull();
  });
});
